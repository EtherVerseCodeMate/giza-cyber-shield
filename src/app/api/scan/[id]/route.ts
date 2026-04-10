import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/scan/[id]
 * Server-side proxy for polling scan status from the ASAF API.
 */
const INTERNAL_API = process.env.ASAF_INTERNAL_API_URL || 'http://172.17.0.1:45444';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const res = await fetch(
      `${INTERNAL_API}/api/v1/onboarding/scan/${params.id}`,
    );

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal proxy error';
    return NextResponse.json(
      { error: 'scan_proxy_error', message },
      { status: 502 },
    );
  }
}
