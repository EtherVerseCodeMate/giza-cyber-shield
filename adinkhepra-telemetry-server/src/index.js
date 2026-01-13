/**
 * ADINKHEPRA Telemetry Server
 * Cloudflare Worker + D1 Database
 *
 * Receives PQC-signed anonymous telemetry beacons for Dark Crypto Database
 *
 * Features:
 * - Dilithium3 signature verification (anti-spoofing)
 * - Detailed crypto inventory storage (RSA, ECC, PQC keys)
 * - Privacy-first (no PII, country-level geo only)
 * - Rate limiting (100 beacons/device/hour)
 * - Anomaly detection
 * - License validation for proprietary PQC algorithms
 */

import {
	handleLicenseValidate,
	handleLicenseHeartbeat,
	handleLicenseRevoke,
	handleLicenseIssue
} from './license.js';

import {
	handleAdminLogin,
	handleAdminLogout,
	handleChangePassword,
	verifyAdminAuth
} from './admin-auth.js';

import { ml_dsa65 } from "@noble/post-quantum/ml-dsa";

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);

		// CORS headers
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization',
		};

		// Handle CORS preflight
		if (request.method === 'OPTIONS') {
			return new Response(null, {
				status: 204,
				headers: corsHeaders
			});
		}

		// Route handling - Telemetry
		if (url.pathname === '/beacon' && request.method === 'POST') {
			return handleBeacon(request, env, corsHeaders);
		}

		if (url.pathname === '/stats' && request.method === 'GET') {
			return handleStats(request, env, corsHeaders);
		}

		if (url.pathname === '/analytics' && request.method === 'GET') {
			return handleAnalytics(request, env, corsHeaders);
		}

		if (url.pathname === '/health' && request.method === 'GET') {
			return handleHealth(request, env, corsHeaders);
		}

		// Route handling - Admin Authentication
		if (url.pathname === '/admin/login' && request.method === 'POST') {
			return handleAdminLogin(request, env, corsHeaders);
		}

		if (url.pathname === '/admin/logout' && request.method === 'POST') {
			return handleAdminLogout(request, env, corsHeaders);
		}

		if (url.pathname === '/admin/change-password' && request.method === 'POST') {
			return handleChangePassword(request, env, corsHeaders);
		}

		// Route handling - License Management (Public)
		if (url.pathname === '/license/validate' && request.method === 'POST') {
			return handleLicenseValidate(request, env, corsHeaders);
		}

		if (url.pathname === '/license/heartbeat' && request.method === 'POST') {
			return handleLicenseHeartbeat(request, env, corsHeaders);
		}

		// ADMIN ROUTES (Protected with JWT)
		if (url.pathname === '/license/issue' && request.method === 'POST') {
			const admin = await verifyAdminAuth(request, env);
			if (!admin) {
				return new Response(JSON.stringify({ error: 'Unauthorized' }), {
					status: 401,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' }
				});
			}
			return handleLicenseIssue(request, env, corsHeaders, admin);
		}

		// License revocation by machine ID
		const revokeMatch = url.pathname.match(/^\/license\/revoke\/([^\/]+)$/);
		if (revokeMatch && request.method === 'DELETE') {
			const admin = await verifyAdminAuth(request, env);
			if (!admin) {
				return new Response(JSON.stringify({ error: 'Unauthorized' }), {
					status: 401,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' }
				});
			}
			const machineId = revokeMatch[1];
			return handleLicenseRevoke(request, env, corsHeaders, machineId, admin);
		}

		return new Response('Not Found', {
			status: 404,
			headers: corsHeaders
		});
	}
};

// Legacy checkAdminAuth removed - now using JWT authentication via verifyAdminAuth()
// Emergency API key fallback is built into verifyAdminAuth()

/**
 * Handle incoming telemetry beacon
 */
async function handleBeacon(request, env, corsHeaders) {
	try {
		// 1. Read Raw Body (preserves exact bytes for signature verification)
		const rawBody = await request.text();

		// 2. Parse Beacon
		let beacon;
		try {
			beacon = JSON.parse(rawBody);
		} catch (e) {
			return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		// Validate required fields
		if (!beacon.telemetry_version || !beacon.timestamp || !beacon.anonymous_id) {
			return new Response(JSON.stringify({
				error: 'Invalid beacon: missing required fields'
			}), {
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		// Size check
		if (rawBody.length > parseInt(env.MAX_BEACON_SIZE || '10240')) {
			/* ... existing size error ... */
			return new Response(JSON.stringify({ error: 'Beacon too large' }), { status: 413, headers: corsHeaders });
		}

		const beaconId = beacon.beacon_id || `${beacon.anonymous_id}-${beacon.timestamp}`;

		// Rate limiting
		const deviceHash = beacon.anonymous_id || 'unknown';
		if (!(await checkRateLimit(env, deviceHash))) {
			return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: corsHeaders });
		}

		// 3. Verify Dilithium3 Signature (Real Implementation)
		let signatureValid = 0;
		const signatureHex = request.headers.get('X-Khepra-Signature');

		if (signatureHex && env.TELEMETRY_PUBLIC_KEY) {
			try {
				if (env.TELEMETRY_PUBLIC_KEY.length !== 2624) { // ML-DSA-65 PublicKey Size is 1312 bytes -> 2624 hex
					console.error("Configuration Error: Invalid Public Key Length (Expected 2624 for ML-DSA-65)");
				} else {
					const pubKeyBytes = new Uint8Array(env.TELEMETRY_PUBLIC_KEY.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
					const sigBytes = new Uint8Array(signatureHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
					const msgBytes = new TextEncoder().encode(rawBody);

					// Verify using @noble/post-quantum
					if (ml_dsa65.verify(sigBytes, msgBytes, pubKeyBytes)) {
						signatureValid = 1;
					} else {
						console.warn(`[Security] Invalid ML-DSA-65 signature for beacon: ${beaconId}`);
					}
				}
			} catch (e) {
				console.error("Signature verification exception:", e);
			}
		} else {
			console.warn(`[Security] Missing signature header for beacon: ${beaconId}`);
		}


		// Log warning if signature missing
		if (!beacon.signature) {
			console.warn('Beacon received without PQC signature:', beaconId);
		}

		// Anomaly detection
		const anomalies = await detectAnomalies(beacon, beaconId, signatureValid === 1);
		if (anomalies.length > 0) {
			await logAnomalies(env, anomalies);
		}

		// Get country from Cloudflare request object
		const country = request.cf?.country || 'UNKNOWN';

		// Extract crypto inventory (matching Go client structure)
		const cryptoInv = beacon.cryptographic_inventory || {};
		const scanMeta = beacon.scan_metadata || {};

		// Insert beacon into database
		const result = await env.DB.prepare(`
			INSERT INTO beacons (
				beacon_id, timestamp, scanner_version, os, arch,
				scan_duration_ms, total_assets_scanned,
				rsa_2048_keys, rsa_3072_keys, rsa_4096_keys,
				ecc_p256_keys, ecc_p384_keys,
				dilithium3_keys, kyber1024_keys,
				tls_weak_configs, deprecated_ciphers,
				signature_valid, device_id_hash, ip_country
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(beacon_id) DO NOTHING
		`).bind(
			beaconId,
			Math.floor(new Date(beacon.timestamp).getTime() / 1000),
			scanMeta.scanner_version || beacon.scanner_version || 'unknown',
			scanMeta.os || 'unknown',
			scanMeta.arch || 'unknown',
			scanMeta.scan_duration_ms || 0,
			scanMeta.total_assets_scanned || 0,
			cryptoInv.rsa_2048_keys || 0,
			cryptoInv.rsa_3072_keys || 0,
			cryptoInv.rsa_4096_keys || 0,
			cryptoInv.ecc_p256_keys || 0,
			cryptoInv.ecc_p384_keys || 0,
			cryptoInv.dilithium3_keys || 0,
			cryptoInv.kyber1024_keys || 0,
			cryptoInv.tls_weak_configs || 0,
			cryptoInv.deprecated_ciphers || 0,
			signatureValid,
			deviceHash,
			country
		).run();

		// Update daily stats
		const today = new Date().toISOString().split('T')[0];
		await env.DB.prepare(`
			INSERT INTO daily_stats (
				date, total_scans, unique_devices, total_assets,
				total_rsa_2048_keys, total_rsa_3072_keys, total_rsa_4096_keys,
				total_ecc_p256_keys, total_ecc_p384_keys,
				total_dilithium3_keys, total_kyber1024_keys,
				total_tls_weak_configs, total_deprecated_ciphers,
				avg_scan_duration_ms
			) VALUES (?, 1, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(date) DO UPDATE SET
				total_scans = total_scans + 1,
				total_assets = total_assets + excluded.total_assets,
				total_rsa_2048_keys = total_rsa_2048_keys + excluded.total_rsa_2048_keys,
				total_rsa_3072_keys = total_rsa_3072_keys + excluded.total_rsa_3072_keys,
				total_rsa_4096_keys = total_rsa_4096_keys + excluded.total_rsa_4096_keys,
				total_ecc_p256_keys = total_ecc_p256_keys + excluded.total_ecc_p256_keys,
				total_ecc_p384_keys = total_ecc_p384_keys + excluded.total_ecc_p384_keys,
				total_dilithium3_keys = total_dilithium3_keys + excluded.total_dilithium3_keys,
				total_kyber1024_keys = total_kyber1024_keys + excluded.total_kyber1024_keys,
				total_tls_weak_configs = total_tls_weak_configs + excluded.total_tls_weak_configs,
				total_deprecated_ciphers = total_deprecated_ciphers + excluded.total_deprecated_ciphers,
				avg_scan_duration_ms = (avg_scan_duration_ms * total_scans + excluded.avg_scan_duration_ms) / (total_scans + 1),
				updated_at = strftime('%s', 'now')
		`).bind(
			today,
			scanMeta.total_assets_scanned || 0,
			cryptoInv.rsa_2048_keys || 0,
			cryptoInv.rsa_3072_keys || 0,
			cryptoInv.rsa_4096_keys || 0,
			cryptoInv.ecc_p256_keys || 0,
			cryptoInv.ecc_p384_keys || 0,
			cryptoInv.dilithium3_keys || 0,
			cryptoInv.kyber1024_keys || 0,
			cryptoInv.tls_weak_configs || 0,
			cryptoInv.deprecated_ciphers || 0,
			scanMeta.scan_duration_ms || 0
		).run();

		// Update version stats
		const version = scanMeta.scanner_version || beacon.scanner_version || 'unknown';
		await env.DB.prepare(`
			INSERT INTO version_stats (scanner_version, usage_count)
			VALUES (?, 1)
			ON CONFLICT(scanner_version) DO UPDATE SET
				usage_count = usage_count + 1,
				last_seen = strftime('%s', 'now')
		`).bind(version).run();

		// Update country stats
		await env.DB.prepare(`
			INSERT INTO country_stats (
				ip_country, total_scans, unique_devices,
				total_rsa_2048_keys, total_ecc_p256_keys,
				total_dilithium3_keys, total_kyber1024_keys
			) VALUES (?, 1, 1, ?, ?, ?, ?)
			ON CONFLICT(ip_country) DO UPDATE SET
				total_scans = total_scans + 1,
				total_rsa_2048_keys = total_rsa_2048_keys + excluded.total_rsa_2048_keys,
				total_ecc_p256_keys = total_ecc_p256_keys + excluded.total_ecc_p256_keys,
				total_dilithium3_keys = total_dilithium3_keys + excluded.total_dilithium3_keys,
				total_kyber1024_keys = total_kyber1024_keys + excluded.total_kyber1024_keys,
				last_updated = strftime('%s', 'now')
		`).bind(
			country,
			cryptoInv.rsa_2048_keys || 0,
			cryptoInv.ecc_p256_keys || 0,
			cryptoInv.dilithium3_keys || 0,
			cryptoInv.kyber1024_keys || 0
		).run();

		// Success response
		return new Response(JSON.stringify({
			status: 'ok',
			beacon_id: beaconId,
			received_at: Date.now(),
			signature_verified: signatureValid === 1,
			anomalies_detected: anomalies.length
		}), {
			status: 200,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});

	} catch (error) {
		console.error('Beacon processing error:', error);
		return new Response(JSON.stringify({
			error: 'Internal server error',
			message: error.message
		}), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});
	}
}

/**
 * Handle stats request (basic telemetry stats)
 */
async function handleStats(request, env, corsHeaders) {
	try {
		// Get overall stats
		const overall = await env.DB.prepare(`
			SELECT 
				COUNT(*) as total_scans,
				COUNT(DISTINCT device_id_hash) as unique_devices,
				SUM(total_assets_scanned) as total_assets,
				SUM(rsa_2048_keys) as quantum_vulnerable_rsa,
				SUM(ecc_p256_keys) as quantum_vulnerable_ecc,
				SUM(dilithium3_keys) as pqc_signing_keys,
				SUM(kyber1024_keys) as pqc_encryption_keys,
				AVG(scan_duration_ms) as avg_scan_duration_ms
			FROM beacons
			WHERE signature_valid = 1
		`).first();

		// Get recent daily stats
		const daily = await env.DB.prepare(`
			SELECT * FROM daily_stats 
			ORDER BY date DESC 
			LIMIT 30
		`).all();

		// Get version distribution
		const versions = await env.DB.prepare(`
			SELECT scanner_version, usage_count
			FROM version_stats
			ORDER BY usage_count DESC
			LIMIT 10
		`).all();

		return new Response(JSON.stringify({
			overall,
			daily: daily.results,
			versions: versions.results,
			generated_at: Date.now()
		}), {
			status: 200,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});

	} catch (error) {
		console.error('Stats error:', error);
		return new Response(JSON.stringify({
			error: 'Failed to retrieve stats'
		}), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});
	}
}

/**
 * Handle analytics request (Dark Crypto Database insights)
 */
async function handleAnalytics(request, env, corsHeaders) {
	try {
		// Quantum exposure summary
		const quantumExposure = await env.DB.prepare(`
			SELECT * FROM v_quantum_exposure
		`).first();

		// PQC adoption trend (last 30 days)
		const pqcAdoption = await env.DB.prepare(`
			SELECT * FROM v_pqc_adoption
			LIMIT 30
		`).all();

		// High-risk devices
		const highRiskDevices = await env.DB.prepare(`
			SELECT * FROM v_high_risk_devices
			LIMIT 20
		`).all();

		// Geographic distribution
		const geoDistribution = await env.DB.prepare(`
			SELECT 
				ip_country,
				total_scans,
				unique_devices,
				total_rsa_2048_keys,
				total_ecc_p256_keys,
				total_dilithium3_keys,
				total_kyber1024_keys
			FROM country_stats
			ORDER BY total_rsa_2048_keys DESC
			LIMIT 50
		`).all();

		return new Response(JSON.stringify({
			quantum_exposure: quantumExposure,
			pqc_adoption_trend: pqcAdoption.results,
			high_risk_devices: highRiskDevices.results,
			geographic_distribution: geoDistribution.results,
			generated_at: Date.now()
		}), {
			status: 200,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});

	} catch (error) {
		console.error('Analytics error:', error);
		return new Response(JSON.stringify({
			error: 'Failed to retrieve analytics'
		}), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});
	}
}

/**
 * Health check endpoint
 */
async function handleHealth(request, env, corsHeaders) {
	try {
		// Test database connectivity
		await env.DB.prepare('SELECT 1').first();

		return new Response(JSON.stringify({
			status: 'ok',
			timestamp: Date.now(),
			service: 'khepra-telemetry',
			database: 'connected',
			version: '1.0.0'
		}), {
			status: 200,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});
	} catch (error) {
		return new Response(JSON.stringify({
			status: 'degraded',
			error: 'Database unavailable',
			timestamp: Date.now()
		}), {
			status: 503,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});
	}
}

/**
 * Simple rate limiting (100 beacons per device per hour)
 */
async function checkRateLimit(env, deviceHash) {
	const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;

	const count = await env.DB.prepare(`
		SELECT COUNT(*) as count 
		FROM beacons 
		WHERE device_id_hash = ? AND timestamp > ?
	`).bind(deviceHash, oneHourAgo).first();

	return count.count < parseInt(env.RATE_LIMIT_PER_HOUR || '100');
}

/**
 * Anomaly detection
 */
async function detectAnomalies(beacon, beaconId, isSignatureValid) {
	const anomalies = [];
	const cryptoInv = beacon.cryptographic_inventory || {};
	const scanMeta = beacon.scan_metadata || {};

	// High key count anomaly
	const totalKeys =
		(cryptoInv.rsa_2048_keys || 0) +
		(cryptoInv.rsa_3072_keys || 0) +
		(cryptoInv.rsa_4096_keys || 0) +
		(cryptoInv.ecc_p256_keys || 0) +
		(cryptoInv.ecc_p384_keys || 0);

	if (totalKeys > 100000) {
		anomalies.push({
			beacon_id: beaconId,
			anomaly_type: 'HIGH_KEY_COUNT',
			severity: 'medium',
			details: JSON.stringify({
				total_keys: totalKeys,
				threshold: 100000
			})
		});
	}

	// Suspiciously fast scan
	if (scanMeta.scan_duration_ms && scanMeta.scan_duration_ms < 100) {
		anomalies.push({
			beacon_id: beaconId,
			anomaly_type: 'FAST_SCAN',
			severity: 'low',
			details: JSON.stringify({
				scan_duration_ms: scanMeta.scan_duration_ms,
				threshold: 100
			})
		});
	}

	// Invalid or Missing signature
	if (!isSignatureValid) {
		anomalies.push({
			beacon_id: beaconId,
			anomaly_type: 'INVALID_SIGNATURE',
			severity: 'high',
			details: JSON.stringify({
				message: 'Beacon received without valid PQC signature (Header Verification Failed)'
			})
		});
	}

	return anomalies;
}

/**
 * Log anomalies to database
 */
async function logAnomalies(env, anomalies) {
	for (const anomaly of anomalies) {
		await env.DB.prepare(`
			INSERT INTO anomalies (beacon_id, anomaly_type, severity, details)
			VALUES (?, ?, ?, ?)
		`).bind(
			anomaly.beacon_id,
			anomaly.anomaly_type,
			anomaly.severity,
			anomaly.details
		).run();
	}
}
