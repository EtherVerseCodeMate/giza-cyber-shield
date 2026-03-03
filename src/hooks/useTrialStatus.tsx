import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { useSubscription } from './useSubscription';
import { supabase } from '@/integrations/supabase/client';

export interface TrialStatus {
  isBetaActive: boolean;
  planType: string;
  needsUpgrade: boolean;
  hasBasicAccess: boolean;
}

export const useTrialStatus = () => {
  const { user } = useAuth();
  const { subscribed, subscription_tier } = useSubscription();
  const [trialStatus, setTrialStatus] = useState<TrialStatus>({
    isBetaActive: false,
    planType: 'none',
    needsUpgrade: true,
    hasBasicAccess: false
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      checkTrialStatus();
    } else {
      setLoading(false);
    }
  }, [user, subscribed, subscription_tier]);

  const checkTrialStatus = async () => {
    try {
      setLoading(true);

      // If user has active subscription
      if (subscribed) {
        setTrialStatus({
          isBetaActive: false,
          planType: subscription_tier || 'premium',
          needsUpgrade: false,
          hasBasicAccess: true
        });
        return;
      }

      // Check user status from database
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('plan_type')
        .eq('user_id', user?.id)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return;
      }

      // No free access - need subscription for any features
      setTrialStatus({
        isBetaActive: false,
        planType: 'none',
        needsUpgrade: true,
        hasBasicAccess: false
      });

    } catch (error) {
      console.error('Error checking trial status:', error);
    } finally {
      setLoading(false);
    }
  };

  const upgradeToPaid = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          plan_type: 'trailblazer_plus'
        })
        .eq('user_id', user.id);

      if (!error) {
        await checkTrialStatus();
      }
    } catch (error) {
      console.error('Error upgrading plan:', error);
    }
  };

  const canAccessFeature = (featureType: 'basic' | 'customization' | 'reminders' | 'grace_mode' | 'premium' | 'enterprise') => {
    // Authenticated users always get basic access (free tier)
    if (featureType === 'basic') return !!user;

    // Paid tiers only
    if (!subscribed) return false;

    const tier = subscription_tier?.toUpperCase();

    // Enterprise features require ATUM or OSIRIS
    if (featureType === 'enterprise') return tier === 'ATUM' || tier === 'OSIRIS';

    // Premium features require RA, ATUM, or OSIRIS
    if (featureType === 'premium') return tier === 'RA' || tier === 'ATUM' || tier === 'OSIRIS';

    // customization / reminders / grace_mode — any paid tier
    return true;
  };

  return {
    trialStatus,
    loading,
    canAccessFeature,
    checkTrialStatus,
    upgradeToPaid
  };
};