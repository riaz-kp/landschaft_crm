import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDb } from '../../state/useDb'
import { usePermissions } from '../../state/permissions'
import { COLLECTIONS } from '../../data/collections'
import { fetchHistory, type ChangeEntry, type HistoryQuery } from '../../data/changeLog'
import type { DbShape } from '../../data/store'
import { addDays, formatDate, formatDateLong, formatTime, today } from '../../domain/format'
import { titleOf } from '../../domain/roles'
import { DEMO_MODE } from '../../lib/supabase'
import { Avatar, Badge, EmptyState, PageHeader, SearchInput, Section } from '../../components/ui'
import { SearchSelect } from '../../components/SearchSelect'
import { employeeOptions } from '../../components/pickerOptions'
import { Icon } from '../../components/Icon'

/** What each table holds, in the words the screens use. */
const KIND: Record<string, string> = {
  projects: 'Project', clients: 'Client', leads: 'Lead', tasks: 'Task', employees: 'Employee',
  workers: 'Worker', reports: 'Daily work report', issues: 'Site issue', quotations: 'BOQ / Quotation',
  payment_requests: 'Payment request', payments: 'Payment', maintenance: 'AMC contract', documents: 'Document',
  calendar_events: 'Calendar event', clarifications: 'Clarification', chat_messages: 'Message',
  follow_ups: 'Payment follow-up', consultations: 'Consultation', attendance: 'Attendance',
  project_messages: 'Remark', pay_records: 'Pay record', reminders: 'Reminder', project_log: 'Project history note',
  site_visits: 'Site visit', site_assignments: 'Site assignment', client_briefs: 'Client checklist',
  materials: 'Material', settings: 'Settings',
}
const kindOf = (table: string) => KIND[table] ?? table.replace(/_/g, ' ')

const OP: Record<ChangeEntry['op'], { verb: string; tone: 'green' | 'blue' | 'red' }> = {
  create: { verb: 'added', tone: 'green' },
  update: { verb: 'changed', tone: 'blue' },
  delete: { verb: 'deleted', tone: 'red' },
}

/** Fields that only the app uses; their changes are noise to a reader. */
const HIDDEN_FIELDS = new Set(['id', 'updatedAt'])

type Item = Record<string, unknown>
const isObject = (v: unknown): v is Item => typeof v === 'object' && v !== null && !Array.isArray(v)

/** "expectedCompletion" → "Expected completion". */
function fieldLabel(path: string): string {
  return path.split('.').map((part) => {
    const words = part.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase()
    return words.charAt(0).toUpperCase() + words.slice(1)
  }).join(' › ')
}

/** The changed leaves under one field, a few levels down, so "Design › Concept › Progress" reads as one line. */
function flatten(path: string, from: unknown, to: unknown, depth = 0): { path: string; from: unknown; to: unknown }[] {
  if (JSON.stringify(from) === JSON.stringify(to)) return []
  if (depth < 3 && (isObject(from) || isObject(to)) && !Array.isArray(from) && !Array.isArray(to)) {
    const a = isObject(from) ? from : {}
    const b = isObject(to) ? to : {}
    return [...new Set([...Object.keys(a), ...Object.keys(b)])]
      .filter((k) => !HIDDEN_FIELDS.has(k))
      .flatMap((k) => flatten(`${path}.${k}`, a[k], b[k], depth + 1))
  }
  return [{ path, from, to }]
}

/** A short, readable name for a record: a project's name, a task's title, a document's number… */
function recordTitle(table: string, record: Item | undefined, db: DbShape): string {
  if (!record) return ''
  const name = (id: unknown) => db.employees.find((e) => e.id === id)?.name ?? db.workers.find((w) => w.id === id)?.name
  const project = (id: unknown) => db.projects.find((p) => p.id === id)?.name
  if (table === 'project_messages') return `“${String(record.text || '📷 Photo').slice(0, 70)}”`
  if (table === 'reports') return [record.siteLocation, record.date && formatDate(String(record.date))].filter(Boolean).join(' · ')
  if (table === 'attendance') return [name(record.personId), record.date && formatDate(String(record.date))].filter(Boolean).join(' · ')
  if (table === 'site_assignments') return [name(record.foremanId), project(record.projectId)].filter(Boolean).join(' → ')
  if (table === 'settings') return 'Company settings'
  if (table === 'payments' || table === 'payment_requests') {
    return [project(record.projectId), typeof record.amount === 'number' ? `₹${record.amount.toLocaleString('en-IN')}` : ''].filter(Boolean).join(' · ')
  }
  for (const key of ['name', 'title', 'number', 'code', 'subject', 'label', 'text']) {
    if (typeof record[key] === 'string' && record[key]) return String(record[key]).slice(0, 80)
  }
  return project(record.projectId) ?? ''
}

/** Where a record opens, when it has a page of its own or belongs to a project. */
function recordLink(table: string, id: string, record: Item | undefined): string | undefined {
  if (table === 'projects') return `/projects/${id}`
  if (table === 'clients') return `/crm/clients/${id}`
  if (table === 'employees') return `/employees/${id}`
  if (table === 'workers') return `/employees/workers/${id}`
  if (table === 'reports') return `/execution/reports/${id}`
  if (table === 'settings') return '/settings'
  if (table === 'quotations' && record?.projectId) return `/projects/${record.projectId}/commercial/${id}`
  if (record && typeof record.projectId === 'string') return `/projects/${record.projectId}`
  return undefined
}

/** A stored value as a person would read it: names for ids, dates as dates, Yes / No. */
function useFormatter(db: DbShape) {
  return useCallback((value: unknown): string => {
    if (value === undefined || value === null || value === '') return '—'
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (typeof value === 'number') return value.toLocaleString('en-IN')
    if (typeof value === 'string') {
      if (value === '[image]' || value.startsWith('file:') || /^files?\//.test(value)) return '📷 photo'
      const named = db.employees.find((e) => e.id === value)?.name ?? db.workers.find((w) => w.id === value)?.name
        ?? db.projects.find((p) => p.id === value)?.name ?? db.clients.find((c) => c.id === value)?.name
      if (named) return named
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDate(value)
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return `${formatDate(value.slice(0, 10))} ${formatTime(value.slice(11, 16))}`
      return value.length > 160 ? `${value.slice(0, 160)}…` : value
    }
    if (Array.isArray(value)) {
      if (value.every((v) => typeof v !== 'object' || v === null)) {
        const text = value.map((v) => String(v)).join(', ')
        return text.length > 160 ? `${value.length} items` : text || 'none'
      }
      return value.length === 1 ? '1 item' : `${value.length} items`
    }
    return 'details'
  }, [db])
}

const dayLabel = (iso: string) => {
  if (iso === today()) return 'Today'
  if (iso === addDays(today(), -1)) return 'Yesterday'
  return formatDateLong(iso)
}

const localDay = (at: string) => {
  const d = new Date(at)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const localTime = (at: string) => {
  const d = new Date(at)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * Settings → History: every change anyone made in the CRM, newest first —
 * who, when, what, and each field's value before and after. Filter by what was
 * changed, by person and by date; open an entry to see its fields.
 */
export function HistoryPage() {
  const db = useDb()
  const { can } = usePermissions()
  // Settings → Roles & Permissions → History → View.
  const allowed = can('History', 'view')
  const format = useFormatter(db)

  const [collection, setCollection] = useState('')
  const [actor, setActor] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [query, setQuery] = useState('')
  const [entries, setEntries] = useState<ChangeEntry[]>([])
  const [more, setMore] = useState(false)
  const [state, setState] = useState<'loading' | 'ready' | 'not-installed' | 'no-access' | 'error'>('loading')
  const [message, setMessage] = useState<string>()
  const [open, setOpen] = useState<Set<string>>(new Set())

  const filters: HistoryQuery = useMemo(() => ({
    collection: collection || undefined, actor: actor || undefined, from: from || undefined, to: to || undefined,
  }), [collection, actor, from, to])

  const load = useCallback(async (after?: ChangeEntry) => {
    setState((s) => (after ? s : 'loading'))
    const result = await fetchHistory({ ...filters, after })
    if (!result.ok) {
      setState(result.reason)
      setMessage(result.message)
      return
    }
    setEntries((prev) => (after ? [...prev, ...result.entries] : result.entries))
    setMore(result.more)
    setState('ready')
  }, [filters])

  useEffect(() => {
    if (allowed) void load()
  }, [allowed, load])

  const current = (table: string, id: string): Item | undefined => {
    const spec = COLLECTIONS.find((c) => c.table === table)
    return spec?.rows(db).get(id) as Item | undefined
  }

  const rows = entries.map((entry) => {
    const live = current(entry.collection, entry.recordId)
    // A deleted record lives on only in its entry; a changed one is named as it is now.
    const record = live ?? (entry.op === 'update' ? undefined : entry.changes as Item)
    const title = recordTitle(entry.collection, record, db) || recordTitle(entry.collection, entry.op === 'update' ? undefined : entry.changes as Item, db)
    const person = entry.actor ? db.employees.find((e) => e.id === entry.actor) : undefined
    return { entry, title, record, live, person }
  })
  const q = query.trim().toLowerCase()
  const shown = q
    ? rows.filter((r) => [r.title, kindOf(r.entry.collection), r.person?.name ?? 'System'].some((s) => s.toLowerCase().includes(q)))
    : rows

  const toggle = (id: string) => setOpen((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const collections = COLLECTIONS.map((c) => c.table).filter((t) => t !== 'chat_reads')
    .sort((a, b) => kindOf(a).localeCompare(kindOf(b)))

  if (!allowed) {
    return (
      <div>
        <PageHeader title="History" subtitle="Every change made in the CRM." />
        <Section><EmptyState title="Your role can't see the history." hint="It is given per role in Settings → Roles & Permissions → History." icon="shield" /></Section>
      </div>
    )
  }

  let lastDay = ''

  return (
    <div className="mx-auto max-w-5xl pb-20">
      <PageHeader
        title="History"
        subtitle="Every change made in the CRM — who made it, when, and what each field was before and after."
      />

      <div className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <select
          className="input col-span-2 py-1.5 sm:w-52"
          value={collection}
          onChange={(e) => setCollection(e.target.value)}
          aria-label="What was changed"
        >
          <option value="">Everything</option>
          {collections.map((t) => <option key={t} value={t}>{kindOf(t)}</option>)}
        </select>
        <div className="col-span-2 sm:w-56">
          <SearchSelect
            size="sm"
            value={actor}
            onChange={setActor}
            options={employeeOptions(db.employees)}
            emptyOption="Everyone"
            searchPlaceholder="Search people"
            ariaLabel="Changed by"
            title="Changed by"
          />
        </div>
        <input type="date" className="input min-w-0 py-1.5 sm:w-40" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label="From" title="From" />
        <input type="date" className="input min-w-0 py-1.5 sm:w-40" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label="To" title="To" />
        <SearchInput value={query} onChange={setQuery} placeholder="Search what's shown…" className="col-span-2 sm:ml-auto sm:w-60" />
      </div>

      {state === 'loading' && (
        <Section><p className="flex items-center gap-2 px-5 py-8 text-sm text-stone-500"><span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /> Loading history…</p></Section>
      )}
      {state === 'not-installed' && (
        <Section>
          <EmptyState
            title="History isn't switched on for the database yet."
            hint="It starts recording once the database update 20261122120000_history_and_remark_edits.sql is applied. Changes made before that aren't recorded."
            icon="clock"
          />
        </Section>
      )}
      {state === 'no-access' && <Section><EmptyState title="Your login can't read the history." icon="shield" /></Section>}
      {state === 'error' && (
        <Section>
          <EmptyState title="The history could not be loaded." hint={message ?? 'Check the connection and try again.'} icon="alert" />
          <div className="pb-5 text-center"><button className="btn-secondary" onClick={() => void load()}>Try again</button></div>
        </Section>
      )}

      {state === 'ready' && (
        shown.length === 0 ? (
          <Section>
            <EmptyState
              title={entries.length ? 'Nothing loaded matches the search.' : 'No changes recorded for these filters.'}
              hint={DEMO_MODE && !entries.length ? 'In the demo, changes are recorded in this browser from now on.' : undefined}
              icon="clock"
            />
          </Section>
        ) : (
          // No overflow clipping here: it would pin the day labels inside the card instead of under the header.
          <div className="rounded-2xl border border-stone-200 bg-white shadow-card">
            {shown.map(({ entry, title, record, live, person }, index) => {
              const day = localDay(entry.at)
              const showDay = day !== lastDay
              lastDay = day
              const op = OP[entry.op]
              const changes = entry.op === 'update'
                ? Object.entries(entry.changes)
                  .filter(([k]) => !HIDDEN_FIELDS.has(k))
                  .flatMap(([k, v]) => flatten(k, (v as Item)?.from, (v as Item)?.to))
                : []
              const link = (live || entry.op !== 'delete') ? recordLink(entry.collection, entry.recordId, record) : undefined
              const isOpen = open.has(entry.id)
              const summary = entry.op === 'update'
                ? changes.slice(0, 3).map((c) => fieldLabel(c.path)).join(', ') + (changes.length > 3 ? ` and ${changes.length - 3} more` : '')
                : ''
              return (
                <div key={entry.id}>
                  {showDay && (
                    <div className={`sticky top-[57px] z-10 border-b border-stone-100 bg-stone-50/95 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500 backdrop-blur sm:px-5 ${index === 0 ? 'rounded-t-2xl' : ''}`}>
                      {dayLabel(day)}
                    </div>
                  )}
                  <div className="border-b border-stone-100 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => toggle(entry.id)}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-stone-50 sm:px-5"
                      aria-expanded={isOpen}
                    >
                      {person
                        ? <Avatar name={person.name} size="sm" src={person.photo} />
                        : <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-500"><Icon name="cog" className="h-3.5 w-3.5" /></span>}
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-stone-800">
                          <span className="font-semibold">{person?.name ?? (entry.actor ? 'Former employee' : 'System')}</span>
                          {' '}{op.verb}{' '}
                          <span className="text-stone-500">{kindOf(entry.collection).toLowerCase()}</span>
                          {title && <> <span className="font-medium text-stone-900">{title}</span></>}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-400">
                          <span className="tabular-nums">{formatTime(localTime(entry.at))}</span>
                          {person && <span>{titleOf(person)}</span>}
                          {summary && <span className="truncate text-stone-500">· {summary}</span>}
                        </span>
                      </span>
                      <Badge tone={op.tone}>{op.verb}</Badge>
                      <Icon name="chevron" className={`mt-1 h-4 w-4 shrink-0 text-stone-400 transition ${isOpen ? '-rotate-90' : 'rotate-90'}`} />
                    </button>
                    {isOpen && (
                      <div className="space-y-2 px-4 pb-4 sm:pl-[60px] sm:pr-5">
                        {entry.op === 'update' && (
                          changes.length === 0
                            ? <p className="text-xs text-stone-400">Only internal fields changed.</p>
                            : (
                              <dl className="divide-y divide-stone-100 rounded-xl border border-stone-200 text-sm">
                                {changes.map((c) => (
                                  <div key={c.path} className="grid gap-1 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:gap-3">
                                    <dt className="text-xs font-semibold text-stone-500">{fieldLabel(c.path)}</dt>
                                    <dd className="flex min-w-0 flex-wrap items-center gap-1.5 break-words">
                                      <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-700 line-through decoration-red-300">{format(c.from)}</span>
                                      <Icon name="chevron" className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                                      <span className="rounded bg-green-50 px-1.5 py-0.5 text-green-800">{format(c.to)}</span>
                                    </dd>
                                  </div>
                                ))}
                              </dl>
                            )
                        )}
                        {entry.op !== 'update' && (
                          <dl className="divide-y divide-stone-100 rounded-xl border border-stone-200 text-sm">
                            {Object.entries(entry.changes)
                              .filter(([k, v]) => !HIDDEN_FIELDS.has(k) && v !== null && v !== undefined && v !== '' && !isObject(v))
                              .slice(0, 24)
                              .map(([k, v]) => (
                                <div key={k} className="grid gap-1 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:gap-3">
                                  <dt className="text-xs font-semibold text-stone-500">{fieldLabel(k)}</dt>
                                  <dd className="min-w-0 break-words text-stone-800">{format(v)}</dd>
                                </div>
                              ))}
                          </dl>
                        )}
                        {link && (
                          <Link to={link} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800">
                            Open {kindOf(entry.collection).toLowerCase()} <Icon name="chevron" className="h-3.5 w-3.5" />
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {state === 'ready' && more && (
        <div className="mt-4 text-center">
          <button className="btn-secondary" onClick={() => void load(entries[entries.length - 1])}>Load older changes</button>
        </div>
      )}
    </div>
  )
}
