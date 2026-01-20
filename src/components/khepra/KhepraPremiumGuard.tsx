import { type ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lock, Shield, Crown, Zap } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { useTrialStatus } from '@/hooks/useTrialStatus';

interface KhepraPremiumGuardProps {
  children: React.ReactNode;
  feature?: string;
}

export const KhepraPremiumGuard: React.FC<KhepraPremiumGuardProps> = ({ 
  children, 
  feature = 'khepra-protocol' 
}) => {
  const { subscribed, subscription_tier, createCheckout } = useSubscription();
  const { canAccessFeature } = useTrialStatus();

  // KHEPRA requires Standard+ licensing (not available in trial)
  const hasAccess = subscribed && (
    subscription_tier === 'Standard' || 
    subscription_tier === 'Premium'
  );

  if (hasAccess) {
    return <>{children}</>;
  }

  const handleUpgrade = async () => {
    try {
      await createCheckout('standard');
    } catch (error) {
      console.error('Failed to create checkout:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          {/* Header */}
          <div className="space-y-4">
            <div className="flex items-center justify-center space-x-3">
              <Shield className="h-12 w-12 text-primary" />
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                KHEPRA Protocol
              </h1>
              <Badge variant="outline" className="text-xs font-semibold">
                Patent Pending
              </Badge>
            </div>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Afrofuturist Cryptographic Framework for Agentic AI Security
            </p>
          </div>

          {/* Premium Lock Card */}
          <Card className="border-primary/20 bg-card/50 backdrop-blur-sm shadow-2xl">
            <CardHeader className="pb-8">
              <div className="flex items-center justify-center mb-4">
                <div className="p-4 rounded-full bg-primary/10 border border-primary/20">
                  <Lock className="h-8 w-8 text-primary" />
                </div>
              </div>
            <CardTitle className="text-2xl flex items-center justify-center space-x-2">
                <Crown className="h-6 w-6 text-amber-500" />
                <span>Advanced Feature</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  The KHEPRA Protocol is our cutting-edge, patent-pending technology that provides:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <Zap className="h-4 w-4 text-primary" />
                    <span>Adinkra Algebraic Encoding</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Zap className="h-4 w-4 text-primary" />
                    <span>Cultural Threat Intelligence</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Zap className="h-4 w-4 text-primary" />
                    <span>Quantum-Resilient Security</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Zap className="h-4 w-4 text-primary" />
                    <span>Trusted Agent Registry</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-6">
                <p className="text-sm text-muted-foreground mb-6">
                  Upgrade to Standard to unlock access to this revolutionary cybersecurity framework.
                </p>
                <Button 
                  onClick={handleUpgrade}
                  size="lg"
                  className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                >
                  <Crown className="h-5 w-5 mr-2" />
                  Upgrade to Standard
                </Button>
              </div>

              <div className="text-xs text-muted-foreground/70 border-t border-border pt-4">
                <p>
                  <strong>Legal Notice:</strong> KHEPRA Protocol technology is patent-pending intellectual property. 
                  Access is restricted to licensed Premium subscribers during the patent filing process.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Current Status */}
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Current Plan: {subscription_tier || 'Free'}</p>
            {subscribed && (
              <p>Status: {hasAccess ? 'Access Granted' : 'Upgrade Required'}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};