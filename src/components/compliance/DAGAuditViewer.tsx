'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useDAGGraph } from '@/hooks/useDAGGraph';
import { ViewerNode, ViewerLink, DAGGraphPayload } from '@/services/core/DAGGraphService';

// ── 3d-force-graph CDN loader ─────────────────────────────────────────────────
// We load the library dynamically so it doesn't inflate the Next.js bundle and
// remains compatible with offline/air-gap deployments (swap CDN URL for a local
// path at deploy time).
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ForceGraph3D: any;
  }
}

const FORCE_GRAPH_CDN = 'https://unpkg.com/3d-force-graph@1.73.4/dist/3d-force-graph.min.js';

function loadForceGraphScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window.ForceGraph3D !== 'undefined') {
      resolve();
      return;
    }
    const existing = document.getElementById('fg3d-script');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.id = 'fg3d-script';
    script.src = FORCE_GRAPH_CDN;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load 3d-force-graph'));
    document.head.appendChild(script);
  });
}

// ── Colour map ────────────────────────────────────────────────────────────────

const NODE_COLORS: Record<string, string> = {
  prompt:      '#818cf8',
  tool:        '#e5a54b',
  finding:     '#cc2a36',
  control:     '#22c55e',
  attest:      '#06b6d4',
  staging:     '#f59e0b',  // STAGING_PENDING — amber pulse
  remediated:  '#22c55e',
};

const SEVERITY_COLORS: Record<string, string> = {
  CAT_I:   '#cc2a36',
  CAT_II:  '#f97316',
  CAT_III: '#22c55e',
};

function nodeColor(n: ViewerNode): string {
  if (n.type === 'finding' && n.severity) return SEVERITY_COLORS[n.severity] ?? '#cc2a36';
  return NODE_COLORS[n.type] ?? '#3d5a78';
}

function nodeVal(n: ViewerNode): number {
  if (n.type === 'prompt')                          return 22;
  if (n.type === 'finding' && n.severity === 'CAT_I') return 18;
  if (n.type === 'finding' && n.severity === 'CAT_II') return 13;
  if (n.type === 'tool')                            return n.val ?? 12;
  if (n.type === 'staging')                         return 10;
  if (n.type === 'control')                         return 7;
  if (n.type === 'attest')                          return 5;
  return n.val ?? 6;
}

// ── Node Inspector content ────────────────────────────────────────────────────

function inspectorBadge(n: ViewerNode): string {
  const BADGES: Record<string, string> = {
    prompt:    'b-prompt',
    tool:      'b-tool',
    finding:   'b-finding',
    control:   'b-control',
    attest:    'b-attest',
    staging:   'b-staging',
    remediated:'b-control',
  };
  return BADGES[n.type] ?? 'b-tool';
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface DAGAuditViewerProps {
  /** Override default 30-second poll interval (ms). 0 = no polling. */
  pollIntervalMs?: number;
  /** Override the classification banner label. */
  classificationLabel?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const DAGAuditViewer: React.FC<DAGAuditViewerProps> = ({
  pollIntervalMs = 30_000,
  classificationLabel = 'UNCLASSIFIED // OPEN SOURCE // NATIONAL SECURITY RELEVANT',
}) => {
  const graphContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphInstanceRef = useRef<any>(null);
  const [selectedNode, setSelectedNode] = useState<ViewerNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeTab, setActiveTab] = useState<'3d' | 'table' | 'raw'>('3d');
  const [scriptReady, setScriptReady] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);

  const { data, loading, error: fetchError, refresh, daemonOnline } = useDAGGraph(pollIntervalMs);

  // Load CDN script once.
  useEffect(() => {
    loadForceGraphScript()
      .then(() => setScriptReady(true))
      .catch(() => setScriptError('3d-force-graph library unavailable — check network'));
  }, []);

  // Filter graph data by search query.
  const filteredPayload = useCallback((payload: DAGGraphPayload, q: string): DAGGraphPayload => {
    if (!q.trim()) return payload;
    const lower = q.toLowerCase();
    const matchIDs = new Set(
      payload.nodes
        .filter(n =>
          n.label.toLowerCase().includes(lower) ||
          (n.desc ?? '').toLowerCase().includes(lower) ||
          n.type.toLowerCase().includes(lower) ||
          (n.framework ?? '').toLowerCase().includes(lower) ||
          (n.severity ?? '').toLowerCase().includes(lower),
        )
        .map(n => n.id),
    );
    // Expand to linked neighbours.
    payload.links.forEach(l => {
      const s = typeof l.source === 'object' ? (l.source as ViewerNode).id : l.source;
      const t = typeof l.target === 'object' ? (l.target as ViewerNode).id : l.target;
      if (matchIDs.has(s)) matchIDs.add(t);
      if (matchIDs.has(t)) matchIDs.add(s);
    });
    return {
      meta: payload.meta,
      nodes: payload.nodes.filter(n => matchIDs.has(n.id)),
      links: payload.links.filter(l => {
        const s = typeof l.source === 'object' ? (l.source as ViewerNode).id : l.source;
        const t = typeof l.target === 'object' ? (l.target as ViewerNode).id : l.target;
        return matchIDs.has(s) && matchIDs.has(t);
      }),
    };
  }, []);

  // Build tooltip HTML for a hovered node.
  const tooltipHtml = useCallback((n: ViewerNode): string => {
    const col = nodeColor(n);
    const typeLabel = n.type === 'finding' ? `FINDING · ${n.severity ?? ''}` : n.type.toUpperCase();
    let extra = '';
    if (n.type === 'finding' && n.impact)
      extra = `<br><span style="color:#6b8aaa">impact </span><span style="color:#e5a54b">${n.impact}</span>`;
    if (n.type === 'attest' && n.sig)
      extra = `<br><span style="color:#6b8aaa">sig </span><span style="color:#06b6d4;font-size:9px">${n.sig.slice(0, 18)}…</span>`;
    if (n.type === 'control' || n.type === 'staging' || n.type === 'remediated')
      extra = `<br><span style="color:#6b8aaa">${n.framework ?? 'NIST 800-171'}</span>`;
    if (n.type === 'staging' && n.job_id)
      extra += `<br><span style="color:#f59e0b;font-size:9px">job ${n.job_id.slice(0, 8)}…</span>`;
    return (
      `<div style="border-left:2px solid ${col};padding-left:8px;font-family:'JetBrains Mono',monospace">` +
      `<div style="color:${col};font-weight:700;font-size:12px">${n.label}</div>` +
      `<div style="color:#6b8aaa;font-size:8px;letter-spacing:1px;margin:2px 0">${typeLabel}</div>` +
      `<div style="color:#e0eaf5;font-size:11px">${n.desc ?? ''}</div>` +
      extra +
      `</div>`
    );
  }, []);

  // (Re)build the 3D graph whenever data, search, or tab changes.
  useEffect(() => {
    if (!scriptReady || activeTab !== '3d' || !data || !graphContainerRef.current) return;

    const container = graphContainerRef.current;
    const payload = filteredPayload(data, searchQuery);

    if (!graphInstanceRef.current) {
      graphInstanceRef.current = window.ForceGraph3D(container)
        .backgroundColor('#050c16')
        .nodeId('id')
        .nodeLabel((n: ViewerNode) => tooltipHtml(n))
        .nodeColor((n: ViewerNode) => nodeColor(n))
        .nodeVal((n: ViewerNode) => nodeVal(n))
        .nodeOpacity(0.95)
        .nodeResolution(18)
        .linkColor(() => '#1a4f7a')
        .linkOpacity(0.45)
        .linkWidth((l: ViewerLink) => 0.5 + (l.w ?? 1) * 0.5)
        .linkDirectionalParticles((l: ViewerLink) => ((l.w ?? 1) > 1 ? 3 : 1))
        .linkDirectionalParticleColor(() => '#1a9fe8')
        .linkDirectionalParticleWidth(1.2)
        .linkDirectionalParticleSpeed(0.005)
        .onNodeClick((n: ViewerNode) => {
          setSelectedNode(n);
          const dist = 120;
          const dr = 1 + dist / Math.hypot((n as unknown as { x: number }).x ?? 1, (n as unknown as { y: number }).y ?? 1, (n as unknown as { z: number }).z ?? 1);
          graphInstanceRef.current?.cameraPosition(
            { x: ((n as unknown as { x: number }).x ?? 0) * dr, y: ((n as unknown as { y: number }).y ?? 0) * dr, z: ((n as unknown as { z: number }).z ?? 0) * dr },
            n,
            700,
          );
        })
        .onNodeHover((n: ViewerNode | null) => {
          if (container) container.style.cursor = n ? 'pointer' : 'default';
        });

      graphInstanceRef.current.d3Force('charge')?.strength?.(-100);
      graphInstanceRef.current.d3Force('link')?.distance?.(35);
    }

    // Resize to fill container.
    graphInstanceRef.current
      .width(container.clientWidth)
      .height(container.clientHeight)
      .graphData({ nodes: payload.nodes, links: payload.links });

    const zoomTimer = setTimeout(() => graphInstanceRef.current?.zoomToFit(400, 100), 1200);
    return () => clearTimeout(zoomTimer);
  }, [scriptReady, data, searchQuery, activeTab, filteredPayload, tooltipHtml]);

  // Tab switch — destroy 3D instance when leaving 3D tab.
  const handleTabSwitch = useCallback((tab: '3d' | 'table' | 'raw') => {
    if (tab !== '3d' && graphInstanceRef.current) {
      graphInstanceRef.current._destructor?.();
      graphInstanceRef.current = null;
    }
    setActiveTab(tab);
  }, []);

  // Window resize.
  useEffect(() => {
    const onResize = () => {
      if (graphInstanceRef.current && graphContainerRef.current) {
        graphInstanceRef.current
          .width(graphContainerRef.current.clientWidth)
          .height(graphContainerRef.current.clientHeight);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const meta = data?.meta;
  const payload = data ? filteredPayload(data, searchQuery) : null;

  // ── Inspector Panel Content ─────────────────────────────────────────────────
  const renderInspector = () => {
    if (!selectedNode) {
      return (
        <div style={{ color: '#4d6a88', fontSize: 11, lineHeight: 1.8, fontFamily: 'JetBrains Mono, monospace', marginTop: 16 }}>
          <span style={{ color: '#06b6d4' }}>drag · scroll · click a node</span>
          <br /><br />
          Node types:<br />
          <span style={{ color: '#818cf8' }}>●</span> Prompt — AI request origin<br />
          <span style={{ color: '#e5a54b' }}>●</span> Tool — MCP tool execution<br />
          <span style={{ color: '#cc2a36' }}>●</span> Finding — STIG / PQC violation<br />
          <span style={{ color: '#22c55e' }}>●</span> Control — CMMC satisfied<br />
          <span style={{ color: '#f59e0b' }}>●</span> Staging — pending approval<br />
          <span style={{ color: '#06b6d4' }}>●</span> Attestation — ML-DSA-65 sig
          <br /><br />
          <span style={{ color: '#e5a54b' }}>Click any node to inspect its<br />
          impact, attestation, and<br />linked compliance controls.</span>
        </div>
      );
    }
    const col = nodeColor(selectedNode);
    const linkedLinks = (data?.links ?? []).filter(l => {
      const s = typeof l.source === 'object' ? (l.source as ViewerNode).id : l.source;
      const t = typeof l.target === 'object' ? (l.target as ViewerNode).id : l.target;
      return s === selectedNode.id || t === selectedNode.id;
    });
    return (
      <div style={{ fontFamily: 'JetBrains Mono, monospace' }}>
        <DL label="Type">
          <Badge cls={inspectorBadge(selectedNode)}>{selectedNode.type.toUpperCase()}</Badge>
          {selectedNode.severity && <Badge cls={`b-cat${selectedNode.severity === 'CAT_I' ? '1' : selectedNode.severity === 'CAT_II' ? '2' : '3'}`}>{selectedNode.severity}</Badge>}
        </DL>
        <DL label="ID / Label"><span style={{ color: col }}>{selectedNode.label}</span></DL>
        <DL label="Description">{selectedNode.desc ?? '—'}</DL>
        {selectedNode.ts && <DL label="Timestamp">2026 {selectedNode.ts} UTC</DL>}
        {selectedNode.type === 'finding' && selectedNode.impact && (
          <>
            <DL label="Business Impact"><span style={{ fontSize: 20, fontWeight: 700, color: '#e5a54b' }}>{selectedNode.impact}</span></DL>
            {selectedNode.roi && <DL label="ROI"><span style={{ color: '#22c55e' }}>{selectedNode.roi}</span></DL>}
          </>
        )}
        {(selectedNode.type === 'control' || selectedNode.type === 'staging' || selectedNode.type === 'remediated') && selectedNode.framework && (
          <DL label="Framework"><span style={{ color: '#06b6d4' }}>{selectedNode.framework}</span></DL>
        )}
        {selectedNode.type === 'staging' && selectedNode.job_id && (
          <DL label="Staging Job ID">
            <span style={{ color: '#f59e0b', fontSize: 10 }}>{selectedNode.job_id}</span>
            <br /><span style={{ color: '#6b8aaa', fontSize: 9 }}>Awaiting ML-DSA-65 signed approval<br />before privileged execution.</span>
          </DL>
        )}
        {selectedNode.type === 'attest' && selectedNode.sig && (
          <DL label="ML-DSA-65 Signature">
            <div style={{ fontSize: 9, color: '#06b6d4', padding: '6px 8px', background: 'rgba(6,182,212,.15)', border: '1px solid rgba(6,182,212,.25)', borderRadius: 4, wordBreak: 'break-all', lineHeight: 1.6 }}>
              {selectedNode.sig}
            </div>
          </DL>
        )}
        {linkedLinks.length > 0 && (
          <DL label={`Linked Nodes (${linkedLinks.length})`}>
            {linkedLinks.slice(0, 10).map((l, i) => {
              const s = typeof l.source === 'object' ? (l.source as ViewerNode).id : l.source;
              const t = typeof l.target === 'object' ? (l.target as ViewerNode).id : l.target;
              const otherID = s === selectedNode.id ? t : s;
              const dir = s === selectedNode.id ? '→' : '←';
              const other = data?.nodes.find(n => n.id === otherID);
              if (!other) return null;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', borderRadius: 3, fontSize: 10, marginTop: 3, background: '#0d1728', border: '1px solid rgba(26,159,232,.18)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: nodeColor(other), display: 'inline-block' }} />
                  <span style={{ color: '#6b8aaa' }}>{dir}</span>
                  <span style={{ color: nodeColor(other) }}>{other.label}</span>
                </div>
              );
            })}
          </DL>
        )}
      </div>
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#050c16', color: '#e0eaf5', fontFamily: 'Space Grotesk, sans-serif', overflow: 'hidden' }}>

      {/* Classification Banner */}
      <div style={{ background: 'rgba(204,42,54,.12)', borderBottom: '1px solid rgba(204,42,54,.4)', textAlign: 'center', padding: '3px 0', fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '2.5px', color: 'rgba(204,42,54,.9)', fontWeight: 600, flexShrink: 0 }}>
        {classificationLabel}
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: 52, background: '#080f1c', borderBottom: '1px solid rgba(26,159,232,.35)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <NXShield />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: 1, color: '#1a9fe8' }}>NouchiX</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8, letterSpacing: 2, color: '#6b8aaa', textTransform: 'uppercase' }}>SecRed Knowledge Inc.</div>
          </div>
          <div style={{ width: 1, height: 30, background: 'rgba(26,159,232,.35)' }} />
          <div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '1.5px', color: '#e5a54b', fontWeight: 600 }}>KHEPRA · DAG · FLIGHT RECORDER</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#6b8aaa', letterSpacing: 1 }}>SouHimBou AI ASAF Engine · v1.5</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#6b8aaa' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: daemonOnline ? '#22c55e' : '#cc2a36', boxShadow: daemonOnline ? '0 0 6px #22c55e' : '0 0 6px #cc2a36', display: 'inline-block', animation: daemonOnline ? 'pulse 2s infinite' : 'none' }} />
            {daemonOnline ? 'ML-DSA-65 VERIFIED' : 'DAEMON OFFLINE'}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['3d', 'table', 'raw'] as const).map(tab => (
              <button key={tab} onClick={() => handleTabSwitch(tab)} style={{ padding: '5px 12px', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: 1, color: activeTab === tab ? '#1a9fe8' : '#6b8aaa', cursor: 'pointer', border: `1px solid ${activeTab === tab ? 'rgba(26,159,232,.35)' : 'transparent'}`, borderRadius: 4, background: activeTab === tab ? 'rgba(26,159,232,.08)' : 'none', textTransform: 'uppercase' }}>
                {tab === '3d' ? '3D WEB' : tab === 'table' ? 'TABLE' : 'RAW'}
              </button>
            ))}
          </div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#6b8aaa', padding: '4px 10px', border: '1px solid rgba(26,159,232,.18)', borderRadius: 20, background: '#0d1728', letterSpacing: '.3px' }}>
            {loading ? 'scanning…' : meta ? (
              <><span style={{ color: '#e5a54b', fontWeight: 600 }}>{meta.tool_calls}</span> tools · <span style={{ color: '#e5a54b', fontWeight: 600 }}>{meta.findings}</span> findings · <span style={{ color: '#e5a54b', fontWeight: 600 }}>{meta.attestations}</span> sigs</>
            ) : '— —'}
          </div>
          <button onClick={refresh} style={{ padding: '4px 10px', fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#06b6d4', border: '1px solid rgba(6,182,212,.3)', borderRadius: 4, background: 'rgba(6,182,212,.08)', cursor: 'pointer', letterSpacing: 1 }}>
            ↺ REFRESH
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '8px 20px', background: '#080f1c', borderBottom: '1px solid rgba(26,159,232,.18)', flexShrink: 0 }}>
        <div style={{ maxWidth: 680, margin: '0 auto', border: `1px solid ${searchFocused ? '#1a9fe8' : 'rgba(26,159,232,.35)'}`, borderRadius: 6, display: 'flex', alignItems: 'center', padding: '7px 14px', gap: 10, background: '#0d1728', boxShadow: searchFocused ? '0 0 0 3px rgba(26,159,232,.25)' : 'none', transition: 'all .15s' }}>
          <span style={{ color: '#06b6d4', fontSize: 12, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>khepra&gt;</span>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            onKeyDown={e => e.key === 'Escape' && setSearchQuery('')}
            placeholder="search tool · control · finding · signature · framework…"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#e0eaf5', caretColor: '#1a9fe8' }}
            spellCheck={false}
            autoComplete="off"
          />
          <span style={{ fontSize: 9, color: '#3d5a78', flexShrink: 0, letterSpacing: '.5px' }}>↑↓ nav · ⌵ focus · esc clear</span>
        </div>
      </div>

      {/* Error / offline notice */}
      {(fetchError || scriptError) && (
        <div style={{ padding: '6px 20px', background: 'rgba(204,42,54,.1)', borderBottom: '1px solid rgba(204,42,54,.3)', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#f87171', letterSpacing: '.5px', flexShrink: 0 }}>
          ⚠ {fetchError ?? scriptError} — viewer will display cached data or demo payload when daemon reconnects.
        </div>
      )}

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

        {/* Left: Node Inspector */}
        <div style={{ width: 288, flexShrink: 0, background: '#080f1c', borderRight: '1px solid rgba(26,159,232,.18)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(26,159,232,.18)' }}>
            <span style={{ fontSize: 9, letterSpacing: 2, color: '#6b8aaa', textTransform: 'uppercase' }}>Node Inspector</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8, padding: '2px 6px', border: '1px solid rgba(26,159,232,.35)', borderRadius: 3, color: '#1a9fe8', background: 'rgba(26,159,232,.25)' }}>ASAF ENGINE</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {renderInspector()}
          </div>
        </div>

        {/* Graph area */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#050c16' }}>

          {/* 3D graph container */}
          {activeTab === '3d' && (
            <div ref={graphContainerRef} style={{ width: '100%', height: '100%' }}>
              {!scriptReady && !scriptError && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#3d5a78', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
                  ⟳ Loading 3D engine…
                </div>
              )}
            </div>
          )}

          {/* Table view */}
          {activeTab === 'table' && payload && (
            <div style={{ overflow: 'auto', height: '100%', padding: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: '#3d5a78', fontSize: 8, letterSpacing: 2, textTransform: 'uppercase', borderBottom: '1px solid rgba(26,159,232,.25)' }}>
                    {['Label', 'Type', 'Description', 'Status'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 12px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payload.nodes.map((n, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(26,159,232,.12)', cursor: 'pointer' }} onClick={() => setSelectedNode(n)}>
                      <td style={{ padding: '7px 12px', color: nodeColor(n), fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>{n.label}</td>
                      <td style={{ padding: '7px 12px', color: '#6b8aaa', fontSize: 9, letterSpacing: 1 }}>{n.type.toUpperCase()}</td>
                      <td style={{ padding: '7px 12px', fontSize: 11, color: '#e0eaf5' }}>{n.desc ?? ''}</td>
                      <td style={{ padding: '7px 12px', fontSize: 11, color: '#e5a54b', fontFamily: 'JetBrains Mono, monospace' }}>
                        {n.type === 'finding' ? n.severity ?? 'FAIL' : n.type === 'staging' ? 'STAGING_PENDING' : n.type === 'remediated' ? 'AUTO_REMEDIATED' : n.type === 'control' ? 'PASS' : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Raw JSON view */}
          {activeTab === 'raw' && data && (
            <pre style={{ padding: 20, fontSize: 10, color: '#6b8aaa', overflow: 'auto', height: '100%', whiteSpace: 'pre-wrap', fontFamily: 'JetBrains Mono, monospace', margin: 0 }}>
              {JSON.stringify(data, null, 2)}
            </pre>
          )}

          {/* Legend */}
          <div style={{ position: 'absolute', top: 14, left: 14, background: 'rgba(5,12,22,.88)', border: '1px solid rgba(26,159,232,.35)', borderRadius: 6, padding: '12px 14px', pointerEvents: 'none', backdropFilter: 'blur(8px)' }}>
            <div style={{ fontSize: 8, color: '#6b8aaa', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10, fontFamily: 'JetBrains Mono, monospace' }}>Node Legend</div>
            {[
              { color: '#818cf8', label: 'AI Prompt' },
              { color: '#e5a54b', label: 'Tool Execution' },
              { color: '#cc2a36', label: 'Finding · CAT I' },
              { color: '#f97316', label: 'Finding · CAT II' },
              { color: '#22c55e', label: 'Control Satisfied' },
              { color: '#f59e0b', label: 'STAGING_PENDING' },
              { color: '#06b6d4', label: 'ML-DSA-65 Attest' },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 10, color: '#e0eaf5', fontFamily: 'JetBrains Mono, monospace' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
                {label}
              </div>
            ))}
          </div>

          {/* Watermark */}
          <div style={{ position: 'absolute', bottom: 14, right: 14, display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'none', opacity: .45 }}>
            <NXShield size={22} />
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#6b8aaa', letterSpacing: 1, textAlign: 'right' }}>
              <strong style={{ color: '#1a9fe8', display: 'block' }}>NouchiX SecRed</strong>
              SouHimBou ASAF · Powered by AdinKhepra
            </div>
          </div>

          {activeTab === '3d' && (
            <div style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#3d5a78', letterSpacing: '.5px', pointerEvents: 'none' }}>
              drag <span style={{ color: 'rgba(26,159,232,.35)' }}>·</span> scroll <span style={{ color: 'rgba(26,159,232,.35)' }}>·</span> click a node to inspect
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '5px 20px', background: '#080f1c', borderTop: '1px solid rgba(26,159,232,.18)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#3d5a78', letterSpacing: '.5px' }}>
          ISSUED BY <span style={{ color: '#6b8aaa' }}>SGT KONE</span> · 255th · CENTCOM VETERAN · SDVOSB · USPTO #73563085 · PATENT PENDING ·{' '}
          <span style={{ color: '#6b8aaa' }}>SESSION: {meta?.session_id ?? '—'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8, letterSpacing: '1.5px', padding: '3px 8px', borderRadius: 3, color: '#e5a54b', border: '1px solid rgba(229,165,75,.4)', background: 'rgba(229,165,75,.25)', textTransform: 'uppercase' }}>✓ CMMC AUTOPILOT</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8, letterSpacing: '1.5px', padding: '3px 8px', borderRadius: 3, color: '#06b6d4', border: '1px solid rgba(6,182,212,.4)', background: 'rgba(6,182,212,.25)', textTransform: 'uppercase' }}>⬡ PQC-STIG v1.5</span>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@300;400;600&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 3px; height: 3px; }
        ::-webkit-scrollbar-track { background: #050c16; }
        ::-webkit-scrollbar-thumb { background: rgba(26,159,232,.35); border-radius: 2px; }
        .b-prompt  { background: rgba(129,140,248,.12); color: #818cf8; border: 1px solid rgba(129,140,248,.3); }
        .b-tool    { background: rgba(229,165,75,.25); color: #e5a54b; border: 1px solid rgba(229,165,75,.4); }
        .b-finding { background: rgba(204,42,54,.25); color: #f87171; border: 1px solid rgba(204,42,54,.4); }
        .b-control { background: rgba(34,197,94,.2); color: #22c55e; border: 1px solid rgba(34,197,94,.4); }
        .b-attest  { background: rgba(6,182,212,.25); color: #06b6d4; border: 1px solid rgba(6,182,212,.4); }
        .b-staging { background: rgba(245,158,11,.15); color: #f59e0b; border: 1px solid rgba(245,158,11,.4); }
        .b-cat1    { background: rgba(204,42,54,.18); color: #fca5a5; border: 1px solid #cc2a36; }
        .b-cat2    { background: rgba(249,115,22,.15); color: #fdba74; border: 1px solid #f97316; }
        .b-cat3    { background: rgba(34,197,94,.2); color: #22c55e; border: 1px solid #22c55e; }
      `}</style>
    </div>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────────

const NXShield: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size * 32 / 28} viewBox="0 0 28 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 1L2 6V17C2 23.6 7.4 29.6 14 31C20.6 29.6 26 23.6 26 17V6L14 1Z" fill="rgba(26,159,232,.12)" stroke="#1a9fe8" strokeWidth="1.5" />
    <path d="M14 7L8 10V16.5C8 20.1 10.8 23.4 14 24.2C17.2 23.4 20 20.1 20 16.5V10L14 7Z" fill="rgba(26,159,232,.2)" stroke="#1a9fe8" strokeWidth="1" />
    <circle cx="14" cy="16" r="2.5" fill="#1a9fe8" opacity=".9" />
  </svg>
);

const Badge: React.FC<{ cls: string; children: React.ReactNode }> = ({ cls, children }) => (
  <span className={`badge ${cls}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 4, fontSize: 9, fontWeight: 600, letterSpacing: '.8px', fontFamily: 'JetBrains Mono, monospace', marginRight: 4 }}>
    {children}
  </span>
);

const DL: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ marginTop: 12 }}>
    <div style={{ fontSize: 8, color: '#6b8aaa', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
    <div style={{ fontSize: 12, color: '#e0eaf5', wordBreak: 'break-all', lineHeight: 1.5, fontFamily: 'JetBrains Mono, monospace' }}>{children}</div>
  </div>
);

export default DAGAuditViewer;
