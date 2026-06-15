
import { ConsoleLayout } from '@/components/console/ConsoleLayout';
import { CMMCDashboard } from '@/components/compliance/CMMCDashboard';
import { CMMCSTIGBridge } from '@/components/compliance/CMMCSTIGBridge';
import { AgenticComplianceArchitect } from '@/components/compliance/AgenticComplianceArchitect';
import { AgenticComplianceOrchestrator } from '@/components/compliance/AgenticComplianceOrchestrator';
import { ComplianceAuditReport } from '@/components/compliance/ComplianceAuditReport';
import { ComplianceControlMapper } from '@/components/compliance/ComplianceControlMapper';
import { DashboardToggle } from '@/components/DashboardToggle';
import { useOrganizationContext } from '@/components/OrganizationProvider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// ── License tier helpers ──────────────────────────────────────────────────────
type LicenseTier = 'community' | 'certify' | 'pilot' | 'enterprise' | 'master';

function tierRank(tier: LicenseTier): number {
  const ranks: Record<LicenseTier, number> = {
    community: 0, certify: 1, pilot: 2, enterprise: 3, master: 4,
  };
  return ranks[tier] ?? 0;
}

// ── Upgrade Gate component ────────────────────────────────────────────────────
function UpgradeGate({
  feature,
  requiredTier,
  currentTier,
  children,
}: {
  feature: string;
  requiredTier: LicenseTier;
  currentTier: LicenseTier;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  if (tierRank(currentTier) >= tierRank(requiredTier)) {
    return <>{children}</>;
  }
  const tierLabels: Record<LicenseTier, string> = {
    community: 'Community', certify: 'Certify', pilot: 'Autopilot ($499/mo)',
    enterprise: 'Enterprise ($2,999/mo)', master: 'Master (Custom)',
  };
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-6 text-center p-8">
      <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#c9a227" strokeWidth="1.5">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      </div>
      <div>
        <h3 className="text-xl font-semibold text-white mb-2">{feature} requires {tierLabels[requiredTier]}</h3>
        <p className="text-sm text-slate-400 max-w-md">
          You're currently on the <strong className="text-white">{tierLabels[currentTier]}</strong> tier.
          Upgrade to unlock continuous compliance monitoring, agentic remediation, and ML-DSA-65 signed evidence packages.
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => navigate('/billing')}
          className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg transition-colors text-sm"
        >
          Upgrade Now — {tierLabels[requiredTier]}
        </button>
        <button
          onClick={() => navigate('/billing')}
          className="px-6 py-2.5 border border-slate-600 hover:border-slate-400 text-slate-300 font-semibold rounded-lg transition-colors text-sm"
        >
          View Pricing
        </button>
      </div>
    </div>
  );
}

// ── No Organization Prompt ───────────────────────────────────────────────────
function NoOrganizationPrompt() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-6 text-center p-8">
      <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3b8beb" strokeWidth="1.5">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      </div>
      <div>
        <h3 className="text-xl font-semibold text-white mb-2">No Organization Selected</h3>
        <p className="text-sm text-slate-400 max-w-md">
          Set up your organization to begin CMMC compliance scanning. The SEKHEM Gateway will assess your environment
          and generate ML-DSA-65 signed evidence packages ready for C3PAO intake.
        </p>
      </div>
      <button
        onClick={() => navigate('/onboarding')}
        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors text-sm"
      >
        Set Up Organization
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const ComplianceAutopilot = () => {
  const { currentOrganization } = useOrganizationContext();
  const [licenseTier, setLicenseTier] = useState<LicenseTier>('community');

  // Load license tier from user_profiles table
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from('user_profiles')
        .select('license_tier')
        .eq('user_id', session.user.id)
        .single();
      if (data?.license_tier) setLicenseTier(data.license_tier as LicenseTier);
    })();
  }, []);

  const tabs = [
    { id: 'stig-dashboard', title: 'STIG Dashboard', path: '/stig-dashboard' },
    { id: 'compliance-autopilot', title: 'Compliance Autopilot', path: '/compliance-autopilot', isActive: true },
    { id: 'compliance-reports', title: 'Reports', path: '/compliance-reports' },
    { id: 'evidence-collection', title: 'Evidence', path: '/evidence-collection' },
    { id: 'billing', title: 'Billing', path: '/billing' },
  ];

  return (
    <ConsoleLayout
      currentSection="compliance-autopilot"
      browserNav={{
        title: 'CMMC Compliance Autopilot',
        subtitle: 'Automated CMMC-to-STIG bridge with evidence collection',
        tabs,
        showAddTab: false,
        rightContent: <DashboardToggle />,
      }}
    >
      {!currentOrganization ? (
        <NoOrganizationPrompt />
      ) : (
        <Tabs defaultValue="cmmc-dashboard" className="space-y-4">
          <TabsList className="flex flex-wrap gap-1">
            <TabsTrigger value="cmmc-dashboard">CMMC Dashboard</TabsTrigger>
            <TabsTrigger value="stig-bridge">STIG Bridge</TabsTrigger>
            <TabsTrigger value="architect">
              Agentic Architect
              {tierRank(licenseTier) < tierRank('pilot') && (
                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-amber-500/15 text-amber-400 rounded font-mono">
                  PILOT+
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="orchestrator">
              Orchestrator
              {tierRank(licenseTier) < tierRank('pilot') && (
                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-amber-500/15 text-amber-400 rounded font-mono">
                  PILOT+
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="control-mapper">Control Mapper</TabsTrigger>
            <TabsTrigger value="audit-report">
              Audit Report
              {tierRank(licenseTier) < tierRank('pilot') && (
                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-amber-500/15 text-amber-400 rounded font-mono">
                  PILOT+
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Tab 1: CMMC Dashboard (Community) ─────────────────────────── */}
          <TabsContent value="cmmc-dashboard">
            <CMMCDashboard organizationId={currentOrganization.id} />
          </TabsContent>

          {/* ── Tab 2: STIG Bridge (Community) ────────────────────────────── */}
          <TabsContent value="stig-bridge">
            <CMMCSTIGBridge organizationId={currentOrganization.id} />
          </TabsContent>

          {/* ── Tab 3: Agentic Architect (Pilot+) ─────────────────────────── */}
          <TabsContent value="architect">
            <UpgradeGate feature="Agentic Compliance Architect" requiredTier="pilot" currentTier={licenseTier}>
              <AgenticComplianceArchitect organizationId={currentOrganization.id} />
            </UpgradeGate>
          </TabsContent>

          {/* ── Tab 4: Orchestrator (Pilot+) ──────────────────────────────── */}
          <TabsContent value="orchestrator">
            <UpgradeGate feature="Compliance Orchestrator" requiredTier="pilot" currentTier={licenseTier}>
              <AgenticComplianceOrchestrator organizationId={currentOrganization.id} />
            </UpgradeGate>
          </TabsContent>

          {/* ── Tab 5: Control Mapper (Community) ─────────────────────────── */}
          <TabsContent value="control-mapper">
            <ComplianceControlMapper organizationId={currentOrganization.id} />
          </TabsContent>

          {/* ── Tab 6: Audit Report (Pilot+) ──────────────────────────────── */}
          <TabsContent value="audit-report">
            <UpgradeGate feature="Audit Report Export" requiredTier="pilot" currentTier={licenseTier}>
              <ComplianceAuditReport organizationId={currentOrganization.id} />
            </UpgradeGate>
          </TabsContent>
        </Tabs>
      )}
    </ConsoleLayout>
  );
};

export default ComplianceAutopilot;