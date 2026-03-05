import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, Server, Monitor, Shield, Wifi, Database, 
  Cloud, AlertTriangle, CheckCircle, RefreshCw, Settings
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';

interface Asset {
  id: string;
  name: string;
  type: 'server' | 'workstation' | 'network_device' | 'database' | 'cloud_service';
  ip_address: string;
  os: string;
  version: string;
  status: 'online' | 'offline' | 'maintenance';
  compliance_score: number;
  vulnerabilities: number;
  last_scan: string;
  criticality: 'low' | 'medium' | 'high' | 'critical';
}

interface NetworkSegment {
  id: string;
  name: string;
  cidr: string;
  assets_count: number;
  compliance_level: number;
  security_zone: 'dmz' | 'internal' | 'secure' | 'external';
}

export const InfrastructureDiscovery = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [networks, setNetworks] = useState<NetworkSegment[]>([]);
  const [scanning, setScanning] = useState(false);
  const [discoveryProgress, setDiscoveryProgress] = useState(0);
  const [discoveryResults, setDiscoveryResults] = useState<any[]>([]);
  const { toast } = useToast();
  const { currentOrganization } = useOrganization();

  // Load discovered assets and network segments from Supabase
  useEffect(() => {
    if (!currentOrganization?.id) return;
    const orgId = currentOrganization.id;

    const fetchAssets = async () => {
      const { data, error } = await supabase
        .from('discovered_assets')
        .select('id, asset_identifier, hostname, operating_system, ip_addresses, compliance_status, risk_score, last_discovered, metadata')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .order('last_discovered', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Failed to load discovered assets:', error);
        return;
      }

      const mapped: Asset[] = (data ?? []).map((row: any) => {
        const meta = (row.metadata as any) ?? {};
        const ips: string[] = Array.isArray(row.ip_addresses) ? row.ip_addresses : [];
        const complianceStatus = (row.compliance_status as any) ?? {};
        const score = typeof complianceStatus.score === 'number' ? complianceStatus.score : 0;
        const vulns = typeof complianceStatus.violations === 'number' ? complianceStatus.violations : 0;
        const risk = Number(row.risk_score ?? 0);

        return {
          id: row.id,
          name: row.hostname ?? row.asset_identifier ?? row.id,
          type: (meta.asset_type as Asset['type']) ?? 'server',
          ip_address: ips[0] ?? 'Unknown',
          os: row.operating_system ?? 'Unknown OS',
          version: meta.stig_version ?? '',
          status: meta.status ?? 'online',
          compliance_score: score,
          vulnerabilities: vulns,
          last_scan: row.last_discovered ?? new Date().toISOString(),
          criticality: risk >= 80 ? 'critical' : risk >= 60 ? 'high' : risk >= 40 ? 'medium' : 'low',
        };
      });
      setAssets(mapped);
    };

    const fetchNetworks = async () => {
      const { data, error } = await supabase
        .from('zero_trust_network_segments')
        .select('id, segment_name, cidr_range, security_zone, access_policies')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Failed to load network segments:', error);
        return;
      }

      const mapped: NetworkSegment[] = (data ?? []).map((row: any) => {
        const policies = (row.access_policies as any) ?? {};
        return {
          id: row.id,
          name: row.segment_name ?? 'Unnamed Segment',
          cidr: row.cidr_range ?? 'N/A',
          assets_count: policies.assets_count ?? 0,
          compliance_level: policies.compliance_level ?? 0,
          security_zone: (row.security_zone as NetworkSegment['security_zone']) ?? 'internal',
        };
      });
      setNetworks(mapped);
    };

    fetchAssets();
    fetchNetworks();
  }, [currentOrganization?.id]);

  const getAssetIcon = (type: string) => {
    switch (type) {
      case 'server': return <Server className="h-5 w-5" />;
      case 'workstation': return <Monitor className="h-5 w-5" />;
      case 'network_device': return <Wifi className="h-5 w-5" />;
      case 'database': return <Database className="h-5 w-5" />;
      case 'cloud_service': return <Cloud className="h-5 w-5" />;
      default: return <Monitor className="h-5 w-5" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-success text-success-foreground';
      case 'offline': return 'bg-destructive text-destructive-foreground';
      case 'maintenance': return 'bg-warning text-warning-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getCriticalityColor = (criticality: string) => {
    switch (criticality) {
      case 'critical': return 'text-destructive';
      case 'high': return 'text-warning';
      case 'medium': return 'text-primary';
      case 'low': return 'text-success';
      default: return 'text-muted-foreground';
    }
  };

  const performSTIGFingerprinting = async (type: string) => {
    setScanning(true);
    setDiscoveryProgress(0);
    console.log(`Starting STIG ${type} fingerprinting...`);
    
    try {
      const { data, error } = await supabase.functions.invoke('infrastructure-discovery', {
        body: {
          action: 'stig_fingerprinting',
          target_os: type,
          stig_profiles: ['Windows Server 2019', 'Ubuntu 22.04', 'IIS 10.0', 'Apache 2.4'],
          organizationId: currentOrganization?.id,
          stig_viewer_lookup: true
        }
      });

      if (error) {
        console.error('Discovery error:', error);
        toast({
          title: "Discovery Failed",
          description: "Failed to perform infrastructure discovery. Please try again.",
          variant: "destructive",
        });
        return;
      }

      setDiscoveryResults(data.results || []);
      toast({
        title: "Discovery Complete",
        description: `Found ${data.discovered_count || 0} assets`,
      });
    } catch (error) {
      console.error('Discovery error:', error);
      toast({
        title: "Discovery Failed",
        description: "An unexpected error occurred during discovery.",
        variant: "destructive",
      });
    } finally {
      setScanning(false);
      setDiscoveryProgress(100);
    }
  };

  const startSTIGDiscovery = async () => {
    setScanning(true);
    setDiscoveryProgress(0);
    
    // Run STIG-targeted fingerprinting for supported systems
    const stigTypes = ['windows_server_2019', 'ubuntu_22_04', 'iis_10', 'apache_2_4'];
    let completed = 0;
    
    for (const type of stigTypes) {
      performSTIGFingerprinting(type).finally(() => {
        completed++;
        setDiscoveryProgress((completed / stigTypes.length) * 100);
        
        if (completed === stigTypes.length) {
          setScanning(false);
          toast({
            title: "STIG Discovery Complete",
            description: `STIG fingerprinting completed for ${stigTypes.length} supported platforms`,
            variant: "default"
          });
        }
      });
    }
  };

  const totalAssets = assets.length;
  const onlineAssets = assets.filter(a => a.status === 'online').length;
  const criticalAssets = assets.filter(a => a.criticality === 'critical').length;
  const averageCompliance = Math.round(assets.reduce((sum, a) => sum + a.compliance_score, 0) / assets.length);

  return (
    <div className="space-y-6">
      {/* Discovery Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="card-cyber">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Assets</p>
                <p className="text-2xl font-bold text-primary">{totalAssets}</p>
              </div>
              <Monitor className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-cyber">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Online Assets</p>
                <p className="text-2xl font-bold text-success">{onlineAssets}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-cyber">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Critical Assets</p>
                <p className="text-2xl font-bold text-destructive">{criticalAssets}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-cyber">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Compliance</p>
                <p className="text-2xl font-bold text-accent">{averageCompliance}%</p>
              </div>
              <Shield className="h-8 w-8 text-accent" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Discovery Controls */}
      <Card className="card-cyber">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Search className="h-5 w-5 text-primary" />
                <span>Infrastructure Discovery</span>
              </CardTitle>
              <CardDescription>
                STIG-targeted fingerprinting and compliance assessment for critical systems
              </CardDescription>
            </div>
            <Button 
              variant="cyber" 
              onClick={startSTIGDiscovery}
              disabled={scanning}
            >
              {scanning ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  STIG Scanning...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  STIG Discovery
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        
        {scanning && (
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Discovery Progress</span>
                <span>{discoveryProgress}%</span>
              </div>
              <Progress value={discoveryProgress} className="w-full" />
            </div>
          </CardContent>
        )}
      </Card>

      {/* Asset Management Tabs */}
      <Tabs defaultValue="assets" className="space-y-4">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="networks">Network Segments</TabsTrigger>
        </TabsList>

        <TabsContent value="assets" className="space-y-4">
          <Card className="card-cyber">
            <CardHeader>
              <CardTitle>Discovered Assets</CardTitle>
              <CardDescription>
                Complete inventory of your IT infrastructure
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {assets.map((asset) => (
                  <div
                    key={asset.id}
                    className="p-4 border border-border rounded-lg bg-card hover:bg-accent/30 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        {getAssetIcon(asset.type)}
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 className="font-medium text-foreground">{asset.name}</h4>
                            <Badge className={getStatusColor(asset.status)}>
                              {asset.status.toUpperCase()}
                            </Badge>
                            <Badge variant="outline" className={getCriticalityColor(asset.criticality)}>
                              {asset.criticality.toUpperCase()}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                            <span>IP: {asset.ip_address}</span>
                            <span>OS: {asset.os} {asset.version}</span>
                            <span>Compliance: {asset.compliance_score}%</span>
                            <span>Vulnerabilities: {asset.vulnerabilities}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm">
                          <Settings className="h-3 w-3 mr-1" />
                          Configure
                        </Button>
                        <Button variant="outline" size="sm">
                          <Search className="h-3 w-3 mr-1" />
                          Scan
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="networks" className="space-y-4">
          <Card className="card-cyber">
            <CardHeader>
              <CardTitle>Network Segments</CardTitle>
              <CardDescription>
                Network topology and security zone analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {networks.map((network) => (
                  <div
                    key={network.id}
                    className="p-4 border border-border rounded-lg bg-card hover:bg-accent/30 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <Wifi className="h-6 w-6 text-primary" />
                        <div>
                          <h4 className="font-medium text-foreground">{network.name}</h4>
                          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                            <span>CIDR: {network.cidr}</span>
                            <span>Assets: {network.assets_count}</span>
                            <span>Compliance: {network.compliance_level}%</span>
                            <Badge variant="outline">{network.security_zone.toUpperCase()}</Badge>
                          </div>
                        </div>
                      </div>
                      
                      <Button variant="outline" size="sm">
                        <Search className="h-3 w-3 mr-1" />
                        Analyze
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};