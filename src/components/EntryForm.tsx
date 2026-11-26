import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  Info,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import { useData } from '../context/DataContext'
import { useUnloggedWorkdays } from '../hooks/useUnloggedWorkdays'
import { useFeedback } from './Feedback'
import { MOODS, SUGGESTED_TAGS, STATUSES, WEEK_DAYS, statusMeta } from '../lib/constants'
import { clampLogDate, dayOfWeek, displayDate, todayISO } from '../lib/date'
import {
  computeRenderedHours,
  excludedBreakMinutes,
  expectedHours,
  formatClock,
  formatHours,
  formatHoursLong,
} from '../lib/hours'
import { useHolidays } from '../context/HolidaysContext'
import type { EntryStatus, JournalEntry } from '../lib/types'
import { DatePicker } from './fields'
import type { DateMark } from './fields'
import { TimeField } from './TimeField'
import { Badge, Button, Field, Input, Panel, Textarea, Toggle } from './ui'

interface FormState {
  entry_date: string
  status: EntryStatus
  time_in: string
  time_out: string
  break_minutes: number
  exclude_breaks: boolean
  use_schedule_times: boolean
  use_manual_hours: boolean
  manual_hours: number
  tasks: string
  skills_used: string
  learnings: string
  challenges: string
  supervisor_feedback: string
  next_steps: string
  mood: string
  tags: string[]
  is_favorite: boolean
}

function stateFromEntry(entry: JournalEntry | null, date: string, breakMinutes: number): FormState {
  if (!entry) {
    return {
      entry_date: date,
      status: 'worked',
      time_in: '',
      time_out: '',
      break_minutes: breakMinutes,
      exclude_breaks: true,
      use_schedule_times: false,
      use_manual_hours: false,
      manual_hours: 0,
      tasks: '',
      skills_used: '',
      learnings: '',
      challenges: '',
      supervisor_feedback: '',
      next_steps: '',
      mood: '',
      tags: [],
      is_favorite: false,
    }
  }
  return {
    entry_date: entry.entry_date,
    status: entry.status,
    time_in: entry.time_in?.slice(0, 5) ?? '',
    time_out: entry.time_out?.slice(0, 5) ?? '',
    break_minutes: entry.break_minutes,
    exclude_breaks: entry.exclude_breaks,
    use_schedule_times: false,
    use_manual_hours: entry.manual_hours !== null,
    manual_hours: entry.manual_hours ?? 0,
    tasks: entry.tasks,
    skills_used: entry.skills_used ?? '',
    learnings: entry.learnings ?? '',
    challenges: entry.challenges ?? '',
    supervisor_feedback: entry.supervisor_feedback ?? '',
    next_steps: entry.next_steps ?? '',
    mood: entry.mood ?? '',
    tags: entry.tags,
    is_favorite: entry.is_favorite,
  }
}

export function EntryForm({
  entry,
  initialDate,
  defaultBreakMinutes,
  defaultExcludeBreaks,
}: {
  entry: JournalEntry | null
  initialDate: string
  defaultBreakMinutes: number
  defaultExcludeBreaks: boolean
}) {
  const { profile, entries, schedules, breaks, saveEntry, deleteEntry } = useData()
  const { holidayOn, holidays } = useHolidays()
  const missingWorkdays = useUnloggedWorkdays()
  const { toast, confirm } = useFeedback()
  const navigate = useNavigate()
  const today = todayISO()
  const minDate = profile?.start_date ?? ''
  const [activeEntryId, setActiveEntryId] = useState<string | null>(entry?.id ?? null)
  const draftKey = `ojt-draft-${activeEntryId ?? initialDate}`

  const freshFormForDate = (date: string): FormState => {
    const next = stateFromEntry(null, date, defaultBreakMinutes)
    next.exclude_breaks = defaultExcludeBreaks
    const schedule = schedules.find((item) => item.day_of_week === dayOfWeek(date))
    if (schedule?.time_in && schedule?.time_out) {
      next.use_schedule_times = true
      next.time_in = schedule.time_in.slice(0, 5)
      next.time_out = schedule.time_out.slice(0, 5)
    }
    return next
  }

  const [form, setForm] = useState<FormState>(() => {
    const initial = entry
      ? stateFromEntry(entry, initialDate, defaultBreakMinutes)
      : freshFormForDate(initialDate)
    let state = initial
    try {
      const raw = localStorage.getItem(draftKey)
      if (raw) {
        const saved = JSON.parse(raw) as { savedAt: string; state: FormState }
        if (saved.state && (!entry || new Date(saved.savedAt) > new Date(entry.updated_at))) {
          state = {
            ...initial,
            ...saved.state,
            tags: Array.isArray(saved.state.tags) ? saved.state.tags : initial.tags,
          }
        }
      }
    } catch {
      // Ignore corrupted drafts.
    }
    // Never start a draft on a future date or before the OJT began.
    return { ...state, entry_date: clampLogDate(state.entry_date, minDate, today) }
  })
  const [tagDraft, setTagDraft] = useState('')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setDirty(true)
    setForm((current) => ({ ...current, [key]: value }))
  }

  // Choosing a date that already has a log loads it so the fields show the
  // previously entered details and saving updates that entry instead of
  // overwriting it with a blank form.
  const changeDate = (value: string) => {
    const existing = entries.find((item) => item.entry_date === value)
    if (existing) {
      setActiveEntryId(existing.id)
      setForm(stateFromEntry(existing, value, defaultBreakMinutes))
      setDirty(false)
      return
    }
    setActiveEntryId(null)
    setForm(freshFormForDate(value))
    setDirty(false)
  }

  useEffect(() => {
    if (!dirty) return
    const timer = window.setTimeout(() => {
      localStorage.setItem(draftKey, JSON.stringify({ savedAt: new Date().toISOString(), state: form }))
    }, 500)
    return () => window.clearTimeout(timer)
  }, [form, draftKey, dirty])

  const duplicate = useMemo(
    () => entries.find((item) => item.entry_date === form.entry_date && item.id !== activeEntryId),
    [entries, form.entry_date, activeEntryId],
  )

  // Mark the OJT start day and past scheduled days that were never logged in
  // the date picker, so a forgotten entry is easy to spot while choosing a date.
  const marks = useMemo<DateMark[]>(() => {
    const list: DateMark[] = []
    if (profile?.start_date) list.push({ date: profile.start_date, kind: 'start' })
    holidays.forEach((holiday) => list.push({ date: holiday.date, kind: 'holiday' }))
    missingWorkdays.forEach((day) => list.push({ date: day.date, kind: 'missing' }))
    return list
  }, [profile, holidays, missingWorkdays])
  const selectedMark = marks.find((mark) => mark.date === form.entry_date)

  const weekday = dayOfWeek(form.entry_date)
  const selectedSchedule = schedules.find((item) => item.day_of_week === weekday)
  const selectedBreaks = breaks.filter((item) => item.schedule_id === selectedSchedule?.id)
  const scheduleBreakMinutes = excludedBreakMinutes(selectedBreaks)
  const scheduleExpected = expectedHours(selectedSchedule, selectedBreaks)
  const holiday = holidayOn(form.entry_date)
  const countsAsWork = form.status === 'worked' || form.status === 'half_day'
  const timesDisabled = form.use_manual_hours || !countsAsWork
  const timeIn = form.use_schedule_times
    ? selectedSchedule?.time_in?.slice(0, 5) ?? ''
    : form.time_in
  const timeOut = form.use_schedule_times
    ? selectedSchedule?.time_out?.slice(0, 5) ?? ''
    : form.time_out
  const hasScheduleTimes = Boolean(
    selectedSchedule?.is_working && selectedSchedule.time_in && selectedSchedule.time_out,
  )

  const setUseScheduleTimes = (checked: boolean) => {
    setDirty(true)
    setForm((current) => ({
      ...current,
      use_schedule_times: checked,
      ...(checked
        ? {
            time_in: selectedSchedule?.time_in?.slice(0, 5) ?? current.time_in,
            time_out: selectedSchedule?.time_out?.slice(0, 5) ?? current.time_out,
          }
        : {}),
    }))
  }

  const preview = computeRenderedHours({
    status: form.status,
    time_in: timeIn || null,
    time_out: timeOut || null,
    break_minutes: Number(form.break_minutes) || 0,
    exclude_breaks: form.exclude_breaks,
    manual_hours: form.use_manual_hours ? Number(form.manual_hours) || 0 : null,
  })

  const addTag = (raw: string) => {
    const tag = raw.trim().toLowerCase().replace(/^#/, '')
    if (!tag) return
    if (!form.tags.includes(tag)) set('tags', [...form.tags, tag])
    setTagDraft('')
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!form.entry_date) {
      setError('Choose an entry date.')
      return
    }
    if (form.entry_date > today) {
      setError('You cannot log a date in the future.')
      return
    }
    if (minDate && form.entry_date < minDate) {
      setError(`Your OJT starts on ${displayDate(minDate)}. You can only log from that day onward.`)
      return
    }
    if (countsAsWork && form.tasks.trim().length < 3) {
      setError('Write at least a short description of what you did.')
      return
    }
    if (countsAsWork && form.use_manual_hours && Number(form.manual_hours) <= 0) {
      setError('Enter the number of hours you rendered.')
      return
    }
    if (countsAsWork && !form.use_manual_hours && (!timeIn || !timeOut)) {
      setError('Provide time in and time out, or switch to manual hours.')
      return
    }

    setBusy(true)
    try {
      const saved = await saveEntry({
        id: activeEntryId ?? undefined,
        entry_date: form.entry_date,
        status: form.status,
        time_in: timeIn || null,
        time_out: timeOut || null,
        break_minutes: Math.max(0, Number(form.break_minutes) || 0),
        exclude_breaks: form.exclude_breaks,
        manual_hours: form.use_manual_hours ? Math.max(0, Number(form.manual_hours) || 0) : null,
        rendered_hours: preview,
        tasks: form.tasks.trim(),
        skills_used: form.skills_used.trim() || null,
        learnings: form.learnings.trim() || null,
        challenges: form.challenges.trim() || null,
        supervisor_feedback: form.supervisor_feedback.trim() || null,
        next_steps: form.next_steps.trim() || null,
        mood: form.mood || null,
        tags: form.tags,
        is_favorite: form.is_favorite,
      })
      localStorage.removeItem(draftKey)
      setDirty(false)
      toast(activeEntryId ? 'Entry updated' : 'Entry saved', {
        description: `${displayDate(saved.entry_date, 'MMM d, yyyy')} · ${formatHoursLong(saved.rendered_hours)} rendered.`,
      })
      navigate('/journal', { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to save the entry.')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!activeEntryId) return
    const confirmed = await confirm({
      title: 'Delete this entry?',
      description: `The journal entry for ${displayDate(form.entry_date, 'MMMM d, yyyy')} will be permanently removed.`,
      confirmLabel: 'Delete entry',
      danger: true,
    })
    if (!confirmed) return

    setBusy(true)
    try {
      await deleteEntry(activeEntryId)
      localStorage.removeItem(draftKey)
      toast('Entry deleted', { description: 'The day has been removed from your journal.' })
      navigate('/journal', { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to delete the entry.')
    } finally {
      setBusy(false)
    }
  }

  const checks = [
    { label: 'Date chosen', done: Boolean(form.entry_date) },
    {
      label: countsAsWork ? 'Time in and out' : 'Day status set',
      done: !countsAsWork || form.use_manual_hours || Boolean(timeIn && timeOut),
    },
    { label: 'Tasks described', done: form.tasks.trim().length >= 3 },
  ]

  return (
    <form onSubmit={handleSubmit} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-5">
        {error && (
          <div className="rounded-lg border border-clay-200 bg-clay-50 px-4 py-3 text-sm text-clay-700">
            {error}
          </div>
        )}
        {duplicate && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            An entry already exists for {displayDate(form.entry_date)}. Saving will replace it — the
            journal keeps one entry per day.
          </div>
        )}

        <Panel>
          <div className="border-b border-paper-200 px-5 py-4">
            <h2 className="font-display text-lg font-semibold text-ink-900">Attendance</h2>
            <p className="mt-0.5 text-xs text-ink-500">
              Record the day, your hours, and how breaks should be treated.
            </p>
          </div>
          <div className="space-y-5 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date" htmlFor="entryDate" required>
                <DatePicker
                  id="entryDate"
                  value={form.entry_date}
                  onChange={changeDate}
                  min={minDate || undefined}
                  max={today}
                  clearable={false}
                  marks={marks}
                />
                {minDate > today && (
                  <p className="mt-1.5 text-[11px] leading-relaxed text-ink-400">
                    Your OJT starts on {displayDate(minDate)} — you can log from that day onward.
                  </p>
                )}
                {selectedMark && (
                  <p
                    className={`mt-1.5 text-[11px] leading-relaxed ${
                      selectedMark.kind === 'start' ? 'text-forest-700' : 'text-amber-700'
                    }`}
                  >
                    {selectedMark.kind === 'start'
                      ? 'This is the first day of your OJT.'
                      : 'A scheduled workday with no log — add one now if you worked.'}
                  </p>
                )}
              </Field>
              <div>
                <span className="field-label mb-1.5 block">Status</span>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {STATUSES.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => set('status', item.value)}
                      className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                        form.status === item.value
                          ? 'border-forest-600 bg-forest-50 text-forest-800'
                          : 'border-paper-200 bg-white text-ink-500 hover:border-paper-300 hover:text-ink-800'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {holiday && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  <strong>{holiday.name}</strong> is{' '}
                  {holiday.source === 'custom'
                    ? 'on your holiday list'
                    : 'a Philippine national holiday'}
                  .
                  {holiday.estimated ? ' Date is estimated until officially proclaimed.' : ''} OJT
                  hours are usually not rendered unless required.
                </span>
              </div>
            )}

            <div className="rounded-lg border border-paper-200 bg-paper-50 px-3.5 py-2.5 text-xs leading-relaxed text-ink-500">
              {selectedSchedule?.is_working ? (
                <>
                  <span className="font-medium text-ink-700">
                    {WEEK_DAYS.find((day) => day.value === weekday)?.label} schedule:
                  </span>{' '}
                  {formatClock(selectedSchedule.time_in)} – {formatClock(selectedSchedule.time_out)} ·{' '}
                  {formatHours(scheduleExpected)} expected with breaks.
                </>
              ) : (
                <>
                  No working hours are set for{' '}
                  {WEEK_DAYS.find((day) => day.value === weekday)?.label}. You can still log this day
                  if you worked.
                </>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <TimeField
                id="timeIn"
                label="Time in"
                value={timeIn}
                onChange={(value) => set('time_in', value)}
                disabled={timesDisabled || form.use_schedule_times}
                hint={form.use_schedule_times ? 'From your saved schedule.' : undefined}
              />
              <TimeField
                id="timeOut"
                label="Time out"
                value={timeOut}
                onChange={(value) => set('time_out', value)}
                disabled={timesDisabled || form.use_schedule_times}
                hint={form.use_schedule_times ? 'From your saved schedule.' : undefined}
              />
              <div>
                <div className="mb-1.5 flex items-baseline justify-between">
                  <label htmlFor="breakMinutes" className="field-label">
                    Break minutes
                  </label>
                  {selectedBreaks.length > 0 && (
                    <button
                      type="button"
                      onClick={() => set('break_minutes', scheduleBreakMinutes)}
                      className="text-[10px] font-medium text-forest-700 hover:underline"
                    >
                      Use schedule ({scheduleBreakMinutes}m)
                    </button>
                  )}
                </div>
                <Input
                  id="breakMinutes"
                  type="number"
                  min={0}
                  value={form.break_minutes}
                  onChange={(event) => set('break_minutes', Number(event.target.value))}
                  disabled={timesDisabled}
                />
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <Toggle
                checked={form.exclude_breaks}
                onChange={(checked) => set('exclude_breaks', checked)}
                label="Exclude breaks from rendered hours"
                description="Turn off if breaks count as working time."
                disabled={timesDisabled}
              />
              <Toggle
                checked={form.use_schedule_times}
                onChange={setUseScheduleTimes}
                label="Use my usual time in / out"
                description={
                  hasScheduleTimes
                    ? `${formatClock(timeIn)} – ${formatClock(timeOut)} from your ${
                        WEEK_DAYS.find((day) => day.value === weekday)?.label ?? ''
                      } schedule. Turn off to edit.`
                    : 'No saved times for this weekday yet.'
                }
                disabled={timesDisabled || (!hasScheduleTimes && !form.use_schedule_times)}
              />
              <Toggle
                checked={form.use_manual_hours}
                onChange={(checked) => set('use_manual_hours', checked)}
                label="Enter hours manually"
                description="For days without exact time records."
                disabled={!countsAsWork}
              />
            </div>

            {form.use_manual_hours && countsAsWork && (
              <div className="max-w-[14rem]">
                <Field label="Rendered hours" htmlFor="manualHours">
                  <Input
                    id="manualHours"
                    type="number"
                    min={0}
                    step="0.25"
                    value={form.manual_hours}
                    onChange={(event) => set('manual_hours', Number(event.target.value))}
                  />
                </Field>
              </div>
            )}

            {!countsAsWork && (
              <p className="text-xs leading-relaxed text-ink-400">
                Absent and leave days are recorded without rendered hours.
              </p>
            )}
          </div>
        </Panel>

        <Panel>
          <div className="border-b border-paper-200 px-5 py-4">
            <h2 className="font-display text-lg font-semibold text-ink-900">Reflection</h2>
            <p className="mt-0.5 text-xs text-ink-500">
              A short, honest account is more useful than a perfect one.
            </p>
          </div>
          <div className="space-y-5 p-5">
            <Field label="Tasks and accomplishments" htmlFor="tasks" required={countsAsWork}>
              <Textarea
                id="tasks"
                value={form.tasks}
                onChange={(event) => set('tasks', event.target.value)}
                placeholder="What did you work on? What did you finish or move forward?"
                rows={5}
              />
            </Field>

            <div>
              <span className="field-label mb-2 block">How was the day?</span>
              <div className="flex flex-wrap gap-1.5">
                {MOODS.map((mood) => (
                  <button
                    key={mood.value}
                    type="button"
                    title={mood.hint}
                    onClick={() => set('mood', form.mood === mood.value ? '' : mood.value)}
                    className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                      form.mood === mood.value
                        ? 'border-forest-600 bg-forest-50 text-forest-800'
                        : 'border-paper-200 bg-white text-ink-500 hover:border-paper-300 hover:text-ink-800'
                    }`}
                  >
                    {mood.value}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Skills used" htmlFor="skills" hint="Optional">
                <Input
                  id="skills"
                  value={form.skills_used}
                  onChange={(event) => set('skills_used', event.target.value)}
                  placeholder="React, SQL, communication"
                />
              </Field>
              <Field label="Tags" htmlFor="tagInput" hint="Optional — add your own or pick a suggestion">
                <div className="flex gap-2">
                  <Input
                    id="tagInput"
                    value={tagDraft}
                    onChange={(event) => setTagDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        addTag(tagDraft)
                      }
                    }}
                    placeholder="Add a tag"
                  />
                  <Button type="button" variant="outline" onClick={() => addTag(tagDraft)} aria-label="Add tag">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </Field>
            </div>

            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {form.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full border border-paper-200 bg-paper-100 px-2.5 py-1 text-[11px] text-ink-600"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => set('tags', form.tags.filter((item) => item !== tag))}
                      className="text-ink-400 hover:text-clay-600"
                      aria-label={`Remove ${tag}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_TAGS.filter((tag) => !form.tags.includes(tag)).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => addTag(tag)}
                  className="rounded-full border border-dashed border-paper-300 px-2.5 py-1 text-[11px] text-ink-400 transition-colors hover:border-forest-300 hover:text-forest-700"
                >
                  + {tag}
                </button>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="What I learned" htmlFor="learnings" hint="Optional">
                <Textarea
                  id="learnings"
                  value={form.learnings}
                  onChange={(event) => set('learnings', event.target.value)}
                  rows={3}
                />
              </Field>
              <Field label="Challenges encountered" htmlFor="challenges" hint="Optional">
                <Textarea
                  id="challenges"
                  value={form.challenges}
                  onChange={(event) => set('challenges', event.target.value)}
                  rows={3}
                />
              </Field>
              <Field label="Supervisor feedback" htmlFor="feedback" hint="Optional">
                <Textarea
                  id="feedback"
                  value={form.supervisor_feedback}
                  onChange={(event) => set('supervisor_feedback', event.target.value)}
                  rows={2}
                />
              </Field>
              <Field label="Next steps" htmlFor="nextSteps" hint="Optional">
                <Textarea
                  id="nextSteps"
                  value={form.next_steps}
                  onChange={(event) => set('next_steps', event.target.value)}
                  rows={2}
                />
              </Field>
            </div>

            <Toggle
              checked={form.is_favorite}
              onChange={(checked) => set('is_favorite', checked)}
              label="Mark as favorite"
              description="Keep an important entry easy to find in the journal."
            />
          </div>
        </Panel>
      </div>

      {/* Sticky summary */}
      <aside className="space-y-4 lg:sticky lg:top-6">
        <Panel className="overflow-hidden">
          <div className="border-b border-paper-200 bg-paper-100/60 px-5 py-4">
            <p className="eyebrow">Entry summary</p>
            <p className="mt-1 font-display text-lg font-semibold leading-tight text-ink-900">
              {displayDate(form.entry_date, 'EEE, MMM d, yyyy')}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Badge className={statusMeta(form.status).badge}>{statusMeta(form.status).label}</Badge>
              {holiday && (
                <Badge className="bg-amber-50 text-amber-700 ring-amber-200">PH holiday</Badge>
              )}
            </div>
          </div>

          <div className="p-5">
            <p className="eyebrow">Rendered hours</p>
            <p className="tabular mt-1 font-display text-[2.6rem] font-semibold leading-none tracking-[-0.03em] text-ink-900">
              {formatHoursLong(preview)}
            </p>
            <p className="mt-1.5 text-[11px] text-ink-400">
              {form.use_manual_hours
                ? 'Manual hours override'
                : form.exclude_breaks
                  ? `${form.break_minutes} min of breaks deducted`
                  : 'Breaks counted as working time'}
            </p>

            <dl className="mt-4 space-y-2 border-t border-paper-200 pt-4 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-400">Scheduled</dt>
                <dd className="text-right text-ink-700">
                  {selectedSchedule?.is_working
                    ? `${formatClock(selectedSchedule.time_in)} – ${formatClock(selectedSchedule.time_out)}`
                    : 'No schedule'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-400">Expected hours</dt>
                <dd className="tabular text-ink-700">{formatHours(scheduleExpected)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-400">Break deduction</dt>
                <dd className="tabular text-ink-700">
                  {form.exclude_breaks ? `${form.break_minutes} min` : 'None'}
                </dd>
              </div>
              {holiday && (
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-400">Holiday</dt>
                  <dd className="text-right text-ink-700">{holiday.name}</dd>
                </div>
              )}
            </dl>

            <div className="mt-4 border-t border-paper-200 pt-4">
              <p className="field-label mb-2">Before saving</p>
              <ul className="space-y-1.5">
                {checks.map((check) => (
                  <li key={check.label} className="flex items-center gap-2 text-[11px]">
                    {check.done ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-forest-600" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 text-ink-300" />
                    )}
                    <span className={check.done ? 'text-ink-600' : 'text-ink-400'}>{check.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-5 space-y-2">
              <Button type="submit" className="w-full" loading={busy}>
                <Save className="h-4 w-4" /> {activeEntryId ? 'Save changes' : 'Save entry'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => navigate('/journal')}
              >
                Cancel
              </Button>
            </div>

            {activeEntryId && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-medium text-ink-400 transition-colors hover:bg-clay-50 hover:text-clay-600 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete this entry
              </button>
            )}
          </div>
        </Panel>

        <div className="flex items-start gap-2 px-1 text-[11px] leading-relaxed text-ink-400">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            {dirty
              ? 'Draft saved automatically on this device.'
              : 'Changes are saved as a local draft while you type.'}{' '}
            Nothing is published — only your account can read this entry.
          </p>
        </div>

        <div className="flex items-center gap-2 px-1 text-[11px] text-ink-400">
          <Clock3 className="h-3.5 w-3.5" /> One entry per day, editable at any time.
        </div>
      </aside>
    </form>
  )
}
