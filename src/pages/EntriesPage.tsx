import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  ChevronDown,
  Clock3,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import { Badge, Button, EmptyState, IconButton, Input, PageHeader, Panel } from '../components/ui'
import { DatePicker, Select } from '../components/fields'
import { useFeedback } from '../components/Feedback'
import { useData } from '../context/DataContext'
import { useUnloggedWorkdays } from '../hooks/useUnloggedWorkdays'
import { STATUSES, statusMeta } from '../lib/constants'
import { displayDate, todayISO } from '../lib/date'
import { formatClock, formatHours } from '../lib/hours'
import type { EntryStatus } from '../lib/types'

export default function EntriesPage() {
  const { entries, deleteEntry } = useData()
  const missingWorkdays = useUnloggedWorkdays()
  const [searchParams] = useSearchParams()
  const { confirm, toast } = useFeedback()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<EntryStatus | 'all'>('all')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [sort, setSort] = useState<'newest' | 'oldest' | 'hours'>('newest')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    const result = entries.filter((entry) => {
      if (status !== 'all' && entry.status !== status) return false
      if (favoritesOnly && !entry.is_favorite) return false
      if (from && entry.entry_date < from) return false
      if (to && entry.entry_date > to) return false
      if (!term) return true
      const haystack = [
        entry.tasks,
        entry.learnings ?? '',
        entry.challenges ?? '',
        entry.skills_used ?? '',
        entry.tags.join(' '),
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(term)
    })
    return [...result].sort((a, b) => {
      if (sort === 'hours') return b.rendered_hours - a.rendered_hours
      if (sort === 'oldest') return a.entry_date.localeCompare(b.entry_date)
      return b.entry_date.localeCompare(a.entry_date)
    })
  }, [entries, search, status, favoritesOnly, from, to, sort])

  const groups = useMemo(() => {
    if (sort === 'hours') {
      return [
        {
          key: 'hours',
          label: 'Most hours first',
          entries: filtered,
          total: filtered.reduce((sum, entry) => sum + entry.rendered_hours, 0),
        },
      ]
    }
    const map = new Map<string, typeof filtered>()
    filtered.forEach((entry) => {
      const key = entry.entry_date.slice(0, 7)
      map.set(key, [...(map.get(key) ?? []), entry])
    })
    return Array.from(map.entries()).map(([key, items]) => ({
      key,
      label: displayDate(items[0].entry_date, 'MMMM yyyy'),
      entries: items,
      total: items.reduce((sum, entry) => sum + entry.rendered_hours, 0),
    }))
  }, [filtered, sort])

  const totalHours = filtered.reduce((sum, entry) => sum + entry.rendered_hours, 0)
  const allHours = entries.reduce((sum, entry) => sum + entry.rendered_hours, 0)
  const hasFilters = Boolean(search || from || to || favoritesOnly || status !== 'all')

  const clearFilters = () => {
    setSearch('')
    setStatus('all')
    setFavoritesOnly(false)
    setFrom('')
    setTo('')
    setSort('newest')
  }

  const handleDelete = async (id: string, date: string) => {
    const confirmed = await confirm({
      title: 'Delete this entry?',
      description: `The journal entry for ${displayDate(date, 'MMMM d, yyyy')} will be permanently removed.`,
      confirmLabel: 'Delete entry',
      danger: true,
    })
    if (!confirmed) return
    setDeletingId(id)
    try {
      await deleteEntry(id)
      toast('Entry deleted', { description: displayDate(date, 'MMM d, yyyy') })
    } catch (cause) {
      toast('Could not delete entry', {
        description: cause instanceof Error ? cause.message : 'Please try again.',
        variant: 'error',
      })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Journal · All entries"
        title="Every day, on the record."
        subtitle={`${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} · ${formatHours(allHours)} rendered in total.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/journal/calendar')}>
              <CalendarDays className="h-4 w-4" /> Calendar view
            </Button>
            <Button
              data-tour="new-entry"
              onClick={() => navigate(`/journal/new?date=${todayISO()}`)}
            >
              <Plus className="h-4 w-4" /> New entry
            </Button>
          </div>
        }
      />

      {missingWorkdays.length > 0 && (
        <details
          open={searchParams.get('missing') === '1'}
          className="group mb-5 rounded-2xl border border-amber-200/70 bg-amber-50/45 p-4 backdrop-blur-xl"
        >
          <summary className="flex cursor-pointer list-none items-start justify-between gap-3 [&::-webkit-details-marker]:hidden">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-amber-200/80 bg-amber-100/70 text-amber-700">
                <CalendarDays className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink-900">
                  {missingWorkdays.length} scheduled workday
                  {missingWorkdays.length === 1 ? '' : 's'} without a log
                </p>
                <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-ink-500">
                  These are treated as days off in the estimate. Open this list to add one if you
                  actually worked and forgot to log it.
                </p>
              </div>
            </div>
            <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-amber-200/80 bg-white/60 px-2.5 py-1.5 text-[11px] font-medium text-amber-800">
              Review
              <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
            </span>
          </summary>
          <div className="thin-scroll mt-4 grid max-h-56 gap-1.5 overflow-y-auto border-t border-amber-200/60 pt-3 sm:grid-cols-2 lg:grid-cols-3">
            {missingWorkdays.map((day) => (
              <Link
                key={day.date}
                to={`/journal/new?date=${day.date}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-white/70 bg-white/55 px-3 py-2 text-xs text-ink-700 backdrop-blur-md transition-colors hover:bg-white/90"
              >
                <span className="flex items-center gap-2">
                  <span className="font-medium">{displayDate(day.date, 'EEE, MMM d')}</span>
                  <span className="text-[10px] text-ink-400">
                    {formatHours(day.scheduledHours)} scheduled
                  </span>
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-forest-700">
                  Log <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            ))}
          </div>
        </details>
      )}

      {/* Filters */}
      <Panel data-tour="journal-filters" className="mb-4 space-y-2.5 p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-ink-300" />
            <Input
              className="pl-9"
              placeholder="Search tasks, skills, tags…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={() => setFavoritesOnly((value) => !value)}
            className={`inline-flex h-11 items-center gap-1.5 rounded-lg border px-3.5 text-xs font-medium backdrop-blur-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-400/50 ${
              favoritesOnly
                ? 'border-amber-300/80 bg-amber-50/90 text-amber-800'
                : 'border-white/75 bg-white/65 text-ink-500 hover:bg-white/85'
            }`}
            aria-pressed={favoritesOnly}
          >
            <Star className={`h-3.5 w-3.5 ${favoritesOnly ? 'fill-amber-400 text-amber-500' : ''}`} />
            Favorites
          </button>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            value={status}
            onChange={(value) => setStatus(value)}
            ariaLabel="Filter by status"
            options={[
              { value: 'all', label: 'All statuses' },
              ...STATUSES.map((item) => ({ value: item.value, label: item.label })),
            ]}
          />
          <DatePicker
            value={from}
            onChange={setFrom}
            placeholder="From date"
            max={to || undefined}
          />
          <DatePicker
            value={to}
            onChange={setTo}
            placeholder="To date"
            min={from || undefined}
          />
          <Select
            value={sort}
            onChange={(value) => setSort(value)}
            ariaLabel="Sort entries"
            options={[
              { value: 'newest', label: 'Newest first' },
              { value: 'oldest', label: 'Oldest first' },
              { value: 'hours', label: 'Most hours' },
            ]}
          />
        </div>
      </Panel>

      {/* Result summary */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="text-xs text-ink-500" role="status">
          Showing <span className="font-semibold text-ink-800">{filtered.length}</span> of{' '}
          {entries.length}
          {totalHours > 0 && (
            <>
              {' '}
              ·{' '}
              <span className="tabular font-semibold text-ink-800">{formatHours(totalHours)}</span> in
              view
            </>
          )}
        </p>
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1 rounded-full bg-white/60 px-2.5 py-1 text-[11px] font-medium text-ink-600 transition-colors hover:bg-white hover:text-ink-900"
          >
            <X className="h-3 w-3" /> Clear filters
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-5 w-5" />}
          title={entries.length === 0 ? 'The first page is blank' : 'No entries match these filters'}
          description={
            entries.length === 0
              ? 'Start with today. A short entry about what you did and learned is enough.'
              : 'Try a different search term, status, or date range.'
          }
          action={
            entries.length === 0 ? (
              <Button onClick={() => navigate(`/journal/new?date=${todayISO()}`)}>
                <Plus className="h-4 w-4" /> Write the first entry
              </Button>
            ) : (
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.key} aria-label={group.label}>
              <div className="mb-2.5 flex items-center justify-between gap-3 px-1">
                <h2 className="font-display text-lg font-semibold text-ink-900">{group.label}</h2>
                <p className="tabular inline-flex items-center gap-1.5 rounded-full border border-forest-200/70 bg-forest-50/70 px-2.5 py-1 text-[11px] font-medium text-forest-800">
                  <Clock3 className="h-3 w-3" />
                  {formatHours(group.total)}
                  <span className="text-forest-700/60">
                    · {group.entries.length} {group.entries.length === 1 ? 'entry' : 'entries'}
                  </span>
                </p>
              </div>

              <Panel className="overflow-hidden">
                <ul className="divide-y divide-paper-200">
                  {group.entries.map((entry) => (
                    <li key={entry.id} className="group relative">
                      <span
                        aria-hidden="true"
                        className={`absolute inset-y-0 left-0 w-[3px] transition-opacity ${
                          entry.is_favorite ? 'bg-amber-400 opacity-100' : 'bg-forest-400 opacity-0 group-hover:opacity-100'
                        }`}
                      />
                      <div className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-paper-50/80 sm:items-center sm:px-5">
                        <Link
                          to={`/journal/${entry.id}/edit`}
                          className="flex min-w-0 flex-1 items-start gap-3.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-400/50 sm:items-center"
                        >
                          <div className="grid h-12 w-12 shrink-0 place-content-center rounded-xl border border-paper-200 bg-paper-50/80 text-center">
                            <p className="text-[9px] font-medium uppercase tracking-[0.1em] text-ink-400">
                              {displayDate(entry.entry_date, 'EEE')}
                            </p>
                            <p className="tabular font-display text-lg font-semibold leading-none text-ink-800">
                              {displayDate(entry.entry_date, 'dd')}
                            </p>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-medium text-ink-800">
                                {entry.tasks || 'No tasks written'}
                              </p>
                              {entry.is_favorite && (
                                <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
                              )}
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                              <Badge className={statusMeta(entry.status).badge}>
                                {statusMeta(entry.status).label}
                              </Badge>
                              <span className="tabular text-[10px] text-ink-400">
                                {formatClock(entry.time_in)} – {formatClock(entry.time_out)}
                              </span>
                              {entry.tags.slice(0, 3).map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-full bg-paper-100 px-1.5 py-0.5 text-[10px] text-ink-500"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        </Link>

                        <div className="flex shrink-0 items-center gap-3">
                          <div className="text-right">
                            <p className="tabular font-display text-[17px] font-semibold leading-none text-ink-900">
                              {formatHours(entry.rendered_hours)}
                            </p>
                            <p className="mt-1 text-[10px] text-ink-400">rendered</p>
                          </div>
                          <div className="hidden items-center gap-1 opacity-60 transition-opacity focus-within:opacity-100 group-hover:opacity-100 sm:flex">
                            <IconButton
                              variant="outline"
                              onClick={() => navigate(`/journal/${entry.id}/edit`)}
                              aria-label={`Edit entry for ${displayDate(entry.entry_date)}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </IconButton>
                            <IconButton
                              variant="danger"
                              onClick={() => void handleDelete(entry.id, entry.entry_date)}
                              disabled={deletingId === entry.id}
                              aria-label={`Delete entry for ${displayDate(entry.entry_date)}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </IconButton>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 px-4 pb-3.5 pl-[4.75rem] sm:hidden">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/journal/${entry.id}/edit`)}
                        >
                          <Pencil className="h-3 w-3" /> Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => void handleDelete(entry.id, entry.entry_date)}
                          loading={deletingId === entry.id}
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}