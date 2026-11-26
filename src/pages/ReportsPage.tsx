import { useMemo, useState } from 'react'
import { CalendarRange, Download, FileCheck2, Printer } from 'lucide-react'
import { CompletionEstimate } from '../components/CompletionEstimate'
import { DatePicker } from '../components/fields'
import { useFeedback } from '../components/Feedback'
import { Button, EmptyState, Field, PageHeader, Panel, Stat } from '../components/ui'
import { useData } from '../context/DataContext'
import { useOjtEstimate } from '../hooks/useOjtEstimate'
import { statusMeta } from '../lib/constants'
import { displayDate, isoFromDate, monthRange, todayISO, weekStart } from '../lib/date'
import { formatClock, formatHours, formatHoursLong } from '../lib/hours'

export default function ReportsPage() {
  const { profile, entries } = useData()
  const estimate = useOjtEstimate()
  const { toast } = useFeedback()
  const currentMonth = monthRange()
  const [from, setFrom] = useState(currentMonth.from)
  const [to, setTo] = useState(currentMonth.to)

  const filtered = useMemo(
    () =>
      entries
        .filter((entry) => (!from || entry.entry_date >= from) && (!to || entry.entry_date <= to))
        .sort((a, b) => a.entry_date.localeCompare(b.entry_date)),
    [entries, from, to],
  )
  const total = filtered.reduce((sum, entry) => sum + entry.rendered_hours, 0)
  const average = filtered.length ? total / filtered.length : 0
  const remaining = Math.max(
    0,
    (profile?.required_hours ?? 0) - entries.reduce((sum, entry) => sum + entry.rendered_hours, 0),
  )

  const setPreset = (preset: 'week' | 'month' | 'all') => {
    if (preset === 'week') {
      const start = weekStart()
      const end = new Date(start)
      end.setDate(end.getDate() + 6)
      setFrom(isoFromDate(start))
      setTo(isoFromDate(end))
    } else if (preset === 'month') {
      setFrom(currentMonth.from)
      setTo(currentMonth.to)
    } else {
      setFrom('')
      setTo('')
    }
  }

  const downloadPdf = async () => {
    try {
      const { exportJournalPdf } = await import('../lib/pdf')
      exportJournalPdf({ profile, entries: filtered, from: from || '—', to: to || '—', estimate })
      toast('PDF ready', { description: 'Your printable journal report has been downloaded.' })
    } catch (cause) {
      toast('Could not create PDF', {
        description: cause instanceof Error ? cause.message : 'Please try again.',
        variant: 'error',
      })
    }
  }

  return (
    <div>
      <div className="screen-only">
        <PageHeader
        eyebrow="Reports · Printable summary"
        title="A clear record, ready to submit."
        subtitle="Filter the days you need, review the summary, then print it or download a PDF."
        actions={
          <>
            <Button variant="outline" onClick={() => window.print()} disabled={filtered.length === 0}>
              <Printer className="h-4 w-4" /> Print
            </Button>
            <Button data-tour="download-pdf" onClick={downloadPdf} disabled={filtered.length === 0}>
              <Download className="h-4 w-4" /> Download PDF
            </Button>
          </>
        }
      />

      <Panel className="mb-5 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="From" htmlFor="fromDate" className="w-[11.5rem]">
            <DatePicker
              id="fromDate"
              value={from}
              onChange={setFrom}
              placeholder="Earliest"
              max={to || undefined}
            />
          </Field>
          <Field label="To" htmlFor="toDate" className="w-[11.5rem]">
            <DatePicker
              id="toDate"
              value={to}
              onChange={setTo}
              placeholder="Latest"
              min={from || undefined}
            />
          </Field>
          <div className="flex flex-wrap gap-1.5 pb-0.5">
            <Button type="button" variant="outline" size="sm" onClick={() => setPreset('week')}>
              This week
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setPreset('month')}>
              This month
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setPreset('all')}>
              All time
            </Button>
          </div>
          <p className="ml-auto pb-1 text-[11px] text-ink-400">
            {from || to
              ? `${from ? displayDate(from) : 'earliest'} → ${to ? displayDate(to) : 'latest'}`
              : 'All recorded days'}
          </p>
        </div>
      </Panel>

      <Panel className="mb-5 grid grid-cols-2 divide-paper-200 sm:grid-cols-4 sm:divide-x">
        <Stat className="p-4 sm:p-5" label="Entries in range" value={filtered.length} hint="Recorded days" />
        <Stat className="p-4 sm:p-5" label="Hours rendered" value={formatHours(total)} hint="Within this range" />
        <Stat className="p-4 sm:p-5" label="Daily average" value={formatHours(average)} hint="Per entry" />
        <Stat className="p-4 sm:p-5" label="Still required" value={formatHours(remaining)} hint="All-time balance" />
      </Panel>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-paper-200 px-5 py-4">
            <div>
              <p className="eyebrow">Daily log</p>
              <p className="mt-0.5 text-xs text-ink-500">
                {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'} in this report
              </p>
            </div>
            <CalendarRange className="h-4 w-4 text-ink-300" />
          </div>

          {filtered.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={<CalendarRange className="h-5 w-5" />}
                title="No entries in this range"
                description="Adjust the dates above, or add a journal entry first."
              />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="border-b border-paper-200 bg-paper-50 text-[10px] uppercase tracking-[0.12em] text-ink-400">
                    <tr>
                      <th className="px-5 py-2.5 font-semibold">Date</th>
                      <th className="px-3 py-2.5 font-semibold">Status</th>
                      <th className="px-3 py-2.5 font-semibold">Time</th>
                      <th className="px-3 py-2.5 font-semibold">Break</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Hours</th>
                      <th className="px-5 py-2.5 font-semibold">Tasks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-paper-200">
                    {filtered.map((entry) => (
                      <tr key={entry.id} className="align-top transition-colors hover:bg-paper-50">
                        <td className="whitespace-nowrap px-5 py-3">
                          <span className="block text-[13px] text-ink-700">
                            {displayDate(entry.entry_date, 'MMM d')}
                          </span>
                          <span className="text-[10px] text-ink-400">
                            {displayDate(entry.entry_date, 'EEE, yyyy')}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] ring-1 ring-inset ${statusMeta(entry.status).badge}`}
                          >
                            {statusMeta(entry.status).label}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-[11px] text-ink-500">
                          {formatClock(entry.time_in)} – {formatClock(entry.time_out)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-[11px] text-ink-500">
                          {entry.break_minutes} min{entry.exclude_breaks ? '' : ' incl.'}
                        </td>
                        <td className="tabular whitespace-nowrap px-3 py-3 text-right text-[13px] font-semibold text-ink-900">
                          {formatHours(entry.rendered_hours)}
                        </td>
                        <td className="px-5 py-3 text-[12px] leading-relaxed text-ink-600">
                          <span className="line-clamp-2">{entry.tasks}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-paper-200 bg-paper-50 px-5 py-3">
                <span className="text-xs font-medium text-ink-600">Total rendered</span>
                <span className="tabular font-display text-lg font-semibold text-forest-700">
                  {formatHoursLong(total)}
                </span>
              </div>
            </>
          )}
        </Panel>

        <div className="space-y-4">
          <CompletionEstimate estimate={estimate} />

          <Panel className="p-5">
            <p className="eyebrow flex items-center gap-1.5">
              <FileCheck2 className="h-3.5 w-3.5 text-forest-600" /> Ready to print
            </p>
            <ul className="mt-3 space-y-2 text-[11px] leading-relaxed text-ink-500">
              <li>Includes your school, company, supervisor, and OJT period.</li>
              <li>Shows a daily log with hours, tasks, learnings, and tags.</li>
              <li>Adds signature lines for you and your supervisor.</li>
              <li>Uses national holidays and your own entries from your start date onward.</li>
            </ul>
          </Panel>
        </div>
      </div>
      </div>

      {/* Print-only report */}
      <div className="print-only print-report">
        <h1>On-the-Job Training Journal</h1>
        <p>
          <strong>Student:</strong> {profile?.full_name || '—'} &nbsp;&nbsp;
          <strong>Program / School:</strong> {profile?.program || '—'} / {profile?.school || '—'}
        </p>
        <p>
          <strong>Company:</strong> {profile?.company || '—'} &nbsp;&nbsp;
          <strong>Location:</strong> {profile?.company_location || '—'} &nbsp;&nbsp;
          <strong>Supervisor:</strong> {profile?.supervisor || '—'}
        </p>
        <p>
          <strong>Period:</strong> {from || 'earliest'} to {to || 'latest'} &nbsp;&nbsp;
          <strong>Required hours:</strong> {profile?.required_hours ?? 0} &nbsp;&nbsp;
          <strong>Rendered:</strong> {total.toFixed(2)}
        </p>
        {estimate.endDate && (
          <p>
            <strong>Estimated last day:</strong>{' '}
            {estimate.status === 'complete'
              ? 'Required hours completed'
              : `${displayDate(estimate.endDate, 'MMMM d, yyyy')} (excluding holidays)`}
            {estimate.status === 'estimated' && (
              <>
                {' '}
                &nbsp;&nbsp;<strong>Hours needed on final day:</strong>{' '}
                {formatHoursLong(estimate.lastDayHours)}
                {estimate.lastDayPartial ? ' (partial day)' : ''}
              </>
            )}
          </p>
        )}
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Day</th>
              <th>Status</th>
              <th>In</th>
              <th>Out</th>
              <th>Break</th>
              <th>Hours</th>
              <th>Tasks / Accomplishments</th>
              <th>Learnings</th>
              <th>Tags</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry) => (
              <tr key={entry.id}>
                <td>{displayDate(entry.entry_date)}</td>
                <td>{displayDate(entry.entry_date, 'EEE')}</td>
                <td>{statusMeta(entry.status).label}</td>
                <td>{formatClock(entry.time_in)}</td>
                <td>{formatClock(entry.time_out)}</td>
                <td>
                  {entry.break_minutes} min{entry.exclude_breaks ? '' : ' (incl.)'}
                </td>
                <td>{entry.rendered_hours.toFixed(2)}</td>
                <td>{entry.tasks}</td>
                <td>{entry.learnings || ''}</td>
                <td>{entry.tags.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ marginTop: '6mm' }}>
          <strong>Total rendered hours: {total.toFixed(2)}</strong>
        </p>
        <p style={{ fontSize: '8pt' }}>
          Estimate excludes {estimate.skippedHolidays.length} holiday
          {estimate.skippedHolidays.length === 1 ? '' : 's'} (national and your own, from your start date onward).
          Holiday data: Nager.Date.
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '14mm' }}>
          <div style={{ width: '40%', borderTop: '1px solid #000', paddingTop: '2mm' }}>
            Student signature
          </div>
          <div style={{ width: '40%', borderTop: '1px solid #000', paddingTop: '2mm' }}>
            Supervisor signature
          </div>
        </div>
        <p style={{ marginTop: '5mm', fontSize: '8pt' }}>
          Generated by TalaArawan on {displayDate(todayISO())}
        </p>
      </div>
    </div>
  )
}
