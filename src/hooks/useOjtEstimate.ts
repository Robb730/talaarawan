import { useMemo } from 'react'
import { useData } from '../context/DataContext'
import { useHolidays } from '../context/HolidaysContext'
import { estimateCompletion } from '../lib/estimate'
import type { EstimateResult } from '../lib/estimate'
import { expectedHours } from '../lib/hours'

export function useOjtEstimate(): EstimateResult {
  const { profile, schedules, breaks, entries } = useData()
  const { holidays } = useHolidays()

  return useMemo(() => {
    const dailyHours: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
    schedules.forEach((schedule) => {
      const dayBreaks = breaks.filter((rule) => rule.schedule_id === schedule.id)
      dailyHours[schedule.day_of_week] = expectedHours(schedule, dayBreaks)
    })

    return estimateCompletion({
      startDate: profile?.start_date ?? null,
      targetEndDate: profile?.end_date ?? null,
      requiredHours: profile?.required_hours ?? 0,
      renderedHours: entries.reduce((sum, entry) => sum + entry.rendered_hours, 0),
      dailyHours,
      loggedDates: entries.map((entry) => entry.entry_date),
      holidays,
    })
  }, [profile, schedules, breaks, entries, holidays])
}
