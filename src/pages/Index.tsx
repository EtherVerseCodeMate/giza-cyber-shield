
import { useState } from 'react';
import Navbar from '@/components/layout/Navbar';
import OverviewCard from '@/components/dashboard/OverviewCard';
import StatusCard from '@/components/dashboard/StatusCard';
import ChartCard from '@/components/dashboard/ChartCard';
import AlertCard from '@/components/dashboard/AlertCard';
import IntegrationStatus from '@/components/dashboard/IntegrationStatus';
import { systemOverview, alerts, integrations, anomalyData, complianceData } from '@/utils/mockData';
import { Shield, ArrowUpRight, Server, CloudCog, Shell, ActivitySquare } from 'lucide-react';

const Index = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  
  return (
    <div className="min-h-screen bg-giza-dark text-white">
      <Navbar />
      
      <main className="container mx-auto py-6 px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Giza Cybersecurity Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Real-Time Cyber Immunity for Critical Infrastructure
            </p>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-giza-navy hover:bg-giza-navy/80 rounded-md text-sm flex items-center gap-2 transition-colors">
              <Shield className="h-4 w-4" />
              Run Scan
            </button>
            <button className="px-4 py-2 bg-giza-teal hover:bg-giza-teal/80 text-giza-navy rounded-md text-sm font-medium flex items-center gap-2 transition-colors">
              <ArrowUpRight className="h-4 w-4" />
              Generate Report
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <StatusCard 
            title="System Health" 
            value={systemOverview.systemStatus === 'operational' ? 'Optimal' : 'Degraded'}
            subtitle="All systems operational"
            icon={<Server className="h-5 w-5" />}
            status="success"
          />
          
          <StatusCard 
            title="Cyber Immunity" 
            value={`${systemOverview.complianceScore}%`}
            subtitle="Compliance Score"
            icon={<Shield className="h-5 w-5" />}
            status={systemOverview.complianceScore >= 90 ? 'success' : 'warning'}
          />
          
          <StatusCard 
            title="Active Threats" 
            value={systemOverview.activeAlerts}
            subtitle={`${systemOverview.detectionsToday} detections today`}
            icon={<ActivitySquare className="h-5 w-5" />}
            status={systemOverview.activeAlerts > 10 ? 'error' : 'warning'}
          />
          
          <StatusCard 
            title="Cloud Security" 
            value="Protected"
            subtitle="HPE GreenLake Secure"
            icon={<CloudCog className="h-5 w-5" />}
            status="success"
          />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <ChartCard 
              title="Anomaly Detection" 
              subtitle="Last 24 hours across environments"
              type="line" 
              data={anomalyData} 
              dataKeys={['OT', 'IT', 'Cloud']} 
            />
          </div>
          <div>
            <OverviewCard data={systemOverview} />
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div>
            <AlertCard alerts={alerts.slice(0, 3)} />
          </div>
          <div>
            <IntegrationStatus integrations={integrations} />
          </div>
          <div>
            <ChartCard 
              title="Compliance Scores" 
              subtitle="By security domain"
              type="bar" 
              data={complianceData} 
              dataKeys={['value', 'target']} 
              colors={['#64ffda', 'rgba(255,255,255,0.2)']}
            />
          </div>
        </div>

        <div className="bg-giza-navy border border-border p-4 rounded-lg">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-full bg-green-500"></span>
              <span>System Operational</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-full bg-yellow-500"></span>
              <span>Monitoring Active</span>
            </div>
            <div className="flex items-center gap-1">
              <Shell className="h-3 w-3" />
              <span>AI Analysis Running</span>
            </div>
            <div className="ml-auto text-xs">
              Last updated: Just now
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
