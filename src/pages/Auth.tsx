/**
 * src/pages/Auth.tsx  (v2 — SouHimBou AI SaaS Auth)
 * NouchiX SecRed Knowledge Inc. · STIG-First Compliance Autopilot
 *
 * Providers: Google · GitHub · LinkedIn · Microsoft · Email · Enterprise SSO
 * Security:  PKCE, account lockout, password strength, prompt injection–safe
 */
'use client'
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useSecurityHardening } from '@/hooks/useSecurityHardening'
import PasswordResetOTP from '@/components/auth/PasswordResetOTP'
import { useToast } from '@/hooks/use-toast'
import {
  Shield, Lock, Eye, EyeOff, Mail, Building2,
  Fingerprint, ArrowRight, Loader2, ChevronRight,
} from 'lucide-react'

// ── SVG provider icons ─────────────────────────────────────────────────────
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
)

const GitHubIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
  </svg>
)

const LinkedInIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="#0077B5">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
)

const MicrosoftIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <rect x="1" y="1" width="10" height="10" fill="#F25022"/>
    <rect x="13" y="1" width="10" height="10" fill="#7FBA00"/>
    <rect x="1" y="13" width="10" height="10" fill="#00A4EF"/>
    <rect x="13" y="13" width="10" height="10" fill="#FFB900"/>
  </svg>
)

// ── OAuth button ───────────────────────────────────────────────────────────
function OAuthButton({
  icon, label, onClick, disabled,
}: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group w-full flex items-center gap-3 px-4 h-11 rounded-lg
        bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20
        text-sm font-medium text-white/80 hover:text-white
        transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-60 -translate-x-1 group-hover:translate-x-0 transition-all" />
    </button>
  )
}

// ── Password strength bar ──────────────────────────────────────────────────
function PasswordStrength({ password }: { password: string }) {
  const score = [
    password.length >= 12,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length

  const colors = ['bg-red-500', 'bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-emerald-400']
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong']

  if (!password) return null
  return (
    <div className="space-y-1.5 mt-2">
      <div className="flex gap-1.5">
        {[0,1,2,3,4].map(i => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${i < score ? colors[score - 1] : 'bg-white/10'}`}
          />
        ))}
      </div>
      <p className={`text-[10px] font-mono uppercase tracking-wider ${score >= 4 ? 'text-emerald-400' : 'text-white/40'}`}>
        {labels[score]}
        {score < 4 && score > 0 && ' — use 12+ chars, symbols, numbers'}
      </p>
    </div>
  )
}

// ── First-run bootstrap form (sovereign mode, no admin account yet) ────────
function BootstrapForm({
  onSuccess,
}: {
  onSuccess: () => void
}) {
  const { bootstrapAdmin } = useAuth() as any
  const { toast } = useToast()
  const [username, setUsername] = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 12) {
      toast({ title: 'Password Too Short', description: 'Use at least 12 characters.', variant: 'destructive' })
      return
    }
    if (password !== confirm) {
      toast({ title: 'Passwords Do Not Match', description: 'Re-enter the same password in both fields.', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const { error } = await bootstrapAdmin(username, email, password)
      if (error) {
        toast({ title: 'Setup Failed', description: error.message, variant: 'destructive' })
      } else {
        toast({ title: 'Admin Account Created', description: `Welcome, ${username}.`, variant: 'default' })
        onSuccess()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white/[0.04] border border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl shadow-2xl shadow-black/40">
      <div className="px-6 pt-6 pb-2">
        <h2 className="text-base font-semibold text-white">Create the First Admin Account</h2>
        <p className="text-xs text-[#6b8aaa] mt-1.5 leading-relaxed">
          This sovereign install has no admin account yet. This account is created locally
          (on-premise SQLite — zero external calls) and is the one-time setup step. This form
          stops working once an account exists.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="px-6 pb-6 pt-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-[#6b8aaa] mb-1.5 uppercase tracking-wider">Username</label>
          <input
            type="text" value={username} onChange={e => setUsername(e.target.value)} required
            placeholder="ciso1"
            className="w-full h-10 px-3.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/25
              focus:outline-none focus:border-[#1a9fe8]/60 focus:bg-white/8 transition-all"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#6b8aaa] mb-1.5 uppercase tracking-wider">Email</label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)} required
            placeholder="ciso@yourorg.mil"
            className="w-full h-10 px-3.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/25
              focus:outline-none focus:border-[#1a9fe8]/60 focus:bg-white/8 transition-all"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#6b8aaa] mb-1.5 uppercase tracking-wider">Password</label>
          <div className="relative">
            <input
              type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
              placeholder="12+ characters"
              className="w-full h-10 px-3.5 pr-10 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/25
                focus:outline-none focus:border-[#1a9fe8]/60 focus:bg-white/8 transition-all font-mono"
            />
            <button type="button" tabIndex={-1} onClick={() => setShowPass(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b8aaa] hover:text-white transition-colors">
              {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <PasswordStrength password={password} />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#6b8aaa] mb-1.5 uppercase tracking-wider">Confirm Password</label>
          <input
            type={showPass ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} required
            placeholder="Re-enter password"
            className="w-full h-10 px-3.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/25
              focus:outline-none focus:border-[#1a9fe8]/60 focus:bg-white/8 transition-all font-mono"
          />
        </div>
        <button
          type="submit" disabled={loading}
          className="w-full h-11 rounded-lg bg-gradient-to-r from-[#1a9fe8] to-[#0d4f7a] text-sm font-semibold text-white
            hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
          {loading ? 'Creating Account…' : 'Create Admin Account'}
        </button>
      </form>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
type AuthTab = 'sign-in' | 'sign-up'

const Auth = () => {
  const [searchParams] = useSearchParams()
  const navigate       = useNavigate()
  const { toast }      = useToast()
  const {
    signIn, signUp, signInWithOAuth, signInWithSSO, user, isSaasMode,
    checkNeedsBootstrap,
  } = useAuth() as any

  const { validateInput, trackAuthAttempt, isAccountLocked, getLockoutTimeRemaining, checkPasswordStrength }
    = useSecurityHardening()

  const [tab,         setTab]         = useState<AuthTab>(searchParams.get('mode') === 'signup' ? 'sign-up' : 'sign-in')
  const [showReset,   setShowReset]   = useState(searchParams.get('mode') === 'reset')
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [fullName,    setFullName]    = useState('')
  const [org,         setOrg]         = useState('')
  const [ssoDomain,   setSsoDomain]   = useState('')
  const [showPass,    setShowPass]    = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [oauthLoading, setOAuthLoading] = useState<string | null>(null)
  const [showSSO,     setShowSSO]     = useState(false)
  const [timerTick,   setTimerTick]   = useState(0)
  const [needsBootstrap, setNeedsBootstrap] = useState(false)
  const [bootstrapChecked, setBootstrapChecked] = useState(false)

  // Redirect if already authed
  useEffect(() => { if (user) navigate('/dashboard') }, [user])

  // Sovereign-mode-only: detect a fresh install with no admin account yet,
  // and show the bootstrap form instead of the normal login form.
  useEffect(() => {
    if (isSaasMode !== false) { setBootstrapChecked(true); return }
    checkNeedsBootstrap()
      .then(setNeedsBootstrap)
      .finally(() => setBootstrapChecked(true))
  }, [isSaasMode])

  // Lockout timer
  useEffect(() => {
    if (!isAccountLocked()) return
    const t = setInterval(() => setTimerTick(p => p + 1), 1000)
    return () => clearInterval(t)
  }, [isAccountLocked()])

  // ── OAuth ──────────────────────────────────────────────────────────────
  const handleOAuth = async (provider: string, label: string) => {
    if (!isSaasMode) {
      toast({ title: 'Cloud Mode Required', description: 'Social login requires souhimbou.ai cloud. Use your license key for sovereign mode.', variant: 'destructive' })
      return
    }
    setOAuthLoading(provider)
    try {
      const { error } = await signInWithOAuth(provider)
      if (error) toast({ title: `${label} Sign In Failed`, description: error.message, variant: 'destructive' })
    } finally {
      setOAuthLoading(null)
    }
  }

  // ── Enterprise SSO ──────────────────────────────────────────────────────
  const handleSSO = async () => {
    if (!ssoDomain.trim()) return
    setLoading(true)
    try {
      const { error } = await signInWithSSO(ssoDomain.trim())
      if (error) toast({ title: 'SSO Failed', description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  // ── Email submit ────────────────────────────────────────────────────────
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isAccountLocked()) {
      const s = Math.ceil(getLockoutTimeRemaining() / 1000)
      toast({ title: 'Account Locked', description: `Try again in ${s}s.`, variant: 'destructive' })
      return
    }
    const ev = validateInput(email, 'email')
    if (!ev.isValid) { toast({ title: 'Invalid Email', description: ev.error, variant: 'destructive' }); return }

    setLoading(true)
    try {
      if (tab === 'sign-in') {
        const { error } = await signIn(email, password)
        if (error) {
          await trackAuthAttempt(false, email, { ts: new Date().toISOString() })
          toast({ title: 'Authentication Failed', description: error.message, variant: 'destructive' })
        } else {
          await trackAuthAttempt(true, email, {})
          navigate('/dashboard')
        }
      } else {
        const { error } = await signUp(email, password, { full_name: fullName, organization: org })
        if (error) {
          toast({ title: 'Registration Failed', description: error.message, variant: 'destructive' })
        } else {
          toast({ title: 'Check Your Email', description: 'We sent a confirmation link. Click it to activate your account.', variant: 'default' })
          setTab('sign-in')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const locked = isAccountLocked()
  const psData = checkPasswordStrength(password)

  return (
    <div className="min-h-screen bg-[#050c16] flex flex-col relative overflow-hidden" style={{ fontFamily: "'Inter', 'JetBrains Mono', sans-serif" }}>

      {/* ── Background effects ──────────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full bg-[#1a4f7a]/15 blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[300px] rounded-full bg-[#e5a54b]/5 blur-[100px]" />
        <div className="absolute top-0 right-0 w-[300px] h-[200px] rounded-full bg-[#06b6d4]/5 blur-[80px]" />
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'linear-gradient(rgba(26,159,232,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(26,159,232,.5) 1px,transparent 1px)', backgroundSize: '40px 40px' }} />
      </div>

      {/* ── Classification banner ───────────────────────────────────── */}
      <div className="relative z-50 flex items-center justify-center h-7 bg-[#1a4f7a]/80 backdrop-blur-sm border-b border-[#1a9fe8]/20">
        <span className="font-mono text-[10px] text-[#6b8aaa] tracking-[3px] uppercase">
          Unclassified // Open Source // NouchiX SecRed
        </span>
      </div>

      {/* ── Main content ────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md relative">

          {/* Brand header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="relative">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1a9fe8] to-[#0d4f7a] flex items-center justify-center shadow-lg shadow-[#1a9fe8]/20">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#050c16]" />
              </div>
              <div className="text-left">
                <div className="text-xl font-bold text-white tracking-tight">SouHimBou AI</div>
                <div className="text-[10px] font-mono text-[#6b8aaa] tracking-[2px] uppercase">Flight Recorder</div>
              </div>
            </div>
            <p className="text-sm text-[#6b8aaa] max-w-xs mx-auto leading-relaxed">
              Post-Quantum AI Agent Security · CMMC Autopilot · STIG-First Compliance
            </p>
          </div>

          {/* ── Auth card ────────────────────────────────────────────── */}
          {!bootstrapChecked ? (
            <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-10 backdrop-blur-xl flex items-center justify-center">
              <Loader2 className="h-6 w-6 text-[#1a9fe8] animate-spin" />
            </div>
          ) : needsBootstrap ? (
            <BootstrapForm onSuccess={() => navigate('/dashboard')} />
          ) : showReset ? (
            <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
              <PasswordResetOTP
                onBack={() => setShowReset(false)}
                onSuccess={() => { setShowReset(false); setTab('sign-in') }}
              />
            </div>
          ) : (
            <div className="bg-white/[0.04] border border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl shadow-2xl shadow-black/40">

              {/* Tab switcher */}
              <div className="flex border-b border-white/[0.06]">
                {(['sign-in', 'sign-up'] as AuthTab[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`flex-1 py-3.5 text-sm font-semibold tracking-wide transition-all duration-200
                      ${tab === t
                        ? 'text-white border-b-2 border-[#1a9fe8] -mb-px bg-[#1a9fe8]/5'
                        : 'text-[#6b8aaa] hover:text-white/70'}`}
                  >
                    {t === 'sign-in' ? 'Sign In' : 'Create Account'}
                  </button>
                ))}
              </div>

              <div className="p-6 space-y-4">
                {/* ── Lockout warning ─────────────────────────────────── */}
                {locked && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
                    <Lock className="h-4 w-4 flex-shrink-0" />
                    <span className="text-xs">Account locked — try again in {Math.ceil(getLockoutTimeRemaining() / 1000)}s</span>
                  </div>
                )}

                {/* ── OAuth buttons (cloud only) ───────────────────────── */}
                {(isSaasMode !== false) && (
                  <div className="space-y-2.5">
                    <OAuthButton
                      icon={oauthLoading === 'google' ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
                      label="Continue with Google"
                      onClick={() => handleOAuth('google', 'Google')}
                      disabled={!!oauthLoading || locked}
                    />
                    <OAuthButton
                      icon={oauthLoading === 'github' ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitHubIcon />}
                      label="Continue with GitHub"
                      onClick={() => handleOAuth('github', 'GitHub')}
                      disabled={!!oauthLoading || locked}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <OAuthButton
                        icon={oauthLoading === 'linkedin_oidc' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LinkedInIcon />}
                        label="LinkedIn"
                        onClick={() => handleOAuth('linkedin_oidc', 'LinkedIn')}
                        disabled={!!oauthLoading || locked}
                      />
                      <OAuthButton
                        icon={oauthLoading === 'azure' ? <Loader2 className="h-4 w-4 animate-spin" /> : <MicrosoftIcon />}
                        label="Microsoft"
                        onClick={() => handleOAuth('azure', 'Microsoft')}
                        disabled={!!oauthLoading || locked}
                      />
                    </div>

                    {/* Divider */}
                    <div className="flex items-center gap-3 py-1">
                      <div className="flex-1 h-px bg-white/10" />
                      <span className="text-[11px] font-mono text-[#6b8aaa] uppercase tracking-widest">or</span>
                      <div className="flex-1 h-px bg-white/10" />
                    </div>
                  </div>
                )}

                {/* ── Email / Password form ────────────────────────────── */}
                <form onSubmit={handleEmailSubmit} className="space-y-3.5">
                  {tab === 'sign-up' && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-[#6b8aaa] mb-1.5 uppercase tracking-wider">Full Name</label>
                        <input
                          value={fullName}
                          onChange={e => setFullName(e.target.value)}
                          placeholder="Dr. Jane Smith"
                          required
                          className="w-full h-10 px-3.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/25
                            focus:outline-none focus:border-[#1a9fe8]/60 focus:bg-white/8 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#6b8aaa] mb-1.5 uppercase tracking-wider">Organization</label>
                        <input
                          value={org}
                          onChange={e => setOrg(e.target.value)}
                          placeholder="ACME Defense Corp"
                          className="w-full h-10 px-3.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/25
                            focus:outline-none focus:border-[#1a9fe8]/60 transition-all"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-[#6b8aaa] mb-1.5 uppercase tracking-wider">
                      <span className="flex items-center gap-1.5"><Mail className="h-3 w-3" />Email</span>
                    </label>
                    <input
                      id="auth-email"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@agency.gov"
                      required
                      autoComplete="email"
                      className="w-full h-10 px-3.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/25
                        focus:outline-none focus:border-[#1a9fe8]/60 focus:bg-white/8 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#6b8aaa] mb-1.5 uppercase tracking-wider">
                      <span className="flex items-center gap-1.5"><Lock className="h-3 w-3" />
                        Password
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        id="auth-password"
                        type={showPass ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        required
                        autoComplete={tab === 'sign-in' ? 'current-password' : 'new-password'}
                        className="w-full h-10 px-3.5 pr-10 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/25
                          focus:outline-none focus:border-[#1a9fe8]/60 focus:bg-white/8 transition-all font-mono"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPass(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b8aaa] hover:text-white transition-colors"
                      >
                        {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {tab === 'sign-up' && <PasswordStrength password={password} />}
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading || locked}
                    className="w-full h-11 rounded-lg font-semibold text-sm
                      bg-gradient-to-r from-[#1a4f7a] to-[#1a9fe8]
                      hover:from-[#1a5a8a] hover:to-[#2aafff]
                      text-white shadow-lg shadow-[#1a9fe8]/20
                      transition-all duration-200 flex items-center justify-center gap-2
                      disabled:opacity-50 disabled:cursor-not-allowed mt-1"
                  >
                    {loading ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> {tab === 'sign-in' ? 'Authenticating…' : 'Creating account…'}</>
                    ) : (
                      <><Shield className="h-4 w-4" />{tab === 'sign-in' ? 'Sign In Securely' : 'Create Account'}<ArrowRight className="h-4 w-4" /></>
                    )}
                  </button>

                  {tab === 'sign-in' && (
                    <button
                      type="button"
                      onClick={() => setShowReset(true)}
                      className="w-full text-center text-xs text-[#6b8aaa] hover:text-[#1a9fe8] transition-colors py-1"
                    >
                      Forgot password?
                    </button>
                  )}
                </form>

                {/* ── Enterprise SSO ────────────────────────────────────── */}
                {(isSaasMode !== false) && (
                  <div className="pt-1">
                    <button
                      onClick={() => setShowSSO(s => !s)}
                      className="flex items-center gap-2 text-xs text-[#6b8aaa] hover:text-white transition-colors w-full py-1"
                    >
                      <Building2 className="h-3.5 w-3.5" />
                      <span>Enterprise SSO (SAML)</span>
                      <ChevronRight className={`h-3.5 w-3.5 ml-auto transition-transform ${showSSO ? 'rotate-90' : ''}`} />
                    </button>
                    {showSSO && (
                      <div className="mt-2 flex gap-2">
                        <input
                          value={ssoDomain}
                          onChange={e => setSsoDomain(e.target.value)}
                          placeholder="yourcompany.gov"
                          className="flex-1 h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/25
                            focus:outline-none focus:border-[#e5a54b]/60 transition-all"
                          onKeyDown={e => e.key === 'Enter' && handleSSO()}
                        />
                        <button
                          onClick={handleSSO}
                          disabled={loading || !ssoDomain.trim()}
                          className="px-3 h-9 rounded-lg bg-[#e5a54b]/20 hover:bg-[#e5a54b]/30 border border-[#e5a54b]/30 text-[#e5a54b] text-sm font-medium transition-all disabled:opacity-50"
                        >
                          Connect
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Footer ──────────────────────────────────────────────── */}
          <div className="text-center mt-6 space-y-1">
            <p className="text-[10px] font-mono text-[#3d5a78] tracking-wider">
              ISSUED BY · SGT KONE · 255th · SDVOSB · SecRed Knowledge Inc.
            </p>
            <div className="flex items-center justify-center gap-3 text-[10px] text-[#3d5a78]">
              <a href="https://nouchix.com/legal" target="_blank" rel="noreferrer" className="hover:text-[#6b8aaa] transition-colors">Terms</a>
              <span>·</span>
              <a href="https://nouchix.com/privacy" target="_blank" rel="noreferrer" className="hover:text-[#6b8aaa] transition-colors">Privacy</a>
              <span>·</span>
              <a href="https://nouchix.com/security" target="_blank" rel="noreferrer" className="hover:text-[#6b8aaa] transition-colors">Security</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Auth