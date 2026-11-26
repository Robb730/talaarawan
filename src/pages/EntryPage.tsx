import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { EntryForm } from '../components/EntryForm'
import { Button, EmptyState, PageHeader } from '../components/ui'
import { useData } from '../context/DataContext'
import { clampLogDate, dayOfWeek, displayDate, todayISO } from '../lib/date'
import { excludedBreakMinutes } from '../lib/hours'

/** Mirrors the real layout (form + summary) so nothing jumps when data arrives. */
function EntrySkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl animate-pulse" aria-busy="true" aria-label="Loading entry">
      <div className="mb-6 h-4 w-28 rounded bg-ink-100" />
      <div className="mb-2 h-9 w-56 max-w-full rounded bg-ink-100" />
      <div className="mb-8 h-4 w-80 max-w-full rounded bg-ink-100" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="h-96 rounded-2xl bg-ink-100" />
        <div className="hidden h-72 rounded-2xl bg-ink-100 xl:block" />
      </div>
    </div>
  )
}

export default function EntryPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { profile, entries, schedules, breaks, loading } = useData()

  if (loading) return <EntrySkeleton />

  // A new-entry URL for a date that already has a log opens that log for editing.
  const dateParam = clampLogDate(searchParams.get('date') ?? todayISO(), profile?.start_date)
  const entry = id
    ? entries.find((item) => item.id === id) ?? null
    : entries.find((item) => item.entry_date === dateParam) ?? null

  if (id && !entry) {
    return (
      <EmptyState
        title="Entry not found"
        description="It may have been deleted, or it belongs to another account."
        action={<Button onClick={() => navigate('/journal')}>Back to journal</Button>}
      />
    )
  }

  const targetDate = entry?.entry_date ?? dateParam
  const schedule = schedules.find((item) => item.day_of_week === dayOfWeek(targetDate))
  const dayBreaks = breaks.filter((item) => item.schedule_id === schedule?.id)

  return (
    // min-w-0 lets this column shrink inside the app shell's flex layout instead of overflowing it.
    <div className="mx-auto w-full min-w-0 max-w-6xl">
      <Link
        to="/journal"
        className="mb-5 inline-flex items-center gap-1.5 rounded-md text-xs font-medium text-ink-400 transition-colors hover:text-ink-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-800"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to journal
      </Link>

      <PageHeader
        eyebrow={entry ? 'Journal · Edit entry' : 'Journal · New entry'}
        title={entry ? displayDate(targetDate, 'EEEE, MMMM d') : 'Log a day'}
        subtitle={
          entry
            ? 'Update the details for this day. Changes are saved to your private journal.'
            : 'Record your hours and keep a short reflection of the day.'
        }
      />

      <EntryForm
        entry={entry}
        initialDate={dateParam}
        defaultBreakMinutes={excludedBreakMinutes(dayBreaks)}
        defaultExcludeBreaks={dayBreaks.length === 0 || dayBreaks.some((item) => item.excluded_from_rendered)}
      />
    </div>
  )
}