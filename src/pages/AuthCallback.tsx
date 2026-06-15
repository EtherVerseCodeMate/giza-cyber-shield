/**
 * src/pages/AuthCallback.tsx
 * SouHimBou AI · OAuth callback + session hydration
 * NouchiX SecRed Knowledge Inc.
 *
 * Handles:
 *   - Google / GitHub / LinkedIn / Microsoft OAuth redirects
 *   - Email confirmation deep links
 *   - Password reset links
 *   - Detects first-time users and routes to onboarding
 */
'use client'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Shield, Loader2, CheckCircle, XCircle } from 'lucide-react'

type Stage = 'processing' | 'success' | 'error'

const AuthCallback = () => {
  const navigate = useNavigate()
  const [stage,   setStage]   = useState<Stage>('processing')
  const [message, setMessage] = useState('Verifying session…')
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    const handle = async () => {
      try {
        // Exchange the code in the URL for a session (PKCE)
        const { data, error } = await supabase.auth.exchangeCodeForSession(window.location.href)

        if (error) {
          console.error('[AUTH-CALLBACK]', error)
          setError(error.message)
          setStage('error')
          return
        }

        const user = data.session?.user
        if (!user) {
          setError('No user in session. Please try signing in again.')
          setStage('error')
          return
        }

        setMessage('Session established — checking your profile…')

        // Check if this is a first-time user (no profile row)
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('id, onboarding_complete')
          .eq('id', user.id)
          .single()

        setStage('success')

        if (!profile || !profile.onboarding_complete) {
          setMessage('Welcome! Setting up your workspace…')
          setTimeout(() => navigate('/onboarding'), 1200)
        } else {
          setMessage('All set! Redirecting to dashboard…')
          setTimeout(() => navigate('/dashboard'), 1000)
        }
      } catch (err: any) {
        setError(err?.message ?? 'Unexpected error during authentication.')
        setStage('error')
      }
    }

    handle()
  }, [navigate])

  return (
    <div className="min-h-screen bg-[#050c16] flex flex-col items-center justify-center p-6"
      style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-[#1a4f7a]/15 blur-[100px] pointer-events-none" />

      <div className="relative z-10 text-center max-w-sm">
        {/* Logo */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1a9fe8] to-[#0d4f7a] shadow-lg shadow-[#1a9fe8]/20 mb-6">
          <Shield className="h-8 w-8 text-white" />
        </div>

        {/* Status icon */}
        <div className="flex justify-center mb-4">
          {stage === 'processing' && (
            <div className="flex items-center gap-2 text-[#1a9fe8]">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm font-medium">Authenticating</span>
            </div>
          )}
          {stage === 'success' && (
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle className="h-5 w-5" />
              <span className="text-sm font-medium">Authenticated</span>
            </div>
          )}
          {stage === 'error' && (
            <div className="flex items-center gap-2 text-red-400">
              <XCircle className="h-5 w-5" />
              <span className="text-sm font-medium">Authentication Failed</span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {stage === 'processing' && (
          <div className="w-48 mx-auto h-1 bg-white/10 rounded-full overflow-hidden mb-4">
            <div className="h-full bg-gradient-to-r from-[#1a4f7a] to-[#1a9fe8] rounded-full animate-[progress_2s_ease-in-out_infinite]" style={{ width: '60%' }} />
          </div>
        )}

        {/* Message */}
        <p className="text-sm text-[#6b8aaa] mb-2">{message}</p>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-left">
            {error}
            <br />
            <button
              onClick={() => navigate('/auth')}
              className="mt-2 text-xs underline hover:text-red-300 transition-colors"
            >
              Return to sign in →
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes progress { 0%{margin-left:0;width:40%} 50%{margin-left:30%;width:60%} 100%{margin-left:100%;width:10%} }
      `}</style>
    </div>
  )
}

export default AuthCallback