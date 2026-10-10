import { useState } from 'react'
import { computeProgress } from '../domain/progress'
import type { Project } from '../domain/types'
import { ProgressBar } from './ui'
import { Icon } from './Icon'

/**
 * One phase's progress in a table: the bar and percentage, with an edit
 * button beside it. Editing swaps in a slider and a number box; nothing is
 * saved until the tick. Without `onChange` it is just the bar.
 */
export function ProgressCell({
  value, onChange, label,
}: { value: number; onChange?: (next: number) => void; label: string }) {
  const [draft, setDraft] = useState<number | null>(null)
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))
  const save = () => {
    if (draft !== null && draft !== value) onChange?.(draft)
    setDraft(null)
  }

  if (draft !== null && onChange) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="range" min={0} max={100} step={5} value={draft}
          onChange={(e) => setDraft(clamp(Number(e.target.value)))}
          className="w-28 accent-brand-600 sm:w-36"
          aria-label={`${label} progress`}
        />
        <span className="flex items-center gap-1">
          <input
            type="number" min={0} max={100} value={draft} autoFocus
            onChange={(e) => setDraft(clamp(Number(e.target.value) || 0))}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setDraft(null) }}
            className="input w-16 px-2 py-1 text-right text-sm font-semibold tabular-nums"
            aria-label={`${label} progress, percent`}
          />
          <span className="text-sm text-stone-500">%</span>
        </span>
        <span className="flex gap-0.5">
          <button type="button" onClick={save} className="btn-icon bg-brand-50 text-brand-700 hover:bg-brand-100" title="Save" aria-label="Save progress">
            <Icon name="check" className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setDraft(null)} className="btn-icon" title="Cancel" aria-label="Cancel">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2.5">
      <div className="w-24 sm:w-36"><ProgressBar value={value} /></div>
      <span className="w-10 text-right text-sm font-semibold tabular-nums text-stone-800">{value}%</span>
      {onChange && (
        <button
          type="button"
          onClick={() => setDraft(value)}
          className="btn-icon"
          title="Edit progress"
          aria-label={`Edit ${label} progress`}
        >
          <Icon name="edit" className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

function toneFor(value: number) {
  if (value >= 100) return 'green' as const
  if (value > 0) return 'amber' as const
  return 'stone' as const
}

function PhaseRow({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className={`w-36 shrink-0 truncate text-sm ${muted ? 'text-stone-400' : 'text-stone-600'}`}>
        {label}
      </span>
      <div className="min-w-0 flex-1">
        <ProgressBar value={value} tone={muted ? 'stone' : toneFor(value)} size="sm" />
      </div>
      <span className={`w-11 shrink-0 text-right text-sm font-semibold tabular-nums ${
        muted ? 'text-stone-400' : 'text-stone-700'
      }`}>
        {value}%
      </span>
    </div>
  )
}

/**
 * Progress is computed from whichever modules the project actually carries, so
 * a design-only project is never penalised for having no execution phases.
 * Maintenance is shown greyed because it sits outside the percentage — it only
 * begins after handover.
 */
export function ProjectProgressPanel({ project }: { project: Project }) {
  const progress = computeProgress(project)

  return (
    <div className="space-y-5">
      {progress.design && (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">Design Progress</h3>
            <span className="text-sm font-bold tabular-nums text-brand-700">{progress.design.overall}%</span>
          </div>
          {progress.design.phases.map((p) => (
            <PhaseRow key={p.key} label={p.label} value={p.progress} />
          ))}
        </div>
      )}

      {progress.execution && (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">Execution Progress</h3>
            <span className="text-sm font-bold tabular-nums text-brand-700">{progress.execution.overall}%</span>
          </div>
          {progress.execution.phases.map((p) => (
            <PhaseRow key={p.key} label={p.label} value={p.progress} muted={!p.counted} />
          ))}
          {progress.execution.phases.some((p) => !p.counted) && (
            <p className="mt-1 text-xs text-stone-400">
              Maintenance is tracked separately and does not count toward progress.
            </p>
          )}
        </div>
      )}

      {progress.amc && (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">AMC Contract</h3>
            <span className="text-sm font-bold tabular-nums text-clay-700">{progress.amc.overall}%</span>
          </div>
          <PhaseRow label="Contract term elapsed" value={progress.amc.overall} muted={Boolean(progress.design || progress.execution)} />
          {(progress.design || progress.execution) && (
            <p className="mt-1 text-xs text-stone-400">The AMC runs alongside the project and does not count toward its progress.</p>
          )}
        </div>
      )}

      <div className="border-t border-stone-200 pt-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-sm font-bold uppercase tracking-wider text-stone-700">Overall</span>
          <span className="text-lg font-bold tabular-nums text-brand-700">{progress.overall}%</span>
        </div>
        <ProgressBar value={progress.overall} />
      </div>
    </div>
  )
}

/**
 * The scrollable phase strip the client asked to keep — every phase side by
 * side, scrolling horizontally when a project carries many of them.
 */
export function PhaseStrip({ project }: { project: Project }) {
  const progress = computeProgress(project)
  const phases = [
    ...(progress.design?.phases ?? []),
    ...(progress.execution?.phases ?? []),
    ...(progress.amc ? [{ key: 'amc', label: 'AMC term', progress: progress.amc.overall, counted: !progress.design && !progress.execution }] : []),
  ]

  return (
    <div className="scroll-x -mx-1 px-1 pb-2">
      <div className="flex gap-3">
        {phases.map((p) => (
          <div key={p.key} className="w-36 shrink-0 rounded-lg border border-stone-200 bg-stone-50 p-3">
            <p className="truncate text-xs font-medium text-stone-600" title={p.label}>{p.label}</p>
            <p className={`mt-1 text-xl font-bold tabular-nums ${p.counted ? 'text-stone-900' : 'text-stone-400'}`}>
              {p.progress}%
            </p>
            <div className="mt-2">
              <ProgressBar value={p.progress} tone={p.counted ? toneFor(p.progress) : 'stone'} size="sm" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Compact two-bar summary used in project lists. */
export function ProgressSummary({ project }: { project: Project }) {
  const progress = computeProgress(project)
  return (
    <div className="flex items-center gap-2">
      <div className="w-24"><ProgressBar value={progress.overall} size="sm" /></div>
      <span className="w-9 text-right text-xs font-semibold tabular-nums text-stone-600">
        {progress.overall}%
      </span>
    </div>
  )
}
