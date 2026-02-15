import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Activity,
  Search,
  Radar,
  AlertTriangle,
  TrendingUp,
  FileText,
  Globe,
  Settings,
  Link as LinkIcon
} from "lucide-react";
import { CMMCDashboard } from "@/components/compliance/CMMCDashboard";
import { SentinelIntelIntegration } from "@/components/integration/SentinelIntelIntegration";
import { POAMGenerator } from "@/components/automation/POAMGenerator";
import { ThreatIntelligence } from "@/components/ThreatIntelligence";
import SecurityDashboard from "@/pages/SecurityDashboard";
import { useWhiteLabel } from "@/components/branding/WhiteLabelProvider";
import { UsageTracker } from "@/components/UsageTracker";
import { ProcessBehaviorTimeline } from "@/components/forensics/ProcessBehaviorTimeline";

export const HostBreachDashboard = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const { branding } = useWhiteLabel();

  return (
    <div className="p-6 space-y-6 bg-slate-950 min-h-screen text-slate-100">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-400 uppercase">
            {branding.organization_name} | Host Breach Surveillance
          </h1>
          <p className="text-slate-500 text-sm font-bold uppercase tracking-widest mt-1">
            Real-time EDR & Behavioral Anomaly Detection
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="border-red-500/50 text-red-500 bg-red-500/10 animate-pulse">
            <Activity className="h-3 w-3 mr-1" /> CRITICAL INCIDENTS: 2
          </Badge>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-slate-900 border-slate-800">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="forensics">Forensics Timeline</TabsTrigger>
          <TabsTrigger value="threat-intel">Threat Intel</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-slate-900 border-slate-800 shadow-2xl">
              <CardHeader>
                <CardTitle className="text-sm font-bold uppercase tracking-tighter text-slate-400">Total Assets Scanned</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-black">1,248</div>
                <div className="text-xs text-emerald-500 mt-1 flex items-center">
                  <TrendingUp className="h-3 w-3 mr-1" /> +12% since last 24h
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900 border-slate-800 shadow-2xl">
              <CardHeader>
                <CardTitle className="text-sm font-bold uppercase tracking-tighter text-slate-400">Active Vulnerabilities</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-black text-red-500">42</div>
                <div className="text-xs text-red-500 mt-1 flex items-center">
                  <AlertTriangle className="h-3 w-3 mr-1" /> High Risk detected
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900 border-slate-800 shadow-2xl">
              <CardHeader>
                <CardTitle className="text-sm font-bold uppercase tracking-tighter text-slate-400">Compliance Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-black text-blue-500">94%</div>
                <div className="text-xs text-blue-400 mt-1 px-2 py-0.5 bg-blue-500/10 rounded-full w-fit border border-blue-500/20">
                  NIST 800-171 R3 READY
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="forensics">
          <ProcessBehaviorTimeline />
        </TabsContent>

        <TabsContent value="threat-intel">
          <ThreatIntelligence />
        </TabsContent>

        <TabsContent value="compliance">
          <CMMCDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default HostBreachDashboard;
