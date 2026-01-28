/**
 * DemoTour - Public demo/tour view accessible without authentication
 * Shows platform capabilities with sample data for unauthenticated users
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Shield,
  Search,
  Brain,
  Activity,
  CheckCircle,
  AlertTriangle,
  Database,
  TrendingUp,
  Play,
  ArrowRight,
  Info,
  Sparkles,
  Lock
} from 'lucide-react';

const DemoTour = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

  // Sample demo data
  const demoSTIGs = [
    { id: 'RHEL_8_STIG', name: 'RHEL 8 STIG', version: 'V1R14', findings: 234, compliant: 198 },
    { id: 'WIN_2022_STIG', name: 'Windows Server 2022 STIG', version: 'V2R2', findings: 312, compliant: 287 },
    { id: 'UBUNTU_22_STIG', name: 'Ubuntu 22.04 STIG', version: 'V1R1', findings: 189, compliant: 175 },
  ];

  const demoDriftAlerts = [
    { id: 1, severity: 'high', rule: 'V-230234', message: 'SSH idle timeout changed from 900 to 0', time: '2 hours ago' },
    { id: 2, severity: 'medium', rule: 'V-230311', message: 'Password complexity requirements modified', time: '5 hours ago' },
    { id: 3, severity: 'low', rule: 'V-230385', message: 'Audit log retention changed', time: '1 day ago' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-blue-900 dark:to-indigo-900">
      {/* Demo Mode Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Play className="h-5 w-5" />
            <span className="font-medium">Demo Mode</span>
            <Badge variant="outline" className="text-white border-white/50">
              Sample Data
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-white border-white/50 hover:bg-white/20"
            onClick={() => navigate('/auth?redirect=/onboarding')}
          >
            <Lock className="h-4 w-4 mr-2" />
            Sign Up for Full Access
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                STIG Compliance Platform
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Interactive demonstration of AI-powered compliance automation
              </p>
            </div>
          </div>
        </div>

        {/* Main Demo Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white/80 dark:bg-gray-800/80 backdrop-blur">
            <TabsTrigger value="overview">Platform Overview</TabsTrigger>
            <TabsTrigger value="stig-search">STIG Search</TabsTrigger>
            <TabsTrigger value="drift">Drift Detection</TabsTrigger>
            <TabsTrigger value="baselines">Baselines</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200">
              <Info className="h-4 w-4" />
              <AlertTitle>Welcome to the Demo Tour</AlertTitle>
              <AlertDescription>
                Explore our STIG compliance automation capabilities. All data shown is sample data for demonstration purposes.
              </AlertDescription>
            </Alert>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { icon: Search, title: 'STIG Search', desc: 'Search 10,000+ configurations', color: 'blue' },
                { icon: Brain, title: 'AI Verification', desc: 'Automated compliance checks', color: 'purple' },
                { icon: Database, title: 'Baselines', desc: 'Capture & track configurations', color: 'green' },
                { icon: Activity, title: 'Drift Detection', desc: 'Real-time monitoring', color: 'orange' },
              ].map((feature, i) => (
                <Card key={i} className="bg-white/80 dark:bg-gray-800/80 backdrop-blur hover:shadow-lg transition-shadow">
                  <CardContent className="pt-6">
                    <div className={`w-12 h-12 rounded-xl bg-${feature.color}-100 dark:bg-${feature.color}-950/50 flex items-center justify-center mb-4`}>
                      <feature.icon className={`h-6 w-6 text-${feature.color}-600`} />
                    </div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{feature.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{feature.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Sample Compliance Overview */}
            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Sample Compliance Overview
                </CardTitle>
                <CardDescription>Demonstration data showing typical compliance metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  {demoSTIGs.map((stig) => {
                    const compliance = Math.round((stig.compliant / stig.findings) * 100);
                    return (
                      <div key={stig.id} className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900 dark:text-white">{stig.name}</span>
                          <Badge variant="outline">{stig.version}</Badge>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${compliance >= 90 ? 'bg-green-500' : compliance >= 70 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${compliance}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">{compliance}%</span>
                        </div>
                        <p className="text-xs text-gray-500">
                          {stig.compliant} of {stig.findings} findings compliant
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* STIG Search Tab */}
          <TabsContent value="stig-search" className="space-y-6">
            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5 text-blue-600" />
                  STIG Configuration Search
                </CardTitle>
                <CardDescription>
                  Search our database of 10,000+ STIG configurations across multiple platforms
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Search STIGs (e.g., 'SSH timeout', 'password policy')"
                    className="flex-1 px-4 py-2 border rounded-lg bg-white dark:bg-gray-900"
                    disabled
                  />
                  <Button disabled>
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </Button>
                </div>
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Sign up to access full search capabilities with AI-powered recommendations
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Drift Detection Tab */}
          <TabsContent value="drift" className="space-y-6">
            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-orange-600" />
                  Configuration Drift Alerts
                </CardTitle>
                <CardDescription>
                  Real-time monitoring detects when configurations drift from approved baselines
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {demoDriftAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-4 rounded-lg border ${
                        alert.severity === 'high'
                          ? 'bg-red-50 dark:bg-red-950/20 border-red-200'
                          : alert.severity === 'medium'
                          ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200'
                          : 'bg-blue-50 dark:bg-blue-950/20 border-blue-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <AlertTriangle
                            className={`h-5 w-5 mt-0.5 ${
                              alert.severity === 'high'
                                ? 'text-red-600'
                                : alert.severity === 'medium'
                                ? 'text-amber-600'
                                : 'text-blue-600'
                            }`}
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={alert.severity === 'high' ? 'destructive' : 'outline'}
                              >
                                {alert.severity.toUpperCase()}
                              </Badge>
                              <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                                {alert.rule}
                              </code>
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                              {alert.message}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs text-gray-500">{alert.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Baselines Tab */}
          <TabsContent value="baselines" className="space-y-6">
            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-green-600" />
                  Configuration Baselines
                </CardTitle>
                <CardDescription>
                  Capture approved configurations as baselines for compliance tracking
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-900/50">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-medium">Production RHEL Baseline</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Captured: Jan 15, 2026 • 234 rules
                    </p>
                    <Badge variant="outline" className="text-green-600 border-green-200">Active</Badge>
                  </div>
                  <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-900/50">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-medium">Windows Server Baseline</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Captured: Jan 10, 2026 • 312 rules
                    </p>
                    <Badge variant="outline" className="text-green-600 border-green-200">Active</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* CTA Section */}
        <Card className="mt-8 bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0">
          <CardContent className="py-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Ready to Automate Your STIG Compliance?</h2>
              <p className="text-blue-100 mb-6 max-w-2xl mx-auto">
                Connect your environment for real-time compliance monitoring, AI-powered verification, and automated drift detection.
              </p>
              <div className="flex items-center justify-center gap-4">
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={() => navigate('/auth?redirect=/onboarding')}
                >
                  Start Free Trial
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-white border-white/50 hover:bg-white/20"
                  onClick={() => navigate('/onboarding')}
                >
                  Back to Options
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DemoTour;
