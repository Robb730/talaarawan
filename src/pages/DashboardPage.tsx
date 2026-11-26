import { addDays, parseISO } from 'date-fns'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Clock3,
  FileText,
  Plus,
  Star,
} from 'lucide-react'
import { CompletionEstimate } from '../components/CompletionEstimate'
import { Badge, Button, PageHeader, Panel, ProgressBar, SectionHeader, Stat } from '../components/ui'
import { useData } from '../context/DataContext'
import { useHolidays } from '../context/HolidaysContext'
import { useOjtEstimate } from '../hooks/useOjtEstimate'
import { useUnloggedWorkdays } from '../hooks/useUnloggedWorkdays'
import { statusMeta } from '../lib/constants'
import {
  currentHour,
  dayShortName,
  displayDate,
  isoFromDate,
  todayISO,
  weekDays,
} from '../lib/date'
import { expectedHours, formatClock, formatHours } from '../lib/hours'
import { HOLIDAY_ATTRIBUTION, HOLIDAY_ATTRIBUTION_URL } from '../lib/phHolidays'

function DateChip({ iso }: { iso: string }) {
  return (
    <div className="grid h-12 w-12 shrink-0 place-content-center rounded-xl border border-paper-200 bg-paper-50/80 text-center">
      <p className="tabular font-display text-[17px] font-semibold leading-none text-ink-800">
        {displayDate(iso, 'dd')}
      </p>
      <p className="mt-1 text-[9px] font-medium uppercase tracking-[0.1em] text-ink-400">
        {displayDate(iso, 'MMM')}
      </p>
    </div>
  )
}

function CardHeader({
  title,
  description,
  to,
  linkLabel,
}: {
  title: string
  description: string
  to?: string
  linkLabel?: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-paper-200 px-5 py-4">
      <div>
        <p className="eyebrow">{title}</p>
        <p className="mt-0.5 text-xs text-ink-500">{description}</p>
      </div>
      {to && (
        <Link
          to={to}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-forest-700 transition-colors hover:bg-forest-50"
        >
          {linkLabel} <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const { profile, entries, schedules, breaks } = useData()
  const { holidayOn, upcomingHolidays } = useHolidays()
  const estimate = useOjtEstimate()
  const missingWorkdays = useUnloggedWorkdays()
  const navigate = useNavigate()

  const today = todayISO()
  const todayEntry = entries.find((entry) => entry.entry_date === today)
  const rendered = entries.reduce((sum, entry) => sum + entry.rendered_hours, 0)
  const required = profile?.required_hours ?? 0
  const remaining = Math.max(0, required - rendered)
  const percent = required > 0 ? (rendered / required) * 100 : 0
  const recent = entries.slice(0, 5)
  const average = entries.length ? rendered / entries.length : 0

  const dates = new Set(entries.map((entry) => entry.entry_date))
  let streak = 0
  let cursorISO = today
  if (!dates.has(cursorISO)) cursorISO = isoFromDate(addDays(parseISO(today), -1))
  while (dates.has(cursorISO)) {
    streak += 1
    cursorISO = isoFromDate(addDays(parseISO(cursorISO), -1))
  }

  const days = weekDays().map((date) => {
    const iso = isoFromDate(date)
    const dayOfWeek = date.getDay()
    const schedule = schedules.find((item) => item.day_of_week === dayOfWeek)
    const dayBreaks = breaks.filter((item) => item.schedule_id === schedule?.id)
    return {
      iso,
      date,
      expected: expectedHours(schedule, dayBreaks),
      logged: entries.find((entry) => entry.entry_date === iso)?.rendered_hours ?? 0,
      holiday: holidayOn(iso),
    }
  })
  const weekExpected = days.reduce((sum, day) => sum + day.expected, 0)
  const weekLogged = days.reduce((sum, day) => sum + day.logged, 0)
  const holidays = upcomingHolidays(today, 4)
  const hour = currentHour()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const firstName = profile?.full_name?.split(' ')[0]

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`Dashboard · ${displayDate(today, 'EEEE, MMMM d')}`}
        title={`${greeting}${firstName ? `, ${firstName}` : ''}.`}
        subtitle="A clear view of your hours, your week, and what is left to render."
        actions={
          <>
            <Button variant="outline" data-tour="report-button" onClick={() => navigate('/reports')}>
              <FileText className="h-4 w-4" /> Report
            </Button>
            <Button
              data-tour="quick-action"
              onClick={() =>
                navigate(todayEntry ? `/journal/${todayEntry.id}/edit` : `/journal/new?date=${today}`)
              }
            >
              {todayEntry ? <BookOpen className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {todayEntry ? 'Edit your log today' : 'Add new entry'}
            </Button>
          </>
        }
      />

      {missingWorkdays.length > 0 && (
        <div data-tour="missing-days">
          <Panel className="border-amber-200/70 bg-amber-50/45 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-amber-200/80 bg-amber-100/70 text-amber-700">
                  <CalendarDays className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink-900">
                    {missingWorkdays.length} scheduled workday
                    {missingWorkdays.length === 1 ? '' : 's'} without a log
                  </p>
                  <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-ink-500">
                    They are counted as days off in your estimate. If you worked and forgot to log,
                    add the entry and your finish date will update.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
                {missingWorkdays.slice(0, 3).map((day) => (
                  <Link
                    key={day.date}
                    to={`/journal/new?date=${day.date}`}
                    className="inline-flex items-center gap-1 rounded-full border border-amber-200/80 bg-white/65 px-2.5 py-1.5 text-[11px] font-medium text-amber-800 backdrop-blur-md transition-colors hover:bg-white"
                  >
                    Log {displayDate(day.date, 'MMM d')}
                  </Link>
                ))}
                {missingWorkdays.length > 3 && (
                  <Link
                    to="/journal?missing=1"
                    className="rounded-full px-2 py-1.5 text-[11px] font-medium text-amber-800/80 hover:text-amber-900"
                  >
                    +{missingWorkdays.length - 3} more
                  </Link>
                )}
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* Progress + estimate */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <Panel className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Rendered hours</p>
              <div className="mt-2 flex flex-wrap items-end gap-x-2">
                <span className="tabular font-display text-[3.1rem] font-semibold leading-none tracking-[-0.04em] text-ink-900">
                  {formatHours(rendered)}
                </span>
                <span className="tabular pb-1 text-sm text-ink-400">
                  of {formatHours(required)} required
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="tabular font-display text-2xl font-semibold leading-none text-forest-700">
                {Math.round(percent)}%
              </p>
              <p className="mt-1 text-[10px] text-forest-700/70">complete</p>
            </div>
          </div>

          <ProgressBar value={percent} className="mt-5 h-2.5" />

          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {[
              {
                label: 'Remaining',
                value: formatHours(remaining),
                hint: remaining === 0 ? 'Target reached' : 'To render',
              },
              { label: 'Daily average', value: formatHours(average), hint: 'Per logged day' },
              { label: 'Entries', value: entries.length, hint: 'Days recorded' },
              { label: 'Streak', value: `${streak}d`, hint: 'Consecutive logs' },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-paper-200 bg-paper-50/60 px-3.5 py-3"
              >
                <Stat label={item.label} value={item.value} hint={item.hint} />
              </div>
            ))}
          </div>

          {profile?.start_date && (
            <p className="mt-4 flex items-center gap-1.5 text-[11px] text-ink-400">
              <Clock3 className="h-3.5 w-3.5" /> OJT started: {displayDate(profile.start_date)}
            </p>
          )}
        </Panel>

        <div data-tour="estimate">
          <CompletionEstimate estimate={estimate} tone="dark" />
        </div>
      </div>

      {/* Week + today */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <Panel className="p-5 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">This week</p>
              <p className="mt-1 text-sm text-ink-600">
                <span className="font-semibold text-ink-900">{formatHours(weekLogged)}</span> logged
                <span className="text-ink-300"> / </span>
                {formatHours(weekExpected)} expected
              </p>
            </div>
            <Link
              to="/journal"
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-forest-700 transition-colors hover:bg-forest-50"
            >
              View journal <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5">
            {days.map((day) => {
              const isToday = day.iso === today
              const isPast = day.iso < today
              const isOff = day.expected === 0 && day.logged === 0
              const isMissing = isPast && day.expected > 0 && day.logged === 0
              const fill =
                day.logged > 0
                  ? day.expected > 0
                    ? Math.min(100, (day.logged / day.expected) * 100)
                    : 100
                  : 0
              return (
                <div key={day.iso} className="text-center">
                  <p
                    className={`mb-1.5 text-[10px] font-medium ${
                      isToday ? 'text-forest-700' : 'text-ink-400'
                    }`}
                  >
                    {dayShortName(day.date.getDay())}
                  </p>
                  <div
                    className={`relative flex h-[4.8rem] flex-col items-center justify-center overflow-hidden rounded-xl border text-xs transition-colors ${
                      isToday
                        ? 'border-forest-400 bg-forest-50 ring-2 ring-forest-200/70'
                        : isOff
                          ? 'border-dashed border-paper-200 bg-transparent'
                          : 'border-paper-200 bg-white'
                    }`}
                    title={`${day.iso}: ${formatHours(day.logged)} logged, ${formatHours(day.expected)} expected`}
                  >
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 bottom-0 bg-forest-200/60 transition-[height] duration-500"
                      style={{ height: `${fill}%` }}
                    />
                    <span
                      className={`tabular relative font-display text-base font-semibold ${
                        isToday ? 'text-forest-800' : isOff ? 'text-ink-300' : 'text-ink-700'
                      }`}
                    >
                      {day.date.getDate()}
                    </span>
                    <span
                      className={`tabular relative mt-0.5 text-[9px] ${
                        day.logged > 0
                          ? 'font-medium text-forest-800'
                          : isMissing
                            ? 'font-medium text-amber-600'
                            : 'text-ink-300'
                      }`}
                    >
                      {day.logged > 0 ? formatHours(day.logged) : isMissing ? 'Missed' : '—'}
                    </span>
                    {day.holiday && (
                      <span
                        className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-amber-500"
                        title={`${day.holiday.name} (PH holiday)`}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-paper-200 pt-3 text-[10px] text-ink-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-forest-200/80" /> Logged vs expected
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> PH holiday
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm border border-dashed border-ink-300" /> Day off
            </span>
          </div>
        </Panel>

        <Panel className="flex flex-col p-5 sm:p-6">
          <SectionHeader
            title="Today"
            description={displayDate(today, 'EEEE, MMM d')}
            action={
              todayEntry && (
                <Badge className={statusMeta(todayEntry.status).badge}>
                  {statusMeta(todayEntry.status).label}
                </Badge>
              )
            }
          />

          {todayEntry ? (
            <div className="flex flex-1 flex-col">
              <div className="flex items-end justify-between gap-3">
                <p className="tabular font-display text-[2.4rem] font-semibold leading-none tracking-[-0.03em] text-ink-900">
                  {formatHours(todayEntry.rendered_hours)}
                </p>
                <p className="tabular pb-1 text-xs text-ink-400">
                  {formatClock(todayEntry.time_in)} – {formatClock(todayEntry.time_out)}
                </p>
              </div>
              <p className="mt-4 line-clamp-3 flex-1 rounded-xl border border-paper-200 bg-paper-50/60 px-3.5 py-3 text-sm leading-relaxed text-ink-600">
                {todayEntry.tasks}
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-ink-400">
                  {todayEntry.break_minutes > 0 && todayEntry.exclude_breaks
                    ? `${todayEntry.break_minutes} min break excluded`
                    : 'No break deduction'}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/journal/${todayEntry.id}/edit`)}
                >
                  Edit your log today <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-start justify-center rounded-xl border border-dashed border-paper-300 bg-paper-50/50 p-5">
              <p className="font-display text-lg font-semibold leading-snug text-ink-900">
                No entry for today yet.
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
                A few honest sentences are enough. Your estimate updates as soon as you save.
              </p>
              {estimate.status === 'estimated' && (
                <p className="mt-2 text-[11px] text-ink-400">
                  Estimated finish: {displayDate(estimate.endDate!, 'MMMM d, yyyy')}.
                </p>
              )}
              <Button className="mt-4" onClick={() => navigate(`/journal/new?date=${today}`)}>
                <Plus className="h-4 w-4" /> Add new entry
              </Button>
            </div>
          )}
        </Panel>
      </div>

      {/* Recent + holidays */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <Panel className="overflow-hidden">
          <CardHeader
            title="Recent entries"
            description="The last few days you recorded."
            to="/journal"
            linkLabel="View all"
          />

          {recent.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-ink-500">Your journal is still empty.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => navigate(`/journal/new?date=${today}`)}
              >
                <Plus className="h-3.5 w-3.5" /> Write the first entry
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-paper-200">
              {recent.map((entry) => (
                <li key={entry.id}>
                  <Link
                    to={`/journal/${entry.id}/edit`}
                    className="group flex items-center gap-3.5 px-5 py-3 transition-colors hover:bg-paper-50"
                  >
                    <DateChip iso={entry.entry_date} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink-800">{entry.tasks}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-[10px] text-ink-400">
                          {displayDate(entry.entry_date, 'EEEE')}
                        </span>
                        {entry.is_favorite && (
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        )}
                        {entry.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-paper-100 px-1.5 py-0.5 text-[10px] text-ink-500"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="tabular text-sm font-semibold text-ink-800">
                        {formatHours(entry.rendered_hours)}
                      </p>
                      <p className="text-[10px] text-ink-400">{statusMeta(entry.status).label}</p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-ink-500" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="flex flex-col overflow-hidden">
          <CardHeader title="Upcoming holidays" description="National holidays after today, plus your own." />
          {holidays.length === 0 ? (
            <p className="px-5 py-8 text-sm text-ink-400">
              No more holidays in the current data range.
            </p>
          ) : (
            <ul className="divide-y divide-paper-200">
              {holidays.map((holiday) => (
                <li key={holiday.date} className="flex items-center gap-3.5 px-5 py-3">
                  <DateChip iso={holiday.date} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink-800">{holiday.name}</p>
                    <p className="mt-1 text-[10px] text-ink-400">
                      {holiday.source === 'custom'
                        ? 'Your holiday'
                        : holiday.kind === 'regular'
                          ? 'Regular holiday'
                          : holiday.kind === 'islamic'
                            ? 'Islamic holiday'
                            : 'Special non-working'}
                      {holiday.estimated ? ' · estimated' : ''}
                    </p>
                  </div>
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-auto border-t border-paper-200 px-5 py-3 text-[10px] leading-relaxed text-ink-400">
            From your OJT start date onward, including your own entries.{' '}
            <a
              href={HOLIDAY_ATTRIBUTION_URL}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              {HOLIDAY_ATTRIBUTION}
            </a>
          </p>
        </Panel>
      </div>
    </div>
  )
}