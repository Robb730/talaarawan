import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from 'react'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'inverse'
type Size = 'sm' | 'md'

const buttonVariants: Record<Variant, string> = {
  primary:
    'border border-forest-700/90 bg-forest-700 text-paper-50 hover:bg-forest-800 hover:border-forest-800 shadow-[0_10px_30px_-16px_rgba(34,53,42,0.85)]',
  secondary:
    'border border-ink-900/90 bg-ink-900/90 text-paper-50 backdrop-blur-md hover:bg-ink-800 hover:border-ink-800',
  outline:
    'border border-white/70 bg-white/55 text-ink-800 backdrop-blur-md hover:bg-white/85 hover:border-white',
  ghost: 'border border-transparent text-ink-600 hover:bg-white/55 hover:text-ink-900 backdrop-blur-sm',
  danger: 'border border-clay-200/80 bg-clay-50/80 text-clay-700 backdrop-blur-md hover:bg-clay-100',
  inverse:
    'border border-white/80 bg-paper-50 text-forest-900 shadow-[0_12px_35px_-20px_rgba(0,0,0,0.8)] hover:bg-white hover:border-white',
}

const buttonSizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-[13px] gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-55 ${buttonSizes[size]} ${buttonVariants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  )
}

export function IconButton({
  variant = 'ghost',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'ghost' | 'danger' | 'outline' }) {
  const styles = {
    ghost: 'text-ink-400 hover:bg-white/65 hover:text-ink-900 backdrop-blur-sm',
    danger: 'text-ink-400 hover:bg-clay-50/80 hover:text-clay-600',
    outline: 'border border-white/70 bg-white/45 text-ink-600 backdrop-blur-md hover:bg-white/80',
  }
  return (
    <button
      type="button"
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function Panel({
  children,
  className = '',
  ...props
}: { children: ReactNode; className?: string } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`panel ${className}`} {...props}>
      {children}
    </div>
  )
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 border-b border-paper-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="font-display text-[2rem] font-semibold leading-[1.05] tracking-[-0.02em] text-ink-900 sm:text-[2.4rem]">
          {title}
        </h1>
        {subtitle && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="font-display text-lg font-semibold text-ink-900">{title}</h2>
        {description && <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{description}</p>}
      </div>
      {action}
    </div>
  )
}

interface FieldProps {
  label: string
  htmlFor?: string
  hint?: string
  error?: string | null
  required?: boolean
  children: ReactNode
  className?: string
}

export function Field({ label, htmlFor, hint, error, required, children, className = '' }: FieldProps) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="field-label mb-1.5 block">
        {label}
        {required && <span className="ml-1 text-clay-500">*</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs text-clay-600">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[11px] leading-relaxed text-ink-400">{hint}</p>
      ) : null}
    </div>
  )
}

const controlClass =
  'w-full rounded-lg border border-white/75 bg-white/65 px-3.5 text-sm text-ink-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-lg transition-colors placeholder:text-ink-300 hover:border-white hover:bg-white/80 focus:border-forest-400 focus:bg-white/90 focus:ring-2 focus:ring-forest-200/60 focus:outline-none disabled:cursor-not-allowed disabled:bg-paper-100/60 disabled:text-ink-400'

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`h-11 ${controlClass} ${className}`} {...props} />
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${controlClass} min-h-28 resize-y py-2.5 leading-relaxed ${className}`} {...props} />
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  compact = false,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  description?: string
  disabled?: boolean
  compact?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center justify-between gap-4 rounded-lg text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        compact
          ? 'border border-transparent py-0.5'
          : 'border border-white/65 bg-white/45 backdrop-blur-lg px-3.5 py-3 hover:border-white hover:bg-white/70'
      }`}
    >
      <span className="min-w-0">
        <span className={`block font-medium text-ink-800 ${compact ? 'text-xs' : 'text-sm'}`}>{label}</span>
        {description && (
          <span className={`mt-0.5 block leading-relaxed text-ink-500 ${compact ? 'text-[10px]' : 'text-xs'}`}>
            {description}
          </span>
        )}
      </span>
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-forest-600' : 'bg-paper-300'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-[18px]' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  )
}

export function Badge({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
  )
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/80 bg-white/40 px-6 py-16 text-center backdrop-blur-xl">
      {icon && (
        <div className="mb-4 grid h-11 w-11 place-items-center rounded-full border border-white/70 bg-white/65 text-forest-600 backdrop-blur-md">
          {icon}
        </div>
      )}
      <h3 className="font-display text-xl font-semibold text-ink-900">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-500">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-paper-200/70 ${className}`}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-forest-500 to-forest-700 transition-all duration-500"
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

export function Stat({
  label,
  value,
  hint,
  className = '',
}: {
  label: string
  value: ReactNode
  hint?: string
  className?: string
}) {
  return (
    <div className={className}>
      <p className="eyebrow">{label}</p>
      <p className="tabular mt-1 font-display text-2xl font-semibold text-ink-900">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-ink-400">{hint}</p>}
    </div>
  )
}
