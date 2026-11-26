import {
  addDays,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
  startOfWeek as fnsStartOfWeek,
} from 'date-fns'

export const todayISO = (date: Date = new Date()): string => format(date, 'yyyy-MM-dd')

/**
 * Keep an entry date inside the allowed logging window: from the OJT start
 * date (when set) through today. Out-of-range dates fall back to today.
 */
export function clampLogDate(
  date: string | null | undefined,
  startDate: string | null | undefined,
  today: string = todayISO(),
): string {
  const candidate = date || today
  if (candidate > today) return today
  if (startDate && candidate < startDate) return startDate > today ? today : startDate
  return candidate
}

/** Current local hour, kept outside render so components stay pure. */
export const currentHour = (): number => new Date().getHours()

export const isoFromDate = (date: Date): string => format(date, 'yyyy-MM-dd')

export const dateFromISO = (iso: string): Date => parseISO(iso)

export function displayDate(iso: string, pattern = 'MMM d, yyyy'): string {
  try {
    return format(dateFromISO(iso), pattern)
  } catch {
    return iso
  }
}

/** 0 = Sunday ... 6 = Saturday (matches Date.getDay and the DB). */
export const dayOfWeek = (iso: string): number => dateFromISO(iso).getDay()

export const weekStart = (date: Date = new Date()): Date =>
  fnsStartOfWeek(date, { weekStartsOn: 1 })

export function weekDays(date: Date = new Date()): Date[] {
  const start = weekStart(date)
  return Array.from({ length: 7 }, (_, index) => addDays(start, index))
}

export function monthRange(date: Date = new Date()): { from: string; to: string } {
  return { from: isoFromDate(startOfMonth(date)), to: isoFromDate(endOfMonth(date)) }
}

export const dayShortName = (dayOfWeekNumber: number): string =>
  ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeekNumber] ?? ''
