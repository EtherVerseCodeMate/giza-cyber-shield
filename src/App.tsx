import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { OrganizationProvider } from "@/components/OrganizationProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import SecurityHeaders from "@/components/security/SecurityHeaders";

// Core MVP Pages
import NewHomepage from "./pages/NewHomepage";
import BlogList from "./pages/Blog";
import Episode1 from "./pages/blog/Episode1";
import Episode2 from "./pages/blog/Episode2";
import Episode3 from "./pages/blog/Episode3";
import Episode4 from "./pages/blog/Episode4";
import BuildingCyberImmunity from "./pages/blog/BuildingCyberImmunity";
import LaunchingVDP from "./pages/blog/LaunchingVDP";
import VDP from "./pages/VDP";
import HallOfFame from "./pages/HallOfFame";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import Onboarding from "./pages/Onboarding";
import STIGDashboard from "./pages/STIGDashboard";
import AssetScanning from "./pages/AssetScanning";
import ComplianceReports from "./pages/ComplianceReports";
import EvidenceCollectionMVP from "./pages/EvidenceCollectionMVP";
import SimpleBilling from "./pages/SimpleBilling";
import DoD from "./pages/DoD";
import MasterAdmin from "./pages/MasterAdmin";
import ClientPortal from "./pages/ClientPortal";
import NotFound from "./pages/NotFound";

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
                  <Route path="/onboarding" element={<Onboarding />} />
                  
                  {/* STIG-First MVP Routes */}
                  <Route path="/stig-dashboard" element={<ProtectedRoute><STIGDashboard /></ProtectedRoute>} />
                  <Route path="/dashboard" element={<ProtectedRoute><STIGDashboard /></ProtectedRoute>} />
                  <Route path="/asset-scanning" element={<ProtectedRoute><AssetScanning /></ProtectedRoute>} />
                  <Route path="/compliance-reports" element={<ProtectedRoute><ComplianceReports /></ProtectedRoute>} />
                  <Route path="/evidence-collection" element={<ProtectedRoute><EvidenceCollectionMVP /></ProtectedRoute>} />
                  <Route path="/billing" element={<ProtectedRoute><SimpleBilling /></ProtectedRoute>} />
                  
                  {/* DoD STIG-Codex Center */}
                  <Route path="/dod" element={<ProtectedRoute><DoD /></ProtectedRoute>} />
                  
                  {/* Admin Routes */}
                  <Route path="/admin" element={<ProtectedRoute><MasterAdmin /></ProtectedRoute>} />

                  {/* Khepra Client Portal */}
                  <Route path="/clients/:org_id/overview" element={<ProtectedRoute><ClientPortal /></ProtectedRoute>} />
                  <Route path="/clients/:org_id" element={<ProtectedRoute><ClientPortal /></ProtectedRoute>} />

                  {/* Catch-all */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </OrganizationProvider>
            </TooltipProvider>
          </SecurityHeaders>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
};

export default App;
