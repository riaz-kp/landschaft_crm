import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Department } from '../domain/types'
import { Icon } from './Icon'

// ---------------------------------------------------------------- page frame

export function PageHeader({
  title, subtitle, actions,
}: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-[28px]">{title}</h1>
        {subtitle && <div className="mt-1.5 max-w-2xl text-sm text-stone-500">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
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
    <section className={`card min-w-0 overflow-hidden ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-4">
          <div className="min-w-0">
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

export function EmptyState({ title, hint, icon = 'folder' }: { title: string; hint?: string; icon?: string }) {
  return (
    <div className="flex flex-col items-center px-5 py-12 text-center">
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <p className="text-sm font-medium text-stone-600">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-stone-400">{hint}</p>}
    </div>
  )
}

// ---------------------------------------------------------------- badges

export type Tone = 'green' | 'amber' | 'red' | 'blue' | 'stone' | 'clay' | 'violet'

const TONES: Record<Tone, string> = {
  green: 'bg-brand-50 text-brand-800 ring-brand-600/20',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/25',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  blue: 'bg-sky-50 text-sky-800 ring-sky-600/20',
  stone: 'bg-stone-100 text-stone-700 ring-stone-500/15',
  clay: 'bg-clay-50 text-clay-800 ring-clay-600/25',
  violet: 'bg-violet-50 text-violet-800 ring-violet-600/20',
}

export function Badge({ tone = 'stone', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}>
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
  Scheduled: 'blue', Cancelled: 'stone', Open: 'red', Resolved: 'green', Postponed: 'violet',
  // Staff attendance
  Present: 'green', 'Half Day': 'amber', Leave: 'blue', Absent: 'red',
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONES[status] ?? 'stone'}>{status}</Badge>
}

// ---------------------------------------------------------------- stats

const ACCENT: Record<Tone, { text: string; chip: string }> = {
  green: { text: 'text-brand-700', chip: 'bg-brand-50 text-brand-600' },
  amber: { text: 'text-amber-700', chip: 'bg-amber-50 text-amber-600' },
  red: { text: 'text-red-700', chip: 'bg-red-50 text-red-600' },
  blue: { text: 'text-sky-700', chip: 'bg-sky-50 text-sky-600' },
  stone: { text: 'text-stone-900', chip: 'bg-stone-100 text-stone-500' },
  clay: { text: 'text-clay-700', chip: 'bg-clay-50 text-clay-600' },
  violet: { text: 'text-violet-700', chip: 'bg-violet-50 text-violet-600' },
}

export function StatTile({
  label, value, sub, tone = 'stone', to, icon,
}: { label: string; value: ReactNode; sub?: string; tone?: Tone; to?: string; icon?: string }) {
  const a = ACCENT[tone]
  const body = (
    <div className={`card-pad h-full ${to ? 'transition hover:-translate-y-0.5 hover:shadow-lift' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">{label}</p>
        {icon && (
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${a.chip}`}>
            <Icon name={icon} className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className={`mt-1.5 font-display text-3xl font-bold tabular-nums tracking-tight ${a.text}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-stone-400">{sub}</p>}
    </div>
  )
  return to ? <Link to={to} className="block">{body}</Link> : body
}

// ---------------------------------------------------------------- progress

export function ProgressBar({
  value, tone = 'green', size = 'md',
}: { value: number; tone?: 'green' | 'amber' | 'stone'; size?: 'sm' | 'md' }) {
  const fill = {
    green: 'bg-gradient-to-r from-brand-400 to-brand-600',
    amber: 'bg-gradient-to-r from-amber-400 to-amber-500',
    stone: 'bg-stone-400',
  }[tone]
  const height = size === 'sm' ? 'h-1.5' : 'h-2.5'
  return (
    <div className={`w-full overflow-hidden rounded-full bg-stone-200/80 ${height}`}>
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
        <thead className="bg-stone-50/80">
          <tr>{head.map((h, i) => <th key={i} className="th">{h}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

/** Edit / delete buttons at the end of a table row. */
export function RowActions({
  onEdit, onDelete, extra,
}: { onEdit?: () => void; onDelete?: () => void; extra?: ReactNode }) {
  if (!onEdit && !onDelete && !extra) return null
  return (
    <div className="flex items-center justify-end gap-1">
      {extra}
      {onEdit && (
        <button type="button" onClick={onEdit} className="btn-icon" title="Edit" aria-label="Edit">
          <Icon name="edit" className="h-4 w-4" />
        </button>
      )}
      {onDelete && (
        <button type="button" onClick={onDelete} className="btn-icon hover:bg-red-50 hover:text-red-600" title="Delete" aria-label="Delete">
          <Icon name="trash" className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- misc

const AVATAR_TONES = [
  'bg-brand-100 text-brand-800', 'bg-sky-100 text-sky-800', 'bg-amber-100 text-amber-800',
  'bg-clay-100 text-clay-800', 'bg-violet-100 text-violet-800', 'bg-rose-100 text-rose-800',
]

export function Avatar({
  name, size = 'md', src,
}: { name: string; size?: 'sm' | 'md' | 'lg' | 'xl'; src?: string }) {
  const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
  const dim = {
    sm: 'h-7 w-7 text-[10px]', md: 'h-9 w-9 text-xs', lg: 'h-12 w-12 text-sm', xl: 'h-24 w-24 text-2xl',
  }[size]
  if (src) {
    return <img src={src} alt={name} className={`shrink-0 rounded-full object-cover ring-2 ring-white ${dim}`} />
  }
  const tone = AVATAR_TONES[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_TONES.length]
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ring-2 ring-white ${tone} ${dim}`}>
      {initials}
    </span>
  )
}

// ---------------------------------------------------------------- departments

const DEPARTMENT_TONES: Record<Department, Tone> = {
  Management: 'violet', Design: 'blue', Execution: 'green', AMC: 'clay', Accounts: 'amber', Marketing: 'stone',
}

export function DepartmentBadge({ department }: { department: Department }) {
  return <Badge tone={DEPARTMENT_TONES[department]}>{department}</Badge>
}

// ---------------------------------------------------------------- navigation within a page

export function Tabs<K extends string>({
  tabs, active, onChange,
}: { tabs: { key: K; label: string; count?: number }[]; active: K; onChange: (key: K) => void }) {
  return (
    <nav className="no-scrollbar mb-5 flex gap-1 overflow-x-auto border-b border-stone-200">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            active === t.key
              ? 'border-brand-600 text-brand-800'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          {t.label}
          {t.count !== undefined && (
            <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] tabular-nums ${active === t.key ? 'bg-brand-100 text-brand-700' : 'bg-stone-100 text-stone-500'}`}>
              {t.count}
            </span>
          )}
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
    <div className="no-scrollbar flex gap-2 overflow-x-auto pb-0.5">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`chip shrink-0 px-3.5 py-1.5 text-sm ${active === o.key ? 'chip-on' : ''}`}
        >
          {o.label}
          {o.count !== undefined && <span className="tabular-nums opacity-70">{o.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function SearchInput({
  value, onChange, placeholder = 'Search…', className = '',
}: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <label className={`relative block ${className}`}>
      <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
      <input
        type="search" value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="input pl-9"
      />
    </label>
  )
}

/** Toolbar row above a list: filters on the left, search on the right. */
export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">{children}</div>
}

export function Modal({
  title, onClose, children, footer, size = 'md',
}: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; size?: 'md' | 'lg' | 'xl' }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const width = { md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-5xl' }[size]

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-stone-950/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog" aria-modal="true"
        className={`relative flex max-h-[92vh] w-full ${width} animate-fade-in flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl`}
      >
        <header className="flex items-center justify-between gap-4 border-b border-stone-100 px-5 py-4">
          <h2 className="font-semibold text-stone-900">{title}</h2>
          <button onClick={onClose} className="btn-icon -mr-2" aria-label="Close">
            <Icon name="x" className="h-5 w-5" />
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-stone-100 bg-stone-50/60 px-5 py-3 sm:rounded-b-2xl">{footer}</footer>}
      </div>
    </div>
  )
}

/** "Are you sure?" before anything is deleted. */
export function ConfirmDialog({
  title, message, confirmLabel = 'Delete', onConfirm, onClose, blocked,
}: {
  title: string; message: ReactNode; confirmLabel?: string
  onConfirm: () => void; onClose: () => void
  /** When set, explains why the action cannot go ahead and hides the confirm button. */
  blocked?: ReactNode
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className="btn-secondary">{blocked ? 'Close' : 'Cancel'}</button>
        {!blocked && (
          <button onClick={() => { onConfirm(); onClose() }} className="btn bg-red-600 text-white hover:bg-red-700">
            {confirmLabel}
          </button>
        )}
      </>}
    >
      <div className="flex gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${blocked ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>
          <Icon name={blocked ? 'alert' : 'trash'} className="h-5 w-5" />
        </span>
        <div className="text-sm text-stone-600">{blocked ?? message}</div>
      </div>
    </Modal>
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
        className="h-4 w-4 shrink-0 rounded border-stone-300 text-brand-600 accent-brand-600 focus:ring-brand-500"
      />
      <span className="text-sm text-stone-700">{label}</span>
    </label>
  )
}

/** Shown in a form when validation fails. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
      <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" /> {message}
    </p>
  )
}
