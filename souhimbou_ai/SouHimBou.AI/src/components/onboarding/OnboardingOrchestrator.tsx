import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ExperienceSelector from './ExperienceSelector';
import StackDiscoveryWizard from './StackDiscoveryWizard';
import { useToast } from '@/hooks/use-toast';
import TermsAcceptance from '../legal/TermsAcceptance';
import { useUserAgreements } from '@/hooks/useUserAgreements';

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

  return (
    <div className="min-h-screen bg-background">
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