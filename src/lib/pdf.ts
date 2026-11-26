import autoTable from 'jspdf-autotable'
import { jsPDF } from 'jspdf'
import { displayDate } from './date'
import { formatClock, formatHoursLong } from './hours'
import { statusMeta } from './constants'
import type { EstimateResult } from './estimate'
import type { JournalEntry, Profile } from './types'

interface ReportOptions {
  profile: Profile | null
  entries: JournalEntry[]
  from: string
  to: string
  estimate?: EstimateResult
}

/** jsPDF's built-in fonts are WinAnsi — strip characters they cannot draw. */
function clean(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E\n]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function totalLabel(total: number): string {
  return `${formatHoursLong(total)} (${total.toFixed(2)} hrs)`
}

export function exportJournalPdf({ profile, entries, from, to, estimate }: ReportOptions): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const total = entries.reduce((sum, entry) => sum + entry.rendered_hours, 0)
  const sorted = [...entries].sort((a, b) => a.entry_date.localeCompare(b.entry_date))
  const pageWidth = doc.internal.pageSize.getWidth()

  // Header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(34, 53, 42)
  doc.text('On-the-Job Training Journal', 14, 15)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(120, 111, 95)
  doc.text(
    `Report period: ${displayDate(from)} to ${displayDate(to)}   |   Generated: ${displayDate(new Date().toISOString().slice(0, 10))}`,
    14,
    21,
  )

  doc.setDrawColor(217, 207, 188)
  doc.line(14, 25, pageWidth - 14, 25)

  doc.setTextColor(34, 32, 26)
  doc.setFontSize(9.5)
  doc.text(`Student: ${clean(profile?.full_name) || '-'}`, 14, 31)
  doc.text(
    `Program / School: ${[clean(profile?.program), clean(profile?.school)].filter(Boolean).join(' / ') || '-'}`,
    80,
    31,
  )
  doc.text(
    `Company / Location / Supervisor: ${[clean(profile?.company), clean(profile?.company_location), clean(profile?.supervisor)].filter(Boolean).join(' / ') || '-'}`,
    14,
    36,
  )
  doc.text(
    `Required: ${profile?.required_hours ?? 0} hrs   |   Rendered in report: ${totalLabel(total)}`,
    80,
    36,
  )

  if (estimate?.endDate) {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(51, 80, 61)
    doc.text(
      estimate.status === 'complete'
        ? 'Estimated completion: required hours completed'
        : `Estimated last day: ${displayDate(estimate.endDate, 'MMMM d, yyyy')} (excluding holidays)   |   Final day: ${formatHoursLong(estimate.lastDayHours)} needed`,
      14,
      41,
    )
  }

  autoTable(doc, {
    startY: 46,
    head: [
      ['Date', 'Day', 'Status', 'In', 'Out', 'Break', 'Hours', 'Tasks / Accomplishments', 'Learnings', 'Tags'],
    ],
    body: sorted.map((entry) => [
      displayDate(entry.entry_date, 'MMM d, yyyy'),
      displayDate(entry.entry_date, 'EEE'),
      statusMeta(entry.status).label,
      formatClock(entry.time_in),
      formatClock(entry.time_out),
      entry.exclude_breaks ? `${entry.break_minutes} min` : `${entry.break_minutes} min (incl.)`,
      formatHoursLong(entry.rendered_hours),
      clean(entry.tasks),
      clean(entry.learnings),
      clean(entry.tags.join(', ')),
    ]),
    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 2, valign: 'top', overflow: 'linebreak' },
    headStyles: { fillColor: [51, 80, 61], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 249, 245] },
    columnStyles: {
      0: { cellWidth: 21 },
      1: { cellWidth: 11 },
      2: { cellWidth: 17 },
      3: { cellWidth: 17 },
      4: { cellWidth: 17 },
      5: { cellWidth: 18 },
      6: { cellWidth: 17 },
      7: { cellWidth: 62 },
      8: { cellWidth: 48 },
      9: { cellWidth: 22 },
    },
    margin: { left: 14, right: 14 },
  })

  const lastY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 180

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(34, 32, 26)
  doc.text(`Total rendered hours: ${totalLabel(total)}`, 14, lastY + 9)

  if (estimate) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(120, 111, 95)
    const holidayCount = estimate.skippedHolidays.length
    doc.text(
      `Estimate uses your weekly schedule and excludes ${holidayCount} holiday${holidayCount === 1 ? '' : 's'} (national and your own, from your start date onward).`,
      14,
      lastY + 14,
    )
    doc.text(
      'Holiday data: Nager.Date',
      14,
      lastY + 18,
    )
  }

  doc.setDrawColor(148, 163, 184)
  doc.line(14, lastY + 28, 100, lastY + 28)
  doc.line(pageWidth - 86, lastY + 28, pageWidth - 14, lastY + 28)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text('Student signature', 14, lastY + 33)
  doc.text('Supervisor signature', pageWidth - 86, lastY + 33)

  doc.setFontSize(7.5)
  doc.setTextColor(150, 141, 124)
  doc.text('Generated by TalaArawan', 14, doc.internal.pageSize.getHeight() - 7)

  doc.save(`talaarawan-${from}-to-${to}.pdf`)
}
