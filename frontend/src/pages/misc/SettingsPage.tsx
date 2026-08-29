import { useState } from 'react'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { can } from '../../domain/roles'
import { DESIGN_PHASES, PHASE_LABELS, type Settings } from '../../domain/types'
import {
  PageHeader, Section, Field, Checkbox, Badge, ProgressBar,
} from '../../components/ui'
import { Icon } from '../../components/Icon'

/** Presets the client mentioned by name in the structure document. */
const SPLIT_PRESETS: { label: string; split: Settings['designPaymentSplit'] }[] = [
  { label: '50 / 20 / 15 / 15', split: { concept: 50, threeD: 20, civilWork: 15, boq: 15 } },
  { label: '25 / 25 / 25 / 25', split: { concept: 25, threeD: 25, civilWork: 25, boq: 25 } },
  { label: '40 / 30 / 15 / 15', split: { concept: 40, threeD: 30, civilWork: 15, boq: 15 } },
]

/**
 * Everything the client asked to stay flexible rather than be assumed —
 * the design payment split, TA calculation, and the photo requirement.
 */
export function SettingsPage() {
  const db = useDb()
  const { roleKey } = useSession()
  const editable = can.editSettings(roleKey)
  const [draft, setDraft] = useState<Settings>(() => structuredClone(db.settings))
  const [saved, setSaved] = useState(false)

  const splitTotal = DESIGN_PHASES.reduce((sum, key) => sum + draft.designPaymentSplit[key], 0)
  const valid = splitTotal === 100

  const patch = (changes: Partial<Settings>) => {
    setDraft({ ...draft, ...changes })
    setSaved(false)
  }

  const save = () => {
    if (!valid) return
    api.settings.save(draft)
    setSaved(true)
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Settings"
        subtitle="The parts of the system the client asked to keep configurable."
        actions={!editable && <Badge tone="stone">Read only for your role</Badge>}
      />

      <Section
        title="Design Payment Structure"
        description="How the design fee is split across the four phases. Must total 100%."
        className="mb-6"
      >
        <div className="px-5 py-5">
          {editable && (
            <div className="mb-5 flex flex-wrap gap-2">
              {SPLIT_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => patch({ designPaymentSplit: { ...preset.split } })}
                  className="btn-secondary py-1.5 text-xs"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-4">
            {DESIGN_PHASES.map((key) => (
              <div key={key} className="flex items-center gap-4">
                <span className="w-36 shrink-0 text-sm text-stone-600">{PHASE_LABELS[key]}</span>
                <div className="min-w-0 flex-1">
                  <ProgressBar value={draft.designPaymentSplit[key]} />
                </div>
                <div className="flex w-24 shrink-0 items-center gap-1.5">
                  <input
                    type="number" min={0} max={100} disabled={!editable}
                    value={draft.designPaymentSplit[key]}
                    onChange={(e) => patch({
                      designPaymentSplit: {
                        ...draft.designPaymentSplit,
                        [key]: Math.max(0, Math.min(100, Number(e.target.value))),
                      },
                    })}
                    className="input py-1 text-right"
                    aria-label={`${PHASE_LABELS[key]} percentage`}
                  />
                  <span className="text-sm text-stone-500">%</span>
                </div>
              </div>
            ))}
          </div>

          <div className={`mt-4 flex items-center justify-between rounded-lg px-3 py-2.5 ${
            valid ? 'bg-brand-50' : 'bg-red-50'
          }`}>
            <span className={`text-sm font-medium ${valid ? 'text-brand-900' : 'text-red-900'}`}>
              Total
            </span>
            <span className={`text-sm font-bold tabular-nums ${valid ? 'text-brand-700' : 'text-red-700'}`}>
              {splitTotal}%
            </span>
          </div>
          {!valid && (
            <p className="mt-2 text-sm text-red-700">
              The split must total exactly 100% before it can be saved.
            </p>
          )}
        </div>
      </Section>

      <Section
        title="TA"
        description="The client's own term, kept as-is. No calculation is assumed until a rate is set."
        className="mb-6"
      >
        <div className="space-y-4 px-5 py-5">
          <Checkbox
            checked={draft.taEnabled}
            disabled={!editable}
            label="Calculate a TA amount from the recorded distance"
            onChange={(taEnabled) => patch({ taEnabled })}
          />
          {draft.taEnabled && (
            <Field label="Rate per km" hint="Applied to the distance each foreman records per worker.">
              <div className="flex items-center gap-2">
                <span className="text-sm text-stone-500">₹</span>
                <input
                  type="number" min={0} disabled={!editable} value={draft.taRatePerKm}
                  onChange={(e) => patch({ taRatePerKm: Math.max(0, Number(e.target.value)) })}
                  className="input w-32"
                />
                <span className="text-sm text-stone-500">per km</span>
              </div>
            </Field>
          )}
          {!draft.taEnabled && (
            <p className="text-sm text-stone-500">
              Foremen still record distance per worker; the system simply does not price it.
            </p>
          )}
        </div>
      </Section>

      <Section title="Daily Work Report" className="mb-6">
        <div className="space-y-4 px-5 py-5">
          <Checkbox
            checked={draft.photosMandatory}
            disabled={!editable}
            label="Require at least one site photo before a report can be submitted"
            onChange={(photosMandatory) => patch({ photosMandatory })}
          />
          <div>
            <p className="label mb-2">Who may adjust overtime</p>
            <div className="flex flex-wrap gap-1.5">
              {draft.otAdjustRoles.map((role) => (
                <Badge key={role} tone="green">{role.replace(/_/g, ' ')}</Badge>
              ))}
            </div>
            <p className="mt-2 text-xs text-stone-400">
              Foremen record the working hours; overtime is set by an authorised role.
            </p>
          </div>
        </div>
      </Section>

      <Section title="Maintenance" className="mb-6">
        <div className="px-5 py-5">
          <Field label="Free maintenance period" hint="Runs from handover, before any AMC begins.">
            <div className="flex items-center gap-2">
              <input
                type="number" min={0} disabled={!editable} value={draft.freeMaintenanceMonths}
                onChange={(e) => patch({ freeMaintenanceMonths: Math.max(0, Number(e.target.value)) })}
                className="input w-24"
              />
              <span className="text-sm text-stone-500">month(s)</span>
            </div>
          </Field>
        </div>
      </Section>

      {editable && (
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={save} disabled={!valid} className="btn-primary">Save Settings</button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm font-medium text-brand-700">
              <Icon name="check" className="h-4 w-4" /> Saved
            </span>
          )}
        </div>
      )}

      <Section title="Prototype Data" description="Restore the seeded demonstration data." className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-5">
          <p className="text-sm text-stone-500">
            Reports you submit and projects you create are kept in this browser.
            Resetting clears them and restores the original seed.
          </p>
          <button
            onClick={() => { api.reset(); window.location.reload() }}
            className="btn-danger shrink-0"
          >
            Reset prototype data
          </button>
        </div>
      </Section>
    </div>
  )
}
