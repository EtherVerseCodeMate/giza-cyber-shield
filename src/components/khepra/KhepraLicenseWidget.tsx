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
  premium_pqc: <Shield className="h-4 w-4" />,
  white_box_crypto: <Lock className="h-4 w-4" />,
  stig_validation: <CheckCircle className="h-4 w-4" />,
  real_time_monitoring: <Zap className="h-4 w-4" />,
  advanced_reporting: <Building2 className="h-4 w-4" />,
  api_access: <Cpu className="h-4 w-4" />,
};

export function KhepraLicenseWidget({ deploymentUrl, apiKey }: KhepraLicenseWidgetProps) {
  const { license } = useKhepraAPI(deploymentUrl, apiKey);
  const { licenseUpdates } = useKhepraLicenseUpdates(deploymentUrl);

  const latestUpdate = licenseUpdates[licenseUpdates.length - 1];
  const data = license.data;

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
      community: 'bg-gray-100 text-gray-800',
      pro: 'bg-blue-100 text-blue-800',
      enterprise: 'bg-purple-100 text-purple-800',
      dod_premium: 'bg-green-100 text-green-800',
    };

    return (
      <Badge className={colors[tier] || colors.community}>
        {tier.replace('_', ' ').toUpperCase()}
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

    if (data.days_remaining <= 7) {
      return (
        <div className="flex items-center gap-2 text-orange-600">
          <AlertTriangle className="h-5 w-5" />
          <span className="font-medium">Expiring Soon</span>
        </div>
      );
    }

    if (data.days_remaining <= 30) {
      return (
        <div className="flex items-center gap-2 text-yellow-600">
          <Clock className="h-5 w-5" />
          <span className="font-medium">Renewal Needed</span>
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

  const daysProgress = Math.min(100, (data.days_remaining / 365) * 100);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              License Status
            </CardTitle>
            <CardDescription>
              AdinKhepra Protocol license for {data.organization}
            </CardDescription>
          </div>
          {getTierBadge(data.license_tier)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Indicator */}
        <div className="flex items-center justify-between">
          {getStatusIndicator()}
          <span className="text-sm text-muted-foreground">
            Machine: {data.machine_id.slice(0, 12)}...
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

        {/* Days Remaining */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Days Remaining</span>
            <span className="font-medium">{data.days_remaining} days</span>
          </div>
          <Progress
            value={daysProgress}
            className={`h-2 ${
              data.days_remaining <= 7
                ? '[&>div]:bg-red-500'
                : data.days_remaining <= 30
                ? '[&>div]:bg-yellow-500'
                : '[&>div]:bg-green-500'
            }`}
          />
        </div>

        <Separator />

        {/* License Details */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Issued</span>
            <div className="font-medium">
              {new Date(data.issued_at).toLocaleDateString()}
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">Expires</span>
            <div className="font-medium">
              {new Date(data.expires_at).toLocaleDateString()}
            </div>
          </div>
          {data.last_heartbeat && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Last Heartbeat</span>
              <div className="font-medium">
                {new Date(data.last_heartbeat).toLocaleString()}
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Features */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Licensed Features</h4>
          <div className="grid grid-cols-2 gap-2">
            {data.features.map((feature) => (
              <div
                key={feature}
                className="flex items-center gap-2 text-sm bg-muted rounded-lg px-3 py-2"
              >
                {FEATURE_ICONS[feature] || <CheckCircle className="h-4 w-4" />}
                <span className="truncate">
                  {feature.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
