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
  Settings
} from "lucide-react";
import { useComplianceFrameworks } from "@/hooks/useComplianceFrameworks";
import { supabase } from "@/integrations/supabase/client";
import { useKhepraAPI } from "@/hooks/useKhepraAPI";

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
  const { cmmc } = useKhepraAPI("http://localhost:8080", ""); // In production use env vars
  const [cmmcLevels, setCmmcLevels] = useState<CMMCLevel[]>([]);
  const [poamItems, setPOAMItems] = useState<POAMItem[]>([]);
  const [overallScore, setOverallScore] = useState(0);
  const [organizationName, setOrganizationName] = useState("Organization");

  useEffect(() => {
    if (cmmc.data) {
      updateDashboardData(cmmc.data);
    }
    fetchOrganizationData();
  }, [cmmc.data]);

  const updateDashboardData = (data: any) => {
    // 1. Calculate CMMC Levels from Findings
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
        controls: 130, // 110 + 20 advanced
        implemented: findings.filter((f: any) => f.Status === 'Pass' && f.ID.includes('L3')).length,
        color: "bg-yellow-500"
      }
    ];

    setCmmcLevels(levels);

    // 2. Update overall score
    const totalControls = levels.reduce((sum, level) => sum + level.controls, 0);
    const totalImplemented = levels.reduce((sum, level) => sum + level.implemented, 0);
    setOverallScore(totalControls > 0 ? Math.round((totalImplemented / totalControls) * 100) : 0);

    // 3. Generate POAM for FAILED controls
    const failedFindings = findings.filter((f: any) => f.Status === 'Fail');
    const realPOAM: POAMItem[] = failedFindings.map((f: any) => ({
      id: f.ID,
      control_id: f.ID.split('-').pop(), // Extract control ID
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

  const getDomainIcon = (domain: string) => {
    const icons: Record<string, any> = {
      'AC': Users,      // Access Control
      'AU': FileText,   // Audit and Accountability  
      'AT': TrendingUp, // Awareness and Training
      'CM': Settings,   // Configuration Management
      'IA': Lock,       // Identification and Authentication
      'IR': AlertTriangle, // Incident Response
      'MA': Settings,   // Maintenance
      'MP': Database,   // Media Protection
      'PS': Users,      // Personnel Security
      'PE': Shield,     // Physical Protection
      'RE': TrendingUp, // Recovery
      'RM': Eye,        // Risk Management
      'CA': Shield,     // Security Assessment
      'SC': Wifi,       // System and Communications Protection
      'SI': Shield,     // System and Information Integrity
    };

    return icons[domain] || Shield;
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
      {/* Header */}
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

      {/* Overall Score */}
      <Card className="bg-black/40 border-blue-500/30 backdrop-blur-lg">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="md:col-span-2">
              <h3 className="text-lg font-semibold text-white mb-4">Overall CMMC Readiness</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">Compliance Score</span>
                  <span className="text-2xl font-bold text-blue-400">{overallScore}%</span>
                </div>
                <Progress value={overallScore} className="h-3" />
                <div className="flex justify-between text-sm text-gray-400">
                  <span>Target: Level 2 (CMMC 2.0)</span>
                  <span>Due: Q2 2024</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="text-center p-4 bg-green-900/40 rounded-lg border border-green-500/30">
                <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-green-400">135</div>
                <div className="text-xs text-green-200">Controls Implemented</div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="text-center p-4 bg-red-900/40 rounded-lg border border-red-500/30">
                <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-red-400">122</div>
                <div className="text-xs text-red-200">Gaps Identified</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CMMC Levels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cmmcLevels.map((level) => {
          const completionRate = Math.round((level.implemented / level.controls) * 100);
          return (
            <Card key={level.level} className="bg-black/40 border-blue-500/30 backdrop-blur-lg">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-white">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full ${level.color} flex items-center justify-center text-white font-bold`}>
                      {level.level}
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

      {/* POA&M (Plan of Action & Milestones) */}
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
            {poamItems.map((item) => (
              <div key={item.id} className="p-4 bg-slate-800/40 rounded-lg border border-slate-600/30">
                <div className="flex items-start justify-between mb-3">
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
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
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