import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2,
  CalendarDays,
  CalendarPlus,
  Clock,
  GraduationCap,
  KeyRound,
  LogOut,
  Mail,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
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
import { DatePicker, Select } from '../components/fields'
import { useFeedback } from '../components/Feedback'
import { LocalityPicker } from '../components/LocalityPicker'
import { Button, Field, Input, PageHeader, Panel } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useHolidays } from '../context/HolidaysContext'
import { useOjtEstimate } from '../hooks/useOjtEstimate'
import { displayDate, todayISO } from '../lib/date'
import { sendEmail } from '../lib/email'
import { estimateCompletion } from '../lib/estimate'
import { formatHours } from '../lib/hours'
import { HOLIDAY_ATTRIBUTION, HOLIDAY_ATTRIBUTION_URL } from '../lib/phHolidays'
import type { HolidayKind, PhHoliday } from '../lib/phHolidays'
import type { Profile } from '../lib/types'

type Tab = 'profile' | 'schedule' | 'holidays' | 'account'
type IconType = typeof UserRound

function formFromProfile(profile: Profile | null) {
  return {
    full_name: profile?.full_name ?? '',
    school: profile?.school ?? '',
    program: profile?.program ?? '',
    company: profile?.company ?? '',
    company_location: profile?.company_location ?? '',
    company_location_code: profile?.company_location_code ?? '',
    supervisor: profile?.supervisor ?? '',
    required_hours: String(profile?.required_hours ?? 0),
    start_date: profile?.start_date ?? '',
  }
}

const tabs: { value: Tab; label: string; description: string; icon: IconType }[] = [
  { value: 'profile', label: 'Profile', description: 'Name, school, target hours', icon: UserRound },
  { value: 'schedule', label: 'Schedule', description: 'Working days and breaks', icon: CalendarDays },
  { value: 'holidays', label: 'Holidays', description: 'National and your own', icon: CalendarPlus },
  { value: 'account', label: 'Account', description: 'Password and session', icon: KeyRound },
]

function IconTile({ icon: Icon, tone = 'forest' }: { icon: IconType; tone?: 'forest' | 'clay' }) {
  return (
    <span
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border backdrop-blur-md ${
        tone === 'clay'
          ? 'border-clay-200/70 bg-clay-50/70 text-clay-700'
          : 'border-forest-200/70 bg-forest-50/70 text-forest-700'
      }`}
    >
      <Icon className="h-4 w-4" />
    </span>
  )
}

function FormSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: IconType
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="grid gap-4 px-5 py-5 sm:px-6 lg:grid-cols-[190px_minmax(0,1fr)] lg:gap-8">
      <div>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-forest-600" />
          <h3 className="text-[13px] font-semibold text-ink-900">{title}</h3>
        </div>
        <p className="mt-1 text-[11.5px] leading-relaxed text-ink-500">{description}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  )
}

function SettingRow({
  icon,
  title,
  description,
  tone,
  children,
}: {
  icon: IconType
  title: string
  description: ReactNode
  tone?: 'forest' | 'clay'
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6">
      <div className="flex min-w-0 items-start gap-3">
        <IconTile icon={icon} tone={tone} />
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-ink-900">{title}</p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-500">{description}</p>
        </div>
      </div>
      {children && <div className="flex shrink-0 flex-wrap gap-2 sm:pl-0 pl-12">{children}</div>}
    </div>
  )
}

function DirtyStatus({ dirty, clean, changed }: { dirty: boolean; clean: string; changed: string }) {
  return (
    <p className="flex items-center gap-2 text-[11.5px] text-ink-500" role="status">
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full transition-colors ${
          dirty ? 'bg-amber-500' : 'bg-forest-400'
        }`}
      />
      {dirty ? changed : clean}
    </p>
  )
}

export default function SettingsPage() {
  const { user, signOut, sendPasswordReset } = useAuth()
  const { profile, schedules, breaks, entries, saveProfile, saveSchedule } = useData()
  const {
    holidays,
    apiHolidays,
    customHolidays,
    ignoredHolidays,
    addCustomHoliday,
    removeCustomHoliday,
    ignoreHoliday,
    restoreHoliday,
    refresh: refreshHolidays,
    loading: holidaysLoading,
  } = useHolidays()
  const savedEstimate = useOjtEstimate()
  const { toast } = useFeedback()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('profile')
  const [busy, setBusy] = useState(false)
  const [emailBusy, setEmailBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profileDirty, setProfileDirty] = useState(false)
  const [scheduleDirty, setScheduleDirty] = useState(false)
  const [form, setForm] = useState(() => formFromProfile(profile))
  const [draft, setDraft] = useState<ScheduleDraft[]>(() => buildScheduleDrafts(schedules, breaks))
  const [holidayDraft, setHolidayDraft] = useState<{
    date: string
    name: string
    kind: HolidayKind
  }>({ date: todayISO(), name: '', kind: 'local' })
  const [holidayBusy, setHolidayBusy] = useState(false)
  const [busyHolidayDate, setBusyHolidayDate] = useState<string | null>(null)

  const set = (key: keyof typeof form, value: string) => {
    setProfileDirty(true)
    setForm((current) => ({ ...current, [key]: value }))
  }

  const setLocality = (name: string, code: string | null) => {
    setProfileDirty(true)
    setForm((current) => ({
      ...current,
      company_location: name,
      company_location_code: code ?? '',
    }))
  }

  const draftDailyHours: Record<number, number> = {}
  draft.forEach((day) => {
    draftDailyHours[day.day_of_week] = draftHours(day)
  })
  const scheduleEstimate = scheduleDirty
    ? estimateCompletion({
        startDate: profile?.start_date ?? null,
        targetEndDate: profile?.end_date ?? null,
        requiredHours: profile?.required_hours ?? 0,
        renderedHours: entries.reduce((sum, entry) => sum + entry.rendered_hours, 0),
        dailyHours: draftDailyHours,
        loggedDates: entries.map((entry) => entry.entry_date),
        holidays,
      })
    : savedEstimate
  const weeklyTarget = draftWeeklyHours(draft)

  const initials = (form.full_name || user?.email || 'O')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
  const identityLine = [form.program, form.school].filter(Boolean).join(' · ')

  const discardProfile = () => {
    setForm(formFromProfile(profile))
    setProfileDirty(false)
    setError(null)
  }

  const discardSchedule = () => {
    setDraft(buildScheduleDrafts(schedules, breaks))
    setScheduleDirty(false)
    setError(null)
  }

  const saveProfileForm = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const payload = {
        full_name: form.full_name.trim(),
        school: form.school.trim(),
        program: form.program.trim(),
        company: form.company.trim(),
        company_location: form.company_location.trim(),
        company_location_code: form.company_location_code.trim() || null,
        supervisor: form.supervisor.trim(),
        required_hours: Number(form.required_hours) || 0,
        start_date: form.start_date || null,
      }
      await saveProfile(payload)
      setForm(formFromProfile({ ...profile!, ...payload }))
      setProfileDirty(false)
      toast('Profile saved', { description: 'These details now appear on your reports.' })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to save.')
    } finally {
      setBusy(false)
    }
  }

  const saveScheduleForm = async () => {
    setBusy(true)
    setError(null)
    try {
      const inputs = toScheduleInputs(draft)
      await saveSchedule(inputs.schedules, inputs.breaks)
      setScheduleDirty(false)
      toast('Schedule saved', { description: 'Your completion estimate has been recalculated.' })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to save.')
    } finally {
      setBusy(false)
    }
  }

  const addHoliday = async () => {
    if (!holidayDraft.date || holidayDraft.name.trim().length < 2) {
      setError('Enter a date and a holiday name (at least 2 characters).')
      return
    }
    setHolidayBusy(true)
    setError(null)
    try {
      await addCustomHoliday({
        date: holidayDraft.date,
        name: holidayDraft.name.trim(),
        kind: holidayDraft.kind,
      })
      setHolidayDraft({ date: todayISO(), name: '', kind: 'local' })
      toast('Holiday added', { description: 'Your completion estimate has been recalculated.' })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not add the holiday.')
    } finally {
      setHolidayBusy(false)
    }
  }

  const deleteHoliday = async (id: string, name: string) => {
    setHolidayBusy(true)
    setError(null)
    try {
      await removeCustomHoliday(id)
      toast('Holiday removed', { description: `${name} is no longer excluded.` })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not remove the holiday.')
    } finally {
      setHolidayBusy(false)
    }
  }

  const toggleApiHoliday = async (holiday: PhHoliday) => {
    setBusyHolidayDate(holiday.date)
    setError(null)
    try {
      if (ignoredHolidays.some((item) => item.date === holiday.date)) {
        await restoreHoliday(holiday.date)
        toast('Holiday restored', { description: `${holiday.name} is excluded again.` })
      } else {
        await ignoreHoliday(holiday)
        toast('Holiday disabled', {
          description: `${holiday.name} now counts as a normal work day.`,
        })
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update the holiday.')
    } finally {
      setBusyHolidayDate(null)
    }
  }

  const handleEmail = async (action: 'test') => {
    if (!user?.email) return
    setEmailBusy(true)
    try {
      await sendEmail({
        action,
        email: user.email,
        fullName: profile?.full_name ?? '',
        redirectTo: window.location.origin,
      })
      toast('Test email sent', {
        description: `Delivered to ${user.email} through Brevo.`,
      })
    } catch (cause) {
      toast('Could not send email', {
        description: cause instanceof Error ? cause.message : 'Please try again.',
        variant: 'error',
      })
    } finally {
      setEmailBusy(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth')
  }

  const handleReset = async () => {
    if (!user?.email) return
    setBusy(true)
    try {
      await sendPasswordReset(user.email)
      toast('Reset link sent', { description: `Check ${user.email} for the password reset email.` })
    } catch (cause) {
      toast('Could not send reset link', {
        description: cause instanceof Error ? cause.message : 'Please try again.',
        variant: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Settings"
        title="Your details, schedule, and account."
        subtitle="Keep this current — it drives your hours, estimates, and reports."
      />

      <div className="grid items-start gap-5 lg:grid-cols-[216px_minmax(0,1fr)] lg:gap-8">
        {/* Section navigation */}
        <nav
          aria-label="Settings sections"
          data-tour="settings-tabs"
          className="thin-scroll -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:sticky lg:top-8 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0 lg:pb-0"
        >
          {tabs.map((item) => {
            const active = tab === item.value
            const dirty =
              (item.value === 'profile' && profileDirty) ||
              (item.value === 'schedule' && scheduleDirty)
            return (
              <button
                key={item.value}
                type="button"
                data-tour={`settings-${item.value}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => {
                  setTab(item.value)
                  setError(null)
                }}
                className={`group relative flex shrink-0 items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-400/50 lg:w-full ${
                  active
                    ? 'border-white/80 bg-white/75 text-ink-900 shadow-[0_12px_30px_-18px_rgba(34,53,42,0.55)] backdrop-blur-xl'
                    : 'border-transparent text-ink-500 hover:bg-white/50 hover:text-ink-800'
                }`}
              >
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors ${
                    active
                      ? 'bg-forest-900 text-paper-50'
                      : 'bg-white/50 text-ink-400 group-hover:text-forest-700'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-[13px] font-medium">
                    {item.label}
                    {dirty && (
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-amber-500"
                        title="Unsaved changes"
                        aria-label="Unsaved changes"
                      />
                    )}
                  </span>
                  <span className="hidden text-[10.5px] text-ink-400 lg:block">
                    {item.description}
                  </span>
                </span>
              </button>
            )
          })}
        </nav>

        <div className="min-w-0">
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-clay-200/80 bg-clay-50/80 px-4 py-3 text-sm text-clay-700 backdrop-blur-lg"
            >
              {error}
            </div>
          )}

          {/* Profile */}
          {tab === 'profile' && (
            <Panel className="overflow-hidden">
              <div className="flex items-center gap-4 border-b border-white/70 bg-white/30 px-5 py-5 backdrop-blur-md sm:px-6">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-forest-800/80 bg-forest-900 font-display text-[15px] font-semibold text-paper-50 shadow-[0_10px_24px_-12px_rgba(22,40,30,0.7)]">
                  {initials || 'O'}
                </span>
                <div className="min-w-0">
                  <h2 className="truncate font-display text-lg font-semibold leading-tight text-ink-900">
                    {form.full_name || 'Your profile'}
                  </h2>
                  <p className="mt-0.5 truncate text-xs text-ink-500">
                    {identityLine || user?.email || 'Add your school and program below.'}
                  </p>
                </div>
              </div>

              <form onSubmit={saveProfileForm}>
                <div className="divide-y divide-white/70">
                  <FormSection
                    icon={UserRound}
                    title="Personal"
                    description="Shown at the top of your printed reports."
                  >
                    <div className="sm:col-span-2">
                      <Field label="Full name" htmlFor="setName">
                        <Input
                          id="setName"
                          value={form.full_name}
                          onChange={(event) => set('full_name', event.target.value)}
                        />
                      </Field>
                    </div>
                  </FormSection>

                  <FormSection
                    icon={GraduationCap}
                    title="School"
                    description="Where you are enrolled."
                  >
                    <Field label="School / University" htmlFor="setSchool">
                      <Input
                        id="setSchool"
                        value={form.school}
                        onChange={(event) => set('school', event.target.value)}
                      />
                    </Field>
                    <Field label="Program / Course" htmlFor="setProgram">
                      <Input
                        id="setProgram"
                        value={form.program}
                        onChange={(event) => set('program', event.target.value)}
                      />
                    </Field>
                  </FormSection>

                  <FormSection
                    icon={Building2}
                    title="Placement"
                    description="Your host company and who signs off on your hours."
                  >
                    <Field label="Company / Office" htmlFor="setCompany">
                      <Input
                        id="setCompany"
                        value={form.company}
                        onChange={(event) => set('company', event.target.value)}
                      />
                    </Field>
                    <Field
                      label="Company location"
                      htmlFor="setCompanyLocation"
                      hint="Shown on your printed reports."
                      className="sm:col-span-2"
                    >
                      <LocalityPicker
                        id="setCompanyLocation"
                        value={form.company_location}
                        code={form.company_location_code}
                        onChange={setLocality}
                      />
                    </Field>
                    <Field label="Supervisor" htmlFor="setSupervisor">
                      <Input
                        id="setSupervisor"
                        value={form.supervisor}
                        onChange={(event) => set('supervisor', event.target.value)}
                      />
                    </Field>
                  </FormSection>

                  <FormSection
                    icon={Clock}
                    title="Duration"
                    description="Drives your progress and finish-date estimate."
                  >
                    <div className="sm:col-span-2 sm:max-w-[calc(50%-0.5rem)]">
                      <Field
                        label="Required render hours"
                        htmlFor="setHours"
                        hint="Set this to see an estimate."
                      >
                        <Input
                          id="setHours"
                          type="number"
                          min={0}
                          step="0.5"
                          value={form.required_hours}
                          onChange={(event) => set('required_hours', event.target.value)}
                        />
                      </Field>
                    </div>
                    <Field label="OJT start date" htmlFor="setStart" hint="Used for the completion estimate.">
                      <DatePicker
                        id="setStart"
                        value={form.start_date}
                        onChange={(value) => set('start_date', value)}
                      />
                    </Field>
                  </FormSection>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/70 bg-white/40 px-5 py-3.5 backdrop-blur-md sm:px-6">
                  <DirtyStatus
                    dirty={profileDirty}
                    clean="Profile is up to date."
                    changed="You have unsaved changes."
                  />
                  <div className="flex items-center gap-2">
                    {profileDirty && (
                      <Button type="button" variant="outline" onClick={discardProfile} disabled={busy}>
                        <RotateCcw className="h-4 w-4" /> Discard
                      </Button>
                    )}
                    <Button type="submit" loading={busy}>
                      <Save className="h-4 w-4" /> Save profile
                    </Button>
                  </div>
                </div>
              </form>
            </Panel>
          )}

          {/* Schedule */}
          {tab === 'schedule' && (
            <div className="space-y-4">
              <Panel className="p-5 sm:p-6">
                <ScheduleEditor
                  value={draft}
                  onChange={(next) => {
                    setScheduleDirty(true)
                    setDraft(next)
                  }}
                />
              </Panel>

              <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="rounded-2xl border border-white/70 bg-white/55 p-4 backdrop-blur-xl sm:p-5">
                  <div className="flex items-center gap-3">
                    <IconTile icon={Clock} />
                    <div>
                      <p className="text-[11px] font-medium text-ink-500">Expected weekly hours</p>
                      <p className="tabular font-display text-2xl font-semibold leading-tight text-ink-900">
                        {formatHours(weeklyTarget)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/70 pt-4">
                    <DirtyStatus
                      dirty={scheduleDirty}
                      clean="Schedule is up to date."
                      changed="The estimate uses your unsaved changes."
                    />
                    <div className="flex items-center gap-2">
                      {scheduleDirty && (
                        <Button variant="outline" onClick={discardSchedule} disabled={busy}>
                          <RotateCcw className="h-4 w-4" /> Discard
                        </Button>
                      )}
                      <Button onClick={saveScheduleForm} loading={busy}>
                        <Save className="h-4 w-4" /> Save schedule
                      </Button>
                    </div>
                  </div>
                </div>

                <CompletionEstimate estimate={scheduleEstimate} showHolidayInfo={false} />
              </div>
            </div>
          )}

          {/* Holidays */}
          {tab === 'holidays' && (
            <div className="space-y-4">
              <Panel className="p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <IconTile icon={CalendarPlus} />
                    <div>
                      <h2 className="font-display text-lg font-semibold text-ink-900">Holidays</h2>
                      <p className="mt-0.5 max-w-xl text-xs leading-relaxed text-ink-500">
                        National holidays load live from Nager.Date. Add any non-working dates
                        your company observes below. Only holidays from your OJT start date onward
                        are shown.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={refreshHolidays}
                    loading={holidaysLoading}
                  >
                    <RefreshCw className="h-4 w-4" /> Refresh
                  </Button>
                </div>
                <p className="mt-3 text-[11px] text-ink-400">
                  <a
                    href={HOLIDAY_ATTRIBUTION_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2"
                  >
                    {HOLIDAY_ATTRIBUTION}
                  </a>{' '}
                  · Only holidays on or after your OJT start date are used.
                </p>
              </Panel>

              <Panel className="overflow-hidden">
                <div className="border-b border-white/70 px-5 py-4 sm:px-6">
                  <h3 className="font-display text-base font-semibold text-ink-900">
                    National holidays
                  </h3>
                  <p className="mt-0.5 text-xs text-ink-500">
                    Turn off any holiday your office doesn&rsquo;t observe — that date will count as
                    a normal scheduled work day in your estimate.
                  </p>
                </div>
                {apiHolidays.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-ink-400">
                    No national holidays are available yet. Check your connection and refresh.
                  </p>
                ) : (
                  <ul className="thin-scroll divide-y divide-white/70" style={{ maxHeight: '22rem', overflowY: 'auto' }}>
                    {apiHolidays.map((holiday) => {
                      const ignored = ignoredHolidays.some((item) => item.date === holiday.date)
                      return (
                        <li
                          key={holiday.date}
                          className={`flex items-center gap-3 px-5 py-2.5 sm:px-6 ${
                            ignored ? 'bg-paper-100/70' : ''
                          }`}
                        >
                          <span className="min-w-0 flex-1">
                            <span className={`block truncate text-sm ${ignored ? 'text-ink-400 line-through' : 'text-ink-800'}`}>
                              {holiday.name}
                            </span>
                            <span className="mt-0.5 block text-[11px] text-ink-400">
                              {displayDate(holiday.date, 'MMM d, yyyy')} · {holiday.kind}
                              {ignored ? ' · disabled' : ''}
                            </span>
                          </span>
                          <Button
                            variant={ignored ? 'outline' : 'ghost'}
                            size="sm"
                            disabled={busyHolidayDate === holiday.date}
                            onClick={() => void toggleApiHoliday(holiday)}
                          >
                            {ignored ? 'Restore' : 'Disable'}
                          </Button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Panel>

              <Panel className="overflow-hidden">
                <div className="border-b border-white/70 px-5 py-4 sm:px-6">
                  <h3 className="font-display text-base font-semibold text-ink-900">Your holidays</h3>
                  <p className="mt-0.5 text-xs text-ink-500">
                    Non-working dates your company observes that are missing from the national
                    list. Dates before your OJT start date are not shown.
                  </p>
                </div>
                <div className="grid gap-3 px-5 py-4 sm:grid-cols-[145px_minmax(0,1fr)_135px_auto] sm:items-end sm:px-6">
                  <Field label="Date" htmlFor="holidayDate">
                    <DatePicker
                      id="holidayDate"
                      value={holidayDraft.date}
                      onChange={(date) => setHolidayDraft((current) => ({ ...current, date }))}
                    />
                  </Field>
                  <Field label="Holiday name" htmlFor="holidayName">
                    <Input
                      id="holidayName"
                      value={holidayDraft.name}
                      placeholder="e.g. Company anniversary"
                      onChange={(event) =>
                        setHolidayDraft((current) => ({ ...current, name: event.target.value }))
                      }
                    />
                  </Field>
                  <Field label="Type" htmlFor="holidayKind">
                    <Select<HolidayKind>
                      id="holidayKind"
                      value={holidayDraft.kind}
                      onChange={(kind) => setHolidayDraft((current) => ({ ...current, kind }))}
                      options={[
                        { value: 'local', label: 'Local' },
                        { value: 'special', label: 'Special' },
                        { value: 'regular', label: 'Regular' },
                        { value: 'islamic', label: 'Islamic' },
                      ]}
                    />
                  </Field>
                  <Button onClick={() => void addHoliday()} loading={holidayBusy}>
                    <CalendarPlus className="h-4 w-4" /> Add
                  </Button>
                </div>
                {customHolidays.length === 0 ? (
                  <p className="px-5 pb-5 text-sm text-ink-400 sm:px-6">
                    No custom holidays yet.
                  </p>
                ) : (
                  <ul className="divide-y divide-white/70 border-t border-white/70">
                    {customHolidays.map((holiday) => (
                      <li key={holiday.id ?? holiday.date} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-ink-800">{holiday.name}</span>
                          <span className="mt-0.5 block text-[11px] text-ink-400">
                            {displayDate(holiday.date, 'MMM d, yyyy')} · {holiday.kind}
                            {holiday.locality ? ` · ${holiday.locality}` : ''}
                          </span>
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={holidayBusy}
                          onClick={() => void deleteHoliday(holiday.id!, holiday.name)}
                        >
                          <Trash2 className="h-4 w-4" /> Remove
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          )}

          {/* Account */}
          {tab === 'account' && (
            <div className="space-y-4">
              <Panel className="overflow-hidden">
                <div className="border-b border-white/70 px-5 py-4 sm:px-6">
                  <h2 className="font-display text-lg font-semibold text-ink-900">Account</h2>
                  <p className="mt-0.5 text-xs text-ink-500">Sign-in, email, and privacy.</p>
                </div>

                <div className="divide-y divide-white/70">
                  <SettingRow
                    icon={UserRound}
                    title="Signed in as"
                    description={<span className="font-medium text-ink-800">{user?.email}</span>}
                  />

                  <SettingRow
                    icon={KeyRound}
                    title="Password"
                    description="We will email you a link to choose a new password."
                  >
                    <Button variant="outline" size="sm" onClick={handleReset} loading={busy}>
                      Send reset email
                    </Button>
                  </SettingRow>

                  <SettingRow
                    icon={Mail}
                    title="Email delivery"
                    description="Confirmation email goes through Brevo SMTP; password-reset and test messages use the Brevo Edge Function."
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      loading={emailBusy}
                      onClick={() => void handleEmail('test')}
                    >
                      Send test email
                    </Button>
                  </SettingRow>

                  <SettingRow
                    icon={ShieldCheck}
                    title="Private by default"
                    description="Supabase row-level security protects every entry. No other account can read or change your journal."
                  />
                </div>
              </Panel>

              <Panel className="overflow-hidden border-clay-200/70">
                <SettingRow
                  icon={LogOut}
                  tone="clay"
                  title="Sign out"
                  description="End your session on this device."
                >
                  <Button variant="danger" size="sm" onClick={handleSignOut}>
                    <LogOut className="h-4 w-4" /> Sign out
                  </Button>
                </SettingRow>
              </Panel>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}