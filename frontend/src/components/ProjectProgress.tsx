import { computeProgress } from '../domain/progress'
import type { Project } from '../domain/types'
import { ProgressBar } from './ui'

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
  const phases = [...(progress.design?.phases ?? []), ...(progress.execution?.phases ?? [])]

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
