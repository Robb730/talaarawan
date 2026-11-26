import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import { roundHours } from './hours'
import type { PhHoliday } from './phHolidays'
import { todayISO } from './date'

export type EstimateStatus = 'complete' | 'estimated' | 'no-schedule'

export interface EstimateInput {
  today?: string
  startDate?: string | null
  targetEndDate?: string | null
  requiredHours: number
  renderedHours: number
  /** Expected rendered hours per weekday (0 = Sunday … 6 = Saturday). */
  dailyHours: Record<number, number>
  loggedDates?: string[]
  /** Holidays from HolidaysContext, already limited to the OJT start date onward. */
  holidays?: PhHoliday[]
}

export interface EstimateResult {
  status: EstimateStatus
  endDate: string | null
  startDate: string
  remainingHours: number
  workingDaysNeeded: number
  calendarDays: number
  lastDayHours: number
  lastDayPartial: boolean
  weeklyHours: number
  workingDaysPerWeek: number
  averageDailyHours: number
  skippedHolidays: PhHoliday[]
  upcomingHolidays: PhHoliday[]
  targetEndDate: string | null
  lateAgainstTarget: boolean
}

export function estimateCompletion({
  today = todayISO(),
  startDate = null,
  targetEndDate = null,
  requiredHours,
  renderedHours,
  dailyHours,
  loggedDates = [],
  holidays = [],
}: EstimateInput): EstimateResult {
  const remainingHours = roundHours(Math.max(0, requiredHours - renderedHours))
  const daysWithHours = Object.values(dailyHours).filter((hours) => hours > 0)
  const weeklyHours = roundHours(daysWithHours.reduce((sum, hours) => sum + hours, 0))
  const workingDaysPerWeek = daysWithHours.length
  const averageDailyHours = workingDaysPerWeek ? roundHours(weeklyHours / workingDaysPerWeek) : 0
  // A scheduled day without a journal entry is treated as a day off, including today.
  // Estimates therefore continue from tomorrow unless the OJT starts later.
  const tomorrowISO = format(addDays(parseISO(today), 1), 'yyyy-MM-dd')
  const firstDate = startDate && startDate > tomorrowISO ? startDate : tomorrowISO
  const logged = new Set(loggedDates)
  const holidayMap = new Map(holidays.map((holiday) => [holiday.date, holiday]))
  const upcoming = holidays.filter((holiday) => holiday.date >= today).slice(0, 3)

  if (remainingHours <= 0) {
    return {
      status: 'complete',
      endDate: today,
      startDate: firstDate,
      remainingHours: 0,
      workingDaysNeeded: 0,
      calendarDays: 0,
      lastDayHours: 0,
      lastDayPartial: false,
      weeklyHours,
      workingDaysPerWeek,
      averageDailyHours,
      skippedHolidays: [],
      upcomingHolidays: upcoming,
      targetEndDate,
      lateAgainstTarget: false,
    }
  }

  if (weeklyHours <= 0) {
    return {
      status: 'no-schedule',
      endDate: null,
      startDate: firstDate,
      remainingHours,
      workingDaysNeeded: 0,
      calendarDays: 0,
      lastDayHours: 0,
      lastDayPartial: false,
      weeklyHours: 0,
      workingDaysPerWeek: 0,
      averageDailyHours: 0,
      skippedHolidays: [],
      upcomingHolidays: upcoming,
      targetEndDate,
      lateAgainstTarget: false,
    }
  }

  const skippedHolidays: PhHoliday[] = []
  let remaining = remainingHours
  let cursor = parseISO(firstDate)
  let endDate: string | null = null
  let workingDaysNeeded = 0
  let lastDayHours = 0
  let lastDayPartial = false

  // Ten years is well beyond any realistic OJT, and prevents an infinite loop.
  for (let guard = 0; guard < 3650; guard += 1) {
    const iso = format(cursor, 'yyyy-MM-dd')
    const scheduledHours = dailyHours[cursor.getDay()] ?? 0

    if (scheduledHours > 0 && !logged.has(iso)) {
      const holiday = holidayMap.get(iso)
      if (holiday) {
        skippedHolidays.push(holiday)
      } else {
        const applied = Math.min(scheduledHours, remaining)
        remaining = roundHours(remaining - applied)
        workingDaysNeeded += 1
        endDate = iso
        lastDayHours = roundHours(applied)
        lastDayPartial = applied < scheduledHours - 0.01
        if (remaining <= 0) break
      }
    }

    cursor = addDays(cursor, 1)
  }

  return {
    status: endDate ? 'estimated' : 'no-schedule',
    endDate,
    startDate: firstDate,
    remainingHours,
    workingDaysNeeded,
    calendarDays: endDate ? differenceInCalendarDays(parseISO(endDate), parseISO(firstDate)) + 1 : 0,
    lastDayHours,
    lastDayPartial,
    weeklyHours,
    workingDaysPerWeek,
    averageDailyHours,
    skippedHolidays,
    upcomingHolidays: upcoming,
    targetEndDate,
    lateAgainstTarget: Boolean(endDate && targetEndDate && endDate > targetEndDate),
  }
}

export interface MissingWorkday {
  date: string
  scheduledHours: number
}

/**
 * Scheduled workdays before today that have no journal entry.
 * They are treated as days off by the estimate, but are surfaced in the UI so
 * the user can add an entry if they actually worked and simply forgot to log.
 */
export function findUnloggedWorkdays({
  today = todayISO(),
  startDate = null,
  dailyHours,
  loggedDates = [],
  lookbackDays = 60,
  holidays = [],
}: {
  today?: string
  startDate?: string | null
  dailyHours: Record<number, number>
  loggedDates?: string[]
  lookbackDays?: number
  holidays?: PhHoliday[]
}): MissingWorkday[] {
  const logged = new Set(loggedDates)
  const holidayMap = new Map(holidays.map((holiday) => [holiday.date, holiday]))
  const yesterday = addDays(parseISO(today), -1)
  const lookbackStart = addDays(yesterday, -(Math.max(1, lookbackDays) - 1))
  const profileStart = startDate ? parseISO(startDate) : lookbackStart
  let cursor = profileStart > lookbackStart ? profileStart : lookbackStart
  const missing: MissingWorkday[] = []

  while (cursor <= yesterday) {
    const iso = format(cursor, 'yyyy-MM-dd')
    const scheduledHours = dailyHours[cursor.getDay()] ?? 0
    if (scheduledHours > 0 && !logged.has(iso) && !holidayMap.has(iso)) {
      missing.push({ date: iso, scheduledHours: roundHours(scheduledHours) })
    }
    cursor = addDays(cursor, 1)
  }

  return missing.reverse()
}
