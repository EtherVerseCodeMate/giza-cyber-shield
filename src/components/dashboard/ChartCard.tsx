
import React from 'react';
import { 
  LineChart, 
  Line, 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ResponsiveContainer
} from 'recharts';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  type: 'line' | 'bar';
  data: any[];
  dataKeys: string[];
  colors?: string[];
}

const ChartCard: React.FC<ChartCardProps> = ({ 
  title, 
  subtitle, 
  type, 
  data, 
  dataKeys,
  colors = ['#64ffda', '#00a8e8', '#8A85FF'] 
}) => {
  return (
    <div className="dashboard-card">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      
      <ResponsiveContainer width="100%" height={300}>
        {type === 'line' ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis 
              dataKey="time" 
              stroke="rgba(255,255,255,0.5)"
              style={{ fontSize: '0.75rem' }}
            />
            <YAxis 
              stroke="rgba(255,255,255,0.5)"
              style={{ fontSize: '0.75rem' }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#0a192f', 
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '0.375rem'
              }} 
            />
            <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
            {dataKeys.map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colors[index % colors.length]}
                activeDot={{ r: 6 }}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        ) : (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis 
              dataKey="name" 
              stroke="rgba(255,255,255,0.5)"
              style={{ fontSize: '0.75rem' }}
            />
            <YAxis 
              stroke="rgba(255,255,255,0.5)"
              style={{ fontSize: '0.75rem' }}
            />
            <Tooltip
              contentStyle={{ 
                backgroundColor: '#0a192f', 
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '0.375rem'
              }}
            />
            <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
            {dataKeys.map((key, index) => (
              <Bar 
                key={key} 
                dataKey={key} 
                fill={colors[index % colors.length]} 
                radius={[4, 4, 0, 0]} 
              />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
};

export default ChartCard;
