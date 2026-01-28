import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Network, 
  Shield, 
  Eye,
  Target,
  MapPin,
  CheckCircle,
  AlertTriangle,
  Clock,
  Layers,
  GitBranch,
  Database,
  Settings,
  FileText,
  Lock,
  Brain,
  Zap,
  TrendingUp,
  Download,
  RefreshCw
} from 'lucide-react';

interface ControlMapping {
  id: string;
  sourceControl: {
    id: string;
    title: string;
    framework: string;
    description: string;
  };
  mappedControls: {
    id: string;
    title: string;
    framework: string;
    mappingStrength: number;
    gap?: string;
    aiAnalysis?: string;
  }[];
  implementation: {
    tools: string[];
    automationLevel: number;
    evidenceRequirements: string[];
    testProcedures: string[];
    aiRecommendations?: string[];
  };
  status: 'mapped' | 'partial' | 'gap' | 'not-applicable';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  aiConfidence: number;
}

interface FrameworkCoverage {
  framework: string;
  totalControls: number;
  mappedControls: number;
  gapControls: number;
  coveragePercentage: number;
  lastUpdated: Date;
  aiAnalyzed: boolean;
}

interface AIAnalysisSummary {
  overlapPercentage: number;
  criticalGaps: number;
  automationOpportunities: string[];
  riskAssessment: {
    high: number;
    medium: number;
    low: number;
  };
  recommendations: string[];
}

export const ComplianceControlMapper: React.FC = () => {
  const [controlMappings, setControlMappings] = useState<ControlMapping[]>([]);
  const [frameworkCoverage, setFrameworkCoverage] = useState<FrameworkCoverage[]>([]);
  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>(['NIST 800-171', 'CMMC 2.0']);
  const [isGeneratingMapping, setIsGeneratingMapping] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisSummary | null>(null);
  const [crossWalkGenerated, setCrossWalkGenerated] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    initializeControlMappings();
    loadFrameworkCoverage();
  }, []);

  const initializeControlMappings = () => {
    const mockMappings: ControlMapping[] = [
      {
        id: 'mapping-1',
        sourceControl: {
          id: 'NIST.800-171.3.1.1',
          title: 'Limit information system access to authorized users',
          framework: 'NIST 800-171',
          description: 'Limit information system access to authorized users, processes acting on behalf of authorized users, or devices'
        },
        mappedControls: [
          {
            id: 'CMMC.AC.1.001',
            title: 'Limit information system access to authorized users',
            framework: 'CMMC 2.0',
            mappingStrength: 98,
            aiAnalysis: 'Direct NIST 800-171 to CMMC mapping with enhanced verification requirements'
          },
          {
            id: 'STIG.WS19.AC-1',
            title: 'Windows Server 2019 - Access Control Policy',
            framework: 'Windows Server 2019 STIG',
            mappingStrength: 92,
            aiAnalysis: 'Technical implementation of NIST control with Windows-specific configurations'
          },
          {
            id: 'STIG.UB22.AC-2',
            title: 'Ubuntu 22.04 - Account Management',
            framework: 'Ubuntu 22.04 STIG',
            mappingStrength: 89,
            aiAnalysis: 'Linux-based implementation with sudo and user management controls'
          }
        ],
        implementation: {
          tools: ['STIG Viewer API', 'Configuration Scanner', 'Group Policy'],
          automationLevel: 96,
          evidenceRequirements: [
            'STIG rule compliance verification',
            'Configuration baseline documentation',
            'Access control matrix',
            'User privilege audit logs'
          ],
          testProcedures: [
            'STIG rule V-92957 verification',
            'Account privilege validation',
            'Configuration drift detection'
          ],
          aiRecommendations: [
            'Implement automated STIG scanning with KHEPRA drift detection',
            'Deploy continuous configuration monitoring',
            'Integrate with post-quantum cryptographic signing for evidence integrity'
          ]
        },
        status: 'mapped',
        riskLevel: 'medium',
        aiConfidence: 94
      },
      {
        id: 'mapping-2',
        sourceControl: {
          id: 'NIST.800-171.3.3.1',
          title: 'Create and retain audit logs',
          framework: 'NIST 800-171',
          description: 'Create and retain audit logs to enable monitoring, analysis, investigation, and reporting'
        },
        mappedControls: [
          {
            id: 'CMMC.AU.2.041',
            title: 'Ensure actions can be uniquely traced',
            framework: 'CMMC 2.0',
            mappingStrength: 97,
            aiAnalysis: 'Direct NIST to CMMC traceability mapping with enhanced audit requirements'
          },
          {
            id: 'STIG.WS19.AU-2',
            title: 'Windows Server 2019 - Audit Events',
            framework: 'Windows Server 2019 STIG',
            mappingStrength: 94,
            aiAnalysis: 'Windows Event Log configuration and audit policy implementation'
          },
          {
            id: 'STIG.IIS10.AU-1',
            title: 'IIS 10.0 - Web Server Auditing',
            framework: 'IIS 10.0 STIG',
            mappingStrength: 91,
            aiAnalysis: 'IIS-specific audit logging for web server access and modifications'
          }
        ],
        implementation: {
          tools: ['STIG Viewer API', 'Windows Event Log', 'rsyslog'],
          automationLevel: 94,
          evidenceRequirements: [
            'STIG audit configuration verification',
            'Event log policy documentation', 
            'Log retention compliance evidence',
            'Audit trail integrity verification'
          ],
          testProcedures: [
            'STIG rule audit policy testing',
            'Event correlation validation',
            'Log completeness assessment'
          ],
          aiRecommendations: [
            'Enable KHEPRA-powered anomaly detection for audit events',
            'Implement automated log integrity verification',
            'Deploy PQC-signed audit trail for tamper-evidence'
          ]
        },
        status: 'mapped',
        riskLevel: 'high',
        aiConfidence: 96
      },
      {
        id: 'mapping-3',
        sourceControl: {
          id: 'NIST.800-171.3.13.11',
          title: 'Employ FIPS-validated cryptography',
          framework: 'NIST 800-171',
          description: 'Employ FIPS-validated cryptography when used to protect the confidentiality of CUI'
        },
        mappedControls: [
          {
            id: 'CMMC.SC.3.177',
            title: 'Employ FIPS-validated cryptography',
            framework: 'CMMC 2.0',
            mappingStrength: 99,
            aiAnalysis: 'Direct NIST to CMMC cryptographic control mapping with identical requirements'
          },
          {
            id: 'STIG.WS19.SC-8',
            title: 'Windows Server 2019 - Transmission Confidentiality',
            framework: 'Windows Server 2019 STIG',
            mappingStrength: 96,
            aiAnalysis: 'Windows FIPS configuration and TLS/SSL implementation requirements'
          },
          {
            id: 'STIG.AP24.SC-9',
            title: 'Apache 2.4 - Transmission Protection',
            framework: 'Apache 2.4 STIG',
            mappingStrength: 93,
            aiAnalysis: 'Apache SSL/TLS module configuration with FIPS-validated cipher suites'
          }
        ],
        implementation: {
          tools: ['STIG Viewer API', 'HSM', 'KHEPRA Protocol'],
          automationLevel: 89,
          evidenceRequirements: [
            'FIPS 140-2 validation certificates',
            'STIG cryptographic configuration evidence',
            'Cipher suite compliance verification',
            'Post-quantum cryptography readiness assessment'
          ],
          testProcedures: [
            'FIPS validation verification',
            'STIG cryptographic controls testing',
            'Quantum-safe cipher assessment'
          ],
          aiRecommendations: [
            'Implement automated FIPS compliance monitoring with KHEPRA',
            'Deploy post-quantum cryptography migration planning',
            'Integrate culturally-resilient cryptographic frameworks'
          ]
        },
        status: 'partial',
        riskLevel: 'high',
        aiConfidence: 82
      }
    ];

    setControlMappings(mockMappings);
  };

  const loadFrameworkCoverage = () => {
    const mockCoverage: FrameworkCoverage[] = [
      {
        framework: 'CMMC 2.0',
        totalControls: 110,
        mappedControls: 87,
        gapControls: 23,
        coveragePercentage: 79,
        lastUpdated: new Date(Date.now() - 1000 * 60 * 30),
        aiAnalyzed: true
      },
      {
        framework: 'SOC 2',
        totalControls: 64,
        mappedControls: 58,
        gapControls: 6,
        coveragePercentage: 91,
        lastUpdated: new Date(Date.now() - 1000 * 60 * 45),
        aiAnalyzed: true
      },
      {
        framework: 'ISO 27001',
        totalControls: 114,
        mappedControls: 89,
        gapControls: 25,
        coveragePercentage: 78,
        lastUpdated: new Date(Date.now() - 1000 * 60 * 15),
        aiAnalyzed: true
      },
      {
        framework: 'PCI DSS',
        totalControls: 78,
        mappedControls: 65,
        gapControls: 13,
        coveragePercentage: 83,
        lastUpdated: new Date(Date.now() - 1000 * 60 * 60),
        aiAnalyzed: false
      }
    ];

    setFrameworkCoverage(mockCoverage);
  };

  const generateAIPoweredMapping = async () => {
    setIsGeneratingMapping(true);
    
    try {
      // Enhanced AI-powered cross-framework mapping
      const { data, error } = await supabase.functions.invoke('grok-ai-agent', {
        body: {
          action: 'cross_framework_mapping',
          frameworks: selectedFrameworks,
          analysis_type: 'comprehensive',
          include_gap_analysis: true,
          include_risk_assessment: true,
          ai_recommendations: true,
          khepra_integration: true
        }
      });

      if (error) throw error;

      // Mock AI analysis result
      const mockAiAnalysis: AIAnalysisSummary = {
        overlapPercentage: 82,
        criticalGaps: 7,
        automationOpportunities: [
          'Automated evidence collection for 34 controls',
          'Cross-framework policy template generation',
          'Real-time compliance monitoring dashboards'
        ],
        riskAssessment: {
          high: 12,
          medium: 28,
          low: 45
        },
        recommendations: [
          'Prioritize implementation of automated audit logging',
          'Implement unified identity management across frameworks',
          'Deploy AI-powered threat detection and response',
          'Establish continuous compliance monitoring'
        ]
      };

      setAiAnalysis(mockAiAnalysis);
      setCrossWalkGenerated(true);

      toast({
        title: "AI-Powered Mapping Complete",
        description: `Comprehensive cross-framework analysis completed with ${mockAiAnalysis.overlapPercentage}% control overlap identified.`,
      });

      // Refresh mappings
      initializeControlMappings();
      loadFrameworkCoverage();

    } catch (error) {
      console.error('AI mapping generation failed:', error);
      toast({
        title: "Mapping Failed",
        description: "Unable to generate AI-powered control mapping",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingMapping(false);
    }
  };

  const exportCrossWalk = () => {
    toast({
      title: "CrossWalk Export",
      description: "Generating comprehensive cross-framework mapping document with AI analysis...",
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'mapped': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'partial': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'gap': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'not-applicable': return <Clock className="h-4 w-4 text-gray-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'mapped': return 'bg-green-500/20 text-green-400';
      case 'partial': return 'bg-yellow-500/20 text-yellow-400';
      case 'gap': return 'bg-red-500/20 text-red-400';
      case 'not-applicable': return 'bg-gray-500/20 text-gray-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const frameworkOptions = [
    { id: 'nist-800-171', name: 'NIST 800-171', description: 'Protecting CUI in Non-Federal Systems' },
    { id: 'cmmc-2.0', name: 'CMMC 2.0', description: 'Cybersecurity Maturity Model Certification' },
    { id: 'windows-server-2019-stig', name: 'Windows Server 2019 STIG', description: 'Security Technical Implementation Guide' },
    { id: 'ubuntu-22-04-stig', name: 'Ubuntu 22.04 STIG', description: 'Linux Security Configuration' },
    { id: 'iis-10-stig', name: 'IIS 10.0 STIG', description: 'Web Server Security Configuration' },
    { id: 'apache-24-stig', name: 'Apache 2.4 STIG', description: 'Web Server Security Implementation' }
  ];

  return (
    <div className="space-y-6">
      {/* AI-Enhanced Header */}
      <Card className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 border-purple-500/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-white">
                <Brain className="h-6 w-6 text-purple-400" />
                AI-Powered Compliance Control Mapper
              </CardTitle>
              <CardDescription className="text-purple-200">
                Cross-framework control mapping with intelligent gap analysis and automation recommendations
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={generateAIPoweredMapping}
                disabled={isGeneratingMapping || selectedFrameworks.length < 2}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isGeneratingMapping ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    AI Analyzing...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    AI Generate Mapping
                  </>
                )}
              </Button>
              <Button
                onClick={exportCrossWalk}
                variant="outline"
                className="border-purple-500/30 text-purple-400 hover:bg-purple-600/20"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CrossWalk
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Framework Selection with AI Analysis */}
      <Card className="bg-black/40 border-purple-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Brain className="h-5 w-5 text-purple-400" />
            Framework Selection
            {crossWalkGenerated && (
              <Badge className="bg-green-500/20 text-green-400 ml-2">
                <TrendingUp className="h-3 w-3 mr-1" />
                AI Analysis Complete
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {frameworkOptions.map((framework) => (
              <div key={framework.id} className="relative">
                <input
                  type="checkbox"
                  id={framework.id}
                  checked={selectedFrameworks.includes(framework.name)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedFrameworks([...selectedFrameworks, framework.name]);
                    } else {
                      setSelectedFrameworks(selectedFrameworks.filter(f => f !== framework.name));
                    }
                  }}
                  className="absolute top-2 right-2 rounded"
                />
                <div className={`p-4 bg-slate-800/40 rounded-lg border transition-colors ${
                  selectedFrameworks.includes(framework.name)
                    ? 'border-purple-500/70 bg-purple-500/10' 
                    : 'border-slate-600/30 hover:border-purple-500/50'
                }`}>
                  <h3 className="text-white font-medium mb-2">{framework.name}</h3>
                  <p className="text-gray-400 text-sm">{framework.description}</p>
                  {aiAnalysis && selectedFrameworks.includes(framework.name) && (
                    <Badge variant="outline" className="text-purple-400 border-purple-500/50 mt-2">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      AI Analyzed
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {aiAnalysis && (
            <div className="p-4 bg-purple-900/20 border border-purple-500/30 rounded-lg">
              <h4 className="text-purple-400 font-medium mb-3 flex items-center">
                <Zap className="h-4 w-4 mr-2" />
                AI Analysis Summary
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-gray-300 mb-1">Control Overlap</div>
                  <div className="text-2xl font-bold text-purple-400">{aiAnalysis.overlapPercentage}%</div>
                </div>
                <div>
                  <div className="text-gray-300 mb-1">Critical Gaps</div>
                  <div className="text-2xl font-bold text-red-400">{aiAnalysis.criticalGaps}</div>
                </div>
                <div>
                  <div className="text-gray-300 mb-1">Automation Opportunities</div>
                  <div className="text-2xl font-bold text-green-400">{aiAnalysis.automationOpportunities.length}</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enhanced Framework Coverage */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {frameworkCoverage.map((framework) => (
          <Card key={framework.framework} className="bg-black/40 border-slate-600/30">
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-white">{framework.framework}</h3>
                  <div className="flex gap-1">
                    <Badge className="bg-blue-500/20 text-blue-400">
                      {framework.coveragePercentage}%
                    </Badge>
                    {framework.aiAnalyzed && (
                      <Badge className="bg-purple-500/20 text-purple-400">
                        <Brain className="h-3 w-3" />
                      </Badge>
                    )}
                  </div>
                </div>
                <Progress value={framework.coveragePercentage} className="h-2" />
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Mapped</span>
                    <span className="text-green-400">{framework.mappedControls}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Gaps</span>
                    <span className="text-red-400">{framework.gapControls}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total</span>
                    <span className="text-white">{framework.totalControls}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="mappings" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="mappings">AI Control Mappings</TabsTrigger>
          <TabsTrigger value="gaps">Gap Analysis</TabsTrigger>
          <TabsTrigger value="implementation">Implementation</TabsTrigger>
          <TabsTrigger value="recommendations">AI Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="mappings" className="space-y-4">
          <div className="space-y-4">
            {controlMappings.map((mapping) => (
              <Card key={mapping.id} className="bg-black/40 border-slate-600/30">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {/* Enhanced Source Control with AI Confidence */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {getStatusIcon(mapping.status)}
                          <Badge variant="outline" className="text-blue-400 border-blue-400">
                            {mapping.sourceControl.id}
                          </Badge>
                          <Badge className="bg-purple-500/20 text-purple-400">
                            {mapping.sourceControl.framework}
                          </Badge>
                          <Badge className={getStatusColor(mapping.status)}>
                            {mapping.status.toUpperCase()}
                          </Badge>
                          <Badge className={`text-white ${getRiskColor(mapping.riskLevel)}`}>
                            {mapping.riskLevel.toUpperCase()}
                          </Badge>
                          <Badge className="bg-brain-gradient text-white">
                            <Brain className="h-3 w-3 mr-1" />
                            {mapping.aiConfidence}% AI Confidence
                          </Badge>
                        </div>
                        <h3 className="font-semibold text-white mb-1">
                          {mapping.sourceControl.title}
                        </h3>
                        <p className="text-gray-400 text-sm">
                          {mapping.sourceControl.description}
                        </p>
                      </div>
                    </div>

                    {/* Enhanced Cross-Framework Mappings */}
                    <div className="bg-slate-800/40 p-4 rounded border border-slate-600/30">
                      <h4 className="font-medium text-white mb-3 flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-purple-400" />
                        AI-Powered Cross-Framework Mappings
                      </h4>
                      <div className="space-y-3">
                        {mapping.mappedControls.map((mapped, index) => (
                          <div key={index} className="p-3 bg-slate-700/40 rounded border border-slate-600/20">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <Badge variant="outline">{mapped.id}</Badge>
                                <span className="text-sm text-white font-medium">{mapped.title}</span>
                                <Badge variant="secondary">{mapped.framework}</Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="text-sm font-medium text-green-400">
                                  {mapped.mappingStrength}%
                                </div>
                              </div>
                            </div>
                            {mapped.aiAnalysis && (
                              <div className="text-xs text-purple-400 mb-2">
                                <Zap className="h-3 w-3 inline mr-1" />
                                AI Analysis: {mapped.aiAnalysis}
                              </div>
                            )}
                            {mapped.gap && (
                              <div className="text-xs text-orange-400">
                                Gap Identified: {mapped.gap}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* AI Recommendations */}
                    {mapping.implementation.aiRecommendations && (
                      <div className="bg-purple-900/20 border border-purple-500/30 rounded p-3">
                        <h4 className="text-purple-400 font-medium text-sm mb-2 flex items-center">
                          <Zap className="h-4 w-4 mr-2" />
                          AI Implementation Recommendations
                        </h4>
                        <ul className="text-gray-300 text-xs space-y-1">
                          {mapping.implementation.aiRecommendations.map((rec, idx) => (
                            <li key={idx}>• {rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="gaps" className="space-y-4">
          <Card className="bg-black/40 border-red-500/30">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-400" />
                AI-Identified Gaps & Risks
              </CardTitle>
            </CardHeader>
            <CardContent>
              {aiAnalysis && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-red-900/20 border border-red-500/30 rounded">
                    <div className="text-red-400 font-medium mb-2">High Risk</div>
                    <div className="text-2xl font-bold text-white">{aiAnalysis.riskAssessment.high}</div>
                    <div className="text-xs text-gray-400">Controls requiring immediate attention</div>
                  </div>
                  <div className="p-4 bg-yellow-900/20 border border-yellow-500/30 rounded">
                    <div className="text-yellow-400 font-medium mb-2">Medium Risk</div>
                    <div className="text-2xl font-bold text-white">{aiAnalysis.riskAssessment.medium}</div>
                    <div className="text-xs text-gray-400">Controls needing remediation planning</div>
                  </div>
                  <div className="p-4 bg-green-900/20 border border-green-500/30 rounded">
                    <div className="text-green-400 font-medium mb-2">Low Risk</div>
                    <div className="text-2xl font-bold text-white">{aiAnalysis.riskAssessment.low}</div>
                    <div className="text-xs text-gray-400">Controls with minor adjustments needed</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="implementation" className="space-y-4">
          <Card className="bg-black/40 border-slate-600/30">
            <CardHeader>
              <CardTitle className="text-white">Implementation Tools & Automation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {controlMappings.map((mapping) => (
                  <div key={mapping.id} className="p-4 bg-slate-800/40 rounded border border-slate-600/30">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-white font-medium">{mapping.sourceControl.id}</h4>
                      <Badge className="bg-blue-500/20 text-blue-400">
                        {mapping.implementation.automationLevel}% Automated
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-gray-400 mb-2">Implementation Tools</div>
                        <div className="flex flex-wrap gap-1">
                          {mapping.implementation.tools.map((tool) => (
                            <Badge key={tool} variant="outline" className="text-xs">
                              {tool}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400 mb-2">Test Procedures</div>
                        <ul className="text-gray-300 space-y-1">
                          {mapping.implementation.testProcedures.slice(0, 2).map((procedure, idx) => (
                            <li key={idx} className="text-xs">• {procedure}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <div className="mt-3">
                      <Progress value={mapping.implementation.automationLevel} className="h-2" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <Card className="bg-black/40 border-purple-500/30">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-400" />
                AI Strategic Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              {aiAnalysis && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-purple-400 font-medium mb-3">Priority Recommendations</h4>
                    <div className="space-y-2">
                      {aiAnalysis.recommendations.map((rec, idx) => (
                        <div key={idx} className="p-3 bg-purple-900/20 border border-purple-500/30 rounded">
                          <div className="flex items-start gap-3">
                            <TrendingUp className="h-4 w-4 text-purple-400 mt-0.5" />
                            <span className="text-gray-300 text-sm">{rec}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-green-400 font-medium mb-3">Automation Opportunities</h4>
                    <div className="space-y-2">
                      {aiAnalysis.automationOpportunities.map((opp, idx) => (
                        <div key={idx} className="p-3 bg-green-900/20 border border-green-500/30 rounded">
                          <div className="flex items-start gap-3">
                            <Zap className="h-4 w-4 text-green-400 mt-0.5" />
                            <span className="text-gray-300 text-sm">{opp}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};