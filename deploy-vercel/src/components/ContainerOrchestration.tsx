import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Container, Cpu, HardDrive, Activity, CheckCircle, RefreshCw } from "lucide-react";
import { useOrganization } from "@/hooks/useOrganization";
import { useToast } from "@/hooks/use-toast";

interface Cluster {
  name: string;
  nodes: number;
  pods: number;
  cpu: number;
  memory: number;
  status: string;
}

interface Module {
  name: string;
  replicas: string;
  status: string;
  version: string;
  health: number;
}

export const ContainerOrchestration = () => {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentOrganization } = useOrganization();
  const { toast } = useToast();

  useEffect(() => {
    if (currentOrganization) {
      fetchContainerData();
    }
  }, [currentOrganization]);

  const fetchContainerData = async () => {
    if (!currentOrganization) return;
    
    try {
      setLoading(true);
      
      // Placeholder cluster data since infrastructure_assets and performance_metrics tables don't exist
      const clusterData: Cluster[] = [
        { 
          name: "Production EKS", 
          nodes: 3, 
          pods: 12, 
          cpu: Math.floor(Math.random() * 30) + 50, 
          memory: Math.floor(Math.random() * 40) + 40, 
          status: "healthy" 
        },
        { 
          name: "Staging AKS", 
          nodes: 2, 
          pods: 8, 
          cpu: Math.floor(Math.random() * 25) + 30, 
          memory: Math.floor(Math.random() * 30) + 35, 
          status: "healthy" 
        }
      ];

      setClusters(clusterData);

      // Placeholder module data
      const moduleData: Module[] = [
        { name: "M-XDR Core", replicas: "3/3", status: "running", version: "v2.1.0", health: 98 },
        { name: "SOAR Engine", replicas: "2/2", status: "running", version: "v1.8.2", health: 95 },
        { name: "IPS Agent", replicas: "8/8", status: "running", version: "v3.0.1", health: 97 },
        { name: "SIEM Collector", replicas: "4/4", status: "running", version: "v2.5.0", health: 94 },
        { name: "AI Reasoning", replicas: "3/3", status: "running", version: "v1.2.0", health: 92 },
        { name: "Threat Intel", replicas: "1/1", status: "running", version: "v1.9.1", health: 99 }
      ];

      setModules(moduleData);

    } catch (error) {
      console.error('Error fetching container data:', error);
      toast({
        title: "Error Loading Data",
        description: "Failed to fetch container orchestration data.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-black/40 border-orange-500/30 backdrop-blur-lg">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-orange-400">
            <Container className="h-5 w-5" />
            <span>Container Orchestration</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-400">Loading container data...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-black/40 border-orange-500/30 backdrop-blur-lg">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-orange-400">
          <div className="flex items-center space-x-2">
            <Container className="h-5 w-5" />
            <span>Container Orchestration</span>
          </div>
          <Button
            size="sm"
            onClick={fetchContainerData}
            disabled={loading}
            className="bg-orange-600/20 border-orange-500/30 text-orange-400 hover:bg-orange-600/40"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {clusters.map((cluster) => (
            <div key={cluster.name} className="p-3 bg-slate-800/40 rounded-lg border border-slate-600/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">{cluster.name}</span>
                <CheckCircle className="h-4 w-4 text-green-400" />
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Nodes</span>
                  <span className="text-cyan-400">{cluster.nodes}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Pods</span>
                  <span className="text-cyan-400">{cluster.pods}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">CPU</span>
                  <span className="text-cyan-400">{cluster.cpu}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Memory</span>
                  <span className="text-cyan-400">{cluster.memory}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <h4 className="text-sm font-semibold text-orange-400 mb-2">Security Modules</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {modules.map((module) => (
              <div key={module.name} className="flex items-center justify-between p-2 bg-slate-800/40 rounded border border-slate-600/30">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${module.status === 'running' ? 'bg-green-400' : 'bg-yellow-400'} animate-pulse`}></div>
                  <span className="text-xs font-medium text-white">{module.name}</span>
                </div>
                <div className="text-right">
                  <div className="text-xs text-cyan-400">{module.replicas}</div>
                  <div className="text-xs text-gray-400">{module.version}</div>
                  <div className="text-xs text-green-400">{module.health}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
