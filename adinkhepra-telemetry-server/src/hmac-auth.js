/**
 * HMAC Authentication for License Endpoints
 *
 * Provides HMAC-SHA256 signature verification to prevent unauthorized
 * heartbeat and registration requests.
 *
 * Usage:
 * 1. Client generates HMAC: HMAC-SHA256(machine_id + "." + timestamp + "." + body, api_key)
 * 2. Client sends: X-Khepra-Signature: <hmac_hex>
 *                 X-Khepra-Timestamp: <unix_timestamp_seconds>
 * 3. Server fetches the raw api_key from the licenses table, recomputes, and does
 *    a constant-time comparison via XOR accumulator to prevent timing attacks.
 *
 * Key storage: the api_key column holds the raw 64-hex-char key. It is NOT hashed.
 * HMAC keys are not passwords — the server must hold the raw key to verify. The key
 * has 256 bits of entropy (crypto.getRandomValues), providing equivalent security.
 *
 * NOTE: Uses dynamic import('node:crypto') at runtime. Under nodejs_compat,
 * static ESM imports of node builtins get bundled differently; dynamic import
 * resolves to the unenv crypto shim which provides createHmac/randomBytes.
 */

/**
 * Verify HMAC signature for license endpoint requests
 *
 * @param {Request} request - HTTP request
 * @param {string} body - Request body as string
 * @param {Env} env - Environment variables
 * @returns {Promise<{valid: boolean, error?: string, machineId?: string}>}
 */
export async function verifyLicenseHMAC(request, body, env) {
	try {
		const signature = request.headers.get('X-Khepra-Signature');
		const timestamp = request.headers.get('X-Khepra-Timestamp');

		if (!signature || !timestamp) {
			return {
				valid: false,
				error: 'Missing HMAC authentication headers (X-Khepra-Signature, X-Khepra-Timestamp)'
			};
		}

		// Parse request body to get machine_id
		let parsedBody;
		try {
			parsedBody = JSON.parse(body);
		} catch {
			return {
				valid: false,
				error: 'Invalid JSON request body'
			};
		}

		const { machine_id } = parsedBody;
		if (!machine_id) {
			return {
				valid: false,
				error: 'Missing machine_id in request body'
			};
		}

		// Check timestamp freshness (5 minute window prevents replay attacks)
		const now = Math.floor(Date.now() / 1000);
		const requestTime = Number.parseInt(timestamp, 10);

		if (Number.isNaN(requestTime)) {
			return {
				valid: false,
				error: 'Invalid timestamp format'
			};
		}

		if (Math.abs(now - requestTime) > 300) {
			return {
				valid: false,
				error: 'Request timestamp expired (must be within 5 minutes)'
			};
		}

		// Look up the raw api_key from the database.
		const license = await env.DB.prepare(`
			SELECT machine_id, api_key FROM licenses
			WHERE machine_id = ? AND revoked = 0
		`).bind(machine_id).first();

		if (!license?.api_key) {
			// For new registrations, machine won't be in DB yet.
			// Fall through to enrollment token HMAC verification.
			if (parsedBody.enrollment_token) {
				// CRITICAL: must await so exceptions propagate to this try/catch
				return await verifyEnrollmentHMAC(signature, timestamp, body, parsedBody.enrollment_token, env);
			}

			return {
				valid: false,
				error: 'Machine not registered or missing API key'
			};
		}

		// Constant-time HMAC verification for established machines
		const message = `${machine_id}.${timestamp}.${body}`;
		const valid = await verifyHMAC(message, license.api_key, signature);

		if (!valid) {
			return {
				valid: false,
				error: 'Invalid HMAC signature'
			};
		}

		return {
			valid: true,
			machineId: machine_id
		};

	} catch (error) {
		console.error('HMAC verification error:', error);
		return {
			valid: false,
			error: 'HMAC verification failed'
		};
	}
}

/**
 * Verify HMAC for enrollment/registration requests.
 * Uses enrollment token as shared secret for the initial registration handshake.
 */
async function verifyEnrollmentHMAC(signature, timestamp, body, enrollmentToken, env) {
	try {
		// Verify enrollment token exists and is active
		const enrollment = await env.DB.prepare(`
			SELECT token, active FROM enrollment_tokens
			WHERE token = ? AND active = 1
		`).bind(enrollmentToken).first();

		if (!enrollment) {
			return {
				valid: false,
				error: 'Invalid enrollment token'
			};
		}

		// Build the signed message and verify the HMAC
		const parsedBody = JSON.parse(body);
		const message = `${parsedBody.machine_id}.${timestamp}.${body}`;
		const valid = await verifyHMAC(message, enrollmentToken, signature);

		if (!valid) {
			return {
				valid: false,
				error: 'Invalid enrollment HMAC signature'
			};
		}

		return {
			valid: true,
			machineId: parsedBody.machine_id
		};

	} catch (error) {
		console.error('Enrollment HMAC verification error:', error);
		return {
			valid: false,
			error: 'Enrollment HMAC verification failed'
		};
	}
}

/**
 * Constant-time HMAC-SHA256 verification.
 *
 * Uses dynamic import('node:crypto') which resolves at runtime to the unenv
 * crypto shim providing createHmac. Constant-time XOR accumulator comparison
 * on hex strings prevents timing-oracle attacks.
 *
 * @param {string} message  - Message that was signed
 * @param {string} secret   - Raw HMAC key (api_key or enrollment token)
 * @param {string} hexSig   - Hex-encoded signature from the client
 * @returns {Promise<boolean>}
 */
async function verifyHMAC(message, secret, hexSig) {
	const nc = await import('node:crypto');
	const expectedHex = nc.createHmac('sha256', secret)
		.update(message, 'utf8')
		.digest('hex');

	// Constant-time hex comparison — all chars must match
	if (!hexSig || hexSig.length !== expectedHex.length) {
		return false;
	}

	let diff = 0;
	for (let i = 0; i < expectedHex.length; i++) {
		diff |= expectedHex.codePointAt(i) ^ hexSig.codePointAt(i);
	}
	return diff === 0;
}

/**
 * Generate a cryptographically secure API key for a newly registered machine.
 * Uses 256-bit CSPRNG entropy; stored raw so the server can verify HMAC.
 *
 * @returns {Promise<{apiKey: string}>}
 */
export async function generateAPIKey() {
	const nc = await import('node:crypto');
	const apiKey = 'khepra_' + nc.randomBytes(32).toString('hex');
	return { apiKey };
}
