import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, FormEvent, ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  BookMarked,
  CalendarCheck2,
  Check,
  Eye,
  EyeOff,
  FileCheck2,
  LockKeyhole,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Button, Field, Input } from '../components/ui'

type Mode = 'signin' | 'signup' | 'reset' | 'update'

const SIGNUP_EMAIL_KEY = 'talaarawan:last-signup-email'

const verifyCopy = {
  eyebrow: 'Account verification',
  title: 'Check your email',
  sub: 'That verification link is invalid or has expired. Request a fresh one below.',
  cta: 'Send new link',
}

/* -------------------------------------------------------------------------- */
/*  Scoped motion. No tailwind.config changes needed; everything is prefixed.  */
/*  Every animation is switched off under prefers-reduced-motion.             */
/* -------------------------------------------------------------------------- */
const motionCss = `
@keyframes aj-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes aj-settle {
  from { opacity: 0; transform: translateY(28px) rotate(-4.5deg) scale(.97); }
  to   { opacity: 1; transform: translateY(0) rotate(-1.2deg) scale(1); }
}
@keyframes aj-settle-back {
  from { opacity: 0; transform: translateY(20px) rotate(1deg); }
  to   { opacity: 1; transform: rotate(-2.2deg); }
}
@keyframes aj-fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes aj-swap { from { opacity: 0; transform: translateY(8px); filter: blur(3px); } to { opacity: 1; transform: none; filter: none; } }
@keyframes aj-shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-6px); } 40% { transform: translateX(5px); }
  60% { transform: translateX(-3px); } 80% { transform: translateX(2px); }
}
@keyframes aj-pop { from { opacity: 0; transform: translateY(-6px) scale(.98); } to { opacity: 1; transform: none; } }
@keyframes aj-drift-a { 0%,100% { transform: translate(0,0); } 50% { transform: translate(40px,30px); } }
@keyframes aj-drift-b { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-36px,24px); } }
@keyframes aj-sheen { from { transform: translateX(-120%); } to { transform: translateX(220%); } }

.aj-rise   { animation: aj-rise .7s cubic-bezier(.2,.7,.2,1) both; animation-delay: var(--d, 0ms); }
.aj-card   { animation: aj-rise .8s cubic-bezier(.2,.7,.2,1) both; animation-delay: 120ms; }
.aj-settle { animation: aj-settle 1s cubic-bezier(.2,.8,.2,1) both; animation-delay: 520ms; }
.aj-settle-back { animation: aj-settle-back 1s cubic-bezier(.2,.8,.2,1) both; animation-delay: 440ms; }
.aj-bar    { transform-origin: left; animation: aj-fill 1.4s cubic-bezier(.2,.8,.2,1) both; animation-delay: 1100ms; }
.aj-swap   { animation: aj-swap .45s cubic-bezier(.2,.7,.2,1) both; }
.aj-shake  { animation: aj-shake .45s ease-in-out both; }
.aj-pop    { animation: aj-pop .35s cubic-bezier(.2,.8,.2,1) both; }
.aj-drift-a { animation: aj-drift-a 22s ease-in-out infinite; }
.aj-drift-b { animation: aj-drift-b 28s ease-in-out infinite; }

.aj-collapse {
  display: grid; grid-template-rows: 0fr; opacity: 0; visibility: hidden;
  transition: grid-template-rows .4s cubic-bezier(.2,.7,.2,1), opacity .3s ease, visibility 0s linear .4s;
}
.aj-collapse.is-open {
  grid-template-rows: 1fr; opacity: 1; visibility: visible;
  transition: grid-template-rows .4s cubic-bezier(.2,.7,.2,1), opacity .35s ease .05s, visibility 0s;
}

.aj-tab-ink { transition: transform .4s cubic-bezier(.3,.8,.2,1); }

.aj-btn { position: relative; overflow: hidden; transition: transform .15s ease; }
.aj-btn:active:not(:disabled) { transform: scale(.985); }
.aj-btn::after {
  content: ''; position: absolute; inset: 0 auto 0 0; width: 40%;
  background: linear-gradient(100deg, transparent, rgba(255,255,255,.22), transparent);
  transform: translateX(-120%); pointer-events: none;
}
.aj-btn:hover:not(:disabled)::after { animation: aj-sheen .8s ease; }
.aj-btn .aj-arrow { transition: transform .25s ease; }
.aj-btn:hover:not(:disabled) .aj-arrow { transform: translateX(3px); }

.aj-meter-seg { transition: background-color .35s ease, transform .35s cubic-bezier(.3,.8,.2,1); transform-origin: left; }

@media (prefers-reduced-motion: reduce) {
  .aj-rise, .aj-card, .aj-settle, .aj-settle-back, .aj-bar, .aj-swap, .aj-shake, .aj-pop,
  .aj-drift-a, .aj-drift-b { animation: none !important; }
  .aj-collapse, .aj-collapse.is-open, .aj-tab-ink, .aj-meter-seg, .aj-btn { transition: none !important; }
  .aj-btn::after { display: none; }
}
`

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties

/* -------------------------------------------------------------------------- */
/*  Small building blocks                                                      */
/* -------------------------------------------------------------------------- */

/** Animated height collapse. Hidden content is removed from tab order via visibility. */
function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div className={`aj-collapse ${open ? 'is-open' : ''}`} aria-hidden={!open}>
      <div className="-mx-1 min-h-0 overflow-hidden px-1">
        <div className="pb-3.5 pt-1">{children}</div>
      </div>
    </div>
  )
}

/** Counts up once on mount. Skips animation for reduced-motion users. */
function useCountUp(target: number, duration = 1400, startDelay = 1000) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target)
      return
    }
    let frame = 0
    let start = 0
    const timer = window.setTimeout(() => {
      const tick = (now: number) => {
        if (!start) start = now
        const t = Math.min((now - start) / duration, 1)
        setValue(target * (1 - Math.pow(1 - t, 3)))
        if (t < 1) frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    }, startDelay)
    return () => {
      window.clearTimeout(timer)
      cancelAnimationFrame(frame)
    }
  }, [target, duration, startDelay])
  return value
}

function passwordScore(value: string) {
  let score = 0
  if (value.length >= 6) score++
  if (value.length >= 10) score++
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score++
  return value.length === 0 ? 0 : Math.max(score, 1)
}

const strengthMeta = [
  { label: '', bar: 'bg-paper-300', text: 'text-ink-400' },
  { label: 'Too easy to guess', bar: 'bg-clay-500', text: 'text-clay-700' },
  { label: 'Okay', bar: 'bg-amber-500', text: 'text-ink-600' },
  { label: 'Good', bar: 'bg-forest-500', text: 'text-forest-700' },
  { label: 'Strong', bar: 'bg-forest-600', text: 'text-forest-700' },
]

function StrengthMeter({ value }: { value: string }) {
  const score = passwordScore(value)
  const meta = strengthMeta[score]
  return (
    <div className="mt-2.5" aria-live="polite">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((segment) => (
          <span
            key={segment}
            className={`aj-meter-seg h-1 flex-1 rounded-full ${segment <= score ? meta.bar : 'bg-paper-200'}`}
            style={{ transitionDelay: `${(segment - 1) * 40}ms` }}
          />
        ))}
      </div>
      <p className={`mt-1.5 h-4 text-[11px] transition-colors ${meta.text}`}>{meta.label}</p>
    </div>
  )
}

function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`grid h-9 w-9 place-items-center rounded-md border font-display text-sm font-semibold ${
          dark
            ? 'border-forest-600 bg-forest-800 text-paper-50'
            : 'border-forest-800 bg-forest-900 text-paper-50'
        }`}
      >
        TA
      </span>
      <span>
        <span
          className={`block font-display text-[17px] font-semibold leading-none tracking-[-0.01em] ${
            dark ? 'text-paper-50' : 'text-ink-900'
          }`}
        >
          TalaArawan
        </span>
        <span
          className={`mt-1 block text-[9px] font-semibold uppercase tracking-[0.18em] ${
            dark ? 'text-forest-300' : 'text-ink-400'
          }`}
        >
          Philippine field notes
        </span>
      </span>
    </div>
  )
}

function JournalPreview() {
  const hours = useCountUp(182.5)
  const today = useMemo(
    () => new Date().toLocaleDateString('en-PH', { weekday: 'long', day: 'numeric', month: 'long' }),
    [],
  )

  return (
    <div className="relative mt-10 max-w-[430px]">
      <div className="aj-settle-back absolute -inset-3 rounded-lg border border-forest-700/70 bg-forest-800/40" />
      <div className="login-lines aj-settle relative rounded-lg border border-white/70 bg-paper-50/95 p-5 text-ink-900 shadow-[0_35px_80px_-35px_rgba(0,0,0,0.65)] backdrop-blur-xl sm:p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-ink-400">
              Journal entry · 058
            </p>
            <p className="mt-1 font-display text-lg font-semibold">{today}</p>
          </div>
          <span className="rounded-full border border-forest-200 bg-forest-50 px-2 py-0.5 text-[10px] font-medium text-forest-700">
            Week 12
          </span>
        </div>

        <div className="mt-5 flex items-end justify-between">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-400">
              Rendered today
            </p>
            <p className="font-display text-4xl font-semibold leading-none tracking-[-0.03em]">
              8<span className="ml-1 text-lg font-medium text-ink-500">h 00m</span>
            </p>
          </div>
          <div className="text-right text-[10px] leading-relaxed text-ink-400">
            <p>08:00 – 17:00</p>
            <p>1h lunch excluded</p>
          </div>
        </div>

        <div className="mt-4 space-y-1.5 border-t border-paper-300/70 pt-3 text-[11px] leading-relaxed text-ink-600">
          <p>
            <span className="font-semibold text-ink-800">Done.</span> Built the stock-level filter
            and checked edge cases with the supervisor.
          </p>
          <p>
            <span className="font-semibold text-ink-800">Learned.</span> Why row-level security
            belongs in the database, not only the UI.
          </p>
        </div>

        <div className="mt-4 border-t border-paper-300/70 pt-3">
          <div className="flex items-center justify-between text-[9px] text-ink-400">
            <span>OJT progress</span>
            <span className="tabular">{hours.toFixed(1)} / 300 hours</span>
          </div>
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-paper-200">
            <div className="h-full w-[61%] rounded-full bg-forest-600">
              <div className="aj-bar h-full w-full rounded-full bg-forest-600" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

const copy: Record<Mode, { eyebrow: string; title: string; sub: string; cta: string }> = {
  signin: {
    eyebrow: 'Welcome back',
    title: 'Sign in to your logbook.',
    sub: 'Your entries, hours, and reports are waiting.',
    cta: 'Sign in',
  },
  signup: {
    eyebrow: 'Get started',
    title: 'Start your OJT record.',
    sub: 'Create a private journal in under a minute.',
    cta: 'Create my journal',
  },
  reset: {
    eyebrow: 'Account help',
    title: 'Reset your password.',
    sub: 'We will email you a secure link to choose a new password.',
    cta: 'Send reset link',
  },
  update: {
    eyebrow: 'Almost there',
    title: 'Choose a new password.',
    sub: 'Your reset link is verified. Pick a password you have not used here before.',
    cta: 'Update password',
  },
}

const linkBtn = 'font-medium text-forest-700 underline-offset-2 hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600'

function isRateLimit(cause: unknown): boolean {
  const error = cause as { status?: number; message?: string } | null
  return error?.status === 429 || /429|too many|rate limit/i.test(error?.message ?? '')
}

function authErrorMessage(cause: unknown): string {
  if (isRateLimit(cause)) {
    return 'Too many requests. Please wait a few minutes before trying again.'
  }
  const error = cause as { message?: string } | null
  return error?.message || 'Something went wrong. Please try again.'
}

function friendlyLinkError(params: URLSearchParams): string | null {
  const code = params.get('error_code')
  const description = params.get('error_description')
  if (!code && !description) return null
  if (code === 'otp_expired' || /invalid or has expired/i.test(description ?? '')) {
    return 'This verification link is invalid or has expired. Request a new one below.'
  }
  return description || 'This link could not be used. Please try again.'
}

export default function AuthPage() {
  const {
    user,
    loading,
    signIn,
    signUp,
    sendPasswordReset,
    completeRecovery,
    completeConfirmation,
    updatePassword,
  } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('signin')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const type = params.get('type')
    return Boolean(
      params.get('access_token') &&
        params.get('refresh_token') &&
        (!type || type === 'recovery' || type === 'signup') &&
        !params.get('error_description'),
    )
  })
  const [confirmingEmail, setConfirmingEmail] = useState(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    return (
      params.get('type') === 'signup' &&
      Boolean(params.get('access_token') && params.get('refresh_token')) &&
      !params.get('error_description')
    )
  })
  const [error, setError] = useState<string | null>(() =>
    friendlyLinkError(new URLSearchParams(window.location.hash.replace(/^#/, ''))),
  )
  const [showResend, setShowResend] = useState(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    return params.get('error_code') === 'otp_expired'
  })
  const [resendEmail, setResendEmail] = useState(
    () => localStorage.getItem(SIGNUP_EMAIL_KEY) ?? '',
  )
  const [resendBusy, setResendBusy] = useState(false)
  const [errorKey, setErrorKey] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const submittingRef = useRef(false)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [cooldown])

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const type = params.get('type')
    const hashError = params.get('error_description') || params.get('error_code')
    if (hashError) {
      // The error state was initialized from this same hash on first render.
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
      return
    }
    if (!accessToken || !refreshToken || (type && type !== 'recovery' && type !== 'signup')) return

    let active = true
    const redeem = type === 'signup' ? completeConfirmation : completeRecovery
    redeem(accessToken, refreshToken)
      .then(() => {
        if (!active) return
        if (type === 'signup') {
          setConfirmingEmail(true)
          setNotice('Email confirmed. Your account is ready — continue to set up your journal.')
        } else {
          setMode('update')
          setNotice('Link verified. Choose a new password below.')
        }
      })
      .catch((cause: unknown) => {
        if (!active) return
        setConfirmingEmail(false)
        setError(cause instanceof Error ? cause.message : 'This link is invalid or expired.')
      })
      .finally(() => {
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
        if (active) setBusy(false)
      })
    return () => {
      active = false
    }
  }, [completeRecovery, completeConfirmation])

  if (!loading && user && mode !== 'update' && !confirmingEmail)
    return <Navigate to="/" replace />

  const text = showResend ? verifyCopy : copy[mode]
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword

  const fail = (message: string) => {
    setError(message)
    setErrorKey((key) => key + 1) // remount so the shake replays on every failure
  }

  const switchMode = (next: Mode) => {
    if (next === mode) return
    setMode(next)
    setError(null)
    setShowResend(false)
    setNotice(null)
    setConfirmPassword('')
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (submittingRef.current || cooldown > 0) return
    setError(null)
    setNotice(null)

    if (mode === 'signup' && fullName.trim().length < 2) {
      fail('Enter your full name so it appears correctly on reports.')
      return
    }
    if ((mode === 'signup' || mode === 'update') && password !== confirmPassword) {
      fail('The two passwords do not match.')
      return
    }
    if (mode !== 'reset' && password.length < 6) {
      fail('Use a password with at least 6 characters.')
      return
    }

    setBusy(true)
    submittingRef.current = true
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password)
        navigate('/', { replace: true })
      } else if (mode === 'signup') {
        const needsConfirmation = await signUp(email.trim(), password, fullName.trim())
        if (needsConfirmation) {
          localStorage.setItem(SIGNUP_EMAIL_KEY, email.trim())
          setResendEmail(email.trim())
          setNotice(
            'Account created. Check your email to confirm your address, then sign in.',
          )
          setMode('signin')
        } else {
          navigate('/', { replace: true })
        }
      } else if (mode === 'reset') {
        await sendPasswordReset(email.trim())
        setNotice(`Reset link sent to ${email.trim()}. Check your inbox for the new link.`)
      } else {
        await updatePassword(password)
        setNotice('Password updated. Sign in with your new password.')
        setPassword('')
        setConfirmPassword('')
        setMode('signin')
      }
    } catch (cause) {
      fail(authErrorMessage(cause))
      if (isRateLimit(cause)) setCooldown(60)
    } finally {
      setBusy(false)
      submittingRef.current = false
    }
  }

  const handleResend = async (event: FormEvent) => {
    event.preventDefault()
    const address = resendEmail.trim()
    if (!address || resendBusy || cooldown > 0) return
    setResendBusy(true)
    setError(null)
    setNotice(null)
    try {
      const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: address })
      if (resendError) throw resendError
      localStorage.setItem(SIGNUP_EMAIL_KEY, address)
      setShowResend(false)
      setNotice('A new verification email is on its way. Check your inbox and spam folder.')
      setCooldown(60)
    } catch (cause) {
      fail(authErrorMessage(cause))
      if (isRateLimit(cause)) setCooldown(60)
    } finally {
      setResendBusy(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-paper-50 lg:grid lg:grid-cols-[1.06fr_1fr]">
      <style>{motionCss}</style>

      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
        <div className="aj-drift-a absolute -left-24 top-[-12%] h-[34rem] w-[34rem] rounded-full bg-forest-300/25 blur-3xl" />
        <div className="aj-drift-b absolute right-[-10%] top-[10%] h-[28rem] w-[28rem] rounded-full bg-paper-300/40 blur-3xl" />
        <div className="aj-drift-a absolute bottom-[-16%] left-[35%] h-[30rem] w-[30rem] rounded-full bg-forest-200/25 blur-3xl" />
      </div>

      {/* Editorial panel */}
      <section className="paper-lines relative hidden flex-col justify-between overflow-hidden bg-forest-900 p-10 text-paper-50 lg:flex xl:p-14">
        <div
          className="aj-drift-b pointer-events-none absolute -right-24 top-1/4 h-[26rem] w-[26rem] rounded-full bg-forest-500/25 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="aj-drift-a pointer-events-none absolute -left-20 bottom-[-8%] h-[22rem] w-[22rem] rounded-full bg-forest-400/15 blur-3xl"
          aria-hidden="true"
        />

        <div className="aj-rise" style={delay(0)}>
          <Brand dark />
        </div>

        <div className="max-w-xl py-10">
          <p
            className="aj-rise text-[10px] font-semibold uppercase tracking-[0.22em] text-forest-300"
            style={delay(120)}
          >
            A private record of your training
          </p>
          <h1
            className="aj-rise mt-4 font-display text-[2.9rem] font-semibold leading-[1.03] tracking-[-0.03em] text-paper-50 xl:text-[3.4rem]"
            style={delay(220)}
          >
            The work you do deserves a proper record.
          </h1>
          <p
            className="aj-rise mt-5 max-w-md text-[15px] leading-relaxed text-forest-100/85"
            style={delay(340)}
          >
            Log the hours. Keep the details that matter. See exactly when your OJT ends, with
            Philippine holidays already accounted for.
          </p>
          <JournalPreview />
        </div>

        <div
          className="aj-rise grid max-w-xl grid-cols-3 gap-5 border-t border-forest-700/80 pt-6 text-[11px] leading-relaxed text-forest-200/90"
          style={delay(900)}
        >
          <div className="flex gap-2">
            <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-forest-300" />
            <span>Private by default</span>
          </div>
          <div className="flex gap-2">
            <CalendarCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-forest-300" />
            <span>Holiday-aware estimates</span>
          </div>
          <div className="flex gap-2">
            <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-forest-300" />
            <span>Print-ready reports</span>
          </div>
        </div>
      </section>

      {/* Form panel */}
      <section className="relative flex min-h-screen flex-col px-5 py-7 sm:px-10 lg:px-12 xl:px-16">
        <div className="lg:hidden">
          <Brand />
        </div>

        <div className="flex flex-1 items-center py-10 lg:py-6">
          <div className="aj-card mx-auto w-full max-w-[430px] rounded-[1.5rem] border border-white/70 bg-white/60 p-5 shadow-[0_32px_90px_-45px_rgba(34,53,42,0.5)] backdrop-blur-2xl sm:p-7">
            {/* Heading swaps with a soft blur-in when the mode changes */}
            <div key={mode} className="aj-swap">
              <p className="eyebrow">{text.eyebrow}</p>
              <h2 className="mt-2 font-display text-[2rem] font-semibold leading-tight tracking-[-0.02em] text-ink-900">
                {text.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-500">{text.sub}</p>
            </div>

            {/* Tabs with a sliding underline */}
            <Collapse open={!showResend && (mode === 'signin' || mode === 'signup')}>
              <div className="relative mt-4 grid grid-cols-2 border-b border-paper-300" role="tablist">
                {(['signin', 'signup'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={mode === tab}
                    onClick={() => switchMode(tab)}
                    className={`pb-2.5 text-sm font-medium transition-colors focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600 ${
                      mode === tab ? 'text-ink-900' : 'text-ink-400 hover:text-ink-700'
                    }`}
                  >
                    {tab === 'signin' ? 'Sign in' : 'Create account'}
                  </button>
                ))}
                <span
                  aria-hidden="true"
                  className="aj-tab-ink absolute -bottom-px left-0 h-0.5 w-1/2 bg-ink-900"
                  style={{ transform: mode === 'signup' ? 'translateX(100%)' : 'translateX(0)' }}
                />
              </div>
            </Collapse>

            <Collapse open={mode === 'reset'}>
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-forest-700 hover:underline"
              >
                <ArrowRight className="h-3.5 w-3.5 rotate-180" /> Back to sign in
              </button>
            </Collapse>

            {notice && (
              <div
                key={notice}
                role="status"
                className="aj-pop mb-4 flex gap-2.5 rounded-lg border border-forest-200 bg-forest-50 px-3.5 py-3 text-[13px] leading-relaxed text-forest-800"
              >
                <Check className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{notice}</span>
              </div>
            )}
            {error && !showResend && (
              <div
                key={errorKey}
                role="alert"
                className="aj-shake mb-4 flex gap-2.5 rounded-lg border border-clay-200 bg-clay-50 px-3.5 py-3 text-[13px] leading-relaxed text-clay-700"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {showResend && (
              <div className="aj-pop mb-4 rounded-xl border border-forest-200 bg-forest-50/60 p-4">
                <p className="text-[13px] font-semibold text-ink-900">Resend verification email</p>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-500">
                  Enter the email you signed up with and we&rsquo;ll send a fresh link. Links expire
                  and can be used only once — opening them twice (including link scanners) makes
                  them invalid.
                </p>
                <form onSubmit={handleResend} className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Input
                    type="email"
                    required
                    value={resendEmail}
                    onChange={(event) => setResendEmail(event.target.value)}
                    placeholder="you@example.com"
                    aria-label="Email address for a new verification link"
                  />
                  <Button type="submit" loading={resendBusy || cooldown > 0} className="shrink-0">
                    Send new link
                  </Button>
                </form>
                {cooldown > 0 && (
                  <p className="mt-2 text-[11px] text-ink-400">
                    You can send another link in {cooldown}s.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowResend(false)
                    setError(null)
                    setNotice(null)
                  }}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-forest-700 hover:underline"
                >
                  <ArrowRight className="h-3.5 w-3.5 rotate-180" /> Back to sign in
                </button>
              </div>
            )}

            {confirmingEmail && (
              <div className="aj-pop mt-4 rounded-xl border border-forest-200 bg-forest-50/70 px-4 py-5 text-center">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-forest-900 text-paper-50">
                  <Check className="h-6 w-6" />
                </span>
                <p className="mt-3 font-display text-xl font-semibold text-ink-900">
                  Email confirmed
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
                  Your address is verified. Continue to finish setting up your journal.
                </p>
                <Button
                  type="button"
                  className="mt-4 w-full"
                  loading={busy}
                  onClick={() => navigate('/', { replace: true })}
                >
                  Continue to your journal <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {!showResend && (
            <form
              onSubmit={handleSubmit}
              className={`mt-2 ${confirmingEmail ? 'hidden' : ''}`}
              noValidate={false}
            >
              <Collapse open={mode === 'signup'}>
                <Field label="Full name" htmlFor="fullName" required>
                  <Input
                    id="fullName"
                    autoComplete="name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Juan Dela Cruz"
                  />
                </Field>
              </Collapse>

              <Collapse open={mode !== 'update'}>
                <Field label="Email address" htmlFor="email" required>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    required={mode !== 'update'}
                    disabled={mode === 'update'}
                  />
                </Field>
              </Collapse>

              <Collapse open={mode !== 'reset'}>
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label htmlFor="password" className="field-label">
                      {mode === 'update' ? 'New password' : 'Password'}{' '}
                      <span className="ml-1 text-clay-500">*</span>
                    </label>
                    {mode === 'signin' && (
                      <button
                        type="button"
                        onClick={() => switchMode('reset')}
                        className="text-[11px] font-medium text-forest-700 hover:underline"
                      >
                        Forgot?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder={
                        mode === 'signup' || mode === 'update'
                          ? 'At least 6 characters'
                          : '••••••••'
                      }
                      className="pr-11"
                      required={mode !== 'reset'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-2 text-ink-400 transition-colors hover:bg-paper-100 hover:text-ink-700"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {(mode === 'signup' || mode === 'update') && <StrengthMeter value={password} />}
                </div>
              </Collapse>

              <Collapse open={mode === 'signup' || mode === 'update'}>
                <Field label="Confirm password" htmlFor="confirmPassword" required>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Type it again"
                      className="pr-10"
                      required={mode === 'signup' || mode === 'update'}
                    />
                    <span
                      aria-hidden="true"
                      className={`absolute right-3 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full bg-forest-600 text-white transition-all duration-300 ${
                        passwordsMatch ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
                      }`}
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  </div>
                </Field>
              </Collapse>

              <Button
                type="submit"
                className="aj-btn w-full"
                loading={busy}
                disabled={cooldown > 0}
              >
                <span key={mode} className="aj-swap inline-flex items-center gap-2">
                  {cooldown > 0 ? `Try again in ${cooldown}s` : text.cta}
                  {!busy && cooldown === 0 && <ArrowRight className="aj-arrow h-4 w-4" />}
                </span>
              </Button>
            </form>
            )}

            {!showResend && (
            <p className="mt-5 text-center text-[13px] text-ink-500">
              <span key={mode} className="aj-swap inline-block">
                {mode === 'signin' ? (
                  <>
                    New here?{' '}
                    <button type="button" onClick={() => switchMode('signup')} className={linkBtn}>
                      Create an account
                    </button>
                  </>
                ) : mode === 'signup' ? (
                  <>
                    Already keeping a journal?{' '}
                    <button type="button" onClick={() => switchMode('signin')} className={linkBtn}>
                      Sign in
                    </button>
                  </>
                ) : (
                  <>
                    Remembered it?{' '}
                    <button type="button" onClick={() => switchMode('signin')} className={linkBtn}>
                      Return to sign in
                    </button>
                  </>
                )}
              </span>
            </p>
            )}

            <div className="mt-8 flex items-start gap-2 border-t border-paper-200 pt-4 text-[11px] leading-relaxed text-ink-400">
              <BookMarked className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>
                Your entries are private. Supabase row-level security means only your account can
                read or change them.
              </p>
            </div>
          </div>
        </div>

        <p className="text-center text-[10px] uppercase tracking-[0.16em] text-ink-300">
          TalaArawan · Made for Philippine OJT students
        </p>
      </section>
    </div>
  )
}