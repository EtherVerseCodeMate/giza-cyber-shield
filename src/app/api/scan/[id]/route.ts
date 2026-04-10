import { NextRequest, NextResponse } from 'next/server';

const ASAF_API = process.env.ASAF_API_URL || 'http://localhost:45444';

/**
 * GET /api/scan/:id
 * Polls scan status from the ASAF Go API server (server-side).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  if (!id) {
    return NextResponse.json({ error: 'missing_id' }, { status: 400 });
  }

  const headers: Record<string, string> = {};
  const apiKey = process.env.ASAF_API_KEY;
  if (apiKey) headers['Authorization'] = apiKey;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  let res: Response;
  try {
    res = await fetch(`${ASAF_API}/api/v1/scans/${id}`, {
      headers,
      signal: controller.signal,
    });
  } catch (e: unknown) {
    const isTimeout = e instanceof Error && e.name === 'AbortError';
    const msg = isTimeout
      ? `Poll timed out after 10 seconds. ASAF API may be overloaded.`
      : `Cannot reach ASAF API at ${ASAF_API}. Check that the asaf-api service is running.`;
    return NextResponse.json({ error: 'api_unreachable', message: msg }, { status: 503 });
  } finally {
    clearTimeout(timeout);
  }

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
