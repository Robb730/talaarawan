import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { displayDate } from '../lib/date'
import { fetchHolidaysForYears } from '../lib/holidayApi'
import type { HolidayKind, PhHoliday } from '../lib/phHolidays'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { useData } from './DataContext'

interface UserHolidayRow {
  id: string
  date: string
  name: string
  kind: string | null
  locality: string | null
}

interface IgnoredHolidayRow {
  id: string
  date: string
  name: string
  kind: string | null
}

export interface CustomHolidayInput {
  date: string
  name: string
  kind: HolidayKind
}

export type IgnoreHolidayInput = Pick<PhHoliday, 'date' | 'name' | 'kind'>

interface HolidaysContextValue {
  holidays: PhHoliday[]
  /** API holidays from the start date onward, including ignored ones. */
  apiHolidays: PhHoliday[]
  customHolidays: PhHoliday[]
  ignoredHolidays: PhHoliday[]
  liveEnabled: boolean
  loading: boolean
  holidayOn: (dateISO: string) => PhHoliday | undefined
  holidaysInRange: (fromISO: string, toISO: string) => PhHoliday[]
  upcomingHolidays: (fromISO: string, count?: number) => PhHoliday[]
  refresh: () => void
  addCustomHoliday: (input: CustomHolidayInput) => Promise<void>
  removeCustomHoliday: (id: string) => Promise<void>
  ignoreHoliday: (input: IgnoreHolidayInput) => Promise<void>
  restoreHoliday: (date: string) => Promise<void>
}

const HolidaysContext = createContext<HolidaysContextValue | null>(null)

function toCustom(row: UserHolidayRow): PhHoliday {
  return {
    id: row.id,
    date: row.date,
    name: row.name,
    kind: (row.kind as HolidayKind) || 'local',
    source: 'custom',
    locality: row.locality ?? undefined,
  }
}

function toIgnored(row: IgnoredHolidayRow): PhHoliday {
  return {
    id: row.id,
    date: row.date,
    name: row.name,
    kind: (row.kind as HolidayKind) || 'regular',
    source: 'ignored',
  }
}

function byDate(list: PhHoliday[]): PhHoliday[] {
  return [...list].sort((a, b) => a.date.localeCompare(b.date))
}

export function HolidaysProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { profile } = useData()
  const [live, setLive] = useState<PhHoliday[]>([])
  const [custom, setCustom] = useState<PhHoliday[]>([])
  const [ignored, setIgnored] = useState<PhHoliday[]>([])
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let active = true

    const run = async () => {
      setLoading(true)
      const year = new Date().getFullYear()
      const years = Array.from({ length: 5 }, (_, index) => year + index)
      const [national, customResult, ignoredResult] = await Promise.all([
        fetchHolidaysForYears(years),
        user
          ? supabase.from('user_holidays').select('*').eq('user_id', user.id).order('date')
          : Promise.resolve(null),
        user
          ? supabase.from('ignored_holidays').select('*').eq('user_id', user.id).order('date')
          : Promise.resolve(null),
      ])

      if (!active) return

      setLive(national)

      if (customResult && !customResult.error) {
        setCustom(byDate(((customResult.data ?? []) as UserHolidayRow[]).map(toCustom)))
      } else {
        setCustom([])
      }
      if (ignoredResult && !ignoredResult.error) {
        setIgnored(byDate(((ignoredResult.data ?? []) as IgnoredHolidayRow[]).map(toIgnored)))
      } else {
        setIgnored([])
      }
      setLoading(false)
    }

    void run()
    return () => {
      active = false
    }
  }, [user, version])

  // Nothing before the OJT start date is shown anywhere: custom entries are
  // filtered for the Settings list as well as the combined holiday list.
  const visibleCustom = useMemo(
    () =>
      byDate(
        custom.filter((holiday) => !profile?.start_date || holiday.date >= profile.start_date),
      ),
    [custom, profile],
  )

  const apiHolidays = useMemo(
    () =>
      byDate(
        live.filter((holiday) => !profile?.start_date || holiday.date >= profile.start_date),
      ),
    [live, profile],
  )

  const ignoredDates = useMemo(() => new Set(ignored.map((holiday) => holiday.date)), [ignored])

  const holidays = useMemo(() => {
    const merged = new Map<string, PhHoliday>()
    apiHolidays.forEach((holiday) => merged.set(holiday.date, holiday))
    visibleCustom.forEach((holiday) => merged.set(holiday.date, holiday))
    // Ignored dates are treated as ordinary working days everywhere.
    return byDate([...merged.values()].filter((holiday) => !ignoredDates.has(holiday.date)))
  }, [apiHolidays, visibleCustom, ignoredDates])

  const holidayMap = useMemo(() => new Map(holidays.map((holiday) => [holiday.date, holiday])), [holidays])

  const holidayOn = useCallback((dateISO: string) => holidayMap.get(dateISO), [holidayMap])

  const holidaysInRange = useCallback(
    (fromISO: string, toISO: string) =>
      holidays.filter((holiday) => holiday.date >= fromISO && holiday.date <= toISO),
    [holidays],
  )

  const upcomingHolidays = useCallback(
    (fromISO: string, count = 3) => holidays.filter((holiday) => holiday.date >= fromISO).slice(0, count),
    [holidays],
  )

  const refresh = useCallback(() => setVersion((value) => value + 1), [])

  const addCustomHoliday = useCallback(
    async (input: CustomHolidayInput) => {
      if (!user) throw new Error('You must be signed in.')
      if (profile?.start_date && input.date < profile.start_date) {
        throw new Error(
          `Holidays before your OJT start date (${displayDate(profile.start_date)}) are not shown.`,
        )
      }
      const { data, error } = await supabase
        .from('user_holidays')
        .insert({
          user_id: user.id,
          date: input.date,
          name: input.name.trim(),
          kind: input.kind,
          locality: profile?.company_location ?? null,
        })
        .select()
        .single()
      if (error) throw new Error(error.message)
      setCustom((current) => byDate([...current, toCustom(data as UserHolidayRow)]))
    },
    [user, profile],
  )

  const removeCustomHoliday = useCallback(async (id: string) => {
    const { error } = await supabase.from('user_holidays').delete().eq('id', id)
    if (error) throw new Error(error.message)
    setCustom((current) => current.filter((holiday) => holiday.id !== id))
  }, [])

  const ignoreHoliday = useCallback(
    async (input: IgnoreHolidayInput) => {
      if (!user) throw new Error('You must be signed in.')
      const { data, error } = await supabase
        .from('ignored_holidays')
        .upsert(
          {
            user_id: user.id,
            date: input.date,
            name: input.name,
            kind: input.kind,
          },
          { onConflict: 'user_id,date' },
        )
        .select()
        .single()
      if (error) throw new Error(error.message)
      const row = toIgnored(data as IgnoredHolidayRow)
      setIgnored((current) => byDate([...current.filter((item) => item.date !== row.date), row]))
    },
    [user],
  )

  const restoreHoliday = useCallback(
    async (date: string) => {
      if (!user) throw new Error('You must be signed in.')
      const { error } = await supabase
        .from('ignored_holidays')
        .delete()
        .eq('user_id', user.id)
        .eq('date', date)
      if (error) throw new Error(error.message)
      setIgnored((current) => current.filter((holiday) => holiday.date !== date))
    },
    [user],
  )

  const value = useMemo<HolidaysContextValue>(
    () => ({
      holidays,
      apiHolidays,
      customHolidays: visibleCustom,
      ignoredHolidays: ignored,
      liveEnabled: live.length > 0,
      loading,
      holidayOn,
      holidaysInRange,
      upcomingHolidays,
      refresh,
      addCustomHoliday,
      removeCustomHoliday,
      ignoreHoliday,
      restoreHoliday,
    }),
    [
      holidays,
      apiHolidays,
      visibleCustom,
      ignored,
      live.length,
      loading,
      holidayOn,
      holidaysInRange,
      upcomingHolidays,
      refresh,
      addCustomHoliday,
      removeCustomHoliday,
      ignoreHoliday,
      restoreHoliday,
    ],
  )

  return <HolidaysContext.Provider value={value}>{children}</HolidaysContext.Provider>
}

export function useHolidays(): HolidaysContextValue {
  const context = useContext(HolidaysContext)
  if (!context) throw new Error('useHolidays must be used inside HolidaysProvider')
  return context
}
