import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plug, 
  Code, 
  Settings, 
  TestTube, 
  Package,
  CheckCircle,
  AlertCircle,
  Clock,
  Download
} from 'lucide-react';

interface ConnectorConfig {
  id: string;
  name: string;
  version: string;
  status: 'active' | 'inactive' | 'development' | 'coming_soon';
  tier: 1 | 2 | 3;
  plugin_type: 'stig_scanner' | 'evidence_collector' | 'remediation_engine' | 'compliance_mapper';
  supported_platforms: string[];
  api_endpoints: string[];
  dependencies: string[];
  configuration_schema: any;
}

export const ModularConnectorSDK: React.FC = () => {
  const [selectedConnector, setSelectedConnector] = useState<string | null>(null);

  const connectors: ConnectorConfig[] = [
    {
      id: 'stig-viewer-api',
      name: 'STIG Viewer API Connector',
      version: '1.0.0',
      status: 'active',
      tier: 1,
      plugin_type: 'stig_scanner',
      supported_platforms: ['Windows Server 2019', 'Windows Server 2022', 'Ubuntu 22.04', 'RHEL 9'],
      api_endpoints: ['/api/stig/scan', '/api/stig/controls', '/api/stig/evidence'],
      dependencies: ['axios', 'crypto-js'],
      configuration_schema: {
        api_key: { type: 'string', required: true, encrypted: true },
        base_url: { type: 'string', default: 'https://stigviewer.com/api' },
        timeout: { type: 'number', default: 30000 }
      }
    },
    {
      id: 'windows-stig-remediation',
      name: 'Windows STIG Remediation Engine',
      version: '2.1.0',
      status: 'active',
      tier: 1,
      plugin_type: 'remediation_engine',
      supported_platforms: ['Windows Server 2019', 'Windows Server 2022', 'Windows 11'],
      api_endpoints: ['/api/remediate/windows', '/api/rollback/windows'],
      dependencies: ['powershell-core', 'wmi-connector'],
      configuration_schema: {
        execution_mode: { type: 'enum', values: ['dry-run', 'guided', 'auto'] },
        backup_enabled: { type: 'boolean', default: true },
        rollback_timeout: { type: 'number', default: 300 }
      }
    },
    {
      id: 'linux-hardening-scanner',
      name: 'Linux STIG Hardening Scanner',
      version: '1.8.3',
      status: 'active', 
      tier: 1,
      plugin_type: 'stig_scanner',
      supported_platforms: ['Ubuntu 22.04', 'RHEL 9', 'CentOS 8'],
      api_endpoints: ['/api/scan/linux', '/api/baseline/linux'],
      dependencies: ['bash-scripts', 'systemd-analyzer'],
      configuration_schema: {
        scan_depth: { type: 'enum', values: ['basic', 'comprehensive'] },
        exclude_services: { type: 'array', default: [] },
        custom_rules_path: { type: 'string', optional: true }
      }
    },
    {
      id: 'nist-800-171-mapper',
      name: 'NIST 800-171 Control Mapper',
      version: '3.0.0',
      status: 'development',
      tier: 2,
      plugin_type: 'compliance_mapper',
      supported_platforms: ['All'],
      api_endpoints: ['/api/map/nist', '/api/crosswalk/controls'],
      dependencies: ['mapping-engine-v3', 'compliance-db'],
      configuration_schema: {
        framework_version: { type: 'string', default: 'rev3' },
        include_enhancements: { type: 'boolean', default: true },
        custom_mappings: { type: 'object', default: {} }
      }
    },
    {
      id: 'cmmc-assessment-engine',
      name: 'CMMC Assessment Engine',
      version: '2.0.0',
      status: 'coming_soon',
      tier: 2,
      plugin_type: 'compliance_mapper',
      supported_platforms: ['All'],
      api_endpoints: ['/api/assess/cmmc', '/api/maturity/level'],
      dependencies: ['cmmc-framework', 'assessment-engine'],
      configuration_schema: {
        target_level: { type: 'enum', values: [1, 2, 3] },
        include_practices: { type: 'boolean', default: true },
        evidence_requirements: { type: 'string', default: 'comprehensive' }
      }
    },
    {
      id: 'dod-cci-connector',
      name: 'DoD CCI Database Connector',
      version: '1.5.0',
      status: 'coming_soon',
      tier: 3,
      plugin_type: 'compliance_mapper',
      supported_platforms: ['All'],
      api_endpoints: ['/api/cci/lookup', '/api/cci/crosswalk'],
      dependencies: ['dod-cci-db', 'xml-parser'],
      configuration_schema: {
        cci_version: { type: 'string', default: 'latest' },
        include_legacy: { type: 'boolean', default: false },
        cache_duration: { type: 'number', default: 86400 }
      }
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-4 h-4 text-success" />;
      case 'development': return <Settings className="w-4 h-4 text-warning" />;
      case 'coming_soon': return <Clock className="w-4 h-4 text-muted-foreground" />;
      default: return <AlertCircle className="w-4 h-4 text-destructive" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'development': return 'secondary';
      case 'coming_soon': return 'outline';
      default: return 'destructive';
    }
  };

  const getTierBadgeColor = (tier: number) => {
    switch (tier) {
      case 1: return 'default';
      case 2: return 'secondary';
      case 3: return 'outline';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Modular Connector SDK
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Plugin-based architecture for STIG compliance integrations
          </p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="connectors" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="connectors">Connectors</TabsTrigger>
              <TabsTrigger value="development">Development</TabsTrigger>
              <TabsTrigger value="testing">Testing</TabsTrigger>
              <TabsTrigger value="deployment">Deployment</TabsTrigger>
            </TabsList>

            <TabsContent value="connectors" className="space-y-4">
              <div className="grid gap-4">
                {connectors.map((connector) => (
                  <Card 
                    key={connector.id} 
                    className={`cursor-pointer transition-colors ${
                      selectedConnector === connector.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => setSelectedConnector(connector.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Plug className="w-4 h-4" />
                            <h4 className="font-medium">{connector.name}</h4>
                            <Badge variant="outline">v{connector.version}</Badge>
                          </div>
                          
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1">
                              {getStatusIcon(connector.status)}
                              <Badge variant={getStatusColor(connector.status)}>
                                {connector.status.replace('_', ' ').toUpperCase()}
                              </Badge>
                            </div>
                            <Badge variant={getTierBadgeColor(connector.tier)}>
                              Tier {connector.tier}
                            </Badge>
                            <Badge variant="outline">
                              {connector.plugin_type.replace('_', ' ')}
                            </Badge>
                          </div>

                          <div className="text-sm text-muted-foreground">
                            <strong>Platforms:</strong> {connector.supported_platforms.join(', ')}
                          </div>
                          
                          <div className="text-sm text-muted-foreground">
                            <strong>Dependencies:</strong> {connector.dependencies.join(', ')}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <Button size="sm" variant="outline" disabled={connector.status === 'coming_soon'}>
                            Configure
                          </Button>
                          <Button size="sm" variant="outline" disabled={connector.status !== 'active'}>
                            <TestTube className="w-3 h-3 mr-1" />
                            Test
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="development" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Code className="w-5 h-5" />
                    Plugin Development Kit
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-medium mb-2">Creating a Custom STIG Connector</h4>
                    <div className="space-y-2 text-sm">
                      <div><strong>1.</strong> Extend the base ConnectorPlugin interface</div>
                      <div><strong>2.</strong> Implement required methods: scan(), remediate(), validate()</div>
                      <div><strong>3.</strong> Define configuration schema and dependencies</div>
                      <div><strong>4.</strong> Add unit tests and integration tests</div>
                      <div><strong>5.</strong> Register plugin with the connector registry</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Button variant="outline" className="flex items-center gap-2">
                      <Download className="w-4 h-4" />
                      Download SDK
                    </Button>
                    <Button variant="outline" className="flex items-center gap-2">
                      <Code className="w-4 h-4" />
                      View Examples
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="testing" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TestTube className="w-5 h-5" />
                    Connector Testing Framework
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">Required Test Coverage:</h4>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      <li>Unit tests for discovery, mapping, and remediation functions</li>
                      <li>Integration tests for Windows Server + Linux STIG packages</li>
                      <li>Mock STIG Viewer API service for offline development</li>
                      <li>Performance tests for large-scale environment scanning</li>
                      <li>Security tests for credential handling and data protection</li>
                    </ul>
                  </div>

                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-medium mb-2">Test Environment Status</h4>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 text-success" />
                          <span>Unit Tests</span>
                        </div>
                        <div className="text-muted-foreground">245/245 passing</div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 text-success" />
                          <span>Integration Tests</span>
                        </div>
                        <div className="text-muted-foreground">18/20 passing</div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-warning" />
                          <span>Mock Services</span>
                        </div>
                        <div className="text-muted-foreground">Ready for testing</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="deployment" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Deployment Pipeline</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">Deliverable Requirements:</h4>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      <li>Demo-ready UI + CLI interface</li>
                      <li>Exportable artifacts (POA&M CSV, Evidence PDF)</li>
                      <li>Developer documentation (API routes, module README)</li>
                      <li>Docker containers for isolated connector execution</li>
                      <li>Kubernetes manifests for scalable deployment</li>
                    </ul>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Button className="flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      Build Release Package
                    </Button>
                    <Button variant="outline" className="flex items-center gap-2">
                      <Download className="w-4 h-4" />
                      Export Documentation
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};