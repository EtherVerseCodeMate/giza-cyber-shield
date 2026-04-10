import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/scan
 * Server-side proxy for the ASAF onboarding scan trigger.
 *
 * Why proxy? The ASAF API server (DEMARC) runs on the same VPS as this
 * Next.js dashboard container. By proxying through a Next.js API route:
 *   1. No CORS — the browser calls the same origin (adinkhepra.com)
 *   2. No external dependency — no Cloudflare Tunnel needed for scans
 *   3. The internal API URL is never exposed to the client
 *
 * Required env vars (server-side only, NOT NEXT_PUBLIC_):
 *   ASAF_INTERNAL_API_URL — e.g. http://172.17.0.1:45444 (Docker host gateway)
 */
const INTERNAL_API = process.env.ASAF_INTERNAL_API_URL || 'http://172.17.0.1:45444';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const res = await fetch(`${INTERNAL_API}/api/v1/onboarding/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

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
