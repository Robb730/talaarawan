import type { BreakRule, EntryInput, Schedule } from './types'

/** "08:30" or "08:30:00" -> minutes from midnight. */
export function toMinutes(value: string | null | undefined): number {
  if (!value) return 0
  const [hours = '0', minutes = '0'] = value.split(':')
  const total = Number(hours) * 60 + Number(minutes)
  return Number.isFinite(total) ? total : 0
}

/** Normalize a DB time value to "HH:mm" for <input type="time">. */
export function timeInput(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : ''
}

export function minutesBetween(start: string | null, end: string | null): number {
  if (!start || !end) return 0
  const diff = toMinutes(end) - toMinutes(start)
  return diff > 0 ? diff : 0
}

export function roundHours(value: number): number {
  return Math.round(value * 100) / 100
}

/** Sum only the breaks that are configured to be deducted. */
export function excludedBreakMinutes(rules: BreakRule[]): number {
  return rules.reduce((total, rule) => {
    if (!rule.excluded_from_rendered) return total
    const minutes =
      rule.start_time && rule.end_time
        ? minutesBetween(rule.start_time, rule.end_time)
        : rule.duration_minutes
    return total + Math.max(0, minutes)
  }, 0)
}

interface RenderedInput {
  status: EntryInput['status']
  time_in: string | null
  time_out: string | null
  break_minutes: number
  exclude_breaks: boolean
  manual_hours: number | null
}

/** Final rendered hours saved with a journal entry. */
export function computeRenderedHours(input: RenderedInput): number {
  if (input.status === 'absent' || input.status === 'leave') return 0

  if (input.manual_hours !== null && input.manual_hours > 0) {
    return roundHours(input.manual_hours)
  }

  if (!input.time_in || !input.time_out) return 0

  const worked = minutesBetween(input.time_in, input.time_out)
  const deducted = input.exclude_breaks ? Math.max(0, input.break_minutes) : 0
  return roundHours(Math.max(0, worked - deducted) / 60)
}

/** Expected hours for a weekday from its schedule + breaks. */
export function expectedHours(schedule: Schedule | undefined, rules: BreakRule[]): number {
  if (!schedule?.is_working || !schedule.time_in || !schedule.time_out) return 0
  const worked = minutesBetween(schedule.time_in, schedule.time_out)
  const deducted = excludedBreakMinutes(rules)
  return roundHours(Math.max(0, worked - deducted) / 60)
}

export function formatHours(hours: number): string {
  const rounded = roundHours(hours)
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(2).replace(/0$/, '')}h`
}

export function formatHoursLong(hours: number): string {
  const totalMinutes = Math.round(roundHours(hours) * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (!h && !m) return '0h'
  if (!h) return `${m}m`
  if (!m) return `${h}h`
  return `${h}h ${m}m`
}

/** 08:30 -> 8:30 AM */
export function formatClock(value: string | null | undefined): string {
  if (!value) return '—'
  const [h, m] = value.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return value
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`
}
