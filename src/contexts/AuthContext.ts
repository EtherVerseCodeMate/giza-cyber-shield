// src/contexts/AuthContext.ts — SOVEREIGN MODE
// Auth context using ASAF license-key auth. No Supabase dependency.
// The User and Session types mirror the Supabase shape for interface compatibility
// with all existing callers of useAuth() — zero downstream breakage.

import { createContext, useContext } from 'react';

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
  isSaasMode: boolean;
  signIn:         (email: string, password: string) => Promise<{ error: any }>;
  signUp:         (email: string, password: string, metadata?: any) => Promise<{ error: any }>;
  signOut:        () => Promise<{ error: any }>;
  resetPassword:  (email: string) => Promise<{ error: any }>;
  signInWithOAuth: (provider: string) => Promise<{ error: any }>;
  signInWithSSO:   (domain: string)   => Promise<{ error: any }>;
  // Sovereign-mode-only: creates the first admin account. Backend 403s once
  // an admin already exists. No-op error in cloud (SaaS) mode.
  bootstrapAdmin:  (username: string, email: string, password: string) => Promise<{ error: any }>;
  // Sovereign-mode-only: true if no admin account exists yet. Always false
  // in cloud (SaaS) mode or if the check itself fails.
  checkNeedsBootstrap: () => Promise<boolean>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Hook to get user role.
// The role already comes back from the auth backend on login/session-validate
// (Supabase app_metadata.role for cloud, the SQLite user's primary role for
// sovereign — see AuthProvider.tsx's buildUser()) and is stored on the user
// object. No separate network round-trip needed — there used to be one
// against a dead port (the retired khepra-daemon on :45444), which always
// failed and silently fell back to a tier-guess. Fixed 2026-06-30.
export const useUserRoles = () => {
  const { user, loading: authLoading } = useAuth();
  const role = user?.app_metadata?.role ?? null;

  return {
    role,
    loading: authLoading,
    hasRole: (checkRole: string) => role === checkRole,
    isAdmin: () => role === 'admin',
  };
};
