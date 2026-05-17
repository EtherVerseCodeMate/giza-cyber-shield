
import { useEffect, useState } from 'react';
import { ConsoleLayout } from '@/components/console/ConsoleLayout';
import { DashboardToggle } from '@/components/DashboardToggle';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CreditCard, TrendingUp, Download, Clock, Shield, Award, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const ASAF_API = (import.meta as any).env?.VITE_ASAF_API_URL
  ?? process.env.NEXT_PUBLIC_ASAF_API_URL
  ?? '';
const ASAF_KEY = (import.meta as any).env?.VITE_ASAF_API_KEY
  ?? process.env.NEXT_PUBLIC_ASAF_API_KEY
  ?? '';

const PLANS = [
  {
    name: 'Scout',
    price: '$0',
    description: "ASAF Flight Recorder for your AI agents. Monitor MCP tool calls and detect drift — free forever.",
    features: [
      'Unlimited ASAF session recording',
      'MCP tool call interception (Claude, Cursor, Copilot)',
      'DAG audit trail (local)',
      'Basic drift detection alerts',
      'Community support',
    ],
    cta: 'Start Recording',
    ctaVariant: 'outline' as const,
    highlight: false,
    action: 'free' as const,
  },
  {
    name: 'Sentinel',
    price: '$49',
    description: 'PQC-signed flight recording with Dilithium3 signatures on every AI action. Tamper-evident audit trails.',
    features: [
      'Everything in Scout',
      'ML-DSA-65 signed DAG nodes',
      'Prompt injection scanning (6 patterns)',
      'Real-time SSE event streaming',
      'Behavioral anomaly scoring',
      'ADINKHEPRA attestation seal',
      'Email support',
    ],
    cta: 'Upgrade to Sentinel',
    ctaVariant: 'default' as const,
    highlight: true,
    action: 'checkout' as const,
  },
  {
    name: 'Phantom',
    price: '$299',
    description: 'Full PQC edge deployment — Phantom Nodes on your hardware. Air-gapped, sovereign, HSM-ready.',
    features: [
      'Everything in Sentinel',
      'Phantom Node edge deployment (Raspberry Pi / ARM)',
      'Automatic PQC key rotation (Kyber-1024 + Dilithium3)',
      'Air-gap / offline mode',
      'Custom Adinkra symbol addressing',
      'Up to 10 team seats',
      'Priority support + Slack channel',
    ],
    cta: 'Deploy Phantom Node',
    ctaVariant: 'outline' as const,
    highlight: false,
    action: 'contact' as const,
  },
];

interface UsageStats {
  scansTotal: number | null;
  dagNodes: number | null;
  licenseScore: number | null;
  loading: boolean;
  error: string | null;
}

async function fetchUsageStats(): Promise<{ scansTotal: number; dagNodes: number; licenseScore: number | null }> {
  if (!ASAF_API) throw new Error('NEXT_PUBLIC_ASAF_API_URL is not configured');

  const headers: HeadersInit = ASAF_KEY ? { Authorization: ASAF_KEY } : {};

  const [scansRes, healthRes] = await Promise.all([
    fetch(`${ASAF_API}/api/v1/scans?page=1&page_size=1`, { headers }),
    fetch(`${ASAF_API}/health`, { headers }),
  ]);

  if (!scansRes.ok) throw new Error(`Scans API ${scansRes.status}`);
  if (!healthRes.ok) throw new Error(`Health API ${healthRes.status}`);

  const scansData = await scansRes.json();
  const healthData = await healthRes.json();

  return {
    scansTotal: scansData.total ?? 0,
    dagNodes: healthData.dag_nodes ?? 0,
    licenseScore: null, // No score endpoint yet — hide until available
  };
}

const SimpleBilling = () => {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<UsageStats>({
    scansTotal: null,
    dagNodes: null,
    licenseScore: null,
    loading: true,
    error: null,
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchUsageStats()
      .then(data => setStats({ scansTotal: data.scansTotal, dagNodes: data.dagNodes, licenseScore: data.licenseScore, loading: false, error: null }))
      .catch(err => setStats(s => ({ ...s, loading: false, error: err.message })));
  }, []);

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Checkout unavailable');
      }
    } catch (e: any) {
      toast({ title: 'Checkout error', description: e.message, variant: 'destructive' });
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'asset-scanning', title: 'Scan', path: '/asset-scanning' },
    { id: 'compliance-reports', title: 'Reports', path: '/compliance-reports' },
    { id: 'billing', title: 'Billing', path: '/billing', isActive: true },
  ];

  const statCell = (value: number | null, suffix = '') => {
    if (stats.loading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
    if (value === null || stats.error) return <span className="text-2xl font-bold text-muted-foreground">—</span>;
    return <p className="text-2xl font-bold text-foreground">{value.toLocaleString()}{suffix}</p>;
  };

  return (
    <ConsoleLayout
      currentSection="billing"
      browserNav={{
        title: 'Plans & Billing',
        subtitle: 'SouHimBou.ai — PQC-MCP Flight Recorder for AI Agents',
        tabs,
        showAddTab: false,
        rightContent: <DashboardToggle />
      }}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Plans & Billing</h1>
            <p className="text-muted-foreground">Security camera + flight recorder for AI agents. Every MCP tool call, signed and sealed.</p>
          </div>
        </div>

        {/* Pricing Plans */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <Card key={plan.name} className={plan.highlight ? 'border-primary ring-1 ring-primary' : ''}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{plan.name}</span>
                  {plan.highlight && (
                    <Badge className="bg-primary/20 text-primary border-primary/30">
                      Most Popular
                    </Badge>
                  )}
                </CardTitle>
                <div className="text-3xl font-bold">{plan.price}<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-muted-foreground">
                      <Shield className="h-3.5 w-3.5 text-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={plan.ctaVariant}
                  className="w-full"
                  disabled={plan.action === 'checkout' && loading}
                  onClick={() => {
                    if (plan.action === 'checkout') handleCheckout();
                    if (plan.action === 'contact') window.location.href = '/advisory';
                  }}
                >
                  {plan.action === 'checkout' && loading ? 'Redirecting...' : plan.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ADINKHEPRA badge callout */}
        <Card className="border-cyan-500/30 bg-cyan-950/10">
          <CardContent className="p-6 flex items-center gap-4">
            <Award className="h-10 w-10 text-cyan-400 shrink-0" />
            <div>
              <div className="font-semibold text-cyan-400">What is the ASAF Flight Recorder?</div>
              <p className="text-sm text-muted-foreground">
                Every MCP tool call from Claude, Cursor, Copilot, or custom agents is intercepted and recorded as an immutable,
                Dilithium3-signed DAG node. Drift detection flags behavioral anomalies in real-time. Your AI agents now have a black box.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Usage Summary — live from backend */}
        {stats.error && (
          <p className="text-xs text-red-400 font-mono">Usage stats unavailable: {stats.error}</p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Scans Run</p>
                  {statCell(stats.scansTotal)}
                  <p className="text-xs text-muted-foreground mt-1">total in your org</p>
                </div>
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">DAG Audit Nodes</p>
                  {statCell(stats.dagNodes)}
                  <p className="text-xs text-muted-foreground mt-1">immutable audit records</p>
                </div>
                <Clock className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Billing History — empty state until Stripe webhooks populate real invoices */}
        <Card>
          <CardHeader>
            <CardTitle>Billing History</CardTitle>
            <CardDescription>Invoices issued after your first payment will appear here.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <CreditCard className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No invoices yet.</p>
              <p className="text-xs text-muted-foreground/60">
                Upgrade to Certify to generate your first invoice. Invoices are delivered by Stripe and stored here automatically.
              </p>
              <Button variant="outline" size="sm" onClick={handleCheckout} disabled={loading}>
                <Download className="h-3.5 w-3.5 mr-2" />
                {loading ? 'Redirecting...' : 'Get Certify Plan'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </ConsoleLayout>
  );
};

export default SimpleBilling;
