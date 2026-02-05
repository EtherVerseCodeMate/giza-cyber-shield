import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Shield, FileText, Scale, Users, Globe } from 'lucide-react';
import { useUserAgreements } from '@/hooks/useUserAgreements';
import { useToast } from '@/hooks/use-toast';

interface TermsAcceptanceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccepted: () => void;
}

export const TermsAcceptance: React.FC<TermsAcceptanceProps> = ({
  open,
  onOpenChange,
  onAccepted
}) => {
  const { acceptAllAgreements } = useUserAgreements();
  const { toast } = useToast();
  const [acceptedTerms, setAcceptedTerms] = useState({
    tosAgree: false,
    privacyAgree: false,
    saasAgree: false,
    betaAgree: false,
    dodCompliance: false,
    liabilityWaiver: false,
    exportControl: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const allTermsAccepted = Object.values(acceptedTerms).every(Boolean);

  const handleTermChange = (term: keyof typeof acceptedTerms, checked: boolean) => {
    setAcceptedTerms(prev => ({ ...prev, [term]: checked }));
  };

  const handleAcceptAll = () => {
    setAcceptedTerms({
      tosAgree: true,
      privacyAgree: true,
      saasAgree: true,
      betaAgree: true,
      dodCompliance: true,
      liabilityWaiver: true,
      exportControl: true
    });
  };

  const handleSubmit = async () => {
    if (!allTermsAccepted) {
      toast({
        title: "Incomplete Acceptance",
        description: "Please accept all terms and conditions to continue.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await acceptAllAgreements(acceptedTerms);
      if (success) {
        onAccepted();
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Error submitting agreements:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const termsData = [
    {
      key: 'tosAgree' as keyof typeof acceptedTerms,
      title: 'Khepra Master License Agreement (v3.0)',
      icon: FileText,
      description: 'Commercial license grant, restrictions, and reservation of rights. Software is licensed, not sold.',
      classification: 'Required',
      type: 'Standard'
    },
    {
      key: 'privacyAgree' as keyof typeof acceptedTerms,
      title: 'Privacy Policy',
      icon: Shield,
      description: 'Data collection, processing, and protection practices. Telemetry beacon and license validation.',
      classification: 'Required',
      type: 'Privacy'
    },
    {
      key: 'saasAgree' as keyof typeof acceptedTerms,
      title: 'SaaS Terms & Authorized Use',
      icon: Globe,
      description: 'Cloud service delivery for Khepra-Edge, Khepra-Hybrid, and Khepra-Sovereign deployments.',
      classification: 'Required',
      type: 'Service'
    },
    {
      key: 'betaAgree' as keyof typeof acceptedTerms,
      title: 'Beta Testing Agreement',
      icon: Users,
      description: 'Pre-release software testing terms. Software provided "AS IS" with no warranty of quantum-proof perpetuity.',
      classification: 'Required',
      type: 'Beta'
    },
    {
      key: 'dodCompliance' as keyof typeof acceptedTerms,
      title: 'U.S. Government Rights (DFARS Compliance)',
      icon: Shield,
      description: 'Commercial Computer Software with RESTRICTED RIGHTS per DFARS 252.227-7014. No Unlimited Rights granted.',
      classification: 'Critical',
      type: 'Security'
    },
    {
      key: 'liabilityWaiver' as keyof typeof acceptedTerms,
      title: 'Confidentiality & Trade Secrets',
      icon: Scale,
      description: 'Acknowledgment of proprietary AdinKhepra-PQC Lattice structures and Symbolic Attestation Logic as Trade Secrets.',
      classification: 'Required',
      type: 'Legal'
    },
    {
      key: 'exportControl' as keyof typeof acceptedTerms,
      title: 'Export Control Compliance (ECCN 5D992)',
      icon: AlertTriangle,
      description: 'Subject to EAR. No export to nuclear/chemical/biological weapons countries or SDN List entities.',
      classification: 'Critical',
      type: 'Regulatory'
    }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-background">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Scale className="h-5 w-5 text-primary" />
            <span>Legal Agreement Acceptance</span>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6">
            {/* Header Warning */}
            <Card className="border-orange-500/30 bg-orange-500/10">
              <CardContent className="pt-6">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-orange-400 mb-1">
                      Required Legal Compliance
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Access to this platform requires acceptance of all legal agreements.
                      Please review each document carefully before proceeding.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Terms Grid */}
            <div className="grid gap-4">
              {termsData.map((term) => {
                const Icon = term.icon;
                const isAccepted = acceptedTerms[term.key];

                return (
                  <Card
                    key={term.key}
                    className={`transition-all duration-200 ${isAccepted
                      ? 'border-green-500/50 bg-green-500/10'
                      : 'border-border hover:border-primary/50'
                      }`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <Icon className={`h-5 w-5 mt-0.5 ${isAccepted ? 'text-green-500' : 'text-muted-foreground'
                            }`} />
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <CardTitle className="text-sm font-medium">
                                {term.title}
                              </CardTitle>
                              <Badge
                                variant={term.classification === 'Critical' ? 'destructive' : 'secondary'}
                                className="text-xs"
                              >
                                {term.classification}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {term.type}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {term.description}
                            </p>
                          </div>
                        </div>
                        <Checkbox
                          checked={isAccepted}
                          onCheckedChange={(checked) =>
                            handleTermChange(term.key, checked as boolean)
                          }
                          className="ml-4"
                        />
                      </div>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>

            {/* Summary */}
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-6">
                <div className="text-center space-y-3">
                  <h3 className="font-semibold text-primary">Agreement Summary</h3>
                  <p className="text-sm text-muted-foreground">
                    By accepting these terms, you acknowledge that you have read and agree to be bound by all applicable agreements.
                  </p>
                  <div className="flex justify-center space-x-2 text-xs text-muted-foreground">
                    <span>Status: {Object.values(acceptedTerms).filter(Boolean).length} of {termsData.length} accepted</span>
                  </div>
                  <p>By accepting, you acknowledge reading and understanding all legal documents.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>

        {/* Actions - Explicitly ensuring "Accept & Continue" visibility */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t mt-4">
          <Button
            variant="outline"
            onClick={handleAcceptAll}
            disabled={allTermsAccepted || isSubmitting}
            className="w-full sm:w-auto"
          >
            Accept All Terms
          </Button>

          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="flex-1 sm:flex-none"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!allTermsAccepted || isSubmitting}
              variant="cyber"
              className="flex-1 sm:min-w-[160px]"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span>Processing...</span>
                </div>
              ) : (
                'Accept & Continue'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TermsAcceptance;