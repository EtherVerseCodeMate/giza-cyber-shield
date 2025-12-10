
import React from 'react';
import { type SystemOverview } from '@/utils/mockData';
import { Shield, Clock, FileCheck } from 'lucide-react';

interface OverviewCardProps {
  data: SystemOverview;
}

const OverviewCard: React.FC<OverviewCardProps> = ({ data }) => {
  const getStatusColor = () => {
    switch (data.systemStatus) {
      case 'operational':
        return 'bg-green-500';
      case 'degraded':
        return 'bg-yellow-500';
      case 'outage':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="dashboard-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">System Overview</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground capitalize">{data.systemStatus}</span>
          <div className={`h-3 w-3 rounded-full ${getStatusColor()}`}></div>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col items-center justify-center p-3 bg-secondary rounded-md">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="h-5 w-5 text-giza-teal" />
            <span className="text-sm text-muted-foreground">Alerts</span>
          </div>
          <div className="flex items-center justify-center gap-3">
            <div className="text-center">
              <p className="text-xl font-semibold">{data.activeAlerts}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-semibold">{data.resolvedAlerts}</p>
              <p className="text-xs text-muted-foreground">Resolved</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center p-3 bg-secondary rounded-md">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-5 w-5 text-giza-blue" />
            <span className="text-sm text-muted-foreground">Response</span>
          </div>
          <div className="text-center">
            <p className="text-xl font-semibold">{data.averageResponseTime}</p>
            <p className="text-xs text-muted-foreground">Avg. Response Time</p>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center p-3 bg-secondary rounded-md">
          <div className="flex items-center gap-2 mb-1">
            <FileCheck className="h-5 w-5 text-giza-teal" />
            <span className="text-sm text-muted-foreground">Compliance</span>
          </div>
          <div className="text-center">
            <p className="text-xl font-semibold">{data.complianceScore}%</p>
            <p className="text-xs text-muted-foreground">Overall Score</p>
          </div>
        </div>
      </div>
      
      <div className="mt-4 p-3 bg-secondary rounded-md">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Detections Today</span>
          <span className="text-lg font-semibold">{data.detectionsToday}</span>
        </div>
        <div className="h-1 w-full bg-muted mt-2">
          <div 
            className="h-1 bg-gradient-to-r from-giza-teal to-giza-blue" 
            style={{ width: `${Math.min(data.detectionsToday / 100 * 100, 100)}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default OverviewCard;
