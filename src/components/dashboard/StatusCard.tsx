
import React from 'react';

interface StatusCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  status?: 'success' | 'warning' | 'error' | 'info';
}

const StatusCard: React.FC<StatusCardProps> = ({ 
  title, 
  value, 
  subtitle, 
  icon,
  status = 'info'
}) => {
  const getStatusColor = () => {
    switch(status) {
      case 'success': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'warning': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'error': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'info': 
      default: return 'bg-giza-teal/10 text-giza-teal border-giza-teal/20';
    }
  };
  
  return (
    <div className="dashboard-card hover:translate-y-[-2px] transition-transform">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${getStatusColor()}`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

export default StatusCard;
