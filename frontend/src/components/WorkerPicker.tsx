import { useState } from 'react'
import type { ReportWorkerEntry, Worker } from '../domain/types'
import { Icon } from './Icon'

/**
 * Ticking workers is what sets the headcount — the client's paper form asked
 * foremen to write names out by hand and then total them, which is exactly the
 * step this removes. A search box and skill filter find someone fast in a long
 * list; workers who were recently on this foreman's sites are listed first.
 */
export function WorkerPicker({
  workers, attendance, onChange, disabled, crewIds = [],
}: {
  workers: Worker[]
  attendance: ReportWorkerEntry[]
  onChange: (next: ReportWorkerEntry[]) => void
  disabled?: boolean
  /** Workers recently on this foreman's reports, shown first as "Your crew". */
  crewIds?: string[]
}) {
  const [query, setQuery] = useState('')
  const [skill, setSkill] = useState('')
  const [presentOnly, setPresentOnly] = useState(false)

  const isPresent = (workerId: string) =>
    attendance.find((entry) => entry.workerId === workerId)?.present ?? false

  const setPresent = (ids: string[], present: boolean) => {
    const next = attendance.map((entry) =>
      ids.includes(entry.workerId)
        ? { ...entry, present, checkIn: present ? entry.checkIn : undefined, checkOut: present ? entry.checkOut : undefined }
        : entry,
    )
    // A worker added after the report was started has no line yet.
    for (const id of ids) if (!next.some((e) => e.workerId === id)) next.push({ workerId: id, present })
    onChange(next)
  }

  const skills = [...new Set(workers.map((w) => w.skill))].sort()
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const shown = workers
    .filter((w) =>
      (!skill || w.skill === skill)
      && (!presentOnly || isPresent(w.id))
      && words.every((q) => `${w.name} ${w.skill} ${w.phone}`.toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name))
  // Grouping never changes as boxes are ticked, so nothing jumps under a thumb.
  const crew = shown.filter((w) => crewIds.includes(w.id))
  const others = shown.filter((w) => !crewIds.includes(w.id))
  const presentCount = workers.filter((w) => isPresent(w.id)).length
  const allShownOn = shown.length > 0 && shown.every((w) => isPresent(w.id))
  const filtered = Boolean(words.length || skill || presentOnly)

  const tile = (worker: Worker) => {
    const present = isPresent(worker.id)
    return (
      <label
        key={worker.id}
        className={`flex cursor-pointer select-none items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
          present ? 'border-brand-300 bg-brand-50' : 'border-stone-200 bg-white hover:bg-stone-50'
        } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        <input
          type="checkbox"
          checked={present}
          disabled={disabled}
          onChange={(e) => setPresent([worker.id], e.target.checked)}
          className="h-5 w-5 shrink-0 rounded border-stone-300 accent-brand-600"
        />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-stone-800">{worker.name}</span>
          <span className="block truncate text-xs text-stone-500">{worker.skill}</span>
        </span>
      </label>
    )
  }

  const group = (title: string, list: Worker[]) => list.length > 0 && (
    <div>
      {crew.length > 0 && others.length > 0 && (
        <p className="mb-1.5 mt-1 text-[10px] font-bold uppercase tracking-wider text-stone-400">{title}</p>
      )}
      <div className="grid grid-cols-1 gap-1.5 min-[420px]:grid-cols-2">{list.map(tile)}</div>
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <label className="relative min-w-0 flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search workers"
            aria-label="Search workers"
            className="input pl-9"
          />
        </label>
        {skills.length > 1 && (
          <select className="input w-[38%] shrink-0" value={skill} onChange={(e) => setSkill(e.target.value)} aria-label="Skill">
            <option value="">All skills</option>
            {skills.map((s) => <option key={s}>{s}</option>)}
          </select>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex rounded-lg bg-stone-100 p-0.5 text-xs font-semibold">
          {([false, true] as const).map((on) => (
            <button
              key={String(on)}
              type="button"
              onClick={() => setPresentOnly(on)}
              className={`rounded-md px-2.5 py-1 transition ${presentOnly === on ? 'bg-white text-brand-800 shadow-sm' : 'text-stone-500'}`}
            >
              {on ? `Present · ${presentCount}` : `All · ${workers.length}`}
            </button>
          ))}
        </span>
        {!disabled && shown.length > 0 && (
          <button
            type="button"
            onClick={() => setPresent(shown.map((w) => w.id), !allShownOn)}
            className="text-xs font-semibold text-brand-700 hover:text-brand-800"
          >
            {allShownOn ? `Untick ${filtered ? 'these' : 'all'}` : `Tick ${filtered ? `these ${shown.length}` : 'all'}`}
          </button>
        )}
      </div>

      {group('Your crew — on your sites lately', crew)}
      {group('Other workers', others)}

      {shown.length === 0 && (
        <p className="rounded-xl border border-dashed border-stone-200 px-3 py-5 text-center text-sm text-stone-400">
          {presentOnly && !words.length && !skill ? 'Nobody ticked yet.' : 'No worker matches.'}
          {filtered && (
            <button type="button" onClick={() => { setQuery(''); setSkill(''); setPresentOnly(false) }} className="ml-1 font-semibold text-brand-700">
              Show everyone
            </button>
          )}
        </p>
      )}
    </div>
  )
}
