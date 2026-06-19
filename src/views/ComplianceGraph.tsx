'use client';

import dynamic from 'next/dynamic';

// DAGAuditViewer uses 3d-force-graph (DOM-heavy CDN library) — must be
// client-side only. Dynamic import with ssr:false guarantees no hydration
// mismatch and no SSR crash on the Next.js edge.
const DAGAuditViewer = dynamic(
  () => import('@/components/compliance/DAGAuditViewer').then(m => m.DAGAuditViewer),
  {
    ssr: false,
    loading: () => (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#050c16',
        fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#3d5a78',
        letterSpacing: 1,
      }}>
        ⟳ Initialising KHEPRA · DAG · Flight Recorder…
      </div>
    ),
  },
);

export default function ComplianceGraph() {
  return <DAGAuditViewer pollIntervalMs={30_000} />;
}
