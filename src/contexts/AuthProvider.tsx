/**
 * src/contexts/AuthProvider.tsx  (v3 — Cloud + Sovereign hybrid)
 * SouHimBou AI · NouchiX SecRed Knowledge Inc.
 *
 * Profile A (cloud):     Supabase Auth → Google / GitHub / LinkedIn / SSO / email
 * Profile B (sovereign): on-premise SQLite auth, no external calls — see
 *   pkg/auth/sqlite_provider.go + pkg/webui/auth_api.go (adinkhepra serve).
 *   Previously pointed at localhost:45444/api/v1/license/validate, the
 *   retired khepra-daemon port that was never connected to anything real —
 *   fixed 2026-06-30, see project_product_a_architecture memory.
 *
 * Both profiles expose identical AuthContextType so all downstream components
 * work without modification.
 */
'use client'
import {
  useState, useEffect, ReactNode, useMemo, useCallback,
} from 'react'
import { AuthContext } from './AuthContext'
import { supabase, isSaasMode, OAUTH_REDIRECT } from '@/lib/supabase'
import type { Provider } from '@supabase/supabase-js'

// ── ASAF sovereign constants ─────────────────────────────────────────────────
// NEXT_PUBLIC_ASAF_API_URL is baked at build time (Dockerfile.dashboard) —
// defaults to the adinkhepra serve port (8443 in docker-compose.asaf.yml).
const ASAF_API           = (process.env.NEXT_PUBLIC_ASAF_API_URL ?? 'http://localhost:8443') + '/api/v1'
const SESSION_STORAGE    = 'asaf_session_token'
const USER_STORAGE       = 'asaf_user_profile'

// ── Synthetic user (keeps sovereign + cloud shapes compatible) ───────────────
export interface ASAFUser {
  id:            string
  email:         string
  user_metadata: {
    full_name?:  string
    username?:   string
    avatar_url?: string
    tenant?:     string
    clearance?:  string
    tier?:       string
    provider?:   string
  }
  app_metadata:  { role: string; provider?: string }
  aud:           string
  created_at:    string
}

interface AuthProviderProps { children: ReactNode }

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user,    setUser]    = useState<any | null>(null)
  const [session, setSession] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const saas = isSaasMode()

  // ── CLOUD BOOT ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!saas) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_ev, sess) => {
      setSession(sess)
      setUser(sess?.user ?? null)
      setLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [saas])

  // ── SOVEREIGN BOOT ────────────────────────────────────────────────────────
  // Re-validates the stored session against the local SQLite auth store on
  // every load — a session token that's expired or was revoked server-side
  // (e.g. admin deleted the user) no longer silently grants access just
  // because it's sitting in localStorage.
  useEffect(() => {
    if (saas) return
    const stored = localStorage.getItem(USER_STORAGE)
    const token  = localStorage.getItem(SESSION_STORAGE)
    if (!stored || !token) {
      setLoading(false)
      return
    }
    let profile: ASAFUser
    try {
      profile = JSON.parse(stored) as ASAFUser
    } catch {
      localStorage.removeItem(USER_STORAGE)
      localStorage.removeItem(SESSION_STORAGE)
      setLoading(false)
      return
    }

    fetch(`${ASAF_API}/auth/validate`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ session_token: token }),
      signal:  AbortSignal.timeout(5000),
    })
      .then(r => r.ok ? r.json() : { valid: false })
      .then(({ valid }) => {
        if (valid) {
          setUser(profile)
          setSession({ user: profile, access_token: token })
        } else {
          localStorage.removeItem(USER_STORAGE)
          localStorage.removeItem(SESSION_STORAGE)
        }
      })
      .catch(() => {
        // Backend unreachable — don't silently trust a stale local session
        // against a server that might no longer agree it's valid.
        localStorage.removeItem(USER_STORAGE)
        localStorage.removeItem(SESSION_STORAGE)
      })
      .finally(() => setLoading(false))
  }, [saas])

  // ── SIGN IN ───────────────────────────────────────────────────────────────
  const signIn = useCallback(async (email: string, password: string) => {
    if (saas) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return { error }
    }
    // Sovereign: authenticate against the local SQLite store (zero external calls)
    return sovereignSignIn(email, password, setUser, setSession)
  }, [saas])

  // ── BOOTSTRAP (sovereign first-run only) ─────────────────────────────────
  // Creates the first admin account. Only succeeds while no admin exists —
  // the backend 403s on every call after the first.
  const bootstrapAdmin = useCallback(async (username: string, email: string, password: string) => {
    if (saas) return { error: { message: 'Bootstrap is a sovereign-mode-only operation.' } }
    try {
      const resp = await fetch(`${ASAF_API}/auth/bootstrap`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username, email, password }),
        signal:  AbortSignal.timeout(5000),
      })
      const data = await resp.json()
      if (!resp.ok) return { error: { message: data.error ?? 'Bootstrap failed.' } }
      return handleLoginResponse(data, setUser, setSession)
    } catch (e) {
      return { error: { message: 'Cannot reach the ASAF API. Is adinkhepra serve running?' } }
    }
  }, [saas])

  // Checks whether bootstrap is still available (no admin account exists yet).
  // Drives Auth.tsx's decision to show a "create admin" form instead of the
  // normal login form on a fresh install. Defaults to false (show login) on
  // any error — a backend hiccup shouldn't trap the user on a setup screen
  // for an install that's actually already configured.
  const checkNeedsBootstrap = useCallback(async (): Promise<boolean> => {
    if (saas) return false
    try {
      const resp = await fetch(`${ASAF_API}/auth/bootstrap`, { signal: AbortSignal.timeout(5000) })
      if (!resp.ok) return false
      const data = await resp.json()
      return Boolean(data.needs_bootstrap)
    } catch {
      return false
    }
  }, [saas])

  // ── SIGN IN WITH OAUTH ───────────────────────────────────────────────────
  const signInWithOAuth = useCallback(async (provider: Provider) => {
    if (!saas) {
      return { error: { message: 'OAuth requires cloud mode. Start adinkhepra run first.' } }
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: OAUTH_REDIRECT,
        scopes: provider === 'github' ? 'read:user user:email' : undefined,
      },
    })
    return { error }
  }, [saas])

  // ── SIGN IN WITH SSO ─────────────────────────────────────────────────────
  const signInWithSSO = useCallback(async (domain: string) => {
    if (!saas) return { error: { message: 'SSO requires cloud mode.' } }
    const { error } = await supabase.auth.signInWithSSO({ domain })
    return { error }
  }, [saas])

  // ── SIGN UP ───────────────────────────────────────────────────────────────
  const signUp = useCallback(async (
    email: string,
    password: string,
    metadata?: Record<string, string>
  ) => {
    if (saas) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
          emailRedirectTo: OAUTH_REDIRECT,
        },
      })
      return { error }
    }
    // Sovereign: open Stripe payment
    window.open('https://pay.nouchix.com/certify', '_blank')
    return { error: { message: 'License purchase page opened. Enter your key once received.' } }
  }, [saas])

  // ── SIGN OUT ──────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    if (saas) {
      const { error } = await supabase.auth.signOut()
      return { error }
    }
    localStorage.removeItem(SESSION_STORAGE)
    localStorage.removeItem(USER_STORAGE)
    setUser(null)
    setSession(null)
    return { error: null }
  }, [saas])

  // ── RESET PASSWORD ────────────────────────────────────────────────────────
  const resetPassword = useCallback(async (email: string) => {
    if (saas) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${OAUTH_REDIRECT.replace('/callback', '/reset-password')}`,
      })
      return { error }
    }
    window.open('https://nouchix.com/support', '_blank')
    return { error: null }
  }, [saas])

  // ── CONTEXT ───────────────────────────────────────────────────────────────
  const value = useMemo(() => ({
    user, session, loading,
    signIn, signUp, signOut, resetPassword,
    signInWithOAuth,
    signInWithSSO,
    bootstrapAdmin,
    checkNeedsBootstrap,
    isSaasMode: saas,
  }), [user, session, loading, signIn, signUp, signOut, resetPassword, signInWithOAuth, signInWithSSO, bootstrapAdmin, checkNeedsBootstrap, saas])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ── Sovereign auth helpers ────────────────────────────────────────────────────
// Calls adinkhepra serve's /api/v1/auth/* endpoints (pkg/webui/auth_api.go),
// backed by an on-premise SQLite database (pkg/auth/sqlite_provider.go) —
// zero external calls, matching the Adinkhepra-ASAF README's Profile B claim.
// There is no offline/regex fallback: the backend is local (same host or
// same Docker network), so "unreachable" means the service isn't running,
// not that the user is genuinely offline — that's a real error to surface,
// not something to silently bypass with a fake validity check.

interface LoginAPIResponse {
  user: { id: string; username: string; email: string; roles: string[]; organizations: string[] | null }
  session_token: string
  expires_at: string
}

async function sovereignSignIn(
  email: string,
  password: string,
  setUser: (u: ASAFUser) => void,
  setSession: (s: { user: ASAFUser; access_token: string }) => void
) {
  try {
    const resp = await fetch(`${ASAF_API}/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username: email, password }),
      signal:  AbortSignal.timeout(5000),
    })
    const data = await resp.json()
    if (!resp.ok) {
      return { error: { message: data.error ?? 'Invalid email or password.' } }
    }
    return handleLoginResponse(data as LoginAPIResponse, setUser, setSession)
  } catch {
    return { error: { message: 'Cannot reach the ASAF API. Is adinkhepra serve running?' } }
  }
}

function handleLoginResponse(
  data: LoginAPIResponse,
  setUser: (u: ASAFUser) => void,
  setSession: (s: { user: ASAFUser; access_token: string }) => void
) {
  const u = buildUser(data.user)
  localStorage.setItem(SESSION_STORAGE, data.session_token)
  localStorage.setItem(USER_STORAGE, JSON.stringify(u))
  setUser(u)
  setSession({ user: u, access_token: data.session_token })
  return { error: null }
}

function buildUser(apiUser: LoginAPIResponse['user']): ASAFUser {
  return {
    id:    apiUser.id,
    email: apiUser.email,
    user_metadata: {
      full_name: apiUser.username,
      username:  apiUser.username,
      tenant:    (apiUser.organizations ?? [])[0] ?? apiUser.email,
      tier:      apiUser.roles.includes('admin') ? 'admin' : 'standard',
      provider:  'sovereign-sqlite',
    },
    app_metadata: { role: apiUser.roles[0] ?? 'viewer', provider: 'sovereign-sqlite' },
    aud:          'asaf',
    created_at:   new Date().toISOString(),
  }
}
