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
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            Khepra Client Portal
          </h1>
          <p className="text-muted-foreground mt-1">
            {config.organizationName} - Real-time security monitoring
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <Server className="h-3 w-3" />
            {new URL(config.deploymentUrl).host}
          </Badge>

          <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Configure
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Deployment Configuration</DialogTitle>
                <DialogDescription>
                  Configure the connection to your Khepra VPS deployment.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="url">Deployment URL</Label>
                  <Input
                    id="url"
                    placeholder="https://khepra.example.com:8080"
                    value={tempUrl}
                    onChange={(e) => setTempUrl(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="key">API Key</Label>
                  <Input
                    id="key"
                    type="password"
                    placeholder="Your machine ID or API key"
                    value={tempKey}
                    onChange={(e) => setTempKey(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleSaveConfig}
                  className="w-full"
                  disabled={isUpdating}
                >
                  {isUpdating ? 'Saving...' : 'Save Configuration'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Button variant="outline" size="sm" asChild>
            <a href={config.deploymentUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Open API
            </a>
          </Button>
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
  );
}
