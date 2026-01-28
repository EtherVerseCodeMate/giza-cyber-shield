import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ExperienceSelector from './ExperienceSelector';
import StackDiscoveryWizard from './StackDiscoveryWizard';
import { useToast } from '@/hooks/use-toast';

const OnboardingOrchestrator: React.FC = () => {
  const [currentFlow, setCurrentFlow] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleExperienceSelected = (experience: string) => {
    switch (experience) {
      case 'enterprise-setup':
        setCurrentFlow('stack-discovery');
        break;
      case 'quick-tour':
        toast({
          title: "Quick Tour Started",
          description: "Welcome to the interactive demo environment",
        });
        navigate('/demo-tour');
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

  const handleOnboardingComplete = () => {
    toast({
      title: "Setup Complete!",
      description: "Your AI-powered stack discovery is now active",
      variant: "default"
    });
    navigate('/dashboard');
  };

  if (currentFlow === 'stack-discovery') {
    return <StackDiscoveryWizard onComplete={handleOnboardingComplete} />;
  }

  return <ExperienceSelector onExperienceSelected={handleExperienceSelected} />;
};

export default OnboardingOrchestrator;