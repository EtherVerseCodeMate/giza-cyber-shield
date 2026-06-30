import { NextRequest, NextResponse } from 'next/server';

// Was the retired khepra-daemon port (45444). adinkhepra serve is the
// current local API process — see cmd/adinkhepra/serve.go. Fixed 2026-06-30.
const AGENT = process.env.AGENT_URL ?? 'http://localhost:8443';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch(`${AGENT}/api/scada/coil`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(4000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 503 });
  }
}
