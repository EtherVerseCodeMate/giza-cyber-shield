import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Shield, Users, Activity, Zap } from 'lucide-react';
import { useKhepraAuth } from '@/khepra/hooks/useKhepraAuth';

export const KhepraStatus = () => {
  const { authState, securityEvents, isMonitoring } = useKhepraAuth();

  const getTrustScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getTrustScoreVariant = (score: number) => {
    if (score >= 80) return 'default';
    if (score >= 60) return 'secondary';
    return 'destructive';
  };

  const recentEvents = securityEvents.slice(0, 3);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Cultural Trust Score */}
      <Card className="border-primary/20 bg-card/50 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Cultural Trust Score</CardTitle>
          <Shield className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <div className={`text-2xl font-bold ${getTrustScoreColor(authState.trustScore)}`}>
              {authState.trustScore}
            </div>
            <Badge variant={getTrustScoreVariant(authState.trustScore)} className="text-xs">
              {authState.trustScore >= 80 ? 'High' : authState.trustScore >= 60 ? 'Medium' : 'Low'}
            </Badge>
          </div>
          <Progress value={authState.trustScore} className="mt-2" />
          <p className="text-xs text-muted-foreground mt-1">
            Based on Adinkra transformations
          </p>
        </CardContent>
      </Card>

      {/* Agent Status */}
      <Card className="border-primary/20 bg-card/50 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Agent Status</CardTitle>
          <Users className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <div className="text-2xl font-bold">
              {authState.isAuthenticated ? 'Active' : 'Inactive'}
            </div>
            <Badge variant={authState.isAuthenticated ? 'default' : 'secondary'}>
              {authState.isAuthenticated ? 'Verified' : 'Unverified'}
            </Badge>
          </div>
          {authState.agentId && (
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-xs text-muted-foreground mt-1 truncate cursor-help">
                  ID: {authState.agentId}
                </p>
              </TooltipTrigger>
              <TooltipContent>
                <p>Agent ID: {authState.agentId}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </CardContent>
      </Card>

      {/* Cultural Context */}
      <Card className="border-primary/20 bg-card/50 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Cultural Context</CardTitle>
          <Activity className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <div className="text-2xl font-bold capitalize">
              {authState.culturalContext}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Transformations: {authState.adinkraTransformations.length}
          </p>
          {authState.lastInteraction && (
            <p className="text-xs text-muted-foreground">
              Last: {authState.lastInteraction.toLocaleTimeString()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Monitoring Status */}
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
    </div>
  );
};