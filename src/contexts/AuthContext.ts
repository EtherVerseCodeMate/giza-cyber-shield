// src/contexts/AuthContext.ts — SOVEREIGN MODE
// Auth context using ASAF license-key auth. No Supabase dependency.
// The User and Session types mirror the Supabase shape for interface compatibility
// with all existing callers of useAuth() — zero downstream breakage.

import { createContext, useContext, useState, useEffect } from 'react';

// ── Minimal User/Session types that satisfy all callers ──────────────────────
// These mirror @supabase/supabase-js types at the used-field level.
// We don't import from supabase-js — pure TypeScript.

export interface User {
  id: string;
  email: string | undefined;
  user_metadata: Record<string, any>;
  app_metadata: Record<string, any>;
  aud: string;
  created_at: string;
}

export interface Session {
  user: User;
  access_token: string;
}

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, metadata?: any) => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
  resetPassword: (email: string) => Promise<{ error: any }>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Hook to get user role — returns 'admin' for licensed users, 'viewer' otherwise.
// Uses the ASAF agent's role endpoint when available; falls back to 'user'.
export const useUserRoles = () => {
  const { user } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async () => {
      if (!user) {
        setRole(null);
        setLoading(false);
        return;
      }

      try {
        const resp = await fetch('http://localhost:45444/api/v1/me/role', {
          signal: AbortSignal.timeout(2000),
        });
        if (resp.ok) {
          const data = await resp.json();
          setRole(data?.role ?? 'user');
          return;
        }
      } catch {
        // Agent offline — derive role from license tier
      }

      // Offline fallback: tier → role mapping
      const tier = user.user_metadata?.tier ?? 'community';
      setRole(tier === 'enterprise' || tier === 'partner' ? 'admin' : 'user');
      setLoading(false);
    };

    fetchRole().finally(() => setLoading(false));
  }, [user]);

  return {
    role,
    loading,
    hasRole: (checkRole: string) => role === checkRole,
    isAdmin: () => role === 'admin',
  };
};
