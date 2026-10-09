import { useState } from 'react'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { usePermissions } from '../../state/permissions'
import { PermissionMatrixEditor } from './PermissionMatrix'
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
  const { can } = usePermissions()
  const editable = can('Settings', 'edit')
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
    // Holidays are marked from the attendance register, so keep whatever is stored now.
    api.settings.save({ ...draft, holidays: db.settings.holidays })
    setSaved(true)
  }

  const { holidays: _a, ...draftRest } = draft
  const { holidays: _b, ...storedRest } = db.settings
  const dirty = JSON.stringify(draftRest) !== JSON.stringify(storedRest)

  return (
    <div className="mx-auto max-w-5xl pb-20">
      <PageHeader
        title="Settings"
        subtitle="Roles and permissions, and the parts of the system the client asked to keep configurable."
        actions={!editable && <Badge tone="stone">Read only for your role</Badge>}
      />

      <Section
        title="Roles & Permissions"
        description="Tick what each role may view, create, edit and delete in every module. Changes apply to everyone with that role once saved."
        className="mb-6"
      >
        <div className="px-5 pt-4 pb-5">
          <PermissionMatrixEditor
            value={draft.permissions}
            onChange={(permissions) => patch({ permissions })}
            disabled={!editable}
          />
        </div>
      </Section>

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
            label="Require a morning and an evening site photo before a report can be submitted"
            onChange={(photosMandatory) => patch({ photosMandatory })}
          />
          <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-4">
            <p className="label">Photo compression</p>
            <p className="mt-1 text-xs text-stone-500">
              Photos are shrunk on the foreman's phone before upload, so a 4–8 MB camera picture becomes a few hundred KB.
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label="Longest side" hint="Pixels. 1600 keeps detail for site records.">
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={640} max={4000} step={80} disabled={!editable} value={draft.photoMaxPx}
                    onChange={(e) => patch({ photoMaxPx: Math.max(640, Math.min(4000, Number(e.target.value))) })}
                    className="input w-28"
                  />
                  <span className="text-sm text-stone-500">px</span>
                </div>
              </Field>
              <Field label="Target size" hint="Quality steps down until each photo is under this.">
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={80} max={2000} step={20} disabled={!editable} value={draft.photoMaxKb}
                    onChange={(e) => patch({ photoMaxKb: Math.max(80, Math.min(2000, Number(e.target.value))) })}
                    className="input w-28"
                  />
                  <span className="text-sm text-stone-500">KB per photo</span>
                </div>
              </Field>
            </div>
          </div>
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

      {editable && (dirty || saved) && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 backdrop-blur lg:left-64">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            {saved && !dirty ? (
              <span className="flex items-center gap-1.5 text-sm font-medium text-brand-700">
                <Icon name="check" className="h-4 w-4" /> Settings saved
              </span>
            ) : (
              <span className="text-sm text-stone-600">
                You have unsaved changes{!valid && <span className="font-medium text-red-700"> — the payment split must total 100%</span>}.
              </span>
            )}
            <div className="flex gap-2">
              {dirty && (
                <button onClick={() => { setDraft(structuredClone(db.settings)); setSaved(false) }} className="btn-secondary">
                  Discard
                </button>
              )}
              <button onClick={save} disabled={!valid || !dirty} className="btn-primary">Save settings</button>
            </div>
          </div>
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
