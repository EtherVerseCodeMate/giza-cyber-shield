/**
 * SubscriptionGate - Tier-based feature gating for onboarding paths
 * Part of Unified Onboarding Workflow Architecture
 */
import { ReactNode } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, Zap, Crown, Loader2, Lock, ArrowRight } from 'lucide-react';

// Tier hierarchy for comparison
const TIER_HIERARCHY: Record<string, number> = {
  'Basic': 1,      // Khepri (Scout)
  'Standard': 2,   // Ra (Hunter)
  'Premium': 3,    // Atum (Hive)
  'Enterprise': 4  // Osiris (Pharaoh)
};

// Egyptian tier mapping
const EGYPTIAN_TIER_MAP: Record<string, { name: string; icon: typeof Shield }> = {
  'Basic': { name: 'Khepri (Scout)', icon: Shield },
  'Standard': { name: 'Ra (Hunter)', icon: Zap },
  'Premium': { name: 'Atum (Hive)', icon: Crown },
  'Enterprise': { name: 'Osiris (Pharaoh)', icon: Crown }
};

interface SubscriptionGateProps {
  requiredTier: 'Basic' | 'Standard' | 'Premium' | 'Enterprise' | 'any';
  children: ReactNode;
  fallback?: ReactNode;
  showUpgradePrompt?: boolean;
}

interface UpgradePromptProps {
  requiredTier: string;
  currentTier: string | null;
  onUpgrade: () => void;
}

const UpgradePrompt = ({ requiredTier, currentTier, onUpgrade }: UpgradePromptProps) => {
  const egyptianTier = EGYPTIAN_TIER_MAP[requiredTier] || { name: requiredTier, icon: Shield };
  const TierIcon = egyptianTier.icon;

  const tierBenefits: Record<string, string[]> = {
    'Standard': [
      'Full STIG configuration scanning',
      'AI-powered compliance verification',
      'Up to 3 nodes monitored',
      'Cloud provider integration (AWS, Azure, GCP)',
      'Basic remediation playbooks'
    ],
    'Premium': [
      'Everything in Standard, plus:',
      'Up to 10 nodes monitored',
      'Deep scan capabilities',
      'Automated remediation',
      'Priority support',
      'Rollback capabilities'
    ],
    'Enterprise': [
      'Everything in Premium, plus:',
      'Unlimited nodes',
      'Air-gapped deployment support',
      'Custom STIG profiles',
      'Dedicated success manager',
      'SLA guarantees'
    ]
  };

  const pricing: Record<string, string> = {
    'Basic': '$99/month',
    'Standard': '$199/month',
    'Premium': '$299/month',
    'Enterprise': 'Contact Sales'
  };

  return (
    <Card className="w-full max-w-lg mx-auto border-2 border-amber-500/30 bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20">
      <CardHeader className="text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center mb-4">
          <Lock className="h-8 w-8 text-white" />
        </div>
        <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
          Upgrade Required
        </CardTitle>
        <CardDescription className="text-gray-600 dark:text-gray-300">
          This feature requires <span className="font-semibold text-amber-600">{egyptianTier.name}</span> tier or higher
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {currentTier && (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <span>Current tier:</span>
            <Badge variant="outline" className="text-gray-600">
              {EGYPTIAN_TIER_MAP[currentTier]?.name || currentTier}
            </Badge>
          </div>
        )}

        <div className="space-y-3">
          <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <TierIcon className="h-5 w-5 text-amber-500" />
            {egyptianTier.name} includes:
          </h4>
          <ul className="space-y-2">
            {(tierBenefits[requiredTier] || []).map((benefit, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                <Zap className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                {benefit}
              </li>
            ))}
          </ul>
        </div>

        <div className="text-center pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-2xl font-bold text-amber-600 mb-2">
            {pricing[requiredTier]}
          </div>
          <Button
            onClick={onUpgrade}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold"
          >
            Upgrade to {egyptianTier.name}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <p className="text-xs text-gray-500 mt-2">
            Secure checkout powered by Stripe. Cancel anytime.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

const LoadingState = () => (
  <div className="flex items-center justify-center p-12">
    <div className="text-center">
      <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
      <p className="text-gray-600 dark:text-gray-300">Verifying subscription...</p>
    </div>
  </div>
);

export function SubscriptionGate({
  requiredTier,
  children,
  fallback,
  showUpgradePrompt = true
}: SubscriptionGateProps) {
  const { subscribed, subscription_tier, loading, createCheckout } = useSubscription();

  if (loading) {
    return <LoadingState />;
  }

  // Check if user has required access
  const hasAccess = (() => {
    if (requiredTier === 'any') {
      return subscribed;
    }

    if (!subscribed || !subscription_tier) {
      return false;
    }

    const userTierLevel = TIER_HIERARCHY[subscription_tier] || 0;
    const requiredTierLevel = TIER_HIERARCHY[requiredTier] || 0;

    return userTierLevel >= requiredTierLevel;
  })();

  if (hasAccess) {
    return <>{children}</>;
  }

  // User doesn't have access
  if (fallback) {
    return <>{fallback}</>;
  }

  if (showUpgradePrompt) {
    const handleUpgrade = async () => {
      try {
        // Map to Stripe plan names
        const planMap: Record<string, 'basic' | 'standard' | 'premium'> = {
          'Basic': 'basic',
          'Standard': 'standard',
          'Premium': 'premium',
          'Enterprise': 'premium' // Enterprise goes through sales, show Premium checkout
        };
        await createCheckout(planMap[requiredTier] || 'standard');
      } catch (error) {
        console.error('Failed to create checkout:', error);
      }
    };

    return (
      <UpgradePrompt
        requiredTier={requiredTier}
        currentTier={subscription_tier}
        onUpgrade={handleUpgrade}
      />
    );
  }

  return null;
}

// Helper hook for checking tier access without rendering
export function useTierAccess(requiredTier: 'Basic' | 'Standard' | 'Premium' | 'Enterprise' | 'any') {
  const { subscribed, subscription_tier, loading } = useSubscription();

  const hasAccess = (() => {
    if (loading) return null; // Still checking
    if (requiredTier === 'any') return subscribed;
    if (!subscribed || !subscription_tier) return false;

    const userTierLevel = TIER_HIERARCHY[subscription_tier] || 0;
    const requiredTierLevel = TIER_HIERARCHY[requiredTier] || 0;

    return userTierLevel >= requiredTierLevel;
  })();

  return {
    hasAccess,
    loading,
    currentTier: subscription_tier,
    requiredTier
  };
}

export default SubscriptionGate;
