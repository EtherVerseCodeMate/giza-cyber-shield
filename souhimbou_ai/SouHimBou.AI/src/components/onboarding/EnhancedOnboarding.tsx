import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Shield,
  Settings,
  Eye,
  Sparkles,
  Activity,
  Building,
  Users
} from 'lucide-react';
import { useUserProfile } from '@/hooks/useUserProfile';
import { RoleBasedTour } from './RoleBasedTour';
import { NativeOnboarding } from './NativeOnboarding';
import { PapyrusOnboarding } from './PapyrusOnboarding';
import { AdinkraSymbolDisplay } from '../khepra/AdinkraSymbolDisplay';

interface EnhancedOnboardingProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export const EnhancedOnboarding = ({ open, onClose, onComplete }: EnhancedOnboardingProps) => {
  const navigate = useNavigate();
  const { profile } = useUserProfile();
  const [showRoleBasedTour, setShowRoleBasedTour] = useState(false);
  const [showNativeOnboarding, setShowNativeOnboarding] = useState(false);
  const [showPapyrusOnboarding, setShowPapyrusOnboarding] = useState(false);

  const getUserRole = () => {
    const role = profile?.role || 'viewer';
    switch (role) {
      case 'admin': return { title: 'Administrator', icon: Settings, color: 'bg-red-500' };
      case 'executive': return { title: 'Executive', icon: Building, color: 'bg-purple-500' };
      case 'security_engineer': return { title: 'Security Engineer', icon: Shield, color: 'bg-blue-500' };
      case 'analyst': return { title: 'Security Analyst', icon: Eye, color: 'bg-green-500' };
      default: return { title: 'Team Member', icon: Users, color: 'bg-gray-500' };
    }
  };

  const startGuidedTour = () => {
    setShowRoleBasedTour(true);
  };

  const startNativeOnboarding = () => {
    setShowNativeOnboarding(true);
  };

  const startPapyrusOnboarding = () => {
    setShowPapyrusOnboarding(true);
  };

  const handleTourComplete = () => {
    setShowRoleBasedTour(false);
    onComplete();
  };

  const userRole = getUserRole();

  if (showRoleBasedTour) {
    return (
      <RoleBasedTour
        open={showRoleBasedTour}
        onClose={() => setShowRoleBasedTour(false)}
        onComplete={handleTourComplete}
      />
    );
  }

  if (showNativeOnboarding) {
    return (
      <NativeOnboarding
        open={showNativeOnboarding}
        onClose={() => setShowNativeOnboarding(false)}
        onComplete={onComplete}
      />
    );
  }

  if (showPapyrusOnboarding) {
    return (
      <PapyrusOnboarding
        open={showPapyrusOnboarding}
        onClose={() => setShowPapyrusOnboarding(false)}
        onComplete={onComplete}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl overflow-hidden p-0 rounded-[2rem] border-purple-500/20 shadow-2xl bg-slate-950">
        <div className="relative">
          {/* Hero Background with Glassmorphism */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/40 via-purple-900/40 to-slate-900/40 z-0" />
          <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/10 blur-[120px] rounded-full -mr-40 -mt-40 animate-pulse" />

          <div className="relative z-10 p-10 flex flex-col items-center text-center space-y-8">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="p-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl"
            >
              <AdinkraSymbolDisplay
                symbolName="Sankofa"
                size="large"
                showMatrix={true}
                className="w-20 h-20"
              />
            </motion.div>

            <div className="space-y-3">
              <h2 className="text-4xl font-bold tracking-tight text-white">
                Sovereign Cyber Defense
              </h2>
              <p className="text-purple-200/60 max-w-md mx-auto leading-relaxed">
                Welcome to SouHimBou.AI. Your account as <span className="text-white font-semibold">{userRole.title}</span> is ready for activation in the Trust Constellation.
              </p>
            </div>

            <div className="w-full max-w-sm space-y-4">
              <Button
                onClick={startPapyrusOnboarding}
                className="w-full h-16 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-lg font-bold shadow-[0_0_30px_rgba(168,85,247,0.4)] border-none group transition-all"
              >
                <div className="flex items-center justify-center space-x-3 text-white">
                  <Sparkles className="h-6 w-6 group-hover:animate-ping transition-all" />
                  <span>Initialize Platform</span>
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Button>

              <div className="flex justify-center space-x-6 text-xs text-purple-300/50">
                <button
                  onClick={startNativeOnboarding}
                  className="hover:text-purple-200 transition-colors underline underline-offset-4"
                >
                  Standard Setup
                </button>
                <span>|</span>
                <button
                  onClick={() => {
                    startGuidedTour();
                    navigate('/dashboard?tour=quick');
                  }}
                  className="hover:text-purple-200 transition-colors underline underline-offset-4"
                >
                  Role Tour
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-white/5 w-full flex items-center justify-between text-[10px] text-slate-500 font-mono">
              <div className="flex items-center space-x-2">
                <Activity className="h-3 w-3" />
                <span>LAT: 0.0000 | LON: 0.0000</span>
              </div>
              <button onClick={onComplete} className="hover:text-slate-400 transition-colors">
                SKIP TO DASHBOARD →
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
