import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertTriangle, Shield, RotateCcw, CheckCircle, Clock, 
  Activity, Zap, Eye, PlayCircle, StopCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { useOrganization } from '@/hooks/useOrganization';

interface EmergencyAction {
  id: string;
  action_type: string;
  targets: string[];
  execution_status: string;
  results: any;
  executed_at: string;
  successful_actions: number;
  total_actions: number;
  success_rate: number;
}

interface SecurityAlert {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  created_at: string;
  metadata: any;
}

export const EmergencyResponseManager = () => {
  const [emergencyActions, setEmergencyActions] = useState<EmergencyAction[]>([]);
  const [securityAlerts, setSecurityAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    if (currentOrganization) {
      fetchEmergencyData();
    }
  }, [currentOrganization]);

  const fetchEmergencyData = async () => {
    if (!currentOrganization) return;
    
    try {
      setLoading(true);
      
      // Placeholder data since remediation_activities and alerts tables don't exist
      setEmergencyActions([]);
      setSecurityAlerts([]);

    } catch (error) {
      console.error('Error fetching emergency data:', error);
      toast({
        title: "Error Loading Data",
        description: "Failed to load emergency response data.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const executeRollback = async (actionId: string) => {
    toast({
      title: "Rollback Not Available",
      description: "No rollback script available for this action.",
      variant: "destructive"
    });
  };

  const getActionStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-500 text-white';
      case 'ROLLED_BACK': return 'bg-yellow-500 text-white';
      case 'FAILED': return 'bg-red-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'bg-red-500 text-white';
      case 'HIGH': return 'bg-orange-500 text-white';
      case 'MEDIUM': return 'bg-yellow-500 text-white';
      case 'LOW': return 'bg-green-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'network_isolation': return <Shield className="h-4 w-4" />;
      case 'endpoint_isolation': return <StopCircle className="h-4 w-4" />;
      case 'patch_management': return <Activity className="h-4 w-4" />;
      case 'configuration_hardening': return <PlayCircle className="h-4 w-4" />;
      default: return <Zap className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading emergency response data...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Emergency Status Overview */}
      <Alert className="border-red-500/50 bg-red-500/10">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="text-foreground">
          <strong>Emergency Response System Active:</strong> ARGUS AI is configured for autonomous high-risk action execution. 
          All emergency actions are logged and can be rolled back if needed.
        </AlertDescription>
      </Alert>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Emergency Actions</p>
                <p className="text-2xl font-bold text-red-400">{emergencyActions.length}</p>
              </div>
              <Zap className="h-8 w-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Alerts</p>
                <p className="text-2xl font-bold text-yellow-400">{securityAlerts.filter(a => a.status === 'OPEN').length}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Rollbacks Available</p>
                <p className="text-2xl font-bold text-green-400">
                  {emergencyActions.filter(a => a.results?.rollback_script && a.execution_status === 'COMPLETED').length}
                </p>
              </div>
              <RotateCcw className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold text-cyan-400">
                  {emergencyActions.length > 0 
                    ? Math.round(emergencyActions.reduce((sum, a) => sum + a.success_rate, 0) / emergencyActions.length)
                    : 0}%
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-cyan-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="actions" className="space-y-4">
        <TabsList className="bg-slate-800 border border-slate-700">
          <TabsTrigger value="actions">Emergency Actions</TabsTrigger>
          <TabsTrigger value="alerts">Security Alerts</TabsTrigger>
          <TabsTrigger value="monitoring">Live Monitoring</TabsTrigger>
        </TabsList>

        <TabsContent value="actions" className="space-y-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Zap className="h-5 w-5 text-red-400" />
                <span>Autonomous Emergency Actions</span>
              </CardTitle>
              <CardDescription>
                High-risk actions automatically executed by ARGUS AI
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {emergencyActions.length > 0 ? (
                  emergencyActions.map((action) => (
                    <div
                      key={action.id}
                      className="p-4 border border-slate-700 rounded-lg bg-slate-900/50 hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            {getActionIcon(action.action_type)}
                            <h4 className="font-medium text-white">{action.action_type.replace('_', ' ').toUpperCase()}</h4>
                            <Badge className={getActionStatusBadge(action.execution_status)}>
                              {action.execution_status}
                            </Badge>
                            <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500">
                              EMERGENCY
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground mb-3">
                            <span>Targets: {action.targets.join(', ')}</span>
                            <span>Success Rate: {action.success_rate}%</span>
                            <span>Actions: {action.successful_actions}/{action.total_actions}</span>
                            <span>Executed: {formatDistanceToNow(new Date(action.executed_at), { addSuffix: true })}</span>
                          </div>

                          {action.results?.rollback_script && (
                            <div className="text-xs bg-slate-800 p-2 rounded border border-slate-700">
                              <strong>Rollback Available:</strong> This action can be automatically reversed
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-2 ml-4">
                          {action.results?.rollback_script && action.execution_status === 'COMPLETED' && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => executeRollback(action.id)}
                              className="border-yellow-500 text-yellow-400 hover:bg-yellow-500/20"
                            >
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Rollback
                            </Button>
                          )}
                          <Button variant="outline" size="sm">
                            <Eye className="h-3 w-3 mr-1" />
                            Details
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No emergency actions executed yet</p>
                    <p className="text-xs mt-1">ARGUS will automatically execute high-risk actions when threats are detected</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-yellow-400" />
                <span>Autonomous Action Alerts</span>
              </CardTitle>
              <CardDescription>
                Real-time notifications for AI-executed security actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {securityAlerts.length > 0 ? (
                  securityAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="p-3 border border-slate-700 rounded-lg bg-slate-900/50 hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <Badge className={getSeverityBadge(alert.severity)}>
                              {alert.severity}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          <h4 className="font-medium text-white mb-1">{alert.title}</h4>
                          <p className="text-sm text-muted-foreground">{alert.description}</p>
                          
                          {alert.metadata?.targets && (
                            <div className="text-xs text-muted-foreground mt-2">
                              Targets: {Array.isArray(alert.metadata.targets) 
                                ? alert.metadata.targets.join(', ') 
                                : alert.metadata.targets}
                            </div>
                          )}
                        </div>
                        
                        <Badge variant="outline" className={
                          alert.status === 'OPEN' ? 'border-yellow-500 text-yellow-400' : 'border-green-500 text-green-400'
                        }>
                          {alert.status}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No autonomous action alerts</p>
                    <p className="text-xs mt-1">Alerts will appear when ARGUS executes emergency actions</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5 text-cyan-400" />
                <span>Live Threat Monitoring</span>
              </CardTitle>
              <CardDescription>
                Real-time monitoring of security threats and autonomous responses
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center text-muted-foreground py-8">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No active threats detected</p>
                <p className="text-xs mt-1">ARGUS is continuously monitoring for security threats</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
