'use client';

/**
 * OAuthProviders — social + SSO sign-in buttons for the Auth page.
 *
 * Calls useAuth().signInWithOAuth() which routes to:
 *   • Cloud mode  → supabase.auth.signInWithOAuth({ provider }) — real OAuth redirect
 *   • Sovereign mode → shows unsupported toast (license-key only)
 *
 * Prerequisites (Supabase dashboard → Authentication → Providers):
 *   GitHub     — enable + add Client ID/Secret from github.com/settings/apps
 *   Google     — enable + add Client ID/Secret from console.cloud.google.com
 *   LinkedIn   — enable (linkedin_oidc) + add Client ID/Secret from linkedin.com/developers
 *   Azure AD   — enable for enterprise SSO (optional)
 *
 * Claude/Cline/Smithery don't publish OAuth — GitHub covers their user base.
 * Magic link (email OTP) is the fallback for API-tool users without GitHub.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

// Provider SVG icons (inlined — no icon library dep)
const GitHubIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
  </svg>
);

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const LinkedInIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="#0A66C2" aria-hidden="true">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

const MagicLinkIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M3 8l7.89 5.26a2 2 0 0 0 2.22 0L21 8M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z"/>
  </svg>
);

interface OAuthProvidersProps {
  label?: string;       // "Continue with" | "Sign up with"
  onSuccess?: () => void;
  disabled?: boolean;
}

export const OAuthProviders = ({ label = 'Continue with', onSuccess, disabled }: OAuthProvidersProps) => {
  const { signInWithOAuth } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const handleOAuth = async (provider: string, displayName: string) => {
    setBusy(provider);
    try {
      const { error } = await signInWithOAuth(provider as 'github' | 'google' | 'linkedin_oidc');
      if (error) {
        toast({
          title: `${displayName} sign-in failed`,
          description: error.message,
          variant: 'destructive',
        });
      } else {
        onSuccess?.();
      }
    } finally {
      setBusy(null);
    }
  };

  const handleMagicLink = async (email: string) => {
    if (!email) {
      toast({ title: 'Enter your email first', description: 'Type your email in the field above.', variant: 'destructive' });
      return;
    }
    setBusy('magic');
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin + '/auth/callback' },
      });
      if (error) {
        toast({ title: 'Magic link failed', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Magic link sent', description: `Check ${email} for your sign-in link. Valid for 60 minutes.` });
      }
    } finally {
      setBusy(null);
    }
  };

  const providers = [
    { id: 'github',        icon: <GitHubIcon />,   name: 'GitHub',   bg: 'bg-[#24292e] hover:bg-[#1a1e22] text-white border-[#24292e]' },
    { id: 'google',        icon: <GoogleIcon />,   name: 'Google',   bg: 'bg-white hover:bg-gray-50 text-gray-900 border-gray-300 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600' },
    { id: 'linkedin_oidc', icon: <LinkedInIcon />, name: 'LinkedIn', bg: 'bg-[#0A66C2] hover:bg-[#094fa3] text-white border-[#0A66C2]' },
  ];

  return (
    <div className="space-y-3" role="group" aria-label="Social sign-in options">
      {/* Divider */}
      <div className="relative my-2">
        <div className="absolute inset-0 flex items-center">
          <Separator className="w-full" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground tracking-widest">or {label}</span>
        </div>
      </div>

      {/* OAuth buttons */}
      <div className="grid grid-cols-3 gap-2">
        {providers.map(p => (
          <button
            key={p.id}
            type="button"
            disabled={!!busy || disabled}
            onClick={() => handleOAuth(p.id, p.name)}
            aria-label={`${label} ${p.name}`}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-md border text-sm font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${p.bg}`}
          >
            {busy === p.id ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : p.icon}
            <span className="hidden sm:inline">{p.name}</span>
          </button>
        ))}
      </div>

      {/* Magic Link — covers Claude/Cline/Smithery users without a specific OAuth provider */}
      <MagicLinkButton busy={busy} disabled={disabled} onSend={handleMagicLink} />

      {/* Enterprise SSO note */}
      <p className="text-center text-xs text-muted-foreground pt-1">
        Enterprise SSO?{' '}
        <button
          type="button"
          className="text-primary underline underline-offset-2 hover:text-primary/80"
          onClick={() => {
            const domain = prompt('Enter your organization email domain (e.g. company.com):');
            if (domain?.trim()) {
              import('@/lib/supabase').then(({ supabase: sb }) =>
                sb.auth.signInWithSSO({ domain: domain.trim() })
              );
            }
          }}
        >
          Sign in with SSO
        </button>
      </p>
    </div>
  );
};

// ── Magic Link sub-component ──────────────────────────────────────────────────

interface MagicLinkButtonProps {
  busy: string | null;
  disabled?: boolean;
  onSend: (email: string) => void;
}

const MagicLinkButton = ({ busy, disabled, onSend }: MagicLinkButtonProps) => {
  const [mlEmail, setMlEmail] = useState('');
  const [showField, setShowField] = useState(false);

  if (!showField) {
    return (
      <button
        type="button"
        onClick={() => setShowField(true)}
        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-md border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all duration-150"
      >
        <MagicLinkIcon />
        <span>Magic Link (Claude · Cline · Smithery users)</span>
      </button>
    );
  }

  return (
    <div className="flex gap-2">
      <input
        type="email"
        value={mlEmail}
        onChange={e => setMlEmail(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onSend(mlEmail)}
        placeholder="your@email.com"
        autoFocus
        className="flex-1 px-3 py-2 text-sm rounded-md border border-border bg-input/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        aria-label="Email for magic link"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!!busy || disabled || !mlEmail}
        onClick={() => onSend(mlEmail)}
        aria-label="Send magic link"
      >
        {busy === 'magic' ? (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : 'Send'}
      </Button>
    </div>
  );
};

export default OAuthProviders;
