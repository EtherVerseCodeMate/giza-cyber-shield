
import { ConsoleLayout } from '@/components/console/ConsoleLayout';
import { DashboardToggle } from '@/components/DashboardToggle';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CreditCard, TrendingUp, Download, Clock, Shield, Award } from 'lucide-react';

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    description: 'Scan any AI agent deployment. Get your exposure report.',
    features: ['Unlimited scans', 'Exposure report', 'Basic risk score', 'Community support'],
    cta: 'Current Plan',
    ctaVariant: 'outline' as const,
    highlight: false,
  },
  {
    name: 'Certify',
    price: '$99',
    description: 'Full compliance audit + ADINKHEPRA certification badge.',
    features: ['Everything in Free', 'Full NIST/STIG audit', 'ADINKHEPRA badge (PDF + API)', 'Shareable attestation report', 'Email support'],
    cta: 'Upgrade to Certify',
    ctaVariant: 'default' as const,
    highlight: true,
    stripeLink: '#stripe-certify',
  },
  {
    name: 'Enterprise',
    price: '$499',
    description: 'Continuous monitoring + attestation API + team seats.',
    features: ['Everything in Certify', 'Continuous monitoring', 'Attestation API access', 'Up to 10 team seats', 'Priority support', 'Custom compliance frameworks'],
    cta: 'Contact Sales',
    ctaVariant: 'outline' as const,
    highlight: false,
  },
];

const SimpleBilling = () => {
  const tabs = [
    { id: 'asset-scanning', title: 'Scan', path: '/asset-scanning' },
    { id: 'compliance-reports', title: 'Reports', path: '/compliance-reports' },
    { id: 'billing', title: 'Billing', path: '/billing', isActive: true },
  ];

  return (
    <ConsoleLayout
      currentSection="billing"
      browserNav={{
        title: 'Plans & Billing',
        subtitle: 'ASAF by NouchiX — Agentic Security Attestation Framework',
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
            <p className="text-muted-foreground">One price. One sell point. Earn your ADINKHEPRA certification.</p>
          </div>
          <Button variant="outline" className="flex items-center space-x-2">
            <Download className="h-4 w-4" />
            <span>Download Invoice</span>
          </Button>
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
                  onClick={() => plan.stripeLink && window.open(plan.stripeLink, '_blank')}
                >
                  {plan.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ADINKHEPRA badge callout */}
        <Card className="border-yellow-500/30 bg-yellow-950/10">
          <CardContent className="p-6 flex items-center gap-4">
            <Award className="h-10 w-10 text-yellow-400 shrink-0" />
            <div>
              <div className="font-semibold text-yellow-400">What is the ADINKHEPRA badge?</div>
              <p className="text-sm text-muted-foreground">
                A post-quantum cryptographic attestation seal issued by ASAF. Tamper-proof, timestamped, and verifiable by auditors, customers, and insurers.
                Think SOC2 — but automated, continuous, and built for agentic AI.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Usage Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Assets Scanned</p>
                  <p className="text-2xl font-bold text-foreground">42</p>
                  <p className="text-xs text-green-400">+8 this month</p>
                </div>
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">STIG Rules Checked</p>
                  <p className="text-2xl font-bold text-foreground">1,247</p>
                  <p className="text-xs text-blue-400">automated</p>
                </div>
                <Clock className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Reports Generated</p>
                  <p className="text-2xl font-bold text-foreground">15</p>
                  <p className="text-xs text-purple-400">this month</p>
                </div>
                <Download className="h-8 w-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Compliance Score</p>
                  <p className="text-2xl font-bold text-green-400">87%</p>
                  <p className="text-xs text-green-400">improving</p>
                </div>
                <CreditCard className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Billing History */}
        <Card>
          <CardHeader>
            <CardTitle>Billing History</CardTitle>
            <CardDescription>
              Recent invoices and payment history
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { date: '2024-01-01', amount: '$299.00', status: 'paid', period: 'Jan 2024' },
                { date: '2023-12-01', amount: '$299.00', status: 'paid', period: 'Dec 2023' },
                { date: '2023-11-01', amount: '$299.00', status: 'paid', period: 'Nov 2023' },
              ].map((invoice, index) => (
                <div key={index} className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <span className="font-medium text-foreground">Invoice for {invoice.period}</span>
                      <Badge 
                        variant="outline" 
                        className="bg-green-500/20 text-green-400 border-green-500/30"
                      >
                        {invoice.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">Billed on {invoice.date}</p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="font-medium text-foreground">{invoice.amount}</span>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </ConsoleLayout>
  );
};

export default SimpleBilling;