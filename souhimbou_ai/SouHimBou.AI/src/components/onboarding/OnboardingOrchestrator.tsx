import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ExperienceSelector from './ExperienceSelector';
import StackDiscoveryWizard from './StackDiscoveryWizard';
import { useToast } from '@/hooks/use-toast';
import TermsAcceptance from '../legal/TermsAcceptance';
import { useUserAgreements } from '@/hooks/useUserAgreements';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const OnboardingOrchestrator = () => {
  const [currentFlow, setCurrentFlow] = useState<'selection' | 'stack-discovery'>('selection');
  const [pendingExperience, setPendingExperience] = useState<string | null>(null);
  const [showLegal, setShowLegal] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasAcceptedAll } = useUserAgreements();

  const processExperience = (experience: string) => {
    switch (experience) {
      case 'enterprise-setup':
        setCurrentFlow('stack-discovery');
        break;
      case 'quick-tour':
        toast({
          title: "Quick Tour Started",
          description: "Welcome to the interactive demo environment",
        });
        navigate('/dashboard?tour=true');
        break;
      case 'executive-summary':
        toast({
          title: "Executive Dashboard",
          description: "Redirecting to simplified executive view",
        });
        navigate('/dashboard?mode=executive');
        break;
      default:
        navigate('/dashboard');
    }
  };

  const handleExperienceSelected = (experience: string) => {
    // If it requires legal and not accepted, show legal modal first
    const requiresLegal = ['enterprise-setup', 'executive-summary'].includes(experience);

    if (requiresLegal && !hasAcceptedAll) {
      setPendingExperience(experience);
      setShowLegal(true);
      return;
    }

    processExperience(experience);
  };

  const handleOnboardingComplete = () => {
    toast({
      title: "Setup Complete!",
      description: "Your AI-powered stack discovery is now active",
      variant: "default"
    });
    navigate('/dashboard');
  };

  const handleLegalAccepted = () => {
    setShowLegal(false);
    if (pendingExperience) {
      processExperience(pendingExperience);
      setPendingExperience(null);
    }
  };

  const steps = [
    { id: 'selection', label: 'Choose Experience' },
    { id: 'stack-discovery', label: 'Configure Stack' },
  ];

  const getStepClassName = (stepId: string, index: number) => {
    if (currentFlow === stepId) {
      return 'bg-primary text-primary-foreground shadow-[0_0_15px_hsl(194,100%,50%,0.4)]';
    }
    const currentIndex = steps.findIndex(s => s.id === currentFlow);
    if (currentIndex > index) {
      return 'bg-primary/20 text-primary border border-primary/40';
    }
    return 'bg-muted text-muted-foreground border border-border';
  };

  const handleGoBack = () => {
    if (currentFlow === 'stack-discovery') {
      setCurrentFlow('selection');
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Bar & Progress */}
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border">
        <div className="container mx-auto px-6 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleGoBack}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {currentFlow === 'selection' ? 'Home' : 'Back'}
          </Button>

          {/* Step Progress Indicator */}
          <div className="flex items-center gap-3">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center gap-2">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300
                  ${getStepClassName(step.id, index)}
                `}>
                  {index + 1}
                </div>
                <span className={`hidden sm:inline text-sm ${currentFlow === step.id ? 'text-foreground font-medium' : 'text-muted-foreground'
                  }`}>
                  {step.label}
                </span>
                {index < steps.length - 1 && (
                  <div className="w-8 h-px bg-border mx-1" />
                )}
              </div>
            ))}
          </div>

          {/* Spacer for visual balance */}
          <div className="w-20" />
        </div>
      </div>

      {currentFlow === 'selection' ? (
        <ExperienceSelector onExperienceSelected={handleExperienceSelected} />
      ) : (
        <StackDiscoveryWizard onComplete={handleOnboardingComplete} />
      )}

      <TermsAcceptance
        open={showLegal}
        onOpenChange={setShowLegal}
        onAccepted={handleLegalAccepted}
      />
    </div>
  );
};

export default OnboardingOrchestrator;