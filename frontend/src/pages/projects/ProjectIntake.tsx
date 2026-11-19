import { EXECUTION_SPLIT, FEE_BASES, NEXT_ACTIONS, type ExecutionSplitKey, type FeeBasis, type NextAction, type Project } from '../../domain/types'
import { formatCurrency } from '../../domain/format'
import { totalValue } from '../../domain/workflow'
import { Checkbox, Field } from '../../components/ui'

/** The enquiry details noted as a project is opened — what the client asked for, and what happens next. */
export interface IntakeDraft {
  requirement: string
  siteVisitRequired: boolean
  feeBasis: FeeBasis | ''
  nextAction: NextAction | ''
}

/** Budget and value, kept apart: the budget is the client's figure, the values are Accounts'. */
export interface MoneyDraft {
  budget: string
  designValue: string
  executionValue: string
  /** Optional: the execution value entered part by part. When on, the execution value is the sum of the parts. */
  splitOn: boolean
  split: Record<ExecutionSplitKey, string>
}

export const intakeOf = (p?: Project): IntakeDraft => ({
  requirement: p?.requirement ?? '',
  siteVisitRequired: Boolean(p?.siteVisitRequired),
  feeBasis: p?.feeBasis ?? '',
  nextAction: p?.nextAction ?? '',
})

const splitOf = (p?: Project) =>
  Object.fromEntries(EXECUTION_SPLIT.map(({ key }) => [key, p?.executionSplit?.[key] ? String(p.executionSplit[key]) : ''])) as Record<ExecutionSplitKey, string>

export const moneyOf = (p?: Project): MoneyDraft => ({
  budget: p?.budget ? String(p.budget) : '',
  designValue: p?.designValue ? String(p.designValue) : '',
  executionValue: p?.executionValue ? String(p.executionValue) : '',
  splitOn: Object.values(p?.executionSplit ?? {}).some((v) => v && v > 0),
  split: splitOf(p),
})

/** The draft with the values of services the project does not have blanked out. */
export const forServices = (m: MoneyDraft, s: { design: boolean; execution: boolean }): MoneyDraft => ({
  ...m,
  designValue: s.design ? m.designValue : '',
  executionValue: s.execution ? m.executionValue : '',
  splitOn: s.execution && m.splitOn,
})

const amount = (text: string) => (Number(text) > 0 ? Number(text) : undefined)

/** The parts of the split that were filled in, or undefined when the split is off or empty. */
function splitParts(m: MoneyDraft): Project['executionSplit'] {
  if (!m.splitOn) return undefined
  const parts: NonNullable<Project['executionSplit']> = {}
  for (const { key } of EXECUTION_SPLIT) {
    const v = amount(m.split[key])
    if (v !== undefined) parts[key] = v
  }
  return Object.keys(parts).length ? parts : undefined
}

/** A money draft as stored on the project. `value` is what the dashboards count. */
export function moneyFields(m: MoneyDraft, fallbackValue: number) {
  const designValue = amount(m.designValue)
  const executionSplit = splitParts(m)
  const executionValue = executionSplit ? Object.values(executionSplit).reduce((a, b) => a + (b ?? 0), 0) : amount(m.executionValue)
  return { budget: amount(m.budget), designValue, executionValue, executionSplit, value: totalValue(designValue, executionValue, fallbackValue) }
}

export function moneyProblem(m: MoneyDraft): string | null {
  const fields: [string, string][] = [['budget', m.budget], ['design value', m.designValue]]
  if (m.splitOn) fields.push(...EXECUTION_SPLIT.map(({ key, label }) => [`${label.toLowerCase()} value`, m.split[key]] as [string, string]))
  else fields.push(['execution value', m.executionValue])
  for (const [label, text] of fields) {
    if (text && !(Number(text) >= 0)) return `The ${label} must be a number, or left blank.`
  }
  return null
}

/** A single-choice row of chips — the app's radio buttons. */
function ChoiceRow<T extends string>({ label, options, value, onChange }: {
  label: string; options: readonly T[]; value: T | ''; onChange: (v: T) => void
}) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className="mt-1.5 flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(o)}
            className={`chip py-2 text-sm ${value === o ? 'chip-on' : ''}`}
          >
            <span className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 ${value === o ? 'border-brand-600 bg-brand-600 shadow-[inset_0_0_0_2px_white]' : 'border-stone-300 bg-white'}`} />
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}

export function IntakeFields({ value, onChange }: { value: IntakeDraft; onChange: (v: IntakeDraft) => void }) {
  const set = (patch: Partial<IntakeDraft>) => onChange({ ...value, ...patch })
  return (
    <div className="space-y-5">
      <Field label="Preliminary Requirement" hint="What the client has asked for so far. The design wing's scope task starts from this.">
        <textarea
          rows={3} className="input" value={value.requirement} placeholder="e.g. Front lawn with a seating court, water feature, low-maintenance planting"
          onChange={(e) => set({ requirement: e.target.value })}
        />
      </Field>
      <Checkbox
        checked={value.siteVisitRequired}
        onChange={(siteVisitRequired) => set({ siteVisitRequired })}
        label="Site visit required before the proposal"
      />
      <ChoiceRow label="Proposed Fee Basis" options={FEE_BASES} value={value.feeBasis} onChange={(feeBasis) => set({ feeBasis })} />
      <ChoiceRow label="Next Action" options={NEXT_ACTIONS} value={value.nextAction} onChange={(nextAction) => set({ nextAction })} />
    </div>
  )
}

/**
 * The client's budget beside Accounts' project values. Only the project value
 * reaches the dashboards; it may change as the project goes on. The execution
 * value can be entered as one sum or, optionally, split by work.
 */
export function MoneyFields({ value, onChange, services, fallbackValue }: {
  value: MoneyDraft
  onChange: (v: MoneyDraft) => void
  services: { design: boolean; execution: boolean }
  fallbackValue: number
}) {
  const set = (patch: Partial<MoneyDraft>) => onChange({ ...value, ...patch })
  const stored = moneyFields(forServices(value, services), fallbackValue)
  const total = stored.value
  const splitTotal = stored.executionSplit ? stored.executionValue ?? 0 : 0
  const input = (key: 'budget' | 'designValue' | 'executionValue', aria: string) => (
    <input
      type="number" min={0} className="input" value={value[key]} placeholder="0" aria-label={aria}
      onChange={(e) => set({ [key]: e.target.value })}
    />
  )
  const toggleSplit = (on: boolean) => {
    // Turning the split off keeps the sum the parts came to as the single value.
    set({ splitOn: on, executionValue: !on && splitTotal ? String(splitTotal) : value.executionValue })
  }
  return (
    <div className="grid gap-5 sm:grid-cols-3">
      <Field label="Client Budget" hint="From the first discussion. Not counted on dashboards.">{input('budget', 'Client budget')}</Field>
      {services.design && (
        <Field label="Design Project Value" hint="Fixed by Accounts. Collected in the design slabs.">{input('designValue', 'Design project value')}</Field>
      )}
      {services.execution && (
        <Field
          label="Execution Project Value"
          hint={value.splitOn ? (splitTotal ? 'The sum of the split below.' : 'Stays at the sum entered until a part is filled in.') : 'Fixed by Accounts. Collected in the execution slabs.'}
        >
          {value.splitOn ? (
            <div className="input flex items-center bg-stone-50 font-semibold tabular-nums text-stone-900" aria-label="Execution project value">
              {formatCurrency(stored.executionValue ?? 0)}
            </div>
          ) : input('executionValue', 'Execution project value')}
        </Field>
      )}
      {services.execution && (
        <div className="space-y-3 sm:col-span-3">
          <Checkbox checked={value.splitOn} onChange={toggleSplit} label="Split the execution value by work (optional)" />
          {value.splitOn && (
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-stone-200 p-3 sm:grid-cols-3">
              {EXECUTION_SPLIT.map(({ key, label }) => (
                <Field key={key} label={label}>
                  <input
                    type="number" min={0} className="input" value={value.split[key]} placeholder="0" aria-label={`${label} value`}
                    onChange={(e) => set({ split: { ...value.split, [key]: e.target.value } })}
                  />
                </Field>
              ))}
            </div>
          )}
        </div>
      )}
      {(services.design || services.execution) && (
        <p className="rounded-lg bg-brand-50 px-3 py-2.5 text-sm text-brand-900 sm:col-span-3">
          Project value on dashboards: <strong className="tabular-nums">{formatCurrency(total)}</strong>
          {amount(value.budget) !== undefined && total > 0 && (
            <span className="ml-2 text-brand-700">· budget {formatCurrency(amount(value.budget)!)}</span>
          )}
        </p>
      )}
    </div>
  )
}
