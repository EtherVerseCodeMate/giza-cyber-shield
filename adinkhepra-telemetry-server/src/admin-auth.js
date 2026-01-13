/**
 * Admin Authentication Module
 * JWT-based authentication for license management
 *
 * Features:
 * - JWT tokens with 24-hour expiration
 * - Per-admin audit trail
 * - Token revocation support
 * - Emergency API key fallback
 * - bcrypt password hashing
 */

import bcrypt from 'bcryptjs';

/**
 * Admin Login - Issue JWT token
 *
 * @param {Request} request
 * @param {Env} env
 * @param {Object} corsHeaders
 * @returns {Response}
 */
export async function handleAdminLogin(request, env, corsHeaders) {
	try {
		const { username, password } = await request.json();

		if (!username || !password) {
			return new Response(JSON.stringify({
				error: 'Missing username or password'
			}), {
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		// Look up admin user
		const admin = await env.DB.prepare(`
			SELECT id, username, password_hash, role, active
			FROM admin_users
			WHERE username = ?
		`).bind(username).first();

		if (!admin) {
			// Constant-time response to prevent username enumeration
			await bcrypt.hash(password, 10); // Dummy hash to maintain timing
			return new Response(JSON.stringify({
				error: 'Invalid credentials'
			}), {
				status: 401,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		if (admin.active !== 1) {
			return new Response(JSON.stringify({
				error: 'Account disabled'
			}), {
				status: 403,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		// Verify password
		const passwordValid = await bcrypt.compare(password, admin.password_hash);
		if (!passwordValid) {
			return new Response(JSON.stringify({
				error: 'Invalid credentials'
			}), {
				status: 401,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		// Generate JWT token
		const now = Math.floor(Date.now() / 1000);
		const expiresAt = now + (24 * 3600); // 24 hours
		const jti = crypto.randomUUID(); // JWT ID for revocation

		const jwtPayload = {
			jti: jti,
			sub: admin.username,
			admin_id: admin.id,
			role: admin.role,
			iat: now,
			exp: expiresAt,
			iss: 'telemetry.souhimbou.org'
		};

		// Sign JWT with HMAC-SHA256
		const token = await signJWT(jwtPayload, env.JWT_SECRET);

		// Store session in database
		const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
		const userAgent = request.headers.get('User-Agent') || 'unknown';

		await env.DB.prepare(`
			INSERT INTO admin_sessions (
				admin_id, token_jti, issued_at, expires_at, ip_address, user_agent
			) VALUES (?, ?, ?, ?, ?, ?)
		`).bind(
			admin.id,
			jti,
			now,
			expiresAt,
			clientIP,
			userAgent
		).run();

		// Update last_login
		await env.DB.prepare(`
			UPDATE admin_users SET last_login = ? WHERE id = ?
		`).bind(now, admin.id).run();

		// Warn if using default password
		const isDefaultPassword = await bcrypt.compare('Change1234!', admin.password_hash);
		const warning = isDefaultPassword ?
			'WARNING: You are using the default password. Change it immediately!' : null;

		return new Response(JSON.stringify({
			token: token,
			expires_at: new Date(expiresAt * 1000).toISOString(),
			admin: {
				username: admin.username,
				role: admin.role
			},
			warning: warning
		}), {
			status: 200,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});

	} catch (error) {
		console.error('Admin login error:', error);
		return new Response(JSON.stringify({
			error: 'Login failed'
		}), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});
	}
}

/**
 * Verify JWT token and return admin info
 *
 * @param {Request} request
 * @param {Env} env
 * @returns {Object|null} { admin_id, username, role } or null if invalid
 */
export async function verifyAdminAuth(request, env) {
	const authHeader = request.headers.get('Authorization');
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return null;
	}

	const token = authHeader.split(' ')[1];

	// Check if it's the emergency API key
	if (env.ADMIN_API_KEY && token === env.ADMIN_API_KEY) {
		return {
			admin_id: 0,
			username: 'api-key-emergency',
			role: 'super_admin'
		};
	}

	// Verify JWT token
	try {
		const payload = await verifyJWT(token, env.JWT_SECRET);

		// Check if token is revoked
		const session = await env.DB.prepare(`
			SELECT revoked FROM admin_sessions WHERE token_jti = ?
		`).bind(payload.jti).first();

		if (session && session.revoked === 1) {
			return null; // Token revoked
		}

		return {
			admin_id: payload.admin_id,
			username: payload.sub,
			role: payload.role,
			jti: payload.jti
		};
	} catch (error) {
		console.error('JWT verification error:', error);
		return null;
	}
}

/**
 * Admin Logout - Revoke JWT token
 *
 * @param {Request} request
 * @param {Env} env
 * @param {Object} corsHeaders
 * @returns {Response}
 */
export async function handleAdminLogout(request, env, corsHeaders) {
	try {
		const admin = await verifyAdminAuth(request, env);
		if (!admin) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		// Revoke token
		if (admin.jti) {
			await env.DB.prepare(`
				UPDATE admin_sessions
				SET revoked = 1, revoked_at = ?
				WHERE token_jti = ?
			`).bind(Math.floor(Date.now() / 1000), admin.jti).run();
		}

		return new Response(JSON.stringify({
			message: 'Logged out successfully'
		}), {
			status: 200,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});

	} catch (error) {
		console.error('Logout error:', error);
		return new Response(JSON.stringify({
			error: 'Logout failed'
		}), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});
	}
}

/**
 * Change admin password
 *
 * @param {Request} request
 * @param {Env} env
 * @param {Object} corsHeaders
 * @returns {Response}
 */
export async function handleChangePassword(request, env, corsHeaders) {
	try {
		const admin = await verifyAdminAuth(request, env);
		if (!admin) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		const { old_password, new_password } = await request.json();

		if (!old_password || !new_password) {
			return new Response(JSON.stringify({
				error: 'Missing old_password or new_password'
			}), {
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		// Password strength check
		if (new_password.length < 12) {
			return new Response(JSON.stringify({
				error: 'Password must be at least 12 characters'
			}), {
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		// Get current password hash
		const user = await env.DB.prepare(`
			SELECT password_hash FROM admin_users WHERE id = ?
		`).bind(admin.admin_id).first();

		// Verify old password
		const oldPasswordValid = await bcrypt.compare(old_password, user.password_hash);
		if (!oldPasswordValid) {
			return new Response(JSON.stringify({
				error: 'Invalid old password'
			}), {
				status: 401,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		// Hash new password
		const newPasswordHash = await bcrypt.hash(new_password, 10);

		// Update password
		await env.DB.prepare(`
			UPDATE admin_users SET password_hash = ? WHERE id = ?
		`).bind(newPasswordHash, admin.admin_id).run();

		// Revoke all existing sessions (force re-login)
		await env.DB.prepare(`
			UPDATE admin_sessions
			SET revoked = 1, revoked_at = ?
			WHERE admin_id = ? AND revoked = 0
		`).bind(Math.floor(Date.now() / 1000), admin.admin_id).run();

		return new Response(JSON.stringify({
			message: 'Password changed successfully. Please log in again.'
		}), {
			status: 200,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});

	} catch (error) {
		console.error('Change password error:', error);
		return new Response(JSON.stringify({
			error: 'Password change failed'
		}), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});
	}
}

/**
 * Sign JWT using HMAC-SHA256
 *
 * @param {Object} payload
 * @param {string} secret
 * @returns {Promise<string>}
 */
async function signJWT(payload, secret) {
	const header = {
		alg: 'HS256',
		typ: 'JWT'
	};

	const encodedHeader = base64urlEncode(JSON.stringify(header));
	const encodedPayload = base64urlEncode(JSON.stringify(payload));
	const data = `${encodedHeader}.${encodedPayload}`;

	// Sign with HMAC-SHA256
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);

	const signature = await crypto.subtle.sign(
		'HMAC',
		key,
		encoder.encode(data)
	);

	const encodedSignature = base64urlEncode(signature);
	return `${data}.${encodedSignature}`;
}

/**
 * Verify JWT signature
 *
 * @param {string} token
 * @param {string} secret
 * @returns {Promise<Object>}
 */
async function verifyJWT(token, secret) {
	const parts = token.split('.');
	if (parts.length !== 3) {
		throw new Error('Invalid JWT format');
	}

	const [encodedHeader, encodedPayload, encodedSignature] = parts;
	const data = `${encodedHeader}.${encodedPayload}`;

	// Verify signature
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['verify']
	);

	const signature = base64urlDecode(encodedSignature);
	const valid = await crypto.subtle.verify(
		'HMAC',
		key,
		signature,
		encoder.encode(data)
	);

	if (!valid) {
		throw new Error('Invalid JWT signature');
	}

	// Decode payload
	const payload = JSON.parse(base64urlDecodeString(encodedPayload));

	// Check expiration
	const now = Math.floor(Date.now() / 1000);
	if (payload.exp && payload.exp < now) {
		throw new Error('JWT expired');
	}

	return payload;
}

/**
 * Base64URL encode
 */
function base64urlEncode(data) {
	if (typeof data === 'string') {
		data = new TextEncoder().encode(data);
	} else if (data instanceof ArrayBuffer) {
		data = new Uint8Array(data);
	}

	let base64 = btoa(String.fromCharCode(...data));
	return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Base64URL decode to ArrayBuffer
 */
function base64urlDecode(str) {
	str = str.replace(/-/g, '+').replace(/_/g, '/');
	const pad = str.length % 4;
	if (pad) {
		str += '='.repeat(4 - pad);
	}
	const binary = atob(str);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes.buffer;
}

/**
 * Base64URL decode to string
 */
function base64urlDecodeString(str) {
	const buffer = base64urlDecode(str);
	return new TextDecoder().decode(buffer);
}
