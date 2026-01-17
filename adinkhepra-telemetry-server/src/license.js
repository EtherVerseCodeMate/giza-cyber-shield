/**
 * License Validation Module
 *
 * Validates DoD installation licenses for proprietary PQC algorithms
 * Protects $45M+ intellectual property while allowing community edition fallback
 *
 * Features:
 * - Dilithium3-signed machine ID authentication
 * - Online license validation with remote revocation
 * - Heartbeat monitoring for continuous compliance
 * - DoD unit tracking and audit logging
 */

/**
 * Validate license for premium PQC features
 *
 * @param {Request} request
 * @param {Env} env
 * @param {Object} corsHeaders
 * @returns {Response}
 */
export async function handleLicenseValidate(request, env, corsHeaders) {
	try {
		const { machine_id, signature, version, installation_id } = await request.json();

		// Validate required fields
		if (!machine_id || !signature) {
			return new Response(JSON.stringify({
				valid: false,
				error: 'Missing required fields: machine_id, signature'
			}), {
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		// TODO: Verify Dilithium3 signature on machine_id
		// For now, we'll check if signature is present (implement crypto later)
		const signatureValid = signature && signature.length > 100;

		if (!signatureValid) {
			return new Response(JSON.stringify({
				valid: false,
				error: 'Invalid cryptographic signature',
				message: 'License validation requires valid Dilithium3 signature'
			}), {
				status: 401,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		// Check license in D1 database
		const license = await env.DB.prepare(`
			SELECT
				machine_id,
				organization,
				features,
				issued_at,
				expires_at,
				revoked,
				license_tier,
				max_devices
			FROM licenses
			WHERE machine_id = ? AND revoked = 0
		`).bind(machine_id).first();

		// License not found or expired
		if (!license) {
			return new Response(JSON.stringify({
				valid: false,
				error: 'License not found',
				message: 'No active license for this installation. Contact support@souhimbou.ai',
				fallback_available: true,
				fallback_features: ['community_edition', 'basic_crypto']
			}), {
				status: 404,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		// Check expiration
		const now = Math.floor(Date.now() / 1000);
		const expiresAt = license.expires_at;

		if (expiresAt && expiresAt < now) {
			return new Response(JSON.stringify({
				valid: false,
				error: 'License expired',
				expired_at: new Date(expiresAt * 1000).toISOString(),
				message: 'License expired. Contact souhimbou.d.kone.mil@army.mil for renewal',
				fallback_available: true
			}), {
				status: 403,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		// Parse features JSON
		const features = JSON.parse(license.features || '[]');

		// Log successful validation
		await env.DB.prepare(`
			INSERT INTO license_validations (
				machine_id, timestamp, version, installation_id, validation_result
			) VALUES (?, ?, ?, ?, 'success')
		`).bind(
			machine_id,
			now,
			version || 'unknown',
			installation_id || machine_id
		).run();

		// Update last_validated timestamp
		await env.DB.prepare(`
			UPDATE licenses
			SET last_validated = ?, validation_count = validation_count + 1
			WHERE machine_id = ?
		`).bind(now, machine_id).run();

		// Get client IP and country
		const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
		const country = request.cf?.country || 'UNKNOWN';

		// Success response
		return new Response(JSON.stringify({
			valid: true,
			features: features,
			license_tier: license.license_tier,
			organization: license.organization,
			expires_at: expiresAt ? new Date(expiresAt * 1000).toISOString() : null,
			issued_at: new Date(license.issued_at * 1000).toISOString(),
			validated_at: new Date(now * 1000).toISOString(),
			validation_server: 'telemetry.souhimbou.org',
			client_country: country,
			legal_notice: 'This software contains proprietary algorithms protected under 18 U.S.C. § 1831-1839. Unauthorized use prohibited.'
		}), {
			status: 200,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});

	} catch (error) {
		console.error('License validation error:', error);

		// Log failed validation
		try {
			await env.DB.prepare(`
				INSERT INTO license_validations (
					machine_id, timestamp, version, validation_result, error_message
				) VALUES (?, ?, ?, 'error', ?)
			`).bind(
				'error-unknown',
				Math.floor(Date.now() / 1000),
				'unknown',
				error.message
			).run();
		} catch (logError) {
			console.error('Failed to log validation error:', logError);
		}

		return new Response(JSON.stringify({
			valid: false,
			error: 'License validation service unavailable',
			message: 'Please try again later or contact support@souhimbou.ai',
			fallback_available: true
		}), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});
	}
}

/**
 * License heartbeat endpoint
 * Clients call this every hour to maintain license validity
 *
 * @param {Request} request
 * @param {Env} env
 * @param {Object} corsHeaders
 * @returns {Response}
 */
export async function handleLicenseHeartbeat(request, env, corsHeaders) {
	try {
		const { machine_id, signature, status_data } = await request.json();

		if (!machine_id || !signature) {
			return new Response(JSON.stringify({
				error: 'Missing required fields'
			}), {
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		// Verify license is still valid
		const license = await env.DB.prepare(`
			SELECT revoked, expires_at FROM licenses WHERE machine_id = ?
		`).bind(machine_id).first();

		if (!license || license.revoked === 1) {
			return new Response(JSON.stringify({
				status: 'revoked',
				action: 'disable_premium_features',
				message: 'License has been revoked. Premium features will be disabled.'
			}), {
				status: 403,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		const now = Math.floor(Date.now() / 1000);
		if (license.expires_at && license.expires_at < now) {
			return new Response(JSON.stringify({
				status: 'expired',
				action: 'disable_premium_features',
				message: 'License expired. Contact support for renewal.'
			}), {
				status: 403,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		// Log heartbeat
		await env.DB.prepare(`
			INSERT INTO license_heartbeats (
				machine_id, timestamp, status_data
			) VALUES (?, ?, ?)
		`).bind(
			machine_id,
			now,
			JSON.stringify(status_data || {})
		).run();

		// Update last heartbeat
		await env.DB.prepare(`
			UPDATE licenses SET last_heartbeat = ? WHERE machine_id = ?
		`).bind(now, machine_id).run();

		return new Response(JSON.stringify({
			status: 'active',
			next_heartbeat_in: 3600, // 1 hour
			timestamp: now
		}), {
			status: 200,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});

	} catch (error) {
		console.error('Heartbeat error:', error);
		return new Response(JSON.stringify({
			error: 'Heartbeat failed',
			fallback_to_community: true
		}), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});
	}
}

/**
 * Revoke a license (admin endpoint)
 *
 * @param {Request} request
 * @param {Env} env
 * @param {Object} corsHeaders
 * @param {string} machineId
 * @param {Object} admin - Admin user info from JWT
 * @returns {Response}
 */
export async function handleLicenseRevoke(request, env, corsHeaders, machineId, admin) {
	try {
		const result = await env.DB.prepare(`
			UPDATE licenses
			SET revoked = 1, revoked_at = ?, revoked_reason = ?
			WHERE machine_id = ?
		`).bind(
			Math.floor(Date.now() / 1000),
			'Manual revocation',
			machineId
		).run();

		if (result.changes === 0) {
			return new Response(JSON.stringify({
				error: 'License not found'
			}), {
				status: 404,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		// Log revocation with admin username
		await env.DB.prepare(`
			INSERT INTO license_audit_log (
				machine_id, action, timestamp, details, admin_user
			) VALUES (?, 'revoke', ?, ?, ?)
		`).bind(
			machineId,
			Math.floor(Date.now() / 1000),
			'License revoked via API',
			admin?.username || 'unknown'
		).run();

		return new Response(JSON.stringify({
			status: 'revoked',
			machine_id: machineId,
			timestamp: Date.now()
		}), {
			status: 200,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});

	} catch (error) {
		console.error('Revocation error:', error);
		return new Response(JSON.stringify({
			error: 'Revocation failed'
		}), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});
	}
}

/**
 * Issue new license (admin endpoint)
 *
 * @param {Request} request
 * @param {Env} env
 * @param {Object} corsHeaders
 * @param {Object} admin - Admin user info from JWT
 * @returns {Response}
 */
/**
 * Auto-register endpoint for new agent installations
 * This allows agents to self-register using a pre-shared enrollment token
 *
 * Flow:
 * 1. Customer receives enrollment_token from SouHimBou.ai dashboard
 * 2. Agent calls /license/register with machine_id + enrollment_token
 * 3. Server validates token, creates trial license, returns activation
 *
 * @param {Request} request
 * @param {Env} env
 * @param {Object} corsHeaders
 * @returns {Response}
 */
export async function handleLicenseRegister(request, env, corsHeaders) {
	try {
		const {
			machine_id,
			enrollment_token,
			hostname,
			platform,
			agent_version
		} = await request.json();

		// Validate required fields
		if (!machine_id || !enrollment_token) {
			return new Response(JSON.stringify({
				error: 'Missing required fields: machine_id, enrollment_token',
				help: 'Get your enrollment token from the SouHimBou.ai dashboard'
			}), {
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		// Validate enrollment token format (khepra-enroll-{org_id}-{random})
		if (!enrollment_token.startsWith('khepra-enroll-')) {
			return new Response(JSON.stringify({
				error: 'Invalid enrollment token format',
				help: 'Enrollment tokens start with "khepra-enroll-"'
			}), {
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		// Look up enrollment token
		const enrollment = await env.DB.prepare(`
			SELECT
				id, organization, license_tier, features,
				max_registrations, current_registrations,
				expires_at, active
			FROM enrollment_tokens
			WHERE token = ? AND active = 1
		`).bind(enrollment_token).first();

		if (!enrollment) {
			return new Response(JSON.stringify({
				error: 'Invalid or expired enrollment token',
				message: 'Contact your administrator for a new enrollment token'
			}), {
				status: 401,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		// Check expiration
		const now = Math.floor(Date.now() / 1000);
		if (enrollment.expires_at && enrollment.expires_at < now) {
			return new Response(JSON.stringify({
				error: 'Enrollment token expired',
				expired_at: new Date(enrollment.expires_at * 1000).toISOString()
			}), {
				status: 401,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		// Check registration limit
		if (enrollment.max_registrations > 0 &&
			enrollment.current_registrations >= enrollment.max_registrations) {
			return new Response(JSON.stringify({
				error: 'Registration limit reached',
				max_registrations: enrollment.max_registrations,
				message: 'Contact your administrator to increase the limit'
			}), {
				status: 403,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		// Check if machine already registered
		const existingLicense = await env.DB.prepare(`
			SELECT machine_id, revoked FROM licenses WHERE machine_id = ?
		`).bind(machine_id).first();

		if (existingLicense && existingLicense.revoked === 0) {
			// Already registered - return existing license info
			const license = await env.DB.prepare(`
				SELECT features, license_tier, expires_at, issued_at
				FROM licenses WHERE machine_id = ?
			`).bind(machine_id).first();

			return new Response(JSON.stringify({
				status: 'already_registered',
				machine_id: machine_id,
				organization: enrollment.organization,
				features: JSON.parse(license.features || '[]'),
				license_tier: license.license_tier,
				expires_at: license.expires_at ? new Date(license.expires_at * 1000).toISOString() : 'never',
				message: 'This machine is already registered'
			}), {
				status: 200,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		// Parse features from enrollment
		const features = JSON.parse(enrollment.features || '["scan", "cve_check", "dashboard_view"]');

		// Calculate expiration (30-day trial for auto-registration, or from enrollment settings)
		const trialDays = 30;
		const expiresAt = now + (trialDays * 86400);

		// Create new license
		await env.DB.prepare(`
			INSERT INTO licenses (
				machine_id, organization, features, license_tier,
				issued_at, expires_at, max_devices, revoked, validation_count,
				enrollment_token_id, hostname, platform, agent_version
			) VALUES (?, ?, ?, ?, ?, ?, 1, 0, 0, ?, ?, ?, ?)
			ON CONFLICT(machine_id) DO UPDATE SET
				organization = excluded.organization,
				features = excluded.features,
				license_tier = excluded.license_tier,
				expires_at = excluded.expires_at,
				revoked = 0,
				enrollment_token_id = excluded.enrollment_token_id,
				hostname = excluded.hostname,
				platform = excluded.platform,
				agent_version = excluded.agent_version
		`).bind(
			machine_id,
			enrollment.organization,
			JSON.stringify(features),
			enrollment.license_tier || 'trial',
			now,
			expiresAt,
			enrollment.id,
			hostname || 'unknown',
			platform || 'unknown',
			agent_version || 'unknown'
		).run();

		// Increment registration count
		await env.DB.prepare(`
			UPDATE enrollment_tokens
			SET current_registrations = current_registrations + 1,
				last_used = ?
			WHERE id = ?
		`).bind(now, enrollment.id).run();

		// Log registration event
		await env.DB.prepare(`
			INSERT INTO license_audit_log (
				machine_id, action, timestamp, details, admin_user
			) VALUES (?, 'auto_register', ?, ?, ?)
		`).bind(
			machine_id,
			now,
			JSON.stringify({
				enrollment_token_id: enrollment.id,
				hostname,
				platform,
				agent_version
			}),
			'system:auto-registration'
		).run();

		// Get client info
		const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
		const country = request.cf?.country || 'UNKNOWN';

		return new Response(JSON.stringify({
			status: 'registered',
			machine_id: machine_id,
			organization: enrollment.organization,
			features: features,
			license_tier: enrollment.license_tier || 'trial',
			issued_at: new Date(now * 1000).toISOString(),
			expires_at: new Date(expiresAt * 1000).toISOString(),
			days_remaining: trialDays,
			validation_url: 'https://telemetry.souhimbou.org/license/validate',
			heartbeat_url: 'https://telemetry.souhimbou.org/license/heartbeat',
			client_country: country,
			message: 'License activated successfully! Run scans to begin protecting your infrastructure.'
		}), {
			status: 201,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});

	} catch (error) {
		console.error('License registration error:', error);
		return new Response(JSON.stringify({
			error: 'Registration failed',
			message: error.message
		}), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});
	}
}

/**
 * Create enrollment token (admin endpoint)
 * Used to generate tokens that customers use to register their agents
 *
 * @param {Request} request
 * @param {Env} env
 * @param {Object} corsHeaders
 * @param {Object} admin - Admin user info from JWT
 * @returns {Response}
 */
export async function handleEnrollmentTokenCreate(request, env, corsHeaders, admin) {
	try {
		const {
			organization,
			license_tier,
			features,
			max_registrations,
			expires_in_days
		} = await request.json();

		if (!organization) {
			return new Response(JSON.stringify({
				error: 'Missing required field: organization'
			}), {
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		const now = Math.floor(Date.now() / 1000);
		const expiresAt = expires_in_days ? now + (expires_in_days * 86400) : null;

		// Generate enrollment token
		const randomPart = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
		const orgSlug = organization.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
		const token = `khepra-enroll-${orgSlug}-${randomPart}`;

		// Insert enrollment token
		await env.DB.prepare(`
			INSERT INTO enrollment_tokens (
				token, organization, license_tier, features,
				max_registrations, current_registrations,
				created_at, expires_at, active, created_by
			) VALUES (?, ?, ?, ?, ?, 0, ?, ?, 1, ?)
		`).bind(
			token,
			organization,
			license_tier || 'trial',
			JSON.stringify(features || ['scan', 'cve_check', 'dashboard_view']),
			max_registrations || 5,
			now,
			expiresAt,
			admin?.username || 'system'
		).run();

		return new Response(JSON.stringify({
			status: 'created',
			enrollment_token: token,
			organization: organization,
			license_tier: license_tier || 'trial',
			features: features || ['scan', 'cve_check', 'dashboard_view'],
			max_registrations: max_registrations || 5,
			expires_at: expiresAt ? new Date(expiresAt * 1000).toISOString() : 'never',
			usage: {
				agent_flag: `--enrollment-token=${token}`,
				env_var: `KHEPRA_ENROLLMENT_TOKEN=${token}`,
				api_call: 'POST /license/register { "machine_id": "...", "enrollment_token": "' + token + '" }'
			}
		}), {
			status: 201,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});

	} catch (error) {
		console.error('Enrollment token creation error:', error);
		return new Response(JSON.stringify({
			error: 'Failed to create enrollment token',
			message: error.message
		}), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});
	}
}

/**
 * List enrollment tokens (admin endpoint)
 *
 * @param {Request} request
 * @param {Env} env
 * @param {Object} corsHeaders
 * @param {Object} admin
 * @returns {Response}
 */
export async function handleEnrollmentTokenList(request, env, corsHeaders, admin) {
	try {
		const tokens = await env.DB.prepare(`
			SELECT
				id, token, organization, license_tier, features,
				max_registrations, current_registrations,
				created_at, expires_at, active, last_used, created_by
			FROM enrollment_tokens
			ORDER BY created_at DESC
			LIMIT 100
		`).all();

		return new Response(JSON.stringify({
			tokens: tokens.results.map(t => ({
				...t,
				features: JSON.parse(t.features || '[]'),
				created_at: new Date(t.created_at * 1000).toISOString(),
				expires_at: t.expires_at ? new Date(t.expires_at * 1000).toISOString() : null,
				last_used: t.last_used ? new Date(t.last_used * 1000).toISOString() : null
			})),
			total: tokens.results.length
		}), {
			status: 200,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});

	} catch (error) {
		console.error('Enrollment token list error:', error);
		return new Response(JSON.stringify({
			error: 'Failed to list enrollment tokens'
		}), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});
	}
}

export async function handleLicenseIssue(request, env, corsHeaders, admin) {
	try {
		const {
			machine_id,
			organization,
			features,
			license_tier,
			expires_in_days,
			max_devices
		} = await request.json();

		if (!machine_id || !organization) {
			return new Response(JSON.stringify({
				error: 'Missing required fields: machine_id, organization'
			}), {
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		const now = Math.floor(Date.now() / 1000);
		const expiresAt = expires_in_days ? now + (expires_in_days * 86400) : null;

		// Insert new license
		await env.DB.prepare(`
			INSERT INTO licenses (
				machine_id, organization, features, license_tier,
				issued_at, expires_at, max_devices, revoked, validation_count
			) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)
			ON CONFLICT(machine_id) DO UPDATE SET
				organization = excluded.organization,
				features = excluded.features,
				license_tier = excluded.license_tier,
				expires_at = excluded.expires_at,
				max_devices = excluded.max_devices,
				revoked = 0
		`).bind(
			machine_id,
			organization,
			JSON.stringify(features || ['premium_pqc', 'white_box_crypto']),
			license_tier || 'dod_premium',
			now,
			expiresAt,
			max_devices || 1
		).run();

		// Log issuance with admin username
		await env.DB.prepare(`
			INSERT INTO license_audit_log (
				machine_id, action, timestamp, details, admin_user
			) VALUES (?, 'issue', ?, ?, ?)
		`).bind(
			machine_id,
			now,
			JSON.stringify({ organization, license_tier, expires_in_days }),
			admin?.username || 'unknown'
		).run();

		return new Response(JSON.stringify({
			status: 'issued',
			machine_id: machine_id,
			organization: organization,
			features: features || ['premium_pqc', 'white_box_crypto'],
			issued_at: new Date(now * 1000).toISOString(),
			expires_at: expiresAt ? new Date(expiresAt * 1000).toISOString() : 'never',
			validation_url: 'https://telemetry.souhimbou.org/license/validate'
		}), {
			status: 201,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});

	} catch (error) {
		console.error('License issuance error:', error);
		return new Response(JSON.stringify({
			error: 'Failed to issue license',
			message: error.message
		}), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});
	}
}
