import React, { useState, useEffect, useCallback, useRef } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

type Sector = 'defense' | 'healthcare' | 'finance' | 'industrial';
type CompanySize = 'smb' | 'midmarket' | 'enterprise';
type SimPhase =
  | 'idle'
  | 'init'
  | 'package-a'
  | 'package-b'
  | 'package-c'
  | 'package-d'
  | 'complete';
type RiskLevel = 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';

interface SectorProfile {
  label: string;
  icon: string;
  breachCost: number;
  primaryFramework: string;
  quantumDeadline: string;
  stigRequired: boolean;
  description: string;
}

interface SimResults {
  packageA: {
    alignmentScore: number;
    stigScore: number;
    complianceGaps: number;
    regulatoryConflicts: number;
    criticalGaps: string[];
  };
  packageB: {
    filesAnalyzed: number;
    dependencies: number;
    vulnerableDeps: number;
    shadowIT: number;
    topVulns: string[];
  };
  packageC: {
    pqcReadiness: string;
    rsaUses: number;
    ecdsaUses: number;
    kyberUses: number;
    dilithiumUses: number;
    proprietary: number;
    oss: number;
    gpl: number;
    ipClean: boolean;
  };
  packageD: {
    riskLevel: RiskLevel;
    causalChain: Array<{ type: string; text: string }>;
    recommendations: Array<{ priority: string; action: string; impact: string }>;
    revenueAtRisk: string;
    complianceCost: string;
    mitigationCost: string;
    timeToCompliance: string;
    keyRisks: string[];
  };
}

// ─── Sector profiles ─────────────────────────────────────────────────────────

const SECTORS: Record<Sector, SectorProfile> = {
  defense: {
    label: 'Defense / DoD Supply Chain',
    icon: '🛡️',
    breachCost: 4_930_000,
    primaryFramework: 'CMMC Level 2',
    quantumDeadline: '2026 (NSA CNSA 2.0)',
    stigRequired: true,
    description: 'CUI handling, DFARS 252.204-7012, CMMC Level 2 mandate',
  },
  healthcare: {
    label: 'Healthcare / Life Sciences',
    icon: '🏥',
    breachCost: 9_770_000,
    primaryFramework: 'HIPAA + HITECH',
    quantumDeadline: '2028 (HHS guidance)',
    stigRequired: false,
    description: 'PHI protection, HIPAA Security Rule, HL7 FHIR security',
  },
  finance: {
    label: 'Finance / FinTech',
    icon: '🏦',
    breachCost: 5_970_000,
    primaryFramework: 'PCI DSS 4.0 + FFIEC',
    quantumDeadline: '2027 (NIST PQC mandate)',
    stigRequired: false,
    description: 'PCI DSS v4.0, FFIEC CAT, SOX IT controls',
  },
  industrial: {
    label: 'Industrial / OT / SCADA',
    icon: '⚙️',
    breachCost: 5_560_000,
    primaryFramework: 'CISA CIRCIA + IEC 62443',
    quantumDeadline: '2029 (CISA guidance)',
    stigRequired: false,
    description: 'ICS/SCADA security, NERC CIP, CISA CIRCIA reporting',
  },
};

const SIZES: Record<CompanySize, { label: string; multiplier: number; employees: string }> = {
  smb: { label: 'SMB (< 100 employees)', multiplier: 0.4, employees: '< 100' },
  midmarket: { label: 'Mid-Market (100–2,500)', multiplier: 1.0, employees: '100–2,500' },
  enterprise: { label: 'Enterprise (2,500+)', multiplier: 2.8, employees: '2,500+' },
};

// ─── Simulation data generator ────────────────────────────────────────────────

function generateResults(sector: Sector, size: CompanySize): SimResults {
  const profile = SECTORS[sector];
  const sizeConfig = SIZES[size];
  const mul = sizeConfig.multiplier;

  // Package A — scores vary by sector
  const stigScore = sector === 'defense' ? 47 : sector === 'healthcare' ? 61 : 68;
  const alignmentScore = stigScore + 15;
  const complianceGaps = Math.round(18 * mul);
  const regulatoryConflicts = Math.round(4 * mul);
  const riskLevel: RiskLevel =
    stigScore < 50 ? 'HIGH' : stigScore < 65 ? 'MODERATE' : 'LOW';

  // Package B
  const vulnDeps = Math.round(7 * mul);
  const shadowIT = Math.round(3 * mul);

  // Package D FAIR calculation
  const eal =
    profile.breachCost *
    (sector === 'defense' ? 0.65 : 0.4) *
    (riskLevel === 'CRITICAL' ? 0.85 : riskLevel === 'HIGH' ? 0.65 : 0.4) *
    mul;

  const revenueAtRisk = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(eal);

  const complianceCostVal = sector === 'defense' ? 180_000 : 90_000;
  const mitigationCostVal = size === 'enterprise' ? 250_000 : size === 'midmarket' ? 99_000 : 25_000;
  const timeToCompliance = sector === 'defense' ? '90 days' : '60 days';

  // Causal chain
  const causalChain =
    sector === 'defense'
      ? [
          { type: 'GOAL', text: `Achieve ${profile.primaryFramework} for DoD Contract Renewal` },
          { type: 'BLOCKER', text: 'Legacy Authentication System Fails FIPS 140-3 Requirements' },
          { type: 'BLOCKER', text: 'Migration Budget Not Allocated in Current Fiscal Year' },
          { type: 'CONSEQUENCE', text: `Contract renewal at risk — estimated ${revenueAtRisk} ARR impact` },
          { type: 'BLOCKER', text: 'RSA-2048 / ECDSA-P256 cryptographic infrastructure in production' },
          { type: 'CONSEQUENCE', text: `Quantum deadline: ${profile.quantumDeadline}` },
          { type: 'CONSEQUENCE', text: 'Re-signing all compliance evidence will cost $500K+ without PQC migration now' },
        ]
      : sector === 'healthcare'
      ? [
          { type: 'GOAL', text: 'Expand into Federal Health Programs (CMS / VA contracts)' },
          { type: 'BLOCKER', text: 'PHI data flows lack end-to-end encryption audit trail' },
          { type: 'CONSEQUENCE', text: `Potential HIPAA breach fine: up to $50,000 per violation class` },
          { type: 'BLOCKER', text: 'Legacy RSA-2048 used in HL7 message signing' },
          { type: 'CONSEQUENCE', text: `HHS PQC guidance deadline: ${profile.quantumDeadline}` },
        ]
      : sector === 'finance'
      ? [
          { type: 'GOAL', text: 'Achieve PCI DSS v4.0 Level 1 Certification by Q3' },
          { type: 'BLOCKER', text: '6 PCI DSS Requirement 8 gaps (authentication controls)' },
          { type: 'BLOCKER', text: 'ECDSA-P256 used in payment signing pipeline' },
          { type: 'CONSEQUENCE', text: `Card brand fine exposure: up to $100,000/month until certified` },
          { type: 'CONSEQUENCE', text: `NIST PQC mandate: ${profile.quantumDeadline}` },
        ]
      : [
          { type: 'GOAL', text: 'Meet CISA CIRCIA 72-hour breach reporting obligation' },
          { type: 'BLOCKER', text: 'No automated incident detection on OT/SCADA network segment' },
          { type: 'BLOCKER', text: 'IEC 62443 security levels not mapped to current architecture' },
          { type: 'CONSEQUENCE', text: 'Average OT breach dwell time: 287 days (undetected)' },
          { type: 'CONSEQUENCE', text: `Sector breach cost baseline: $${(profile.breachCost / 1e6).toFixed(2)}M` },
        ];

  const recommendations = [
    {
      priority: 'URGENT',
      action: `Deploy AdinKhepra STIG Validation Suite`,
      impact: `Achieves ${profile.primaryFramework} compliance within ${timeToCompliance}`,
    },
    {
      priority: 'STRATEGIC',
      action: 'Initiate Post-Quantum Cryptography Migration (Kyber-1024 + Dilithium-3)',
      impact: `Future-proofs before ${profile.quantumDeadline} deadline — avoids $500K+ re-audit costs`,
    },
    {
      priority: 'OPERATIONAL',
      action: 'Enable Automated Supply Chain CVE Scanning',
      impact: 'Reduces vulnerability exposure window from 45 days to 24 hours',
    },
    {
      priority: 'FOUNDATIONAL',
      action: 'Establish Continuous Compliance Monitoring (AdinKhepra Agent)',
      impact: 'Real-time drift detection, automated POA&M generation',
    },
  ];

  return {
    packageA: {
      alignmentScore,
      stigScore,
      complianceGaps,
      regulatoryConflicts,
      criticalGaps:
        sector === 'defense'
          ? [
              '[CRITICAL] CMMC: AC.L2-3.1.3 — CUI flow control not enforced',
              '[CRITICAL] STIG: V-220706 — MFA not configured',
              '[HIGH]     NIST: IA-5(1) — Password complexity absent',
              '[HIGH]     CMMC: SI.L2-3.14.1 — No malware protection policy',
              '[HIGH]     STIG: V-220712 — Audit log retention below 12-month minimum',
            ]
          : [
              `[CRITICAL] ${profile.primaryFramework}: Authentication control gaps`,
              '[CRITICAL] NIST 800-53: AU-9 — Audit log integrity not enforced',
              '[HIGH]     NIST 800-53: SC-28 — Data at rest encryption incomplete',
              '[HIGH]     NIST 800-53: IA-5 — Credential lifecycle management gaps',
            ],
    },
    packageB: {
      filesAnalyzed: Math.round(247 * mul),
      dependencies: Math.round(34 * mul),
      vulnerableDeps: vulnDeps,
      shadowIT,
      topVulns: [
        '[CRITICAL] github.com/golang-jwt/jwt (3 CVEs) [EXPLOITED IN WILD]',
        '[HIGH]     golang.org/x/net (2 CVEs)',
        '[HIGH]     github.com/gorilla/websocket (1 CVE)',
        '[MEDIUM]   gopkg.in/yaml.v2 (1 CVE)',
        '[MEDIUM]   golang.org/x/crypto (1 CVE)',
      ].slice(0, Math.min(5, vulnDeps)),
    },
    packageC: {
      pqcReadiness: 'MIGRATION_REQUIRED',
      rsaUses: 12,
      ecdsaUses: 8,
      kyberUses: 0,
      dilithiumUses: 0,
      proprietary: 88.0,
      oss: 12.0,
      gpl: 0.0,
      ipClean: true,
    },
    packageD: {
      riskLevel,
      causalChain,
      recommendations,
      revenueAtRisk,
      complianceCost: new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(complianceCostVal),
      mitigationCost: new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(mitigationCostVal),
      timeToCompliance,
      keyRisks: [
        `${profile.primaryFramework} non-compliance — contract / regulatory eligibility risk`,
        `Quantum cryptography deadline exposure — RSA/ECDSA deprecated ${profile.quantumDeadline}`,
        'Supply chain breach via unpatched CISA KEV dependency (active exploitation)',
      ],
    },
  };
}

// ─── Terminal line builder ────────────────────────────────────────────────────

function buildTerminalScript(sector: Sector, size: CompanySize): Array<{ text: string; delay: number; color?: string }> {
  const profile = SECTORS[sector];
  return [
    { text: '$ adinkhepra ert full .', delay: 0, color: '#a5f3fc' },
    { text: '', delay: 200 },
    { text: '================================================================', delay: 300, color: '#f1f5f9' },
    { text: ' KHEPRA PROTOCOL // EXECUTIVE ROUNDTABLE (ERT)', delay: 100, color: '#f1f5f9' },
    { text: ' INTEGRATED INTELLIGENCE ANALYSIS', delay: 100, color: '#f1f5f9' },
    { text: '================================================================', delay: 100, color: '#f1f5f9' },
    { text: '', delay: 200 },
    { text: `Target Directory: .  [Sector: ${profile.label}]`, delay: 300 },
    { text: '', delay: 100 },
    { text: '[*] Initializing Immutable DAG...', delay: 400 },
    { text: '[*] Initializing ERT Intelligence Engine...', delay: 600 },
    { text: '[*] Loading CVE Database...', delay: 400 },
    { text: '    -> Total CVEs: 247,341', delay: 300 },
    { text: '    -> Known Exploited (CISA KEV): 1,124', delay: 200 },
    { text: '    -> Critical: 18,847', delay: 200 },
    { text: '', delay: 200 },
    { text: '[*] Running Full Executive Roundtable Analysis...', delay: 400 },
    { text: '', delay: 100 },
    { text: '═══════════════════════════════════════════════════════════════', delay: 300, color: '#818cf8' },
    { text: ' PACKAGE A: STRATEGIC READINESS', delay: 100, color: '#818cf8' },
    { text: '═══════════════════════════════════════════════════════════════', delay: 100, color: '#818cf8' },
    { text: '', delay: 200 },
    { text: `Strategic Alignment Score: ${sector === 'defense' ? 62 : 76}/100`, delay: 300 },
    { text: `STIG Compliance Score:     ${sector === 'defense' ? 47 : 61}/100`, delay: 200 },
    { text: `Compliance Gaps:           ${Math.round(18 * SIZES[size].multiplier)}`, delay: 200 },
    { text: `Regulatory Conflicts:      ${Math.round(4 * SIZES[size].multiplier)}`, delay: 200 },
    { text: '', delay: 200 },
    { text: '═══════════════════════════════════════════════════════════════', delay: 300, color: '#818cf8' },
    { text: ' PACKAGE B: ARCHITECTURE & SUPPLY CHAIN', delay: 100, color: '#818cf8' },
    { text: '═══════════════════════════════════════════════════════════════', delay: 100, color: '#818cf8' },
    { text: '', delay: 200 },
    { text: `Total Files:               ${Math.round(247 * SIZES[size].multiplier)}`, delay: 300 },
    { text: `Vulnerable Dependencies:   ${Math.round(7 * SIZES[size].multiplier)}`, delay: 200 },
    { text: '  [CRITICAL] golang-jwt/jwt (3 CVEs) [EXPLOITED IN WILD]', delay: 300, color: '#f87171' },
    { text: '  [HIGH]     golang.org/x/net (2 CVEs)', delay: 200, color: '#fb923c' },
    { text: '', delay: 200 },
    { text: '═══════════════════════════════════════════════════════════════', delay: 300, color: '#818cf8' },
    { text: ' PACKAGE C: CRYPTOGRAPHY & IP LINEAGE', delay: 100, color: '#818cf8' },
    { text: '═══════════════════════════════════════════════════════════════', delay: 100, color: '#818cf8' },
    { text: '', delay: 200 },
    { text: 'PQC Readiness:             MIGRATION_REQUIRED', delay: 300, color: '#fb923c' },
    { text: '  -> RSA-2048: UNSAFE (Quantum-Broken > 2028) [12 uses]', delay: 300, color: '#f87171' },
    { text: '  -> ECDSA-P256: UNSAFE (Quantum-Broken > 2028) [8 uses]', delay: 200, color: '#f87171' },
    { text: '  -> Kyber (PQC): NOT DETECTED', delay: 200, color: '#fb923c' },
    { text: 'IP Lineage: 88.0% Proprietary / 12.0% OSS / 0.0% GPL', delay: 300 },
    { text: 'IP Status:  CLEAN ✓', delay: 200, color: '#4ade80' },
    { text: '', delay: 200 },
    { text: '═══════════════════════════════════════════════════════════════', delay: 300, color: '#818cf8' },
    { text: ' PACKAGE D: THE GODFATHER REPORT', delay: 100, color: '#818cf8' },
    { text: '═══════════════════════════════════════════════════════════════', delay: 100, color: '#818cf8' },
    { text: '', delay: 200 },
    {
      text: `Executive Risk Level:      ${sector === 'defense' ? 'HIGH' : 'MODERATE'}`,
      delay: 400,
      color: sector === 'defense' ? '#fb923c' : '#facc15',
    },
    { text: '', delay: 300 },
    { text: '[+] FINAL ATTESTATION SIGNED (ML-DSA-65 / Dilithium3)', delay: 400, color: '#4ade80' },
    { text: '[+] DAG Nodes Written: 5', delay: 200, color: '#4ade80' },
    { text: '✅ Full report saved: ert_full_report.json', delay: 300, color: '#4ade80' },
    { text: '', delay: 200 },
    { text: '═══════════════════════════════════════════════════════════════', delay: 200, color: '#4ade80' },
    { text: '[+] EXECUTIVE ROUNDTABLE ANALYSIS COMPLETE', delay: 100, color: '#4ade80' },
    { text: '═══════════════════════════════════════════════════════════════', delay: 100, color: '#4ade80' },
  ];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const RiskBadge: React.FC<{ level: RiskLevel }> = ({ level }) => {
  const colors: Record<RiskLevel, string> = {
    CRITICAL: 'bg-red-600 text-white',
    HIGH: 'bg-orange-500 text-white',
    MODERATE: 'bg-yellow-400 text-gray-900',
    LOW: 'bg-green-500 text-white',
  };
  return (
    <span className={`inline-block px-3 py-1 rounded font-bold text-sm tracking-widest ${colors[level]}`}>
      {level}
    </span>
  );
};

const PriorityBadge: React.FC<{ priority: string }> = ({ priority }) => {
  const colors: Record<string, string> = {
    URGENT: 'bg-red-600/20 text-red-400 border border-red-600/40',
    STRATEGIC: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40',
    OPERATIONAL: 'bg-blue-500/20 text-blue-300 border border-blue-500/40',
    FOUNDATIONAL: 'bg-green-500/20 text-green-300 border border-green-500/40',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold tracking-wider ${colors[priority] ?? ''}`}>
      {priority}
    </span>
  );
};

const ChainTypeBadge: React.FC<{ type: string }> = ({ type }) => {
  const colors: Record<string, string> = {
    GOAL: 'text-green-400',
    BLOCKER: 'text-red-400',
    CONSEQUENCE: 'text-yellow-300',
    ENABLER: 'text-green-400',
  };
  return <span className={`font-bold mr-2 ${colors[type] ?? 'text-gray-300'}`}>[{type}]</span>;
};

// ─── Main component ───────────────────────────────────────────────────────────

const GodfatherSimulation: React.FC = () => {
  const [sector, setSector] = useState<Sector>('defense');
  const [size, setSize] = useState<CompanySize>('midmarket');
  const [phase, setPhase] = useState<SimPhase>('idle');
  const [terminalLines, setTerminalLines] = useState<Array<{ text: string; color?: string }>>([]);
  const [results, setResults] = useState<SimResults | null>(null);
  const [activeTab, setActiveTab] = useState<'A' | 'B' | 'C' | 'D'>('D');
  const terminalRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef(false);

  const scrollTerminal = useCallback(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollTerminal();
  }, [terminalLines, scrollTerminal]);

  const runSimulation = useCallback(async () => {
    cancelRef.current = false;
    setTerminalLines([]);
    setResults(null);
    setPhase('init');
    setActiveTab('D');

    const script = buildTerminalScript(sector, size);
    let cumulativeDelay = 0;

    for (let i = 0; i < script.length; i++) {
      const line = script[i];
      cumulativeDelay += line.delay;

      await new Promise<void>((resolve) => {
        const t = setTimeout(() => {
          if (cancelRef.current) { resolve(); return; }
          setTerminalLines((prev) => [...prev, { text: line.text, color: line.color }]);

          // Update phase based on progress
          if (i === 17) setPhase('package-a');
          else if (i === 26) setPhase('package-b');
          else if (i === 34) setPhase('package-c');
          else if (i === 44) setPhase('package-d');

          resolve();
        }, cumulativeDelay);
        // Cleanup if needed (runs after timeout, safe to ignore)
        void t;
      });
    }

    if (!cancelRef.current) {
      setResults(generateResults(sector, size));
      setPhase('complete');
    }
  }, [sector, size]);

  const resetSim = () => {
    cancelRef.current = true;
    setPhase('idle');
    setTerminalLines([]);
    setResults(null);
  };

  const phaseLabel: Record<SimPhase, string> = {
    idle: 'Ready',
    init: 'Initializing...',
    'package-a': 'Package A: Strategic Readiness',
    'package-b': 'Package B: Architecture & Supply Chain',
    'package-c': 'Package C: Cryptography & IP Lineage',
    'package-d': 'Package D: The Godfather Report',
    complete: 'Analysis Complete',
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-mono">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                <span className="text-indigo-400">KHEPRA</span> Executive Roundtable
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                Live simulation — <code className="text-cyan-400">adinkhepra ert full</code> — post-quantum attested intelligence
              </p>
            </div>
            <div className="hidden md:flex items-center gap-2 text-xs text-gray-500">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
              ML-DSA-65 Attestation Active
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Config panel */}
        {phase === 'idle' && (
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Sector */}
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-widest mb-3">Industry Sector</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(SECTORS) as [Sector, SectorProfile][]).map(([key, profile]) => (
                  <button
                    key={key}
                    onClick={() => setSector(key)}
                    className={`p-3 rounded border text-left transition-all ${
                      sector === key
                        ? 'border-indigo-500 bg-indigo-500/10 text-white'
                        : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                    }`}
                  >
                    <div className="text-lg mb-1">{profile.icon}</div>
                    <div className="text-xs font-semibold">{profile.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{profile.primaryFramework}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Company size */}
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-widest mb-3">Organization Size</label>
              <div className="space-y-2">
                {(Object.entries(SIZES) as [CompanySize, { label: string; multiplier: number; employees: string }][]).map(
                  ([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => setSize(key)}
                      className={`w-full p-3 rounded border text-left transition-all ${
                        size === key
                          ? 'border-indigo-500 bg-indigo-500/10 text-white'
                          : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      <span className="font-semibold text-sm">{cfg.label}</span>
                    </button>
                  )
                )}
              </div>

              {/* Sector summary */}
              <div className="mt-4 p-3 rounded bg-gray-900 border border-gray-800 text-xs text-gray-400">
                <div className="flex justify-between mb-1">
                  <span>Sector breach cost baseline:</span>
                  <span className="text-orange-400">
                    ${(SECTORS[sector].breachCost / 1e6).toFixed(2)}M
                  </span>
                </div>
                <div className="flex justify-between mb-1">
                  <span>Primary framework:</span>
                  <span className="text-indigo-400">{SECTORS[sector].primaryFramework}</span>
                </div>
                <div className="flex justify-between">
                  <span>PQC deadline:</span>
                  <span className="text-yellow-400">{SECTORS[sector].quantumDeadline}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Run button */}
        {phase === 'idle' && (
          <button
            onClick={runSimulation}
            className="w-full md:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded transition-all text-sm tracking-wider uppercase mb-8"
          >
            Run `adinkhepra ert full` Simulation
          </button>
        )}

        {phase !== 'idle' && phase !== 'complete' && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
              <span className="text-sm text-gray-300">{phaseLabel[phase]}</span>
            </div>
            <button
              onClick={resetSim}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-3 py-1 border border-gray-700 rounded"
            >
              Reset
            </button>
          </div>
        )}

        {phase === 'complete' && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-green-400 text-sm">✅ {phaseLabel[phase]}</span>
            </div>
            <button
              onClick={resetSim}
              className="text-xs text-gray-400 hover:text-white transition-colors px-3 py-1 border border-gray-700 rounded"
            >
              New Simulation
            </button>
          </div>
        )}

        {/* Terminal */}
        {phase !== 'idle' && (
          <div
            ref={terminalRef}
            className="bg-gray-950 border border-gray-800 rounded-lg p-4 font-mono text-xs leading-5 overflow-y-auto mb-8"
            style={{ height: '320px' }}
          >
            {terminalLines.map((line, i) => (
              <div key={i} style={{ color: line.color ?? '#94a3b8' }}>
                {line.text || ' '}
              </div>
            ))}
            {phase !== 'complete' && (
              <span className="inline-block w-2 h-4 bg-cyan-400 animate-pulse ml-0.5"></span>
            )}
          </div>
        )}

        {/* Results */}
        {results && (
          <>
            {/* Tab nav */}
            <div className="flex border-b border-gray-800 mb-6">
              {(['A', 'B', 'C', 'D'] as const).map((tab) => {
                const labels: Record<string, string> = {
                  A: 'Strategic Readiness',
                  B: 'Architecture',
                  C: 'Crypto & IP',
                  D: 'Godfather Report',
                };
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors ${
                      activeTab === tab
                        ? 'border-indigo-500 text-white'
                        : 'border-transparent text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    <span className={`mr-2 ${activeTab === tab ? 'text-indigo-400' : 'text-gray-600'}`}>Pkg {tab}</span>
                    {labels[tab]}
                  </button>
                );
              })}
            </div>

            {/* Package A */}
            {activeTab === 'A' && (
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
                    <h3 className="text-xs text-gray-400 uppercase tracking-widest mb-4">Compliance Scores</h3>
                    {[
                      { label: 'Strategic Alignment', value: results.packageA.alignmentScore },
                      { label: 'STIG Compliance', value: results.packageA.stigScore },
                    ].map(({ label, value }) => (
                      <div key={label} className="mb-3">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-300">{label}</span>
                          <span className={value < 60 ? 'text-red-400' : value < 75 ? 'text-yellow-400' : 'text-green-400'}>
                            {value}/100
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-800 rounded overflow-hidden">
                          <div
                            className={`h-full rounded transition-all duration-500 ${
                              value < 60 ? 'bg-red-500' : value < 75 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${value}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-red-400">{results.packageA.complianceGaps}</div>
                        <div className="text-xs text-gray-500 mt-1">Compliance Gaps</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-orange-400">{results.packageA.regulatoryConflicts}</div>
                        <div className="text-xs text-gray-500 mt-1">Regulatory Conflicts</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
                  <h3 className="text-xs text-gray-400 uppercase tracking-widest mb-4">Critical Compliance Gaps</h3>
                  <div className="space-y-2">
                    {results.packageA.criticalGaps.map((gap, i) => (
                      <div key={i} className="text-xs font-mono text-gray-300 bg-gray-950 rounded px-3 py-2">
                        {gap}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Package B */}
            {activeTab === 'B' && (
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
                  <h3 className="text-xs text-gray-400 uppercase tracking-widest mb-4">Supply Chain Stats</h3>
                  {[
                    { label: 'Source Files Analyzed', value: results.packageB.filesAnalyzed, color: 'text-blue-400' },
                    { label: 'Dependencies Mapped', value: results.packageB.dependencies, color: 'text-blue-400' },
                    { label: 'Vulnerable Dependencies', value: results.packageB.vulnerableDeps, color: 'text-red-400' },
                    { label: 'Shadow IT Detected', value: results.packageB.shadowIT, color: 'text-orange-400' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex justify-between py-2 border-b border-gray-800 last:border-0">
                      <span className="text-sm text-gray-300">{label}</span>
                      <span className={`font-bold ${color}`}>{value}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
                  <h3 className="text-xs text-gray-400 uppercase tracking-widest mb-4">Top Vulnerabilities (CISA KEV)</h3>
                  <div className="space-y-2">
                    {results.packageB.topVulns.map((vuln, i) => (
                      <div key={i} className="text-xs font-mono text-gray-300 bg-gray-950 rounded px-3 py-2">
                        {vuln}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded text-xs text-orange-300">
                    Average CVE exposure window without automated scanning: <strong>45 days</strong>. With AdinKhepra continuous agent: <strong>24 hours</strong>.
                  </div>
                </div>
              </div>
            )}

            {/* Package C */}
            {activeTab === 'C' && (
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
                    <h3 className="text-xs text-gray-400 uppercase tracking-widest mb-4">Cryptographic Primitives</h3>
                    {[
                      { label: 'RSA (quantum-vulnerable)', value: results.packageC.rsaUses, danger: true },
                      { label: 'ECDSA (quantum-vulnerable)', value: results.packageC.ecdsaUses, danger: true },
                      { label: 'Kyber-1024 PQC KEM', value: results.packageC.kyberUses, danger: false },
                      { label: 'Dilithium-3 PQC Sig', value: results.packageC.dilithiumUses, danger: false },
                    ].map(({ label, value, danger }) => (
                      <div key={label} className="flex justify-between py-2 border-b border-gray-800 last:border-0">
                        <span className="text-sm text-gray-300">{label}</span>
                        <span className={`font-bold ${value > 0 && danger ? 'text-red-400' : value > 0 ? 'text-green-400' : 'text-gray-600'}`}>
                          {value > 0 ? `${value} uses` : 'NOT DETECTED'}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded text-xs text-orange-300">
                    PQC Deadline: <strong>{SECTORS[sector].quantumDeadline}</strong>. Migration path to Kyber-1024 + Dilithium-3 validated.
                  </div>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
                  <h3 className="text-xs text-gray-400 uppercase tracking-widest mb-4">IP Lineage (AR 27-60)</h3>
                  {[
                    { label: 'Proprietary', value: results.packageC.proprietary, color: 'bg-indigo-500' },
                    { label: 'Open Source (MIT/Apache)', value: results.packageC.oss, color: 'bg-blue-500' },
                    { label: 'GPL / Viral', value: results.packageC.gpl, color: 'bg-red-500' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="mb-3">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-300">{label}</span>
                        <span className="text-gray-400">{value.toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-800 rounded overflow-hidden">
                        <div className={`h-full rounded ${color}`} style={{ width: `${value}%` }} />
                      </div>
                    </div>
                  ))}
                  <div className={`mt-4 p-3 rounded border text-xs font-bold ${
                    results.packageC.ipClean
                      ? 'bg-green-500/10 border-green-500/30 text-green-300'
                      : 'bg-red-500/10 border-red-500/30 text-red-300'
                  }`}>
                    IP PURITY CERTIFICATE: {results.packageC.ipClean ? 'ISSUED ✓' : 'CONTAMINATION DETECTED ✗'}
                  </div>
                </div>
              </div>
            )}

            {/* Package D — The Godfather Report */}
            {activeTab === 'D' && (
              <div className="space-y-6">
                {/* Risk level header */}
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <div className="text-xs text-gray-400 uppercase tracking-widest mb-2">Executive Risk Level</div>
                    <RiskBadge level={results.packageD.riskLevel} />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Revenue at Risk', value: results.packageD.revenueAtRisk, color: 'text-red-400' },
                      { label: 'Compliance Cost', value: results.packageD.complianceCost, color: 'text-orange-400' },
                      { label: 'Mitigation Cost', value: results.packageD.mitigationCost, color: 'text-green-400' },
                      { label: 'Time to Compliance', value: results.packageD.timeToCompliance, color: 'text-blue-400' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="text-center">
                        <div className={`text-lg font-bold ${color}`}>{value}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Causal chain */}
                  <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
                    <h3 className="text-xs text-gray-400 uppercase tracking-widest mb-4">Causal Chain Analysis</h3>
                    <div className="space-y-2">
                      {results.packageD.causalChain.map((link, i) => (
                        <div key={i} className="text-xs">
                          <span className="text-gray-600 mr-2">{i + 1}.</span>
                          <ChainTypeBadge type={link.type} />
                          <span className="text-gray-300">{link.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recommendations */}
                  <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
                    <h3 className="text-xs text-gray-400 uppercase tracking-widest mb-4">Recommended Interventions</h3>
                    <div className="space-y-3">
                      {results.packageD.recommendations.map((rec, i) => (
                        <div key={i} className="border-b border-gray-800 pb-3 last:border-0 last:pb-0">
                          <div className="flex items-center gap-2 mb-1">
                            <PriorityBadge priority={rec.priority} />
                          </div>
                          <div className="text-xs text-white mb-1">{rec.action}</div>
                          <div className="text-xs text-gray-500">↳ {rec.impact}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Key risks */}
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
                  <h3 className="text-xs text-gray-400 uppercase tracking-widest mb-4">Key Business Risks</h3>
                  <div className="grid md:grid-cols-3 gap-3">
                    {results.packageD.keyRisks.map((risk, i) => (
                      <div key={i} className="bg-gray-950 border border-gray-800 rounded p-3 text-xs text-gray-300">
                        <span className="text-red-400 mr-2">⚠</span>{risk}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Attestation + CTA */}
                <div className="bg-indigo-950/50 border border-indigo-700/40 rounded-lg p-5">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="text-xs text-indigo-300">
                      <div className="font-bold mb-1">ML-DSA-65 Attestation (NIST FIPS 204)</div>
                      <div className="text-indigo-400/70">DAG nodes: 5 written — tamper-evident audit chain active</div>
                      <div className="text-indigo-400/70 mt-0.5">Signed: {new Date().toISOString().split('T')[0]} (KHEPRA AI SENTRY)</div>
                    </div>
                    <div className="flex gap-3">
                      <a
                        href="https://adinkhepra.com"
                        className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors"
                      >
                        Get Your Report
                      </a>
                      <a
                        href="https://adinkhepra.com/enterprise"
                        className="px-4 py-2 text-xs font-bold uppercase tracking-wider border border-indigo-600 text-indigo-300 hover:bg-indigo-600/20 rounded transition-colors"
                      >
                        Enterprise Assessment
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default GodfatherSimulation;
