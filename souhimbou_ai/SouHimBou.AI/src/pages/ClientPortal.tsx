import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { KhepraScansWidget } from '@/components/khepra/KhepraScansWidget';
import { KhepraLicenseWidget } from '@/components/khepra/KhepraLicenseWidget';
import { KhepraDAGVisualization } from '@/components/khepra/KhepraDAGVisualization';
import { useKhepraDeployment } from '@/hooks/useKhepraDeployment';
import {
  Shield,
  Network,
  Key,
  Settings,
  Activity,
  BarChart3,
  Server,
  ExternalLink,
} from 'lucide-react';

export default function ClientPortal() {
  const { config, isLoading, isUpdating, updateConfig } = useKhepraDeployment();

  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [tempUrl, setTempUrl] = useState('');
  const [tempKey, setTempKey] = useState('');

  useEffect(() => {
    if (config) {
      setTempUrl(config.deploymentUrl);
      setTempKey(config.apiKey);
    }
  }, [config]);

  const handleSaveConfig = async () => {
    await updateConfig({
      deploymentUrl: tempUrl,
      apiKey: tempKey
    });
    setIsConfigOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Shield className="h-12 w-12 animate-pulse mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading Client Portal...</p>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Deployment Not Found</CardTitle>
            <CardDescription>
              No Khepra deployment is configured for this organization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setIsConfigOpen(true)}>
              Configure Deployment
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cyber-mesh bg-animate text-white p-6 space-y-8">
      {/* Ra (Standard) Branding Strip */}
      <div className="flex items-center justify-between bg-black/40 backdrop-blur-md border-b border-white/10 px-6 py-2 -mx-6 -mt-6 mb-6">
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px] uppercase tracking-tighter">
            SouHimBou AI Core
          </Badge>
          <div className="h-4 w-px bg-white/20" />
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
            Active Protocol: Ra (Standard)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-[10px] text-green-500 font-bold uppercase tracking-widest">
            KHEPRA DISCOVERY ACTIVE
          </span>
        </div>
      </div>

      <div className="container mx-auto space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl shadow-lg shadow-blue-500/20">
                <Shield className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-black tracking-tight text-white italic bg-gradient-to-r from-white to-white/60 bg-clip-text">
                  CLIENT PORTAL
                </h1>
                <p className="text-primary/80 text-xs font-bold uppercase tracking-[0.2em]">
                  Hybrid Security Orchestration & Monitoring
                </p>
              </div>
            </div>
            <p className="text-muted-foreground max-w-2xl leading-relaxed">
              Real-time synchronization with isolated <span className="text-white font-semibold">Khepra VPS</span> nodes.
              Manage PQC licenses and monitor cryptographic audit trails across your private cloud.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <Badge variant="outline" className="bg-white/5 border-white/10 text-primary font-mono py-2 px-4 shadow-inner">
              <Server className="h-3 w-3 mr-2" />
              {new URL(config.deploymentUrl).host}
            </Badge>

            <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="h-11 border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold uppercase tracking-widest text-xs px-6">
                  <Settings className="h-4 w-4 mr-2" />
                  Orchestration Config
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-card text-white border-white/10">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black italic">DEPLOYMENT CONFIG</DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    Connect your self-hosted Khepra instance for hybrid security orchestration.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="url" className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Endpoint URL</Label>
                    <Input
                      id="url"
                      placeholder="https://khepra.example.com:8080"
                      value={tempUrl}
                      onChange={(e) => setTempUrl(e.target.value)}
                      className="bg-white/5 border-white/10 font-mono text-sm h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="key" className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Secure API Key</Label>
                    <Input
                      id="key"
                      type="password"
                      placeholder="kp_live_..."
                      value={tempKey}
                      onChange={(e) => setTempKey(e.target.value)}
                      className="bg-white/5 border-white/10 font-mono text-sm h-12"
                    />
                  </div>
                  <Button
                    onClick={handleSaveConfig}
                    className="w-full h-12 bg-primary text-primary-foreground font-black uppercase tracking-tighter shadow-lg shadow-primary/20"
                    disabled={isUpdating}
                  >
                    {isUpdating ? 'SYNCHRONIZING...' : 'UPDATE DEPLOYMENT'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="scans" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Security Scans
            </TabsTrigger>
            <TabsTrigger value="dag" className="flex items-center gap-2">
              <Network className="h-4 w-4" />
              DAG Constellation
            </TabsTrigger>
            <TabsTrigger value="license" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              License
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <KhepraScansWidget
                deploymentUrl={config.deploymentUrl}
                apiKey={config.apiKey}
              />
              <KhepraLicenseWidget
                deploymentUrl={config.deploymentUrl}
                apiKey={config.apiKey}
              />
            </div>
            <KhepraDAGVisualization
              deploymentUrl={config.deploymentUrl}
              apiKey={config.apiKey}
              height={400}
            />
          </TabsContent>

          {/* Scans Tab */}
          <TabsContent value="scans">
            <KhepraScansWidget
              deploymentUrl={config.deploymentUrl}
              apiKey={config.apiKey}
            />
          </TabsContent>

          {/* DAG Tab */}
          <TabsContent value="dag">
            <KhepraDAGVisualization
              deploymentUrl={config.deploymentUrl}
              apiKey={config.apiKey}
              height={600}
            />
          </TabsContent>

          {/* License Tab */}
          <TabsContent value="license">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <KhepraLicenseWidget
                deploymentUrl={config.deploymentUrl}
                apiKey={config.apiKey}
              />
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Usage Statistics
                  </CardTitle>
                  <CardDescription>
                    License usage and API call metrics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="bg-muted rounded-lg p-4">
                      <div className="text-3xl font-bold text-primary">--</div>
                      <div className="text-sm text-muted-foreground">API Calls Today</div>
                    </div>
                    <div className="bg-muted rounded-lg p-4">
                      <div className="text-3xl font-bold text-primary">--</div>
                      <div className="text-sm text-muted-foreground">Scans This Month</div>
                    </div>
                    <div className="bg-muted rounded-lg p-4">
                      <div className="text-3xl font-bold text-green-600">--</div>
                      <div className="text-sm text-muted-foreground">Issues Resolved</div>
                    </div>
                    <div className="bg-muted rounded-lg p-4">
                      <div className="text-3xl font-bold text-orange-600">--</div>
                      <div className="text-sm text-muted-foreground">Open Findings</div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-4 text-center">
                    Usage data will populate as you use the Khepra deployment.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
