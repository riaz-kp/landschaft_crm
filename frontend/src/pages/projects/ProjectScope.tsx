import type { ProjectScope } from '../../domain/projectScope'
import { Badge, Checkbox, type Tone } from '../../components/ui'
import { useDb } from '../../state/useDb'
import { PHASE_LABELS, PROJECT_POSITIONINGS, type DesignPhaseKey, type ProjectPositioning } from '../../domain/types'

const POSITIONING_HINTS: Record<ProjectPositioning, string> = {
  Basic: 'Essential finishes, tight budget',
  Standard: 'Balanced finishes and spend',
  Premium: 'High-end materials, fine detail',
}

const POSITIONING_TONES: Record<ProjectPositioning, Tone> = { Basic: 'stone', Standard: 'blue', Premium: 'amber' }

/** A project's positioning as a badge. */
export function PositioningBadge({ value }: { value?: ProjectPositioning }) {
  return value ? <Badge tone={POSITIONING_TONES[value]}>{value}</Badge> : null
}

/** Basic, Standard or Premium, as three buttons. Not a <label>: it holds buttons. */
export function PositioningPicker({ value, onChange, required }: {
  value: ProjectPositioning | ''; onChange: (next: ProjectPositioning) => void; required?: boolean
}) {
  return (
    <div>
      <span className="label">Project Positioning{required && <span className="ml-0.5 text-red-500">*</span>}</span>
      <div className="mt-1.5 grid grid-cols-3 gap-2">
        {PROJECT_POSITIONINGS.map((p) => (
          <button
            key={p} type="button" onClick={() => onChange(p)} aria-pressed={value === p}
            className={`flex flex-col justify-start rounded-xl border-2 px-3 py-2 text-left transition-colors ${
              value === p ? 'border-brand-500 bg-brand-50' : 'border-stone-200 bg-white hover:border-stone-300'
            }`}
          >
            <span className="block text-sm font-semibold text-stone-900">{p}</span>
            <span className="mt-0.5 hidden text-xs text-stone-500 sm:block">{POSITIONING_HINTS[p]}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** Design, Execution and AMC as three large toggles. */
export function ServicePicker({
  value, onChange, amcHint = 'Annual Maintenance Contract — repeat visits with reminders. Can be sold alone.',
}: { value: ProjectScope['services']; onChange: (next: ProjectScope['services']) => void; amcHint?: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {([
        { key: 'design', label: 'Design', hint: 'Concept, presentation, design detailing, documentation' },
        { key: 'execution', label: 'Execution', hint: 'Hardscape, softscape, MEP, maintenance' },
        { key: 'amc', label: 'AMC', hint: amcHint },
      ] as const).map((service) => {
        const on = value[service.key]
        return (
          <button
            key={service.key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange({ ...value, [service.key]: !on })}
            className={`rounded-xl border-2 p-4 text-left transition-colors ${
              on ? 'border-brand-500 bg-brand-50' : 'border-stone-200 bg-white hover:border-stone-300'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <span className={`flex h-5 w-5 items-center justify-center rounded border-2 ${
                on ? 'border-brand-600 bg-brand-600' : 'border-stone-300'
              }`}>
                {on && (
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </span>
              <span className="font-semibold text-stone-900">{service.label}</span>
            </span>
            <span className="mt-1.5 block pl-[30px] text-sm text-stone-500">{service.hint}</span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * The five design phases, with design detailing's two phases grouped. Each
 * shows its share of the design fee from Settings; the concept's is the advance.
 */
export function DesignPhasePicker({ value, onChange }: { value: ProjectScope['designPhases']; onChange: (next: ProjectScope['designPhases']) => void }) {
  const split = useDb().settings.designPaymentSplit
  const row = (key: DesignPhaseKey, label = PHASE_LABELS[key]) => (
    <div className="flex items-center justify-between gap-3">
      <Checkbox checked={value[key]} label={label} onChange={(v) => onChange({ ...value, [key]: v })} />
      <span className="shrink-0 text-xs tabular-nums text-stone-500">
        {split[key]}%{key === 'concept' && <span className="ml-1 rounded bg-brand-50 px-1.5 py-0.5 font-medium text-brand-700">advance</span>}
      </span>
    </div>
  )
  return (
    <div className="space-y-3">
      {row('concept')}
      {row('presentation')}
      <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
        <p className="mb-2.5 text-sm font-semibold text-stone-800">Design Detailing</p>
        <div className="space-y-2.5 border-l-2 border-stone-300 pl-4">
          {row('detailing1', 'Phase 1')}
          {row('detailing2', 'Phase 2')}
        </div>
      </div>
      {row('documentation')}
      <p className="border-t border-stone-100 pt-3 text-xs text-stone-500">
        Share of the design value collected for each phase, as set in Settings → Design Payment Structure. Each is collected
        before its phase starts: the concept as the advance, the rest as the phase before is finished.
      </p>
    </div>
  )
}

export function ExecutionPhasePicker({ value, onChange }: { value: ProjectScope['executionPhases']; onChange: (next: ProjectScope['executionPhases']) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Checkbox checked={value.hardscape} label="Hardscape" onChange={(v) => onChange({ ...value, hardscape: v })} />
        <Checkbox checked={value.softscape} label="Softscape" onChange={(v) => onChange({ ...value, softscape: v })} />
      </div>

      <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
        <Checkbox
          checked={value.mep} label={<span className="font-semibold">MEP (Optional)</span>}
          onChange={(v) => onChange({
            ...value, mep: v,
            // Clearing MEP clears its sub-services too.
            irrigation: v && value.irrigation,
            electrical: v && value.electrical,
            drainage: v && value.drainage,
          })}
        />
        {value.mep && (
          <div className="mt-3 space-y-2.5 border-l-2 border-stone-300 pl-4">
            <Checkbox checked={value.irrigation} label="Irrigation" onChange={(v) => onChange({ ...value, irrigation: v })} />
            <Checkbox checked={value.electrical} label="Electrical" onChange={(v) => onChange({ ...value, electrical: v })} />
            <Checkbox checked={value.drainage} label="Drainage" onChange={(v) => onChange({ ...value, drainage: v })} />
          </div>
        )}
      </div>
    </div>
  )
}
