import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Brain, Activity, Shield, Cpu } from "lucide-react";
import { useOrganization } from "@/hooks/useOrganization";

interface AIAgent {
  id: string;
  status: "active" | "learning" | "idle";
  cpu: number;
  memory: number;
  threats: number;
  type: string;
}

export const AIAgentStatus = () => {
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    if (currentOrganization) {
      fetchAgentData();
    }
  }, [currentOrganization]);

  const fetchAgentData = async () => {
    if (!currentOrganization) return;
    
    try {
      // Placeholder agent data since ai_agent_chats and security_events tables don't exist
      const realAgents: AIAgent[] = [
        {
          id: "ARGUS-AI", 
          status: "active", 
          cpu: 25,
          memory: 38,
          threats: 0,
          type: "Security Analysis"
        }
      ];

      setAgents(realAgents);
    } catch (error) {
      console.error('Error fetching AI agent data:', error);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "text-green-400";
      case "learning": return "text-blue-400";
      case "idle": return "text-gray-400";
      default: return "text-red-400";
    }
  };

  if (loading) {
    return (
      <Card className="bg-black/40 border-purple-500/30 backdrop-blur-lg">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-purple-400">
            <Brain className="h-5 w-5" />
            <span>AI Agents</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-400">Loading AI agent status...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-black/40 border-purple-500/30 backdrop-blur-lg">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-purple-400">
          <Brain className="h-5 w-5" />
          <span>AI Agents</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {agents.length > 0 ? (
          agents.map((agent) => (
            <div key={agent.id} className="p-3 bg-slate-800/40 rounded-lg border border-slate-600/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    agent.status === 'active' ? 'bg-green-400' : 
                    agent.status === 'learning' ? 'bg-blue-400' : 
                    'bg-gray-400'
                  } ${agent.status === 'active' ? 'animate-pulse' : ''}`}></div>
                  <span className="font-medium">{agent.id}</span>
                  {agent.type && (
                    <span className="text-xs text-gray-400">({agent.type})</span>
                  )}
                </div>
                <span className={`text-xs uppercase ${getStatusColor(agent.status)}`}>
                  {agent.status}
                </span>
              </div>
              
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 flex items-center space-x-1">
                    <Cpu className="h-3 w-3" />
                    <span>CPU</span>
                  </span>
                  <span className="text-cyan-400">{agent.cpu}%</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 flex items-center space-x-1">
                    <Activity className="h-3 w-3" />
                    <span>Memory</span>
                  </span>
                  <span className="text-cyan-400">{agent.memory}%</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 flex items-center space-x-1">
                    <Shield className="h-3 w-3" />
                    <span>Events Processed</span>
                  </span>
                  <span className="text-green-400">{agent.threats}</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center text-gray-400 py-8">
            <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No AI agents detected</p>
            <p className="text-xs mt-1">AI services may be offline</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};