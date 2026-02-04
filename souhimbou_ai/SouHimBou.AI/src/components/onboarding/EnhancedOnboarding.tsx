import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  Play,
  ArrowRight,
  Users,
  Building,
  Shield,
  Settings,
  Eye,
  Zap,
  Sparkles,
  MessageSquare,
  Activity,
  Brain
} from 'lucide-react';
import { useUserProfile } from '@/hooks/useUserProfile';
import { RoleBasedTour } from './RoleBasedTour';
import { NativeOnboarding } from './NativeOnboarding';
import { PapyrusOnboarding } from './PapyrusOnboarding';

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
      <DialogContent className="max-w-3xl overflow-hidden p-0 rounded-3xl border-purple-500/20 shadow-2xl">
        <div className="flex flex-col md:flex-row h-full max-h-[90vh]">
          {/* Left Hero Panel */}
          <div className="w-full md:w-80 bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 p-8 text-white flex flex-col justify-between relative overflow-hidden">
            {/* Decorative Background */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 blur-[100px] rounded-full -mr-32 -mt-32" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 blur-[100px] rounded-full -ml-32 -mb-32" />

            <div className="relative z-10 space-y-6">
              <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl w-fit">
                <Sparkles className="h-8 w-8 text-purple-300" />
              </div>
              <div>
                <h2 className="text-3xl font-bold leading-tight">Begin Your Sovereign Journey</h2>
                <p className="text-purple-200/70 mt-2 text-sm leading-relaxed">
                  You are entering the Trust Constellation. Every path is secured by the KHEPRA Protocol.
                </p>
              </div>
            </div>

            <div className="relative z-10 p-4 bg-black/20 backdrop-blur-sm rounded-2xl border border-white/5 space-y-2">
              <div className="flex items-center space-x-2 text-xs font-semibold text-purple-300 uppercase tracking-widest">
                <Activity className="h-3 w-3" />
                <span>Attestation Active</span>
              </div>
              <div className="text-[10px] text-white/60 leading-tight">
                Your role as <span className="text-white font-bold">{userRole.title}</span> has been verified across the lattice.
              </div>
            </div>
          </div>

          {/* Right Content Panel */}
          <div className="flex-1 p-8 bg-background overflow-y-auto">
            <h3 className="text-xl font-bold mb-6 flex items-center space-x-2">
              <span>Select Activation Path</span>
              <div className="h-1 flex-1 bg-gradient-to-r from-purple-500/20 to-transparent ml-4 rounded-full" />
            </h3>

            <div className="grid gap-4">
              {/* FEATURED: Papyrus AI Guided Setup */}
              <Card
                onClick={startPapyrusOnboarding}
                className="group relative cursor-pointer overflow-hidden border-2 border-purple-500/30 bg-purple-500/5 hover:border-purple-500/60 transition-all duration-300 shadow-[0_0_20px_rgba(168,85,247,0.1)]"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-purple-500" />
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className="p-4 bg-purple-500 rounded-2xl text-white shadow-lg shadow-purple-500/30 group-hover:scale-110 transition-transform duration-300">
                      <Brain className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="text-lg font-bold text-foreground">AI Guided Activation</h4>
                        <Badge variant="secondary" className="bg-purple-500/10 text-purple-600 border-purple-500/20 text-[10px] uppercase tracking-tighter">Recommended</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Let <span className="text-purple-600 font-semibold">Papyrus</span>, your cyber-guide, walk you through a seamless, conversational setup of your security perimeter.
                      </p>
                      <div className="flex items-center space-x-4 mt-4 text-[10px] text-purple-600 font-bold uppercase tracking-widest">
                        <div className="flex items-center space-x-1">
                          <MessageSquare className="h-3 w-3" />
                          <span>Conversational</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Zap className="h-3 w-3" />
                          <span>Fast</span>
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-purple-500 opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1" />
                  </div>
                </CardContent>
              </Card>

              {/* Standard Setup */}
              <Card
                onClick={startNativeOnboarding}
                className="group cursor-pointer border border-border hover:border-blue-500/50 hover:bg-blue-500/5 transition-all duration-200"
              >
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-600 dark:text-slate-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900 group-hover:text-blue-600 transition-colors">
                      <Shield className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-lg font-bold">Standard Configuration</h4>
                      <p className="text-sm text-muted-foreground">
                        Traditional multi-step configuration for advanced users who want granular control over every parameter.
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </CardContent>
              </Card>

              {/* Guided Tour */}
              <Card
                onClick={() => {
                  startGuidedTour();
                  navigate('/dashboard?tour=quick');
                }}
                className="group cursor-pointer border border-border hover:border-slate-500/50 hover:bg-slate-500/5 transition-all duration-200"
              >
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-600 dark:text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors">
                      <Play className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-lg font-bold">Platform Tour</h4>
                      <p className="text-sm text-muted-foreground">
                        Just show me around. Take a personalized, non-destructive tour of the dashboard based on your role.
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </CardContent>
              </Card>

              <div className="flex items-center justify-between pt-4 border-t border-border mt-2">
                <button onClick={onComplete} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Skip onboarding and explore manually
                </button>
                <div className="text-[10px] text-slate-400 font-mono">
                  SID: {profile?.id?.slice(0, 8)} | LAT: 0.0.0
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
