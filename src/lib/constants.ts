import type { EntryStatus } from './types'

export const WEEK_DAYS = [
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
  { value: 0, label: 'Sunday', short: 'Sun' },
] as const

export const STATUSES: { value: EntryStatus; label: string; badge: string }[] = [
  {
    value: 'worked',
    label: 'Worked',
    badge: 'bg-forest-50 text-forest-700 ring-forest-200',
  },
  {
    value: 'half_day',
    label: 'Half day',
    badge: 'bg-amber-50 text-amber-700 ring-amber-200',
  },
  {
    value: 'absent',
    label: 'Absent',
    badge: 'bg-stone-100 text-stone-600 ring-stone-200',
  },
  {
    value: 'leave',
    label: 'On leave',
    badge: 'bg-sky-50 text-sky-700 ring-sky-200',
  },
]

export const MOODS = [
  { value: 'Great', hint: 'A really good day' },
  { value: 'Good', hint: 'Steady and productive' },
  { value: 'Okay', hint: 'Nothing unusual' },
  { value: 'Tired', hint: 'Long or draining day' },
  { value: 'Rough', hint: 'A difficult day' },
] as const

export const SUGGESTED_TAGS = [
  'frontend',
  'backend',
  'database',
  'design',
  'testing',
  'documentation',
  'meeting',
  'communication',
  'problem-solving',
  'deployment',
]

export const statusMeta = (status: EntryStatus) =>
  STATUSES.find((item) => item.value === status) ?? STATUSES[0]
