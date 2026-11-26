import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { displayDate, todayISO } from '../lib/date'
import { computeRenderedHours } from '../lib/hours'
import type {
  BreakInput,
  BreakRule,
  EntryInput,
  JournalEntry,
  Profile,
  ProfileInput,
  Schedule,
  ScheduleInput,
} from '../lib/types'
import { useAuth } from './AuthContext'

interface DataContextValue {
  profile: Profile | null
  schedules: Schedule[]
  breaks: BreakRule[]
  entries: JournalEntry[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  saveProfile: (input: ProfileInput) => Promise<void>
  saveSchedule: (schedules: ScheduleInput[], breaks: BreakInput[]) => Promise<void>
  saveEntry: (input: EntryInput) => Promise<JournalEntry>
  deleteEntry: (id: string) => Promise<void>
}

const DataContext = createContext<DataContextValue | null>(null)

function messageOf(error: { message?: string } | null): string {
  return error?.message ?? 'Something went wrong. Please try again.'
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [breaks, setBreaks] = useState<BreakRule[]>([])
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const loadedForRef = useRef<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Stay "loading" until the current user's profile has actually been fetched.
  const loading = authLoading || (user !== null && loadedFor !== user.id) || dataLoading

  const refresh = useCallback(async () => {
    if (!user) {
      setProfile(null)
      setSchedules([])
      setBreaks([])
      setEntries([])
      loadedForRef.current = null
      setLoadedFor(null)
      setDataLoading(false)
      return
    }

    // Only blank the screen on the first load for this account. Background
    // refreshes (e.g. after saving or a token refresh) keep the existing data.
    if (loadedForRef.current !== user.id) setDataLoading(true)
    const [profileRes, scheduleRes, breakRes, entryRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('schedules').select('*').eq('user_id', user.id).order('day_of_week'),
      supabase.from('breaks').select('*').eq('user_id', user.id),
      supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('entry_date', { ascending: false }),
    ])

    const failure = [profileRes.error, scheduleRes.error, breakRes.error, entryRes.error].find(
      (item) => item != null,
    )
    setError(failure ? messageOf(failure) : null)

    // A missing row is fine: the app shows first-time setup and creates the
    // profile when the user saves it. Never insert on load — that produced a
    // 400 on databases that had not run the latest profile migration.
    setProfile((profileRes.data as Profile | null) ?? null)
    setSchedules((scheduleRes.data as Schedule[]) ?? [])
    setBreaks((breakRes.data as BreakRule[]) ?? [])
    setEntries((entryRes.data as JournalEntry[]) ?? [])
    loadedForRef.current = user.id
    setLoadedFor(user.id)
    setDataLoading(false)
  }, [user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const saveProfile = useCallback(
    async (input: ProfileInput) => {
      if (!user) throw new Error('You must be signed in.')
      const { error: saveError } = await supabase
        .from('profiles')
        .upsert({ ...input, id: user.id })
      if (!saveError) {
        await refresh()
        return
      }

      // Older databases may not have the optional location columns yet. Save
      // the rest of the profile instead of failing the whole first-time setup.
      if (/company_location/i.test(saveError.message)) {
        const fallback = { ...input }
        delete fallback.company_location
        delete fallback.company_location_code
        const { error: retryError } = await supabase
          .from('profiles')
          .upsert({ ...fallback, id: user.id })
        if (!retryError) {
          await refresh()
          return
        }
        throw new Error(messageOf(retryError))
      }

      throw new Error(messageOf(saveError))
    },
    [user, refresh],
  )

  const saveSchedule = useCallback(
    async (nextSchedules: ScheduleInput[], nextBreaks: BreakInput[]) => {
      if (!user) throw new Error('You must be signed in.')

      const scheduleRows = nextSchedules.map((item) => ({
        ...item,
        id: item.id ?? crypto.randomUUID(),
        user_id: user.id,
      }))
      const keepIds = scheduleRows.map((item) => item.id)

      const { data: existing } = await supabase.from('schedules').select('id').eq('user_id', user.id)
      const removedIds = (existing ?? [])
        .map((item) => item.id as string)
        .filter((id) => !keepIds.includes(id))

      if (removedIds.length) {
        const { error: deleteError } = await supabase.from('schedules').delete().in('id', removedIds)
        if (deleteError) throw new Error(messageOf(deleteError))
      }

      if (scheduleRows.length) {
        const { error: upsertError } = await supabase.from('schedules').upsert(scheduleRows)
        if (upsertError) throw new Error(messageOf(upsertError))
      }

      const { error: clearBreaksError } = await supabase.from('breaks').delete().eq('user_id', user.id)
      if (clearBreaksError) throw new Error(messageOf(clearBreaksError))

      const breakRows = nextBreaks.map((item) => ({
        ...item,
        id: crypto.randomUUID(),
        user_id: user.id,
      }))
      if (breakRows.length) {
        const { error: insertError } = await supabase.from('breaks').insert(breakRows)
        if (insertError) throw new Error(messageOf(insertError))
      }

      await refresh()
    },
    [user, refresh],
  )

  const saveEntry = useCallback(
    async (input: EntryInput): Promise<JournalEntry> => {
      if (!user) throw new Error('You must be signed in.')

      // Entries are only allowed from the OJT start date through today.
      if (input.entry_date > todayISO()) {
        throw new Error('You cannot log a date in the future.')
      }
      if (profile?.start_date && input.entry_date < profile.start_date) {
        throw new Error(
          `Your OJT starts on ${displayDate(profile.start_date)}. You can only log from that day onward.`,
        )
      }

      const { id, ...rest } = input
      const payload = {
        ...rest,
        rendered_hours: computeRenderedHours(rest),
        user_id: user.id,
      }

      let targetId = id
      if (!targetId) {
        const { data: existing } = await supabase
          .from('journal_entries')
          .select('id')
          .eq('user_id', user.id)
          .eq('entry_date', rest.entry_date)
          .maybeSingle()
        targetId = (existing?.id as string) ?? undefined
      }

      const query = targetId
        ? supabase.from('journal_entries').update(payload).eq('id', targetId).eq('user_id', user.id)
        : supabase.from('journal_entries').insert(payload)

      const { data, error: saveError } = await query.select().single()
      if (saveError) throw new Error(messageOf(saveError))
      await refresh()
      return data as JournalEntry
    },
    [user, refresh, profile],
  )

  const deleteEntry = useCallback(
    async (id: string) => {
      const { error: deleteError } = await supabase
        .from('journal_entries')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id ?? '')
      if (deleteError) throw new Error(messageOf(deleteError))
      await refresh()
    },
    [user, refresh],
  )

  const value = useMemo<DataContextValue>(
    () => ({
      profile,
      schedules,
      breaks,
      entries,
      loading,
      error,
      refresh,
      saveProfile,
      saveSchedule,
      saveEntry,
      deleteEntry,
    }),
    [
      profile,
      schedules,
      breaks,
      entries,
      loading,
      error,
      refresh,
      saveProfile,
      saveSchedule,
      saveEntry,
      deleteEntry,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataContextValue {
  const context = useContext(DataContext)
  if (!context) throw new Error('useData must be used inside DataProvider')
  return context
}
