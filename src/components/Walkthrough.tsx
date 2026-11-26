import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react'
import { Button } from './ui'

interface TourRect {
  left: number
  top: number
  width: number
  height: number
  bottom: number
}

interface TourStep {
  target: string
  title: string
  body: string
  /** Optional page to visit before showing this step. */
  path?: string
}

const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="quick-action"]',
    path: '/',
    title: 'Start with today’s log',
    body: 'This button becomes “Add new entry” when today is empty, or “Edit your log today” once you have written something.',
  },
  {
    target: '[data-tour="missing-days"]',
    path: '/',
    title: 'Forgot a workday?',
    body: 'Unlogged scheduled days count as days off. Open this banner to add a forgotten entry and the finish date will recalculate.',
  },
  {
    target: '[data-tour="estimate"]',
    path: '/',
    title: 'Your finish date, calculated',
    body: 'See remaining hours, excluded holidays, and the exact hours needed on your final day.',
  },
  {
    target: '[data-tour="journal-link"]',
    path: '/',
    title: 'Every page is one click away',
    body: 'Use the sidebar to move between your dashboard, journal, reports, and settings.',
  },
  {
    target: '[data-tour="new-entry"]',
    path: '/journal',
    title: 'The journal',
    body: 'Add an entry for any day, then edit it any time. Only you can read your journal.',
  },
  {
    target: '[data-tour="journal-filters"]',
    path: '/journal',
    title: 'Find any day fast',
    body: 'Search your reflections, filter by status or date, and mark favorites. Forgotten workdays appear here too so you can log them.',
  },
  {
    target: '[data-tour="download-pdf"]',
    path: '/reports',
    title: 'Submit-ready reports',
    body: 'Pick a date range, then print a clean report or download a PDF with your hours and completion estimate included.',
  },
  {
    target: '[data-tour="settings-tabs"]',
    path: '/settings',
    title: 'Everything stays editable',
    body: 'Profile and Schedule hold the hours and working days behind your estimate. Holidays lets you add local days off, and Account has password and email tools.',
  },
  {
    target: '[data-tour="sidebar-toggle"]',
    path: '/settings',
    title: 'Make room when you need it',
    body: 'Collapse the sidebar for a wider workspace. Your choice is remembered for next time.',
  },
]

function findTarget(selector: string): HTMLElement | null {
  const elements = Array.from(document.querySelectorAll<HTMLElement>(selector))
  return (
    elements.find((element) => {
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    }) ?? null
  )
}

export function Walkthrough({ onFinish }: { onFinish: () => void }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [steps] = useState<TourStep[]>(TOUR_STEPS)
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<TourRect | null>(null)
  const [tooltipHeight, setTooltipHeight] = useState(210)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (index >= steps.length) onFinish()
  }, [index, steps.length, onFinish])

  useEffect(() => {
    const step = steps[index]
    if (!step) return
    if (step.path && location.pathname !== step.path) {
      navigate(step.path)
      return
    }

    let cancelled = false
    const measure = () => {
      if (cancelled) return
      const element = findTarget(step.target)
      if (!element) {
        setIndex((current) => current + 1)
        return
      }
      element.scrollIntoView({ block: 'center', inline: 'nearest' })
      const bounds = element.getBoundingClientRect()
      const padding = 8
      setRect({
        left: bounds.left - padding,
        top: bounds.top - padding,
        width: bounds.width + padding * 2,
        height: bounds.height + padding * 2,
        bottom: bounds.bottom + padding,
      })
    }

    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      cancelled = true
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [index, steps, onFinish, location.pathname, navigate])

  useLayoutEffect(() => {
    if (tooltipRef.current) setTooltipHeight(tooltipRef.current.offsetHeight)
  }, [index, steps, rect])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onFinish()
      } else if (event.key === 'ArrowRight') {
        setIndex((current) => Math.min(steps.length - 1, current + 1))
      } else if (event.key === 'ArrowLeft') {
        setIndex((current) => Math.max(0, current - 1))
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [steps.length, onFinish])

  const step = steps[index]
  if (!step || index >= steps.length || !rect) return null
  if (step.path && location.pathname !== step.path) return null
  const isLast = index === steps.length - 1
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const tooltipWidth = Math.min(340, viewportWidth - 24)
  const left = Math.min(Math.max(12, rect.left), Math.max(12, viewportWidth - tooltipWidth - 12))
  const below = rect.bottom + 14
  const above = rect.top - tooltipHeight - 14
  let top: number
  if (below + tooltipHeight <= viewportHeight - 12) {
    top = below
  } else if (above >= 12) {
    top = above
  } else {
    top = Math.max(12, (viewportHeight - tooltipHeight) / 2)
  }

  return createPortal(
    <>
      <div className="fixed inset-0 z-[90]" aria-hidden="true" />
      <div
        className="pointer-events-none fixed z-[91] transition-all duration-200"
        style={{
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          borderRadius: 18,
          boxShadow: '0 0 0 9999px rgba(10, 17, 13, 0.72)',
        }}
        aria-hidden="true"
      />
      <div
        ref={tooltipRef}
        role="dialog"
        aria-modal="true"
        aria-live="polite"
        aria-labelledby="tour-title"
        className="fade-up fixed z-[92] rounded-2xl border border-white/75 bg-paper-50/95 p-4 shadow-[0_32px_90px_-30px_rgba(0,0,0,0.7)] backdrop-blur-2xl"
        style={{ left, top, width: tooltipWidth }}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="eyebrow">
            Quick tour · {index + 1} of {steps.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onFinish}
              className="-mt-1 rounded-lg px-2 py-1 text-[11px] font-medium text-ink-400 transition-colors hover:bg-white/70 hover:text-ink-800"
            >
              Skip tour
            </button>
            <button
              type="button"
              onClick={onFinish}
              aria-label="Skip tour"
              className="-mr-1 -mt-1 rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-white/70 hover:text-ink-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <h2 id="tour-title" className="mt-2 font-display text-xl font-semibold leading-snug text-ink-900">
          {step.title}
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-500">{step.body}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {steps.map((item, itemIndex) => (
              <span
                key={item.target}
                className={`h-1.5 rounded-full transition-all ${
                  itemIndex === index ? 'w-5 bg-forest-600' : 'w-1.5 bg-ink-200'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {index > 0 && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setIndex((current) => Math.max(0, current - 1))}
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={() => (isLast ? onFinish() : setIndex((current) => current + 1))}
            >
              {isLast ? (
                <>
                  Done <Check className="h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  Next <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
