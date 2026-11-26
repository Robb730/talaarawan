import { Plus, Trash2, CalendarCheck2 } from 'lucide-react'
import { WEEK_DAYS } from '../lib/constants'
import { formatClock, minutesBetween, roundHours, timeInput } from '../lib/hours'
import type { BreakInput, BreakRule, Schedule, ScheduleInput } from '../lib/types'
import { TimePicker } from './fields'
import { Button, Field, IconButton, Input, Toggle } from './ui'

export interface BreakDraft {
  id?: string
  label: string
  start_time: string
  end_time: string
  duration_minutes: number
  excluded_from_rendered: boolean
}

export interface ScheduleDraft {
  id?: string
  day_of_week: number
  is_working: boolean
  time_in: string
  time_out: string
  breaks: BreakDraft[]
}

export function buildScheduleDrafts(schedules: Schedule[], breaks: BreakRule[]): ScheduleDraft[] {
  return WEEK_DAYS.map((day) => {
    const schedule = schedules.find((item) => item.day_of_week === day.value)
    const dayBreaks = breaks.filter((item) => item.schedule_id === schedule?.id)
    return {
      id: schedule?.id,
      day_of_week: day.value,
      is_working: schedule?.is_working ?? false,
      time_in: timeInput(schedule?.time_in),
      time_out: timeInput(schedule?.time_out),
      breaks: dayBreaks.map((item) => ({
        id: item.id,
        label: item.label,
        start_time: timeInput(item.start_time),
        end_time: timeInput(item.end_time),
        duration_minutes: item.duration_minutes,
        excluded_from_rendered: item.excluded_from_rendered,
      })),
    }
  })
}

export function toScheduleInputs(drafts: ScheduleDraft[]): {
  schedules: ScheduleInput[]
  breaks: BreakInput[]
} {
  const schedules = drafts.map((item) => ({
    id: item.id ?? crypto.randomUUID(),
    day_of_week: item.day_of_week,
    is_working: item.is_working,
    time_in: item.time_in || null,
    time_out: item.time_out || null,
  }))
  const breaks = drafts.flatMap((item) =>
    item.breaks.map((rule) => ({
      id: rule.id ?? crypto.randomUUID(),
      schedule_id: schedules.find((schedule) => schedule.day_of_week === item.day_of_week)!.id!,
      label: rule.label.trim() || 'Break',
      start_time: rule.start_time || null,
      end_time: rule.end_time || null,
      duration_minutes: Math.max(0, Number(rule.duration_minutes) || 0),
      excluded_from_rendered: rule.excluded_from_rendered,
    })),
  )
  return { schedules, breaks }
}

export function draftHours(day: ScheduleDraft): number {
  if (!day.is_working || !day.time_in || !day.time_out) return 0
  const worked = minutesBetween(day.time_in, day.time_out)
  const deducted = day.breaks.reduce((sum, rule) => {
    if (!rule.excluded_from_rendered) return sum
    const minutes =
      rule.start_time && rule.end_time
        ? minutesBetween(rule.start_time, rule.end_time)
        : Number(rule.duration_minutes) || 0
    return sum + Math.max(0, minutes)
  }, 0)
  return roundHours(Math.max(0, worked - deducted) / 60)
}

export function draftWeeklyHours(drafts: ScheduleDraft[]): number {
  return roundHours(drafts.reduce((sum, day) => sum + draftHours(day), 0))
}

export function ScheduleEditor({
  value,
  onChange,
}: {
  value: ScheduleDraft[]
  onChange: (next: ScheduleDraft[]) => void
}) {
  const updateDay = (index: number, patch: Partial<ScheduleDraft>) => {
    onChange(value.map((day, i) => (i === index ? { ...day, ...patch } : day)))
  }

  const updateBreak = (dayIndex: number, breakIndex: number, patch: Partial<BreakDraft>) => {
    onChange(
      value.map((day, i) =>
        i === dayIndex
          ? {
              ...day,
              breaks: day.breaks.map((rule, j) =>
                j === breakIndex ? { ...rule, ...patch } : rule,
              ),
            }
          : day,
      ),
    )
  }

  const addBreak = (dayIndex: number) => {
    onChange(
      value.map((day, i) =>
        i === dayIndex
          ? {
              ...day,
              breaks: [
                ...day.breaks,
                {
                  label: day.breaks.length === 0 ? 'Lunch' : 'Break',
                  start_time: '',
                  end_time: '',
                  duration_minutes: 60,
                  excluded_from_rendered: true,
                },
              ],
            }
          : day,
      ),
    )
  }

  const removeBreak = (dayIndex: number, breakIndex: number) => {
    onChange(
      value.map((day, i) =>
        i === dayIndex
          ? { ...day, breaks: day.breaks.filter((_, j) => j !== breakIndex) }
          : day,
      ),
    )
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold text-ink-900">Weekly work schedule</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-500">
            Set separate hours for each day. Breaks are optional and can be excluded from your
            rendered hours.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onChange(
              value.map((day) =>
                [1, 2, 3, 4, 5].includes(day.day_of_week)
                  ? {
                      ...day,
                      is_working: true,
                      time_in: day.time_in || '08:00',
                      time_out: day.time_out || '17:00',
                    }
                  : day,
              ),
            )
          }
        >
          Use Mon–Fri preset
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/70 bg-white/45 backdrop-blur-lg">
        {value.map((day, dayIndex) => (
          <div
            key={day.day_of_week}
            className={`px-4 py-4 sm:px-5 ${
              dayIndex > 0 ? 'border-t border-paper-200/70' : ''
            } ${day.is_working ? 'bg-white/35' : 'bg-paper-50/35'}`}
          >
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-[190px] items-center justify-between gap-4 xl:justify-start">
                <div>
                  <p className={`text-sm font-medium ${day.is_working ? 'text-ink-900' : 'text-ink-400'}`}>
                    {WEEK_DAYS[dayIndex].label}
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-400">
                    {day.is_working ? `${draftHours(day)}h expected` : 'Rest day'}
                  </p>
                </div>
                <Toggle
                  compact
                  checked={day.is_working}
                  onChange={(checked) => updateDay(dayIndex, { is_working: checked })}
                  label=""
                />
              </div>

              {day.is_working ? (
                <div className="flex flex-wrap items-end gap-2">
                  <Field label="Time in" className="w-[9.5rem]">
                    <TimePicker
                      value={day.time_in}
                      onChange={(value) => updateDay(dayIndex, { time_in: value })}
                    />
                  </Field>
                  <Field label="Time out" className="w-[9.5rem]">
                    <TimePicker
                      value={day.time_out}
                      onChange={(value) => updateDay(dayIndex, { time_out: value })}
                    />
                  </Field>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addBreak(dayIndex)}
                  >
                    <Plus className="h-3.5 w-3.5" /> Break
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-ink-300">No hours counted for this day.</p>
              )}
            </div>

            {day.is_working && day.breaks.length > 0 && (
              <div className="mt-3 space-y-2">
                {day.breaks.map((rule, breakIndex) => (
                  <div
                    key={rule.id ?? breakIndex}
                    className="rounded-lg border border-white/70 bg-white/50 p-3 backdrop-blur-md"
                  >
                    <div className="flex flex-wrap items-end gap-2.5">
                      <Field label="Label" className="w-[7.5rem]">
                        <Input
                          className="h-9"
                          value={rule.label}
                          placeholder="Lunch"
                          onChange={(event) =>
                            updateBreak(dayIndex, breakIndex, { label: event.target.value })
                          }
                        />
                      </Field>
                      <Field label="From" className="w-[9.25rem]">
                        <TimePicker
                          value={rule.start_time}
                          onChange={(value) =>
                            updateBreak(dayIndex, breakIndex, { start_time: value })
                          }
                        />
                      </Field>
                      <Field label="To" className="w-[9.25rem]">
                        <TimePicker
                          value={rule.end_time}
                          onChange={(value) =>
                            updateBreak(dayIndex, breakIndex, { end_time: value })
                          }
                        />
                      </Field>
                      <Field label="Minutes" className="w-[4.8rem]">
                        <Input
                          type="number"
                          min={0}
                          className="h-9"
                          value={rule.duration_minutes}
                          onChange={(event) =>
                            updateBreak(dayIndex, breakIndex, {
                              duration_minutes: Number(event.target.value),
                            })
                          }
                        />
                      </Field>
                      <div className="min-w-[13rem] flex-1 pb-1">
                        <Toggle
                          compact
                          checked={rule.excluded_from_rendered}
                          onChange={(checked) =>
                            updateBreak(dayIndex, breakIndex, { excluded_from_rendered: checked })
                          }
                          label="Exclude from rendered hours"
                        />
                      </div>
                      <IconButton
                        variant="danger"
                        onClick={() => removeBreak(dayIndex, breakIndex)}
                        aria-label="Remove break"
                        className="mb-0.5"
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </div>
                    {rule.start_time && rule.end_time && (
                      <p className="mt-1.5 text-[10px] text-ink-400">
                        {formatClock(rule.start_time)} – {formatClock(rule.end_time)} · the minutes
                        field is ignored when a time range is set.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-xl border border-forest-200/80 bg-forest-50/60 px-3 py-2.5 text-[11px] leading-relaxed text-forest-800 backdrop-blur-md">
        <CalendarCheck2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>
          Your estimated last day skips national holidays and any holidays you add in Settings,
          from your OJT start date onward.
        </p>
      </div>
    </div>
  )
}
