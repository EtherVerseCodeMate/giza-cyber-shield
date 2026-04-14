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

import { verifyLicenseHMAC, generateAPIKey } from './hmac-auth.js';

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

		if (!machine_id || !signature) {
			return new Response(JSON.stringify({
				valid: false,
				error: 'Missing required fields: machine_id, signature'
			}), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
		}

		// Verify Dilithium3 Signature
		const signatureValid = await verifySignature(env, machine_id, signature);

		if (!signatureValid) {
			return new Response(JSON.stringify({
				valid: false,
				error: 'Invalid cryptographic signature',
				message: 'License validation requires valid Dilithium3 signature'
			}), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
		}

		// Check license in D1 database
		const license = await getLicenseFromDB(env, machine_id);

		if (!license) {
			return new Response(JSON.stringify({
				valid: false,
				error: 'License not found',
				message: 'No active license for this installation. Contact support@souhimbou.ai',
				fallback_available: true,
				fallback_features: ['community_edition', 'basic_crypto']
			}), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
		}

		// Check expiration
		const now = Math.floor(Date.now() / 1000);
		if (license.expires_at && license.expires_at < now) {
			return new Response(JSON.stringify({
				valid: false,
				error: 'License expired',
				expired_at: new Date(license.expires_at * 1000).toISOString(),
				message: 'License expired. Contact souhimbou.d.kone.mil@army.mil for renewal',
				fallback_available: true
			}), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
		}

		// Log successful validation
		await logValidationResult(env, machine_id, 'success', { version, installation_id });

		// Success response
		return new Response(JSON.stringify({
			valid: true,
			features: JSON.parse(license.features || '[]'),
			license_tier: license.license_tier,
			organization: license.organization,
			expires_at: license.expires_at ? new Date(license.expires_at * 1000).toISOString() : null,
			issued_at: new Date(license.issued_at * 1000).toISOString(),
			validated_at: new Date(now * 1000).toISOString(),
			limits: {
				max_devices: license.max_devices,
				max_concurrent_scans: license.max_concurrent_scans,
				retention_days: license.retention_days,
				ai_credits_monthly: license.ai_credits_monthly
			},
			validation_server: 'telemetry.souhimbou.org',
			client_country: request.cf?.country || 'UNKNOWN',
			legal_notice: 'This software contains proprietary algorithms protected under 18 U.S.C. § 1831-1839. Unauthorized use prohibited.'
		}), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

	} catch (error) {
		console.error('License validation error:', error);
		await logValidationResult(env, 'error-unknown', 'error', { error_message: error.message, version: 'unknown' });

		return new Response(JSON.stringify({
			valid: false,
			error: 'License validation service unavailable',
			message: 'Please try again later or contact support@souhimbou.ai',
			fallback_available: true
		}), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
	}
}

/**
 * License heartbeat endpoint
 * Clients call this every hour to maintain license validity
 * NOW REQUIRES HMAC AUTHENTICATION to prevent fake heartbeats
 *
 * @param {Request} request
 * @param {Env} env
 * @param {Object} corsHeaders
 * @returns {Response}
 */
export async function handleLicenseHeartbeat(request, env, corsHeaders) {
	try {
		const body = await request.text();

		// Verify HMAC signature
		const authResult = await verifyLicenseHMAC(request, body, env);
		if (!authResult.valid) {
			console.error('Heartbeat authentication failed:', authResult.error);
			return new Response(JSON.stringify({
				error: 'Authentication required',
				message: 'Heartbeats require HMAC authentication',
				help: 'Include X-Khepra-Signature and X-Khepra-Timestamp headers. See documentation for details.'
			}), {
				status: 401,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		const { machine_id, status_data } = JSON.parse(body);

		if (!machine_id) {
			return new Response(JSON.stringify({
				error: 'Missing machine_id'
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
 * NOW REQUIRES HMAC AUTHENTICATION using enrollment token as shared secret
 *
 * Flow:
 * 1. Customer receives enrollment_token from SouHimBou.ai dashboard
 * 2. Agent generates HMAC using enrollment_token
 * 3. Agent calls /license/register with machine_id + enrollment_token + HMAC headers
 * 4. Server validates HMAC and token, creates trial license, returns activation + API key
 *
 * @param {Request} request
 * @param {Env} env
 * @param {Object} corsHeaders
 * @returns {Response}
 */
export async function handleLicenseRegister(request, env, corsHeaders) {
	try {
		const body = await request.text();

		// Verify HMAC signature
		const authResult = await verifyLicenseHMAC(request, body, env);
		if (!authResult.valid) {
			console.error('Registration authentication failed:', authResult.error);
			return new Response(JSON.stringify({
				error: 'Authentication required',
				hmac_error: authResult.error,
				message: 'Registration requires HMAC authentication',
				help: 'Include X-Khepra-Signature (HMAC using enrollment token) and X-Khepra-Timestamp headers.'
			}), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
		}

		const { machine_id, enrollment_token, hostname, platform, agent_version } = JSON.parse(body);

		// Validate required fields
		if (!machine_id || !enrollment_token) {
			return new Response(JSON.stringify({
				error: 'Missing required fields: machine_id, enrollment_token',
				help: 'Get your enrollment token from the SouHimBou.ai dashboard'
			}), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
		}

		if (!enrollment_token.startsWith('khepra-enroll-')) {
			return new Response(JSON.stringify({
				error: 'Invalid enrollment token format',
				help: 'Enrollment tokens start with "khepra-enroll-"'
			}), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
		}

		// Look up enrollment token
		const enrollment = await getEnrollmentToken(env, enrollment_token);

		if (!enrollment) {
			return new Response(JSON.stringify({
				error: 'Invalid or expired enrollment token',
				message: 'Contact your administrator for a new enrollment token'
			}), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
		}

		const now = Math.floor(Date.now() / 1000);
		if (enrollment.expires_at && enrollment.expires_at < now) {
			return new Response(JSON.stringify({
				error: 'Enrollment token expired',
				expired_at: new Date(enrollment.expires_at * 1000).toISOString()
			}), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
		}

		if (enrollment.max_registrations > 0 && enrollment.current_registrations >= enrollment.max_registrations) {
			return new Response(JSON.stringify({
				error: 'Registration limit reached',
				max_registrations: enrollment.max_registrations,
				message: 'Contact your administrator to increase the limit'
			}), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
		}

		// Check if machine already registered
		const existingLicense = await checkExistingLicense(env, machine_id);

		if (existingLicense?.revoked === 0) {
			return new Response(JSON.stringify({
				status: 'already_registered',
				machine_id: machine_id,
				organization: enrollment.organization,
				features: JSON.parse(existingLicense.features || '[]'),
				license_tier: existingLicense.license_tier,
				expires_at: existingLicense.expires_at ? new Date(existingLicense.expires_at * 1000).toISOString() : 'never',
				message: 'This machine is already registered'
			}), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
		}

		const features = JSON.parse(enrollment.features || '["scan", "cve_check", "dashboard_view"]');
		const trialDays = 30;
		const expiresAt = now + (trialDays * 86400);

		// Generate API key — raw key stored in DB for HMAC verification
		const { apiKey } = await generateAPIKey();

		// Create new license
		await env.DB.prepare(`
			INSERT INTO licenses (
				machine_id, organization, features, license_tier,
				issued_at, expires_at, max_devices, revoked, validation_count,
				enrollment_token_id, hostname, platform, agent_version,
				max_concurrent_scans, retention_days, ai_credits_monthly, api_key
			) VALUES (?, ?, ?, ?, ?, ?, 1, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(machine_id) DO UPDATE SET
				organization = excluded.organization,
				features = excluded.features,
				license_tier = excluded.license_tier,
				expires_at = excluded.expires_at,
				revoked = 0,
				enrollment_token_id = excluded.enrollment_token_id,
				hostname = excluded.hostname,
				platform = excluded.platform,
				agent_version = excluded.agent_version,
				api_key = excluded.api_key
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
			agent_version || 'unknown',
			getTierLimit(enrollment.license_tier, 'max_devices'),
			getTierLimit(enrollment.license_tier, 'max_concurrent_scans'),
			getTierLimit(enrollment.license_tier, 'retention_days'),
			apiKey
		).run();

		// Increment registration count
		await incrementEnrollmentUsage(env, enrollment.id);

		// Log registration event
		await env.DB.prepare(`
			INSERT INTO license_audit_log (
				machine_id, action, timestamp, details, admin_user
			) VALUES (?, 'auto_register', ?, ?, ?)
		`).bind(
			machine_id,
			now,
			JSON.stringify({ enrollment_token_id: enrollment.id, hostname, platform, agent_version }),
			'system:auto-registration'
		).run();

		return new Response(JSON.stringify({
			status: 'registered',
			machine_id: machine_id,
			organization: enrollment.organization,
			features: features,
			license_tier: enrollment.license_tier || 'trial',
			issued_at: new Date(now * 1000).toISOString(),
			expires_at: new Date(expiresAt * 1000).toISOString(),
			days_remaining: trialDays,
			api_key: apiKey,
			validation_url: 'https://telemetry.souhimbou.org/license/validate',
			heartbeat_url: 'https://telemetry.souhimbou.org/license/heartbeat',
			client_country: request.cf?.country || 'UNKNOWN',
			message: 'License activated successfully! Run scans to begin protecting your infrastructure.'
		}), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

	} catch (error) {
		console.error('License registration error:', error);
		return new Response(JSON.stringify({
			error: 'Registration failed',
			message: error.message
		}), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
		const randomPart = crypto.randomUUID().replaceAll('-', '').slice(0, 16);
		const orgSlug = organization.toLowerCase().replaceAll(/[^a-z0-9]/g, '').slice(0, 12);
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

/**
 * ============================================================================
 * AUTOMATED LICENSING - PHASE 1: STRIPE WEBHOOK
 * ============================================================================
 * Receives Stripe payment events and queues license for local signing
 *
 * Flow:
 * 1. Stripe sends webhook → we verify signature
 * 2. Create pending license request in DB
 * 3. Local signer polls /api/licenses/pending
 * 4. Local signer signs with ML-DSA-65 private key
 * 5. Local signer submits to /api/licenses/complete
 */
export async function handleStripeWebhook(request, env, corsHeaders) {
	try {
		const signature = request.headers.get('stripe-signature');
		const rawBody = await request.text();

		// Verify Stripe webhook signature
		if (!signature || !env.STRIPE_WEBHOOK_SECRET) {
			console.error('Missing Stripe signature or webhook secret');
			return new Response(JSON.stringify({
				error: 'Missing webhook signature'
			}), {
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		// Parse the webhook signature
		const signatureParts = signature.split(',').reduce((acc, part) => {
			const [key, value] = part.split('=');
			acc[key] = value;
			return acc;
		}, {});

		const timestamp = signatureParts['t'];
		const expectedSig = signatureParts['v1'];

		// Verify timestamp (prevent replay attacks - 5 min window)
		const now = Math.floor(Date.now() / 1000);
		if (Math.abs(now - Number.parseInt(timestamp)) > 300) {
			return new Response(JSON.stringify({
				error: 'Webhook timestamp expired'
			}), {
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		// Constant-time Stripe signature verification.
		// crypto.subtle.verify() prevents timing oracles that `===` string comparison cannot.
		// Stripe signs: HMAC-SHA256("t=<ts>.<rawBody>", STRIPE_WEBHOOK_SECRET)
		const signedPayload = `${timestamp}.${rawBody}`;
		const encoder = new TextEncoder();
		const key = await crypto.subtle.importKey(
			'raw',
			encoder.encode(env.STRIPE_WEBHOOK_SECRET),
			{ name: 'HMAC', hash: 'SHA-256' },
			false,
			['verify']
		);
		// Decode Stripe's expected hex signature to bytes for crypto.subtle.verify()
		const expectedSigBytes = new Uint8Array(
			expectedSig.match(/.{2}/g).map(b => Number.parseInt(b, 16))
		);
		const sigValid = await crypto.subtle.verify(
			'HMAC',
			key,
			expectedSigBytes,
			encoder.encode(signedPayload)
		);

		if (!sigValid) {
			console.error('Invalid Stripe webhook signature');
			return new Response(JSON.stringify({
				error: 'Invalid signature'
			}), {
				status: 401,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		// Parse event
		const event = JSON.parse(rawBody);
		console.log(`Stripe webhook: ${event.type}`);

		// Handle checkout.session.completed (successful payment)
		if (event.type === 'checkout.session.completed') {
			const session = event.data.object;

			// Extract customer and product info
			const customerEmail = session.customer_email || session.customer_details?.email;
			const customerId = session.customer;
			const metadata = session.metadata || {};

			// Determine license tier from metadata or line items
			const licenseTier = metadata.license_tier || 'enterprise';
			const organization = metadata.organization || customerEmail?.split('@')[1] || 'Unknown';
			const machineId = metadata.machine_id || `stripe-${session.id}`;

			// Calculate features and limits based on tier
			const tierConfig = getLicenseTierConfig(licenseTier);

			// Create pending license request (awaiting local signing)
			const requestId = `req-${crypto.randomUUID().slice(0, 8)}`;
			const requestedAt = Math.floor(Date.now() / 1000);

			await env.DB.prepare(`
				INSERT INTO license_requests (
					request_id, machine_id, organization, customer_email,
					stripe_session_id, stripe_customer_id,
					license_tier, features, limits,
					requested_at, status, source
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'stripe')
			`).bind(
				requestId,
				machineId,
				organization,
				customerEmail,
				session.id,
				customerId,
				licenseTier,
				JSON.stringify(tierConfig.features),
				JSON.stringify(tierConfig.limits),
				requestedAt
			).run();

			// Log the event
			await env.DB.prepare(`
				INSERT INTO license_audit_log (
					machine_id, action, timestamp, details, admin_user
				) VALUES (?, 'stripe_payment', ?, ?, ?)
			`).bind(
				machineId,
				requestedAt,
				JSON.stringify({
					request_id: requestId,
					stripe_session_id: session.id,
					amount: session.amount_total,
					currency: session.currency,
					customer_email: customerEmail
				}),
				'system:stripe-webhook'
			).run();

			return new Response(JSON.stringify({
				received: true,
				request_id: requestId,
				message: 'License request queued for signing'
			}), {
				status: 200,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		// Handle subscription events
		if (event.type === 'customer.subscription.created' ||
			event.type === 'customer.subscription.updated') {
			const subscription = event.data.object;
			// Subscription updates not yet implemented
			console.log(`Subscription event: ${event.type}`, subscription.id);
		}

		// Handle subscription cancellation
		if (event.type === 'customer.subscription.deleted') {
			const subscription = event.data.object;
			const customerId = subscription.customer;

			// Mark associated licenses for revocation
			await env.DB.prepare(`
				UPDATE licenses
				SET revoked = 1, revoked_at = ?, revoked_reason = 'Subscription cancelled'
				WHERE stripe_customer_id = ? AND revoked = 0
			`).bind(Math.floor(Date.now() / 1000), customerId).run();

			console.log(`Subscription cancelled for customer: ${customerId}`);
		}

		return new Response(JSON.stringify({ received: true }), {
			status: 200,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});

	} catch (error) {
		console.error('Stripe webhook error:', error);
		return new Response(JSON.stringify({
			error: 'Webhook processing failed',
			message: error.message
		}), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});
	}
}

/**
 * ============================================================================
 * AUTOMATED LICENSING - PHASE 2: PILOT SIGNUP
 * ============================================================================
 * Auto-generates 30-day trial license for pilot program signups
 */
export async function handlePilotSignup(request, env, corsHeaders) {
	try {
		const {
			email,
			organization,
			name,
			use_case,
			machine_id,
			referral_source
		} = await request.json();

		// Validate required fields
		if (!email || !organization) {
			return new Response(JSON.stringify({
				error: 'Missing required fields: email, organization'
			}), {
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		// Validate email format
		if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
			return new Response(JSON.stringify({
				error: 'Invalid email format'
			}), {
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		const now = Math.floor(Date.now() / 1000);

		// Check if email already has an active pilot
		const existingPilot = await env.DB.prepare(`
			SELECT id, status FROM pilot_signups
			WHERE email = ? AND status IN ('active', 'pending')
		`).bind(email).first();

		if (existingPilot) {
			return new Response(JSON.stringify({
				error: 'Pilot already exists',
				status: existingPilot.status,
				message: 'A pilot license is already associated with this email'
			}), {
				status: 409,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		// Generate enrollment token for this pilot
		const randomPart = crypto.randomUUID().replaceAll('-', '').slice(0, 16);
		const orgSlug = organization.toLowerCase().replaceAll(/[^a-z0-9]/g, '').slice(0, 12);
		const enrollmentToken = `khepra-pilot-${orgSlug}-${randomPart}`;

		// 30-day trial configuration
		const trialDays = 30;
		const expiresAt = now + (trialDays * 86400);
		const pilotFeatures = ['scan', 'cve_check', 'dashboard_view', 'risk_scoring', 'pilot_support'];

		// Create pilot signup record
		const pilotId = `pilot-${crypto.randomUUID().slice(0, 8)}`;
		await env.DB.prepare(`
			INSERT INTO pilot_signups (
				pilot_id, email, organization, contact_name,
				use_case, referral_source, enrollment_token,
				created_at, expires_at, status
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
		`).bind(
			pilotId,
			email,
			organization,
			name || '',
			use_case || '',
			referral_source || 'direct',
			enrollmentToken,
			now,
			expiresAt
		).run();

		// Create enrollment token entry
		await env.DB.prepare(`
			INSERT INTO enrollment_tokens (
				token, organization, license_tier, features,
				max_registrations, current_registrations,
				created_at, expires_at, active, created_by
			) VALUES (?, ?, 'pilot', ?, 5, 0, ?, ?, 1, ?)
		`).bind(
			enrollmentToken,
			organization,
			JSON.stringify(pilotFeatures),
			now,
			expiresAt,
			'system:pilot-signup'
		).run();

		// If machine_id provided, create license request immediately
		let licenseRequestId = null;
		if (machine_id) {
			licenseRequestId = `req-${crypto.randomUUID().slice(0, 8)}`;
			const tierConfig = getLicenseTierConfig('pilot');

			await env.DB.prepare(`
				INSERT INTO license_requests (
					request_id, machine_id, organization, customer_email,
					license_tier, features, limits,
					requested_at, status, source, pilot_id
				) VALUES (?, ?, ?, ?, 'pilot', ?, ?, ?, 'pending', 'pilot_signup', ?)
			`).bind(
				licenseRequestId,
				machine_id,
				organization,
				email,
				JSON.stringify(tierConfig.features),
				JSON.stringify(tierConfig.limits),
				now,
				pilotId
			).run();
		}

		// Log signup
		await env.DB.prepare(`
			INSERT INTO license_audit_log (
				machine_id, action, timestamp, details, admin_user
			) VALUES (?, 'pilot_signup', ?, ?, ?)
		`).bind(
			machine_id || pilotId,
			now,
			JSON.stringify({
				pilot_id: pilotId,
				email,
				organization,
				enrollment_token: enrollmentToken,
				license_request_id: licenseRequestId
			}),
			'system:pilot-signup'
		).run();

		// Get client info
		const country = request.cf?.country || 'UNKNOWN';

		return new Response(JSON.stringify({
			status: 'pilot_created',
			pilot_id: pilotId,
			enrollment_token: enrollmentToken,
			organization: organization,
			trial_days: trialDays,
			expires_at: new Date(expiresAt * 1000).toISOString(),
			features: pilotFeatures,
			license_request_id: licenseRequestId,
			next_steps: {
				install: 'Download KHEPRA agent from https://souhimbou.org/download',
				register: `Use enrollment token: ${enrollmentToken}`,
				api_call: `POST /license/register { "machine_id": "...", "enrollment_token": "${enrollmentToken}" }`
			},
			client_country: country,
			message: 'Welcome to the KHEPRA pilot program! Your 30-day trial starts now.'
		}), {
			status: 201,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});

	} catch (error) {
		console.error('Pilot signup error:', error);
		return new Response(JSON.stringify({
			error: 'Pilot signup failed',
			message: error.message
		}), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});
	}
}

/**
 * ============================================================================
 * LICENSE QUEUE ENDPOINTS - FOR LOCAL SIGNER
 * ============================================================================
 * These endpoints allow your local ML-DSA-65 signer to:
 * 1. Poll for pending license requests
 * 2. Submit signed licenses back
 */

/**
 * Get pending license requests awaiting signing
 * Called by local signer via Cloudflare Tunnel
 */
export async function handleLicensesPending(request, env, corsHeaders, admin) {
	try {
		const url = new URL(request.url);
		const limit = Number.parseInt(url.searchParams.get('limit') || '10');
		const source = url.searchParams.get('source'); // Optional: filter by source

		// Parameterized query — source filter uses a bound parameter to prevent SQL injection.
		const query = source
			? `SELECT request_id, machine_id, organization, customer_email,
				stripe_session_id, stripe_customer_id, pilot_id,
				license_tier, features, limits, requested_at, source
			FROM license_requests
			WHERE status = 'pending' AND source = ?
			ORDER BY requested_at ASC LIMIT ?`
			: `SELECT request_id, machine_id, organization, customer_email,
				stripe_session_id, stripe_customer_id, pilot_id,
				license_tier, features, limits, requested_at, source
			FROM license_requests
			WHERE status = 'pending'
			ORDER BY requested_at ASC LIMIT ?`;

		const pending = source
			? await env.DB.prepare(query).bind(source, limit).all()
			: await env.DB.prepare(query).bind(limit).all();

		return new Response(JSON.stringify({
			pending: pending.results.map(req => ({
				...req,
				features: JSON.parse(req.features || '[]'),
				limits: JSON.parse(req.limits || '{}'),
				requested_at: new Date(req.requested_at * 1000).toISOString()
			})),
			count: pending.results.length
		}), {
			status: 200,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});

	} catch (error) {
		console.error('Get pending licenses error:', error);
		return new Response(JSON.stringify({
			error: 'Failed to fetch pending licenses'
		}), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});
	}
}

/**
 * Complete a license request with signed license
 * Called by local signer after ML-DSA-65 signing
 */
export async function handleLicenseComplete(request, env, corsHeaders, admin) {
	try {
		const {
			request_id,
			machine_id,
			signature,        // ML-DSA-65 signature (hex)
			license_blob,     // Full signed license blob
			expires_in_days   // Override expiration if needed
		} = await request.json();

		if (!request_id || !machine_id || !signature) {
			return new Response(JSON.stringify({
				error: 'Missing required fields: request_id, machine_id, signature'
			}), {
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		// Fetch the pending request
		const pendingReq = await env.DB.prepare(`
			SELECT * FROM license_requests
			WHERE request_id = ? AND status = 'pending'
		`).bind(request_id).first();

		if (!pendingReq) {
			return new Response(JSON.stringify({
				error: 'License request not found or already processed'
			}), {
				status: 404,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		const now = Math.floor(Date.now() / 1000);
		const features = JSON.parse(pendingReq.features || '[]');
		const limits = JSON.parse(pendingReq.limits || '{}');

		// Calculate expiration
		let expiresAt = null;
		if (expires_in_days) {
			expiresAt = now + (expires_in_days * 86400);
		} else if (pendingReq.license_tier === 'pilot') {
			expiresAt = now + (30 * 86400); // 30 days for pilots
		} else if (pendingReq.license_tier === 'enterprise') {
			expiresAt = now + (365 * 86400); // 1 year for enterprise
		}

		// Create the active license
		await env.DB.prepare(`
			INSERT INTO licenses (
				machine_id, organization, features, license_tier,
				issued_at, expires_at, max_devices, revoked, validation_count,
				max_concurrent_scans, retention_days, ai_credits_monthly,
				stripe_customer_id, pilot_id, signature, license_blob
			) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(machine_id) DO UPDATE SET
				organization = excluded.organization,
				features = excluded.features,
				license_tier = excluded.license_tier,
				expires_at = excluded.expires_at,
				revoked = 0,
				signature = excluded.signature,
				license_blob = excluded.license_blob
		`).bind(
			machine_id,
			pendingReq.organization,
			JSON.stringify(features),
			pendingReq.license_tier,
			now,
			expiresAt,
			limits.max_devices || 1,
			limits.max_concurrent_scans || 5,
			limits.retention_days || 1,
			limits.ai_credits_monthly || 50,
			pendingReq.stripe_customer_id,
			pendingReq.pilot_id,
			signature,
			license_blob
		).run();

		// Mark request as completed
		await env.DB.prepare(`
			UPDATE license_requests
			SET status = 'completed', completed_at = ?, signature = ?
			WHERE request_id = ?
		`).bind(now, signature, request_id).run();

		// Update pilot status if applicable
		if (pendingReq.pilot_id) {
			await env.DB.prepare(`
				UPDATE pilot_signups
				SET status = 'active', activated_at = ?
				WHERE pilot_id = ?
			`).bind(now, pendingReq.pilot_id).run();
		}

		// Log completion
		await env.DB.prepare(`
			INSERT INTO license_audit_log (
				machine_id, action, timestamp, details, admin_user
			) VALUES (?, 'license_signed', ?, ?, ?)
		`).bind(
			machine_id,
			now,
			JSON.stringify({
				request_id,
				license_tier: pendingReq.license_tier,
				source: pendingReq.source,
				expires_at: expiresAt
			}),
			admin?.username || 'local-signer'
		).run();

		return new Response(JSON.stringify({
			status: 'completed',
			machine_id: machine_id,
			organization: pendingReq.organization,
			license_tier: pendingReq.license_tier,
			features: features,
			issued_at: new Date(now * 1000).toISOString(),
			expires_at: expiresAt ? new Date(expiresAt * 1000).toISOString() : 'never',
			validation_url: 'https://telemetry.souhimbou.org/license/validate'
		}), {
			status: 201,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});

	} catch (error) {
		console.error('License completion error:', error);
		return new Response(JSON.stringify({
			error: 'License completion failed',
			message: error.message
		}), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});
	}
}

/**
 * Helper: Get license tier configuration
 */
function getLicenseTierConfig(tier) {
	const configs = {
		pilot: {
			features: ['scan', 'cve_check', 'dashboard_view', 'risk_scoring', 'pilot_support'],
			limits: {
				max_devices: 5,
				max_concurrent_scans: 5,
				retention_days: 7,
				ai_credits_monthly: 100
			}
		},
		pro: {
			features: ['scan', 'cve_check', 'dashboard_view', 'risk_scoring', 'api_access', 'priority_support'],
			limits: {
				max_devices: 25,
				max_concurrent_scans: 20,
				retention_days: 30,
				ai_credits_monthly: 500
			}
		},
		enterprise: {
			features: ['scan', 'cve_check', 'dashboard_view', 'risk_scoring', 'api_access',
				'premium_pqc', 'white_box_crypto', 'stig_automation', 'sso_integration',
				'enterprise_support', 'custom_compliance'],
			limits: {
				max_devices: 500,
				max_concurrent_scans: 100,
				retention_days: 365,
				ai_credits_monthly: 5000
			}
		},
		government: {
			features: ['scan', 'cve_check', 'dashboard_view', 'risk_scoring', 'api_access',
				'premium_pqc', 'white_box_crypto', 'stig_automation', 'sso_integration',
				'fedramp_compliance', 'il4_il5_support', 'air_gap_mode', 'dod_premium'],
			limits: {
				max_devices: -1, // Unlimited
				max_concurrent_scans: -1,
				retention_days: 2555, // 7 years (DoD retention requirement)
				ai_credits_monthly: -1
			}
		}
	};

	return configs[tier] || configs.pilot;
}

export async function handleLicenseIssue(request, env, corsHeaders, admin) {
	try {
		const {
			machine_id,
			organization,
			features,
			license_tier,
			expires_in_days,
			max_devices,
			max_concurrent_scans,
			retention_days,
			ai_credits_monthly
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
				issued_at, expires_at, max_devices, revoked, validation_count,
				max_concurrent_scans, retention_days, ai_credits_monthly
			) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)
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
			max_devices || 1,
			max_concurrent_scans || 5,
			retention_days || 1,
			ai_credits_monthly || 50
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

/**
 * Helper: Get tier limit
 */
function getTierLimit(tier, limitType) {
	const limits = {
		business: { max_devices: 50, max_concurrent_scans: 30, retention_days: 500 },
		pro: { max_devices: 20, max_concurrent_scans: 7, retention_days: 150 },
		default: { max_devices: 5, max_concurrent_scans: 1, retention_days: 50 }
	};
	const selected = limits[tier] || limits.default;
	return selected[limitType];
}

/**
 * Helper: Get license from DB
 */
async function getLicenseFromDB(env, machine_id) {
	return await env.DB.prepare(`
		SELECT
			machine_id,
			organization,
			features,
			issued_at,
			expires_at,
			revoked,
			license_tier,
			max_devices,
			max_concurrent_scans,
			retention_days,
			ai_credits_monthly
		FROM licenses
		WHERE machine_id = ? AND revoked = 0
	`).bind(machine_id).first();
}

/**
 * Helper: Log validation result
 */
async function logValidationResult(env, machine_id, result, details = {}) {
	try {
		const now = Math.floor(Date.now() / 1000);
		if (result === 'success') {
			await env.DB.prepare(`
				INSERT INTO license_validations (
					machine_id, timestamp, version, installation_id, validation_result
				) VALUES (?, ?, ?, ?, 'success')
			`).bind(
				machine_id,
				now,
				details.version || 'unknown',
				details.installation_id || machine_id
			).run();

			// Update license stats
			await env.DB.prepare(`
				UPDATE licenses
				SET last_validated = ?, validation_count = validation_count + 1
				WHERE machine_id = ?
			`).bind(now, machine_id).run();
		} else {
			await env.DB.prepare(`
				INSERT INTO license_validations (
					machine_id, timestamp, version, validation_result, error_message
				) VALUES (?, ?, ?, 'error', ?)
			`).bind(
				machine_id || 'error-unknown',
				now,
				details.version || 'unknown',
				details.error_message || 'Unknown error'
			).run();
		}
	} catch (logError) {
		console.error('Failed to log validation result:', logError);
	}
}

/**
 * Helper: Verify Dilithium3 signature
 */
async function verifySignature(env, machine_id, signature) {
	if (!signature || !env.TELEMETRY_PUBLIC_KEY) return false;

	try {
		const { ml_dsa65 } = await import("@noble/post-quantum/ml-dsa");
		if (env.TELEMETRY_PUBLIC_KEY.length === 2624) {
			const pubKeyBytes = new Uint8Array(env.TELEMETRY_PUBLIC_KEY.match(/.{1,2}/g).map(byte => Number.parseInt(byte, 16)));
			const sigBytes = new Uint8Array(signature.match(/.{1,2}/g).map(byte => Number.parseInt(byte, 16)));
			const msgBytes = new TextEncoder().encode(machine_id);
			return ml_dsa65.verify(sigBytes, msgBytes, pubKeyBytes);
		}
	} catch (e) {
		console.error('Signature verification error:', e);
	}
	return false;
}

/**
 * Helper: Get enrollment token
 */
async function getEnrollmentToken(env, token) {
	return await env.DB.prepare(`
		SELECT
			id, organization, license_tier, features,
			max_registrations, current_registrations,
			expires_at, active
		FROM enrollment_tokens
		WHERE token = ? AND active = 1
	`).bind(token).first();
}

/**
 * Helper: Check existing license
 */
async function checkExistingLicense(env, machine_id) {
	return await env.DB.prepare(`
		SELECT machine_id, revoked, features, license_tier, expires_at, issued_at
		FROM licenses WHERE machine_id = ?
	`).bind(machine_id).first();
}

/**
 * Helper: Increment enrollment usage
 */
async function incrementEnrollmentUsage(env, enrollment_id) {
	const now = Math.floor(Date.now() / 1000);
	await env.DB.prepare(`
		UPDATE enrollment_tokens
		SET current_registrations = current_registrations + 1,
			last_used = ?
		WHERE id = ?
	`).bind(now, enrollment_id).run();
}
