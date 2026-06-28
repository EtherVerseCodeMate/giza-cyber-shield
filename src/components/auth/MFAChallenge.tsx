'use client';

/**
 * MFAChallenge — shown after a successful email/password sign-in when the
 * Supabase session is at AAL1 but the account has a TOTP factor enrolled
 * (requiring AAL2 to proceed).
 *
 * Also supports the Email-OTP path (via Resend edge function).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Shield, Smartphone, Mail, RefreshCw, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

type MFAMethod = 'totp' | 'email';

interface MFAFactor {
  id: string;
  type: 'totp';
  status: 'verified' | 'unverified';
  friendly_name?: string;
}

interface MFAChallengeProps {
  onSuccess: () => void;
  onBack: () => void;
  /** Email for the email-OTP fallback path. */
  userEmail?: string;
}

export const MFAChallenge = ({ onSuccess, onBack, userEmail }: MFAChallengeProps) => {
  const [code, setCode]     = useState('');
  const [method, setMethod] = useState<MFAMethod>('totp');
  const [factors, setFactors]   = useState<MFAFactor[]>([]);
  const [activeFactor, setActiveFactor] = useState<MFAFactor | null>(null);
  const [challengeID, setChallengeID]   = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [sending, setSending]   = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Load enrolled TOTP factors on mount.
  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data, error }) => {
      if (error || !data) return;
      const verified: MFAFactor[] = (data.totp ?? [])
        .filter(f => f.status === 'verified')
        .map(f => ({ id: f.id, type: 'totp' as const, status: 'verified' as const, friendly_name: f.friendly_name }));
      setFactors(verified);
      if (verified.length > 0) {
        setActiveFactor(verified[0]);
        setMethod('totp');
        issueChallenge(verified[0].id);
      } else if (userEmail) {
        // No TOTP enrolled — fall back to email OTP automatically.
        setMethod('email');
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Focus code input when challenge is ready.
  useEffect(() => {
    if (challengeID || method === 'email') {
      setTimeout(() => codeRef.current?.focus(), 100);
    }
  }, [challengeID, method]);

  // Countdown timer for email resend cooldown.
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  const issueChallenge = useCallback(async (factorId: string) => {
    const { data, error } = await supabase.auth.mfa.challenge({ factorId });
    if (error) {
      toast({ title: 'MFA Error', description: error.message, variant: 'destructive' });
      return;
    }
    setChallengeID(data.id);
  }, [toast]);

  const handleVerifyTOTP = async () => {
    if (!activeFactor || !challengeID || code.length < 6) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.mfa.verify({
        factorId: activeFactor.id,
        challengeId: challengeID,
        code: code.replace(/\s/g, ''),
      });
      if (error) {
        toast({ title: 'Verification failed', description: error.message, variant: 'destructive' });
        setCode('');
        codeRef.current?.focus();
        // Re-issue challenge so next attempt uses a fresh one.
        await issueChallenge(activeFactor.id);
      } else {
        toast({ title: 'MFA verified', description: 'Session upgraded to AAL2.' });
        onSuccess();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmailOTP = async () => {
    if (!userEmail) return;
    setSending(true);
    try {
      // Call the Resend edge function already deployed to Supabase.
      const { data, error } = await supabase.functions.invoke('send-password-reset-otp', {
        body: { email: userEmail, purpose: 'mfa' },
      });
      if (error || !data?.success) {
        toast({ title: 'Failed to send code', description: error?.message ?? 'Try again.', variant: 'destructive' });
      } else {
        setEmailSent(true);
        setCountdown(60);
        toast({ title: 'Code sent', description: `6-digit code sent to ${userEmail}` });
        codeRef.current?.focus();
      }
    } finally {
      setSending(false);
    }
  };

  const handleVerifyEmailOTP = async () => {
    if (code.length < 6) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: userEmail ?? '',
        token: code.replace(/\s/g, ''),
        type: 'email',
      });
      if (error) {
        toast({ title: 'Invalid code', description: error.message, variant: 'destructive' });
        setCode('');
        codeRef.current?.focus();
      } else {
        toast({ title: 'MFA verified' });
        onSuccess();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (method === 'totp') handleVerifyTOTP();
    else handleVerifyEmailOTP();
  };

  const codeFormatted = (val: string) =>
    val.replace(/\D/g, '').slice(0, 6).replace(/(\d{3})(\d{1,3})/, '$1 $2');

  return (
    <Card className="w-full max-w-sm mx-auto card-cyber">
      <CardHeader className="text-center space-y-2 pb-2">
        <div className="flex justify-center">
          <div className="p-3 rounded-full bg-primary/10">
            <Shield className="h-7 w-7 text-primary" />
          </div>
        </div>
        <CardTitle className="text-xl">Multi-Factor Authentication</CardTitle>
        <Badge variant="outline" className="inline-flex mx-auto gap-1 border-warning text-warning text-xs">
          <Shield className="h-3 w-3" />
          AAL2 Required — CMMC Enforced
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Method toggle — only show when both are available */}
        {factors.length > 0 && userEmail && (
          <div className="flex rounded-md overflow-hidden border border-border">
            <button
              type="button"
              onClick={() => { setMethod('totp'); setCode(''); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs transition-colors ${method === 'totp' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              Authenticator App
            </button>
            <button
              type="button"
              onClick={() => { setMethod('email'); setCode(''); if (!emailSent) handleSendEmailOTP(); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs transition-colors ${method === 'email' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Mail className="h-3.5 w-3.5" />
              Email Code
            </button>
          </div>
        )}

        {/* Instructions */}
        <p className="text-sm text-muted-foreground text-center">
          {method === 'totp'
            ? 'Open your authenticator app and enter the 6-digit code.'
            : emailSent
              ? `Enter the 6-digit code sent to ${userEmail}.`
              : `We'll send a code to ${userEmail}.`}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email OTP — send button before code is sent */}
          {method === 'email' && !emailSent && (
            <Button
              type="button"
              className="w-full"
              onClick={handleSendEmailOTP}
              disabled={sending}
            >
              {sending ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Sending…
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Send Code via Email
                </div>
              )}
            </Button>
          )}

          {/* Code input — shown once code delivery path is ready */}
          {(method === 'totp' || emailSent) && (
            <div className="space-y-2">
              <Label htmlFor="mfa-code" className="text-foreground text-sm">
                Verification Code
              </Label>
              <Input
                ref={codeRef}
                id="mfa-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9 ]*"
                maxLength={7}
                value={codeFormatted(code)}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000 000"
                autoComplete="one-time-code"
                className="text-center text-2xl tracking-[0.5em] font-mono bg-input/50 border-border"
                aria-label="6-digit verification code"
              />
            </div>
          )}

          {/* Verify */}
          {(method === 'totp' || emailSent) && (
            <Button
              type="submit"
              variant="cyber"
              className="w-full"
              disabled={loading || code.length < 6}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Verifying…
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Verify
                </div>
              )}
            </Button>
          )}

          {/* Email resend */}
          {method === 'email' && emailSent && (
            <button
              type="button"
              disabled={countdown > 0 || sending}
              onClick={handleSendEmailOTP}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className="h-3 w-3" />
              {countdown > 0 ? `Resend in ${countdown}s` : 'Resend code'}
            </button>
          )}
        </form>

        {/* Back */}
        <div className="pt-2 border-t border-border">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to sign-in
          </button>
        </div>
      </CardContent>
    </Card>
  );
};

export default MFAChallenge;
