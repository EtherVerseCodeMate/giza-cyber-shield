
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const PLANS = [
  {
    id: 'diagnostic',
    name: 'Readiness Diagnostic',
    badge: 'ADVISORY',
    price: '$5,000',
    priceSuffix: 'fixed scope',
    headline: true,
    description:
      'Full-spectrum CMMC readiness assessment with C3PAO-ready evidence package. Delivered in 10 business days.',
    features: [
      'KHEPRA system scan — live, against your environment',
      'STIG gap mapping across all applicable NIST 800-171 controls',
      'DAG-anchored, PQC-signed evidence package',
      'Written C3PAO readiness report with prioritized remediation',
      'ADINKHEPRA attestation seal on evidence artifacts',
      '30-day follow-up remediation verification call',
    ],
    cta: 'Request Assessment',
    ctaAction: 'advisory',
    note: '2 engagements available this month',
  },
  {
    id: 'emergency',
    name: 'Deadline Sprint',
    badge: 'URGENT',
    price: '$15,000',
    priceSuffix: '14-day delivery',
    headline: false,
    description:
      'Assessment deadline in under 30 days? War-tested deployment under pressure. Evidence package + remediation in 14 days.',
    features: [
      'Everything in Readiness Diagnostic',
      'Priority 14-day delivery timeline',
      'Daily remediation check-ins',
      'Failure-mode recovery protocol included',
      'Direct founder engagement throughout',
    ],
    cta: 'Request Urgent Assessment',
    ctaAction: 'advisory',
    note: '1 slot available per month',
  },
] as const;

const SELF_SERVE = [
  {
    id: 'free',
    name: 'Scan',
    price: '$0',
    description: "Scan any AI agent deployment. See what's exposed.",
    features: ['Unlimited scans', 'Exposure report', 'Basic risk score', 'Community support'],
    cta: 'Run Free Scan',
    ctaAction: 'scan',
    highlight: false,
  },
  {
    id: 'certify',
    name: 'Certify',
    price: '$99',
    priceSuffix: '/attestation',
    description:
      'Full compliance audit + ADINKHEPRA certification for your AI agent deployment.',
    features: [
      'Everything in Scan',
      'Full NIST/STIG audit',
      'ADINKHEPRA badge (PDF + API)',
      'Shareable attestation report',
      'Email support',
    ],
    cta: 'Get Certified',
    ctaAction: 'checkout',
    highlight: true,
  },
] as const;

const ShieldIcon = () => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const CheckIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const LockIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const ArrowIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

export default function SimpleBilling() {
  const navigate = useNavigate();
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const handleAdvisory = () => {
    // Mirrors the existing enterprise contact intent.
    window.location.href =
      'mailto:skone@alumni.albany.edu?subject=ASAF%20Request%20Assessment';
  };

  const handleCheckout = async () => {
    setCheckoutLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else throw new Error(data.error || 'Checkout unavailable');
    } catch (e: any) {
      // Avoid bringing toast infrastructure into this pure inline-styles page.
      alert(e?.message || 'Checkout error');
      setCheckoutLoading(false);
    }
  };

  const handleSelfServeCTA = (ctaAction: string) => {
    if (ctaAction === 'scan') return navigate('/onboarding');
    if (ctaAction === 'checkout') return handleCheckout();
    return undefined;
  };

  const handleEnterpriseCTA = (ctaAction: string) => {
    if (ctaAction === 'advisory') return handleAdvisory();
    return undefined;
  };

  return (
    <div style={styles.page}>
      {/* Subtle grid background */}
      <div style={styles.gridBg} />

      {/* Top trust bar */}
      <div style={styles.trustBar}>
        <span style={styles.trustItem}>
          <LockIcon /> Patent-Pending PQC Attestation (USPTO #73565085)
        </span>
        <span style={styles.trustDivider}>|</span>
        <span style={styles.trustItem}>SDVOSB Verified</span>
        <span style={styles.trustDivider}>|</span>
        <span style={styles.trustItem}>ML-KEM-1024 Lattice Cryptography</span>
      </div>

      {/* Hero */}
      <header style={styles.hero}>
        <div style={styles.logoRow}>
          <ShieldIcon />
          <span style={styles.logoText}>ASAF</span>
          <span style={styles.logoSub}>by NouchiX</span>
        </div>
        <h1 style={styles.heroTitle}>
          Compliance becomes proof.
          <br />
          <span style={styles.heroAccent}>
            Proof that passes audits under pressure.
          </span>
        </h1>
        <p style={styles.heroSub}>
          Agentic Security Attestation Framework — cryptographic evidence your C3PAO can
          verify on the spot.
        </p>
      </header>

      {/* Enterprise section — ABOVE THE FOLD */}
      <section style={styles.enterpriseSection}>
        <div style={styles.sectionLabel}>
          <div style={styles.labelLine} />
          <span style={styles.labelText}>CMMC &amp; DEFENSE INDUSTRIAL BASE</span>
          <div style={styles.labelLine} />
        </div>

        <div style={styles.enterpriseGrid}>
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              style={{
                ...styles.enterpriseCard,
                ...(plan.headline ? styles.headlineCard : {}),
                ...(hoveredPlan === plan.id ? styles.cardHover : {}),
              }}
              onMouseEnter={() => setHoveredPlan(plan.id)}
              onMouseLeave={() => setHoveredPlan(null)}
            >
              <div style={styles.cardBadgeRow}>
                <span
                  style={{
                    ...styles.badge,
                    ...(plan.badge === 'URGENT' ? styles.badgeUrgent : styles.badgeAdvisory),
                  }}
                >
                  {plan.badge}
                </span>
                {plan.note && <span style={styles.cardNote}>{plan.note}</span>}
              </div>

              <h3 style={styles.cardName}>{plan.name}</h3>

              <div style={styles.priceRow}>
                <span style={styles.price}>{plan.price}</span>
                <span style={styles.priceSuffix}>{plan.priceSuffix}</span>
              </div>

              <p style={styles.cardDesc}>{plan.description}</p>

              <ul style={styles.featureList}>
                {plan.features.map((f, i) => (
                  <li key={i} style={styles.featureItem}>
                    <span style={styles.checkWrap}>
                      <CheckIcon />
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                style={{
                  ...styles.ctaButton,
                  ...(plan.headline ? styles.ctaPrimary : styles.ctaSecondary),
                }}
                onClick={() => handleEnterpriseCTA(plan.ctaAction)}
                type="button"
              >
                {plan.cta}
                <ArrowIcon />
              </button>
            </div>
          ))}
        </div>

        {/* ROI anchor */}
        <div style={styles.roiBar}>
          <div style={styles.roiItem}>
            <span style={styles.roiValue}>$20k–$80k</span>
            <span style={styles.roiLabel}>Typical C3PAO assessment fee</span>
          </div>
          <div style={styles.roiDivider} />
          <div style={styles.roiItem}>
            <span style={styles.roiValue}>$150k/yr</span>
            <span style={styles.roiLabel}>Average compliance consulting retainer</span>
          </div>
          <div style={styles.roiDivider} />
          <div style={styles.roiItem}>
            <span style={styles.roiValue}>40%</span>
            <span style={styles.roiLabel}>First-attempt CMMC assessment failure rate</span>
          </div>
          <div style={styles.roiDivider} />
          <div style={styles.roiItem}>
            <span style={styles.roiValue}>$5,000</span>
            <span style={styles.roiLabel}>ASAF Readiness Diagnostic — 10–15x ROI</span>
          </div>
        </div>
      </section>

      {/* Divider with agent market transition */}
      <section style={styles.agentSection}>
        <div style={styles.sectionLabel}>
          <div style={styles.labelLine} />
          <span style={styles.labelText}>AI AGENT SECURITY</span>
          <div style={styles.labelLine} />
        </div>

        <p style={styles.agentIntro}>
          Deploying AI agents with NemoClaw, LangChain, or custom orchestration?
          <br />
          Scan your deployment. Know what's exposed. Certify when you're ready.
        </p>

        <div style={styles.agentGrid}>
          {SELF_SERVE.map((plan) => (
            <div
              key={plan.id}
              style={{
                ...styles.agentCard,
                ...(plan.highlight ? styles.agentHighlight : {}),
                ...(hoveredPlan === plan.id ? styles.agentCardHover : {}),
              }}
              onMouseEnter={() => setHoveredPlan(plan.id)}
              onMouseLeave={() => setHoveredPlan(null)}
            >
              <h3 style={styles.agentCardName}>{plan.name}</h3>
              <div style={styles.priceRow}>
                <span style={styles.agentPrice}>{plan.price}</span>
                {'priceSuffix' in plan && plan.priceSuffix ? (
                  <span style={styles.agentPriceSuffix}>{(plan as any).priceSuffix}</span>
                ) : null}
              </div>
              <p style={styles.agentCardDesc}>{plan.description}</p>
              <ul style={styles.featureList}>
                {plan.features.map((f, i) => (
                  <li key={i} style={styles.featureItemLight}>
                    <span style={styles.checkWrapLight}>
                      <CheckIcon />
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                style={{
                  ...styles.ctaButton,
                  ...(plan.highlight ? styles.ctaAgent : styles.ctaAgentOutline),
                }}
                onClick={() => handleSelfServeCTA(plan.ctaAction)}
                type="button"
                disabled={plan.ctaAction === 'checkout' && checkoutLoading}
              >
                {plan.ctaAction === 'checkout' && checkoutLoading ? 'Redirecting...' : plan.cta}
                <ArrowIcon />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Enterprise CTA */}
      <section style={styles.bottomCta}>
        <p style={styles.bottomCtaText}>Prime contractor? C3PAO looking to reduce failed assessments?</p>
          <button
          style={{ ...styles.ctaButton, ...styles.ctaPrimary, maxWidth: 320 }}
          onClick={handleAdvisory}
          type="button"
        >
          Book Advisory Call
          <ArrowIcon />
        </button>
      </section>

      {/* Footer */}
      <footer style={styles.footer}>
        <div style={styles.footerInner}>
          <span style={styles.footerBrand}>
            <ShieldIcon /> ASAF — Agentic Security Attestation Framework
          </span>
          <span style={styles.footerRight}>SecRed Knowledge Inc. (NouchiX) · SDVOSB · Albany, NY</span>
        </div>
        <div style={{ textAlign: 'center', marginTop: 10, fontSize: 11, color: '#5c6478' }}>
          <a href="https://nouchix.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#5c6478', textDecoration: 'underline', marginRight: 16 }}>Privacy Policy</a>
          <a href="https://nouchix.com/terms" target="_blank" rel="noopener noreferrer" style={{ color: '#5c6478', textDecoration: 'underline', marginRight: 16 }}>Terms of Service</a>
          <a href="mailto:security@nouchix.com" style={{ color: '#5c6478', textDecoration: 'underline' }}>security@nouchix.com</a>
        </div>
      </footer>
    </div>
  );
}

/* ── Styles ────────────────────────────────────────────────── */

const palette = {
  bg: '#0a0c10',
  surface: '#12151c',
  surfaceRaised: '#181c26',
  border: '#1e2433',
  borderLight: '#2a3044',
  text: '#e2e5ec',
  textMuted: '#8891a5',
  textDim: '#5c6478',
  accent: '#c9a227',
  accentDim: 'rgba(201,162,39,0.12)',
  accentGlow: 'rgba(201,162,39,0.25)',
  urgent: '#d94f4f',
  urgentDim: 'rgba(217,79,79,0.12)',
  agentAccent: '#3b8beb',
  agentDim: 'rgba(59,139,235,0.10)',
  white: '#ffffff',
};

const font = {
  display: "'DM Serif Display', 'Playfair Display', Georgia, serif",
  body: "'IBM Plex Sans', 'SF Pro Text', -apple-system, sans-serif",
  mono: "'IBM Plex Mono', 'SF Mono', monospace",
};

const styles: any = {
  page: {
    position: 'relative',
    minHeight: '100vh',
    background: palette.bg,
    color: palette.text,
    fontFamily: font.body,
    fontSize: 15,
    lineHeight: 1.6,
    overflowX: 'hidden',
  },
  gridBg: {
    position: 'fixed',
    inset: 0,
    backgroundImage: `
      linear-gradient(${palette.border}22 1px, transparent 1px),
      linear-gradient(90deg, ${palette.border}22 1px, transparent 1px)
    `,
    backgroundSize: '64px 64px',
    pointerEvents: 'none',
    zIndex: 0,
  },

  trustBar: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: '12px 24px',
    background: palette.surface,
    borderBottom: `1px solid ${palette.border}`,
    fontFamily: font.mono,
    fontSize: 11,
    letterSpacing: '0.06em',
    color: palette.textMuted,
    flexWrap: 'wrap',
    textTransform: 'uppercase',
  },
  trustItem: { display: 'flex', alignItems: 'center', gap: 6 },
  trustDivider: { color: palette.textDim },

  hero: {
    position: 'relative',
    zIndex: 1,
    textAlign: 'center',
    padding: '72px 24px 48px',
    maxWidth: 800,
    margin: '0 auto',
  },
  logoRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 32, color: palette.accent },
  logoText: { fontFamily: font.display, fontSize: 28, letterSpacing: '0.08em', color: palette.white },
  logoSub: { fontSize: 13, color: palette.textMuted, fontFamily: font.mono, letterSpacing: '0.04em' },
  heroTitle: {
    fontFamily: font.display,
    fontSize: 'clamp(28px, 4.5vw, 48px)',
    fontWeight: 400,
    lineHeight: 1.2,
    margin: '0 0 20px',
    color: palette.white,
  },
  heroAccent: { color: palette.accent },
  heroSub: { fontSize: 17, color: palette.textMuted, maxWidth: 600, margin: '0 auto', lineHeight: 1.7 },

  enterpriseSection: { position: 'relative', zIndex: 1, padding: '32px 24px 48px' },
  sectionLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    marginBottom: 40,
    maxWidth: 960,
    margin: '0 auto 40px',
    padding: '0 24px',
  },
  labelLine: { flex: 1, height: 1, background: palette.border },
  labelText: { fontFamily: font.mono, fontSize: 11, letterSpacing: '0.14em', color: palette.textDim, whiteSpace: 'nowrap' },

  enterpriseGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
    gap: 24,
    maxWidth: 960,
    margin: '0 auto',
  },
  enterpriseCard: {
    background: palette.surface,
    border: `1px solid ${palette.border}`,
    borderRadius: 12,
    padding: '32px 28px',
    display: 'flex',
    flexDirection: 'column',
    transition: 'border-color 0.25s, box-shadow 0.25s',
  },
  headlineCard: {
    border: `1px solid ${palette.accent}44`,
    boxShadow: `0 0 40px ${palette.accentDim}, inset 0 1px 0 ${palette.accent}22`,
  },
  cardHover: {
    borderColor: `${palette.accent}66`,
    boxShadow: `0 0 60px ${palette.accentGlow}`,
  },
  cardBadgeRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  badge: { fontFamily: font.mono, fontSize: 10, letterSpacing: '0.12em', padding: '4px 10px', borderRadius: 4, fontWeight: 600 },
  badgeAdvisory: { background: palette.accentDim, color: palette.accent },
  badgeUrgent: { background: palette.urgentDim, color: palette.urgent },
  cardNote: { fontSize: 12, color: palette.textDim, fontFamily: font.mono, fontStyle: 'italic' },
  cardName: { fontFamily: font.display, fontSize: 26, fontWeight: 400, color: palette.white, margin: '0 0 12px' },
  priceRow: { display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16 },
  price: { fontFamily: font.display, fontSize: 38, color: palette.white, letterSpacing: '-0.02em' },
  priceSuffix: { fontSize: 14, color: palette.textMuted },
  cardDesc: { color: palette.textMuted, marginBottom: 24, lineHeight: 1.65, fontSize: 14 },
  featureList: { listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 },
  featureItem: { display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14, color: palette.text, lineHeight: 1.5 },
  checkWrap: { color: palette.accent, flexShrink: 0, marginTop: 2 },

  ctaButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    padding: '14px 24px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    fontFamily: font.body,
    cursor: 'pointer',
    border: 'none',
    transition: 'all 0.2s',
    letterSpacing: '0.02em',
  },
  ctaPrimary: {
    background: `linear-gradient(135deg, ${palette.accent}, #b08d1f)`,
    color: '#0a0c10',
    boxShadow: `0 4px 20px ${palette.accentDim}`,
  },
  ctaSecondary: { background: 'transparent', color: palette.accent, border: `1px solid ${palette.accent}55` },

  roiBar: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 32,
    maxWidth: 960,
    margin: '48px auto 0',
    padding: '28px 24px',
    background: palette.surfaceRaised,
    border: `1px solid ${palette.border}`,
    borderRadius: 10,
    flexWrap: 'wrap',
  },
  roiItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, textAlign: 'center' },
  roiValue: { fontFamily: font.display, fontSize: 22, color: palette.white },
  roiLabel: { fontSize: 11, color: palette.textDim, fontFamily: font.mono, letterSpacing: '0.02em', maxWidth: 160 },
  roiDivider: { width: 1, height: 40, background: palette.border },

  agentSection: { position: 'relative', zIndex: 1, padding: '64px 24px 48px' },
  agentIntro: { textAlign: 'center', color: palette.textMuted, maxWidth: 560, margin: '-16px auto 40px', fontSize: 15, lineHeight: 1.7 },
  agentGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, maxWidth: 680, margin: '0 auto' },
  agentCard: { background: palette.surface, border: `1px solid ${palette.border}`, borderRadius: 10, padding: '28px 24px', display: 'flex', flexDirection: 'column', transition: 'border-color 0.25s' },
  agentHighlight: { border: `1px solid ${palette.agentAccent}33`, boxShadow: `0 0 30px ${palette.agentDim}` },
  agentCardHover: { borderColor: `${palette.agentAccent}55` },
  agentCardName: { fontFamily: font.display, fontSize: 22, color: palette.white, margin: '0 0 8px' },
  agentPrice: { fontFamily: font.display, fontSize: 32, color: palette.white },
  agentPriceSuffix: { fontSize: 13, color: palette.textMuted },
  agentCardDesc: { color: palette.textMuted, fontSize: 13, marginBottom: 20, lineHeight: 1.6 },
  featureItemLight: { display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: palette.textMuted, lineHeight: 1.5 },
  checkWrapLight: { color: palette.agentAccent, flexShrink: 0, marginTop: 2 },
  ctaAgent: { background: palette.agentAccent, color: palette.white, boxShadow: `0 4px 20px ${palette.agentDim}` },
  ctaAgentOutline: { background: 'transparent', color: palette.agentAccent, border: `1px solid ${palette.agentAccent}44` },

  bottomCta: { position: 'relative', zIndex: 1, textAlign: 'center', padding: '48px 24px 64px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 },
  bottomCtaText: { fontFamily: font.display, fontSize: 20, color: palette.textMuted },

  footer: { position: 'relative', zIndex: 1, borderTop: `1px solid ${palette.border}`, padding: '20px 24px' },
  footerInner: {
    maxWidth: 960,
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  footerBrand: { display: 'flex', alignItems: 'center', gap: 8, color: palette.textDim, fontSize: 13 },
  footerRight: { fontSize: 12, color: palette.textDim, fontFamily: font.mono },
};
