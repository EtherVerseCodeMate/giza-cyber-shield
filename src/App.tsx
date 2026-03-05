import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { OrganizationProvider } from "@/components/OrganizationProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import SecurityHeaders from "@/components/security/SecurityHeaders";
import NLChatPanel from "@/components/NLChatPanel";

// Core MVP Pages
import NewHomepage from "./views/NewHomepage";
import BlogList from "./views/Blog";
import Episode1 from "./views/blog/Episode1";
import Episode2 from "./views/blog/Episode2";
import Episode3 from "./views/blog/Episode3";
import Episode4 from "./views/blog/Episode4";
import BuildingCyberImmunity from "./views/blog/BuildingCyberImmunity";
import LaunchingVDP from "./views/blog/LaunchingVDP";
import VDP from "./views/VDP";
import HallOfFame from "./views/HallOfFame";
import Auth from "./views/Auth";
import AuthCallback from "./views/AuthCallback";
import ResetPassword from "./views/ResetPassword";
import Onboarding from "./views/Onboarding";
import STIGDashboard from "./views/STIGDashboard";
import AssetScanning from "./views/AssetScanning";
import ComplianceReports from "./views/ComplianceReports";
import EvidenceCollectionMVP from "./views/EvidenceCollectionMVP";
import SimpleBilling from "./views/SimpleBilling";
import DoD from "./views/DoD";
import MasterAdmin from "./views/MasterAdmin";
import ClientPortal from "./views/ClientPortal";
import UltimateDashboard from "./views/UltimateDashboard";
import CommandCenter from "./views/CommandCenter";
import LegalPage from "./views/LegalPage";
import ThreatHuntingDashboard from "./views/ThreatHuntingDashboard";
import IntegrationsPage from "./views/IntegrationsPage";
import NotFound from "./views/NotFound";
import { Navigate } from "react-router-dom";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SecurityHeaders>
            <TooltipProvider>
              <OrganizationProvider>
                <Toaster />
                <Sonner />
                <Routes>
                  {/* Public Routes */}
                  <Route path="/" element={<NewHomepage />} />
                  <Route path="/blog" element={<BlogList />} />
                  <Route path="/blog/episode-1-blood-moon-philosopher-api" element={<Episode1 />} />
                  <Route path="/blog/episode-2-autonomous-ai-deepfakes-leadership" element={<Episode2 />} />
                  <Route path="/blog/episode-3-founder-inception-story" element={<Episode3 />} />
                  <Route path="/blog/episode-4-rising-through-ranks" element={<Episode4 />} />
                  <Route path="/blog/building-cyber-immunity-cmmc-stig-database" element={<BuildingCyberImmunity />} />
                  <Route path="/blog/launching-vdp" element={<LaunchingVDP />} />
                  <Route path="/vdp" element={<VDP />} />
                  <Route path="/hall-of-fame" element={<HallOfFame />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/auth/callback" element={<AuthCallback />} />
                  <Route path="/auth/reset-password" element={<ResetPassword />} />
                  <Route path="/onboarding" element={<Onboarding />} />

                  {/* STIG-First MVP Routes */}
                  <Route path="/stig-dashboard" element={<ProtectedRoute><STIGDashboard /></ProtectedRoute>} />
                  <Route path="/dashboard" element={<ProtectedRoute><STIGDashboard /></ProtectedRoute>} />
                  <Route path="/asset-scanning" element={<ProtectedRoute><AssetScanning /></ProtectedRoute>} />
                  <Route path="/compliance-reports" element={<ProtectedRoute><ComplianceReports /></ProtectedRoute>} />
                  <Route path="/evidence-collection" element={<ProtectedRoute><EvidenceCollectionMVP /></ProtectedRoute>} />
                  <Route path="/billing" element={<ProtectedRoute><SimpleBilling /></ProtectedRoute>} />
                  <Route path="/ultimate" element={<ProtectedRoute><UltimateDashboard /></ProtectedRoute>} />
                  <Route path="/command-center" element={<ProtectedRoute><CommandCenter /></ProtectedRoute>} />

                  {/* DoD STIG-Codex Center */}
                  <Route path="/dod" element={<ProtectedRoute><DoD /></ProtectedRoute>} />

                  {/* Admin Routes */}
                  <Route path="/admin" element={<ProtectedRoute><MasterAdmin /></ProtectedRoute>} />

                  {/* Legal Pages */}
                  <Route path="/legal" element={<LegalPage />} />
                  <Route path="/privacy" element={<LegalPage />} />
                  <Route path="/terms" element={<LegalPage />} />

                  {/* Threat Hunting */}
                  <Route path="/threat-hunting" element={<ProtectedRoute><ThreatHuntingDashboard /></ProtectedRoute>} />

                  {/* Integrations */}
                  <Route path="/integrations" element={<ProtectedRoute><IntegrationsPage /></ProtectedRoute>} />

                  {/* Khepra Client Portal */}
                  <Route path="/clients/:org_id/overview" element={<ProtectedRoute><ClientPortal /></ProtectedRoute>} />
                  <Route path="/clients/:org_id" element={<ProtectedRoute><ClientPortal /></ProtectedRoute>} />

                  {/* Settings stub — prevents broken nav link */}
                  <Route path="/settings" element={<ProtectedRoute><Navigate to="/dashboard" replace /></ProtectedRoute>} />

                  {/* Catch-all */}
                  <Route path="*" element={<NotFound />} />
                </Routes>

                {/* NLChatPanel needs to be inside BrowserRouter for any future router usage */}
                <NLChatPanel />
              </OrganizationProvider>
            </TooltipProvider>
          </SecurityHeaders>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
};

export default App;
