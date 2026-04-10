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

  let res: Response;
  try {
    res = await fetch(`${ASAF_API}/api/v1/scans/${id}`, { headers });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: 'api_unreachable', message: `ASAF API unreachable: ${msg}` },
      { status: 503 },
    );
  }

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
