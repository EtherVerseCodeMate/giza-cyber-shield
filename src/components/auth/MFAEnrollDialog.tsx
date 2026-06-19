'use client';

/**
 * MFAEnrollDialog — TOTP enrollment flow.
 *
 * Step 1: supabase.auth.mfa.enroll({ factorType: 'totp' })
 *         → returns QR code SVG + TOTP secret URI
 * Step 2: User scans QR in authenticator app (Google Authenticator, Authy, 1Password, etc.)
 * Step 3: supabase.auth.mfa.challengeAndVerify({ factorId, code })
 *         → factor is now verified; session upgrades to AAL2
 *
 * Surfaces as a Dialog — mount it anywhere (dashboard, settings, post-login prompt).
 */

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Shield, Smartphone, Copy, CheckCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

interface MFAEnrollDialogProps {
  open: boolean;
  onClose: () => void;
  onEnrolled: () => void;
}

type Step = 'qr' | 'verify' | 'done';

export const MFAEnrollDialog = ({ open, onClose, onEnrolled }: MFAEnrollDialogProps) => {
  const [step, setStep]         = useState<Step>('qr');
  const [factorID, setFactorID] = useState('');
  const [qrCode, setQRCode]     = useState('');   // SVG data URI from Supabase
  const [secret, setSecret]     = useState('');   // manual entry fallback
  const [code, setCode]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [copied, setCopied]     = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Start enrollment when dialog opens.
  useEffect(() => {
    if (!open) { setStep('qr'); setCode(''); setFactorID(''); setQRCode(''); setSecret(''); return; }
    startEnroll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (step === 'verify') setTimeout(() => codeRef.current?.focus(), 100);
  }, [step]);

  const startEnroll = async () => {
    setEnrolling(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
      if (error || !data) {
        toast({ title: 'Enrollment error', description: error?.message ?? 'Failed to start MFA enrollment', variant: 'destructive' });
        onClose();
        return;
      }
      setFactorID(data.id);
      setQRCode(data.totp.qr_code);   // SVG as a data URI
      setSecret(data.totp.secret);
    } finally {
      setEnrolling(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.replace(/\s/g, '').length < 6) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: factorID,
        code: code.replace(/\s/g, ''),
      });
      if (error) {
        toast({ title: 'Verification failed', description: error.message, variant: 'destructive' });
        setCode('');
        codeRef.current?.focus();
      } else {
        setStep('done');
        toast({ title: 'MFA Enabled', description: 'Authenticator app connected. Your account now requires MFA on every sign-in.' });
      }
    } finally {
      setLoading(false);
    }
  };

  const copySecret = async () => {
    await navigator.clipboard.writeText(secret).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const codeFormatted = (val: string) =>
    val.replace(/\D/g, '').slice(0, 6).replace(/(\d{3})(\d{1,3})/, '$1 $2');

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md card-cyber border-border">
        <DialogTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Set Up Authenticator MFA
        </DialogTitle>
        <DialogDescription className="text-muted-foreground text-sm">
          Protect your account with TOTP (Time-based One-Time Password) — required for CMMC Level 2+.
        </DialogDescription>

        {enrolling && (
          <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Generating enrollment…</span>
          </div>
        )}

        {/* ── Step 1: QR Code ── */}
        {!enrolling && step === 'qr' && qrCode && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-primary/5 border border-primary/20 rounded-md text-sm">
              <Smartphone className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-muted-foreground">
                Open <strong className="text-foreground">Google Authenticator</strong>, <strong className="text-foreground">Authy</strong>, or <strong className="text-foreground">1Password</strong> and scan the QR code below.
              </p>
            </div>

            {/* QR code */}
            <div className="flex justify-center">
              <div className="p-3 bg-white rounded-lg shadow-inner border border-border">
                <img
                  src={qrCode}
                  alt="Scan this QR code with your authenticator app"
                  width={180}
                  height={180}
                  className="block"
                />
              </div>
            </div>

            {/* Manual secret */}
            <details className="group">
              <summary className="text-xs text-muted-foreground cursor-pointer select-none hover:text-foreground">
                Can't scan? Enter secret key manually
              </summary>
              <div className="mt-2 flex gap-2 items-center">
                <code className="flex-1 text-xs font-mono bg-muted/50 border border-border rounded px-2 py-1.5 break-all select-all text-foreground">
                  {secret}
                </code>
                <button
                  type="button"
                  onClick={copySecret}
                  aria-label="Copy secret key"
                  className="p-1.5 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                >
                  {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </details>

            <Button className="w-full" onClick={() => setStep('verify')}>
              I've scanned it — Next
            </Button>
          </div>
        )}

        {/* ── Step 2: Verify ── */}
        {step === 'verify' && (
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-warning/5 border border-warning/20 rounded-md text-sm">
              <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
              <p className="text-muted-foreground">
                Enter the 6-digit code your authenticator app is currently showing to confirm setup.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="enroll-code" className="text-foreground text-sm">Verification Code</Label>
              <Input
                ref={codeRef}
                id="enroll-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9 ]*"
                maxLength={7}
                value={codeFormatted(code)}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000 000"
                autoComplete="one-time-code"
                className="text-center text-2xl tracking-[0.5em] font-mono bg-input/50 border-border"
                aria-label="Authenticator verification code"
              />
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setStep('qr')}>
                Back
              </Button>
              <Button
                type="submit"
                variant="cyber"
                className="flex-1"
                disabled={loading || code.length < 6}
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Shield className="h-4 w-4 mr-1.5" />
                    Activate MFA
                  </>
                )}
              </Button>
            </div>
          </form>
        )}

        {/* ── Step 3: Done ── */}
        {step === 'done' && (
          <div className="text-center space-y-4 py-4">
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-green-500/10">
                <CheckCircle className="h-10 w-10 text-green-500" />
              </div>
            </div>
            <div>
              <p className="font-semibold text-foreground">MFA is active</p>
              <p className="text-sm text-muted-foreground mt-1">
                Every sign-in now requires your authenticator code. Keep your recovery codes safe.
              </p>
            </div>
            <Badge variant="outline" className="border-green-500/40 text-green-500">
              AAL2 Session Active
            </Badge>
            <Button className="w-full" onClick={onEnrolled}>
              Continue
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MFAEnrollDialog;
