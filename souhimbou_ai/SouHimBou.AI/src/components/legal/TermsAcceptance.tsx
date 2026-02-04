import { useState, useCallback, useEffect } from 'react';
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

  const acceptedCount = Object.values(acceptedTerms).filter(Boolean).length;
  const allTermsAccepted = acceptedCount === termsData.length;

  const handleTermChange = (term: keyof typeof acceptedTerms, checked: boolean) => {
    setAcceptedTerms(prev => ({ ...prev, [term]: checked }));
  };

  const handleSubmit = useCallback(async (terms?: typeof acceptedTerms) => {
    const termsToSubmit = terms || acceptedTerms;
    const count = Object.values(termsToSubmit).filter(Boolean).length;

    if (count < termsData.length) {
      toast({
        title: "Incomplete Acceptance",
        description: "Please accept all terms and conditions to continue.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await acceptAllAgreements(termsToSubmit);
      if (success) {
        onAccepted();
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Error submitting agreements:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [acceptedTerms, acceptAllAgreements, onAccepted, onOpenChange, toast, termsData.length]);

  const handleAcceptAll = () => {
    const allChecked = {
      tosAgree: true,
      privacyAgree: true,
      saasAgree: true,
      betaAgree: true,
      dodCompliance: true,
      liabilityWaiver: true,
      exportControl: true
    };
    setAcceptedTerms(allChecked);
  };

  // Enter key submits when all terms are accepted
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && open && allTermsAccepted && !isSubmitting) {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, allTermsAccepted, isSubmitting, handleSubmit]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-slate-950 border-purple-500/30 text-slate-100">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            <Scale className="h-6 w-6 text-purple-500" />
            <span>Legal Agreement Acceptance</span>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] pr-4 mt-4">
          <div className="space-y-6">
            {/* Header Warning */}
            <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-purple-400 mt-0.5" />
              <div>
                <h3 className="font-bold text-purple-300">Required Legal Compliance</h3>
                <p className="text-sm text-slate-400">
                  Access to the Sovereign Platform requires explicit acceptance of all data protection and security mandates.
                </p>
              </div>
            </div>

            {/* Terms Grid */}
            <div className="grid gap-4">
              {termsData.map((term) => {
                const Icon = term.icon;
                const isAccepted = acceptedTerms[term.key];

                return (
                  <div
                    key={term.key}
                    onClick={() => handleTermChange(term.key, !isAccepted)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer group ${isAccepted
                        ? 'bg-purple-500/10 border-purple-500/50'
                        : 'bg-slate-900/50 border-slate-800 hover:border-purple-500/30'
                      }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4">
                        <div className={`p-2 rounded-xl ${isAccepted ? 'bg-purple-500 text-white' : 'bg-slate-800 text-slate-400 group-hover:bg-purple-500/20 group-hover:text-purple-400'}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 className="font-bold text-sm">{term.title}</h4>
                            <Badge variant="outline" className="text-[10px] uppercase tracking-tighter border-purple-500/30 text-purple-400">
                              {term.type}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed italic">"{term.description}"</p>
                        </div>
                      </div>
                      <Checkbox
                        checked={isAccepted}
                        onCheckedChange={(checked) => handleTermChange(term.key, checked as boolean)}
                        className="mt-1 border-purple-500/50 data-[state=checked]:bg-purple-500"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary Area */}
            <div className="p-6 bg-gradient-to-br from-purple-900/20 to-slate-900 border border-purple-500/20 rounded-3xl text-center space-y-4">
              <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-slate-950/50 border border-purple-500/30 text-purple-400 text-xs font-bold uppercase tracking-widest">
                Compliance Status: {acceptedCount}/{termsData.length} Accepted
              </div>
              <p className="text-sm text-slate-300">
                By proceeding, you verify that you have read, understood, and now weave your professional signature into these defense protocols.
              </p>
            </div>
          </div>
        </ScrollArea>

        {/* Improved Actions Layout */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-purple-500/10">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-white hover:bg-slate-800"
          >
            Cancel
          </Button>

          <div className="flex items-center space-x-3">
            {!allTermsAccepted && (
              <Button
                variant="outline"
                onClick={handleAcceptAll}
                disabled={isSubmitting}
                className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
              >
                Accept All Terms
              </Button>
            )}

            <Button
              onClick={() => handleSubmit()}
              disabled={!allTermsAccepted || isSubmitting}
              className={`min-w-[160px] rounded-xl font-bold transition-all shadow-lg ${allTermsAccepted
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:scale-105 hover:shadow-purple-500/25'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
            >
              {isSubmitting ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Processing...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <span>Accept & Continue</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

  );
};

export default TermsAcceptance;