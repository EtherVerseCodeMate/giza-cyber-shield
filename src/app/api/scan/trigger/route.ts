import { NextRequest, NextResponse } from 'next/server';

// Server-side only — never exposed to the browser.
// ASAF_API_URL defaults to localhost:45444 (VPS-local Go API server).
const ASAF_API = process.env.ASAF_API_URL || 'http://localhost:45444';

/**
 * POST /api/scan/trigger
 * Proxies to the ASAF Go API server (server-side).
 * Eliminates CORS and hides the internal API endpoint from the browser.
 *
 * Required env var (server-side only, no NEXT_PUBLIC_ prefix):
 *   ASAF_API_URL — http://localhost:45444 (same-host on VPS)
 *   ASAF_API_KEY — optional bearer token if API auth is enabled
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  // Always use scan_type=eval so ASAF_ALLOW_EVAL_WITHOUT_LICENSE=true permits it
  const payload = {
    scan_type: 'eval',
    metadata: { source: 'onboarding', product: 'asaf' },
    ...body,
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const apiKey = process.env.ASAF_API_KEY;
  if (apiKey) headers['Authorization'] = apiKey;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  let res: Response;
  try {
    res = await fetch(`${ASAF_API}/api/v1/scans/trigger`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (e: unknown) {
    const isTimeout = e instanceof Error && e.name === 'AbortError';
    const msg = isTimeout
      ? `API server did not respond within 10 seconds. Check that the asaf-api service is running on the VPS (port 45444).`
      : `Cannot reach ASAF API at ${ASAF_API}. Check that the asaf-api service is running.`;
    return NextResponse.json({ error: 'api_unreachable', message: msg }, { status: 503 });
  } finally {
    clearTimeout(timeout);
  }

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
