/**
 * Telemetry Forwarding Module
 *
 * Aggregates telemetry data and forwards to:
 * 1. DEMARC Secure API Gateway
 * 2. Supabase (via DEMARC)
 *
 * Data Flow:
 * CLIENT → CloudFlare Workers → DEMARC → Supabase → Master Operator Console
 */

/**
 * Generate HMAC-SHA256 service token for DEMARC authentication
 * Token format: khepra-svc-{service_name}-{timestamp_hex}-{hmac_signature}
 *
 * @param {string} serviceName - Service identifier (e.g., 'cloudflare-telemetry')
 * @param {string} secret - KHEPRA_SERVICE_SECRET hex string
 * @returns {Promise<string>} Generated service token
 */
async function generateServiceToken(serviceName, secret) {
	// Current timestamp as 8-byte big-endian hex
	const timestamp = Math.floor(Date.now() / 1000);
	const timestampHex = timestamp.toString(16).padStart(16, '0');

	// Message to sign
	const message = `khepra-svc-${serviceName}-${timestampHex}`;

	// Import the secret key for HMAC
	const secretBytes = hexToBytes(secret);
	const key = await crypto.subtle.importKey(
		'raw',
		secretBytes,
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);

	// Compute HMAC-SHA256
	const encoder = new TextEncoder();
	const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
	const signatureHex = bytesToHex(new Uint8Array(signature));

	return `${message}-${signatureHex}`;
}

/**
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex) {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < hex.length; i += 2) {
		bytes[i / 2] = Number.parseInt(hex.substr(i, 2), 16);
	}
	return bytes;
}

/**
 * Convert Uint8Array to hex string
 */
function bytesToHex(bytes) {
	return Array.from(bytes)
		.map(b => b.toString(16).padStart(2, '0'))
		.join('');
}

// Forward telemetry to DEMARC gateway
export async function forwardToDemarc(env, aggregatedData) {
	const demarcUrl = env.DEMARC_GATEWAY_URL || 'https://gateway.souhimbou.org';
	const serviceSecret = env.KHEPRA_SERVICE_SECRET;

	if (!serviceSecret) {
		console.error('KHEPRA_SERVICE_SECRET not configured');
		return { success: false, error: 'Missing service secret' };
	}

	try {
		// Generate fresh token for each request (anti-replay protection)
		const serviceToken = await generateServiceToken('cloudflare-telemetry', serviceSecret);

		const response = await fetch(`${demarcUrl}/api/v1/telemetry/ingest`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${serviceToken}`,
				'X-Service-Name': 'cloudflare-telemetry',
				'X-Request-ID': crypto.randomUUID()
			},
			body: JSON.stringify(aggregatedData)
		});

		if (!response.ok) {
			const error = await response.text();
			console.error('DEMARC forward failed:', response.status, error);
			return { success: false, error: `HTTP ${response.status}` };
		}

		return { success: true };
	} catch (error) {
		console.error('DEMARC forward error:', error);
		return { success: false, error: error.message };
	}
}

// Forward directly to Supabase (if DEMARC is bypassed)
export async function forwardToSupabase(env, data) {
	const supabaseUrl = env.SUPABASE_URL;
	const supabaseKey = env.SUPABASE_SERVICE_KEY;

	if (!supabaseUrl || !supabaseKey) {
		console.error('Supabase credentials not configured');
		return { success: false, error: 'Missing Supabase config' };
	}

	try {
		const response = await fetch(`${supabaseUrl}/rest/v1/${data.table}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'apikey': supabaseKey,
				'Authorization': `Bearer ${supabaseKey}`,
				'Prefer': 'return=minimal'
			},
			body: JSON.stringify(data.records)
		});

		if (!response.ok) {
			const error = await response.text();
			console.error('Supabase insert failed:', response.status, error);
			return { success: false, error: `HTTP ${response.status}` };
		}

		return { success: true };
	} catch (error) {
		console.error('Supabase error:', error);
		return { success: false, error: error.message };
	}
}

/**
 * Aggregate daily telemetry for Dark Crypto Moat
 * Called by scheduled cron trigger
 */
export async function aggregateCryptoInventory(env) {
	const now = Math.floor(Date.now() / 1000);
	const oneDayAgo = now - 86400;

	try {
		// Aggregate crypto counts from beacons in last 24 hours
		const results = await env.DB.prepare(`
			SELECT
				device_hash,
				country,
				MAX(rsa_2048_count) as rsa_2048_count,
				MAX(rsa_3072_count) as rsa_3072_count,
				MAX(rsa_4096_count) as rsa_4096_count,
				MAX(ecc_p256_count) as ecc_p256_count,
				MAX(ecc_p384_count) as ecc_p384_count,
				MAX(dilithium3_count) as dilithium3_count,
				MAX(kyber1024_count) as kyber1024_count,
				MAX(tls_config) as tls_config,
				MAX(timestamp) as last_scan_at
			FROM beacons
			WHERE timestamp > ?
			GROUP BY device_hash
		`).bind(oneDayAgo).all();

		if (results.results.length === 0) {
			console.log('No beacons to aggregate');
			return { success: true, count: 0 };
		}

		// Calculate scores and prepare for forwarding
		const aggregated = results.results.map(row => {
			const classicalCount = (row.rsa_2048_count || 0) + (row.rsa_3072_count || 0) +
				(row.rsa_4096_count || 0) + (row.ecc_p256_count || 0) + (row.ecc_p384_count || 0);

			const pqcCount = (row.dilithium3_count || 0) + (row.kyber1024_count || 0);

			const totalKeys = classicalCount + pqcCount;
			const pqcReadinessScore = totalKeys > 0 ? (pqcCount / totalKeys) * 100 : 0;

			// Higher score = more vulnerable (inverse of PQC readiness)
			const quantumExposureScore = 100 - pqcReadinessScore;

			return {
				device_hash: row.device_hash,
				country: row.country,
				rsa_2048_count: row.rsa_2048_count || 0,
				rsa_3072_count: row.rsa_3072_count || 0,
				rsa_4096_count: row.rsa_4096_count || 0,
				ecc_p256_count: row.ecc_p256_count || 0,
				ecc_p384_count: row.ecc_p384_count || 0,
				dilithium3_count: row.dilithium3_count || 0,
				kyber1024_count: row.kyber1024_count || 0,
				tls_config: row.tls_config ? JSON.parse(row.tls_config) : {},
				pqc_readiness_score: Math.round(pqcReadinessScore * 100) / 100,
				quantum_exposure_score: Math.round(quantumExposureScore * 100) / 100,
				last_scan_at: new Date(row.last_scan_at * 1000).toISOString()
			};
		});

		// Forward to DEMARC
		const forwardResult = await forwardToDemarc(env, {
			type: 'crypto_inventory',
			timestamp: new Date().toISOString(),
			source: 'cloudflare-telemetry',
			records: aggregated
		});

		if (!forwardResult.success) {
			console.warn('DEMARC forward failed, trying direct Supabase');

			// Fallback: direct to Supabase
			await forwardToSupabase(env, {
				table: 'crypto_inventory',
				records: aggregated
			});
		}

		// Update local stats
		await env.DB.prepare(`
			INSERT INTO daily_stats (date, total_devices, avg_pqc_readiness, total_beacons)
			VALUES (?, ?, ?, ?)
			ON CONFLICT(date) DO UPDATE SET
				total_devices = excluded.total_devices,
				avg_pqc_readiness = excluded.avg_pqc_readiness,
				total_beacons = excluded.total_beacons
		`).bind(
			new Date().toISOString().split('T')[0],
			aggregated.length,
			aggregated.reduce((sum, r) => sum + r.pqc_readiness_score, 0) / aggregated.length,
			results.results.length
		).run();

		console.log(`Aggregated ${aggregated.length} devices, forwarded to DEMARC`);
		return { success: true, count: aggregated.length };

	} catch (error) {
		console.error('Crypto inventory aggregation error:', error);
		return { success: false, error: error.message };
	}
}

/**
 * Aggregate license telemetry
 */
export async function aggregateLicenseTelemetry(env) {
	try {
		const licenses = await env.DB.prepare(`
			SELECT
				l.machine_id,
				l.organization,
				l.license_tier,
				l.features,
				l.issued_at,
				l.expires_at,
				l.validation_count,
				l.last_validated,
				l.last_heartbeat,
				l.revoked,
				l.stripe_customer_id,
				l.pilot_id
			FROM licenses l
			WHERE l.revoked = 0
		`).all();

		if (licenses.results.length === 0) {
			return { success: true, count: 0 };
		}

		const now = Math.floor(Date.now() / 1000);

		const telemetry = licenses.results.map(lic => {
			// Determine compliance status
			let complianceStatus = 'active';
			if (lic.revoked) {
				complianceStatus = 'revoked';
			} else if (lic.expires_at && lic.expires_at < now) {
				complianceStatus = 'violation';
			} else if (lic.last_heartbeat && (now - lic.last_heartbeat) > 7200) {
				// No heartbeat in 2 hours
				complianceStatus = 'warning';
			}

			return {
				machine_id: lic.machine_id,
				organization: lic.organization,
				license_tier: lic.license_tier,
				features: JSON.parse(lic.features || '[]'),
				issued_at: new Date(lic.issued_at * 1000).toISOString(),
				expires_at: lic.expires_at ? new Date(lic.expires_at * 1000).toISOString() : null,
				validation_count: lic.validation_count,
				last_heartbeat_at: lic.last_heartbeat ? new Date(lic.last_heartbeat * 1000).toISOString() : null,
				last_validation_at: lic.last_validated ? new Date(lic.last_validated * 1000).toISOString() : null,
				compliance_status: complianceStatus,
				stripe_customer_id: lic.stripe_customer_id,
				pilot_id: lic.pilot_id
			};
		});

		// Forward to DEMARC
		await forwardToDemarc(env, {
			type: 'license_telemetry',
			timestamp: new Date().toISOString(),
			source: 'cloudflare-telemetry',
			records: telemetry
		});

		console.log(`Forwarded ${telemetry.length} license records`);
		return { success: true, count: telemetry.length };

	} catch (error) {
		console.error('License telemetry aggregation error:', error);
		return { success: false, error: error.message };
	}
}

/**
 * Forward security events in real-time
 */
export async function forwardSecurityEvent(env, event) {
	const securityEvent = {
		event_type: event.type,
		severity: event.severity || 'warning',
		source_device_id: event.device_id,
		source_ip: event.ip,
		source_country: event.country,
		title: event.title,
		description: event.description,
		details: event.details || {},
		created_at: new Date().toISOString()
	};

	// Forward immediately (real-time)
	return forwardToDemarc(env, {
		type: 'security_event',
		timestamp: new Date().toISOString(),
		source: 'cloudflare-telemetry',
		records: [securityEvent]
	});
}

/**
 * Scheduled handler for cron triggers
 * wrangler.toml: [triggers] crons = ["0 * * * *"] (hourly)
 */
export async function handleScheduled(event, env, ctx) {
	console.log('Running scheduled aggregation:', event.cron);

	// Run aggregations in parallel
	const [cryptoResult, licenseResult] = await Promise.all([
		aggregateCryptoInventory(env),
		aggregateLicenseTelemetry(env)
	]);

	console.log('Aggregation complete:', {
		crypto: cryptoResult,
		license: licenseResult
	});
}
