export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type EntryStatus = 'worked' | 'absent' | 'leave' | 'half_day'

export interface Profile {
  id: string
  full_name: string | null
  school: string | null
  program: string | null
  company: string | null
  company_location: string | null
  company_location_code: string | null
  supervisor: string | null
  required_hours: number
  start_date: string | null
  end_date: string | null
}

export interface Schedule {
  id: string
  user_id: string
  day_of_week: number
  is_working: boolean
  time_in: string | null
  time_out: string | null
}

export interface BreakRule {
  id: string
  user_id: string
  schedule_id: string
  label: string
  start_time: string | null
  end_time: string | null
  duration_minutes: number
  excluded_from_rendered: boolean
}

export interface JournalEntry {
  id: string
  user_id: string
  entry_date: string
  status: EntryStatus
  time_in: string | null
  time_out: string | null
  break_minutes: number
  exclude_breaks: boolean
  manual_hours: number | null
  rendered_hours: number
  tasks: string
  skills_used: string | null
  learnings: string | null
  challenges: string | null
  supervisor_feedback: string | null
  next_steps: string | null
  mood: string | null
  tags: string[]
  is_favorite: boolean
  created_at: string
  updated_at: string
}

export type ProfileInput = Partial<Omit<Profile, 'id'>>

export type ScheduleInput = Omit<Schedule, 'id' | 'user_id'> & { id?: string }

export type BreakInput = Omit<BreakRule, 'id' | 'user_id'> & { id?: string }

export type EntryInput = Omit<JournalEntry, 'id' | 'user_id' | 'created_at' | 'updated_at'> & {
  id?: string
}
