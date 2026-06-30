import { NextResponse } from 'next/server';

// Was the retired khepra-daemon port (45444). adinkhepra serve is the
// current local API process — see cmd/adinkhepra/serve.go. Fixed 2026-06-30.
const AGENT = process.env.AGENT_URL ?? 'http://localhost:8443';

export async function GET() {
  try {
    const res = await fetch(`${AGENT}/api/scada/live`, {
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(3000),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { connected: false, error: String(err) },
      { status: 503 }
    );
  }
}
