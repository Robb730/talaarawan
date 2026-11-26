import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  CalendarClock,
  CalendarDays,
  Check,
  FileText,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  PenLine,
  Plus,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useOjtEstimate } from '../hooks/useOjtEstimate'
import { todayISO } from '../lib/date'
import { formatHours } from '../lib/hours'
import { isSupabaseConfigured } from '../lib/supabase'
import { CompletionEstimate } from './CompletionEstimate'
import OnboardingPage from '../pages/OnboardingPage'
import { Button, Spinner } from './ui'
import { Walkthrough } from './Walkthrough'

/* -------------------------------------------------------------------------- */
/*  Config                                                                    */
/* -------------------------------------------------------------------------- */

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end: boolean
  tour?: string
}

const links: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/journal', label: 'Journal', icon: BookOpen, end: true, tour: 'journal-link' },
  { to: '/journal/calendar', label: 'Calendar', icon: CalendarDays, end: true },
  { to: '/reports', label: 'Reports', icon: FileText, end: false, tour: 'reports-link' },
  { to: '/settings', label: 'Settings', icon: Settings, end: false },
]

const SIDEBAR_KEY = 'ojt-sidebar-collapsed'
const TOUR_KEY = 'ojt-walkthrough-done'
const SETUP_KEY = 'talaarawan-setup-done'

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-200/60'

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeFlag(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? '1' : '0')
  } catch {
    // Ignore storage failures in private mode.
  }
}

function getInitials(name?: string | null, email?: string | null) {
  const source = (name || email || 'O').trim()
  const initials = source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
  return initials || 'O'
}

/* -------------------------------------------------------------------------- */
/*  Small building blocks                                                     */
/* -------------------------------------------------------------------------- */

function Brand({
  compact = false,
  dark = false,
  narrow = false,
  tagline = true,
}: {
  compact?: boolean
  dark?: boolean
  narrow?: boolean
  tagline?: boolean
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-[11px] border font-display text-[14px] font-semibold tracking-tight backdrop-blur-md ${
          dark
            ? 'border-white/20 bg-gradient-to-b from-white/[0.18] to-white/[0.06] text-paper-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
            : 'border-forest-800/80 bg-forest-900 text-paper-50'
        }`}
      >
        TA
      </span>
      {!compact && (
        <span className={`min-w-0 ${narrow ? 'hidden min-[420px]:block' : ''}`}>
          <span
            className={`block font-display text-[17px] font-semibold leading-none tracking-[-0.01em] ${
              dark ? 'text-paper-50' : 'text-ink-900'
            }`}
          >
            TalaArawan
          </span>
          {tagline && (
            <span
              className={`mt-1.5 block whitespace-nowrap text-[11px] font-medium leading-none ${
                dark ? 'text-forest-300/80' : 'text-ink-400'
              }`}
            >
              Philippine field notes
            </span>
          )}
        </span>
      )}
    </div>
  )
}

function Avatar({ initials, title }: { initials: string; title?: string }) {
  return (
    <span
      title={title}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/20 bg-gradient-to-b from-white/[0.16] to-white/[0.06] font-display text-[11px] font-semibold text-paper-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
    >
      {initials}
    </span>
  )
}

function IconButton({
  label,
  onClick,
  children,
  tone = 'default',
  ...rest
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
  tone?: 'default' | 'danger'
} & Record<string, unknown>) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`rounded-lg p-1.5 text-forest-200/50 transition-colors hover:bg-white/10 ${
        tone === 'danger' ? 'hover:text-clay-200' : 'hover:text-paper-50'
      } ${focusRing}`}
      {...rest}
    >
      {children}
    </button>
  )
}

function ProgressRing({
  percent,
  size = 48,
  stroke = 3.5,
  showLabel = true,
}: {
  percent: number
  size?: number
  stroke?: number
  showLabel?: boolean
}) {
  const gradientId = useId()
  const clamped = Math.max(0, Math.min(100, percent))
  const radius = 22 - stroke / 2 - 1
  const circumference = 2 * Math.PI * radius
  const done = clamped >= 100

  return (
    <div
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${Math.round(clamped)}% of required hours rendered`}
      title={`${Math.round(clamped)}% of required hours`}
    >
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 44 44" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-forest-300)" />
            <stop offset="100%" stopColor="var(--color-forest-100)" />
          </linearGradient>
        </defs>
        <circle
          cx="22"
          cy="22"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={stroke}
        />
        <circle
          cx="22"
          cy="22"
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          className="transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
        />
      </svg>
      {showLabel &&
        (done ? (
          <Check className="relative h-4 w-4 text-forest-100" strokeWidth={2.6} />
        ) : (
          <span
            className="tabular relative font-semibold text-paper-50"
            style={{ fontSize: size >= 52 ? 13 : 10 }}
          >
            {Math.round(clamped)}
            <span className="text-[0.7em] text-forest-200/70">%</span>
          </span>
        ))}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Sidebar progress card                                                     */
/* -------------------------------------------------------------------------- */

function ProgressCard({
  rendered,
  required,
  percent,
}: {
  rendered: number
  required: number
  percent: number
}) {
  const estimate = useOjtEstimate()
  const clamped = Math.max(0, Math.min(100, percent))
  const remaining = Math.max(0, required - rendered)
  const complete = required > 0 && remaining === 0

  return (
    <section
      aria-label="Hours progress"
      className="overflow-hidden rounded-2xl border border-white/[0.09] bg-gradient-to-b from-white/[0.09] to-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_32px_-18px_rgba(0,0,0,0.5)]"
    >
      {/* Hours summary */}
      <div className="p-3">
        <div className="flex items-center gap-3">
          <ProgressRing percent={percent} size={48} stroke={4} />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-forest-200/65">Hours rendered</p>
            <p className="tabular mt-0.5 truncate font-display text-[20px] font-semibold leading-none tracking-tight text-paper-50">
              {formatHours(rendered)}
            </p>
            {required > 0 && (
              <p className="tabular mt-1 truncate text-[11px] text-forest-300/60">
                of {formatHours(required)} required
              </p>
            )}
          </div>
        </div>

        {required > 0 && (
          <>
            <div
              className="relative mt-3 h-1.5 rounded-full bg-white/[0.1]"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(clamped)}
              aria-label="Required hours progress"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-forest-300 to-forest-100 shadow-[0_0_10px_rgba(167,201,170,0.45)] transition-[width] duration-700 ease-out motion-reduce:transition-none"
                style={{ width: `${clamped}%` }}
              />
              {/* Quarter markers */}
              {[25, 50, 75].map((mark) => (
                <span
                  key={mark}
                  aria-hidden="true"
                  className="absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-forest-900/70"
                  style={{ left: `${mark}%` }}
                />
              ))}
            </div>

            <div className="mt-2.5 flex items-center justify-between text-[11px]">
              {complete ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-forest-200/15 px-2 py-0.5 font-medium text-forest-100">
                  <Check className="h-3 w-3" strokeWidth={2.6} />
                  Hours complete
                </span>
              ) : (
                <span className="tabular text-forest-200/75">
                  <span className="font-semibold text-paper-50">{formatHours(remaining)}</span> to go
                </span>
              )}
              <span className="tabular font-medium text-forest-300/60">{Math.round(clamped)}%</span>
            </div>
          </>
        )}
      </div>

      {/* Estimated finish */}
      {required > 0 ? (
        !complete && (
          <div className="border-t border-white/[0.08] bg-black/[0.14] p-2.5">
            {/*
              CompletionEstimate ships its own light card, icon and label. In the dark
              sidebar we strip that card and recolor its text instead of nesting a second
              card/icon around it.
            */}
            <CompletionEstimate
              estimate={estimate}
              compact
              showDetails={false}
              className={[
                'w-full min-w-0',
                // flatten the light card
                'bg-transparent! border-0! shadow-none! backdrop-blur-none! p-1.5! rounded-none!',
                // dark-theme text: muted by default, date stands out
                '[&_*]:text-forest-200/70!',
                '[&_[class*=font-display]]:text-paper-50! [&_[class*=font-display]]:text-[19px]!',
                '[&_svg]:text-forest-200!',
                '[&_p]:leading-snug!',
              ].join(' ')}
            />
          </div>
        )
      ) : (
        <NavLink
          to="/settings"
          className={`group flex items-start gap-2.5 border-t border-dashed border-white/15 bg-black/[0.1] px-3.5 py-3 text-[11.5px] leading-snug text-forest-200/75 transition-colors hover:bg-white/[0.05] hover:text-paper-50 ${focusRing}`}
        >
          <span
            aria-hidden="true"
            className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/15 bg-white/[0.06] text-forest-200 transition-colors group-hover:border-forest-200/40"
          >
            <CalendarClock className="h-3.5 w-3.5" strokeWidth={2} />
          </span>
          <span>
            <span className="block font-medium text-paper-50">Estimate your finish date</span>
            <span className="mt-0.5 block text-forest-300/65">
              Set your required hours in Settings.
            </span>
          </span>
        </NavLink>
      )}
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/*  Sidebar                                                                   */
/* -------------------------------------------------------------------------- */

function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle: () => void
}) {
  const { user, signOut } = useAuth()
  const { profile, entries } = useData()
  const navigate = useNavigate()

  const rendered = useMemo(
    () => entries.reduce((sum, entry) => sum + entry.rendered_hours, 0),
    [entries],
  )
  const required = profile?.required_hours ?? 0
  const percent = required > 0 ? (rendered / required) * 100 : 0
  const displayName = profile?.full_name || 'Student'
  const initials = getInitials(profile?.full_name, user?.email)
  const avatarTitle = `${displayName}${user?.email ? ` (${user.email})` : ''}`

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth')
  }

  return (
    <aside
      className={`glass-dark fixed inset-y-0 left-0 z-30 hidden overflow-y-auto border-r border-white/[0.08] text-paper-50 shadow-[0_0_60px_-24px_rgba(22,21,16,0.55)] transition-[width] duration-300 ease-out motion-reduce:transition-none lg:block [scrollbar-width:none] [&::-webkit-scrollbar]:hidden print:hidden ${
        collapsed ? 'w-[68px]' : 'w-[240px]'
      }`}
    >
      <div className="flex min-h-full flex-col">
        {/* Header */}
        <div className={collapsed ? 'px-3 pt-4' : 'px-3.5 pt-4'}>
          <div
            className={`flex items-center ${
              collapsed ? 'flex-col gap-3' : 'justify-between gap-1'
            }`}
          >
            <Brand compact={collapsed} dark tagline={false} />
            <IconButton
              label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={onToggle}
              data-tour="sidebar-toggle"
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </IconButton>
          </div>
        </div>

        {/* Navigation */}
        <nav className="mt-5 px-3" aria-label="Main">
          {!collapsed && (
            <p className="mb-2 px-2.5 text-[11px] font-medium text-forest-300/45">Menu</p>
          )}
          <ul className="space-y-0.5">
            {links.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  end={link.end}
                  data-tour={link.tour}
                  title={collapsed ? link.label : undefined}
                  aria-label={collapsed ? link.label : undefined}
                  className={({ isActive }) =>
                    `group relative flex items-center rounded-[10px] text-[13px] font-medium transition-colors duration-200 ${focusRing} ${
                      collapsed ? 'h-10 justify-center' : 'gap-2.5 px-2.5 py-2'
                    } ${
                      isActive
                        ? 'bg-white/[0.12] text-paper-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                        : 'text-forest-100/60 hover:bg-white/[0.06] hover:text-paper-50'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        aria-hidden="true"
                        className={`absolute -left-3 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-forest-200 transition-all duration-200 ${
                          isActive ? 'scale-y-100 opacity-100' : 'scale-y-50 opacity-0'
                        }`}
                      />
                      <link.icon
                        className={`h-[17px] w-[17px] shrink-0 transition-colors ${
                          isActive
                            ? 'text-forest-200'
                            : 'text-forest-200/50 group-hover:text-forest-200'
                        }`}
                        strokeWidth={isActive ? 2.1 : 1.8}
                      />
                      {!collapsed && <span className="truncate">{link.label}</span>}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer */}
        <div className={`mt-auto ${collapsed ? 'px-3 pb-4 pt-4' : 'px-3 pb-3 pt-4'}`}>
          {collapsed ? (
            <div className="flex flex-col items-center gap-2.5">
              <ProgressRing percent={percent} size={44} />
              <div className="h-px w-6 bg-white/10" />
              <Avatar initials={initials} title={avatarTitle} />
              <IconButton label="Sign out" onClick={handleSignOut} tone="danger">
                <LogOut className="h-4 w-4" />
              </IconButton>
            </div>
          ) : (
            <>
              <ProgressCard rendered={rendered} required={required} percent={percent} />

              <div className="mt-2 flex items-center gap-2.5 rounded-xl px-1.5 py-1">
                <Avatar initials={initials} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-medium leading-tight text-paper-50">
                    {displayName}
                  </p>
                  <p className="truncate text-[10.5px] leading-tight text-forest-300/60">
                    {user?.email}
                  </p>
                </div>
                <IconButton label="Sign out" onClick={handleSignOut} tone="danger">
                  <LogOut className="h-4 w-4" />
                </IconButton>
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}

/* -------------------------------------------------------------------------- */
/*  Mobile bottom navigation                                                  */
/* -------------------------------------------------------------------------- */

function MobileNav() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-white/55 bg-white/70 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl lg:hidden print:hidden"
    >
      <div className="grid grid-cols-5">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            data-tour={link.tour}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${focusRing} ${
                isActive ? 'text-forest-700' : 'text-ink-400'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`grid h-7 w-10 place-items-center rounded-full transition-colors ${
                    isActive ? 'bg-forest-100/80' : ''
                  }`}
                >
                  <link.icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2.1 : 1.8} />
                </span>
                {link.label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

/* -------------------------------------------------------------------------- */
/*  App shell                                                                 */
/* -------------------------------------------------------------------------- */

export function AppShell() {
  const { user } = useAuth()
  const { profile, entries, error, refresh } = useData()
  const navigate = useNavigate()

  const tourStorageKey = user ? `${TOUR_KEY}:${user.id}` : TOUR_KEY
  const setupStorageKey = user ? `${SETUP_KEY}:${user.id}` : SETUP_KEY

  const today = todayISO()
  const todayEntry = entries.find((entry) => entry.entry_date === today)
  const quickPath = todayEntry ? `/journal/${todayEntry.id}/edit` : `/journal/new?date=${today}`

  const [collapsed, setCollapsed] = useState(() => readFlag(SIDEBAR_KEY))
  const [tourDone, setTourDone] = useState(() => readFlag(tourStorageKey))
  const [tourActive, setTourActive] = useState(false)
  const [showSetup, setShowSetup] = useState(false)
  const [setupSkipped, setSetupSkipped] = useState(false)
  const [setupDismissed] = useState(() => readFlag(setupStorageKey))
  const needsSetup = !setupDismissed && (profile === null || profile.required_hours <= 0)
  const restoreSidebarRef = useRef(false)

  useEffect(() => {
    writeFlag(SIDEBAR_KEY, collapsed)
  }, [collapsed])

  const finishTour = useCallback(() => {
    setTourActive(false)
    setTourDone(true)
    writeFlag(tourStorageKey, true)
    if (restoreSidebarRef.current) setCollapsed(true)
    restoreSidebarRef.current = false
    if (needsSetup && !setupSkipped) setShowSetup(true)
  }, [needsSetup, setupSkipped, tourStorageKey])

  const dismissSetup = useCallback(() => {
    setShowSetup(false)
    setSetupSkipped(true)
    writeFlag(setupStorageKey, true)
  }, [setupStorageKey])

  const finishSetup = useCallback(() => {
    dismissSetup()
    navigate('/', { replace: true })
  }, [dismissSetup, navigate])

  // Offer setup once the tour is out of the way.
  useEffect(() => {
    if (!tourDone || tourActive || !needsSetup || setupSkipped || showSetup) return
    const timer = window.setTimeout(() => setShowSetup(true), 400)
    return () => window.clearTimeout(timer)
  }, [tourDone, tourActive, needsSetup, setupSkipped, showSetup])

  // Start the walkthrough for first-time users, expanding the sidebar if needed.
  useEffect(() => {
    if (tourDone || tourActive) return

    let expandTimer: number | undefined
    const startTimer = window.setTimeout(() => {
      if (readFlag(SIDEBAR_KEY)) {
        restoreSidebarRef.current = true
        setCollapsed(false)
        expandTimer = window.setTimeout(() => setTourActive(true), 350)
      } else {
        setTourActive(true)
      }
    }, 650)

    return () => {
      window.clearTimeout(startTimer)
      if (expandTimer) window.clearTimeout(expandTimer)
    }
  }, [tourDone, tourActive])

  return (
    <div className="relative min-h-screen bg-paper-50/10">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-24 top-[-12%] h-[34rem] w-[34rem] rounded-full bg-forest-300/25 blur-3xl" />
        <div className="absolute right-[-10%] top-[18%] h-[28rem] w-[28rem] rounded-full bg-paper-300/40 blur-3xl" />
        <div className="absolute bottom-[-18%] left-[30%] h-[30rem] w-[30rem] rounded-full bg-forest-200/25 blur-3xl" />
      </div>

      {!isSupabaseConfigured && (
        <div
          role="alert"
          className="border-b border-amber-200/60 bg-amber-50/70 px-4 py-2 text-center text-xs text-amber-800 backdrop-blur-xl print:hidden"
        >
          Supabase is not configured yet. Add your project URL and anon key to{' '}
          <code className="rounded bg-amber-100/80 px-1">.env.local</code>, then restart the dev server.
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-center gap-2 border-b border-clay-200/60 bg-clay-50/75 px-4 py-2 text-center text-xs text-clay-700 backdrop-blur-xl print:hidden"
        >
          <span>Could not sync your journal: {error}</span>
          <button
            type="button"
            onClick={() => void refresh()}
            className="font-semibold underline underline-offset-2 hover:text-clay-800"
          >
            Retry
          </button>
        </div>
      )}

      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((value) => !value)}
      />

      <div
        className={`min-h-screen transition-[padding] duration-300 ease-out motion-reduce:transition-none print:pl-0 ${
          collapsed ? 'lg:pl-[68px]' : 'lg:pl-[240px]'
        }`}
      >
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/55 bg-white/55 px-4 py-3 backdrop-blur-2xl lg:hidden print:hidden">
          <Brand narrow />
          <Button size="sm" data-tour="quick-action" onClick={() => navigate(quickPath)}>
            {todayEntry ? <PenLine className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {todayEntry ? 'Edit your log today' : 'Add new entry'}
          </Button>
        </header>

        <main className="mx-auto w-full max-w-[1180px] px-4 py-6 pb-28 sm:px-6 lg:px-10 lg:py-10 lg:pb-10 print:max-w-none print:p-0">
          <Outlet />
        </main>
      </div>

      <MobileNav />

      {tourActive && <Walkthrough onFinish={finishTour} />}
      {showSetup && <OnboardingPage onComplete={finishSetup} onSkip={dismissSetup} />}

      <span className="sr-only">{profile?.full_name}</span>
    </div>
  )
}

export function FullScreenLoader() {
  return (
    <div className="grid min-h-screen place-items-center bg-forest-900">
      <div className="fade-up flex flex-col items-center gap-4" role="status" aria-live="polite">
        <span className="grid h-12 w-12 place-items-center rounded-xl border border-white/20 bg-white/10 font-display text-lg font-semibold text-paper-50 backdrop-blur-xl">
          TA
        </span>
        <Spinner className="h-5 w-5 text-forest-200" />
        <p className="text-[11px] font-medium text-forest-200/80">Opening your journal…</p>
      </div>
    </div>
  )
}