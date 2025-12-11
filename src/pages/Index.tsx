import { useEffect, useState } from 'react';
import Navbar from '@/components/layout/Navbar';
import { useKhepraAgent, DAGNode } from '@/hooks/useKhepraAgent';
import { AGIStatusCard } from '@/components/agi/AGIStatusCard';
import { SouHimBouChat } from '@/components/agi/SouHimBouChat';
import {
  Search,
  RefreshCw,
  Filter,
  Download,
  Clock,
  Activity,
  ShieldAlert,
  ChevronDown,
  Play,
  Pause,
  Terminal,
  Server
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { format } from 'date-fns';

const Index = () => {
  const { nodes, fetchNodes, checkHealth, isConnected, health } = useKhepraAgent();
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Initial load
  useEffect(() => {
    checkHealth(true).then((ok) => {
      if (ok) fetchNodes();
    });
  }, [checkHealth, fetchNodes]);

  // Auto-refresh logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh && isConnected) {
      interval = setInterval(fetchNodes, 2000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh, isConnected, fetchNodes]);

  const filteredNodes = nodes.filter(node =>
    node.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    node.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    node.action.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-giza-void text-foreground font-rajdhani selection:bg-giza-cyan/30">
      <Navbar />

      <main className="container mx-auto py-4 px-4 space-y-4">

        {/* Top Control Bar (Graylog Style) */}
        <div className="grid gap-4">
          <div className="flex flex-col md:flex-row gap-2 items-start md:items-center justify-between bg-giza-gunmetal/50 p-3 rounded-lg border border-border">
            <div className="flex items-center gap-2 w-full md:w-auto flex-1">
              <div className="relative flex-1 max-w-2xl">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search stream... (e.g. symbol:Eban OR action:init)"
                  className="pl-9 bg-background/50 border-primary/20 font-mono text-sm focus-visible:ring-giza-cyan"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button variant="outline" size="icon" className="border-primary/20 text-giza-cyan hover:bg-giza-cyan/10">
                <Play className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              <Badge variant="outline" className={`font-mono ${isConnected ? 'border-giza-cyan text-giza-cyan' : 'border-destructive text-destructive'}`}>
                {isConnected ? 'ONLINE' : 'OFFLINE'}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className={`gap-2 ${autoRefresh ? 'text-giza-cyan bg-giza-cyan/10' : 'text-muted-foreground'}`}
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                {autoRefresh ? <Pause className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
                <span className="hidden sm:inline">Auto-Update</span>
              </Button>
              <Button variant="outline" size="sm" className="gap-2 border-primary/20">
                <Clock className="h-4 w-4" />
                <span className="hidden sm:inline">Last 15 Minutes</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Histogram / Volume Visualizer (Mock for visual feel) */}
          <Card className="bg-giza-gunmetal/30 border-primary/10 p-4 h-32 relative overflow-hidden flex items-end justify-between gap-1">
            <div className="absolute top-2 left-4 text-xs font-mono text-muted-foreground flex items-center gap-2">
              <Activity className="h-3 w-3" /> Event Volume (Logarithimic)
            </div>
            {/* Simple visual mock of a histogram */}
            {Array.from({ length: 60 }).map((_, i) => (
              <div
                key={i}
                className="bg-giza-cyan/20 hover:bg-giza-cyan/60 transition-colors w-full rounded-t-sm"
                style={{ height: `${Math.random() * 80 + 10}%` }}
              />
            ))}
          </Card>
        </div>

        {/* Main Content: Sidebar + Log Stream */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">


          {/* Left Sidebar: Fields & Facets */}
          <Card className="bg-giza-gunmetal/30 border-primary/10 p-4 h-fit hidden lg:block space-y-6">
            <AGIStatusCard />

            <div>
              <h3 className="font-orbitron text-sm text-giza-cyan mb-3 flex items-center gap-2">
                <Filter className="h-4 w-4" /> Fields
              </h3>
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-semibold text-muted-foreground mb-1 text-xs">Source</h4>
                  <div className="flex justify-between items-center group cursor-pointer hover:text-white">
                    <span>khepra-agent</span>
                    <span className="text-xs bg-primary/10 px-1 rounded">100%</span>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-muted-foreground mb-1 text-xs">Symbol</h4>
                  <div className="flex justify-between items-center group cursor-pointer hover:text-giza-gold">
                    <span>Eban</span>
                    <span className="text-xs bg-primary/10 px-1 rounded">
                      {nodes.filter(n => n.symbol === 'Eban').length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center group cursor-pointer hover:text-white">
                    <span>Nkyinkyim</span>
                    <span className="text-xs bg-primary/10 px-1 rounded">
                      {nodes.filter(n => n.symbol === 'Nkyinkyim').length}
                    </span>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-muted-foreground mb-1 text-xs">Tenant</h4>
                  <div className="truncate font-mono text-xs text-muted-foreground/80">
                    {health?.tenant || 'loading...'}
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-primary/10">
                <h3 className="font-orbitron text-sm text-destructive mb-2 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4" /> Active Alerts
                </h3>
                <div className="text-xs text-muted-foreground">
                  No active threats detected in the last 24h.
                </div>
              </div>
            </div>
          </Card>

          {/* Main Log Table */}
          <Card className="lg:col-span-3 bg-giza-void border-primary/20 overflow-hidden flex flex-col min-h-[500px]">
            <div className="bg-giza-gunmetal/50 p-2 border-b border-primary/10 flex justify-between items-center">
              <div className="flex gap-4 px-2 text-xs font-mono text-muted-foreground">
                <span>Showing {filteredNodes.length} events</span>
                <span className="text-giza-cyan">Live Stream</span>
              </div>
              <Button variant="ghost" size="sm" className="h-6 text-xs gap-1">
                <Download className="h-3 w-3" /> Export
              </Button>
            </div>

            <div className="w-full overflow-auto">
              {filteredNodes.length > 0 ? (
                <table className="w-full text-left text-sm font-mono">
                  <thead className="bg-giza-gunmetal/30 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="p-3 w-48">Timestamp</th>
                      <th className="p-3 w-24">Symbol</th>
                      <th className="p-3">Action / Message</th>
                      <th className="p-3 w-32">Node ID</th>
                      <th className="p-3 w-16">PQC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary/10">
                    {filteredNodes.map((node) => (
                      <tr key={node.id} className="hover:bg-primary/5 transition-colors group">
                        <td className="p-3 text-muted-foreground whitespace-nowrap">
                          {format(new Date(node.time), 'yyyy-MM-dd HH:mm:ss.SSS')}
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className={`
                            ${node.symbol === 'Eban' ? 'border-giza-gold text-giza-gold' : 'border-giza-cyan text-giza-cyan'}
                            font-normal text-xs
                          `}>
                            {node.symbol}
                          </Badge>
                        </td>
                        <td className="p-3 text-foreground group-hover:text-giza-cyan transition-colors">
                          <div className="flex items-center gap-2">
                            <Terminal className="h-3 w-3 opacity-50" />
                            {node.action}
                          </div>
                          {node.parents && node.parents.length > 0 && (
                            <div className="text-xs text-muted-foreground mt-1 ml-5">
                              ← Parent: <span className="underline decoration-dotted">{node.parents[0].substring(0, 8)}</span>
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground font-xs truncate max-w-[100px]" title={node.id}>
                          {node.id.substring(0, 8)}...
                        </td>
                        <td className="p-3 text-center">
                          <div className="h-2 w-2 rounded-full bg-giza-cyan mx-auto shadow-[0_0_5px_theme(colors.giza.cyan)]" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex flex-col items-center justify-center p-20 text-muted-foreground space-y-4">
                  <Server className="h-12 w-12 opacity-20" />
                  <p>No events in constellation.</p>
                  <Button variant="outline" onClick={fetchNodes} disabled={!isConnected}>
                    Force Refresh
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>
      </main>
      <SouHimBouChat />
    </div>
  );
};

export default Index;
