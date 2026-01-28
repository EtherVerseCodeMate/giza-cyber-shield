import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  TrendingUp,
  Users,
  Database,
  Lock,
  Wifi,
  Eye,
  Settings,
  Zap,
  Loader2
} from "lucide-react";
import { useComplianceFrameworks } from "@/hooks/useComplianceFrameworks";
import { supabase } from "@/integrations/supabase/client";
import { useKhepraAPI } from "@/hooks/useKhepraAPI";
import { toast } from "sonner";

interface CMMCLevel {
  level: number;
  name: string;
  description: string;
  controls: number;
  implemented: number;
  color: string;
}

interface POAMItem {
  id: string;
  control_id: string;
  weakness: string;
  remediation: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED';
  due_date: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  responsible_party: string;
}

interface CMMCDashboardProps {
  organizationId: string;
}

export const CMMCDashboard: React.FC<CMMCDashboardProps> = ({ organizationId }) => {
  const { frameworks, controls: offlineControls, loading: offlineLoading } = useComplianceFrameworks();
  const { cmmc, remediateSTIG } = useKhepraAPI("http://localhost:8080", "");
  const [cmmcLevels, setCmmcLevels] = useState<CMMCLevel[]>([]);
  const [poamItems, setPOAMItems] = useState<POAMItem[]>([]);
  const [overallScore, setOverallScore] = useState(0);
  const [organizationName, setOrganizationName] = useState("Organization");
  const [isRemediating, setIsRemediating] = useState<string | null>(null);

  useEffect(() => {
    if (cmmc.data) {
      updateDashboardData(cmmc.data);
    }
    fetchOrganizationData();
  }, [cmmc.data]);

  const updateDashboardData = (data: any) => {
    const findings = data.Findings || [];

    const levels: CMMCLevel[] = [
      {
        level: 1,
        name: "Basic Cyber Hygiene",
        description: "Safeguard Federal Contract Information (FCI)",
        controls: 17,
        implemented: findings.filter((f: any) => f.Status === 'Pass' && f.ID.includes('L1')).length,
        color: "bg-blue-500"
      },
      {
        level: 2,
        name: "Intermediate Cyber Hygiene",
        description: "Protect Controlled Unclassified Information (CUI)",
        controls: 110,
        implemented: findings.filter((f: any) => f.Status === 'Pass' && (f.ID.includes('L2') || f.References.some((r: string) => r.startsWith('NIST-800-171')))).length,
        color: "bg-green-500"
      },
      {
        level: 3,
        name: "Good Cyber Hygiene",
        description: "Protect CUI and reduce risk of APTs",
        controls: 134,
        implemented: findings.filter((f: any) => f.Status === 'Pass' && (f.ID.includes('L3') || f.ID.includes('L2'))).length,
        color: "bg-yellow-500"
      }
    ];

    setCmmcLevels(levels);

    const totalControls = levels.reduce((sum, level) => sum + level.controls, 0);
    const totalImplemented = levels.reduce((sum, level) => sum + level.implemented, 0);
    setOverallScore(totalControls > 0 ? Math.round((totalImplemented / totalControls) * 100) : 0);

    const failedFindings = findings.filter((f: any) => f.Status === 'Fail');
    const realPOAM: POAMItem[] = failedFindings.map((f: any) => ({
      id: f.ID,
      control_id: f.ID.replace('CMMC:', ''),
      weakness: f.Title,
      remediation: f.Remediation,
      status: 'OPEN',
      due_date: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
      priority: f.Severity === 'Critical' || f.Severity === 'high' ? 'HIGH' : 'MEDIUM',
      responsible_party: 'System Administrator'
    }));
    setPOAMItems(realPOAM);
  };

  const fetchOrganizationData = async () => {
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('display_name')
        .limit(1)
        .single();

      if (profile?.display_name) {
        setOrganizationName(profile.display_name);
      }
    } catch (error) {
      console.error('Error fetching organization:', error);
    }
  };

  const handleRemediate = async (controlId: string) => {
    setIsRemediating(controlId);
    toast.info(`Triggering automated remediation for ${controlId}...`);

    try {
      const result = await remediateSTIG.mutateAsync({
        control_ids: [controlId],
        target_host: "localhost"
      });

      if (result.status === 'completed' && result.results[0].status === 'success') {
        toast.success(`Successfully remediated ${controlId}: ${result.results[0].command}`);
      } else {
        toast.error(`Remediation failed for ${controlId}: ${result.results[0].output}`);
      }
    } catch (error: any) {
      console.error('Remediation error:', error);
      toast.error(`Automated fix failed: ${error.message}`);
    } finally {
      setIsRemediating(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-500';
      case 'IN_PROGRESS': return 'bg-yellow-500';
      case 'OPEN': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'text-red-400';
      case 'MEDIUM': return 'text-yellow-400';
      case 'LOW': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  if (cmmc.isLoading || offlineLoading) {
    return (
      <div className="space-y-6">
        <Card className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 border-blue-500/30">
          <CardContent className="p-6">
            <div className="text-center text-gray-400">Loading CMMC compliance data...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 border-blue-500/30">
        <CardHeader>
          <CardTitle className="flex items-center space-x-3 text-white">
            <Shield className="h-8 w-8 text-blue-400" />
            <div>
              <h1 className="text-2xl font-bold">CMMC Compliance Dashboard</h1>
              <p className="text-blue-200 text-sm">{organizationName} - Cybersecurity Maturity Model Certification</p>
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      <Card className="bg-black/40 border-blue-500/30 backdrop-blur-lg">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
            <div className="relative w-48 h-48">
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-4xl font-bold text-white">{overallScore}%</span>
              </div>
              <svg className="w-full h-full -rotate-90">
                <circle
                  cx="96" cy="96" r="88"
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="12"
                  className="text-blue-900/30"
                />
                <circle
                  cx="96" cy="96" r="88"
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="12"
                  strokeDasharray={552.92}
                  strokeDashoffset={552.92 * (1 - overallScore / 100)}
                  className="text-blue-500 transition-all duration-1000 ease-out"
                />
              </svg>
            </div>
            <div className="flex-1 md:ml-12 grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
              <div className="space-y-1">
                <p className="text-sm text-gray-400">Framework Status</p>
                <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                  CMMC 3.0 L3
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-gray-400">Total Controls</p>
                <p className="text-2xl font-bold text-white">134</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-gray-400">Last Audit</p>
                <p className="text-white font-medium">{new Date().toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cmmcLevels.map((level) => {
          const completionRate = Math.round((level.implemented / level.controls) * 100);
          return (
            <Card key={level.level} className="bg-black/40 border-blue-500/30 backdrop-blur-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-white">
                  <div className="flex items-center space-x-2">
                    <div className={`w-10 h-10 rounded-lg ${level.color} flex items-center justify-center text-white font-bold`}>
                      L{level.level}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{level.name}</div>
                      <div className="text-xs text-gray-400">{level.description}</div>
                    </div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Progress</span>
                    <span className="text-white font-medium">{completionRate}%</span>
                  </div>
                  <Progress value={completionRate} className="h-2" />
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>{level.implemented}/{level.controls} controls</span>
                    <Badge variant={completionRate >= 80 ? "default" : "destructive"} className="text-xs">
                      {completionRate >= 80 ? "On Track" : "Needs Attention"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-black/40 border-blue-500/30 backdrop-blur-lg">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-white">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-blue-400" />
              <span>Plan of Action & Milestones (POA&M)</span>
            </div>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
              Export POA&M
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {poamItems.length > 0 ? (
              poamItems.map((item) => (
                <div key={item.id} className="p-4 bg-slate-800/40 rounded-lg border border-slate-600/30">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <Badge variant="outline" className="text-blue-400 border-blue-400">
                          {item.control_id}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`${getPriorityColor(item.priority)} border-current`}
                        >
                          {item.priority}
                        </Badge>
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(item.status)}`} />
                      </div>
                      <h4 className="text-white font-medium mb-1">{item.weakness}</h4>
                      <p className="text-gray-400 text-sm mb-2">{item.remediation}</p>
                      <div className="text-xs text-gray-500">
                        Responsible: {item.responsible_party} | Due: {new Date(item.due_date).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex space-x-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-green-500/50 text-green-400 hover:bg-green-500/20"
                        onClick={() => handleRemediate(item.id)}
                        disabled={isRemediating === item.id}
                      >
                        {isRemediating === item.id ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Zap className="h-4 w-4 mr-2" />
                        )}
                        Automated Fix
                      </Button>
                      <Button size="sm" variant="ghost" className="text-gray-400">
                        View Logs
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 border-2 border-dashed border-gray-800 rounded-xl">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <p className="text-white font-medium">No open findings!</p>
                <p className="text-gray-500 text-sm">System is fully compliant with CMMC Level 3 standards.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-black/40 border-blue-500/30 backdrop-blur-lg">
        <CardHeader>
          <CardTitle className="text-white">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="h-16 flex-col space-y-2 border-blue-500/30 text-blue-400 hover:bg-blue-600/20">
              <FileText className="h-5 w-5" />
              <span className="text-xs">Generate SSP</span>
            </Button>
            <Button variant="outline" className="h-16 flex-col space-y-2 border-blue-500/30 text-blue-400 hover:bg-blue-600/20">
              <TrendingUp className="h-5 w-5" />
              <span className="text-xs">Run Assessment</span>
            </Button>
            <Button variant="outline" className="h-16 flex-col space-y-2 border-blue-500/30 text-blue-400 hover:bg-blue-600/20">
              <Clock className="h-5 w-5" />
              <span className="text-xs">Update POA&M</span>
            </Button>
            <Button variant="outline" className="h-16 flex-col space-y-2 border-blue-500/30 text-blue-400 hover:bg-blue-600/20">
              <Shield className="h-5 w-5" />
              <span className="text-xs">Audit Report</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
