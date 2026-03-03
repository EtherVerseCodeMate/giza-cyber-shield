import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface SubscriptionStatus {
  subscribed: boolean;
  subscription_tier: string | null;
  subscription_end: string | null;
  loading: boolean;
  error: string | null;
}

export const useSubscription = () => {
  const [status, setStatus] = useState<SubscriptionStatus>({
    subscribed: false,
    subscription_tier: null,
    subscription_end: null,
    loading: true,
    error: null
  });
  const { user } = useAuth();

  const checkSubscription = async () => {
    if (!user) {
      setStatus(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      setStatus(prev => ({ ...prev, loading: true, error: null }));
      
      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;

      setStatus({
        subscribed: data.subscribed || false,
        subscription_tier: data.subscription_tier || null,
        subscription_end: data.subscription_end || null,
        loading: false,
        error: null
      });
    } catch (error: any) {
      console.error('Error checking subscription:', error);
      setStatus(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to check subscription'
      }));
    }
  };

  const createCheckout = async (plan: 'KHEPRI' | 'RA' | 'ATUM' | 'trailblazer_plus' | 'khepri' | 'ra' | 'atum' = 'KHEPRI') => {
    if (!user) throw new Error('User not authenticated');

    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { plan },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;

      // Open Stripe checkout in a new tab
      window.open(data.url, '_blank');
      
      return data;
    } catch (error: any) {
      console.error('Error creating checkout:', error);
      throw error;
    }
  };

  const openCustomerPortal = async () => {
    if (!user) throw new Error('User not authenticated');

    try {
      const { data, error } = await supabase.functions.invoke('customer-portal', {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;

      // Open customer portal in a new tab
      window.open(data.url, '_blank');
      
      return data;
    } catch (error: any) {
      console.error('Error opening customer portal:', error);
      throw error;
    }
  };

  useEffect(() => {
    if (user) {
      checkSubscription();
    }
  }, [user]);

  return {
    ...status,
    checkSubscription,
    createCheckout,
    openCustomerPortal,
    hasFeatureAccess: (feature: string) => {
      if (!status.subscribed) return false;
      const tier = status.subscription_tier?.toUpperCase();
      // OSIRIS / ATUM — full access
      if (tier === 'OSIRIS' || tier === 'ATUM') return true;
      // RA — all except enterprise-only features
      if (tier === 'RA') return feature !== 'air-gapped' && feature !== 'hsm';
      // KHEPRI — core features only
      if (tier === 'KHEPRI') return ['pqc-scanning', 'basic-security', 'basic-monitoring', 'pdf-reports'].includes(feature);
      return false;
    }
  };
};