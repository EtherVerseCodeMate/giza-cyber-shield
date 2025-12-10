
import React from 'react';
import { type Alert } from '@/utils/mockData';
import { AlertCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface AlertCardProps {
  alerts: Alert[];
}

const AlertCard: React.FC<AlertCardProps> = ({ alerts }) => {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low':
        return 'bg-blue-500 text-blue-500';
      case 'medium':
        return 'bg-yellow-500 text-yellow-500';
      case 'high':
        return 'bg-orange-500 text-orange-500';
      case 'critical':
        return 'bg-red-500 text-red-500';
      default:
        return 'bg-gray-500 text-gray-500';
    }
  };

  const getTimeAgo = (timestamp: string) => {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  };

  return (
    <div className="dashboard-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-giza-teal" />
          <h2 className="text-lg font-semibold">Recent Alerts</h2>
        </div>
        <span className="text-sm text-muted-foreground">{alerts.length} alerts</span>
      </div>
      
      <div className="space-y-4">
        {alerts.map(alert => (
          <div 
            key={alert.id} 
            className="p-3 bg-secondary rounded-md hover:bg-secondary/80 transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${getPriorityColor(alert.priority)}`}></div>
                <h3 className="font-medium">{alert.title}</h3>
              </div>
              <span className="text-xs rounded-full px-2 py-0.5 bg-secondary border border-border">
                {alert.source}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-2">{alert.description}</p>
            <div className="flex items-center text-xs text-muted-foreground">
              <Clock className="h-3 w-3 mr-1" />
              {getTimeAgo(alert.timestamp)}
            </div>
          </div>
        ))}
      </div>
      
      <button className="w-full mt-4 py-2 text-sm text-giza-teal hover:text-giza-blue transition-colors">
        View all alerts
      </button>
    </div>
  );
};

export default AlertCard;
