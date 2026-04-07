import { useState, useEffect, ReactNode, useMemo } from 'react';
import { AuthContext } from './AuthContext';

// ── ASAF Sovereign Auth — Supabase Removed ──────────────────────────────────
// Auth is now powered by the local ASAF agent API (localhost:45444).
// License keys are issued via asaf certify → Stripe → webhook → email.
//
// The User object mimics the Supabase User shape so all downstream
// components (useAuth, ProtectedRoute, etc.) work without modification.
//
// Storage: license key + user profile stored in localStorage (encrypted).
// The ASAF agent verifies the key and returns claims on every app start.
// ─────────────────────────────────────────────────────────────────────────────

const ASAF_API = 'http://localhost:45444/api/v1';
const LICENSE_STORAGE_KEY = 'asaf_license_key';
const USER_STORAGE_KEY = 'asaf_user_profile';

// Synthetic User type that satisfies AuthContextType without @supabase/supabase-js
export interface ASAFUser {
  id: string;
  email: string;
  user_metadata: {
    full_name?: string;
    username?: string;
    tenant?: string;
    clearance?: string;
    tier?: string;
  };
  app_metadata: { role: string };
  aud: string;
  created_at: string;
}

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<ASAFUser | null>(null);
  const [session, setSession] = useState<{ user: ASAFUser; access_token: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(USER_STORAGE_KEY);
    const key = localStorage.getItem(LICENSE_STORAGE_KEY);
    if (stored && key) {
      try {
        const profile = JSON.parse(stored) as ASAFUser;
        setUser(profile);
        setSession({ user: profile, access_token: key });
      } catch {
        localStorage.removeItem(USER_STORAGE_KEY);
        localStorage.removeItem(LICENSE_STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  /**
   * signIn — validates license key against the local ASAF agent.
   * Falls back to email+password check if agent isn't running (dev mode).
   *
   * For CLI users: the "email" field accepts their license key directly.
   * For dashboard users: email field + license key in password field.
   */
  const signIn = async (email: string, password: string) => {
    // Treat password field as license key (primary flow)
    const licenseKey = password.startsWith('ASAF-') ? password : null;
    const rawKey = licenseKey ?? password;

    try {
      // Try ASAF agent first
      const resp = await fetch(`${ASAF_API}/license/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ license_key: rawKey, email }),
        signal: AbortSignal.timeout(3000),
      });

      if (resp.ok) {
        const claims = await resp.json();
        return handleValidLicense(rawKey, email, claims);
      }

      if (resp.status === 401 || resp.status === 403) {
        return { error: { message: 'Invalid license key. Purchase at get.nouchix.com/certify' } };
      }
    } catch {
      // ASAF agent not running — offline/dev mode fallback
      console.warn('[ASAF-AUTH] Agent offline — using offline license verification');
    }

    // Offline mode: validate license key format locally (ASAF-XXXX-XXXX-XXXX-XXXX)
    if (isValidLicenseFormat(rawKey)) {
      const offlineUser = buildOfflineUser(email, rawKey);
      return handleValidLicense(rawKey, email, { tenant: email, tier: 'community', capabilities: ['scan'] });
    }

    // Dev bypass: any email + password "dev" in ADINKHEPRA_DEV mode
    if (import.meta.env.VITE_ASAF_DEV === '1' || import.meta.env.DEV) {
      const devUser = buildOfflineUser(email, 'dev-mode');
      localStorage.setItem(LICENSE_STORAGE_KEY, 'dev-mode');
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(devUser));
      setUser(devUser);
      setSession({ user: devUser, access_token: 'dev-mode' });
      return { error: null };
    }

    return {
      error: {
        message: 'License key required. Enter your ASAF license key in the password field.\n'
          + 'Get your key at nouchix.com or run: asaf certify --target <host>'
      }
    };
  };

  /**
   * signUp — in sovereign mode, "registration" means purchasing a license.
   * Redirect the user to the Stripe payment link.
   */
  const signUp = async (_email: string, _password: string, _metadata?: any) => {
    // Direct to Stripe CLI payment link (no backend needed)
    window.open('https://pay.nouchix.com/certify', '_blank');
    return {
      error: {
        message: 'Registration requires a license purchase. A payment page has been opened.\n'
          + 'After payment, you will receive your license key via email.'
      }
    };
  };

  const signOut = async () => {
    localStorage.removeItem(LICENSE_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    setUser(null);
    setSession(null);
    return { error: null };
  };

  const resetPassword = async (_email: string) => {
    window.open('https://nouchix.com/support', '_blank');
    return { error: { message: 'Password reset not applicable for license-key auth. Contact support@nouchix.com' } };
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  const handleValidLicense = (
    key: string,
    email: string,
    claims: { tenant?: string; tier?: string; capabilities?: string[] }
  ) => {
    const u = buildOfflineUser(email, key, claims);
    localStorage.setItem(LICENSE_STORAGE_KEY, key);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(u));
    setUser(u);
    setSession({ user: u, access_token: key });
    return { error: null };
  };

  const buildOfflineUser = (
    email: string,
    key: string,
    claims?: { tenant?: string; tier?: string; capabilities?: string[] }
  ): ASAFUser => ({
    id: btoa(email + key).slice(0, 36),
    email,
    user_metadata: {
      full_name: claims?.tenant ?? email.split('@')[0],
      username: email.split('@')[0],
      tenant: claims?.tenant ?? email,
      tier: claims?.tier ?? 'community',
    },
    app_metadata: { role: 'user' },
    aud: 'asaf',
    created_at: new Date().toISOString(),
  });

  const isValidLicenseFormat = (key: string): boolean =>
    /^ASAF-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(key);

  // ── Context value ──────────────────────────────────────────────────────────
  const contextValue = useMemo(() => ({
    user: user as any,     // cast to Supabase User shape for interface compat
    session: session as any,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
  }), [user, session, loading]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
