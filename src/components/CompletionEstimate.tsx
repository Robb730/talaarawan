import { Link } from 'react-router-dom'
import {
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  Check,
  Info,
  MoveUpRight,
  PartyPopper,
} from 'lucide-react'
import { displayDate } from '../lib/date'
import { formatHoursLong } from '../lib/hours'
import { HOLIDAY_ATTRIBUTION, HOLIDAY_ATTRIBUTION_URL, HOLIDAY_DATA_NOTE } from '../lib/phHolidays'
import type { EstimateResult } from '../lib/estimate'
import { Badge } from './ui'

/* -------------------------------------------------------------------------- */
/*  Copy helpers                                                              */
/* -------------------------------------------------------------------------- */

function dateLabel(estimate: EstimateResult): string {
  if (estimate.status === 'complete') return 'Hours completed'
  if (!estimate.endDate) return 'Schedule needed'
  return displayDate(estimate.endDate, 'MMMM d, yyyy')
}

function summaryLine(estimate: EstimateResult): string {
  if (estimate.status === 'complete') {
    return 'You have reached the required number of hours.'
  }
  if (estimate.status === 'no-schedule') {
    return 'Add your weekly working hours in Settings to calculate a finish date.'
  }
  return `About ${estimate.workingDaysNeeded} working day${estimate.workingDaysNeeded === 1 ? '' : 's'} at ${formatHoursLong(estimate.weeklyHours)} per week. Unlogged workdays are counted as days off.`
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

/* -------------------------------------------------------------------------- */
/*  Props                                                                     */
/* -------------------------------------------------------------------------- */

interface Props {
  estimate: EstimateResult
  tone?: 'light' | 'dark'
  compact?: boolean
  showDetails?: boolean
  showHolidayInfo?: boolean
  className?: string
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export function CompletionEstimate({
  estimate,
  tone = 'light',
  compact = false,
  showDetails = true,
  showHolidayInfo = true,
  className = '',
}: Props) {
  const skipped = estimate.skippedHolidays.length
  const nextHoliday = estimate.upcomingHolidays[0]
  const isEstimated = estimate.status === 'estimated'
  const isComplete = estimate.status === 'complete'

  /* ---------------------------- Compact (sidebar) ---------------------------- */
  if (compact) {
    const dark = tone === 'dark'
    const headline = isEstimated && estimate.endDate
      ? displayDate(estimate.endDate, 'MMM d, yyyy')
      : isComplete
        ? 'Completed'
        : 'Set your schedule'

    const chips: string[] = []
    if (isEstimated) {
      chips.push(`${plural(estimate.workingDaysNeeded, 'day')} left`)
      chips.push(`${formatHoursLong(estimate.lastDayHours)} last day`)
      if (skipped) chips.push(`${plural(skipped, 'holiday')} off`)
    }

    return (
      <div
        className={`rounded-2xl p-3.5 ${
          dark
            ? 'bg-gradient-to-br from-forest-300/[0.22] via-forest-300/[0.08] to-white/[0.03]'
            : 'bg-white/60 backdrop-blur-xl'
        } ${className}`}
      >
        <div
          className={`flex items-center gap-1.5 text-[11px] font-medium ${
            dark ? 'text-forest-200/85' : 'text-ink-400'
          }`}
        >
          {isComplete ? (
            <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
          ) : (
            <CalendarCheck2 className="h-3.5 w-3.5" />
          )}
          Estimated finish
        </div>

        <p
          className={`mt-2 font-display text-[22px] font-semibold leading-none tracking-[-0.01em] ${
            dark ? 'text-paper-50' : 'text-ink-900'
          }`}
        >
          {headline}
        </p>

        {showDetails &&
          (isEstimated ? (
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Estimate details">
              {chips.map((chip) => (
                <li
                  key={chip}
                  className={`tabular rounded-full px-2 py-1 text-[10.5px] font-medium leading-none ${
                    dark ? 'bg-black/20 text-forest-100/85' : 'bg-forest-50 text-forest-700'
                  }`}
                >
                  {chip}
                </li>
              ))}
            </ul>
          ) : (
            <p className={`mt-2 text-[11px] leading-snug ${dark ? 'text-forest-200/70' : 'text-ink-400'}`}>
              {isComplete ? 'Required hours reached.' : 'Add your weekly working hours in Settings.'}
            </p>
          ))}
      </div>
    )
  }

  /* ------------------------------- Dark (hero) ------------------------------- */
  if (tone === 'dark') {
    const stats = isEstimated
      ? [
          { label: 'Working days', value: String(estimate.workingDaysNeeded) },
          { label: 'Calendar span', value: `${estimate.calendarDays}d` },
          { label: 'Final day', value: formatHoursLong(estimate.lastDayHours) },
        ]
      : []

    return (
      <div
        className={`glass-dark relative overflow-hidden rounded-3xl p-5 text-paper-50 sm:p-6 ${className}`}
      >
        {/* soft light, no lines */}
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-forest-300/20 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-forest-200">Estimated last day</p>
              <p className="mt-2 font-display text-[1.9rem] font-semibold leading-none tracking-[-0.015em] text-paper-50 sm:text-[2.3rem]">
                {dateLabel(estimate)}
              </p>
            </div>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 text-forest-100">
              {isComplete ? <PartyPopper className="h-[18px] w-[18px]" /> : <CalendarClock className="h-[18px] w-[18px]" />}
            </span>
          </div>

          <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-forest-100/80">
            {summaryLine(estimate)}
          </p>

          {isEstimated && estimate.lastDayPartial && (
            <p className="mt-3 inline-flex rounded-full bg-forest-200/15 px-2.5 py-1 text-[11px] font-medium text-forest-100">
              Partial last day
            </p>
          )}

          {stats.length > 0 && (
            <div className="mt-5 grid grid-cols-3 gap-2">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-2xl bg-white/[0.07] px-3 py-2.5">
                  <p className="tabular font-display text-xl font-semibold leading-none">{stat.value}</p>
                  <p className="mt-1.5 text-[11px] text-forest-200/75">{stat.label}</p>
                </div>
              ))}
            </div>
          )}

          {estimate.status === 'no-schedule' && (
            <Link
              to="/settings"
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-xs font-medium text-paper-50 transition-colors hover:bg-white/[0.16]"
            >
              Set your schedule <MoveUpRight className="h-3.5 w-3.5" />
            </Link>
          )}

          {estimate.lateAgainstTarget && (
            <p className="mt-3 rounded-xl bg-clay-500/15 px-3 py-2 text-[11px] leading-snug text-clay-100">
              This lands after your target end date of{' '}
              {displayDate(estimate.targetEndDate!, 'MMM d, yyyy')}.
            </p>
          )}

          {showHolidayInfo && isEstimated && (
            <div className="mt-4 space-y-1.5 rounded-2xl bg-black/[0.16] px-3.5 py-3 text-[11.5px] leading-relaxed text-forest-200/85">
              <p>
                {skipped > 0
                  ? `${plural(skipped, 'holiday')} excluded from this estimate.`
                  : 'No holidays fall on your working days in this estimate.'}{' '}
                Unlogged workdays are treated as days off, so add an entry if you actually worked.
              </p>
              {nextHoliday && (
                <p className="text-forest-300/85">
                  Next holiday: {nextHoliday.name}, {displayDate(nextHoliday.date, 'MMM d, yyyy')}
                  {nextHoliday.estimated ? ' (estimated)' : ''}
                </p>
              )}
              <p className="text-forest-300/70">
                <a
                  href={HOLIDAY_ATTRIBUTION_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2 hover:text-paper-50"
                >
                  {HOLIDAY_ATTRIBUTION}
                </a>
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  /* --------------------------------- Light ---------------------------------- */
  return (
    <div className={`panel p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[12px] font-medium text-ink-400">
            <CalendarCheck2 className="h-3.5 w-3.5 text-forest-600" /> Estimated last day
          </p>
          <p className="mt-2 font-display text-2xl font-semibold leading-tight text-ink-900">
            {dateLabel(estimate)}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-500">{summaryLine(estimate)}</p>
          {isEstimated && (
            <p className="mt-2 inline-flex rounded-full bg-forest-50 px-2.5 py-1 text-[11px] font-medium text-forest-700">
              {formatHoursLong(estimate.lastDayHours)} needed on {displayDate(estimate.endDate!, 'MMM d')}
            </p>
          )}
        </div>
        {isEstimated && (
          <Badge className="border-forest-200 bg-forest-50 text-forest-700">
            {estimate.workingDaysNeeded} days
          </Badge>
        )}
      </div>

      {estimate.lateAgainstTarget && (
        <p className="mt-3 rounded-xl bg-clay-50 px-3 py-2 text-[11px] leading-snug text-clay-700">
          Past your target end date ({displayDate(estimate.targetEndDate!, 'MMM d, yyyy')}).
        </p>
      )}

      {(showHolidayInfo || nextHoliday) && (
        <div className="mt-4 space-y-2 rounded-2xl bg-paper-100/60 px-3.5 py-3 text-[11px] leading-relaxed text-ink-400">
          {showHolidayInfo && (
            <p className="flex gap-2">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {skipped > 0
                  ? `Skips ${plural(skipped, 'holiday')} in this period. `
                  : 'No holidays fall on working days in this period. '}
                Days without a journal entry are treated as days off. {HOLIDAY_DATA_NOTE}{' '}
                <a
                  href={HOLIDAY_ATTRIBUTION_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  {HOLIDAY_ATTRIBUTION}
                </a>
              </span>
            </p>
          )}
          {nextHoliday && (
            <p className="flex items-center gap-2">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              <span>
                Next holiday: {nextHoliday.name}, {displayDate(nextHoliday.date, 'MMM d, yyyy')}
                {nextHoliday.estimated ? ' (estimated)' : ''}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}