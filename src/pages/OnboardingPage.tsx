import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowRight,
  BookOpen,
  CalendarCheck2,
  ChevronDown,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import {
  buildScheduleDrafts,
  draftHours,
  draftWeeklyHours,
  ScheduleEditor,
  toScheduleInputs,
} from '../components/ScheduleEditor'
import type { ScheduleDraft } from '../components/ScheduleEditor'
import { CompletionEstimate } from '../components/CompletionEstimate'
import { DatePicker } from '../components/fields'
import { useFeedback } from '../components/Feedback'
import { LocalityPicker } from '../components/LocalityPicker'
import { Button, Field, Input } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useHolidays } from '../context/HolidaysContext'
import { todayISO } from '../lib/date'
import { estimateCompletion } from '../lib/estimate'
import { formatClock, formatHoursLong } from '../lib/hours'

function defaultSchedule(): ScheduleDraft[] {
  return buildScheduleDrafts([], []).map((day) =>
    [1, 2, 3, 4, 5].includes(day.day_of_week)
      ? {
          ...day,
          is_working: true,
          time_in: '08:00',
          time_out: '17:00',
          breaks: [
            {
              label: 'Lunch',
              start_time: '12:00',
              end_time: '13:00',
              duration_minutes: 60,
              excluded_from_rendered: true,
            },
          ],
        }
      : day,
  )
}

export default function OnboardingPage({
  onComplete,
  onSkip,
}: {
  onComplete: () => void
  onSkip: () => void
}) {
  const { user } = useAuth()
  const { profile, schedules, breaks, saveProfile, saveSchedule } = useData()
  const { holidays } = useHolidays()
  const { toast } = useFeedback()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSchedule, setShowSchedule] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [form, setForm] = useState(() => ({
    full_name:
      profile?.full_name ?? ((user?.user_metadata?.full_name as string | undefined) ?? ''),
    school: profile?.school ?? '',
    program: profile?.program ?? '',
    company: profile?.company ?? '',
    company_location: profile?.company_location ?? '',
    company_location_code: profile?.company_location_code ?? '',
    supervisor: profile?.supervisor ?? '',
    required_hours: profile?.required_hours ? String(profile.required_hours) : '',
    start_date: profile?.start_date ?? todayISO(),
  }))
  const [schedule, setSchedule] = useState<ScheduleDraft[]>(() =>
    schedules.length > 0 ? buildScheduleDrafts(schedules, breaks) : defaultSchedule(),
  )

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }))

  const setLocality = (name: string, code: string | null) =>
    setForm((current) => ({
      ...current,
      company_location: name,
      company_location_code: code ?? '',
    }))

  const workingDays = schedule.filter((day) => day.is_working)
  const weeklyTarget = draftWeeklyHours(schedule)
  const firstDay = workingDays[0]
  const scheduleSummary =
    workingDays.length === 0
      ? 'No working days selected yet'
      : `${workingDays.length} day${workingDays.length === 1 ? '' : 's'} a week · ${formatHoursLong(
          weeklyTarget,
        )} total · ${formatClock(firstDay?.time_in)}–${formatClock(firstDay?.time_out)}`

  const dailyHours: Record<number, number> = {}
  schedule.forEach((day) => {
    dailyHours[day.day_of_week] = draftHours(day)
  })
  const previewEstimate = estimateCompletion({
    startDate: form.start_date || null,
    targetEndDate: profile?.end_date ?? null,
    requiredHours: Number(form.required_hours) || 0,
    renderedHours: 0,
    dailyHours,
    holidays,
  })

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setError(null)

    if (form.full_name.trim().length < 2) {
      setShowDetails(true)
      setError('Enter your full name so it appears correctly on reports.')
      return
    }
    if (!(Number(form.required_hours) > 0)) {
      setError('Enter the total number of hours you need to render.')
      return
    }
    if (workingDays.length === 0 || weeklyTarget <= 0) {
      setShowSchedule(true)
      setError('Set at least one working day with a valid time in and time out.')
      return
    }
    const invalid = workingDays.find(
      (day) => !day.time_in || !day.time_out || draftHours(day) <= 0,
    )
    if (invalid) {
      setShowSchedule(true)
      setError('Check the time in and time out for every working day.')
      return
    }

    setBusy(true)
    try {
      await saveProfile({
        full_name: form.full_name.trim(),
        school: form.school.trim(),
        program: form.program.trim(),
        company: form.company.trim(),
        company_location: form.company_location.trim(),
        company_location_code: form.company_location_code.trim() || null,
        supervisor: form.supervisor.trim(),
        required_hours: Number(form.required_hours),
        start_date: form.start_date || null,
      })
      const inputs = toScheduleInputs(schedule)
      await saveSchedule(inputs.schedules, inputs.breaks)
      toast('Setup saved', {
        description: 'Your finish date is ready. Add your first entry when you start.',
      })
      onComplete()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to save. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-forest-900">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-24 top-[-10%] h-[32rem] w-[32rem] rounded-full bg-forest-400/25 blur-3xl" />
        <div className="absolute right-[-8%] top-[16%] h-[28rem] w-[28rem] rounded-full bg-paper-300/20 blur-3xl" />
        <div className="mx-auto grid max-w-6xl grid-cols-[220px_1fr] gap-6 px-10 pt-16 opacity-35 blur-[1px]">
          <div className="space-y-3">
            <div className="h-10 w-40 rounded-xl bg-white/15" />
            <div className="h-10 rounded-xl bg-white/10" />
            <div className="h-10 rounded-xl bg-white/10" />
            <div className="h-10 rounded-xl bg-white/10" />
            <div className="mt-24 h-36 rounded-2xl bg-white/10" />
          </div>
          <div className="space-y-4">
            <div className="h-20 rounded-2xl bg-white/10" />
            <div className="grid grid-cols-2 gap-4">
              <div className="h-56 rounded-2xl bg-white/10" />
              <div className="h-56 rounded-2xl bg-white/10" />
            </div>
            <div className="h-44 rounded-2xl bg-white/10" />
          </div>
        </div>
      </div>

      <div className="fixed inset-0 z-40 bg-ink-950/65 backdrop-blur-sm" aria-hidden="true" />

      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="mx-auto flex min-h-full max-w-3xl items-center px-3 py-6 sm:px-6 sm:py-10">
          <form
            onSubmit={handleSubmit}
            role="dialog"
            aria-modal="true"
            aria-labelledby="setup-title"
            className="fade-up w-full rounded-[1.75rem] border border-white/70 bg-paper-50/95 p-4 shadow-[0_50px_140px_-40px_rgba(0,0,0,0.75)] backdrop-blur-2xl sm:p-7 lg:p-8"
          >
            <header className="flex flex-wrap items-start justify-between gap-4 border-b border-paper-200/70 pb-5">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl border border-forest-800/80 bg-forest-900 font-display text-sm font-semibold text-paper-50">
                  TA
                </span>
                <div>
                  <p className="font-display text-[19px] font-semibold leading-none tracking-[-0.01em] text-ink-900">
                    TalaArawan
                  </p>
                  <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-400">
                    Quick setup
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden items-center gap-2 rounded-full border border-white/70 bg-white/55 px-3 py-1.5 text-[10px] text-ink-400 backdrop-blur-md sm:flex">
                  <Sparkles className="h-3.5 w-3.5 text-forest-600" />
                  {user?.email}
                </div>
                <button
                  type="button"
                  onClick={onSkip}
                  aria-label="Close setup"
                  className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-white/70 hover:text-ink-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            <div className="mt-5">
              <h1
                id="setup-title"
                className="font-display text-[1.9rem] font-semibold leading-[1.08] tracking-[-0.02em] text-ink-900 sm:text-[2.15rem]"
              >
                Let’s set up your journal.
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-500">
                Enter the hours you need and when your OJT starts. We already filled in a standard
                Monday–Friday, 8:00 AM–5:00 PM schedule with an hour for lunch — adjust it only if
                you need to.
              </p>
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-clay-200/80 bg-clay-50/80 px-4 py-3 text-sm text-clay-700">
                {error}
              </div>
            )}

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <Field
                label="Required render hours"
                htmlFor="requiredHours"
                required
                hint="Total hours your school requires."
              >
                <Input
                  id="requiredHours"
                  type="number"
                  min={0}
                  step="0.5"
                  inputMode="decimal"
                  value={form.required_hours}
                  onChange={(event) => set('required_hours', event.target.value)}
                  placeholder="500"
                />
              </Field>
              <Field label="OJT start date" htmlFor="startDate" hint="Defaults to today.">
                <DatePicker
                  id="startDate"
                  value={form.start_date}
                  onChange={(value) => set('start_date', value)}
                  clearable={false}
                />
              </Field>
            </div>

            <div className="mt-4 rounded-xl border border-white/70 bg-white/50 p-4 backdrop-blur-md">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-forest-200/80 bg-forest-50/80 text-forest-700">
                    <CalendarCheck2 className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-ink-900">Weekly schedule</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-ink-500">
                      {scheduleSummary}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowSchedule((value) => !value)}
                >
                  {showSchedule ? 'Hide' : 'Adjust'}
                </Button>
              </div>

              {showSchedule && (
                <div className="mt-4 border-t border-paper-200/80 pt-4">
                  <ScheduleEditor value={schedule} onChange={setSchedule} />
                </div>
              )}
            </div>

            <CompletionEstimate estimate={previewEstimate} compact className="mt-4" />

            <button
              type="button"
              onClick={() => setShowDetails((value) => !value)}
              aria-expanded={showDetails}
              className="mt-4 flex w-full items-center justify-between gap-3 rounded-xl border border-dashed border-paper-300/90 bg-white/35 px-4 py-3 text-left text-[12px] font-medium text-ink-600 transition-colors hover:bg-white/60"
            >
              <span className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-ink-400" />
                Add school, company, or supervisor details
                <span className="text-ink-400">(optional)</span>
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-ink-400 transition-transform ${
                  showDetails ? 'rotate-180' : ''
                }`}
              />
            </button>

            {showDetails && (
              <div className="mt-4 grid gap-4 rounded-xl border border-white/70 bg-white/40 p-4 backdrop-blur-md sm:grid-cols-2">
                <Field label="Full name" htmlFor="fullName" required>
                  <Input
                    id="fullName"
                    value={form.full_name}
                    onChange={(event) => set('full_name', event.target.value)}
                    placeholder="Juan Dela Cruz"
                    autoComplete="name"
                  />
                </Field>
                <Field label="School / University" htmlFor="school">
                  <Input
                    id="school"
                    value={form.school}
                    onChange={(event) => set('school', event.target.value)}
                    placeholder="Optional"
                  />
                </Field>
                <Field label="Program / Course" htmlFor="program">
                  <Input
                    id="program"
                    value={form.program}
                    onChange={(event) => set('program', event.target.value)}
                    placeholder="Optional"
                  />
                </Field>
                <Field label="Company / Office" htmlFor="company">
                  <Input
                    id="company"
                    value={form.company}
                    onChange={(event) => set('company', event.target.value)}
                    placeholder="Optional"
                  />
                </Field>
                <Field
                  label="Company location"
                  htmlFor="companyLocation"
                  hint="Shown on your printed reports."
                >
                  <LocalityPicker
                    id="companyLocation"
                    value={form.company_location}
                    code={form.company_location_code}
                    onChange={setLocality}
                  />
                </Field>
                <Field label="Supervisor" htmlFor="supervisor">
                  <Input
                    id="supervisor"
                    value={form.supervisor}
                    onChange={(event) => set('supervisor', event.target.value)}
                    placeholder="Optional"
                  />
                </Field>
              </div>
            )}

            <div className="mt-5 flex items-start gap-2 rounded-xl border border-forest-200/70 bg-forest-50/60 px-3.5 py-3 text-[11px] leading-relaxed text-forest-800">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Your journal is private by default. Only your account can read or change your
                entries. Everything here can be edited later in Settings.
              </p>
            </div>

            <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-paper-200/70 pt-5">
              <Button type="button" variant="ghost" onClick={onSkip} disabled={busy}>
                I’ll do this later
              </Button>
              <Button type="submit" loading={busy}>
                Save & open dashboard <ArrowRight className="h-4 w-4" />
              </Button>
            </footer>
          </form>
        </div>
      </div>
    </div>
  )
}
