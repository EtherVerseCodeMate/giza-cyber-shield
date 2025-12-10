
import React from 'react';
import { type Integration } from '@/utils/mockData';
import { CheckCircle2, AlertTriangle, XCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface IntegrationStatusProps {
  integrations: Integration[];
}

const IntegrationStatus: React.FC<IntegrationStatusProps> = ({ integrations }) => {
  const getStatusIndicator = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <div className="flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-green-500">Active</span>
          </div>
        );
      case 'warning':
        return (
          <div className="flex items-center gap-1">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <span className="text-yellow-500">Warning</span>
          </div>
        );
      case 'critical':
        return (
          <div className="flex items-center gap-1">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span className="text-red-500">Critical</span>
          </div>
        );
      case 'inactive':
        return (
          <div className="flex items-center gap-1">
            <XCircle className="h-4 w-4 text-gray-500" />
            <span className="text-gray-500">Inactive</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1">
            <XCircle className="h-4 w-4 text-gray-500" />
            <span className="text-gray-500">Unknown</span>
          </div>
        );
    }
  };

  const getLastSyncTime = (timestamp: string) => {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  };

  return (
    <div className="dashboard-card">
      <h2 className="text-lg font-semibold mb-4">Integration Status</h2>
      <div className="space-y-4">
        {integrations.map(integration => (
          <div 
            key={integration.id}
            className="p-3 bg-secondary rounded-md flex items-center justify-between"
          >
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-medium">{integration.name}</h3>
                <span className="text-xs bg-giza-navy px-2 py-0.5 rounded-full">
                  {integration.type}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>Last sync: {getLastSyncTime(integration.lastSync)}</span>
              </div>
            </div>
            {getStatusIndicator(integration.status)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default IntegrationStatus;
