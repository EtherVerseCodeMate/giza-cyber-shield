import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, AlertTriangle, FileText, Target, Zap, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CMMCSTIGBridgeProps {
  organizationId: string;
}

interface ComplianceStatus {
  cmmc_level: number;
  total_assets: number;
  compliant_assets: number;
  compliance_percentage: number;
  overall_status: string;
  next_assessment_due: string;
  recommendations: string[];
}

interface ImplementationPlan {
  phases: Array<{
    phase: number;
    name: string;
    duration_weeks: number;
    tasks: string[];
  }>;
  estimated_completion: string;
  priority_controls: string[];
}

export const CMMCSTIGBridge: React.FC<CMMCSTIGBridgeProps> = ({ organizationId }) => {
  const [loading, setLoading] = useState(false);
  const [complianceStatus, setComplianceStatus] = useState<ComplianceStatus | null>(null);
  const [implementationPlan, setImplementationPlan] = useState<ImplementationPlan | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<number>(3);
  const [selectedFamilies, setSelectedFamilies] = useState<string[]>([]);
  const [evidenceCount, setEvidenceCount] = useState(0);
  const [poamCount, setPOAMCount] = useState(0);

  const controlFamilies = [
    'Access Control',
    'Audit and Accountability', 
    'Configuration Management',
    'Identification and Authentication',
    'Incident Response',
    'System and Communications Protection'
  ];

  useEffect(() => {
    loadComplianceStatus();
  }, [organizationId]);

  const loadComplianceStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('cmmc-stig-bridge', {
        body: {
          action: 'validate_compliance',
          organization_id: organizationId,
          cmmc_level: selectedLevel
        }
      });

      if (error) throw error;
      setComplianceStatus(data.compliance_status);
    } catch (error) {
      console.error('Error loading compliance status:', error);
      toast.error('Failed to load compliance status');
    }
  };

  const generateMapping = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('cmmc-stig-bridge', {
        body: {
          action: 'generate_mapping',
          organization_id: organizationId,
          cmmc_level: selectedLevel,
          control_families: selectedFamilies
        }
      });

      if (error) throw error;
      
      setImplementationPlan(data.implementation_plan);
      toast.success(`Generated mapping for ${data.mapped_controls} controls`);
    } catch (error) {
      console.error('Error generating mapping:', error);
      toast.error('Failed to generate CMMC-STIG mapping');
    } finally {
      setLoading(false);
    }
  };

  const collectEvidence = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('cmmc-stig-bridge', {
        body: {
          action: 'collect_evidence',
          organization_id: organizationId
        }
      });

      if (error) throw error;
      
      setEvidenceCount(data.evidence_collected);
      toast.success(`Collected ${data.evidence_collected} evidence items`);
    } catch (error) {
      console.error('Error collecting evidence:', error);
      toast.error('Failed to collect automated evidence');
    } finally {
      setLoading(false);
    }
  };

  const generatePOAM = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('cmmc-stig-bridge', {
        body: {
          action: 'create_poam',
          organization_id: organizationId
        }
      });

      if (error) throw error;
      
      setPOAMCount(data.poam_entries);
      toast.success(`Generated ${data.poam_entries} POAM entries`);
    } catch (error) {
      console.error('Error generating POAM:', error);
      toast.error('Failed to generate POAM');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLIANT': return 'bg-green-500';
      case 'NON_COMPLIANT': return 'bg-red-500';
      default: return 'bg-yellow-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">CMMC-to-STIG Bridge</h2>
          <p className="text-muted-foreground">
            Automated CMMC compliance through STIG implementation
          </p>
        </div>
        <Badge variant="secondary" className="text-lg px-4 py-2">
          <Zap className="w-4 h-4 mr-2" />
          Autopilot Mode
        </Badge>
      </div>

      {/* Compliance Status Overview */}
      {complianceStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              CMMC Level {complianceStatus.cmmc_level} Compliance Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{complianceStatus.total_assets}</div>
                <div className="text-sm text-muted-foreground">Total Assets</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{complianceStatus.compliant_assets}</div>
                <div className="text-sm text-muted-foreground">Compliant Assets</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{complianceStatus.compliance_percentage}%</div>
                <div className="text-sm text-muted-foreground">Compliance Rate</div>
                <Progress value={complianceStatus.compliance_percentage} className="mt-2" />
              </div>
              <div className="text-center">
                <Badge className={`${getStatusColor(complianceStatus.overall_status)} text-white`}>
                  {complianceStatus.overall_status}
                </Badge>
                <div className="text-sm text-muted-foreground mt-1">Overall Status</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="mapping" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="mapping">STIG Mapping</TabsTrigger>
          <TabsTrigger value="evidence">Evidence Collection</TabsTrigger>
          <TabsTrigger value="poam">POAM Generation</TabsTrigger>
          <TabsTrigger value="implementation">Implementation</TabsTrigger>
        </TabsList>

        {/* STIG Mapping Tab */}
        <TabsContent value="mapping">
          <Card>
            <CardHeader>
              <CardTitle>CMMC-to-STIG Control Mapping</CardTitle>
              <CardDescription>
                Generate automated mapping between CMMC controls and STIG requirements
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">CMMC Level</label>
                  <Select value={selectedLevel.toString()} onValueChange={(value) => setSelectedLevel(parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Level 1 - Basic Cyber Hygiene</SelectItem>
                      <SelectItem value="2">Level 2 - Intermediate Cyber Hygiene</SelectItem>
                      <SelectItem value="3">Level 3 - Good Cyber Hygiene</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Control Families (Optional)</label>
                  <Select onValueChange={(value) => {
                    if (!selectedFamilies.includes(value)) {
                      setSelectedFamilies([...selectedFamilies, value]);
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select control families" />
                    </SelectTrigger>
                    <SelectContent>
                      {controlFamilies.map((family) => (
                        <SelectItem key={family} value={family}>{family}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedFamilies.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedFamilies.map((family) => (
                    <Badge key={family} variant="secondary" className="cursor-pointer" 
                           onClick={() => setSelectedFamilies(selectedFamilies.filter(f => f !== family))}>
                      {family} ×
                    </Badge>
                  ))}
                </div>
              )}

              <Button onClick={generateMapping} disabled={loading} className="w-full">
                {loading ? 'Generating...' : 'Generate CMMC-STIG Mapping'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Evidence Collection Tab */}
        <TabsContent value="evidence">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Automated Evidence Collection
              </CardTitle>
              <CardDescription>
                Collect compliance evidence from discovered assets automatically
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{evidenceCount}</div>
                  <div className="text-sm text-muted-foreground">Evidence Items</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {complianceStatus?.total_assets || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Assets Scanned</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">Auto</div>
                  <div className="text-sm text-muted-foreground">Collection Mode</div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Evidence Types Collected:</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm">System Configurations</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm">Service Inventories</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm">Vulnerability Assessments</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm">Compliance Status Reports</span>
                  </div>
                </div>
              </div>

              <Button onClick={collectEvidence} disabled={loading} className="w-full">
                {loading ? 'Collecting...' : 'Start Evidence Collection'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* POAM Generation Tab */}
        <TabsContent value="poam">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Plan of Action & Milestones (POAM)
              </CardTitle>
              <CardDescription>
                Automatically generate POAM entries for identified findings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{poamCount}</div>
                  <div className="text-sm text-muted-foreground">POAM Entries</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {complianceStatus ? complianceStatus.total_assets - complianceStatus.compliant_assets : 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Non-Compliant Assets</div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">POAM includes:</h4>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• Weakness descriptions and severity levels</li>
                  <li>• Affected CMMC controls mapping</li>
                  <li>• Detailed remediation plans</li>
                  <li>• Estimated completion timelines</li>
                  <li>• Responsible party assignments</li>
                </ul>
              </div>

              <Button onClick={generatePOAM} disabled={loading} className="w-full">
                {loading ? 'Generating...' : 'Generate POAM'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Implementation Plan Tab */}
        <TabsContent value="implementation">
          {implementationPlan ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Implementation Roadmap
                </CardTitle>
                <CardDescription>
                  Estimated completion: {implementationPlan.estimated_completion}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {implementationPlan.phases.map((phase) => (
                    <div key={phase.phase} className="border-l-4 border-blue-500 pl-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">
                          Phase {phase.phase}: {phase.name}
                        </h4>
                        <Badge variant="outline">
                          {phase.duration_weeks} weeks
                        </Badge>
                      </div>
                      <ul className="text-sm space-y-1 text-muted-foreground">
                        {phase.tasks.map((task, index) => (
                          <li key={index}>• {task}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-muted-foreground">
                  Generate CMMC-STIG mapping first to see implementation plan
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Recommendations */}
      {complianceStatus?.recommendations && (
        <Card>
          <CardHeader>
            <CardTitle>Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {complianceStatus.recommendations.map((rec, index) => (
                <li key={index} className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
};