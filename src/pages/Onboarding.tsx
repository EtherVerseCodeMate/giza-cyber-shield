/**
 * src/pages/Onboarding.tsx
 * SouHimBou AI · First-time user onboarding wizard
 * NouchiX SecRed Knowledge Inc.
 *
 * Steps:
 *   1. Welcome + profile setup (name, org, role)
 *   2. Organization tier (Individual / Team / Enterprise / DoD)
 *   3. Security clearance declaration
 *   4. Choose your path (CMMC / STIG / Flight Recorder / Full Suite)
 *   5. Completion — emit event, redirect to dashboard
 */
'use client'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import {
  Shield, Building2, Lock, CheckCircle, ChevronRight,
  ChevronLeft, Loader2, Star, Zap, Globe, Fingerprint,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────
type Clearance = 'UNCLASSIFIED' | 'CUI' | 'CONFIDENTIAL' | 'SECRET' | 'TOP_SECRET'
type OrgTier   = 'individual' | 'smb' | 'enterprise' | 'dod' | 'mssp'
type UsePath   = 'cmmc' | 'stig' | 'flight_recorder' | 'full_suite'

interface OnboardingState {
  fullName:    string
  orgName:     string
  jobTitle:    string
  clearance:   Clearance
  orgTier:     OrgTier | ''
  usePath:     UsePath | ''
}

// ── Step components ────────────────────────────────────────────────────────

const STEPS = ['Profile', 'Organization', 'Clearance', 'Mission', 'Launch']

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div className={`flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold transition-all duration-300
            ${i < current ? 'bg-emerald-400 text-black' : i === current ? 'bg-[#1a9fe8] text-white ring-2 ring-[#1a9fe8]/30' : 'bg-white/10 text-[#6b8aaa]'}`}>
            {i < current ? <CheckCircle className="h-4 w-4" /> : i + 1}
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-10 h-0.5 transition-all duration-500 ${i < current ? 'bg-emerald-400' : 'bg-white/10'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

function FieldInput({ label, value, onChange, placeholder, type = 'text', required }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#6b8aaa] mb-1.5 uppercase tracking-wider">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full h-11 px-4 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/20
          focus:outline-none focus:border-[#1a9fe8]/60 focus:bg-white/8 transition-all"
      />
    </div>
  )
}

function SelectCard<T extends string>({
  value, options, onSelect,
}: {
  value: T | '';
  options: { value: T; label: string; desc: string; icon: React.ReactNode; color: string }[];
  onSelect: (v: T) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2.5">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onSelect(opt.value)}
          className={`group relative flex items-start gap-4 p-4 rounded-xl border text-left transition-all duration-200
            ${value === opt.value
              ? `border-[${opt.color}]/60 bg-[${opt.color}]/10 ring-1 ring-[${opt.color}]/30`
              : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'}`}
          style={value === opt.value ? { borderColor: opt.color + '60', backgroundColor: opt.color + '15' } : {}}
        >
          <div className="flex-shrink-0 mt-0.5" style={{ color: value === opt.value ? opt.color : '#6b8aaa' }}>
            {opt.icon}
          </div>
          <div>
            <div className="font-semibold text-sm text-white">{opt.label}</div>
            <div className="text-xs text-[#6b8aaa] mt-0.5 leading-relaxed">{opt.desc}</div>
          </div>
          {value === opt.value && (
            <CheckCircle className="absolute top-3 right-3 h-4 w-4 text-emerald-400" />
          )}
        </button>
      ))}
    </div>
  )
}

// ── Main wizard ────────────────────────────────────────────────────────────
const Onboarding = () => {
  const navigate      = useNavigate()
  const { user }      = useAuth() as any
  const { toast }     = useToast()
  const [step,        setStep]    = useState(0)
  const [loading,     setLoading] = useState(false)
  const [form, setForm] = useState<OnboardingState>({
    fullName:  user?.user_metadata?.full_name ?? '',
    orgName:   user?.user_metadata?.organization ?? '',
    jobTitle:  '',
    clearance: 'UNCLASSIFIED',
    orgTier:   '',
    usePath:   '',
  })

  const upd = <K extends keyof OnboardingState>(k: K, v: OnboardingState[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  const canAdvance = () => {
    if (step === 0) return form.fullName.trim().length > 1
    if (step === 1) return form.orgTier !== ''
    if (step === 2) return true
    if (step === 3) return form.usePath !== ''
    return true
  }

  const finish = async () => {
    setLoading(true)
    try {
      if (user) {
        // Upsert profile
        await supabase.from('user_profiles').upsert({
          id:                  user.id,
          full_name:           form.fullName,
          organization:        form.orgName,
          job_title:           form.jobTitle,
          security_clearance:  form.clearance,
          org_tier:            form.orgTier,
          use_path:            form.usePath,
          onboarding_complete: true,
          updated_at:          new Date().toISOString(),
        })
      }
      toast({ title: 'Mission Control Activated', description: 'Your SouHimBou AI workspace is ready.' })
      navigate('/dashboard')
    } catch (err: any) {
      toast({ title: 'Setup Error', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const orgTierOptions: Parameters<typeof SelectCard<OrgTier>>[0]['options'] = [
    { value: 'individual', label: 'Individual / Researcher', desc: 'Solo practitioner, academic, or consultant', icon: <Star className="h-5 w-5" />, color: '#818cf8' },
    { value: 'smb',        label: 'Small Business (1–50 staff)', desc: 'SMB pursuing CMMC L1/L2 certification', icon: <Building2 className="h-5 w-5" />, color: '#e5a54b' },
    { value: 'enterprise', label: 'Enterprise (50+ staff)', desc: 'Large contractor or commercial enterprise', icon: <Globe className="h-5 w-5" />, color: '#1a9fe8' },
    { value: 'dod',        label: 'DoD / Government Agency', desc: 'Federal agency, military branch, or prime contractor', icon: <Shield className="h-5 w-5" />, color: '#06b6d4' },
    { value: 'mssp',       label: 'MSSP / Consulting Partner', desc: 'Delivering compliance services to multiple clients', icon: <Zap className="h-5 w-5" />, color: '#22c55e' },
  ]

  const clearanceOptions: Clearance[] = ['UNCLASSIFIED', 'CUI', 'CONFIDENTIAL', 'SECRET', 'TOP_SECRET']
  const clearanceColors: Record<Clearance, string> = {
    UNCLASSIFIED: '#22c55e', CUI: '#1a9fe8', CONFIDENTIAL: '#818cf8', SECRET: '#f97316', TOP_SECRET: '#cc2a36'
  }

  const pathOptions: Parameters<typeof SelectCard<UsePath>>[0]['options'] = [
    { value: 'cmmc',            label: 'CMMC Autopilot',       desc: 'CMMC L1/L2/L3 gap analysis and remediation automation', icon: <Shield className="h-5 w-5" />, color: '#1a9fe8' },
    { value: 'stig',            label: 'STIG Compliance',      desc: 'DISA STIG checks, findings, and evidence collection', icon: <CheckCircle className="h-5 w-5" />, color: '#22c55e' },
    { value: 'flight_recorder', label: 'AI Flight Recorder',   desc: 'Monitor, audit, and attest AI agent behavior in real-time', icon: <Fingerprint className="h-5 w-5" />, color: '#06b6d4' },
    { value: 'full_suite',      label: 'Full Suite',           desc: 'CMMC + STIG + Flight Recorder + PQC encryption — TRL10', icon: <Zap className="h-5 w-5" />, color: '#e5a54b' },
  ]

  const steps = [
    // Step 0 — Profile
    <div key="profile" className="space-y-4">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-white">Let's set up your profile</h2>
        <p className="text-sm text-[#6b8aaa] mt-1">This helps personalize your compliance mission</p>
      </div>
      <FieldInput label="Full Name" value={form.fullName} onChange={v => upd('fullName', v)} placeholder="Dr. Jane Smith" required />
      <FieldInput label="Organization" value={form.orgName} onChange={v => upd('orgName', v)} placeholder="ACME Defense Corp" />
      <FieldInput label="Job Title" value={form.jobTitle} onChange={v => upd('jobTitle', v)} placeholder="CISO / Compliance Manager" />
    </div>,

    // Step 1 — Org tier
    <div key="org" className="space-y-4">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-white">How does your team operate?</h2>
        <p className="text-sm text-[#6b8aaa] mt-1">We'll tailor your experience and pricing</p>
      </div>
      <SelectCard<OrgTier> value={form.orgTier} options={orgTierOptions} onSelect={v => upd('orgTier', v)} />
    </div>,

    // Step 2 — Clearance
    <div key="clearance" className="space-y-4">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-white">Security clearance level</h2>
        <p className="text-sm text-[#6b8aaa] mt-1">Determines data handling and classification markings</p>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {clearanceOptions.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => upd('clearance', c)}
            className="flex items-center gap-4 p-3.5 rounded-xl border text-left transition-all duration-200"
            style={form.clearance === c
              ? { borderColor: clearanceColors[c] + '60', backgroundColor: clearanceColors[c] + '15' }
              : { borderColor: 'rgba(255,255,255,.1)', backgroundColor: 'rgba(255,255,255,.02)' }}
          >
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: clearanceColors[c] }} />
            <span className="text-sm font-mono font-semibold" style={{ color: form.clearance === c ? clearanceColors[c] : '#e0eaf5' }}>
              {c.replace('_', ' ')}
            </span>
            {form.clearance === c && <CheckCircle className="h-4 w-4 ml-auto text-emerald-400" />}
          </button>
        ))}
      </div>
    </div>,

    // Step 3 — Use path
    <div key="path" className="space-y-4">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-white">What's your primary mission?</h2>
        <p className="text-sm text-[#6b8aaa] mt-1">You can always change this later</p>
      </div>
      <SelectCard<UsePath> value={form.usePath} options={pathOptions} onSelect={v => upd('usePath', v)} />
    </div>,

    // Step 4 — Launch
    <div key="launch" className="space-y-6 text-center">
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#1a9fe8] to-[#e5a54b] flex items-center justify-center shadow-2xl shadow-[#1a9fe8]/30 animate-pulse">
          <Shield className="h-10 w-10 text-white" />
        </div>
      </div>
      <div>
        <h2 className="text-xl font-bold text-white mb-2">Mission Control Ready</h2>
        <p className="text-sm text-[#6b8aaa] leading-relaxed max-w-xs mx-auto">
          Your SouHimBou AI workspace is configured for <span className="text-[#e5a54b] font-semibold">{form.orgName || 'your organization'}</span>.
          PQC-secured. Flight Recorder standing by.
        </p>
      </div>
      <div className="text-left bg-white/[0.04] border border-white/10 rounded-xl p-4 space-y-2 text-xs font-mono">
        <div className="flex justify-between"><span className="text-[#6b8aaa]">Profile</span><span className="text-white">{form.fullName}</span></div>
        <div className="flex justify-between"><span className="text-[#6b8aaa]">Clearance</span><span style={{ color: clearanceColors[form.clearance] }}>{form.clearance}</span></div>
        <div className="flex justify-between"><span className="text-[#6b8aaa]">Tier</span><span className="text-[#e5a54b] uppercase">{form.orgTier}</span></div>
        <div className="flex justify-between"><span className="text-[#6b8aaa]">Mission</span><span className="text-[#1a9fe8] uppercase">{form.usePath.replace('_', ' ')}</span></div>
      </div>
    </div>,
  ]

  return (
    <div className="min-h-screen bg-[#050c16] flex flex-col relative overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-[#1a4f7a]/10 blur-[120px] pointer-events-none" />

      {/* Banner */}
      <div className="h-7 flex items-center justify-center bg-[#1a4f7a]/80 border-b border-[#1a9fe8]/20">
        <span className="font-mono text-[10px] text-[#6b8aaa] tracking-[3px] uppercase">
          SouHimBou AI · Onboarding · NouchiX SecRed
        </span>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg">

          {/* Brand */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-2">
              <Shield className="h-5 w-5 text-[#1a9fe8]" />
              <span className="text-sm font-bold text-white tracking-tight">SouHimBou AI</span>
            </div>
          </div>

          <StepIndicator current={step} />

          {/* Card */}
          <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-2xl">
            {steps[step]}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-3 mt-4">
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="flex items-center gap-2 px-4 h-11 rounded-lg text-sm text-[#6b8aaa] hover:text-white border border-white/10 hover:border-white/20 transition-all"
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
            )}
            <button
              onClick={step < STEPS.length - 1 ? () => setStep(s => s + 1) : finish}
              disabled={!canAdvance() || loading}
              className="flex-1 flex items-center justify-center gap-2 h-11 rounded-lg font-semibold text-sm
                bg-gradient-to-r from-[#1a4f7a] to-[#1a9fe8] hover:from-[#1a5a8a] hover:to-[#2aafff]
                text-white shadow-lg shadow-[#1a9fe8]/20 transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Setting up…</>
              ) : step < STEPS.length - 1 ? (
                <>Continue <ChevronRight className="h-4 w-4" /></>
              ) : (
                <>Launch Mission Control <Shield className="h-4 w-4" /></>
              )}
            </button>
          </div>

          {step < STEPS.length - 1 && (
            <button
              onClick={finish}
              className="w-full text-center text-xs text-[#3d5a78] hover:text-[#6b8aaa] transition-colors mt-3 py-1"
            >
              Skip setup, take me to the dashboard →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default Onboarding