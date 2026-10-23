import type { ProjectScope } from '../../domain/projectScope'
import { Checkbox } from '../../components/ui'

/** Design, Execution and AMC as three large toggles. */
export function ServicePicker({
  value, onChange, amcHint = 'Annual Maintenance Contract — repeat visits with reminders. Can be sold alone.',
}: { value: ProjectScope['services']; onChange: (next: ProjectScope['services']) => void; amcHint?: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {([
        { key: 'design', label: 'Design', hint: 'Concept, 3D, civil work, BOQ' },
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

export function DesignPhasePicker({ value, onChange }: { value: ProjectScope['designPhases']; onChange: (next: ProjectScope['designPhases']) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Checkbox checked={value.concept} label="Concept" onChange={(v) => onChange({ ...value, concept: v })} />
      <Checkbox checked={value.threeD} label="3D Presentation" onChange={(v) => onChange({ ...value, threeD: v })} />
      <Checkbox checked={value.civilWork} label="Civil Work" onChange={(v) => onChange({ ...value, civilWork: v })} />
      <Checkbox checked={value.boq} label="BOQ" onChange={(v) => onChange({ ...value, boq: v })} />
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
