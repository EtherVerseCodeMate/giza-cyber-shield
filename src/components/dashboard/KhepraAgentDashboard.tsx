import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  Shield, 
  Activity, 
  RefreshCw, 
  Server, 
  FileKey, 
  GitBranch,
  CheckCircle2,
  XCircle,
  Loader2,
  Copy,
  ExternalLink
} from 'lucide-react';

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

const ADINKRA_SYMBOLS: Record<string, { meaning: string; icon: string }> = {
  Eban: { meaning: 'Safety, Security, Protection', icon: '⬡' },
  Fawohodie: { meaning: 'Independence, Freedom', icon: '◈' },
  Nkyinkyim: { meaning: 'Resilience, Adaptability', icon: '⧗' },
};

const KhepraAgentDashboard = () => {
  const [agentUrl, setAgentUrl] = useState('http://168.100.240.19:45444');
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [attestation, setAttestation] = useState<AttestResponse | null>(null);
  const [dagState, setDagState] = useState<DAGNode[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'unknown'>('unknown');

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
      toast.success('Agent connected successfully');
    } catch (error) {
      setConnectionStatus('disconnected');
      toast.error('Failed to connect to KHEPRA agent');
    } finally {
      setIsLoading(null);
    }
  };

  const createAttestation = async () => {
    setIsLoading('attest');
    try {
      const data = await callEndpoint<AttestResponse>('/attest/new');
      setAttestation(data);
      toast.success('New attestation created');
    } catch (error) {
      toast.error('Failed to create attestation');
    } finally {
      setIsLoading(null);
    }
  };

  const fetchDAGState = async () => {
    setIsLoading('dag');
    try {
      const data = await callEndpoint<DAGNode[]>('/dag/state');
      setDagState(data || []);
      toast.success(`Fetched ${data?.length || 0} DAG nodes`);
    } catch (error) {
      toast.error('Failed to fetch DAG state');
    } finally {
      setIsLoading(null);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const getStatusColor = (status: 'connected' | 'disconnected' | 'unknown') => {
    switch (status) {
      case 'connected': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'disconnected': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <div className="space-y-6">
      {/* Connection Configuration */}
      <Card className="dashboard-card border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${getStatusColor(connectionStatus)}`}>
                <Server className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">KHEPRA Agent Connection</CardTitle>
                <CardDescription>Configure and test your Go backend connection</CardDescription>
              </div>
            </div>
            <Badge 
              variant="outline" 
              className={connectionStatus === 'connected' ? 'border-green-500 text-green-500' : 
                         connectionStatus === 'disconnected' ? 'border-red-500 text-red-500' : ''}
            >
              {connectionStatus === 'connected' && <CheckCircle2 className="h-3 w-3 mr-1" />}
              {connectionStatus === 'disconnected' && <XCircle className="h-3 w-3 mr-1" />}
              {connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="agentUrl" className="text-xs text-muted-foreground">Agent URL</Label>
              <Input
                id="agentUrl"
                value={agentUrl}
                onChange={(e) => setAgentUrl(e.target.value)}
                placeholder="http://localhost:45444"
                className="bg-secondary/50 border-border"
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={checkHealth} 
                disabled={isLoading === 'health'}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isLoading === 'health' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Test Connection
              </Button>
            </div>
          </div>

          {health && (
            <div className="mt-4 p-3 bg-secondary/30 rounded-lg border border-border">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Status</span>
                  <p className="font-mono text-green-500">{health.ok ? 'OK' : 'Error'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Tenant</span>
                  <p className="font-mono truncate">{health.tenant}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Repo</span>
                  <p className="font-mono truncate">{health.repo}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Email</span>
                  <p className="font-mono truncate">{health.email}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Attestation Card */}
        <Card className="dashboard-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
                <FileKey className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Attestation Service</CardTitle>
                <CardDescription>Generate symbol-annotated attestations</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={createAttestation} 
              disabled={isLoading === 'attest' || connectionStatus !== 'connected'}
              className="w-full bg-secondary hover:bg-secondary/80"
            >
              {isLoading === 'attest' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Shield className="h-4 w-4 mr-2" />
              )}
              Create New Attestation
            </Button>

            {attestation && (
              <div className="mt-4 space-y-3">
                <div className="p-3 bg-secondary/30 rounded-lg border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <span className="text-2xl">{ADINKRA_SYMBOLS[attestation.assertion.symbol]?.icon}</span>
                      {attestation.assertion.symbol}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {ADINKRA_SYMBOLS[attestation.assertion.symbol]?.meaning}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Boundary</span>
                      <p className="font-mono truncate">{attestation.assertion.semantics.boundary}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Purpose</span>
                      <p className="font-mono">{attestation.assertion.semantics.purpose}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Journey</span>
                      <p className="font-mono">{attestation.assertion.lifecycle.journey}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Least Privilege</span>
                      <p className="font-mono">{attestation.assertion.semantics.least_privilege ? 'Yes' : 'No'}</p>
                    </div>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => copyToClipboard(JSON.stringify(attestation, null, 2), 'Attestation')}
                >
                  <Copy className="h-3 w-3 mr-2" />
                  Copy Full Attestation
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* DAG State Card */}
        <Card className="dashboard-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10 text-accent border border-accent/20">
                <GitBranch className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">DAG Trust Graph</CardTitle>
                <CardDescription>View current DAG state and nodes</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={fetchDAGState} 
              disabled={isLoading === 'dag' || connectionStatus !== 'connected'}
              className="w-full bg-secondary hover:bg-secondary/80"
            >
              {isLoading === 'dag' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Activity className="h-4 w-4 mr-2" />
              )}
              Fetch DAG State
            </Button>

            {dagState.length > 0 ? (
              <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
                {dagState.map((node) => (
                  <div 
                    key={node.id} 
                    className="p-3 bg-secondary/30 rounded-lg border border-border hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs text-muted-foreground">{node.id}</span>
                      <Badge variant="outline" className="text-xs">
                        <span className="mr-1">{ADINKRA_SYMBOLS[node.symbol]?.icon}</span>
                        {node.symbol}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium">{node.action}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(node.time).toLocaleString()}
                    </p>
                    {node.parents && node.parents.length > 0 && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                        <GitBranch className="h-3 w-3" />
                        Parents: {node.parents.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 p-4 text-center text-muted-foreground text-sm border border-dashed border-border rounded-lg">
                No DAG nodes available. Click "Fetch DAG State" to load.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Adinkra Symbols Reference */}
      <Card className="dashboard-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Adinkra Symbol Reference</CardTitle>
          <CardDescription>Cultural semantics used in KHEPRA cryptographic flows</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(ADINKRA_SYMBOLS).map(([symbol, { meaning, icon }]) => (
              <div 
                key={symbol}
                className="p-4 bg-secondary/30 rounded-lg border border-border flex items-center gap-4"
              >
                <span className="text-4xl">{icon}</span>
                <div>
                  <p className="font-medium">{symbol}</p>
                  <p className="text-xs text-muted-foreground">{meaning}</p>
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
