import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { Button } from './ui'

type ToastVariant = 'success' | 'error' | 'info'

interface ToastItem {
  id: string
  title: string
  description?: string
  variant: ToastVariant
}

interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

interface ActiveConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void
}

interface FeedbackContextValue {
  toast: (title: string, options?: { description?: string; variant?: ToastVariant }) => void
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null)

const toastStyles: Record<ToastVariant, string> = {
  success: 'border-forest-200/80 bg-white/80 text-ink-900',
  error: 'border-clay-200/80 bg-white/80 text-ink-900',
  info: 'border-white/80 bg-white/80 text-ink-900',
}

const toastIcon: Record<ToastVariant, ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 text-forest-600" />,
  error: <AlertCircle className="h-4 w-4 text-clay-600" />,
  info: <Info className="h-4 w-4 text-ink-500" />,
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [activeConfirm, setActiveConfirm] = useState<ActiveConfirm | null>(null)
  const confirmRef = useRef<ActiveConfirm | null>(null)

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id))
  }, [])

  const toast = useCallback(
    (title: string, options?: { description?: string; variant?: ToastVariant }) => {
      const id = crypto.randomUUID()
      setToasts((current) => [
        ...current.slice(-3),
        { id, title, description: options?.description, variant: options?.variant ?? 'success' },
      ])
      window.setTimeout(() => dismiss(id), 5000)
    },
    [dismiss],
  )

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      confirmRef.current?.resolve(false)
      const next: ActiveConfirm = { ...options, resolve }
      confirmRef.current = next
      setActiveConfirm(next)
    })
  }, [])

  const settle = useCallback((value: boolean) => {
    const current = confirmRef.current
    if (!current) return
    confirmRef.current = null
    current.resolve(value)
    setActiveConfirm(null)
  }, [])

  useEffect(() => {
    if (!activeConfirm) return
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') settle(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeConfirm, settle])

  const value = useMemo<FeedbackContextValue>(() => ({ toast, confirm }), [toast, confirm])

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-20 right-4 z-50 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 sm:bottom-6"
      >
        {toasts.map((item) => (
          <div
            key={item.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-[0_18px_50px_-24px_rgba(34,32,26,0.45)] backdrop-blur-2xl ${toastStyles[item.variant]}`}
          >
            <span className="mt-0.5 shrink-0">{toastIcon[item.variant]}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{item.title}</p>
              {item.description && (
                <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{item.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              className="shrink-0 rounded p-0.5 text-ink-400 hover:bg-paper-100 hover:text-ink-700"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {activeConfirm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/60 p-4 backdrop-blur-md">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            onClick={() => settle(false)}
            aria-label="Close dialog"
            tabIndex={-1}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="relative w-full max-w-md rounded-2xl border border-white/70 bg-paper-50/90 p-6 shadow-[0_30px_80px_-30px_rgba(22,21,16,0.6)] backdrop-blur-2xl"
          >
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 rounded-lg p-2 ${
                  activeConfirm.danger ? 'bg-clay-100 text-clay-600' : 'bg-forest-50 text-forest-600'
                }`}
              >
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <h2 id="confirm-title" className="font-display text-xl font-semibold text-ink-900">
                  {activeConfirm.title}
                </h2>
                {activeConfirm.description && (
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
                    {activeConfirm.description}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => settle(false)}>
                {activeConfirm.cancelLabel ?? 'Cancel'}
              </Button>
              <Button
                variant={activeConfirm.danger ? 'danger' : 'primary'}
                onClick={() => settle(true)}
              >
                {activeConfirm.confirmLabel ?? 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  )
}

export function useFeedback(): FeedbackContextValue {
  const context = useContext(FeedbackContext)
  if (!context) throw new Error('useFeedback must be used inside FeedbackProvider')
  return context
}
