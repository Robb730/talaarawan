import { useMemo } from 'react'
import { useData } from '../context/DataContext'
import { useHolidays } from '../context/HolidaysContext'
import { findUnloggedWorkdays } from '../lib/estimate'
import type { MissingWorkday } from '../lib/estimate'
import { expectedHours } from '../lib/hours'

/** Past scheduled workdays with no journal entry (treated as days off). */
export function useUnloggedWorkdays(): MissingWorkday[] {
  const { profile, schedules, breaks, entries } = useData()
  const { holidays } = useHolidays()

  return useMemo(() => {
    const dailyHours: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
    schedules.forEach((schedule) => {
      const dayBreaks = breaks.filter((rule) => rule.schedule_id === schedule.id)
      dailyHours[schedule.day_of_week] = expectedHours(schedule, dayBreaks)
    })

    return findUnloggedWorkdays({
      startDate: profile?.start_date ?? null,
      dailyHours,
      loggedDates: entries.map((entry) => entry.entry_date),
      holidays,
    })
  }, [profile, schedules, breaks, entries, holidays])
}
