import { useEffect, useId, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'

type Period = 'AM' | 'PM'

/* ---------- helpers (exported so EntryForm can reuse them) ---------- */

/** "HH:mm" (24h) -> minutes since midnight */
export function toMinutes(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  return h > 23 || min > 59 ? null : h * 60 + min
}

/** minutes since midnight -> "HH:mm" (24h), wraps around midnight */
export function fromMinutes(total: number): string {
  const t = ((total % 1440) + 1440) % 1440
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

const format12 = (minutes: number) => {
  const h24 = Math.floor(minutes / 60)
  return `${h24 % 12 === 0 ? 12 : h24 % 12}:${String(minutes % 60).padStart(2, '0')}`
}

const periodOf = (minutes: number): Period => (minutes >= 720 ? 'PM' : 'AM')

/**
 * Forgiving parser. Accepts: 833, 8:33, 08:33, 1033, 8:33pm, 8:33 p, 17:05, 8
 * Without am/pm, 1–12 uses `fallback`; 13–23 and 0 are read as 24-hour.
 */
export function parseTimeInput(raw: string, fallback: Period): number | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, '')
  const match = /^(\d{1,2}):?(\d{2})?([ap])?m?$/.exec(s)
  if (!match) return null

  const hour = Number(match[1])
  const minute = match[2] ? Number(match[2]) : 0
  const suffix = match[3]
  if (minute > 59) return null

  if (suffix) {
    if (hour < 1 || hour > 12) return null
    return ((hour % 12) + (suffix === 'p' ? 12 : 0)) * 60 + minute
  }
  if (hour > 23) return null
  if (hour === 0 || hour >= 13) return hour * 60 + minute
  return ((hour % 12) + (fallback === 'PM' ? 12 : 0)) * 60 + minute
}

/* ---------- component ---------- */

interface TimeFieldProps {
  label: string
  /** 24-hour "HH:mm", or '' when empty */
  value: string
  onChange: (value: string) => void
  hint?: string
  error?: string
  disabled?: boolean
  id?: string
}

export function TimeField({ label, value, onChange, hint, error, disabled, id }: TimeFieldProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const helpId = `${inputId}-help`

  const minutes = toMinutes(value)
  const [emptyPeriod, setEmptyPeriod] = useState<Period>('AM')
  const period: Period = minutes !== null ? periodOf(minutes) : emptyPeriod

  const [draft, setDraft] = useState(minutes !== null ? format12(minutes) : '')
  const [focused, setFocused] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const focusedRef = useRef(false)

  // Keep the text in sync when the value changes from outside (form reset, day change…).
  useEffect(() => {
    if (!focusedRef.current) setDraft(minutes !== null ? format12(minutes) : '')
  }, [minutes])

  const message = localError ?? error
  const invalid = Boolean(message)

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    // Strip anything that isn't part of a time. Dots go too, so "8.33" and "a.m." both work.
    const raw = e.target.value.replace(/[^0-9:apm\s]/gi, '')
    setDraft(raw)
    setLocalError(null)

    if (raw.trim() === '') {
      onChange('')
      return
    }
    // Commit as soon as the text is a valid time; half-typed text ("8:3") is left alone.
    const parsed = parseTimeInput(raw, period)
    if (parsed !== null) onChange(fromMinutes(parsed))
  }

  function handleBlur() {
    focusedRef.current = false
    setFocused(false)
    if (draft.trim() === '') return

    const parsed = parseTimeInput(draft, period)
    if (parsed === null) {
      setLocalError('Enter a time like 8:33 or 5:05 pm.')
      return
    }
    setDraft(format12(parsed))
    onChange(fromMinutes(parsed))
  }

  function nudge(delta: number) {
    const base = parseTimeInput(draft, period) ?? minutes ?? 9 * 60
    const next = (((base + delta) % 1440) + 1440) % 1440
    setDraft(format12(next))
    setLocalError(null)
    onChange(fromMinutes(next))
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const step = e.shiftKey ? 15 : 1
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      nudge(step)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      nudge(-step)
    } else if (e.key === 'PageUp') {
      e.preventDefault()
      nudge(60)
    } else if (e.key === 'PageDown') {
      e.preventDefault()
      nudge(-60)
    }
  }

  function choosePeriod(next: Period) {
    if (minutes === null) {
      setEmptyPeriod(next)
      return
    }
    onChange(fromMinutes((minutes % 720) + (next === 'PM' ? 720 : 0)))
  }

  return (
    <div>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-ink-800">
        {label}
      </label>

      <div
        className={[
          'flex items-stretch rounded-xl border bg-white transition-shadow focus-within:ring-2',
          invalid
            ? 'border-red-400 focus-within:ring-red-100'
            : 'border-ink-200 focus-within:border-ink-800 focus-within:ring-ink-200',
          disabled ? 'opacity-60' : '',
        ].join(' ')}
      >
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="8:33"
          value={draft}
          disabled={disabled}
          aria-invalid={invalid}
          aria-describedby={message || hint || focused ? helpId : undefined}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onFocus={(e) => {
            focusedRef.current = true
            setFocused(true)
            e.target.select()
          }}
          className="min-w-0 flex-1 rounded-l-xl bg-transparent px-3.5 py-2.5 text-base font-medium tabular-nums text-ink-900 placeholder:text-ink-400 focus:outline-none"
        />

        <div
          role="radiogroup"
          aria-label={`${label}: AM or PM`}
          className="m-1 flex shrink-0 rounded-lg bg-ink-100 p-0.5"
        >
          {(['AM', 'PM'] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={period === p}
              disabled={disabled}
              onClick={() => choosePeriod(p)}
              className={[
                'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink-800',
                period === p ? 'bg-ink-900 text-white shadow-sm' : 'text-ink-500 hover:text-ink-900',
              ].join(' ')}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {(message || focused || hint) && (
        <p
          id={helpId}
          role={message ? 'alert' : undefined}
          className={`mt-1.5 text-xs ${message ? 'text-red-600' : 'text-ink-400'}`}
        >
          {message ?? (focused ? 'Type 833, 8:33 or 5:05 pm. Use ↑ ↓ to change by a minute.' : hint)}
        </p>
      )}
    </div>
  )
}
