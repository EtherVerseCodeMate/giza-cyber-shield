/**
 * src/lib/supabase.ts
 * SouHimBou AI SaaS — Supabase client (Profile A cloud auth)
 * NouchiX SecRed Knowledge Inc.
 *
 * Mode detection:
 *   NEXT_PUBLIC_ASAF_PROFILE=cloud   → Supabase auth + OAuth
 *   NEXT_PUBLIC_ASAF_PROFILE=sovereign → License-key auth (existing AuthProvider)
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? ''
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

export const supabase = createClient(supabaseUrl, supabaseAnon, {
  auth: {
    autoRefreshToken: true,
    persistSession:   true,
    detectSessionInUrl: true,
    storageKey: 'souhimbou_auth',
    flowType: 'pkce',    // PKCE for OAuth security
  },
})

export const isSaasMode = (): boolean =>
  process.env.NEXT_PUBLIC_ASAF_PROFILE !== 'sovereign' && Boolean(supabaseUrl)

export const OAUTH_REDIRECT =
  typeof window !== 'undefined'
    ? `${window.location.origin}/auth/callback`
    : `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://souhimbou.ai'}/auth/callback`
