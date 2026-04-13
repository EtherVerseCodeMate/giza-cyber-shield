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
 *    a constant-time comparison via crypto.subtle.verify() to prevent timing attacks.
 *
 * Key storage: the api_key column holds the raw 64-hex-char key. It is NOT hashed.
 * HMAC keys are not passwords — the server must hold the raw key to verify. The key
 * has 256 bits of entropy (crypto.getRandomValues), providing equivalent security.
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

		// Check timestamp freshness (allow 5 minute window)
		const now = Math.floor(Date.now() / 1000);
		const requestTime = Number.parseInt(timestamp, 10);

		if (Number.isNaN(requestTime)) {
			return {
				valid: false,
				error: 'Invalid timestamp format'
			};
		}

		const timeDiff = Math.abs(now - requestTime);
		if (timeDiff > 300) { // 5 minutes
			return {
				valid: false,
				error: 'Request timestamp expired (must be within 5 minutes)'
			};
		}

		// Look up the raw api_key from the database.
		// The api_key column stores the raw key (not a hash) so the server can
		// recompute the HMAC for constant-time verification.
		const license = await env.DB.prepare(`
			SELECT machine_id, api_key FROM licenses
			WHERE machine_id = ? AND revoked = 0
		`).bind(machine_id).first();

		if (!license?.api_key) {
			// For new registrations, the machine won't be in the DB yet.
			// Fall through to enrollment token HMAC path.
			if (parsedBody.enrollment_token) {
				return verifyEnrollmentHMAC(signature, timestamp, body, parsedBody.enrollment_token, env);
			}

			return {
				valid: false,
				error: 'Machine not registered or missing API key'
			};
		}

		// Constant-time HMAC verification via crypto.subtle.verify() —
		// prevents timing attacks that `===` string comparison cannot.
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
 * Verify HMAC for enrollment/registration requests
 * Uses enrollment token as shared secret
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

		// Use enrollment token as HMAC key for initial registration.
		// Constant-time verification prevents timing oracle on token validity.
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
 * Constant-time HMAC-SHA256 verification using crypto.subtle.verify().
 * crypto.subtle.verify() performs the comparison internally in constant time,
 * preventing timing-oracle attacks that string !== comparison cannot prevent.
 *
 * @param {string} message   - Message that was signed
 * @param {string} secret    - Raw HMAC key (api_key or enrollment token)
 * @param {string} hexSig    - Hex-encoded signature from the client
 * @returns {Promise<boolean>}
 */
async function verifyHMAC(message, secret, hexSig) {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign', 'verify']
	);

	// Decode client-supplied hex signature into bytes for comparison
	const sigBytes = new Uint8Array(hexSig.match(/.{2}/g).map(b => Number.parseInt(b, 16)));

	return crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(message));
}

/**
 * Generate a new API key for a machine.
 *
 * The key is returned to the client once (at registration time) and stored
 * raw in the `api_key` column so the server can recompute HMAC for
 * subsequent heartbeat verification. 256 bits of CSPRNG entropy means
 * storing the raw key is equivalent security to storing a bcrypt hash for
 * a random secret — the attacker cannot pre-compute it.
 *
 * @returns {Promise<{apiKey: string}>}
 */
export async function generateAPIKey() {
	const randomBytes = crypto.getRandomValues(new Uint8Array(32));
	const apiKey = 'khepra_' + Array.from(randomBytes)
		.map(b => b.toString(16).padStart(2, '0'))
		.join('');

	return { apiKey };
}
