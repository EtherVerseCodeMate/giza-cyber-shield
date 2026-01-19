import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Users, 
  Download,
  RefreshCw,
  Settings,
  Calendar,
  Target
} from "lucide-react";
import { useComplianceFrameworks } from "@/hooks/useComplianceFrameworks";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface POAMItem {
  id: string;
  control_id: string;
  control_title: string;
  weakness_description: string;
  remediation_plan: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CLOSED';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  due_date: string;
  responsible_party: string;
  resources_required: string;
  estimated_cost: number;
  completion_percentage: number;
  milestones: string[];
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW';
  created_date: string;
  last_updated: string;
}

interface POAMSummary {
  total_items: number;
  open_items: number;
  in_progress_items: number;
  completed_items: number;
  overdue_items: number;
  critical_items: number;
  estimated_total_cost: number;
  avg_completion_percentage: number;
}

export const POAMGenerator = () => {
  const { frameworks, controls, loading } = useComplianceFrameworks();
  const [poamItems, setPOAMItems] = useState<POAMItem[]>([]);
  const [summary, setSummary] = useState<POAMSummary>({
    total_items: 0,
    open_items: 0,
    in_progress_items: 0,
    completed_items: 0,
    overdue_items: 0,
    critical_items: 0,
    estimated_total_cost: 0,
    avg_completion_percentage: 0
  });
  const [generating, setGenerating] = useState(false);
  const [selectedFramework, setSelectedFramework] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    generatePOAMItems();
  }, [frameworks, controls]);

  const generatePOAMItems = () => {
    // Mock POAM data generation based on compliance gaps
    const mockPOAMItems: POAMItem[] = [
      {
        id: '1',
        control_id: 'AC.1.001',
        control_title: 'Limit information system access to authorized users',
        weakness_description: 'Current access control policy lacks comprehensive user access review procedures and automated provisioning/deprovisioning workflows.',
        remediation_plan: 'Implement automated user access management system with regular access reviews, role-based access controls, and integration with HR systems for automated account lifecycle management.',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        due_date: '2024-03-15',
        responsible_party: 'IT Security Team',
        resources_required: 'Identity Management System, 2 FTE for 3 months',
        estimated_cost: 75000,
        completion_percentage: 45,
        milestones: [
          'Requirements gathering completed',
          'Vendor selection in progress',
          'Pilot implementation planned',
          'Full deployment pending'
        ],
        risk_level: 'HIGH',
        created_date: '2024-01-10',
        last_updated: '2024-01-25'
      },
      {
        id: '2',
        control_id: 'AU.2.041',
        control_title: 'Ensure that the actions of individual system users can be uniquely traced',
        weakness_description: 'Audit logging is not centralized and lacks correlation capabilities. Some systems do not generate adequate audit trails for user activities.',
        remediation_plan: 'Deploy centralized SIEM solution to collect, correlate, and analyze audit logs from all systems. Implement user activity monitoring and alerting for suspicious activities.',
        status: 'OPEN',
        priority: 'CRITICAL',
        due_date: '2024-02-28',
        responsible_party: 'Infrastructure Team',
        resources_required: 'SIEM Platform, Log Management Storage, 3 FTE for 6 months',
        estimated_cost: 150000,
        completion_percentage: 0,
        milestones: [
          'SIEM platform procurement',
          'Log source identification',
          'Integration planning',
          'Deployment and tuning'
        ],
        risk_level: 'HIGH',
        created_date: '2024-01-05',
        last_updated: '2024-01-20'
      },
      {
        id: '3',
        control_id: 'IA.1.076',
        control_title: 'Identify information system users and authenticate their identities',
        weakness_description: 'Multi-factor authentication is not consistently enforced across all systems, particularly legacy applications and administrative interfaces.',
        remediation_plan: 'Implement enterprise-wide MFA solution covering all user-facing systems, administrative interfaces, and remote access. Include backup authentication methods and emergency access procedures.',
        status: 'COMPLETED',
        priority: 'HIGH',
        due_date: '2024-01-31',
        responsible_party: 'Security Team',
        resources_required: 'MFA Platform, Hardware Tokens, 1 FTE for 2 months',
        estimated_cost: 45000,
        completion_percentage: 100,
        milestones: [
          'MFA solution deployed ✓',
          'User training completed ✓',
          'Emergency procedures documented ✓',
          'Compliance validation completed ✓'
        ],
        risk_level: 'MEDIUM',
        created_date: '2023-12-01',
        last_updated: '2024-02-01'
      },
      {
        id: '4',
        control_id: 'SC.3.177',
        control_title: 'Employ FIPS-validated cryptography when used to protect the confidentiality of CUI',
        weakness_description: 'Some systems use non-FIPS validated cryptographic modules. Encryption key management procedures need enhancement.',
        remediation_plan: 'Upgrade all systems to use FIPS 140-2 validated cryptographic modules. Implement centralized key management system with proper key rotation and escrow procedures.',
        status: 'OPEN',
        priority: 'MEDIUM',
        due_date: '2024-04-30',
        responsible_party: 'Architecture Team',
        resources_required: 'Cryptographic Module Upgrades, Key Management System, 2 FTE for 4 months',
        estimated_cost: 95000,
        completion_percentage: 15,
        milestones: [
          'Cryptographic inventory completed',
          'FIPS module identification in progress',
          'Key management design pending',
          'Implementation planning pending'
        ],
        risk_level: 'MEDIUM',
        created_date: '2024-01-15',
        last_updated: '2024-01-30'
      }
    ];

    setPOAMItems(mockPOAMItems);
    calculateSummary(mockPOAMItems);
  };

  const calculateSummary = (items: POAMItem[]) => {
    const now = new Date();
    const overdue = items.filter(item => new Date(item.due_date) < now && item.status !== 'COMPLETED');
    
    const summary: POAMSummary = {
      total_items: items.length,
      open_items: items.filter(item => item.status === 'OPEN').length,
      in_progress_items: items.filter(item => item.status === 'IN_PROGRESS').length,
      completed_items: items.filter(item => item.status === 'COMPLETED').length,
      overdue_items: overdue.length,
      critical_items: items.filter(item => item.priority === 'CRITICAL').length,
      estimated_total_cost: items.reduce((sum, item) => sum + item.estimated_cost, 0),
      avg_completion_percentage: Math.round(items.reduce((sum, item) => sum + item.completion_percentage, 0) / items.length)
    };
    
    setSummary(summary);
  };

  const regeneratePOAM = async () => {
    setGenerating(true);
    try {
      // Call automated-remediation function to generate updated POAM
      const { data, error } = await supabase.functions.invoke('automated-remediation', {
        body: { 
          action: 'generate_poam',
          framework: selectedFramework || 'cmmc-2.0'
        }
      });

      if (error) throw error;

      toast({
        title: "POA&M Regenerated",
        description: `Successfully generated updated Plan of Action & Milestones based on current compliance gaps.`
      });

      // Refresh the data
      generatePOAMItems();
    } catch (error: any) {
      console.error('POAM generation error:', error);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to regenerate POA&M",
        variant: "destructive"
      });
    } finally {
      setGenerating(false);
    }
  };

  const exportPOAM = () => {
    // Generate CSV export
    const headers = [
      'Control ID', 'Control Title', 'Weakness Description', 'Remediation Plan',
      'Status', 'Priority', 'Due Date', 'Responsible Party', 'Estimated Cost',
      'Completion %', 'Risk Level'
    ];
    
    const csvContent = [
      headers.join(','),
      ...poamItems.map(item => [
        item.control_id,
        `"${item.control_title}"`,
        `"${item.weakness_description}"`,
        `"${item.remediation_plan}"`,
        item.status,
        item.priority,
        item.due_date,
        item.responsible_party,
        item.estimated_cost,
        item.completion_percentage,
        item.risk_level
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `POAM_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: "POA&M has been exported as CSV file."
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-500/20 text-green-400';
      case 'IN_PROGRESS': return 'bg-yellow-500/20 text-yellow-400';
      case 'OPEN': return 'bg-red-500/20 text-red-400';
      case 'CLOSED': return 'bg-gray-500/20 text-gray-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'text-red-400';
      case 'HIGH': return 'text-orange-400';
      case 'MEDIUM': return 'text-yellow-400';
      case 'LOW': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  if (loading) {
    return (
      <Card className="bg-black/40 border-blue-500/30 backdrop-blur-lg">
        <CardContent className="p-6">
          <div className="text-center text-gray-400">Loading POA&M data...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 border-blue-500/30">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-white">
            <div className="flex items-center space-x-3">
              <FileText className="h-6 w-6 text-blue-400" />
              <div>
                <h2 className="text-xl font-bold">Plan of Action & Milestones (POA&M)</h2>
                <p className="text-blue-200 text-sm">Automated Compliance Gap Remediation Tracking</p>
              </div>
            </div>
            <div className="flex space-x-2">
              <Button 
                onClick={regeneratePOAM} 
                disabled={generating}
                variant="outline"
                className="border-blue-500/30 text-blue-400 hover:bg-blue-600/20"
              >
                {generating ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Regenerate
              </Button>
              <Button onClick={exportPOAM} className="bg-blue-600 hover:bg-blue-700">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-black/40 border-blue-500/30 backdrop-blur-lg">
          <CardContent className="p-4 text-center">
            <FileText className="h-8 w-8 text-blue-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{summary.total_items}</div>
            <div className="text-xs text-gray-400">Total Items</div>
          </CardContent>
        </Card>
        
        <Card className="bg-black/40 border-red-500/30 backdrop-blur-lg">
          <CardContent className="p-4 text-center">
            <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{summary.open_items}</div>
            <div className="text-xs text-gray-400">Open Items</div>
          </CardContent>
        </Card>
        
        <Card className="bg-black/40 border-yellow-500/30 backdrop-blur-lg">
          <CardContent className="p-4 text-center">
            <Clock className="h-8 w-8 text-yellow-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{summary.in_progress_items}</div>
            <div className="text-xs text-gray-400">In Progress</div>
          </CardContent>
        </Card>
        
        <Card className="bg-black/40 border-green-500/30 backdrop-blur-lg">
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{summary.completed_items}</div>
            <div className="text-xs text-gray-400">Completed</div>
          </CardContent>
        </Card>
      </div>

      {/* Financial Summary */}
      <Card className="bg-black/40 border-blue-500/30 backdrop-blur-lg">
        <CardHeader>
          <CardTitle className="text-white">Financial Impact & Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="text-sm text-gray-300">Total Estimated Cost</div>
              <div className="text-2xl font-bold text-white">
                ${summary.estimated_total_cost.toLocaleString()}
              </div>
              <div className="text-xs text-gray-400">
                {summary.critical_items} critical items requiring immediate attention
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-gray-300">Overall Progress</div>
              <div className="text-2xl font-bold text-white">{summary.avg_completion_percentage}%</div>
              <Progress value={summary.avg_completion_percentage} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="text-sm text-gray-300">Overdue Items</div>
              <div className="text-2xl font-bold text-red-400">{summary.overdue_items}</div>
              <div className="text-xs text-gray-400">
                Require immediate escalation and resource allocation
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* POAM Items */}
      <Card className="bg-black/40 border-blue-500/30 backdrop-blur-lg">
        <CardHeader>
          <CardTitle className="text-white">Remediation Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {poamItems.map((item) => (
              <div key={item.id} className="p-6 bg-slate-800/40 rounded-lg border border-slate-600/30">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <Badge variant="outline" className="text-blue-400 border-blue-400">
                        {item.control_id}
                      </Badge>
                      <Badge className={getStatusColor(item.status)}>
                        {item.status.replace('_', ' ')}
                      </Badge>
                      <Badge 
                        variant="outline" 
                        className={`${getPriorityColor(item.priority)} border-current`}
                      >
                        {item.priority}
                      </Badge>
                    </div>
                    <h3 className="text-white font-semibold mb-2">{item.control_title}</h3>
                    <p className="text-gray-300 text-sm mb-3">{item.weakness_description}</p>
                    
                    <div className="bg-slate-700/40 p-3 rounded border border-slate-600/30 mb-3">
                      <h4 className="text-blue-400 font-medium text-sm mb-1">Remediation Plan</h4>
                      <p className="text-gray-300 text-sm">{item.remediation_plan}</p>
                    </div>
                  </div>
                  <div className="ml-6 text-right space-y-2">
                    <div className="text-2xl font-bold text-white">{item.completion_percentage}%</div>
                    <Progress value={item.completion_percentage} className="w-20 h-2" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="flex items-center space-x-2 text-gray-400 mb-1">
                      <Users className="h-4 w-4" />
                      <span>Responsible Party</span>
                    </div>
                    <div className="text-white">{item.responsible_party}</div>
                  </div>
                  <div>
                    <div className="flex items-center space-x-2 text-gray-400 mb-1">
                      <Calendar className="h-4 w-4" />
                      <span>Due Date</span>
                    </div>
                    <div className="text-white">{new Date(item.due_date).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <div className="flex items-center space-x-2 text-gray-400 mb-1">
                      <Target className="h-4 w-4" />
                      <span>Estimated Cost</span>
                    </div>
                    <div className="text-white">${item.estimated_cost.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="flex items-center space-x-2 text-gray-400 mb-1">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Risk Level</span>
                    </div>
                    <div className={getPriorityColor(item.risk_level)}>{item.risk_level}</div>
                  </div>
                </div>

                {item.milestones.length > 0 && (
                  <div className="mt-4 p-3 bg-slate-700/40 rounded border border-slate-600/30">
                    <h4 className="text-blue-400 font-medium text-sm mb-2">Milestones</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {item.milestones.map((milestone, index) => (
                        <div key={index} className="flex items-center space-x-2 text-sm">
                          {milestone.includes('✓') ? (
                            <CheckCircle className="h-4 w-4 text-green-400" />
                          ) : (
                            <Clock className="h-4 w-4 text-gray-400" />
                          )}
                          <span className={milestone.includes('✓') ? 'text-green-300' : 'text-gray-300'}>
                            {milestone}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};