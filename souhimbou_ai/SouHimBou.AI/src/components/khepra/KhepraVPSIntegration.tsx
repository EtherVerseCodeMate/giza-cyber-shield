import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useKhepraDeployment } from '@/hooks/useKhepraDeployment';
import { useKhepraAPI } from '@/hooks/useKhepraAPI';
import {
    Server,
    Shield,
    Globe,
    Key,
    Activity,
    CheckCircle,
    XCircle,
    RefreshCw,
    Info,
    ExternalLink
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function KhepraVPSIntegration() {
    const { config, updateConfig, isUpdating, isLoading: isConfigLoading } = useKhepraDeployment();
    const [url, setUrl] = useState('');
    const [key, setKey] = useState('');

    // Sync local state with fetched config
    useEffect(() => {
        if (config) {
            setUrl(config.deploymentUrl);
            setKey(config.apiKey);
        }
    }, [config]);

    // Use the API hook with current local state for testing
    const { health } = useKhepraAPI(url, key);

    const handleSave = async () => {
        await updateConfig({
            deploymentUrl: url,
            apiKey: key
        });
    };

    const isConnected = health.data?.status === 'healthy';

    return (
        <Card className="w-full border-primary/20 shadow-lg overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-primary via-primary/50 to-primary/20" />
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                            <Server className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-xl">Khepra VPS / Private Cloud</CardTitle>
                            <CardDescription>
                                Connect your self-hosted Khepra instance for hybrid security orchestration.
                            </CardDescription>
                        </div>
                    </div>
                    <Badge
                        variant={isConnected ? "default" : "outline"}
                        className={isConnected ? "bg-green-500 hover:bg-green-600" : "text-muted-foreground"}
                    >
                        {isConnected ? (
                            <span className="flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" /> Connected
                            </span>
                        ) : (
                            <span className="flex items-center gap-1">
                                <XCircle className="h-3 w-3" /> Disconnected
                            </span>
                        )}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <Alert className="bg-muted/50 border-primary/10">
                    <Info className="h-4 w-4" />
                    <AlertTitle>Hybrid Deployment Model</AlertTitle>
                    <AlertDescription className="text-xs">
                        This integration allows SouHimBou.AI to orchestrate security scans, manage PQC licenses,
                        and collect audit logs from your private Khepra deployment.
                    </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="vps-url" className="flex items-center gap-2">
                            <Globe className="h-4 w-4 text-muted-foreground" />
                            Deployment Endpoint
                        </Label>
                        <Input
                            id="vps-url"
                            placeholder="https://khepra.yourdomain.com"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            className="font-mono text-sm"
                        />
                        <p className="text-[10px] text-muted-foreground">
                            The public or VPN-accessible URL of your Khepra API server.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="vps-key" className="flex items-center gap-2">
                            <Key className="h-4 w-4 text-muted-foreground" />
                            Environment API Key
                        </Label>
                        <div className="relative">
                            <Input
                                id="vps-key"
                                type="password"
                                placeholder="kp_live_xxxxxxxxxxxx"
                                value={key}
                                onChange={(e) => setKey(e.target.value)}
                                className="font-mono text-sm pr-10"
                            />
                            <div className="absolute right-3 top-2.5">
                                <Shield className="h-4 w-4 text-primary/30" />
                            </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                            Required for authenticated access to your private node.
                        </p>
                    </div>
                </div>

                {health.data && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border/50">
                        <div className="space-y-1">
                            <span className="text-xs text-muted-foreground block">Version</span>
                            <span className="text-sm font-medium">{health.data.version || 'N/A'}</span>
                        </div>
                        <div className="space-y-1">
                            <span className="text-xs text-muted-foreground block">Ledger Depth</span>
                            <span className="text-sm font-medium">{health.data.dag_nodes || 0} nodes</span>
                        </div>
                        <div className="space-y-1">
                            <span className="text-xs text-muted-foreground block">License Mode</span>
                            <span className="text-sm font-medium capitalize">{health.data.license_status || 'Unknown'}</span>
                        </div>
                        <div className="space-y-1">
                            <span className="text-xs text-muted-foreground block">Uptime</span>
                            <span className="text-sm font-medium">
                                {Math.floor(health.data.uptime_seconds / 3600)}h {Math.floor((health.data.uptime_seconds % 3600) / 60)}m
                            </span>
                        </div>
                    </div>
                )}
            </CardContent>
            <CardFooter className="bg-muted/30 border-t border-border/50 flex items-center justify-between py-4">
                <div className="flex items-center gap-2">
                    {url && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs gap-1"
                            onClick={() => window.open(`${url}/health`, '_blank')}
                        >
                            <ExternalLink className="h-3 w-3" /> View Raw Health
                        </Button>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => health.refetch()}
                        disabled={health.isRefetching || !url}
                    >
                        <RefreshCw className={`h-4 w-4 mr-1 ${health.isRefetching ? 'animate-spin' : ''}`} />
                        Test Connection
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={isUpdating || !url || (url === config?.deploymentUrl && key === config?.apiKey)}
                    >
                        {isUpdating ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                        Save Configuration
                    </Button>
                </div>
            </CardFooter>
        </Card>
    );
}
