import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDb } from '../../state/useDb'
import { formatDateLong, formatTime } from '../../domain/format'
import type { ID } from '../../domain/types'
import { EmptyState, Pills, Section } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { HISTORY_KINDS, projectHistory, type HistoryKind, type ProjectHistoryItem } from './history'

const KIND_TONE: Record<HistoryKind, string> = {
  tasks: 'border-brand-200 bg-brand-50 text-brand-700',
  handovers: 'border-violet-200 bg-violet-50 text-violet-700',
  documents: 'border-sky-200 bg-sky-50 text-sky-700',
  site: 'border-amber-200 bg-amber-50 text-amber-700',
  money: 'border-clay-200 bg-clay-50 text-clay-700',
  project: 'border-stone-200 bg-white text-stone-500',
}

/** "14 Oct 2026 · 10:15 AM · Anees" */
function Meta({ item }: { item: ProjectHistoryItem }) {
  const db = useDb()
  const by = item.byId && db.employees.find((e) => e.id === item.byId)?.name
  return (
    <p className="mt-0.5 text-xs text-stone-400">
      {formatDateLong(item.date)}
      {item.time && <> · {formatTime(item.time)}</>}
      {by && <> · {by}</>}
    </p>
  )
}

/** The project's History tab: a filterable timeline, grouped by month. */
export function ProjectHistory({ projectId }: { projectId: ID }) {
  const db = useDb()
  const [filter, setFilter] = useState<HistoryKind | 'all'>('all')
  const history = projectHistory(db, projectId)
  const shown = filter === 'all' ? history : history.filter((h) => h.kind === filter)

  const months: { label: string; items: ProjectHistoryItem[] }[] = []
  for (const item of shown) {
    const label = new Date(item.date + 'T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    const last = months[months.length - 1]
    if (last?.label === label) last.items.push(item)
    else months.push({ label, items: [item] })
  }

  return (
    <Section
      title="Project History"
      description="Task hand-overs, completions with their notes, edits, documents received, site reports and payments, newest first."
    >
      <div className="border-b border-stone-100 px-5 py-3">
        <Pills<HistoryKind | 'all'>
          active={filter}
          onChange={setFilter}
          options={[
            { key: 'all', label: 'All', count: history.length },
            ...HISTORY_KINDS
              .map((k) => ({ ...k, count: history.filter((h) => h.kind === k.key).length }))
              .filter((k) => k.count > 0),
          ]}
        />
      </div>
      {months.length === 0 ? (
        <EmptyState title="Nothing recorded here yet." icon="history" />
      ) : (
        <div className="px-5 py-4">
          {months.map((month) => (
            <div key={month.label} className="mb-6 last:mb-0">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-stone-400">{month.label}</p>
              <ol className="relative space-y-4 border-l border-stone-200 pl-6">
                {month.items.map((item) => (
                  <li key={item.id} className="relative">
                    <span className={`absolute -left-[37px] flex h-6 w-6 items-center justify-center rounded-full border ${KIND_TONE[item.kind]}`}>
                      <Icon name={item.icon} className="h-3.5 w-3.5" />
                    </span>
                    {item.to ? (
                      <Link to={item.to} className="text-sm font-medium text-stone-900 hover:text-brand-700">{item.title}</Link>
                    ) : (
                      <p className="text-sm font-medium text-stone-900">{item.title}</p>
                    )}
                    <Meta item={item} />
                    {item.detail && <p className="mt-1 text-sm text-stone-600">{item.detail}</p>}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

/** A compact history for a single task, shown inside the task form. */
export function TaskHistoryList({ items }: { items: ProjectHistoryItem[] }) {
  if (items.length === 0) return null
  return (
    <ol className="space-y-2.5">
      {items.map((item) => (
        <li key={item.id} className="flex gap-2.5">
          <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${KIND_TONE[item.kind]}`}>
            <Icon name={item.icon} className="h-3 w-3" />
          </span>
          <div className="min-w-0">
            {/* The task's own title is already on screen; show what happened to it. */}
            <p className="text-sm font-medium text-stone-800">{item.title.split(' — ')[0]}</p>
            <Meta item={item} />
            {item.detail && <p className="mt-0.5 text-sm text-stone-600">{item.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}
