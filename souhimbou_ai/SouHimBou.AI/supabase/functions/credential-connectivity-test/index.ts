/**
 * credential-connectivity-test Edge Function
 *
 * Performs real connectivity probes against target systems using stored credentials.
 * This runs server-side so it can reach internal/private network targets that the
 * browser cannot, and handles credentials without exposing them to the client.
 *
 * Probe types by credential:
 *   api_token / cloud_service_account → HTTP request with Authorization header
 *   username_password                 → HTTP request with Basic auth header
 *   certificate                       → HTTPS GET (validates cert chain via TLS)
 *   ssh_key                           → HTTP/HTTPS reachability probe to host:port
 *                                       (full SSH handshake not available in Deno Deploy)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestRequest {
  credential_id: string;
  test_target: string; // URL or host:port
}

interface TestResult {
  success: boolean;
  probe_type: string;
  target: string;
  status_code?: number;
  latency_ms?: number;
  details: string;
  tested_at: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth: require valid JWT ────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    }

    // User client — respects RLS, validates the requesting user's JWT.
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Parse request ─────────────────────────────────────────────────────────
    const body: TestRequest = await req.json();
    if (!body.credential_id || !body.test_target) {
      return new Response(JSON.stringify({ error: 'credential_id and test_target are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Fetch credential (user must have org membership — enforced by RLS) ───
    const { data: credential, error: credErr } = await userClient
      .from('secure_discovery_credentials')
      .select('id, credential_type, organization_id, is_active, expires_at')
      .eq('id', body.credential_id)
      .eq('is_active', true)
      .single();

    if (credErr || !credential) {
      return new Response(JSON.stringify({ error: 'Credential not found or access denied' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (credential.expires_at && new Date(credential.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Credential has expired' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Decrypt credential (service role bypasses RLS) ────────────────────────
    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: encRow, error: encErr } = await adminClient
      .from('secure_discovery_credentials')
      .select('encrypted_credentials')
      .eq('id', body.credential_id)
      .single();

    if (encErr || !encRow) {
      throw new Error('Failed to retrieve encrypted credential data');
    }

    const { data: decrypted, error: decErr } = await adminClient
      .rpc('decrypt_credential_data', { encrypted_data: encRow.encrypted_credentials });

    if (decErr || !decrypted) {
      throw new Error(`Credential decryption failed: ${decErr?.message}`);
    }

    // ── Perform connectivity probe ────────────────────────────────────────────
    const result = await probeTarget(credential.credential_type, body.test_target, decrypted);

    // ── Write audit entry ─────────────────────────────────────────────────────
    await adminClient.from('discovery_audit_trail').insert({
      organization_id: credential.organization_id,
      event_type: result.success ? 'credential_test_passed' : 'credential_test_failed',
      event_severity: result.success ? 'INFO' : 'WARN',
      event_details: {
        credential_id: body.credential_id,
        test_target: body.test_target,
        probe_type: result.probe_type,
        success: result.success,
        latency_ms: result.latency_ms,
        status_code: result.status_code,
        details: result.details,
      },
      security_context: {
        timestamp: new Date().toISOString(),
        source: 'credential-connectivity-test',
        user_id: user.id,
      },
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[credential-connectivity-test]', err);
    return new Response(JSON.stringify({ error: err.message ?? 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ── Probe implementations ──────────────────────────────────────────────────────

async function probeTarget(
  credentialType: string,
  target: string,
  creds: Record<string, string>,
): Promise<TestResult> {
  const testedAt = new Date().toISOString();

  // Normalise target: ensure it's a URL for fetch-based probes.
  const url = target.startsWith('http://') || target.startsWith('https://')
    ? target
    : `https://${target}`;

  const start = Date.now();

  switch (credentialType) {
    case 'api_token': {
      return await httpProbe(url, {
        Authorization: `Bearer ${creds.token}`,
      }, 'api_token_bearer', testedAt, start);
    }

    case 'cloud_service_account': {
      // Cloud service accounts typically use token-based auth.
      const token = creds.access_token ?? creds.token ?? creds.api_key;
      if (!token) {
        return failResult('cloud_service_account', target, testedAt, 'Missing access_token/token/api_key in credential');
      }
      return await httpProbe(url, {
        Authorization: `Bearer ${token}`,
      }, 'cloud_service_account', testedAt, start);
    }

    case 'username_password': {
      const encoded = btoa(`${creds.username}:${creds.password}`);
      return await httpProbe(url, {
        Authorization: `Basic ${encoded}`,
      }, 'basic_auth_http', testedAt, start);
    }

    case 'certificate': {
      // HTTPS GET — Deno validates the remote TLS cert via the system trust store.
      // This confirms: (1) target is reachable, (2) remote cert is valid/trusted.
      return await httpProbe(url, {}, 'tls_certificate_https', testedAt, start);
    }

    case 'ssh_key': {
      // Deno Deploy does not support raw TCP (Deno.connect is blocked).
      // Probe the HTTP endpoint on the host if it exists, otherwise report limitation.
      try {
        const resp = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(8000) });
        const latency = Date.now() - start;
        return {
          success: true,
          probe_type: 'ssh_host_http_reachability',
          target,
          status_code: resp.status,
          latency_ms: latency,
          details: `Host reachable via HTTP (SSH handshake requires native TCP, not available in cloud runtime). HTTP status: ${resp.status}.`,
          tested_at: testedAt,
        };
      } catch (e) {
        return failResult('ssh_host_http_reachability', target, testedAt,
          `Host unreachable: ${e.message}. SSH handshake requires native TCP not available in cloud runtime.`);
      }
    }

    default:
      return failResult('unknown', target, testedAt, `Unsupported credential type: ${credentialType}`);
  }
}

async function httpProbe(
  url: string,
  headers: Record<string, string>,
  probeType: string,
  testedAt: string,
  startTime: number,
): Promise<TestResult> {
  try {
    const resp = await fetch(url, {
      method: 'HEAD',
      headers,
      signal: AbortSignal.timeout(10000),
    });
    const latency = Date.now() - startTime;

    // 2xx or 3xx → credential accepted / reachable; 4xx → auth failure; 5xx → server error.
    const success = resp.status < 400;
    return {
      success,
      probe_type: probeType,
      target: url,
      status_code: resp.status,
      latency_ms: latency,
      details: success
        ? `Connection successful. HTTP ${resp.status} in ${latency}ms.`
        : `HTTP ${resp.status} — authentication may have failed or endpoint rejected the request.`,
      tested_at: testedAt,
    };
  } catch (e) {
    return failResult(probeType, url, testedAt, `Network error: ${e.message}`);
  }
}

function failResult(probeType: string, target: string, testedAt: string, details: string): TestResult {
  return {
    success: false,
    probe_type: probeType,
    target,
    latency_ms: undefined,
    details,
    tested_at: testedAt,
  };
}
