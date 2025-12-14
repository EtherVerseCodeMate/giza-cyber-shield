import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ConsultingAccess {
  diagnostic_paid: boolean;
  advisory_requested: boolean;
  advisory_approved: boolean;
  subscription_status: string | null;
}

export function useConsultingAccess() {
  const [access, setAccess] = useState<ConsultingAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    checkAccess();
    
    // Subscribe to auth changes to refresh access
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkAccess();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function checkAccess() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setAccess(null);
        return;
      }

      const { data, error } = await supabase
        .from("consulting_access")
        .select("diagnostic_paid, advisory_requested, advisory_approved, subscription_status")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      setAccess(data || {
        diagnostic_paid: false,
        advisory_requested: false,
        advisory_approved: false,
        subscription_status: null,
      });
    } catch (err) {
      setError(err as Error);
      console.error("Error checking consulting access:", err);
    } finally {
      setLoading(false);
    }
  }

  // Access helpers
  const hasDiagnosticAccess = access?.diagnostic_paid ?? false;
  const hasAdvisoryAccess = (access?.subscription_status === "active" && access?.advisory_approved) ?? false;
  const isAdvisoryPending = (access?.subscription_status === "active" && !access?.advisory_approved) ?? false;

  return {
    access,
    loading,
    error,
    refresh: checkAccess,
    hasDiagnosticAccess,
    hasAdvisoryAccess,
    isAdvisoryPending,
  };
}
