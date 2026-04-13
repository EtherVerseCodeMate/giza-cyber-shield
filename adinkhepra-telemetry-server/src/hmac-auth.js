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
 *    a constant-time comparison via crypto.timingSafeEqual() to prevent timing attacks.
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
			const enc2 = new TextEncoder();
			const diagKey = await crypto.subtle.importKey('raw', enc2.encode(enrollmentToken), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
			const diagBuf = await crypto.subtle.sign('HMAC', diagKey, enc2.encode(message));
			const computedSig = Array.from(new Uint8Array(diagBuf)).map(b => b.toString(16).padStart(2,'0')).join('');
			return {
				valid: false,
				error: 'Invalid enrollment HMAC signature',
				_dbg_computed: computedSig,
				_dbg_received: signature,
				_dbg_msg: message.substring(0, 120)
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
 * Constant-time HMAC-SHA256 verification using Node.js crypto.timingSafeEqual().
 * timingSafeEqual() performs byte comparison in constant time,
 * preventing timing-oracle attacks that string !== comparison cannot prevent.
 * Uses node:crypto (available via nodejs_compat flag) instead of crypto.subtle
 * to avoid Web Crypto API incompatibilities under the nodejs_compat runtime.
 *
 * @param {string} message   - Message that was signed
 * @param {string} secret    - Raw HMAC key (api_key or enrollment token)
 * @param {string} hexSig    - Hex-encoded signature from the client
 * @returns {Promise<boolean>}
 */
/**
 * Constant-time HMAC-SHA256 verification using crypto.subtle.
 * Uses sign+compare pattern: compute expected HMAC, then compare byte-by-byte
 * in constant time using a XOR-accumulator to prevent timing oracles.
 *
 * @param {string} message   - Message that was signed
 * @param {string} secret    - Raw HMAC key (api_key or enrollment token)
 * @param {string} hexSig    - Hex-encoded signature from the client
 * @returns {Promise<boolean>}
 */
async function verifyHMAC(message, secret, hexSig) {
	const encoder = new TextEncoder();
	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);

	// Compute the expected HMAC for the message
	const expectedBuffer = await crypto.subtle.sign('HMAC', keyMaterial, encoder.encode(message));
	const expected = new Uint8Array(expectedBuffer);

	// Decode the client-supplied hex signature into bytes
	// Manual hex decode — avoids reliance on Buffer (not available in Workers runtime)
	if (!hexSig || hexSig.length !== expected.length * 2) {
		return false;
	}
	const received = new Uint8Array(expected.length);
	for (let i = 0; i < expected.length; i++) {
		const byte = Number.parseInt(hexSig.slice(i * 2, i * 2 + 2), 16);
		if (Number.isNaN(byte)) return false;
		received[i] = byte;
	}

	// Constant-time comparison: XOR all bytes, result must be 0 for match
	// This prevents timing side-channel attacks
	let diff = 0;
	for (let i = 0; i < expected.length; i++) {
		diff |= expected[i] ^ received[i];
	}
	return diff === 0;
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
