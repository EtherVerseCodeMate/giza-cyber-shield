import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useKhepraAPI } from '@/hooks/useKhepraAPI';
import { useKhepraLicenseUpdates } from '@/hooks/useKhepraWebSocket';
import {
  Key,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  Building2,
  Cpu,
  Shield,
  Zap,
  Lock,
} from 'lucide-react';

interface KhepraLicenseWidgetProps {
  deploymentUrl: string;
  apiKey: string;
}

const FEATURE_ICONS: Record<string, React.ReactNode> = {
  'premium-pqc': <Shield className="h-4 w-4" />,
  'community-pqc': <Shield className="h-4 w-4" opacity={0.5} />,
  'white-box-crypto': <Lock className="h-4 w-4" />,
  'stig-validation': <CheckCircle className="h-4 w-4" />,
  'stig-nist': <CheckCircle className="h-4 w-4" />,
  'real-time-monitoring': <Zap className="h-4 w-4" />,
  'threat-detection': <Zap className="h-4 w-4" />,
  'advanced-reporting': <Building2 className="h-4 w-4" />,
  'api-access': <Cpu className="h-4 w-4" />,
  'sso-rbac': <Lock className="h-4 w-4" />,
  'auto-remediation': <Zap className="h-4 w-4" />,
};

export function KhepraLicenseWidget({ deploymentUrl, apiKey }: KhepraLicenseWidgetProps) {
  const { license, heartbeat, telemetryStatus } = useKhepraAPI(deploymentUrl, apiKey);
  const { licenseUpdates } = useKhepraLicenseUpdates(deploymentUrl);

  const latestUpdate = licenseUpdates[licenseUpdates.length - 1];
  const data = license.data;

  const handleHeartbeat = async () => {
    try {
      await heartbeat.mutateAsync();
    } catch (error) {
      console.error('Heartbeat failed:', error);
    }
  };

  if (license.isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            License Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-pulse text-muted-foreground">Loading license...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (license.isError || !data) {
    return (
      <Card className="w-full border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <XCircle className="h-5 w-5" />
            License Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600">
            Failed to retrieve license status. Please check your connection.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getTierBadge = (tier: string) => {
    const colors: Record<string, string> = {
      community: 'bg-gray-100 text-gray-800 border-gray-200',
      khepri: 'bg-orange-100 text-orange-800 border-orange-200',
      ra: 'bg-blue-100 text-blue-800 border-blue-200',
      atum: 'bg-purple-100 text-purple-800 border-purple-200',
      osiris: 'bg-green-100 text-green-800 border-green-200 shadow-sm font-bold',
    };

    return (
      <Badge variant="outline" className={`${colors[tier] || colors.community} uppercase px-2 py-0.5`}>
        {tier}
      </Badge>
    );
  };

  const getStatusIndicator = () => {
    if (data.revoked) {
      return (
        <div className="flex items-center gap-2 text-red-600">
          <XCircle className="h-5 w-5" />
          <span className="font-medium">Revoked</span>
        </div>
      );
    }

    if (!data.is_valid) {
      return (
        <div className="flex items-center gap-2 text-red-600">
          <XCircle className="h-5 w-5" />
          <span className="font-medium">Invalid</span>
        </div>
      );
    }

    if (data.days_remaining <= 7 && data.days_remaining > 0) {
      return (
        <div className="flex items-center gap-2 text-orange-600">
          <AlertTriangle className="h-5 w-5" />
          <span className="font-medium">Expiring Soon</span>
        </div>
      );
    }

    if (data.days_remaining === 0 && data.license_tier !== 'osiris') {
      return (
        <div className="flex items-center gap-2 text-red-600">
          <XCircle className="h-5 w-5" />
          <span className="font-medium">Expired</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 text-green-600">
        <CheckCircle className="h-5 w-5" />
        <span className="font-medium">Active</span>
      </div>
    );
  };

  const daysProgress = data.days_remaining === 0 && data.license_tier === 'osiris'
    ? 100
    : Math.min(100, (data.days_remaining / 365) * 100);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              License Status
            </CardTitle>
            <CardDescription className="flex items-center gap-1">
              Merkaba Egyptian Tier System: <span className="text-foreground font-medium">{data.organization}</span>
            </CardDescription>
          </div>
          {getTierBadge(data.license_tier)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Indicator */}
        <div className="flex items-center justify-between">
          {getStatusIndicator()}
          <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
            ID: {data.machine_id}
          </span>
        </div>

        {/* Live Update Alert */}
        {latestUpdate && latestUpdate.status !== 'valid' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
            <div className="flex items-center gap-2 text-yellow-700">
              <AlertTriangle className="h-4 w-4" />
              <span>{latestUpdate.message || 'License status changed'}</span>
            </div>
          </div>
        )}

        {/* Days Remaining / Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Validity Period</span>
            <span className="font-medium">
              {data.days_remaining === 0 && data.license_tier === 'osiris'
                ? 'Perpetual (Eternal Sun)'
                : `${data.days_remaining} days remaining`}
            </span>
          </div>
          <Progress
            value={daysProgress}
            className={`h-2 ${data.days_remaining <= 7 && data.license_tier !== 'osiris'
                ? '[&>div]:bg-red-500'
                : data.days_remaining <= 30 && data.license_tier !== 'osiris'
                  ? '[&>div]:bg-yellow-500'
                  : '[&>div]:bg-green-500'
              }`}
          />
        </div>

        <Separator />

        {/* License Details */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Solar Phase Birth</span>
            <div className="font-medium">
              {new Date(data.issued_at).toLocaleDateString()}
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">Sunset (Expiry)</span>
            <div className="font-medium">
              {data.days_remaining === 0 && data.license_tier === 'osiris'
                ? 'Never (Osiris Rise)'
                : new Date(data.expires_at).toLocaleDateString()}
            </div>
          </div>
          {data.last_heartbeat && (
            <div className="col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-muted-foreground">Last Telemetry Heartbeat</span>
                  <div className="font-medium">
                    {new Date(data.last_heartbeat).toLocaleString()}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleHeartbeat}
                  disabled={heartbeat.isPending}
                  className="h-8 text-xs gap-1"
                >
                  <Activity className={`h-3 w-3 ${heartbeat.isPending ? 'animate-pulse' : ''}`} />
                  Sync
                </Button>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Features */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Deity Authorities & Features</h4>
          <div className="grid grid-cols-2 gap-2">
            {data.features.map((feature) => (
              <div
                key={feature}
                className="flex items-center gap-2 text-sm bg-muted/50 border border-border/50 rounded-lg px-3 py-2"
              >
                {FEATURE_ICONS[feature] || <CheckCircle className="h-4 w-4 text-primary/60" />}
                <span className="truncate">
                  {feature.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
