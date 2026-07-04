/**
 * OmnibusConnectorHub.tsx
 * SouHimBou AI — KHEPRA Adaptive API Fabric UI
 *
 * Production-grade Integration Hub wired to the omnibus-connector edge function.
 * Replaces the placeholder "industry" and "polymorphic" tabs with a full
 * Palantir-style connector management surface.
 *
 * Sections:
 *   Overview      → health KPIs + usage metering + EA fitness heatmap
 *   Connectors    → list of registered connectors with real-time health
 *   Add New       → catalog browser + registration wizard
 *   LLM Inference → direct chat/completion surface for registered LLM connectors
 *   Schema Lab    → EA fitness view + manual schema map editor + learn trigger
 *
 * Author: SecRed Knowledge Inc. / NouchiX
 * IP: SOUHIMBOU DOH KONE LLC, exclusively licensed to SecRed Knowledge Inc.
 */

import { useState, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Plug, Zap, Brain, FlaskConical, Activity, CheckCircle, AlertCircle,
  Clock, Wifi, WifiOff, Plus, Play, RefreshCw, Trash2, TestTube2,
  Shield, Database, Cloud, Bot, Eye, Key, Send, ChevronRight,
  TrendingUp, DollarSign, Cpu, Globe, Lock, Sparkles, Settings2
} from 'lucide-react';
import {
  useOmnibusConnector,
  ConnectorProfile,
  ConnectorDefinition,
  ConnectorCategory,
  RegisterConnectorInput,
} from '@/hooks/useOmnibusConnector';

// ── Category metadata ─────────────────────────────────────────────────────────
const CATEGORY_META: Record<ConnectorCategory, { label: string; icon: any; color: string; bg: string }> = {
  siem:         { label: 'SIEM',         icon: Database,  color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20' },
  soar:         { label: 'SOAR',         icon: Zap,       color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
  edr:          { label: 'EDR',          icon: Shield,    color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20' },
  cloud:        { label: 'Cloud',        icon: Cloud,     color: 'text-sky-400',    bg: 'bg-sky-500/10 border-sky-500/20' },
  iam:          { label: 'IAM',          icon: Lock,      color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  threat_intel: { label: 'Threat Intel', icon: Eye,       color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
  llm:          { label: 'AI / LLM',     icon: Bot,       color: 'text-emerald-400',bg: 'bg-emerald-500/10 border-emerald-500/20' },
  custom:       { label: 'Custom',       icon: Globe,     color: 'text-slate-400',  bg: 'bg-slate-500/10 border-slate-500/20' },
};

// ── Health badge ──────────────────────────────────────────────────────────────
function HealthBadge({ status }: { status: ConnectorProfile['health_status'] }) {
  const map = {
    healthy:      { color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', icon: <CheckCircle className="w-3 h-3" />, label: 'Healthy' },
    degraded:     { color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',    icon: <AlertCircle className="w-3 h-3" />, label: 'Degraded' },
    disconnected: { color: 'bg-red-500/20 text-red-300 border-red-500/30',             icon: <WifiOff className="w-3 h-3" />,     label: 'Down' },
    auth_error:   { color: 'bg-red-500/20 text-red-300 border-red-500/30',             icon: <Key className="w-3 h-3" />,         label: 'Auth Error' },
    pending:      { color: 'bg-slate-500/20 text-slate-400 border-slate-500/30',       icon: <Clock className="w-3 h-3" />,       label: 'Pending' },
  };
  const m = map[status] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${m.color}`}>
      {m.icon}{m.label}
    </span>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ title, value, sub, icon: Icon, color }: {
  title: string; value: string | number; sub?: string; icon: any; color: string;
}) {
  return (
    <Card className="bg-slate-900/60 border-slate-800/60 backdrop-blur">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{title}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
            {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
          </div>
          <div className={`p-2 rounded-lg ${color.replace('text-', 'bg-').replace('-400', '-500/15')}`}>
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Overview tab ──────────────────────────────────────────────────────────────
function OverviewTab() {
  const { connectors, connectorSummary, usage, isRefetching } = useOmnibusConnector();

  const healthScore = connectors.length > 0
    ? Math.round((connectorSummary?.healthy ?? 0) / connectors.length * 100) : 0;
  const avgFitness = connectors.length > 0
    ? Math.round(connectors.reduce((a, c) => a + c.fitness_score, 0) / connectors.length * 100) : 0;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Total Connectors" value={connectors.length} sub="registered endpoints" icon={Plug} color="text-cyan-400" />
        <KpiCard title="Healthy" value={connectorSummary?.healthy ?? 0} sub="responding normally" icon={CheckCircle} color="text-emerald-400" />
        <KpiCard title="Connector Health" value={`${healthScore}%`} sub="of registered connectors" icon={Activity} color={healthScore > 80 ? 'text-emerald-400' : healthScore > 50 ? 'text-yellow-400' : 'text-red-400'} />
        <KpiCard title="EA Fitness" value={`${avgFitness}%`} sub="avg schema coverage" icon={Brain} color="text-purple-400" />
      </div>

      {/* Usage metering (if license key auth) */}
      {usage && usage.today && (
        <Card className="bg-slate-900/60 border-slate-800/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" /> Today's Usage
              <Badge variant="outline" className="ml-auto text-xs">{usage.tier}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
              {[
                { label: 'API Calls', value: usage.today.calls.toLocaleString(), icon: Zap, color: 'text-cyan-400' },
                { label: 'Calls/Hour', value: usage.calls_this_hour, icon: Activity, color: 'text-blue-400' },
                { label: 'LLM Tokens In', value: (usage.today.tokens_in / 1000).toFixed(1) + 'k', icon: Brain, color: 'text-purple-400' },
                { label: 'LLM Tokens Out', value: (usage.today.tokens_out / 1000).toFixed(1) + 'k', icon: Sparkles, color: 'text-pink-400' },
                { label: 'LLM Cost', value: `$${usage.today.cost_usd.toFixed(4)}`, icon: DollarSign, color: 'text-emerald-400' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="space-y-1">
                  <Icon className={`w-4 h-4 ${color} mx-auto`} />
                  <p className={`text-lg font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connector health list */}
      <Card className="bg-slate-900/60 border-slate-800/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Wifi className="w-4 h-4 text-slate-400" />
            Connector Health Matrix
            {isRefetching && <RefreshCw className="w-3 h-3 text-slate-500 animate-spin ml-auto" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {connectors.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Plug className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No connectors registered yet.</p>
              <p className="text-xs mt-1">Use the "Add Connector" tab to connect your first tool.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {connectors.map(c => {
                const meta = CATEGORY_META[c.category] ?? CATEGORY_META.custom;
                return (
                  <div key={c.id} className={`flex items-center gap-3 p-3 rounded-lg border ${meta.bg} transition-all`}>
                    <meta.icon className={`w-4 h-4 ${meta.color} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">{c.name}</span>
                        <Badge variant="outline" className={`text-xs ${meta.color} border-current/30`}>{meta.label}</Badge>
                      </div>
                      <span className="text-xs text-slate-500">{c.connector_type}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {c.recent_schema_coverage != null && (
                        <div className="text-right hidden md:block">
                          <p className="text-xs text-slate-400">Schema</p>
                          <p className="text-xs font-medium text-white">{Math.round(c.recent_schema_coverage * 100)}%</p>
                        </div>
                      )}
                      <HealthBadge status={c.health_status} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Connectors tab ────────────────────────────────────────────────────────────
function ConnectorsTab() {
  const { connectors, test, isTesting, testingId, pull, isPulling, learnSchema, deleteConnector } = useOmnibusConnector();
  const [pullResults, setPullResults] = useState<Record<string, any>>({});

  const handlePull = async (id: string) => {
    const result = await pull({ connector_id: id, limit: 10 });
    setPullResults(r => ({ ...r, [id]: result }));
  };

  if (connectors.length === 0) {
    return (
      <Card className="bg-slate-900/60 border-slate-800/60 p-12 text-center">
        <Plug className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white">No connectors yet</h3>
        <p className="text-slate-400 text-sm mt-1">Head to "Add Connector" to register your first integration.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {connectors.map(c => {
        const meta = CATEGORY_META[c.category] ?? CATEGORY_META.custom;
        const pullResult = pullResults[c.id];
        return (
          <Card key={c.id} className="bg-slate-900/60 border-slate-800/60 backdrop-blur overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${meta.bg} border`}>
                    <meta.icon className={`w-4 h-4 ${meta.color}`} />
                  </div>
                  <div>
                    <CardTitle className="text-base">{c.name}</CardTitle>
                    <CardDescription className="text-xs">{c.connector_type} · {c.base_url || 'No base URL'}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <HealthBadge status={c.health_status} />
                  <Badge variant={c.status === 'active' ? 'default' : 'secondary'} className="text-xs">{c.status}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-2 rounded bg-slate-800/50">
                  <p className="text-xs text-slate-500">EA Fitness</p>
                  <p className="text-sm font-bold text-white">{Math.round(c.fitness_score * 100)}%</p>
                  <Progress value={c.fitness_score * 100} className="h-1 mt-1" />
                </div>
                <div className="text-center p-2 rounded bg-slate-800/50">
                  <p className="text-xs text-slate-500">Success Rate</p>
                  <p className="text-sm font-bold text-white">{c.recent_success_rate != null ? Math.round(c.recent_success_rate * 100) + '%' : '—'}</p>
                  <Progress value={(c.recent_success_rate ?? 0) * 100} className="h-1 mt-1" />
                </div>
                <div className="text-center p-2 rounded bg-slate-800/50">
                  <p className="text-xs text-slate-500">Schema Coverage</p>
                  <p className="text-sm font-bold text-white">{c.recent_schema_coverage != null ? Math.round(c.recent_schema_coverage * 100) + '%' : '—'}</p>
                  <Progress value={(c.recent_schema_coverage ?? 0) * 100} className="h-1 mt-1" />
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm" variant="outline"
                  className="border-slate-700 hover:border-cyan-500 hover:text-cyan-400"
                  onClick={() => test(c.id)}
                  disabled={isTesting && testingId === c.id}
                >
                  {isTesting && testingId === c.id
                    ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                    : <TestTube2 className="w-3 h-3 mr-1" />}
                  Test
                </Button>
                {c.category !== 'llm' && (
                  <Button
                    size="sm" variant="outline"
                    className="border-slate-700 hover:border-blue-500 hover:text-blue-400"
                    onClick={() => handlePull(c.id)}
                    disabled={isPulling || c.status !== 'active'}
                  >
                    <Play className="w-3 h-3 mr-1" />
                    Pull (10)
                  </Button>
                )}
                <Button
                  size="sm" variant="outline"
                  className="border-slate-700 hover:border-purple-500 hover:text-purple-400"
                  onClick={() => learnSchema(c.id)}
                  disabled={c.status !== 'active'}
                >
                  <Brain className="w-3 h-3 mr-1" />
                  EA Learn
                </Button>
                <Button
                  size="sm" variant="ghost"
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 ml-auto"
                  onClick={() => deleteConnector(c.id)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>

              {/* Pull result preview */}
              {pullResult && (
                <div className="bg-slate-950/80 rounded border border-slate-800 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-3 h-3 text-emerald-400" />
                    <span className="text-xs text-emerald-400 font-medium">
                      {pullResult.records?.length ?? 0} records · {pullResult.latency_ms}ms · {Math.round((pullResult.schema_coverage ?? 0) * 100)}% schema
                    </span>
                  </div>
                  <ScrollArea className="h-24">
                    <pre className="text-xs text-slate-400 font-mono whitespace-pre-wrap">
                      {JSON.stringify(pullResult.records?.[0] ?? {}, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ── Add connector wizard ──────────────────────────────────────────────────────
function AddConnectorTab() {
  const { catalog, categories, register, isRegistering } = useOmnibusConnector();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDef, setSelectedDef] = useState<ConnectorDefinition | null>(null);
  const [form, setForm] = useState<Partial<RegisterConnectorInput>>({});
  const [step, setStep] = useState<'browse' | 'configure'>('browse');

  const filtered = selectedCategory === 'all'
    ? catalog
    : catalog.filter(c => c.category === selectedCategory);

  const handleSelect = (def: ConnectorDefinition) => {
    setSelectedDef(def);
    setForm({ connector_type: def.connector_type, auth_method: def.auth_methods[0] });
    setStep('configure');
  };

  const handleRegister = async () => {
    if (!form.name || !form.connector_type) return;
    await register(form as RegisterConnectorInput);
    setStep('browse');
    setSelectedDef(null);
    setForm({});
  };

  if (step === 'configure' && selectedDef) {
    const meta = CATEGORY_META[selectedDef.category] ?? CATEGORY_META.custom;
    return (
      <Card className="bg-slate-900/60 border-slate-800/60 max-w-xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setStep('browse')} className="text-slate-400">← Back</Button>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <div className={`p-2.5 rounded-lg ${meta.bg} border`}>
              <meta.icon className={`w-5 h-5 ${meta.color}`} />
            </div>
            <div>
              <CardTitle>{selectedDef.display_name}</CardTitle>
              <CardDescription className="text-xs capitalize">{selectedDef.category}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-slate-400">Connector Name <span className="text-red-400">*</span></Label>
            <Input
              placeholder={`e.g. Production ${selectedDef.display_name}`}
              value={form.name ?? ''}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="bg-slate-800/50 border-slate-700"
            />
          </div>
          {selectedDef.required_fields.includes('base_url') && (
            <div className="space-y-2">
              <Label className="text-xs text-slate-400">Base URL <span className="text-red-400">*</span></Label>
              <Input
                placeholder={selectedDef.category === 'llm' ? 'https://api.example.com' : 'https://your-instance.example.com'}
                value={form.base_url ?? ''}
                onChange={e => setForm(f => ({ ...f, base_url: e.target.value }))}
                className="bg-slate-800/50 border-slate-700"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label className="text-xs text-slate-400">Auth Method</Label>
            <Select value={form.auth_method ?? selectedDef.auth_methods[0]} onValueChange={v => setForm(f => ({ ...f, auth_method: v }))}>
              <SelectTrigger className="bg-slate-800/50 border-slate-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {selectedDef.auth_methods.map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedDef.required_fields.includes('vault_secret_id') && (
            <div className="space-y-2">
              <Label className="text-xs text-slate-400">Vault Secret ID</Label>
              <Input
                placeholder="Supabase Vault secret UUID containing credentials"
                value={form.vault_secret_id ?? ''}
                onChange={e => setForm(f => ({ ...f, vault_secret_id: e.target.value }))}
                className="bg-slate-800/50 border-slate-700 font-mono text-xs"
              />
              <p className="text-xs text-slate-500">Store credentials in Supabase Vault first, then paste the secret ID here. Never paste raw credentials.</p>
            </div>
          )}
          {selectedDef.default_model && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-xs text-emerald-300 font-medium">LLM Connector</p>
              <p className="text-xs text-slate-400 mt-1">Default model: <code className="text-emerald-300">{selectedDef.default_model}</code>. Use the Inference tab to run completions once connected.</p>
            </div>
          )}
          <Button
            className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
            onClick={handleRegister}
            disabled={isRegistering || !form.name}
          >
            {isRegistering ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Register Connector
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {['all', ...categories].map(cat => {
          const meta = cat !== 'all' ? CATEGORY_META[cat as ConnectorCategory] : null;
          return (
            <Button
              key={cat}
              size="sm"
              variant={selectedCategory === cat ? 'default' : 'outline'}
              className={`text-xs capitalize ${selectedCategory === cat ? 'bg-slate-700 border-slate-600' : 'border-slate-700 text-slate-400 hover:text-white'}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {meta ? <meta.icon className={`w-3 h-3 mr-1 ${meta.color}`} /> : <Globe className="w-3 h-3 mr-1" />}
              {cat === 'all' ? 'All' : meta?.label ?? cat}
            </Button>
          );
        })}
      </div>

      {/* Connector cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(def => {
          const meta = CATEGORY_META[def.category] ?? CATEGORY_META.custom;
          return (
            <Card
              key={def.connector_type}
              className={`cursor-pointer transition-all border ${meta.bg} hover:scale-[1.01] hover:shadow-lg hover:shadow-cyan-500/5 group`}
              onClick={() => handleSelect(def)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2 rounded-lg bg-slate-900/60 border border-slate-700/50`}>
                    <meta.icon className={`w-4 h-4 ${meta.color}`} />
                  </div>
                  <Badge variant="outline" className={`text-xs ${meta.color} border-current/30`}>{meta.label}</Badge>
                </div>
                <h4 className="text-sm font-semibold text-white mb-1">{def.display_name}</h4>
                <p className="text-xs text-slate-500 capitalize">{def.auth_methods.join(' / ')}</p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-slate-600 font-mono">{def.connector_type}</span>
                  <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-cyan-400 transition-colors" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── LLM Inference tab ─────────────────────────────────────────────────────────
function InferenceTab() {
  const { connectors, inference, isInferring } = useOmnibusConnector();
  const llmConnectors = connectors.filter(c => c.category === 'llm' && c.status === 'active');
  const [selectedConnector, setSelectedConnector] = useState<string>('sovereign');
  const [systemPrompt, setSystemPrompt] = useState('You are SouHimBou, the AI Security Architect. Respond with precision and sovereignty.');
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; meta?: any }>>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSend = async () => {
    if (!prompt.trim()) return;
    const userMsg = prompt.trim();
    setPrompt('');
    setMessages(m => [...m, { role: 'user', content: userMsg }]);

    const result = await inference({
      connector_id: selectedConnector === 'sovereign' ? undefined : selectedConnector,
      messages: [...messages.map(m => ({ role: m.role, content: m.content })), { role: 'user', content: userMsg }],
      system_prompt: systemPrompt,
    });

    setMessages(m => [...m, { role: 'assistant', content: result.content, meta: result }]);
    setTimeout(() => scrollRef.current?.scrollTo({ top: 999999, behavior: 'smooth' }), 100);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-320px)] min-h-[500px]">
      {/* Config panel */}
      <Card className="bg-slate-900/60 border-slate-800/60 lg:col-span-1">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-slate-400" /> LLM Config
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-slate-400">Provider</Label>
            <Select value={selectedConnector} onValueChange={setSelectedConnector}>
              <SelectTrigger className="bg-slate-800/50 border-slate-700 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sovereign">🛡️ Sovereign Chain (auto)</SelectItem>
                {llmConnectors.map(c => (
                  <SelectItem key={c.id} value={c.id}>🤖 {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {llmConnectors.length === 0 && (
              <p className="text-xs text-yellow-400/80">No LLM connectors active. "Sovereign Chain" uses KHEPRA_LLM_PROVIDER env.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-slate-400">System Prompt</Label>
            <Textarea
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              className="bg-slate-800/50 border-slate-700 text-xs resize-none h-28"
              placeholder="System instructions…"
            />
          </div>
          <Separator className="bg-slate-800" />
          <div className="space-y-1">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">WAF Status</p>
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <Shield className="w-3 h-3" />
              <span>Prompt Guard active — blocks injection + PII</span>
            </div>
          </div>
          {messages.length > 0 && messages[messages.length - 1]?.meta && (
            <div className="space-y-1 p-2 rounded bg-slate-950/60 text-xs text-slate-400">
              <p>Provider: <span className="text-white">{messages[messages.length - 1].meta.provider}</span></p>
              <p>Tokens: <span className="text-white">{messages[messages.length - 1].meta.usage?.total_tokens}</span></p>
              <p>Latency: <span className="text-white">{messages[messages.length - 1].meta.latency_ms}ms</span></p>
              <p>Cost: <span className="text-white">${messages[messages.length - 1].meta.cost_usd?.toFixed(6)}</span></p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chat panel */}
      <Card className="bg-slate-900/60 border-slate-800/60 lg:col-span-2 flex flex-col">
        <CardHeader className="pb-3 shrink-0">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bot className="w-4 h-4 text-emerald-400" /> SouHimBou Inference
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-3 overflow-hidden p-4 pt-0">
          <ScrollArea className="flex-1" ref={scrollRef as any}>
            <div className="space-y-3 pr-2">
              {messages.length === 0 && (
                <div className="text-center py-12 text-slate-600">
                  <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Ask anything. SouHimBou routes through the sovereign LLM chain.</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-1">
                      <Bot className="w-3 h-3 text-emerald-400" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap
                    ${msg.role === 'user'
                      ? 'bg-cyan-600/20 border border-cyan-500/30 text-cyan-50'
                      : 'bg-slate-800/80 border border-slate-700/50 text-slate-200'}`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {isInferring && (
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                    <RefreshCw className="w-3 h-3 text-emerald-400 animate-spin" />
                  </div>
                  <div className="bg-slate-800/80 border border-slate-700/50 rounded-lg px-3 py-2">
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          <div className="flex gap-2 shrink-0">
            <Textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Ask SouHimBou…"
              className="bg-slate-800/50 border-slate-700 resize-none h-16 text-sm flex-1"
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            />
            <Button
              onClick={handleSend}
              disabled={isInferring || !prompt.trim()}
              className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 self-end h-10 px-4"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Schema Lab tab ────────────────────────────────────────────────────────────
function SchemaLabTab() {
  const { connectors, learnSchema, isLearning } = useOmnibusConnector();
  const activeConnectors = connectors.filter(c => c.status === 'active' && c.category !== 'llm');

  return (
    <div className="space-y-4">
      <Card className="bg-slate-900/60 border-slate-800/60">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Brain className="w-4 h-4 text-purple-400" /> EA Schema Fitness
          </CardTitle>
          <CardDescription className="text-xs">
            The KHEPRA EA Kernel learns field aliases from real pull events. Higher fitness = better schema coverage = richer data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeConnectors.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">No active data connectors. Register and activate a SIEM, EDR, or threat intel connector first.</p>
          ) : activeConnectors.map(c => {
            const meta = CATEGORY_META[c.category] ?? CATEGORY_META.custom;
            const fitness = c.fitness_score ?? 0;
            const fitnessColor = fitness > 0.85 ? 'text-emerald-400' : fitness > 0.6 ? 'text-yellow-400' : 'text-red-400';
            return (
              <div key={c.id} className={`p-4 rounded-lg border ${meta.bg}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <meta.icon className={`w-4 h-4 ${meta.color}`} />
                    <span className="text-sm font-medium text-white">{c.name}</span>
                    <Badge variant="outline" className="text-xs">{c.connector_type}</Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-purple-500/40 text-purple-400 hover:bg-purple-500/10 h-7 text-xs"
                    onClick={() => learnSchema(c.id)}
                    disabled={isLearning}
                  >
                    {isLearning ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                    Trigger EA
                  </Button>
                </div>
                <div className="flex items-center gap-3">
                  <Progress value={fitness * 100} className="flex-1 h-2" />
                  <span className={`text-sm font-bold tabular-nums ${fitnessColor}`}>{Math.round(fitness * 100)}%</span>
                </div>
                <div className="flex gap-4 mt-2 text-xs text-slate-500">
                  {c.recent_schema_coverage != null && <span>Coverage: {Math.round(c.recent_schema_coverage * 100)}%</span>}
                  {c.last_pull_at && <span>Last pull: {new Date(c.last_pull_at).toLocaleTimeString()}</span>}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="bg-slate-900/60 border-slate-800/60">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Cpu className="w-4 h-4 text-slate-400" /> How EA Learning Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { step: '1', title: 'Pull', desc: 'Fetch real data from connector', icon: Play, color: 'text-cyan-400' },
              { step: '2', title: 'Map', desc: 'Apply current schema_map to fields', icon: Settings2, color: 'text-blue-400' },
              { step: '3', title: 'Score', desc: 'Measure coverage = fitness signal', icon: Activity, color: 'text-yellow-400' },
              { step: '4', title: 'Mutate', desc: 'EA Kernel evolves field aliases', icon: Brain, color: 'text-purple-400' },
            ].map(({ step, title, desc, icon: Icon, color }) => (
              <div key={step} className="text-center p-3 rounded-lg bg-slate-800/40 border border-slate-700/50">
                <div className={`w-8 h-8 rounded-full bg-slate-700/60 flex items-center justify-center mx-auto mb-2`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <p className="text-xs font-bold text-white">{title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-4 text-center">
            After 10+ orgs observe the same field mapping with 90%+ fitness → it becomes the authoritative schema for that connector type.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function OmnibusConnectorHub() {
  const [activeTab, setActiveTab] = useState('overview');
  const { connectors, isLoading } = useOmnibusConnector();

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/40 via-slate-900 to-blue-950/40 p-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-cyan-900/20 via-transparent to-transparent pointer-events-none" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/30">
                <Plug className="w-4 h-4 text-cyan-400" />
              </div>
              <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 text-xs">KHEPRA Omnibus Connector</Badge>
              <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">Patent-pending USPTO #73565085</Badge>
            </div>
            <h2 className="text-xl font-bold text-white">Adaptive API Fabric</h2>
            <p className="text-sm text-slate-400 mt-1 max-w-xl">
              Connect any SIEM, EDR, SOAR, IAM, threat intel feed, or LLM in minutes. The KHEPRA EA Kernel learns your environment's field schemas over time — the more you use it, the smarter it gets.
            </p>
          </div>
          <div className="text-right shrink-0 hidden md:block">
            <p className="text-3xl font-bold text-cyan-400">{connectors.length}</p>
            <p className="text-xs text-slate-500">connectors registered</p>
            <p className="text-2xl font-bold text-emerald-400 mt-2">{connectors.filter(c => c.health_status === 'healthy').length}</p>
            <p className="text-xs text-slate-500">healthy</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-slate-900/70 border border-slate-800/60 p-1 w-full sm:w-auto grid grid-cols-5 sm:inline-flex">
          {[
            { value: 'overview',  label: 'Overview',  icon: Activity },
            { value: 'connectors',label: 'Connectors',icon: Plug },
            { value: 'add',       label: 'Add New',   icon: Plus },
            { value: 'inference', label: 'AI / LLM',  icon: Bot },
            { value: 'schema',    label: 'Schema Lab', icon: FlaskConical },
          ].map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="text-xs data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-600/80 data-[state=active]:to-blue-600/80 data-[state=active]:text-white gap-1.5"
            >
              <Icon className="w-3 h-3" />{label}
              {value === 'connectors' && connectors.length > 0 && (
                <span className="ml-1 w-4 h-4 rounded-full bg-slate-700 text-slate-300 text-xs flex items-center justify-center">
                  {connectors.length}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">  <OverviewTab /> </TabsContent>
        <TabsContent value="connectors"><ConnectorsTab /> </TabsContent>
        <TabsContent value="add">       <AddConnectorTab /> </TabsContent>
        <TabsContent value="inference"> <InferenceTab /> </TabsContent>
        <TabsContent value="schema">    <SchemaLabTab /> </TabsContent>
      </Tabs>
    </div>
  );
}
