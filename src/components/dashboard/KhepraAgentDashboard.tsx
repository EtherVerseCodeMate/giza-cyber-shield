import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import D3DAGConstellation from './D3DAGConstellation';
import {
  Shield,
  Activity,
  FileKey,
  GitBranch,
  CheckCircle2,
  XCircle,
  Loader2,
  Copy,
  Bird,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Hexagon,
  Network,
  Send,
  ArrowRight
} from 'lucide-react';

// Khepra Lattice Alphabet for "Veil" mode
const KHEPRA_ALPHABET: Record<string, string> = {
  'A': 'G', 'B': 'Y', 'C': 'E', 'D': 'N', 'E': 'A', 'F': 'M', 'G': 'K',
  'H': 'H', 'I': 'P', 'J': 'R', 'K': 'S', 'L': 'U', 'M': 'T', 'N': 'I',
  'O': 'L', 'P': 'O', 'Q': 'G', 'R': 'Y', 'S': 'E', 'T': 'N', 'U': 'A',
  'V': 'M', 'W': 'K', 'X': 'H', 'Y': 'P', 'Z': 'R', '0': '᚛', '1': '᚜',
  '2': 'ᚠ', '3': 'ᚢ', '4': 'ᚦ', '5': 'ᚨ', '6': 'ᚱ', '7': 'ᚲ', '8': 'ᚷ', '9': 'ᚹ'
};

const veilText = (text: string): string => {
  return text.split('').map(char => {
    const upper = char.toUpperCase();
    return KHEPRA_ALPHABET[upper] || char;
  }).join('');
};

interface HealthResponse {
  ok: boolean;
  tenant: string;
  repo: string;
  email: string;
}

interface Assertion {
  schema: string;
  symbol: string;
  semantics: {
    boundary: string;
    purpose: string;
    least_privilege: boolean;
  };
  lifecycle: {
    journey: string;
  };
  binding: {
    comment: string;
  };
}

interface AttestResponse {
  assertion: Assertion;
  pub_key: number[];
  signature: number[];
}

interface DAGNode {
  id: string;
  action: string;
  symbol: string;
  time: string;
  parents?: string[];
}

// Adinkra symbols with SVG-like representations
const ADINKRA_SYMBOLS: Record<string, { meaning: string; icon: string; color: string }> = {
  Eban: { meaning: 'Safety, Security, Protection', icon: '◈', color: 'text-primary' },
  Fawohodie: { meaning: 'Independence, Freedom', icon: '⬡', color: 'text-secondary' },
  Nkyinkyim: { meaning: 'Resilience, Adaptability', icon: '⧗', color: 'text-primary' },
  OwoForoAdobe: { meaning: 'Prudence, Diligence, Caution', icon: '🐍', color: 'text-destructive' },
};

const KhepraAgentDashboard = () => {
  const [agentUrl, setAgentUrl] = useState('/api/agent');
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [attestation, setAttestation] = useState<AttestResponse | null>(null);
  const [dagState, setDagState] = useState<DAGNode[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'unknown'>('unknown');
  const [veilMode, setVeilMode] = useState(false);
  const [canaryStatus, setCanaryStatus] = useState<'alive' | 'dead'>('alive');

  // Chat State
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'agent', content: string }[]>([]);

  const handleChatSubmit = async () => {
    if (!chatInput.trim()) return;

    const message = chatInput;
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', content: message }]);
    setIsLoading('chat');

    try {
      const response = await fetch(`${agentUrl}/agi/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });

      if (!response.ok) throw new Error('Failed to send');

      const data = await response.json();
      setChatHistory(prev => [...prev, { role: 'agent', content: data.response }]);

      // Refresh DAG if scan was triggered (simple heuristic check)
      if (message.toLowerCase().includes('scan')) {
        setTimeout(fetchDAGState, 2000);
      }

    } catch (err) {
      toast.error('Command transmission failed');
      setChatHistory(prev => [...prev, { role: 'agent', content: 'ERROR: Signal Lost.' }]);
    } finally {
      setIsLoading(null);
    }
  };

  const displayText = (text: string) => veilMode ? veilText(text) : text;

  const callEndpoint = async <T,>(endpoint: string): Promise<T | null> => {
    try {
      const response = await fetch(`${agentUrl}${endpoint}`, {
        method: endpoint === '/attest/new' ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`Error calling ${endpoint}:`, error);
      throw error;
    }
  };

  const checkHealth = async () => {
    setIsLoading('health');
    try {
      const data = await callEndpoint<HealthResponse>('/healthz');
      setHealth(data);
      setConnectionStatus('connected');
      toast.success('KHEPRA Agent verified');
    } catch (error) {
      setConnectionStatus('disconnected');
      toast.error('Connection failed - Agent unreachable');
    } finally {
      setIsLoading(null);
    }
  };

  const createAttestation = async () => {
    setIsLoading('attest');
    try {
      const data = await callEndpoint<AttestResponse>('/attest/new');
      setAttestation(data);
      toast.success('Attestation sealed');
    } catch (error) {
      toast.error('Attestation failed');
    } finally {
      setIsLoading(null);
    }
  };

  const fetchDAGState = async () => {
    setIsLoading('dag');
    try {
      const data = await callEndpoint<DAGNode[]>('/dag/state');
      setDagState(data || []);
      toast.success(`${data?.length || 0} nodes synchronized`);
    } catch (error) {
      toast.error('DAG sync failed');
    } finally {
      setIsLoading(null);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  return (
    <div className="space-y-6">
      {/* Top Status Bar */}
      <div className="flex items-center justify-between p-4 glass-panel-cyan">
        <div className="flex items-center gap-6">
          {/* Warrant Canary */}
          <div className="flex items-center gap-2">
            <Bird className={`h-5 w-5 ${canaryStatus === 'alive' ? 'text-secondary canary-icon' : 'text-destructive'}`} />
            <span className="text-sm font-mono">
              {canaryStatus === 'alive' ? 'CANARY ALIVE' : 'CANARY DEAD'}
            </span>
          </div>

          {/* Heartbeat */}
          <div className="flex items-center gap-2">
            <Activity className={`h-4 w-4 ${connectionStatus === 'connected' ? 'text-primary' : 'text-muted-foreground'}`} />
            <div className="w-24 h-1 bg-muted rounded-full overflow-hidden">
              {connectionStatus === 'connected' && <div className="heartbeat-line" />}
            </div>
          </div>
        </div>

        {/* Veil Toggle */}
        <div className="flex items-center gap-3">
          <Label htmlFor="veil-mode" className="text-sm font-mono flex items-center gap-2">
            {veilMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            <span className="hidden sm:inline">THE VEIL</span>
          </Label>
          <Switch
            id="veil-mode"
            checked={veilMode}
            onCheckedChange={setVeilMode}
            className="data-[state=checked]:bg-secondary"
          />
        </div>
      </div>

      {/* Connection / Attestation Panel */}
      <Card className="glass-panel border-primary/30 overflow-hidden relative">
        <div className="absolute inset-0 lattice-bg pointer-events-none" />
        <CardHeader className="pb-3 relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-lg ${connectionStatus === 'connected' ? 'bg-primary/20 glow-cyan' : 'bg-muted'}`}>
                {connectionStatus === 'connected' ? (
                  <Lock className="h-6 w-6 text-primary" />
                ) : (
                  <Unlock className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div>
                <CardTitle className="text-xl font-orbitron gradient-text-cyan">
                  {displayText('KHEPRA ATTESTATION')}
                </CardTitle>
                <CardDescription className="font-rajdhani">
                  {displayText('Post-Quantum Secure Agent Verification')}
                </CardDescription>
              </div>
            </div>
            <Badge
              variant="outline"
              className={`font-mono text-xs px-3 py-1 ${connectionStatus === 'connected'
                ? 'border-primary text-primary glow-cyan'
                : connectionStatus === 'disconnected'
                  ? 'border-destructive text-destructive'
                  : 'border-muted-foreground'
                }`}
            >
              {connectionStatus === 'connected' && <CheckCircle2 className="h-3 w-3 mr-1" />}
              {connectionStatus === 'disconnected' && <XCircle className="h-3 w-3 mr-1" />}
              {displayText(connectionStatus.toUpperCase())}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="agentUrl" className="text-xs text-muted-foreground font-mono">
                {displayText('AGENT ENDPOINT')}
              </Label>
              <Input
                id="agentUrl"
                value={veilMode ? veilText(agentUrl) : agentUrl}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAgentUrl(e.target.value)}
                placeholder="/api/agent"
                className="bg-background/50 border-border font-mono text-sm"
                disabled={veilMode}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={checkHealth}
                disabled={isLoading === 'health'}
                className="bg-primary text-primary-foreground hover:bg-primary/80 font-rajdhani font-semibold glow-cyan"
              >
                {isLoading === 'health' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Shield className="h-4 w-4 mr-2" />
                )}
                {displayText('VERIFY')}
              </Button>
            </div>
          </div>

          {health && (
            <div className="mt-4 p-4 glass-panel border-primary/20">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs font-mono">{displayText('STATUS')}</span>
                  <p className="font-mono text-primary text-glow-cyan">{displayText(health.ok ? 'VERIFIED' : 'ERROR')}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs font-mono">{displayText('TENANT')}</span>
                  <p className="font-mono truncate">{displayText(health.tenant)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs font-mono">{displayText('REPOSITORY')}</span>
                  <p className="font-mono truncate">{displayText(health.repo)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs font-mono">{displayText('IDENTITY')}</span>
                  <p className="font-mono truncate">{displayText(health.email)}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Two Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Key Vault / Attestation */}
        <Card className="glass-panel-gold">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-secondary/20 glow-gold">
                <FileKey className="h-6 w-6 text-secondary" />
              </div>
              <div>
                <CardTitle className="text-lg font-orbitron gradient-text-gold">
                  {displayText('THE ARMORY')}
                </CardTitle>
                <CardDescription className="font-rajdhani">
                  {displayText('Symbol-Annotated Key Generation')}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              onClick={createAttestation}
              disabled={isLoading === 'attest' || connectionStatus !== 'connected'}
              className="w-full bg-secondary/20 hover:bg-secondary/30 border border-secondary/40 text-secondary font-rajdhani font-semibold"
            >
              {isLoading === 'attest' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Hexagon className="h-4 w-4 mr-2" />
              )}
              {displayText('FORGE NEW ATTESTATION')}
            </Button>

            {attestation && (
              <div className="mt-4 space-y-3">
                <div className="p-4 glass-panel border-secondary/20">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className={`text-4xl ${ADINKRA_SYMBOLS[attestation.assertion.symbol]?.color} animate-float`}>
                        {ADINKRA_SYMBOLS[attestation.assertion.symbol]?.icon}
                      </span>
                      <div>
                        <p className="font-orbitron text-lg">{displayText(attestation.assertion.symbol)}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {displayText(ADINKRA_SYMBOLS[attestation.assertion.symbol]?.meaning || '')}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-2 bg-background/50 rounded">
                      <span className="text-muted-foreground font-mono">{displayText('BOUNDARY')}</span>
                      <p className="font-mono truncate text-primary">{displayText(attestation.assertion.semantics.boundary)}</p>
                    </div>
                    <div className="p-2 bg-background/50 rounded">
                      <span className="text-muted-foreground font-mono">{displayText('PURPOSE')}</span>
                      <p className="font-mono">{displayText(attestation.assertion.semantics.purpose)}</p>
                    </div>
                    <div className="p-2 bg-background/50 rounded">
                      <span className="text-muted-foreground font-mono">{displayText('JOURNEY')}</span>
                      <p className="font-mono">{displayText(attestation.assertion.lifecycle.journey)}</p>
                    </div>
                    <div className="p-2 bg-background/50 rounded">
                      <span className="text-muted-foreground font-mono">{displayText('LEAST PRIV')}</span>
                      <p className="font-mono">{attestation.assertion.semantics.least_privilege ? '✓' : '✗'}</p>
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-secondary/30 text-secondary hover:bg-secondary/10 font-mono text-xs"
                  onClick={() => copyToClipboard(JSON.stringify(attestation, null, 2), 'Attestation')}
                >
                  <Copy className="h-3 w-3 mr-2" />
                  {displayText('COPY SIGNATURE')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* DAG Constellation */}
        <Card className="glass-panel-cyan">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-primary/20 glow-cyan">
                <Network className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg font-orbitron gradient-text-cyan">
                  {displayText('THE CONSTELLATION')}
                </CardTitle>
                <CardDescription className="font-rajdhani">
                  {displayText('Directed Acyclic Trust Graph')}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              onClick={fetchDAGState}
              disabled={isLoading === 'dag' || connectionStatus !== 'connected'}
              className="w-full bg-primary/20 hover:bg-primary/30 border border-primary/40 text-primary font-rajdhani font-semibold"
            >
              {isLoading === 'dag' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <GitBranch className="h-4 w-4 mr-2" />
              )}
              {displayText('SYNCHRONIZE DAG')}
            </Button>

            <div className="mt-4">
              <D3DAGConstellation nodes={dagState} veilMode={veilMode} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Command Link (Chat) */}
      <Card className="glass-panel border-primary/30">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-primary/20 glow-cyan">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-orbitron gradient-text-cyan">
                {displayText('COMMAND LINK')}
              </CardTitle>
              <CardDescription className="font-rajdhani">
                {displayText('Direct Neural Interface to KASA')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-96 p-4 rounded-md bg-[#050505] border border-primary/20 font-mono text-sm overflow-y-auto space-y-2 relative">
              {/* Placeholder Chat History */}
              {!chatHistory.length && (
                <div className="text-muted-foreground opacity-50 flex items-center gap-2">
                  <ArrowRight className="h-3 w-3" />
                  {displayText('System initialized. Awaiting directives...')}
                </div>
              )}
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'text-secondary' : 'text-primary'}`}>
                  <span className="opacity-50 flex-shrink-0">{msg.role === 'user' ? '>' : '#'}</span>
                  <span className="whitespace-pre-line">{displayText(msg.content)}</span>
                </div>
              ))}
              {isLoading === 'chat' && (
                <div className="text-primary animate-pulse flex items-start gap-2">
                  <span className="opacity-50 mt-1">#</span>
                  <div className="flex flex-col gap-1">
                    <span>{displayText('Thinking (Neural Link Active)...')}</span>
                    <span className="text-xs text-muted-foreground">{displayText('KASA is analyzing vectors via Ollama...')}</span>
                  </div>
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleChatSubmit();
              }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <span className="absolute left-3 top-2.5 text-muted-foreground font-mono">{'>'}</span>
                <Input
                  value={veilMode ? veilText(chatInput) : chatInput}
                  onChange={(e) => setChatInput(e.target.value)} // Note: in real veil mode would need inverse map
                  placeholder={displayText("Enter command (e.g., 'status of ports', 'run scan')")}
                  className="pl-8 bg-background/50 border-primary/30 font-mono text-sm"
                  disabled={isLoading === 'chat' || connectionStatus !== 'connected'}
                />
              </div>
              <Button
                type="submit"
                disabled={isLoading === 'chat' || !chatInput.trim() || connectionStatus !== 'connected'}
                className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      {/* Adinkra Symbol Reference */}
      <Card className="glass-panel">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-orbitron">{displayText('ADINKRA CIPHER KEY')}</CardTitle>
          <CardDescription className="font-rajdhani">
            {displayText('Cultural semantics encoded in cryptographic flows')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(ADINKRA_SYMBOLS).map(([symbol, { meaning, icon, color }]) => (
              <div
                key={symbol}
                className="p-4 glass-panel hover:border-primary/30 transition-all duration-300 flex items-center gap-4 group"
              >
                <span className={`text-5xl ${color} group-hover:animate-pulse transition-all`}>{icon}</span>
                <div>
                  <p className="font-orbitron text-lg">{displayText(symbol)}</p>
                  <p className="text-xs text-muted-foreground font-mono">{displayText(meaning)}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default KhepraAgentDashboard;
