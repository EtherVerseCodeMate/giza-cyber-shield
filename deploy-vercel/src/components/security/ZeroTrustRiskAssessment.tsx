import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  Shield, 
  Activity, 
  BarChart3,
  TrendingUp,
  TrendingDown,
  Eye,
  Users,
  Network,
  Lock,
  Smartphone,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';

interface RiskAssessment {
  id: string;
  assessment_type: string;
  subject_id: string;
  overall_risk_score: number;
  risk_categories: any;
  threat_indicators: any;
  vulnerability_score: number;
  compliance_score: number;
  behavioral_anomalies: any;
  recommendations: any;
  assessment_timestamp: string;
  status: string;
}

interface RiskMetrics {
  overallRisk: number;
  userRisk: number;
  deviceRisk: number;
  networkRisk: number;
  applicationRisk: number;
  dataRisk: number;
  trendDirection: 'up' | 'down' | 'stable';
  criticalIssues: number;
  totalAssessments: number;
}

const ZeroTrustRiskAssessment = () => {
  const [assessments, setAssessments] = useState<RiskAssessment[]>([]);
  const [metrics, setMetrics] = useState<RiskMetrics>({
    overallRisk: 25,
    userRisk: 20,
    deviceRisk: 30,
    networkRisk: 15,
    applicationRisk: 35,
    dataRisk: 40,
    trendDirection: 'down',
    criticalIssues: 2,
    totalAssessments: 0
  });
  const [loading, setLoading] = useState(false);
  const [assessing, setAssessing] = useState(false);

  const { toast } = useToast();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    if (currentOrganization) {
      loadRiskAssessments();
    }
  }, [currentOrganization]);

  const loadRiskAssessments = async () => {
    if (!currentOrganization) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('zero_trust_risk_assessments')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .eq('status', 'active')
        .order('assessment_timestamp', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      setAssessments(data || []);
      calculateRiskMetrics(data || []);
    } catch (error: any) {
      console.error('Error loading risk assessments:', error);
      toast({
        title: "Error Loading Risk Assessments",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateRiskMetrics = (assessments: RiskAssessment[]) => {
    if (assessments.length === 0) return;

    const byType = assessments.reduce((acc, assessment) => {
      if (!acc[assessment.assessment_type]) {
        acc[assessment.assessment_type] = [];
      }
      acc[assessment.assessment_type].push(assessment.overall_risk_score);
      return acc;
    }, {} as Record<string, number[]>);

    const avgByType = Object.entries(byType).reduce((acc, [type, scores]) => {
      acc[type] = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
      return acc;
    }, {} as Record<string, number>);

    const overallRisk = Math.round(
      assessments.reduce((sum, a) => sum + a.overall_risk_score, 0) / assessments.length
    );

    const criticalIssues = assessments.filter(a => a.overall_risk_score > 70).length;

    setMetrics({
      overallRisk,
      userRisk: avgByType.user || 0,
      deviceRisk: avgByType.device || 0,
      networkRisk: avgByType.network || 0,
      applicationRisk: avgByType.application || 0,
      dataRisk: avgByType.data || 0,
      trendDirection: overallRisk < 30 ? 'down' : overallRisk > 50 ? 'up' : 'stable',
      criticalIssues,
      totalAssessments: assessments.length
    });
  };

  const performComprehensiveAssessment = async () => {
    if (!currentOrganization || !user) return;

    setAssessing(true);
    try {
      // Simulate comprehensive risk assessment across all categories
      const assessmentTypes = ['user', 'device', 'network', 'application', 'data'] as const;
      
      for (const type of assessmentTypes) {
        const assessment = await generateRiskAssessment(type);
        
        await supabase
          .from('zero_trust_risk_assessments')
          .insert([{
            organization_id: currentOrganization.id,
            assessment_type: type,
            subject_id: type === 'user' ? user.id : `${type}_assessment_${Date.now()}`,
            overall_risk_score: assessment.overallRiskScore,
            risk_categories: assessment.riskCategories,
            threat_indicators: assessment.threatIndicators,
            vulnerability_score: assessment.vulnerabilityScore,
            compliance_score: assessment.complianceScore,
            behavioral_anomalies: assessment.behavioralAnomalies,
            recommendations: assessment.recommendations
          }]);
      }

      toast({
        title: "Comprehensive Assessment Complete",
        description: "Risk assessment has been performed across all security domains.",
        variant: "default"
      });

      loadRiskAssessments();
    } catch (error: any) {
      console.error('Error performing assessment:', error);
      toast({
        title: "Error Performing Assessment",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setAssessing(false);
    }
  };

  const generateRiskAssessment = async (type: string) => {
    // Simulate different risk assessment types
    const baseRisk = Math.floor(Math.random() * 40) + 10; // 10-50 base risk
    
    const assessmentData = {
      user: {
        overallRiskScore: baseRisk,
        vulnerabilityScore: Math.floor(Math.random() * 30) + 10,
        complianceScore: Math.floor(Math.random() * 20) + 80,
        riskCategories: {
          authentication: Math.floor(Math.random() * 20) + 10,
          session_behavior: Math.floor(Math.random() * 30) + 5,
          access_patterns: Math.floor(Math.random() * 25) + 15,
          privilege_usage: Math.floor(Math.random() * 20) + 20
        },
        threatIndicators: [
          { type: 'unusual_login_times', severity: 'low' },
          { type: 'multiple_locations', severity: 'medium' }
        ],
        behavioralAnomalies: [
          { anomaly: 'login_pattern_change', confidence: 0.7 }
        ],
        recommendations: [
          'Enable additional MFA methods',
          'Review recent access patterns',
          'Update security training completion'
        ]
      },
      device: {
        overallRiskScore: baseRisk + 5,
        vulnerabilityScore: Math.floor(Math.random() * 40) + 20,
        complianceScore: Math.floor(Math.random() * 15) + 85,
        riskCategories: {
          os_security: Math.floor(Math.random() * 25) + 15,
          patch_status: Math.floor(Math.random() * 30) + 10,
          encryption: Math.floor(Math.random() * 20) + 5,
          malware_protection: Math.floor(Math.random() * 15) + 10
        },
        threatIndicators: [
          { type: 'outdated_os', severity: 'medium' },
          { type: 'missing_patches', severity: 'high' }
        ],
        behavioralAnomalies: [
          { anomaly: 'unusual_network_activity', confidence: 0.8 }
        ],
        recommendations: [
          'Update operating system',
          'Install security patches',
          'Enable full disk encryption'
        ]
      },
      network: {
        overallRiskScore: Math.max(10, baseRisk - 10),
        vulnerabilityScore: Math.floor(Math.random() * 25) + 15,
        complianceScore: Math.floor(Math.random() * 10) + 90,
        riskCategories: {
          segmentation: Math.floor(Math.random() * 20) + 5,
          traffic_monitoring: Math.floor(Math.random() * 15) + 10,
          access_controls: Math.floor(Math.random() * 25) + 15,
          threat_detection: Math.floor(Math.random() * 20) + 20
        },
        threatIndicators: [
          { type: 'suspicious_traffic', severity: 'low' },
          { type: 'unauthorized_protocols', severity: 'medium' }
        ],
        behavioralAnomalies: [],
        recommendations: [
          'Implement micro-segmentation',
          'Enhance traffic monitoring',
          'Update firewall rules'
        ]
      },
      application: {
        overallRiskScore: baseRisk + 10,
        vulnerabilityScore: Math.floor(Math.random() * 35) + 25,
        complianceScore: Math.floor(Math.random() * 25) + 75,
        riskCategories: {
          code_security: Math.floor(Math.random() * 30) + 20,
          dependency_vulnerabilities: Math.floor(Math.random() * 40) + 30,
          access_controls: Math.floor(Math.random() * 25) + 15,
          data_handling: Math.floor(Math.random() * 20) + 10
        },
        threatIndicators: [
          { type: 'vulnerable_dependencies', severity: 'high' },
          { type: 'insecure_configurations', severity: 'medium' }
        ],
        behavioralAnomalies: [
          { anomaly: 'unusual_api_calls', confidence: 0.6 }
        ],
        recommendations: [
          'Update vulnerable dependencies',
          'Implement code signing',
          'Enable runtime protection'
        ]
      },
      data: {
        overallRiskScore: baseRisk + 15,
        vulnerabilityScore: Math.floor(Math.random() * 30) + 30,
        complianceScore: Math.floor(Math.random() * 20) + 80,
        riskCategories: {
          classification: Math.floor(Math.random() * 25) + 20,
          encryption: Math.floor(Math.random() * 20) + 15,
          access_monitoring: Math.floor(Math.random() * 30) + 25,
          backup_security: Math.floor(Math.random() * 15) + 10
        },
        threatIndicators: [
          { type: 'unclassified_sensitive_data', severity: 'high' },
          { type: 'excessive_access_permissions', severity: 'medium' }
        ],
        behavioralAnomalies: [
          { anomaly: 'bulk_data_access', confidence: 0.9 }
        ],
        recommendations: [
          'Implement data classification',
          'Enable DLP policies',
          'Review access permissions'
        ]
      }
    };

    return assessmentData[type as keyof typeof assessmentData] || assessmentData.user;
  };

  const getRiskColor = (score: number) => {
    if (score <= 30) return 'text-success';
    if (score <= 60) return 'text-warning';
    return 'text-destructive';
  };

  const getRiskBadge = (score: number) => {
    if (score <= 30) return { variant: 'default' as const, label: 'Low Risk' };
    if (score <= 60) return { variant: 'secondary' as const, label: 'Medium Risk' };
    return { variant: 'destructive' as const, label: 'High Risk' };
  };

  const getAssessmentIcon = (type: string) => {
    const icons = {
      user: Users,
      device: Smartphone,
      network: Network,
      application: Activity,
      data: Lock
    };
    const Icon = icons[type as keyof typeof icons] || Shield;
    return <Icon className="h-4 w-4" />;
  };

  const getTrendIcon = () => {
    switch (metrics.trendDirection) {
      case 'up': return <TrendingUp className="h-4 w-4 text-destructive" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-success" />;
      default: return <Activity className="h-4 w-4 text-warning" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Risk Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="card-cyber">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overall Risk</p>
                <div className={`text-2xl font-bold ${getRiskColor(metrics.overallRisk)}`}>
                  {metrics.overallRisk}%
                </div>
              </div>
              <div className="flex items-center space-x-1">
                {getTrendIcon()}
              </div>
            </div>
            <Progress value={metrics.overallRisk} className="mt-2" />
          </CardContent>
        </Card>

        <Card className="card-cyber">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Users</span>
            </div>
            <div className={`text-xl font-bold ${getRiskColor(metrics.userRisk)}`}>
              {metrics.userRisk}%
            </div>
            <Progress value={metrics.userRisk} className="mt-2" />
          </CardContent>
        </Card>

        <Card className="card-cyber">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Devices</span>
            </div>
            <div className={`text-xl font-bold ${getRiskColor(metrics.deviceRisk)}`}>
              {metrics.deviceRisk}%
            </div>
            <Progress value={metrics.deviceRisk} className="mt-2" />
          </CardContent>
        </Card>

        <Card className="card-cyber">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Network className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Network</span>
            </div>
            <div className={`text-xl font-bold ${getRiskColor(metrics.networkRisk)}`}>
              {metrics.networkRisk}%
            </div>
            <Progress value={metrics.networkRisk} className="mt-2" />
          </CardContent>
        </Card>

        <Card className="card-cyber">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Apps</span>
            </div>
            <div className={`text-xl font-bold ${getRiskColor(metrics.applicationRisk)}`}>
              {metrics.applicationRisk}%
            </div>
            <Progress value={metrics.applicationRisk} className="mt-2" />
          </CardContent>
        </Card>

        <Card className="card-cyber">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Data</span>
            </div>
            <div className={`text-xl font-bold ${getRiskColor(metrics.dataRisk)}`}>
              {metrics.dataRisk}%
            </div>
            <Progress value={metrics.dataRisk} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Assessment Actions */}
      <Card className="card-cyber">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5" />
              <span>Risk Assessment Center</span>
            </CardTitle>
            <Button
              onClick={performComprehensiveAssessment}
              disabled={assessing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${assessing ? 'animate-spin' : ''}`} />
              {assessing ? 'Assessing...' : 'Run Assessment'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-semibold mb-3">Risk Summary</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Critical Issues</span>
                  <Badge variant="destructive">{metrics.criticalIssues}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Total Assessments</span>
                  <Badge variant="outline">{metrics.totalAssessments}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Risk Trend</span>
                  <div className="flex items-center space-x-1">
                    {getTrendIcon()}
                    <span className="text-sm capitalize">{metrics.trendDirection}</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-3">Quick Actions</h4>
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Eye className="h-4 w-4 mr-2" />
                  View Detailed Report
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Review Critical Issues
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Shield className="h-4 w-4 mr-2" />
                  Update Policies
                </Button>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-3">Assessment Schedule</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>User Risk:</span>
                  <span className="text-muted-foreground">Daily</span>
                </div>
                <div className="flex justify-between">
                  <span>Device Risk:</span>
                  <span className="text-muted-foreground">Hourly</span>
                </div>
                <div className="flex justify-between">
                  <span>Network Risk:</span>
                  <span className="text-muted-foreground">Continuous</span>
                </div>
                <div className="flex justify-between">
                  <span>Last Assessment:</span>
                  <span className="text-muted-foreground">2 min ago</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Assessments */}
      <Card className="card-cyber">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>Recent Risk Assessments</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {assessments.length === 0 ? (
              <div className="text-center py-8">
                <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Risk Assessments</h3>
                <p className="text-muted-foreground mb-4">
                  Run your first risk assessment to identify security vulnerabilities.
                </p>
                <Button onClick={performComprehensiveAssessment} disabled={assessing}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {assessing ? 'Running Assessment...' : 'Run First Assessment'}
                </Button>
              </div>
            ) : (
              assessments.slice(0, 10).map((assessment) => (
                <Card key={assessment.id} className="border-muted">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          {getAssessmentIcon(assessment.assessment_type)}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold capitalize">
                              {assessment.assessment_type} Assessment
                            </span>
                            <Badge variant={getRiskBadge(assessment.overall_risk_score).variant}>
                              {getRiskBadge(assessment.overall_risk_score).label}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(assessment.assessment_timestamp).toLocaleString()} • 
                            Vulnerability: {assessment.vulnerability_score}% • 
                            Compliance: {assessment.compliance_score}%
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${getRiskColor(assessment.overall_risk_score)}`}>
                          {assessment.overall_risk_score}%
                        </div>
                        {assessment.recommendations.length > 0 && (
                          <Badge variant="outline" className="mt-1">
                            {assessment.recommendations.length} recommendations
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ZeroTrustRiskAssessment;