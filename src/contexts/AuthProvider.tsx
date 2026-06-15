/**
 * src/contexts/AuthProvider.tsx  (v2 — Cloud + Sovereign hybrid)
 * SouHimBou AI · NouchiX SecRed Knowledge Inc.
 *
 * Profile A (cloud):   Supabase Auth → Google / GitHub / LinkedIn / SSO / email
 * Profile B (sovereign): ASAF license key → localhost:45444/api/v1/license/validate
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
const ASAF_API          = 'http://localhost:45444/api/v1'
const LICENSE_STORAGE   = 'asaf_license_key'
const USER_STORAGE      = 'asaf_user_profile'

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
  useEffect(() => {
    if (saas) return
    const stored = localStorage.getItem(USER_STORAGE)
    const key    = localStorage.getItem(LICENSE_STORAGE)
    if (stored && key) {
      try {
        const profile = JSON.parse(stored) as ASAFUser
        setUser(profile)
        setSession({ user: profile, access_token: key })
      } catch {
        localStorage.removeItem(USER_STORAGE)
        localStorage.removeItem(LICENSE_STORAGE)
      }
    }
    setLoading(false)
  }, [saas])

  // ── SIGN IN ───────────────────────────────────────────────────────────────
  const signIn = useCallback(async (email: string, password: string) => {
    if (saas) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return { error }
    }
    // Sovereign: validate license key
    return sovereignSignIn(email, password, setUser, setSession)
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
    localStorage.removeItem(LICENSE_STORAGE)
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
    isSaasMode: saas,
  }), [user, session, loading, signIn, signUp, signOut, resetPassword, signInWithOAuth, signInWithSSO, saas])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ── Sovereign auth helpers ────────────────────────────────────────────────────

async function sovereignSignIn(
  email: string,
  password: string,
  setUser: (u: ASAFUser) => void,
  setSession: (s: { user: ASAFUser; access_token: string }) => void
) {
  const key = password.startsWith('ASAF-') ? password : password

  try {
    const resp = await fetch(`${ASAF_API}/license/validate`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ license_key: key, email }),
      signal:  AbortSignal.timeout(3000),
    })
    if (resp.ok) {
      const claims = await resp.json()
      return handleValidLicense(key, email, claims, setUser, setSession)
    }
    if (resp.status === 401 || resp.status === 403) {
      return { error: { message: 'Invalid license key. Purchase at nouchix.com' } }
    }
  } catch {
    console.warn('[ASAF-AUTH] Agent offline — offline license check')
  }

  if (/^ASAF-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(key)) {
    return handleValidLicense(key, email, { tier: 'community' }, setUser, setSession)
  }

  if (process.env.NEXT_PUBLIC_ASAF_DEV === '1') {
    const u = buildUser(email, 'dev-mode', { tier: 'dev' })
    localStorage.setItem(LICENSE_STORAGE, 'dev-mode')
    localStorage.setItem(USER_STORAGE, JSON.stringify(u))
    setUser(u); setSession({ user: u, access_token: 'dev-mode' })
    return { error: null }
  }

  return { error: { message: 'Enter your ASAF license key (ASAF-XXXX-XXXX-XXXX-XXXX)' } }
}

function handleValidLicense(
  key: string,
  email: string,
  claims: { tenant?: string; tier?: string; capabilities?: string[] },
  setUser: (u: ASAFUser) => void,
  setSession: (s: { user: ASAFUser; access_token: string }) => void
) {
  const u = buildUser(email, key, claims)
  localStorage.setItem(LICENSE_STORAGE, key)
  localStorage.setItem(USER_STORAGE, JSON.stringify(u))
  setUser(u)
  setSession({ user: u, access_token: key })
  return { error: null }
}

function buildUser(
  email: string,
  key: string,
  claims?: { tenant?: string; tier?: string }
): ASAFUser {
  return {
    id:            btoa(email + key).slice(0, 36),
    email,
    user_metadata: {
      full_name: claims?.tenant ?? email.split('@')[0],
      username:  email.split('@')[0],
      tenant:    claims?.tenant ?? email,
      tier:      claims?.tier ?? 'community',
      provider:  'license-key',
    },
    app_metadata: { role: 'user', provider: 'license-key' },
    aud:          'asaf',
    created_at:   new Date().toISOString(),
  }
}
