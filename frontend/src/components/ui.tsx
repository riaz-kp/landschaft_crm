import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Department } from '../domain/types'

// ---------------------------------------------------------------- page frame

export function PageHeader({
  title, subtitle, actions,
}: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-stone-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Section({
  title, description, actions, children, className = '',
}: {
  title?: ReactNode; description?: ReactNode; actions?: ReactNode
  children: ReactNode; className?: string
}) {
  return (
    // min-w-0 lets a wide table scroll inside the card instead of stretching a grid column.
    <section className={`card min-w-0 ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-4 border-b border-stone-200 px-5 py-4">
          <div>
            {title && <h2 className="font-semibold text-stone-900">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-stone-500">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="px-5 py-12 text-center">
      <p className="text-sm font-medium text-stone-600">{title}</p>
      {hint && <p className="mt-1 text-sm text-stone-400">{hint}</p>}
    </div>
  )
}

// ---------------------------------------------------------------- badges

type Tone = 'green' | 'amber' | 'red' | 'blue' | 'stone' | 'clay'

const TONES: Record<Tone, string> = {
  green: 'bg-brand-100 text-brand-800 ring-brand-600/20',
  amber: 'bg-amber-100 text-amber-800 ring-amber-600/20',
  red: 'bg-red-100 text-red-800 ring-red-600/20',
  blue: 'bg-sky-100 text-sky-800 ring-sky-600/20',
  stone: 'bg-stone-100 text-stone-700 ring-stone-500/20',
  clay: 'bg-clay-100 text-clay-800 ring-clay-600/20',
}

export function Badge({ tone = 'stone', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}>
      {children}
    </span>
  )
}

const STATUS_TONES: Record<string, Tone> = {
  // Report statuses
  Draft: 'stone', Submitted: 'amber', Approved: 'green', 'Sent Back': 'red',
  // Project statuses
  Planning: 'blue', 'In Progress': 'amber', 'On Hold': 'stone', Completed: 'green',
  // Lead statuses
  New: 'blue', Contacted: 'stone', 'Site Visit': 'amber', Quoted: 'clay', Won: 'green', Lost: 'red',
  // Task statuses
  'To Do': 'stone', Review: 'clay', Done: 'green',
  // Money statuses
  Pending: 'amber', Paid: 'green', Rejected: 'red', Sent: 'blue', Accepted: 'green',
  // Misc
  Scheduled: 'blue', Cancelled: 'stone', Open: 'red', Resolved: 'green',
  // Staff attendance
  Present: 'green', 'Half Day': 'amber', Leave: 'blue', Absent: 'red',
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONES[status] ?? 'stone'}>{status}</Badge>
}

// ---------------------------------------------------------------- stats

export function StatTile({
  label, value, sub, tone = 'stone', to,
}: { label: string; value: ReactNode; sub?: string; tone?: Tone; to?: string }) {
  const accent: Record<Tone, string> = {
    green: 'text-brand-700', amber: 'text-amber-700', red: 'text-red-700',
    blue: 'text-sky-700', stone: 'text-stone-900', clay: 'text-clay-700',
  }
  const body = (
    <div className="card-pad h-full transition-shadow hover:shadow-md">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold tabular-nums ${accent[tone]}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-stone-400">{sub}</p>}
    </div>
  )
  return to ? <Link to={to} className="block">{body}</Link> : body
}

// ---------------------------------------------------------------- progress

export function ProgressBar({
  value, tone = 'green', size = 'md',
}: { value: number; tone?: 'green' | 'amber' | 'stone'; size?: 'sm' | 'md' }) {
  const fill = { green: 'bg-brand-500', amber: 'bg-amber-500', stone: 'bg-stone-400' }[tone]
  const height = size === 'sm' ? 'h-1.5' : 'h-2.5'
  return (
    <div className={`w-full overflow-hidden rounded-full bg-stone-200 ${height}`}>
      <div
        className={`${height} rounded-full ${fill} transition-[width] duration-500`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  )
}

// ---------------------------------------------------------------- tables

export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="scroll-x">
      <table className="w-full min-w-[640px] border-collapse">
        <thead className="bg-stone-50">
          <tr>{head.map((h, i) => <th key={i} className="th">{h}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------- misc

export function Avatar({
  name, size = 'md', src,
}: { name: string; size?: 'sm' | 'md' | 'xl'; src?: string }) {
  const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
  const dim = { sm: 'h-7 w-7 text-[10px]', md: 'h-9 w-9 text-xs', xl: 'h-24 w-24 text-2xl' }[size]
  if (src) {
    return <img src={src} alt={name} className={`shrink-0 rounded-full object-cover ${dim}`} />
  }
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-800 ${dim}`}>
      {initials}
    </span>
  )
}

// ---------------------------------------------------------------- departments

const DEPARTMENT_TONES: Record<Department, Tone> = {
  Management: 'stone', Design: 'blue', Execution: 'green', AMC: 'clay', Accounts: 'amber', Marketing: 'stone',
}

export function DepartmentBadge({ department }: { department: Department }) {
  return <Badge tone={DEPARTMENT_TONES[department]}>{department}</Badge>
}

// ---------------------------------------------------------------- navigation within a page

export function Tabs<K extends string>({
  tabs, active, onChange,
}: { tabs: { key: K; label: string; count?: number }[]; active: K; onChange: (key: K) => void }) {
  return (
    <nav className="mb-5 flex flex-wrap gap-1 border-b border-stone-200">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            active === t.key
              ? 'border-brand-600 text-brand-800'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 text-xs tabular-nums text-stone-400">{t.count}</span>}
        </button>
      ))}
    </nav>
  )
}

/** The filter-button row used on list pages. */
export function Pills<K extends string>({
  options, active, onChange,
}: { options: { key: K; label: string; count?: number }[]; active: K; onChange: (key: K) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            active === o.key
              ? 'bg-brand-600 text-white'
              : 'border border-stone-300 bg-white text-stone-600 hover:bg-stone-50'
          }`}
        >
          {o.label}
          {o.count !== undefined && <span className="ml-1 tabular-nums opacity-70">({o.count})</span>}
        </button>
      ))}
    </div>
  )
}

export function Modal({
  title, onClose, children, footer,
}: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-stone-900/50" onClick={onClose} />
      <div
        role="dialog" aria-modal="true"
        className="relative flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <header className="flex items-center justify-between gap-4 border-b border-stone-200 px-5 py-4">
          <h2 className="font-semibold text-stone-900">{title}</h2>
          <button onClick={onClose} className="btn-ghost -mr-2 px-2" aria-label="Close">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-stone-200 px-5 py-3">{footer}</footer>}
      </div>
    </div>
  )
}

/** Renders a site name, tagging Malayalam text so it picks up the right font. */
export function SiteName({ name }: { name: string }) {
  const hasMalayalam = /[ഀ-ൿ]/.test(name)
  return <span lang={hasMalayalam ? 'ml' : undefined}>{name}</span>
}

export function Field({
  label, hint, children, required,
}: { label: ReactNode; hint?: string; children: ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="label">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-xs text-stone-400">{hint}</p>}
    </label>
  )
}

export function Checkbox({
  checked, onChange, label, disabled,
}: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; disabled?: boolean }) {
  return (
    <label className={`flex cursor-pointer select-none items-center gap-2.5 ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 shrink-0 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
      />
      <span className="text-sm text-stone-700">{label}</span>
    </label>
  )
}
