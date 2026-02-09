import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Shield, Users, Activity, Zap, Server } from 'lucide-react';
import { useKhepraAuth } from '@/khepra/hooks/useKhepraAuth';
import { useKhepraDeployment } from '@/hooks/useKhepraDeployment';
import { useKhepraAPI } from '@/hooks/useKhepraAPI';

export const KhepraStatus = () => {
  const { authState, securityEvents, isMonitoring } = useKhepraAuth();
  const { config } = useKhepraDeployment();
  const { health, license } = useKhepraAPI(config?.deploymentUrl || '', config?.apiKey || '');
  {/* Adinkra Resilience Score (ARS) - Tenable-inspired CES */ }
  <Card className="border-primary/20 bg-card/50 backdrop-blur-sm">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">Adinkra Resilience</CardTitle>
      <Activity className="h-4 w-4 text-primary" />
    </CardHeader>
    <CardContent>
      <div className="flex items-center space-x-2">
        <div className={`text-2xl font-bold ${(authState.trustScore * (license.data?.asset_criticality || 2)) >= 800 ? 'text-green-400' :
          (authState.trustScore * (license.data?.asset_criticality || 2)) >= 500 ? 'text-yellow-400' : 'text-red-400'
          }`}>
          {/* Calculate ARS: Trust (0-100) * ACR (1-10) = 0-1000 */}
          {authState.trustScore * (license.data?.asset_criticality || 2)}
        </div>
        <Badge variant="outline" className="text-xs">
          ARS-1000
        </Badge>
      </div>
      <Progress value={(authState.trustScore * (license.data?.asset_criticality || 2)) / 10} className="mt-2" />
      <div className="flex justify-between items-center mt-1">
        <p className="text-[10px] text-muted-foreground">
          Risk-Adjusted Exposure
        </p>
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="secondary" className="text-[10px] h-4 px-1">
              ACR: {license.data?.asset_criticality || 2}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Asset Criticality Rating (1-10)</p>
            <p>Based on Egyptian Tier</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </CardContent>
  </Card>

  {/* Monitoring Status */ }
  <Card className="border-primary/20 bg-card/50 backdrop-blur-sm">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">Monitoring</CardTitle>
      <Zap className="h-4 w-4 text-primary" />
    </CardHeader>
    <CardContent>
      <div className="flex items-center space-x-2">
        <div className="text-2xl font-bold">
          {isMonitoring ? 'Active' : 'Inactive'}
        </div>
        <div className={`w-2 h-2 rounded-full ${isMonitoring ? 'bg-green-400' : 'bg-gray-400'}`} />
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        Events: {securityEvents.length}
      </p>
      {recentEvents.length > 0 && (
        <div className="mt-2 space-y-1">
          {recentEvents.map((event, index) => (
            <Badge
              key={index}
              variant={event.severity === 'high' ? 'destructive' : 'secondary'}
              className="text-xs mr-1"
            >
              {event.type}
            </Badge>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
    </div >
  );
};
