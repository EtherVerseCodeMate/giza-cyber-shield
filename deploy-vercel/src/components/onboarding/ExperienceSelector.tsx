/**
 * ExperienceSelector - Unified Onboarding Workflow Entry Point
 *
 * Three paths with subscription-based gating:
 * 1. STIG Configuration Setup (enterprise-setup) - Requires Standard (Ra) tier
 * 2. Quick Platform Tour (quick-tour) - No gate, demo mode
 * 3. Compliance Dashboard (executive-summary) - Any subscription + existing data
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  Play,
  Eye,
  CheckCircle,
  ArrowRight,
  Shield,
  Brain,
  Clock,
  Lock,
  Loader2,
  Sparkles
} from 'lucide-react';

interface ExperienceSelectorProps {
  onExperienceSelected?: (experience: string) => void;
}

const ExperienceSelector: React.FC<ExperienceSelectorProps> = ({ onExperienceSelected }) => {
  const [selectedExperience, setSelectedExperience] = useState<string | null>(null);
  const [processingPath, setProcessingPath] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const {
    subscribed,
    subscription_tier,
    loading: subscriptionLoading,
    createCheckout
  } = useSubscription();

  // Tier hierarchy for comparison
  const tierMeetsRequirement = (required: 'Standard' | 'Premium' | 'Basic' | 'any'): boolean => {
    if (required === 'any') return subscribed;
    if (!subscribed || !subscription_tier) return false;

    const hierarchy: Record<string, number> = {
      'Basic': 1,
      'Standard': 2,
      'Premium': 3,
      'Enterprise': 4
    };

    return (hierarchy[subscription_tier] || 0) >= (hierarchy[required] || 0);
  };

  // Check if user has existing compliance data
  const checkExistingComplianceData = async (): Promise<boolean> => {
    if (!user) return false;

    try {
      const { data, error } = await supabase
        .from('organization_onboarding')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      return !error && !!data;
    } catch {
      return false;
    }
  };

  const handlePathSelection = async (pathId: string) => {
    setProcessingPath(pathId);

    try {
      switch (pathId) {
        case 'enterprise-setup':
          // Gate: Requires Standard (Ra) tier or higher
          if (!user) {
            toast({
              title: "Authentication Required",
              description: "Please sign in to access STIG Configuration Setup",
              variant: "destructive"
            });
            navigate('/auth?redirect=/onboarding');
            return;
          }

          if (!tierMeetsRequirement('Standard')) {
            toast({
              title: "Upgrade Required",
              description: "STIG Configuration Setup requires Ra (Standard) tier or higher",
            });
            await createCheckout('standard');
            return;
          }

          // User has access - proceed to setup
          if (onExperienceSelected) {
            onExperienceSelected(pathId);
          } else {
            navigate('/onboarding/enterprise-setup');
          }
          break;

        case 'quick-tour':
          // No gate - available to all users including unauthenticated
          if (onExperienceSelected) {
            onExperienceSelected(pathId);
          } else {
            navigate('/dashboard?tour=true&demo=true');
          }
          break;

        case 'executive-summary':
          // Gate: Requires any subscription + existing compliance data
          if (!user) {
            toast({
              title: "Authentication Required",
              description: "Please sign in to access the Compliance Dashboard",
              variant: "destructive"
            });
            navigate('/auth?redirect=/onboarding');
            return;
          }

          if (!subscribed) {
            toast({
              title: "Subscription Required",
              description: "Compliance Dashboard requires an active subscription",
            });
            await createCheckout('basic');
            return;
          }

          // Check for existing compliance data
          const hasData = await checkExistingComplianceData();
          if (!hasData) {
            toast({
              title: "Setup Required",
              description: "Complete STIG Configuration Setup first to access the dashboard",
            });
            if (onExperienceSelected) {
              onExperienceSelected('enterprise-setup');
            } else {
              navigate('/onboarding/enterprise-setup?source=dashboard-redirect');
            }
            return;
          }

          // User has access and data - go to dashboard
          if (onExperienceSelected) {
            onExperienceSelected(pathId);
          } else {
            navigate('/dashboard?mode=executive');
          }
          break;
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to process selection",
        variant: "destructive"
      });
    } finally {
      setProcessingPath(null);
    }
  };

  // Get badge for path based on subscription status
  const getPathBadge = (pathId: string): { text: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } | null => {
    if (subscriptionLoading) return null;

    switch (pathId) {
      case 'enterprise-setup':
        if (!user) return { text: 'Sign In Required', variant: 'secondary' };
        if (!tierMeetsRequirement('Standard')) return { text: 'Upgrade to Ra', variant: 'destructive' };
        return { text: 'Available', variant: 'default' };

      case 'quick-tour':
        return { text: 'Free Demo', variant: 'outline' };

      case 'executive-summary':
        if (!user) return { text: 'Sign In Required', variant: 'secondary' };
        if (!subscribed) return { text: 'Subscription Required', variant: 'destructive' };
        return { text: 'Available', variant: 'default' };

      default:
        return null;
    }
  };

  const experiences = [
    {
      id: 'enterprise-setup',
      title: 'STIG Configuration Setup',
      description: 'Connect your environment for STIG configuration search, AI verification, baseline capture, and drift detection.',
      icon: Shield,
      color: 'from-orange-500 to-red-500',
      bgColor: 'bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20',
      borderColor: 'border-orange-200 dark:border-orange-800',
      features: [
        'STIG configuration registry',
        'AI-powered verification',
        'Configuration baselines',
        'Drift detection monitoring'
      ],
      buttonText: 'Start Setup',
      estimatedTime: '10-15 minutes',
      requiredTier: 'Ra (Standard)'
    },
    {
      id: 'quick-tour',
      title: 'Quick Platform Tour',
      description: 'Explore STIG configuration search, AI verification, and drift detection capabilities with sample data.',
      icon: Play,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20',
      borderColor: 'border-blue-200 dark:border-blue-800',
      features: [
        'Interactive demo mode',
        'Sample STIG configurations',
        'Live drift detection preview'
      ],
      buttonText: 'Start Tour',
      estimatedTime: '5-10 minutes',
      requiredTier: null
    },
    {
      id: 'executive-summary',
      title: 'Compliance Dashboard',
      description: 'High-level view of STIG compliance status, configuration drift, and baseline health across your environment.',
      icon: Eye,
      color: 'from-purple-500 to-indigo-500',
      bgColor: 'bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20',
      borderColor: 'border-purple-200 dark:border-purple-800',
      features: [
        'STIG compliance overview',
        'Configuration drift status',
        'Baseline health metrics'
      ],
      buttonText: 'View Dashboard',
      estimatedTime: 'Immediate access',
      requiredTier: 'Any subscription'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-blue-900 dark:to-indigo-900 flex items-center justify-center p-6">
      <div className="w-full max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-6">
            <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl">
              <Brain className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Choose Your Experience
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Welcome to STIG-first compliance automation. Select how you'd like to explore
            configuration management, AI verification, and drift detection.
          </p>

          {/* Subscription Status Indicator */}
          {user && !subscriptionLoading && (
            <div className="mt-6 inline-flex items-center gap-2 bg-white/80 dark:bg-gray-800/80 rounded-full px-4 py-2 border">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {subscribed
                  ? `Current tier: ${subscription_tier}`
                  : 'Free tier - Upgrade for full access'}
              </span>
            </div>
          )}
        </div>

        {/* Experience Cards */}
        <div className="grid md:grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {experiences.map((experience) => {
            const badge = getPathBadge(experience.id);
            const isProcessing = processingPath === experience.id;
            const isLocked = badge?.variant === 'destructive' || badge?.variant === 'secondary';

            return (
              <Card
                key={experience.id}
                className={`
                  ${experience.bgColor} ${experience.borderColor} border-2
                  hover:shadow-2xl transition-all duration-300 cursor-pointer relative
                  ${selectedExperience === experience.id ? 'ring-4 ring-blue-500/20 scale-105' : 'scale-100'}
                  ${isLocked ? 'opacity-90' : ''}
                `}
                onClick={() => setSelectedExperience(experience.id)}
              >
                {/* Badge */}
                {badge && (
                  <div className="absolute top-4 right-4">
                    <Badge variant={badge.variant} className="text-xs">
                      {isLocked && <Lock className="h-3 w-3 mr-1" />}
                      {badge.text}
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-4">
                  <div className={`w-16 h-16 mx-auto rounded-2xl bg-gradient-to-r ${experience.color} flex items-center justify-center mb-4`}>
                    <experience.icon className="h-8 w-8 text-white" />
                  </div>
                  <CardTitle className="text-xl font-bold text-gray-900 dark:text-white">
                    {experience.title}
                  </CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-300 leading-relaxed">
                    {experience.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                  {/* Features */}
                  <div className="space-y-3">
                    {experience.features.map((feature, index) => (
                      <div key={index} className="flex items-center space-x-3">
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {feature}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Time Estimate */}
                  <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4" />
                      <span>{experience.estimatedTime}</span>
                    </div>
                    {experience.requiredTier && (
                      <span className="text-xs">
                        Requires: {experience.requiredTier}
                      </span>
                    )}
                  </div>

                  {/* Action Button */}
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePathSelection(experience.id);
                    }}
                    disabled={isProcessing}
                    className={`
                      w-full bg-gradient-to-r ${experience.color}
                      hover:opacity-90 text-white font-semibold
                      transition-all duration-200 group
                      disabled:opacity-50
                    `}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <span>{experience.buttonText}</span>
                        <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Bottom Status */}
        <div className="text-center">
          <div className="inline-flex items-center space-x-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-full px-6 py-3 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                System Ready
              </span>
            </div>
            <div className="text-gray-400">•</div>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              STIG registry & AI verification online
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExperienceSelector;