import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UserAgreement {
  id: string;
  user_id: string;
  agreement_type: string;
  agreement_version: string;
  accepted_at: string;
  ip_address?: unknown;
  user_agent?: string;
  metadata?: any;
  revoked_at?: string;
  organization_id?: string;
  created_at?: string;
  updated_at?: string;
}

export const useUserAgreements = () => {
  const [agreements, setAgreements] = useState<UserAgreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAcceptedAll, setHasAcceptedAll] = useState(false);
  const { toast } = useToast();

  // Required agreement types based on Khepra LICENSE
  const REQUIRED_AGREEMENTS = [
    'tos',
    'privacy',
    'saas',
    'beta',
    'dod_compliance',
    'liability_waiver',
    'export_control'
  ];

  // Check if user has accepted all required agreements
  const checkAgreementStatus = async (userId: string) => {
    try {
      // Fetch user's accepted agreements
      const { data, error } = await supabase
        .from('user_agreements')
        .select('agreement_type')
        .eq('user_id', userId)
        .is('revoked_at', null);

      if (error) {
        // Check if table doesn't exist yet (migration pending)
        if (error.message?.includes('relation') || error.message?.includes('does not exist')) {
          console.warn('user_agreements table not found - skipping agreement check');
          setHasAcceptedAll(false);
          return false;
        }
        throw error;
      }

      // Check if all required agreements are accepted
      const acceptedTypes = new Set(data?.map(a => a.agreement_type) || []);
      const allAccepted = REQUIRED_AGREEMENTS.every(type => acceptedTypes.has(type));

      setHasAcceptedAll(allAccepted);
      return allAccepted;
    } catch (error: any) {
      console.error('Error checking agreement status:', error);
      // Only show toast for actual errors, not missing table
      if (!error.message?.includes('relation') && !error.message?.includes('does not exist')) {
        toast({
          title: "Error",
          description: "Failed to check agreement status. Please try again.",
          variant: "destructive"
        });
      }
      return false;
    }
  };

  // Fetch user's agreements
  const fetchAgreements = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_agreements')
        .select('*')
        .eq('user_id', user.id)
        .is('revoked_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setAgreements(data || []);
      await checkAgreementStatus(user.id);
    } catch (error: any) {
      console.error('Error fetching agreements:', error);
      // Don't show toast on initial load if table doesn't exist yet
      if (!error.message?.includes('relation') && !error.message?.includes('does not exist')) {
        toast({
          title: "Error",
          description: "Failed to fetch agreement status",
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Accept all required agreements
  const acceptAllAgreements = async (acceptedTerms: Record<string, boolean>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get client info
      const userAgent = navigator.userAgent;
      const metadata = {
        timestamp: new Date().toISOString(),
        browser: userAgent,
        accepted_terms: acceptedTerms
      };

      // Create agreement records for each accepted term
      const agreementTypes = [
        { key: 'tosAgree', type: 'tos' },
        { key: 'privacyAgree', type: 'privacy' },
        { key: 'saasAgree', type: 'saas' },
        { key: 'betaAgree', type: 'beta' },
        { key: 'dodCompliance', type: 'dod_compliance' },
        { key: 'liabilityWaiver', type: 'liability_waiver' },
        { key: 'exportControl', type: 'export_control' }
      ];

      const insertPromises = agreementTypes.map(({ key, type }) => {
        if (acceptedTerms[key]) {
          return supabase
            .from('user_agreements')
            .insert({
              user_id: user.id,
              agreement_type: type,
              agreement_version: '3.0', // Updated to match Khepra LICENSE v3.0
              user_agent: userAgent,
              metadata
            });
        }
        return Promise.resolve();
      });

      const results = await Promise.allSettled(insertPromises);
      
      // Check if any inserts failed
      const failures = results.filter(r => r.status === 'rejected');
      if (failures.length > 0) {
        console.error('Some agreement inserts failed:', failures);
        throw new Error(`Failed to save ${failures.length} agreement(s)`);
      }

      // Refresh agreement status
      await fetchAgreements();

      toast({
        title: "Agreements Accepted",
        description: "All legal agreements have been accepted successfully",
        variant: "default"
      });

      return true;
    } catch (error: any) {
      console.error('Error accepting agreements:', error);
      
      // Provide more specific error message
      let errorMsg = "Failed to accept agreements. Please try again.";
      if (error.message?.includes('relation') || error.message?.includes('does not exist')) {
        errorMsg = "Database not ready. Please contact support.";
      } else if (error.message?.includes('Not authenticated')) {
        errorMsg = "You must be logged in to accept agreements.";
      }
      
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive"
      });
      return false;
    }
  };

  // Revoke a specific agreement (for admin use)
  const revokeAgreement = async (agreementId: string) => {
    try {
      const { error } = await supabase
        .from('user_agreements')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', agreementId);

      if (error) throw error;

      await fetchAgreements();

      toast({
        title: "Agreement Revoked",
        description: "The agreement has been revoked successfully",
        variant: "default"
      });
    } catch (error: any) {
      console.error('Error revoking agreement:', error);
      toast({
        title: "Error",
        description: "Failed to revoke agreement",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    fetchAgreements();
  }, []);

  return {
    agreements,
    loading,
    hasAcceptedAll,
    acceptAllAgreements,
    revokeAgreement,
    checkAgreementStatus,
    refreshAgreements: fetchAgreements
  };
};