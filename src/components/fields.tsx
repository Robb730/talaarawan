import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { createPortal } from 'react-dom'
import {
  addDays,
  addMonths,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react'
import { displayDate, isoFromDate, todayISO } from '../lib/date'
import { formatClock } from '../lib/hours'

interface PopoverStyle {
  left: number
  top: number
  width: number
  maxHeight: number
  above: boolean
}

function useFloatingPanel(open: boolean, onClose: () => void, minWidth: number) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<PopoverStyle>({
    left: 0,
    top: 0,
    width: minWidth,
    maxHeight: 420,
    above: false,
  })

  useLayoutEffect(() => {
    if (!open) return
    const update = () => {
      const trigger = triggerRef.current
      const panel = panelRef.current
      if (!trigger) return
      const rect = trigger.getBoundingClientRect()
      const width = Math.min(
        Math.max(rect.width, minWidth),
        Math.max(240, window.innerWidth - 24),
      )
      const left = Math.min(
        Math.max(12, rect.left),
        Math.max(12, window.innerWidth - width - 12),
      )
      const desiredHeight = panel?.offsetHeight ?? 360
      const below = rect.bottom + 8
      const above = rect.top - desiredHeight - 8
      const placeAbove = below + desiredHeight > window.innerHeight - 12 && above > 12
      const top = placeAbove ? Math.max(12, above) : below
      const maxHeight = Math.max(
        220,
        placeAbove ? rect.top - 16 : window.innerHeight - top - 12,
      )
      setStyle({ left, top, width, maxHeight, above: placeAbove })
    }

    update()
    const raf = window.requestAnimationFrame(update)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, minWidth])

  useEffect(() => {
    if (!open) return
    const handlePointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      onClose()
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('touchstart', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('touchstart', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open, onClose])

  return { triggerRef, panelRef, style }
}

function FieldTrigger({
  id,
  open,
  disabled,
  onClick,
  children,
  className = '',
  ariaLabel,
  buttonRef,
}: {
  id?: string
  open: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
  className?: string
  ariaLabel?: string
  buttonRef?: RefObject<HTMLButtonElement | null>
}) {
  return (
    <button
      ref={buttonRef}
      id={id}
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={ariaLabel}
      className={`flex h-11 w-full items-center justify-between gap-2 rounded-lg border px-3.5 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${
        open
          ? 'border-forest-400 bg-white/90 ring-2 ring-forest-200/60'
          : 'border-white/75 bg-white/65 hover:border-white hover:bg-white/80'
      } backdrop-blur-lg ${className}`}
    >
      {children}
    </button>
  )
}

function PopoverPanel({
  panelRef,
  style,
  children,
  labelledBy,
  role = 'dialog',
}: {
  panelRef: RefObject<HTMLDivElement | null>
  style: PopoverStyle
  children: ReactNode
  labelledBy?: string
  role?: 'dialog' | 'listbox'
}) {
  return createPortal(
    <div
      ref={panelRef}
      role={role}
      aria-labelledby={labelledBy}
      className="popover-panel thin-scroll fixed z-[80] overflow-y-auto rounded-2xl border border-white/75 bg-white/85 p-2 shadow-[0_32px_90px_-30px_rgba(22,21,16,0.45)] backdrop-blur-2xl"
      style={{
        left: style.left,
        top: style.top,
        width: style.width,
        maxHeight: style.maxHeight,
      }}
    >
      {children}
    </div>,
    document.body,
  )
}

export interface SelectOption<T extends string> {
  value: T
  label: string
  description?: string
}

export function Select<T extends string>({
  id,
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  disabled,
  className = '',
  ariaLabel,
}: {
  id?: string
  value: T
  onChange: (value: T) => void
  options: SelectOption<T>[]
  placeholder?: string
  disabled?: boolean
  className?: string
  ariaLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  const { triggerRef, panelRef, style } = useFloatingPanel(open, close, 220)
  const selected = options.find((option) => option.value === value)

  return (
    <>
      <FieldTrigger
        id={id}
        open={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={className}
        ariaLabel={ariaLabel}
        buttonRef={triggerRef}
      >
        <span className={selected ? 'truncate text-ink-900' : 'truncate text-ink-300'}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </FieldTrigger>

      {open && (
        <PopoverPanel panelRef={panelRef} style={style} role="listbox">
          <div className="thin-scroll max-h-64 space-y-0.5 overflow-y-auto">
            {options.map((option) => {
              const active = option.value === value
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(option.value)
                    close()
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    active
                      ? 'bg-forest-50/90 text-forest-800'
                      : 'text-ink-700 hover:bg-paper-100/70'
                  }`}
                >
                  <span>
                    <span className="block">{option.label}</span>
                    {option.description && (
                      <span className="mt-0.5 block text-[11px] text-ink-400">
                        {option.description}
                      </span>
                    )}
                  </span>
                  {active && <Check className="h-4 w-4 shrink-0 text-forest-600" />}
                </button>
              )
            })}
          </div>
        </PopoverPanel>
      )}
    </>
  )
}

const WEEKDAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

export type DateMarkKind = 'start' | 'holiday' | 'missing'

export interface DateMark {
  date: string
  kind: DateMarkKind
}

export function DatePicker({
  id,
  value,
  onChange,
  placeholder = 'Choose a date',
  min,
  max,
  disabled,
  clearable = true,
  className = '',
  marks = [],
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  min?: string
  max?: string
  disabled?: boolean
  clearable?: boolean
  className?: string
  marks?: DateMark[]
}) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(() => (value ? new Date(`${value}T00:00:00`) : new Date()))
  const close = () => setOpen(false)
  const { triggerRef, panelRef, style } = useFloatingPanel(open, close, 306)

  const toggle = () => {
    if (!open) setView(value ? new Date(`${value}T00:00:00`) : new Date())
    setOpen((current) => !current)
  }

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(view), { weekStartsOn: 1 })
    return Array.from({ length: 42 }, (_, index) => addDays(start, index))
  }, [view])

  const select = (iso: string) => {
    onChange(iso)
    close()
  }

  const inRange = (iso: string) => (!min || iso >= min) && (!max || iso <= max)
  const today = todayISO()
  const markMap = useMemo(() => {
    const map = new Map<string, DateMarkKind>()
    marks.forEach((mark) => {
      if (!map.has(mark.date)) map.set(mark.date, mark.kind)
    })
    return map
  }, [marks])
  const hasStartMark = [...markMap.values()].includes('start')
  const hasHolidayMark = [...markMap.values()].includes('holiday')
  const hasMissingMark = [...markMap.values()].includes('missing')

  return (
    <>
      <FieldTrigger
        id={id}
        open={open}
        disabled={disabled}
        onClick={toggle}
        className={className}
        buttonRef={triggerRef}
      >
        <span className="flex min-w-0 items-center gap-2">
          <CalendarDays className="h-4 w-4 shrink-0 text-ink-400" />
          <span className={value ? 'truncate text-ink-900' : 'truncate text-ink-300'}>
            {value ? displayDate(value, 'MMM d, yyyy') : placeholder}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </FieldTrigger>

      {open && (
        <PopoverPanel panelRef={panelRef} style={style}>
          <div className="p-1.5">
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setView((current) => addMonths(current, -1))}
                className="rounded-lg p-2 text-ink-400 transition-colors hover:bg-paper-100/80 hover:text-ink-800"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <p className="font-display text-base font-semibold text-ink-900">
                {displayDate(isoFromDate(startOfMonth(view)), 'MMMM yyyy')}
              </p>
              <button
                type="button"
                onClick={() => setView((current) => addMonths(current, 1))}
                className="rounded-lg p-2 text-ink-400 transition-colors hover:bg-paper-100/80 hover:text-ink-800"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {WEEKDAY_LABELS.map((label) => (
                <span
                  key={label}
                  className="grid h-7 place-items-center text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-400"
                >
                  {label}
                </span>
              ))}
              {days.map((date) => {
                const iso = isoFromDate(date)
                const selected = Boolean(value) && iso === value
                const currentMonth = isSameMonth(date, view)
                const isToday = isSameDay(date, new Date())
                const allowed = inRange(iso)
                const weekend = date.getDay() === 0 || date.getDay() === 6
                const mark = markMap.get(iso)
                const markLabel =
                  mark === 'start'
                    ? 'First day of OJT'
                    : mark === 'holiday'
                      ? 'Holiday'
                      : mark === 'missing'
                        ? 'Scheduled workday without a log'
                        : undefined
                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={!allowed}
                    onClick={() => select(iso)}
                    aria-pressed={selected}
                    title={markLabel ?? (!allowed ? 'Unavailable date' : weekend ? 'Weekend' : undefined)}
                    aria-label={
                      markLabel || !allowed || weekend
                        ? `${displayDate(iso, 'MMMM d, yyyy')} — ${
                            markLabel ?? (!allowed ? 'Unavailable' : 'Weekend')
                          }`
                        : undefined
                    }
                    className={`relative grid h-9 place-items-center rounded-lg text-[13px] transition-colors ${
                      selected
                        ? 'bg-forest-700 font-semibold text-paper-50 shadow-[0_6px_16px_-8px_rgba(34,53,42,0.8)]'
                        : !allowed
                          ? 'cursor-not-allowed bg-paper-200/80 text-ink-300'
                          : weekend
                            ? 'bg-paper-100/90 text-ink-500 hover:bg-paper-200/80'
                            : currentMonth
                              ? 'text-ink-700 hover:bg-paper-100/80'
                              : 'text-ink-300 hover:bg-paper-100/60'
                    }`}
                  >
                    {date.getDate()}
                    {mark && (
                      <span
                        aria-hidden="true"
                        className={`absolute bottom-1 left-1 h-1.5 w-1.5 rounded-full ${
                          selected
                            ? 'bg-paper-50'
                            : mark === 'start'
                              ? 'bg-forest-600'
                              : mark === 'holiday'
                                ? 'bg-sky-600'
                                : 'bg-amber-500'
                        }`}
                      />
                    )}
                    {isToday && !selected && (
                      <span className="absolute bottom-1 right-1 h-1 w-1 rounded-full bg-forest-500" />
                    )}
                  </button>
                )
              })}
            </div>

            {(hasStartMark || hasHolidayMark || hasMissingMark) && (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-paper-200/70 pt-2 text-[10px] text-ink-400">
                {hasStartMark && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-forest-600" /> First day of OJT
                  </span>
                )}
                {hasHolidayMark && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-600" /> Holiday
                  </span>
                )}
                {hasMissingMark && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Not logged yet
                  </span>
                )}
              </div>
            )}

            <div className="mt-2 flex items-center justify-between border-t border-paper-200/70 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (inRange(today)) select(today)
                }}
                className="rounded-md px-2 py-1.5 text-[11px] font-medium text-forest-700 hover:bg-forest-50/80"
              >
                Today
              </button>
              {clearable && value && (
                <button
                  type="button"
                  onClick={() => {
                    onChange('')
                    close()
                  }}
                  className="rounded-md px-2 py-1.5 text-[11px] font-medium text-ink-400 hover:bg-paper-100/80 hover:text-ink-700"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </PopoverPanel>
      )}
    </>
  )
}

const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) => index)

function parseTime(value: string): { hour12: number; minute: number; meridiem: 'AM' | 'PM' } {
  const [rawHour = '8', rawMinute = '0'] = value.split(':')
  const hour24 = Math.min(23, Math.max(0, Number(rawHour) || 0))
  const minute = Math.min(59, Math.max(0, Number(rawMinute) || 0))
  const meridiem = hour24 >= 12 ? 'PM' : 'AM'
  const hour12 = hour24 % 12 || 12
  return { hour12, minute, meridiem }
}

export function TimePicker({
  id,
  value,
  onChange,
  placeholder = 'Choose a time',
  disabled,
  clearable = true,
  className = '',
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  clearable?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const parsed = parseTime(value || '08:00')
  const [hour12, setHour12] = useState(parsed.hour12)
  const [minute, setMinute] = useState(parsed.minute)
  const [meridiem, setMeridiem] = useState<'AM' | 'PM'>(parsed.meridiem)
  const close = () => setOpen(false)
  const { triggerRef, panelRef, style } = useFloatingPanel(open, close, 286)

  const toggle = () => {
    if (!open) {
      const next = parseTime(value || '08:00')
      setHour12(next.hour12)
      setMinute(next.minute)
      setMeridiem(next.meridiem)
    }
    setOpen((current) => !current)
  }

  const commit = (nextHour = hour12, nextMinute = minute, nextMeridiem = meridiem) => {
    const hour24 = (nextHour % 12) + (nextMeridiem === 'PM' ? 12 : 0)
    onChange(`${String(hour24).padStart(2, '0')}:${String(nextMinute).padStart(2, '0')}`)
  }

  return (
    <>
      <FieldTrigger
        id={id}
        open={open}
        disabled={disabled}
        onClick={toggle}
        className={className}
        buttonRef={triggerRef}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Clock3 className="h-4 w-4 shrink-0 text-ink-400" />
          <span className={value ? 'truncate text-ink-900' : 'truncate text-ink-300'}>
            {value ? formatClock(value) : placeholder}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </FieldTrigger>

      {open && (
        <PopoverPanel panelRef={panelRef} style={style}>
          <div className="p-1.5">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="font-display text-base font-semibold text-ink-900">Set a time</p>
              <div className="flex rounded-lg border border-paper-200/80 bg-white/60 p-0.5">
                {(['AM', 'PM'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setMeridiem(option)
                      commit(hour12, minute, option)
                    }}
                    className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-colors ${
                      meridiem === option
                        ? 'bg-forest-700 text-paper-50'
                        : 'text-ink-500 hover:text-ink-900'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-[0.9fr_1.1fr] gap-2">
              <div>
                <p className="mb-1 px-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-400">
                  Hour
                </p>
                <div className="grid grid-cols-4 gap-0.5">
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setHour12(option)
                        commit(option)
                      }}
                      className={`grid h-8 place-items-center rounded-md text-xs transition-colors ${
                        hour12 === option
                          ? 'bg-forest-700 font-semibold text-paper-50'
                          : 'text-ink-600 hover:bg-paper-100/80'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-1 px-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-400">
                  Minute
                </p>
                <div className="thin-scroll grid max-h-[11.5rem] grid-cols-5 gap-0.5 overflow-y-auto">
                  {MINUTE_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setMinute(option)
                        commit(hour12, option)
                        close()
                      }}
                      className={`grid h-8 place-items-center rounded-md text-xs transition-colors ${
                        minute === option
                          ? 'bg-forest-700 font-semibold text-paper-50'
                          : 'text-ink-600 hover:bg-paper-100/80'
                      }`}
                    >
                      {String(option).padStart(2, '0')}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between border-t border-paper-200/70 pt-2">
              <p className="px-1 text-[11px] text-ink-400">
                {value ? `Selected ${formatClock(value)}` : 'Choose any minute'}
              </p>
              <div className="flex items-center gap-1">
                {clearable && value && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange('')
                      close()
                    }}
                    className="rounded-md px-2 py-1.5 text-[11px] font-medium text-ink-400 hover:bg-paper-100/80 hover:text-ink-700"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={close}
                  className="rounded-md bg-forest-50/90 px-2.5 py-1.5 text-[11px] font-semibold text-forest-700 hover:bg-forest-100"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </PopoverPanel>
      )}
    </>
  )
}
