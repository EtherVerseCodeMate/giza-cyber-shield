'use client';

import { useEffect, useState, useCallback } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

interface SensorData {
  temperature: number;
  humidity: number;
  gas: number;
  water: number;
  distance: number;
  ir: boolean;
  flame: boolean;
}

interface LiveState {
  connected: boolean;
  timestamp: string;
  sensors: SensorData;
  host: string;
  port: number;
  unit_id: number;
  error?: string;
}

interface AuditChannel {
  name: string;
  status: 'EXPOSED' | 'SIGNED' | 'NONE';
  mitre: string;
  note: string;
}

interface MitreFinding {
  id: string;
  name: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

interface AuditState {
  risk_level: string;
  channels: AuditChannel[];
  findings: MitreFinding[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const POLL_MS = 1000;
const STALE_MS = 5000;

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: '#ff2d2d',
  HIGH: '#ffb020',
  MEDIUM: '#4db8ff',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: ok ? '#00e87a' : '#ff2d2d',
        boxShadow: ok ? '0 0 6px #00e87a' : '0 0 6px #ff2d2d',
        marginRight: 6,
        flexShrink: 0,
      }}
    />
  );
}

function ChannelBadge({ status }: { status: AuditChannel['status'] }) {
  const cfg = {
    EXPOSED: { bg: '#2d0a0a', color: '#ff4444', label: 'EXPOSED' },
    SIGNED:  { bg: '#002d1a', color: '#00e87a', label: 'SIGNED ✓' },
    NONE:    { bg: '#1a1400', color: '#ffb020', label: 'NONE' },
  }[status];

  return (
    <span
      style={{
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.color}40`,
        borderRadius: 3,
        fontSize: 10,
        fontWeight: 700,
        padding: '1px 6px',
        letterSpacing: '0.06em',
        flexShrink: 0,
      }}
    >
      {cfg.label}
    </span>
  );
}

function SensorRow({
  label,
  value,
  unit = '',
  alarm = false,
  dim = false,
}: {
  label: string;
  value: string | number;
  unit?: string;
  alarm?: boolean;
  dim?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        padding: '5px 10px',
        borderRadius: 4,
        background: alarm ? '#1a0000' : 'transparent',
        border: alarm ? '1px solid #ff2d2d40' : '1px solid transparent',
        marginBottom: 3,
      }}
    >
      <span style={{ color: '#6a8aaa', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span
        style={{
          fontFamily: 'monospace',
          fontSize: 20,
          fontWeight: 700,
          color: alarm ? '#ff2d2d' : dim ? '#4a6a8a' : '#d0e8ff',
          textAlign: 'right',
        }}
      >
        {value}
        {unit && (
          <span style={{ fontSize: 12, fontWeight: 400, color: '#6a8aaa', marginLeft: 4 }}>{unit}</span>
        )}
      </span>
    </div>
  );
}

function BoolIndicator({ label, active, alarmWhenActive }: { label: string; active: boolean; alarmWhenActive?: boolean }) {
  const isAlarm = alarmWhenActive ? active : false;
  const dotColor = isAlarm ? '#ff2d2d' : active ? '#ffb020' : '#00e87a';
  const stateLabel = isAlarm ? '⚠ DETECTED' : active ? 'ACTIVE' : 'CLEAR';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 10px',
        borderRadius: 4,
        background: isAlarm ? '#1a0000' : '#0a0f18',
        border: `1px solid ${isAlarm ? '#ff2d2d60' : '#1e3050'}`,
        marginBottom: 3,
      }}
    >
      <span style={{ color: '#6a8aaa', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: 'monospace',
          fontSize: 13,
          fontWeight: 700,
          color: dotColor,
        }}
      >
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: dotColor,
          boxShadow: `0 0 6px ${dotColor}`,
          display: 'inline-block',
        }} />
        {stateLabel}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ScadaHMI() {
  const [live, setLive] = useState<LiveState | null>(null);
  const [audit, setAudit] = useState<AuditState | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const [now, setNow] = useState<Date>(new Date());

  const fetchLive = useCallback(async () => {
    try {
      const res = await fetch('/api/scada/live');
      if (res.ok) {
        const data: LiveState = await res.json();
        setLive(data);
        setLastUpdate(Date.now());
      }
    } catch {
      // keep stale data — connection status reflects the gap
    }
  }, []);

  const fetchAudit = useCallback(async () => {
    try {
      const res = await fetch('/api/scada/audit');
      if (res.ok) setAudit(await res.json());
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchLive();
    fetchAudit();
    const liveTick = setInterval(fetchLive, POLL_MS);
    const auditTick = setInterval(fetchAudit, 10_000);
    const clockTick = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearInterval(liveTick);
      clearInterval(auditTick);
      clearInterval(clockTick);
    };
  }, [fetchLive, fetchAudit]);

  const isStale = Date.now() - lastUpdate > STALE_MS;
  const connected = live?.connected && !isStale;
  const s = live?.sensors;

  const timeStr = now.toLocaleTimeString('en-GB', { hour12: false });
  const staleSec = lastUpdate ? Math.floor((Date.now() - lastUpdate) / 1000) : null;

  return (
    <div
      style={{
        width: 800,
        height: 480,
        background: '#080c14',
        fontFamily: "'Courier New', Courier, monospace",
        color: '#c0d8f0',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div
        style={{
          height: 40,
          background: '#0d1520',
          borderBottom: '1px solid #1e3050',
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <span style={{ color: '#00e87a', fontSize: 16, marginRight: 4 }}>⬡</span>
        <span style={{ color: '#d0e8ff', fontWeight: 700, fontSize: 13, letterSpacing: '0.04em' }}>
          AkokoNan Pod
        </span>
        <span style={{ color: '#3a5a7a', fontSize: 11, marginLeft: 4 }}>ESP32 Field RTU</span>

        <span style={{ flex: 1 }} />

        {live && (
          <span style={{ color: '#4a7a9a', fontSize: 10 }}>
            {live.host}:{live.port} &nbsp;·&nbsp; Slave ID {live.unit_id}
          </span>
        )}

        <span style={{ color: '#3a5a7a', fontSize: 10, marginLeft: 16 }}>{timeStr}</span>

        {/* Live / stale indicator */}
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            marginLeft: 12,
            padding: '2px 8px',
            borderRadius: 3,
            background: connected ? '#002d1a' : '#2d0a0a',
            border: `1px solid ${connected ? '#00e87a40' : '#ff2d2d40'}`,
            fontSize: 10,
            color: connected ? '#00e87a' : '#ff4444',
            fontWeight: 700,
            letterSpacing: '0.08em',
          }}
        >
          <StatusDot ok={!!connected} />
          {connected ? 'LIVE' : isStale ? `STALE ${staleSec}s` : 'CONNECTING'}
        </span>
      </div>

      {/* ── Body ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Left: Process ─────────────────────────────────────────── */}
        <div
          style={{
            width: 380,
            borderRight: '1px solid #1e3050',
            padding: '10px 8px',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
          }}
        >
          <div style={{ color: '#3a5a7a', fontSize: 9, letterSpacing: '0.12em', marginBottom: 8, paddingLeft: 10 }}>
            PROCESS — LIVE SENSOR VALUES
          </div>

          <SensorRow
            label="Temperature"
            value={s ? s.temperature.toFixed(1) : '—'}
            unit="°C"
            dim={!connected}
          />
          <SensorRow
            label="Humidity"
            value={s ? s.humidity.toFixed(1) : '—'}
            unit="%"
            dim={!connected}
          />
          <SensorRow
            label="Gas (ADC)"
            value={s ? s.gas : '—'}
            alarm={s ? s.gas > 3000 : false}
            dim={!connected}
          />
          <SensorRow
            label="Water Level (ADC)"
            value={s ? s.water : '—'}
            dim={!connected}
          />
          <SensorRow
            label="Distance"
            value={s ? (s.distance >= 999 ? '> 999' : s.distance) : '—'}
            unit="cm"
            dim={s ? s.distance >= 999 : !connected}
          />

          <div style={{ borderTop: '1px solid #1e3050', margin: '8px 0' }} />

          <BoolIndicator label="IR Motion" active={!!s?.ir} />
          <BoolIndicator label="Flame Sensor" active={!!s?.flame} alarmWhenActive />

          <div style={{ flex: 1 }} />

          <div style={{ padding: '6px 10px', borderTop: '1px solid #1e3050', marginTop: 4 }}>
            <span style={{ color: '#2a4a6a', fontSize: 9, letterSpacing: '0.08em' }}>
              MODBUS FC03 · REGS 0–6 · {staleSec !== null ? `${staleSec}s ago` : 'waiting'}
            </span>
          </div>
        </div>

        {/* ── Right: Security Audit ─────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            padding: '10px 10px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div style={{ color: '#3a5a7a', fontSize: 9, letterSpacing: '0.12em', marginBottom: 8, paddingLeft: 2 }}>
            ADINKHEPRA SECURITY AUDIT — OT CHANNEL POSTURE
          </div>

          {/* Channel status */}
          <div style={{ marginBottom: 8 }}>
            {(audit?.channels ?? []).map((ch) => (
              <div
                key={ch.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '5px 8px',
                  borderRadius: 4,
                  marginBottom: 3,
                  background: '#0a0f18',
                  border: '1px solid #1e3050',
                }}
              >
                <span style={{ flex: 1, fontSize: 11, color: '#8aaccc' }}>{ch.name}</span>
                <ChannelBadge status={ch.status} />
                {ch.mitre && (
                  <span style={{ fontSize: 9, color: '#4a6a8a', fontFamily: 'monospace', letterSpacing: '0.06em' }}>
                    {ch.mitre}
                  </span>
                )}
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid #1e3050', margin: '4px 0 8px' }} />

          {/* MITRE ATT&CK for ICS */}
          <div style={{ color: '#3a5a7a', fontSize: 9, letterSpacing: '0.12em', marginBottom: 6, paddingLeft: 2 }}>
            MITRE ATT&CK FOR ICS — ACTIVE FINDINGS
          </div>

          <div style={{ flex: 1, overflow: 'hidden' }}>
            {(audit?.findings ?? []).map((f) => (
              <div
                key={f.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 8px',
                  marginBottom: 3,
                  borderRadius: 4,
                  background: '#0a0f18',
                  borderLeft: `3px solid ${SEVERITY_COLOR[f.severity] ?? '#4a6a8a'}`,
                }}
              >
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 11,
                    color: SEVERITY_COLOR[f.severity] ?? '#8aaccc',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    flexShrink: 0,
                    width: 46,
                  }}
                >
                  {f.id}
                </span>
                <span style={{ flex: 1, fontSize: 11, color: '#8aaccc' }}>{f.name}</span>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: SEVERITY_COLOR[f.severity] ?? '#4a6a8a',
                    letterSpacing: '0.06em',
                    flexShrink: 0,
                  }}
                >
                  {f.severity}
                </span>
              </div>
            ))}
          </div>

          {/* Risk badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 8,
              padding: '8px 12px',
              borderRadius: 4,
              background: '#1a0800',
              border: '1px solid #ff6b0040',
            }}
          >
            <span style={{ fontSize: 10, color: '#6a8aaa', letterSpacing: '0.08em' }}>
              GODFATHER REPORT — EXECUTIVE RISK
            </span>
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: 14,
                fontWeight: 700,
                color: '#ffb020',
                letterSpacing: '0.08em',
              }}
            >
              {audit?.risk_level ?? '…'} ■
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
