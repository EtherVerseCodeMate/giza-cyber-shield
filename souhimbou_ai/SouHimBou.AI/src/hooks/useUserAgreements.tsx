import { useState, useEffect, useCallback } from 'react';
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

const REQUIRED_AGREEMENTS = [
  'tos',
  'privacy',
  'saas',
  'beta',
  'dod_compliance',
  'liability_waiver',
  'export_control'
];

export const useUserAgreements = () => {
  const [agreements, setAgreements] = useState<UserAgreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAcceptedAll, setHasAcceptedAll] = useState(false);
  const { toast } = useToast();

  // Check if user has accepted all required agreements
  const checkAgreementStatus = useCallback(async (userId: string) => {
    try {
      // First try using the RPC function which is more reliable and bypasses RLS
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('has_accepted_all_agreements', { user_uuid: userId });

      if (!rpcError && typeof rpcData === 'boolean') {
        setHasAcceptedAll(rpcData);
        return rpcData;
      }

      // Fallback to direct query if RPC fails (e.g. function not deployed yet)
      console.warn('RPC check failed, falling back to direct query:', rpcError);

      // Fetch user's accepted agreements
      const { data, error } = await supabase
        .from('user_agreements')
        .select('agreement_type')
        .eq('user_id', userId)
        .is('revoked_at', null);

      if (error) throw error;

      // Check if all required agreements are accepted
      const acceptedTypes = new Set(data?.map(a => a.agreement_type) || []);
      const allAccepted = REQUIRED_AGREEMENTS.every(type => acceptedTypes.has(type));

      setHasAcceptedAll(allAccepted);
      return allAccepted;
    } catch (error: any) {
      console.error('Error checking agreement status:', error);
      // Suppress toast for initial checks to avoid spamming users if backend is still initializing
      if (error.code !== 'PGRST116' && !error.message?.includes('network')) {
        console.warn("Table access error - this may be expected during first-time setup");
      }
      return false;
    }
  }, [toast]);

  // Fetch user's agreements
  const fetchAgreements = useCallback(async () => {
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
  }, [checkAgreementStatus, toast]);

  // Accept all required agreements
  const acceptAllAgreements = useCallback(async (acceptedTerms: Record<string, boolean>) => {
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

      const AGREEMENT_MAPPING = [
        { key: 'tosAgree', type: 'tos' },
        { key: 'privacyAgree', type: 'privacy' },
        { key: 'saasAgree', type: 'saas' },
        { key: 'betaAgree', type: 'beta' },
        { key: 'dodCompliance', type: 'dod_compliance' },
        { key: 'liabilityWaiver', type: 'liability_waiver' },
        { key: 'exportControl', type: 'export_control' }
      ];

      // Prepare types array
      const agreementTypesArray = AGREEMENT_MAPPING
        .filter(m => acceptedTerms[m.key])
        .map(m => m.type);

      // Try using the secure RPC function first (bypasses potential RLS issues)
      const { error: rpcError } = await supabase.rpc('accept_legal_agreements' as any, {
        user_uuid: user.id,
        user_agent_text: userAgent,
        meta_data: metadata,
        agreement_version_text: '3.0',
        agreement_types: agreementTypesArray
      });

      if (rpcError) {
        console.warn('RPC accept_legal_agreements failed, falling back to direct insert:', rpcError);

        // Fallback: Direct individual inserts
        const insertPromises = AGREEMENT_MAPPING.map(async ({ key, type }) => {
          if (acceptedTerms[key]) {
            const { error } = await supabase
              .from('user_agreements')
              .insert({
                user_id: user.id,
                agreement_type: type,
                agreement_version: '3.0', // Updated to match Khepra LICENSE v3.0
                user_agent: userAgent,
                metadata
              });

            if (error) {
              console.error(`Failed to insert agreement ${type}:`, error);
              // Throw explicitly so Promise.all fails and we catch it below
              throw new Error(`Failed to save ${type}: ${error.message}`);
            }
          }
        });

        await Promise.all(insertPromises);
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
      toast({
        title: "Agreement Error",
        description: error.message || "Failed to accept agreements. Please try again.",
        variant: "destructive"
      });
      return false;
    }
  }, [fetchAgreements, toast]);

  // Revoke a specific agreement (for admin use)
  const revokeAgreement = useCallback(async (agreementId: string) => {
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
  }, [fetchAgreements, toast]);

  useEffect(() => {
    fetchAgreements();
  }, [fetchAgreements]);

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