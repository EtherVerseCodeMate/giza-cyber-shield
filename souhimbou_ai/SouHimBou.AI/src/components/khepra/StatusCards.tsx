import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Shield, Activity, Zap, Server } from 'lucide-react';
import { SecurityEvent } from '@/khepra/types'; // Assuming types are here, or I'll inline them if needed

// Helper functions (moved from KhepraStatus)
export const getTrustScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
};

export const getTrustScoreVariant = (score: number) => {
    if (score >= 80) return 'default';
    if (score >= 60) return 'secondary';
    return 'destructive';
};

export const getTrustScoreLabel = (score: number) => {
    if (score >= 80) return 'High';
    if (score >= 60) return 'Medium';
    return 'Low';
};

export const CulturalTrustCard = ({ trustScore }: { trustScore: number }) => (
    <Card className="border-primary/20 bg-card/50 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cultural Trust Score</CardTitle>
            <Shield className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
            <div className="flex items-center space-x-2">
                <div className={`text-2xl font-bold ${getTrustScoreColor(trustScore)}`}>
                    {trustScore}
                </div>
                <Badge variant={getTrustScoreVariant(trustScore)} className="text-xs">
                    {getTrustScoreLabel(trustScore)}
                </Badge>
            </div>
            <Progress value={trustScore} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
                Based on Adinkra transformations
            </p>
        </CardContent>
    </Card>
);

export const EnvironmentHealthCard = ({
    isRemoteHealthy,
    statusText,
    deploymentUrl
}: {
    isRemoteHealthy: boolean;
    statusText: string;
    deploymentUrl: string;
}) => (
    <Card className="border-primary/20 bg-card/50 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Environment Health</CardTitle>
            <Server className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
            <div className="flex items-center space-x-2">
                <div className={`text-2xl font-bold ${isRemoteHealthy ? 'text-green-400' : 'text-red-400'}`}>
                    {isRemoteHealthy ? 'Healthy' : 'Offline'}
                </div>
                <Badge variant={isRemoteHealthy ? 'default' : 'destructive'}>
                    {isRemoteHealthy ? 'Stable' : 'Error'}
                </Badge>
            </div>
            <div className="flex items-center gap-2 mt-2">
                <div className={`w-2 h-2 rounded-full ${isRemoteHealthy ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                <span className="text-xs text-muted-foreground">
                    {statusText}
                </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 truncate">
                {deploymentUrl}
            </p>
        </CardContent>
    </Card>
);

export const AdinkraResilienceCard = ({
    arsScore,
    assetCriticality
}: {
    arsScore: number;
    assetCriticality: number;
}) => {
    let arsColor = 'text-red-400';
    if (arsScore >= 800) arsColor = 'text-green-400';
    else if (arsScore >= 500) arsColor = 'text-yellow-400';

    return (
        <Card className="border-primary/20 bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Adinkra Resilience</CardTitle>
                <Activity className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
                <div className="flex items-center space-x-2">
                    <div className={`text-2xl font-bold ${arsColor}`}>
                        {arsScore}
                    </div>
                    <Badge variant="outline" className="text-xs">
                        ARS-1000
                    </Badge>
                </div>
                <Progress value={arsScore / 10} className="mt-2" />
                <div className="flex justify-between items-center mt-1">
                    <p className="text-[10px] text-muted-foreground">
                        Risk-Adjusted Exposure
                    </p>
                    <Tooltip>
                        <TooltipTrigger>
                            <Badge variant="secondary" className="text-[10px] h-4 px-1">
                                ACR: {assetCriticality}
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
    );
};

export const MonitoringCard = ({
    isMonitoring,
    events,
    recentEvents
}: {
    isMonitoring: boolean;
    events: number;
    recentEvents: any[]; // Using any for simplicity if types aren't easily available, ideally SecurityEvent[]
}) => (
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
                Events: {events}
            </p>
            {recentEvents.length > 0 && (
                <div className="mt-2 space-y-1">
                    {recentEvents.map((event, index) => (
                        <Badge
                            key={`${event.timestamp?.getTime?.() || index}-${index}`}
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
);

export const LicenseQuotaCard = ({
    nodeCount,
    nodeQuota,
    tier,
    usagePercentage,
    isExhausted
}: {
    nodeCount: number;
    nodeQuota: number;
    tier: string;
    usagePercentage: number;
    isExhausted: boolean;
}) => (
    <Card className={`border-primary/20 bg-card/50 backdrop-blur-sm ${isExhausted ? 'border-red-500/50' : ''}`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">License Quota</CardTitle>
            <Server className={`h-4 w-4 ${isExhausted ? 'text-red-500' : 'text-primary'}`} />
        </CardHeader>
        <CardContent>
            <div className="flex items-center justify-between mb-2">
                <span className="text-2xl font-bold">
                    {nodeCount}/{nodeQuota === -1 ? '∞' : nodeQuota}
                </span>
                <Badge variant={isExhausted ? "destructive" : "secondary"}>
                    {tier ? tier.toUpperCase() : 'FREE'}
                </Badge>
            </div>
            <Progress value={usagePercentage} className={`h-2 ${isExhausted ? 'bg-red-200' : ''}`} />
            <p className="text-xs text-muted-foreground mt-2">
                {isExhausted
                    ? "CRITICAL: Upgrade Tier immediately."
                    : `${nodeQuota - nodeCount} nodes remaining`}
            </p>
        </CardContent>
    </Card>
);
