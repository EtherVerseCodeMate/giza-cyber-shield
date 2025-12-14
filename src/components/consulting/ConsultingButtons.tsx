import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Shield, UserCog, Loader2, CheckCircle, Clock } from "lucide-react";

interface ConsultingAccess {
  diagnostic_paid: boolean;
  advisory_requested: boolean;
  advisory_approved: boolean;
  subscription_status: string | null;
}

export function ConsultingButtons() {
  const [loading, setLoading] = useState<"diagnostic" | "advisory" | null>(null);
  const [access, setAccess] = useState<ConsultingAccess | null>(null);
  const [user, setUser] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    checkAccess();
  }, []);

  async function checkAccess() {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);

    if (!user) return;

    const { data } = await supabase
      .from("consulting_access")
      .select("diagnostic_paid, advisory_requested, advisory_approved, subscription_status")
      .eq("user_id", user.id)
      .single();

    if (data) {
      setAccess(data);
    }
  }

  async function handleDiagnosticCheckout() {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to start the diagnostic",
        variant: "destructive",
      });
      return;
    }

    setLoading("diagnostic");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke("create-diagnostic-checkout-session", {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.url) {
        window.location.href = response.data.url;
      }
    } catch (error: any) {
      console.error("Checkout error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to start checkout",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  }

  async function handleAdvisoryCheckout() {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to request advisory engagement",
        variant: "destructive",
      });
      return;
    }

    setLoading("advisory");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke("create-advisory-checkout-session", {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.url) {
        window.location.href = response.data.url;
      }
    } catch (error: any) {
      console.error("Checkout error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to start checkout",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  }

  const diagnosticPaid = access?.diagnostic_paid;
  const hasActiveSubscription = access?.subscription_status === "active";
  const advisoryApproved = access?.advisory_approved;
  const advisoryPending = hasActiveSubscription && !advisoryApproved;

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      {/* Diagnostic Button */}
      <div className="flex flex-col gap-2">
        {diagnosticPaid ? (
          <Button
            variant="outline"
            className="border-khepra-gold text-khepra-gold hover:bg-khepra-gold/10"
            disabled
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Diagnostic Unlocked
          </Button>
        ) : (
          <Button
            onClick={handleDiagnosticCheckout}
            disabled={loading !== null}
            className="bg-quantum-cyan text-giza-void hover:bg-quantum-cyan/90 font-semibold"
          >
            {loading === "diagnostic" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Shield className="mr-2 h-4 w-4" />
            )}
            Start Diagnostic
          </Button>
        )}
        <p className="text-xs text-muted-foreground text-center">
          Enterprise Risk & Readiness Diagnostic
        </p>
      </div>

      {/* Advisory Button */}
      <div className="flex flex-col gap-2">
        {advisoryPending ? (
          <Button
            variant="outline"
            className="border-khepra-gold/50 text-khepra-gold/70"
            disabled
          >
            <Clock className="mr-2 h-4 w-4" />
            Pending Approval
          </Button>
        ) : advisoryApproved && hasActiveSubscription ? (
          <Button
            variant="outline"
            className="border-khepra-gold text-khepra-gold hover:bg-khepra-gold/10"
            disabled
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Advisory Active
          </Button>
        ) : (
          <Button
            onClick={handleAdvisoryCheckout}
            disabled={loading !== null}
            variant="outline"
            className="border-quantum-cyan text-quantum-cyan hover:bg-quantum-cyan/10 font-semibold"
          >
            {loading === "advisory" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UserCog className="mr-2 h-4 w-4" />
            )}
            Request Advisory Engagement
          </Button>
        )}
        <p className="text-xs text-muted-foreground text-center">
          Embedded Strategic Advisor (Shadow CISO)
        </p>
      </div>
    </div>
  );
}
