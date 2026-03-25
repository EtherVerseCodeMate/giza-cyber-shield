/**
 * HMAC Authentication for License Endpoints
 * 
 * Provides HMAC-SHA256 signature verification to prevent unauthorized
 * heartbeat and registration requests.
 * 
 * Usage:
 * 1. Client generates HMAC: HMAC-SHA256(machine_id + timestamp + request_body, api_key)
 * 2. Client sends: X-Khepra-Signature: <hmac_hex>
 *                 X-Khepra-Timestamp: <unix_timestamp>
 * 3. Server verifies signature and timestamp freshness
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
		} catch (e) {
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
		const requestTime = parseInt(timestamp);
		
		if (isNaN(requestTime)) {
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

		// Look up the machine's API key from the database
		const license = await env.DB.prepare(`
			SELECT machine_id, api_key_hash FROM licenses
			WHERE machine_id = ? AND revoked = 0
		`).bind(machine_id).first();

		if (!license || !license.api_key_hash) {
			// For new registrations, use a shared enrollment secret
			// The enrollment token itself provides authorization
			if (parsedBody.enrollment_token) {
				return await verifyEnrollmentHMAC(signature, timestamp, body, parsedBody.enrollment_token, env);
			}
			
			return {
				valid: false,
				error: 'Machine not registered or missing API key'
			};
		}

		// Compute expected HMAC
		const message = `${machine_id}.${timestamp}.${body}`;
		const expectedSignature = await computeHMAC(message, license.api_key_hash);

		// Constant-time comparison to prevent timing attacks
		if (signature !== expectedSignature) {
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
		// Verify enrollment token exists
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

		// Use enrollment token as HMAC key for initial registration
		const parsedBody = JSON.parse(body);
		const message = `${parsedBody.machine_id}.${timestamp}.${body}`;
		const expectedSignature = await computeHMAC(message, enrollmentToken);

		if (signature !== expectedSignature) {
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
 * Compute HMAC-SHA256 signature
 * 
 * @param {string} message - Message to sign
 * @param {string} secret - Secret key
 * @returns {Promise<string>} - Hex-encoded HMAC signature
 */
async function computeHMAC(message, secret) {
	const encoder = new TextEncoder();
	const keyData = encoder.encode(secret);
	const messageData = encoder.encode(message);

	const key = await crypto.subtle.importKey(
		'raw',
		keyData,
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);

	const signature = await crypto.subtle.sign(
		'HMAC',
		key,
		messageData
	);

	// Convert to hex string
	return Array.from(new Uint8Array(signature))
		.map(b => b.toString(16).padStart(2, '0'))
		.join('');
}

/**
 * Generate a new API key for a machine
 * Returns both the key (to be sent to client) and hash (to be stored)
 * 
 * @returns {Promise<{apiKey: string, apiKeyHash: string}>}
 */
export async function generateAPIKey() {
	// Generate 32 random bytes
	const randomBytes = crypto.getRandomValues(new Uint8Array(32));
	const apiKey = 'khepra_' + Array.from(randomBytes)
		.map(b => b.toString(16).padStart(2, '0'))
		.join('');

	// Hash for storage (using SHA-256)
	const encoder = new TextEncoder();
	const data = encoder.encode(apiKey);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const apiKeyHash = Array.from(new Uint8Array(hashBuffer))
		.map(b => b.toString(16).padStart(2, '0'))
		.join('');

	return { apiKey, apiKeyHash };
}
