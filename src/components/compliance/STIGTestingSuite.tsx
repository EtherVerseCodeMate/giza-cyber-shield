import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  TestTube, 
  Play, 
  CheckCircle, 
  XCircle, 
  Clock,
  Download,
  FileText,
  Server,
  Monitor
} from 'lucide-react';

interface TestSuite {
  id: string;
  name: string;
  category: 'unit' | 'integration' | 'performance' | 'security';
  platform: 'Windows Server 2019' | 'Windows Server 2022' | 'Ubuntu 22.04' | 'RHEL 9' | 'All';
  status: 'not_run' | 'running' | 'passed' | 'failed' | 'skipped';
  tests_count: number;
  passed_count: number;
  failed_count: number;
  duration_ms?: number;
  last_run?: string;
  coverage_percentage?: number;
}

export const STIGTestingSuite: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [selectedSuite, setSelectedSuite] = useState<string | null>(null);

  const testSuites: TestSuite[] = [
    {
      id: 'unit-discovery',
      name: 'STIG Discovery Engine Tests',
      category: 'unit',
      platform: 'All',
      status: 'passed',
      tests_count: 45,
      passed_count: 45,
      failed_count: 0,
      duration_ms: 2340,
      last_run: '2024-01-15T10:30:00Z',
      coverage_percentage: 98
    },
    {
      id: 'unit-mapping',
      name: 'Control Mapping Engine Tests',
      category: 'unit', 
      platform: 'All',
      status: 'passed',
      tests_count: 78,
      passed_count: 76,
      failed_count: 2,
      duration_ms: 4120,
      last_run: '2024-01-15T10:32:00Z',
      coverage_percentage: 94
    },
    {
      id: 'unit-remediation',
      name: 'Remediation Generator Tests',
      category: 'unit',
      platform: 'All', 
      status: 'failed',
      tests_count: 122,
      passed_count: 115,
      failed_count: 7,
      duration_ms: 8950,
      last_run: '2024-01-15T10:35:00Z',
      coverage_percentage: 89
    },
    {
      id: 'integration-windows-2019',
      name: 'Windows Server 2019 STIG Integration',
      category: 'integration',
      platform: 'Windows Server 2019',
      status: 'passed',
      tests_count: 156,
      passed_count: 152,
      failed_count: 4,
      duration_ms: 45600,
      last_run: '2024-01-15T11:00:00Z',
      coverage_percentage: 85
    },
    {
      id: 'integration-windows-2022',
      name: 'Windows Server 2022 STIG Integration',
      category: 'integration',
      platform: 'Windows Server 2022',
      status: 'passed',
      tests_count: 189,
      passed_count: 186,
      failed_count: 3,
      duration_ms: 52300,
      last_run: '2024-01-15T11:15:00Z',
      coverage_percentage: 91
    },
    {
      id: 'integration-ubuntu-2204',
      name: 'Ubuntu 22.04 STIG Integration',
      category: 'integration',
      platform: 'Ubuntu 22.04',
      status: 'running',
      tests_count: 134,
      passed_count: 98,
      failed_count: 2,
      duration_ms: 0,
      coverage_percentage: 88
    },
    {
      id: 'integration-rhel-9',
      name: 'RHEL 9 STIG Integration',
      category: 'integration',
      platform: 'RHEL 9',
      status: 'not_run',
      tests_count: 145,
      passed_count: 0,
      failed_count: 0,
      coverage_percentage: 0
    },
    {
      id: 'performance-large-scale',
      name: 'Large Scale Environment Performance',
      category: 'performance',
      platform: 'All',
      status: 'passed',
      tests_count: 12,
      passed_count: 10,
      failed_count: 2,
      duration_ms: 180000,
      last_run: '2024-01-14T15:00:00Z',
      coverage_percentage: 75
    },
    {
      id: 'security-credential-handling',
      name: 'Security Credential Handling Tests',
      category: 'security',
      platform: 'All',
      status: 'passed',
      tests_count: 28,
      passed_count: 28,
      failed_count: 0,
      duration_ms: 5600,
      last_run: '2024-01-15T09:00:00Z',
      coverage_percentage: 100
    }
  ];

  const mockServices = [
    {
      id: 'stig-viewer-mock',
      name: 'Mock STIG Viewer API',
      status: 'running',
      port: 3001,
      endpoints: 8,
      requests_served: 1247
    },
    {
      id: 'nist-controls-mock',
      name: 'Mock NIST Controls Service',
      status: 'running',
      port: 3002,
      endpoints: 5,
      requests_served: 892
    },
    {
      id: 'evidence-storage-mock',
      name: 'Mock Evidence Storage',
      status: 'stopped',
      port: 3003,
      endpoints: 12,
      requests_served: 0
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed': return <CheckCircle className="w-4 h-4 text-success" />;
      case 'failed': return <XCircle className="w-4 h-4 text-destructive" />;
      case 'running': return <Clock className="w-4 h-4 text-warning animate-spin" />;
      case 'skipped': return <Clock className="w-4 h-4 text-muted-foreground" />;
      default: return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed': return 'default';
      case 'failed': return 'destructive';
      case 'running': return 'secondary';
      default: return 'outline';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'unit': return 'default';
      case 'integration': return 'secondary';
      case 'performance': return 'outline';
      case 'security': return 'destructive';
      default: return 'outline';
    }
  };

  const getPlatformIcon = (platform: string) => {
    if (platform.includes('Windows')) return <Monitor className="w-4 h-4" />;
    if (platform.includes('Ubuntu') || platform.includes('RHEL')) return <Server className="w-4 h-4" />;
    return <TestTube className="w-4 h-4" />;
  };

  const runAllTests = async () => {
    setIsRunning(true);
    // Simulate test execution
    setTimeout(() => {
      setIsRunning(false);
    }, 5000);
  };

  const exportTestReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      total_suites: testSuites.length,
      passed_suites: testSuites.filter(s => s.status === 'passed').length,
      failed_suites: testSuites.filter(s => s.status === 'failed').length,
      total_tests: testSuites.reduce((sum, s) => sum + s.tests_count, 0),
      total_passed: testSuites.reduce((sum, s) => sum + s.passed_count, 0),
      total_failed: testSuites.reduce((sum, s) => sum + s.failed_count, 0),
      suites: testSuites
    };
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stig-test-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const overallProgress = testSuites.reduce((sum, suite) => {
    if (suite.tests_count === 0) return sum;
    return sum + (suite.passed_count / suite.tests_count);
  }, 0) / testSuites.length * 100;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TestTube className="w-5 h-5" />
              STIG Testing Suite
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={runAllTests} disabled={isRunning} className="flex items-center gap-2">
                <Play className="w-4 h-4" />
                {isRunning ? 'Running Tests...' : 'Run All Tests'}
              </Button>
              <Button variant="outline" onClick={exportTestReport} className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export Report
              </Button>
            </div>
          </CardTitle>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Overall Test Progress</span>
              <span>{overallProgress.toFixed(1)}%</span>
            </div>
            <Progress value={overallProgress} className="w-full" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {testSuites.map((suite) => (
              <Card 
                key={suite.id}
                className={`cursor-pointer transition-colors ${
                  selectedSuite === suite.id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setSelectedSuite(selectedSuite === suite.id ? null : suite.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {getPlatformIcon(suite.platform)}
                        <h4 className="font-medium">{suite.name}</h4>
                        <Badge variant={getCategoryColor(suite.category)}>
                          {suite.category.toUpperCase()}
                        </Badge>
                        <Badge variant="outline">{suite.platform}</Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          {getStatusIcon(suite.status)}
                          <Badge variant={getStatusColor(suite.status)}>
                            {suite.status.replace('_', ' ').toUpperCase()}
                          </Badge>
                        </div>
                        
                        <span>
                          Tests: {suite.passed_count}/{suite.tests_count}
                        </span>
                        
                        {suite.coverage_percentage && (
                          <span>Coverage: {suite.coverage_percentage}%</span>
                        )}
                        
                        {suite.duration_ms && (
                          <span>Duration: {(suite.duration_ms / 1000).toFixed(1)}s</span>
                        )}
                      </div>

                      {suite.tests_count > 0 && (
                        <div className="w-64">
                          <Progress 
                            value={(suite.passed_count / suite.tests_count) * 100} 
                            className="h-2"
                          />
                        </div>
                      )}
                    </div>

                    <div className="text-right space-y-1">
                      <div className="text-sm text-success">✓ {suite.passed_count}</div>
                      <div className="text-sm text-destructive">✗ {suite.failed_count}</div>
                    </div>
                  </div>

                  {selectedSuite === suite.id && suite.failed_count > 0 && (
                    <div className="mt-4 p-3 bg-muted rounded-lg">
                      <h5 className="font-medium mb-2">Failed Tests:</h5>
                      <ul className="text-sm space-y-1 text-destructive">
                        <li>• Test timeout in large environment scenario</li>
                        <li>• Certificate validation edge case</li>
                        {suite.failed_count > 2 && (
                          <li>• ... and {suite.failed_count - 2} more failures</li>
                        )}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            Mock Services for Offline Development
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockServices.map((service) => (
              <div key={service.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{service.name}</h4>
                    <Badge variant={service.status === 'running' ? 'default' : 'outline'}>
                      {service.status.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Port: {service.port} | Endpoints: {service.endpoints} | Requests: {service.requests_served}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    variant={service.status === 'running' ? 'destructive' : 'default'}
                  >
                    {service.status === 'running' ? 'Stop' : 'Start'}
                  </Button>
                  <Button size="sm" variant="outline">
                    <FileText className="w-3 h-3 mr-1" />
                    Docs
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};