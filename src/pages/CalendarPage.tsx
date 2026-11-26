import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { addDays, addMonths, isSameMonth, startOfMonth, startOfWeek } from 'date-fns'
import {
  ArrowLeft,
  Ban,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Flag,
  Plus,
  Sparkles,
} from 'lucide-react'
import { useFeedback } from '../components/Feedback'
import { Badge, Button, PageHeader, Panel } from '../components/ui'
import { useData } from '../context/DataContext'
import { useHolidays } from '../context/HolidaysContext'
import { useOjtEstimate } from '../hooks/useOjtEstimate'
import { useUnloggedWorkdays } from '../hooks/useUnloggedWorkdays'
import { statusMeta } from '../lib/constants'
import { displayDate, isoFromDate, todayISO } from '../lib/date'
import { formatHours } from '../lib/hours'
import type { PhHoliday } from '../lib/phHolidays'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const legend = [
  { label: 'First day', className: 'bg-forest-700' },
  { label: 'Estimated last day', className: 'bg-forest-900' },
  { label: 'Logged', className: 'bg-forest-100 ring-1 ring-forest-300' },
  { label: 'Not logged', className: 'bg-amber-100 ring-1 ring-amber-300' },
  { label: 'Holiday', className: 'bg-sky-100 ring-1 ring-sky-300' },
  { label: 'Holiday disabled', className: 'bg-paper-200 ring-1 ring-paper-300' },
  { label: 'Weekend / unavailable', className: 'bg-paper-100 ring-1 ring-paper-200' },
]

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/70 bg-white/60 px-3.5 py-3 backdrop-blur-md">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-400">{label}</p>
      <p className="mt-1 truncate font-display text-[15px] font-semibold text-ink-900">{value}</p>
      {hint && <p className="mt-0.5 truncate text-[10px] text-ink-400">{hint}</p>}
    </div>
  )
}

export default function CalendarPage() {
  const { profile, entries } = useData()
  const { holidays, apiHolidays, ignoredHolidays, ignoreHoliday, restoreHoliday } = useHolidays()
  const estimate = useOjtEstimate()
  const missingWorkdays = useUnloggedWorkdays()
  const { toast } = useFeedback()
  const navigate = useNavigate()

  const today = todayISO()
  const [view, setView] = useState(() => new Date())
  const [selected, setSelected] = useState(today)
  const [busyDate, setBusyDate] = useState<string | null>(null)

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(view), { weekStartsOn: 1 })
    return Array.from({ length: 42 }, (_, index) => addDays(start, index))
  }, [view])

  const entryMap = useMemo(() => new Map(entries.map((entry) => [entry.entry_date, entry])), [entries])
  const missingSet = useMemo(() => new Set(missingWorkdays.map((day) => day.date)), [missingWorkdays])
  const holidayMap = useMemo(() => new Map(holidays.map((holiday) => [holiday.date, holiday])), [holidays])
  const apiHolidayMap = useMemo(
    () => new Map(apiHolidays.map((holiday) => [holiday.date, holiday])),
    [apiHolidays],
  )
  const ignoredSet = useMemo(() => new Set(ignoredHolidays.map((h) => h.date)), [ignoredHolidays])

  const startDate = profile?.start_date ?? ''
  const endDate = estimate.status === 'estimated' ? estimate.endDate : null

  const selectedEntry = entryMap.get(selected)
  const selectedHoliday = apiHolidayMap.get(selected)
  const selectedIgnored = Boolean(selectedHoliday && ignoredSet.has(selected))
  const selectedMissing = missingSet.has(selected) && !selectedIgnored
  const selectedBeforeStart = Boolean(startDate && selected < startDate)
  const selectedFuture = selected > today
  const selectedIsStart = Boolean(startDate && selected === startDate)

  const toggleHoliday = async (holiday: PhHoliday) => {
    setBusyDate(holiday.date)
    try {
      if (ignoredSet.has(holiday.date)) {
        await restoreHoliday(holiday.date)
        toast('Holiday restored', { description: `${holiday.name} is excluded from your estimate again.` })
      } else {
        await ignoreHoliday(holiday)
        toast('Holiday disabled', {
          description: `${holiday.name} now counts as a normal scheduled work day.`,
        })
      }
    } catch (cause) {
      toast('Could not update holiday', {
        description: cause instanceof Error ? cause.message : 'Please try again.',
        variant: 'error',
      })
    } finally {
      setBusyDate(null)
    }
  }

  return (
    <div>
      <Link
        to="/journal"
        className="mb-5 inline-flex items-center gap-1.5 text-xs font-medium text-ink-400 transition-colors hover:text-ink-800"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to journal
      </Link>

      <PageHeader
        eyebrow="Journal · Calendar"
        title="Your OJT at a glance."
        subtitle="Every day in one view — your first day, estimated finish, logs, missed days, and holidays."
        actions={
          <Button onClick={() => navigate('/journal/new')}>
            <Plus className="h-4 w-4" /> New entry
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="First day" value={startDate ? displayDate(startDate, 'MMM d, yyyy') : 'Not set'} />
        <StatCard
          label="Estimated last day"
          value={endDate ? displayDate(endDate, 'MMM d, yyyy') : '—'}
          hint={estimate.status === 'estimated' ? `${estimate.workingDaysNeeded} working days left` : undefined}
        />
        <StatCard label="Logged days" value={String(entries.length)} hint={`${formatHours(entries.reduce((sum, e) => sum + e.rendered_hours, 0))} rendered`} />
        <StatCard label="Not logged yet" value={String(missingWorkdays.length)} hint="Scheduled workdays" />
        <StatCard label="Holidays ahead" value={String(holidays.filter((h) => h.date >= today).length)} hint="From your start date" />
      </div>

      <Panel className="mb-4 p-3.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {legend.map((item) => (
            <span key={item.label} className="inline-flex items-center gap-1.5 text-[10px] text-ink-500">
              <span className={`h-2.5 w-2.5 rounded-[3px] ${item.className}`} /> {item.label}
            </span>
          ))}
        </div>
      </Panel>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Panel className="overflow-hidden p-3.5 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setView((current) => addMonths(current, -1))}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="font-display text-lg font-semibold text-ink-900">
              {displayDate(isoFromDate(startOfMonth(view)), 'MMMM yyyy')}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setView(new Date())}>
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setView((current) => addMonths(current, 1))}
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {WEEKDAY_LABELS.map((label) => (
              <span
                key={label}
                className="pb-1 text-center text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-400"
              >
                {label}
              </span>
            ))}
            {days.map((date) => {
              const iso = isoFromDate(date)
              const entry = entryMap.get(iso)
              const holiday = holidayMap.get(iso)
              const ignored = ignoredSet.has(iso)
              const missing = missingSet.has(iso)
              const isStart = Boolean(startDate) && iso === startDate
              const isEnd = Boolean(endDate) && iso === endDate
              const weekend = date.getDay() === 0 || date.getDay() === 6
              const unavailable = Boolean(startDate && iso < startDate) || iso > today
              const active = iso === selected

              let tile =
                'border-white/70 bg-white/55 text-ink-700 hover:bg-white/90'
              if (unavailable || (weekend && !entry && !holiday && !missing)) {
                tile = 'border-paper-200 bg-paper-100/80 text-ink-400 hover:bg-paper-200/70'
              } else if (entry) {
                tile = 'border-forest-200 bg-forest-50/90 text-forest-900 hover:bg-forest-100'
              } else if (holiday && !ignored) {
                tile = 'border-sky-200 bg-sky-50/90 text-sky-900 hover:bg-sky-100'
              } else if (missing) {
                tile = 'border-amber-200 bg-amber-50/90 text-amber-900 hover:bg-amber-100'
              } else if (ignored) {
                tile = 'border-paper-200 bg-paper-100/70 text-ink-400'
              }
              if (isEnd) tile = 'border-forest-900 bg-forest-900 text-paper-50'
              if (isStart) tile = 'border-forest-700 bg-forest-700 text-paper-50'

              const label = isStart
                ? 'First day'
                : isEnd
                  ? 'Est. last day'
                  : entry
                    ? `${formatHours(entry.rendered_hours)} logged`
                    : holiday && !ignored
                      ? holiday.name
                      : ignored
                        ? 'Holiday disabled'
                        : missing
                          ? 'Not logged'
                          : weekend
                            ? 'Weekend'
                            : ''

              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => setSelected(iso)}
                  title={`${displayDate(iso, 'EEEE, MMMM d, yyyy')}${label ? ` — ${label}` : ''}`}
                  aria-pressed={active}
                  className={`relative flex min-h-[76px] flex-col items-start rounded-xl border p-2 text-left transition-colors sm:min-h-[96px] sm:p-2.5 ${tile} ${
                    active ? 'ring-2 ring-forest-500 ring-offset-1' : ''
                  } ${!isSameMonth(date, view) ? 'opacity-55' : ''}`}
                >
                  <span className="tabular text-sm font-semibold leading-none sm:text-base">
                    {date.getDate()}
                  </span>
                  <span className="mt-auto w-full truncate text-[10px] leading-tight sm:text-[11px]">
                    {label}
                  </span>
                  {(isStart || isEnd) && (
                    <span className="absolute right-2 top-2">
                      {isStart ? <Flag className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                    </span>
                  )}
                  {entry && !isStart && !isEnd && (
                    <span className="absolute right-2 top-2 text-forest-600">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </Panel>

        <Panel className="p-5">
          <p className="eyebrow">Selected day</p>
          <h2 className="mt-1 font-display text-lg font-semibold text-ink-900">
            {displayDate(selected, 'EEEE, MMMM d')}
          </h2>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {selectedIsStart && (
              <Badge className="bg-forest-700 text-paper-50 ring-forest-700">First day</Badge>
            )}
            {endDate === selected && (
              <Badge className="bg-forest-900 text-paper-50 ring-forest-900">Estimated last day</Badge>
            )}
            {selectedEntry && (
              <Badge className={statusMeta(selectedEntry.status).badge}>
                {statusMeta(selectedEntry.status).label}
              </Badge>
            )}
            {selectedHoliday && (
              <Badge className="bg-sky-50 text-sky-700 ring-sky-200">
                {selectedIgnored ? 'Holiday disabled' : 'Holiday'}
              </Badge>
            )}
            {selectedMissing && (
              <Badge className="bg-amber-50 text-amber-700 ring-amber-200">Not logged</Badge>
            )}
            {selectedBeforeStart && (
              <Badge className="bg-paper-100 text-ink-500 ring-paper-200">Before start date</Badge>
            )}
            {selectedFuture && (
              <Badge className="bg-paper-100 text-ink-500 ring-paper-200">Future date</Badge>
            )}
          </div>

          <div className="mt-4 space-y-3 text-xs leading-relaxed text-ink-500">
            {selectedEntry ? (
              <>
                <p>
                  <strong className="text-ink-800">{formatHours(selectedEntry.rendered_hours)}</strong>{' '}
                  rendered on this day.
                </p>
                {selectedEntry.tasks && (
                  <p className="rounded-lg bg-paper-100/70 p-2.5 text-ink-600">{selectedEntry.tasks}</p>
                )}
                <Link
                  to={`/journal/${selectedEntry.id}/edit`}
                  className="inline-flex items-center gap-1 font-medium text-forest-700 underline underline-offset-2"
                >
                  Edit this entry <ArrowLeft className="h-3 w-3 rotate-180" />
                </Link>
              </>
            ) : selectedMissing ? (
              <>
                <p>This was a scheduled workday with no journal entry.</p>
                <Link
                  to={`/journal/new?date=${selected}`}
                  className="inline-flex items-center gap-1 font-medium text-forest-700 underline underline-offset-2"
                >
                  Log this day <ArrowLeft className="h-3 w-3 rotate-180" />
                </Link>
              </>
            ) : (
              <p>
                {selectedFuture
                  ? 'You cannot log future dates.'
                  : selectedBeforeStart
                    ? 'Your OJT had not started yet on this date.'
                    : selectedHoliday && !selectedIgnored
                      ? 'A holiday from the API. If your office does not observe it, disable it so the estimate treats it as a work day.'
                      : 'No entry for this day.'}
              </p>
            )}
          </div>

          {selectedHoliday && (
            <div className="mt-4 border-t border-paper-200 pt-4">
              <p className="font-medium text-ink-800">{selectedHoliday.name}</p>
              <p className="mt-0.5 text-[11px] text-ink-400">
                {selectedIgnored
                  ? 'Disabled — counted as a normal scheduled work day.'
                  : 'Counted as a non-working holiday.'}
              </p>
              <Button
                size="sm"
                variant={selectedIgnored ? 'outline' : 'ghost'}
                className="mt-3"
                loading={busyDate === selected}
                onClick={() => void toggleHoliday(selectedHoliday)}
              >
                {selectedIgnored ? <CalendarDays className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                {selectedIgnored ? 'Restore holiday' : 'Disable holiday'}
              </Button>
            </div>
          )}

          {!selectedEntry && !selectedBeforeStart && !selectedFuture && (
            <Link
              to={`/journal/new?date=${selected}`}
              className="mt-4 flex items-center justify-center gap-1.5 rounded-lg border border-forest-200 bg-forest-50/60 px-3 py-2 text-xs font-medium text-forest-700 transition-colors hover:bg-forest-100"
            >
              <Plus className="h-3.5 w-3.5" /> Log a day
            </Link>
          )}
        </Panel>
      </div>
    </div>
  )
}
