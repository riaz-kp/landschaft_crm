import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { addDays, today } from '../../domain/format'
import { PageHeader, Section, Field, Checkbox, Badge } from '../../components/ui'
import { MapPicker } from '../../components/MapPicker'
import { ClientPicker } from './ClientPicker'
import { AmcFields, draftToRecord, emptyAmcDraft, endOf, validateAmc, type AmcDraft } from '../amc/AmcContractForm'
import { CHECKLISTS, commercialDocs } from '../../domain/commercial'
import { AREA_UNITS, PROJECT_CATEGORIES, type AreaUnit, type ClientDocKey, type LatLng, type ProjectCategory } from '../../domain/types'
import { codeOwner, normaliseCode, suggestProjectCode } from '../../domain/projectInfo'
import { ClientDocsPicker, type DocState } from './ClientDocuments'
import { useSession } from '../../state/session'
import { usePermissions } from '../../state/permissions'
import { NoAccess } from '../misc/Fallbacks'
import { Icon } from '../../components/Icon'
import { SearchSelect } from '../../components/SearchSelect'
import { employeeOptions } from '../../components/pickerOptions'

/**
 * Project creation from §18. Services come first and everything below reacts
 * to them, so a project only ever carries the phases actually sold. At least
 * one of Design or Execution must be selected.
 */
export function NewProject() {
  const db = useDb()
  const navigate = useNavigate()
  const { can } = usePermissions()
  const { user } = useSession()
  const [error, setError] = useState<string | null>(null)
  const [siteCoords, setSiteCoords] = useState<LatLng | undefined>()
  const [clientDocs, setClientDocs] = useState<Partial<Record<ClientDocKey, DocState>>>({})

  const [form, setForm] = useState({
    code: suggestProjectCode(db.projects),
    category: '' as ProjectCategory | '',
    area: '',
    areaUnit: 'sq ft' as AreaUnit,
    name: '',
    clientId: db.clients[0]?.id ?? '',
    siteLocation: '',
    projectManagerId: 'e3',
    startDate: today(),
    expectedCompletion: addDays(today(), 90),
    value: 0,
  })
  const [design, setDesign] = useState(true)
  const [execution, setExecution] = useState(false)
  const [amc, setAmc] = useState(false)
  const [amcDraft, setAmcDraft] = useState<AmcDraft>(() => emptyAmcDraft(today()))
  const [designPhases, setDesignPhases] = useState({
    concept: true, threeD: true, civilWork: true, boq: true,
  })
  const [executionPhases, setExecutionPhases] = useState({
    hardscape: true, softscape: true, mep: false,
    irrigation: false, electrical: false, drainage: false,
  })

  const managers = db.employees.filter((e) =>
    ['design_pm', 'design_director', 'execution_pm', 'execution_head'].includes(e.role),
  )

  if (!can('Projects', 'create')) return <NoAccess />

  const docs = commercialDocs({ design, execution, amc })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return setError('Enter a project name.')
    if (!normaliseCode(form.code)) return setError('Enter a project code.')
    const taken = codeOwner(db.projects, form.code)
    if (taken) return setError(`Project code ${normaliseCode(form.code)} is already used by “${taken.name}”.`)
    if (!form.category) return setError('Choose the project type — Residential, Commercial, Hospitality or Institutional.')
    if (form.area && !(Number(form.area) > 0)) return setError('The site area must be a number above zero, or left blank.')
    if (!form.clientId) return setError('Select a client.')
    if (!form.siteLocation.trim()) return setError('Enter the site location.')
    if (!design && !execution && !amc) return setError('Select at least one service — Design, Execution or AMC.')
    if (design && !Object.values(designPhases).some(Boolean)) {
      return setError('Select at least one design phase.')
    }
    if (execution && !executionPhases.hardscape && !executionPhases.softscape && !executionPhases.mep) {
      return setError('Select at least one execution phase.')
    }
    if (execution && executionPhases.mep &&
        !executionPhases.irrigation && !executionPhases.electrical && !executionPhases.drainage) {
      return setError('Select at least one MEP service, or turn MEP off.')
    }
    if (amc) {
      const problem = validateAmc(amcDraft)
      if (problem) return setError(`AMC: ${problem}`)
    }

    setError(null)
    const { category, area, areaUnit, ...basics } = form
    const project = api.projects.create({
      ...basics,
      code: normaliseCode(form.code),
      category,
      area: area ? Number(area) : undefined,
      areaUnit,
      clientDocs: Object.fromEntries(
        Object.entries(clientDocs)
          .filter(([, state]) => state !== 'Pending')
          .map(([key, state]) => [key, { status: state as 'Received' | 'Not Needed', by: user.id, on: today() }]),
      ),
      siteCoords,
      services: { design, execution, amc },
      amc: amc ? draftToRecord(amcDraft) : undefined,
      // An AMC-only project runs for the contract term and is worth the contract value.
      ...(amc && !design && !execution
        ? { expectedCompletion: endOf(amcDraft), value: form.value || amcDraft.value }
        : {}),
      designPhases,
      executionPhases,
    }, user.id)
    navigate(`/projects/${project.id}`)
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-4xl">
      <PageHeader
        title="New Project"
        subtitle="A project carries Design, Execution, an AMC — or any mix of them. Only the services actually sold."
      />

      {/* Step 1 — Basic Information */}
      <Section title="Basic Information" className="mb-6">
        <div className="grid gap-5 px-5 py-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Project Name" required>
              <input
                type="text" value={form.name} placeholder="e.g. Residence Landscape Design"
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input"
              />
            </Field>
          </div>
          <Field label="Project Code" required hint="Suggested from the LS-year-number series. Change it to use your own.">
            <div className="flex gap-2">
              <input
                type="text" value={form.code} placeholder="e.g. LS-2026-009"
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                className="input font-mono uppercase tracking-wide"
              />
              {normaliseCode(form.code) !== suggestProjectCode(db.projects) && (
                <button type="button" onClick={() => setForm({ ...form, code: suggestProjectCode(db.projects) })} className="btn-secondary shrink-0 px-3" title="Use the next code in the series">
                  Reset
                </button>
              )}
            </div>
            {form.code && codeOwner(db.projects, form.code) && (
              <p className="mt-1 text-xs font-medium text-red-600">Already used by {codeOwner(db.projects, form.code)!.name}.</p>
            )}
          </Field>
          <Field label="Site Area" hint="Optional. Square feet for gardens; cents or acres for land.">
            <div className="flex gap-2">
              <input
                type="number" min={0} step="any" value={form.area} placeholder="e.g. 4500"
                onChange={(e) => setForm({ ...form, area: e.target.value })}
                className="input min-w-0 flex-1"
              />
              <select
                value={form.areaUnit} onChange={(e) => setForm({ ...form, areaUnit: e.target.value as AreaUnit })}
                className="input w-28 shrink-0" aria-label="Area unit"
              >
                {AREA_UNITS.map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
          </Field>
          {/* Not a <label>: it holds a row of buttons. */}
          <div className="sm:col-span-2">
            <span className="label">Project Type<span className="ml-0.5 text-red-500">*</span></span>
            <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PROJECT_CATEGORIES.map((c) => (
                <button
                  key={c} type="button" onClick={() => setForm({ ...form, category: c })}
                  className={`chip justify-center py-2 text-sm ${form.category === c ? 'chip-on' : ''}`}
                  aria-pressed={form.category === c}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          {/* Not a <label>: the picker holds its own buttons, which a label would re-trigger. */}
          <div>
            <span className="label">Client<span className="ml-0.5 text-red-500">*</span></span>
            <div className="mt-1.5">
              <ClientPicker value={form.clientId} onChange={(clientId) => setForm((f) => ({ ...f, clientId }))} />
            </div>
          </div>
          <Field label="Site Location" required>
            <input
              type="text" value={form.siteLocation} placeholder="e.g. Kovalam, Thiruvananthapuram"
              onChange={(e) => setForm({ ...form, siteLocation: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Project Manager">
            <SearchSelect
              value={form.projectManagerId}
              onChange={(projectManagerId) => setForm({ ...form, projectManagerId })}
              options={employeeOptions(managers)}
              searchPlaceholder="Search managers"
              title="Project manager"
            />
          </Field>
          <Field label="Contract Value" hint="In rupees. Can be set later.">
            <input
              type="number" min={0} value={form.value || ''} placeholder="0"
              onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
              className="input"
            />
          </Field>
          <Field label="Start Date">
            <input
              type="date" value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Expected Completion">
            <input
              type="date" value={form.expectedCompletion}
              onChange={(e) => setForm({ ...form, expectedCompletion: e.target.value })}
              className="input"
            />
          </Field>
        </div>
      </Section>

      {/* Site on the map */}
      <Section
        title="Site Location on Map"
        description="Search for the place or click the map to drop a pin on the exact site. Foremen and the site team can open it in Google Maps."
        className="mb-6"
        actions={siteCoords && <Badge tone="green">Pinned</Badge>}
      >
        <div className="px-5 py-5">
          <MapPicker
            value={siteCoords}
            onChange={setSiteCoords}
            onPlaceName={(name) => setForm((f) => (f.siteLocation.trim() ? f : { ...f, siteLocation: name }))}
            initialQuery={form.siteLocation}
          />
        </div>
      </Section>

      {/* Step 2 — Project Services */}
      <Section
        title="Project Services"
        description="At least one must be selected."
        className="mb-6"
      >
        <div className="grid gap-3 px-5 py-5 sm:grid-cols-3">
          {[
            { on: design, set: setDesign, label: 'Design', hint: 'Concept, 3D, civil work, BOQ' },
            { on: execution, set: setExecution, label: 'Execution', hint: 'Hardscape, softscape, MEP, maintenance' },
            { on: amc, set: setAmc, label: 'AMC', hint: 'Annual Maintenance Contract — repeat visits with reminders. Can be sold alone.' },
          ].map((service) => (
            <button
              key={service.label}
              type="button"
              onClick={() => service.set(!service.on)}
              className={`rounded-xl border-2 p-4 text-left transition-colors ${
                service.on ? 'border-brand-500 bg-brand-50' : 'border-stone-200 bg-white hover:border-stone-300'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <span className={`flex h-5 w-5 items-center justify-center rounded border-2 ${
                  service.on ? 'border-brand-600 bg-brand-600' : 'border-stone-300'
                }`}>
                  {service.on && (
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                </span>
                <span className="font-semibold text-stone-900">{service.label}</span>
              </span>
              <span className="mt-1.5 block pl-[30px] text-sm text-stone-500">{service.hint}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* Step 3 — conditional phase selection */}
      {design && (
        <Section title="Design Phases" className="mb-6">
          <div className="grid gap-3 px-5 py-5 sm:grid-cols-2">
            <Checkbox
              checked={designPhases.concept} label="Concept"
              onChange={(v) => setDesignPhases({ ...designPhases, concept: v })}
            />
            <Checkbox
              checked={designPhases.threeD} label="3D Presentation"
              onChange={(v) => setDesignPhases({ ...designPhases, threeD: v })}
            />
            <Checkbox
              checked={designPhases.civilWork} label="Civil Work"
              onChange={(v) => setDesignPhases({ ...designPhases, civilWork: v })}
            />
            <Checkbox
              checked={designPhases.boq} label="BOQ"
              onChange={(v) => setDesignPhases({ ...designPhases, boq: v })}
            />
          </div>
        </Section>
      )}

      {execution && (
        <Section title="Execution Phases" className="mb-6">
          <div className="space-y-3 px-5 py-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Checkbox
                checked={executionPhases.hardscape} label="Hardscape"
                onChange={(v) => setExecutionPhases({ ...executionPhases, hardscape: v })}
              />
              <Checkbox
                checked={executionPhases.softscape} label="Softscape"
                onChange={(v) => setExecutionPhases({ ...executionPhases, softscape: v })}
              />
            </div>

            <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
              <Checkbox
                checked={executionPhases.mep} label={<span className="font-semibold">MEP (Optional)</span>}
                onChange={(v) => setExecutionPhases({
                  ...executionPhases, mep: v,
                  // Clearing MEP clears its sub-services too.
                  irrigation: v && executionPhases.irrigation,
                  electrical: v && executionPhases.electrical,
                  drainage: v && executionPhases.drainage,
                })}
              />
              {executionPhases.mep && (
                <div className="mt-3 space-y-2.5 border-l-2 border-stone-300 pl-4">
                  <Checkbox
                    checked={executionPhases.irrigation} label="Irrigation"
                    onChange={(v) => setExecutionPhases({ ...executionPhases, irrigation: v })}
                  />
                  <Checkbox
                    checked={executionPhases.electrical} label="Electrical"
                    onChange={(v) => setExecutionPhases({ ...executionPhases, electrical: v })}
                  />
                  <Checkbox
                    checked={executionPhases.drainage} label="Drainage"
                    onChange={(v) => setExecutionPhases({ ...executionPhases, drainage: v })}
                  />
                </div>
              )}
            </div>

            <p className="text-xs text-stone-500">
              The free maintenance month follows execution automatically. Tick AMC above to add an annual contract now.
            </p>
          </div>
        </Section>
      )}

      {amc && (
        <Section
          title="AMC — Annual Maintenance Contract"
          description={design || execution
            ? "Runs alongside the project. Set how often the site is visited and how far ahead the team is reminded."
            : "An AMC-only project: we maintain a garden someone else built. The project runs for the contract term."}
          className="mb-6"
        >
          <div className="px-5 py-5">
            <AmcFields draft={amcDraft} onChange={setAmcDraft} />
          </div>
        </Section>
      )}

      <Section
        title="Client Documents Received"
        description="Mark what the client has already handed over. The rest stays pending on the project's Client Documents tab, where files can be attached."
        className="mb-6"
        actions={<Badge tone="stone">{Object.values(clientDocs).filter((s) => s === 'Received').length} received</Badge>}
      >
        <div className="px-5 py-2">
          <ClientDocsPicker value={clientDocs} onChange={(key, state) => setClientDocs((docs) => ({ ...docs, [key]: state }))} />
        </div>
      </Section>

      {/* Commercial documents follow the services chosen above. */}
      {docs.length > 0 && (
        <Section
          title="BOQ & Quotation"
          description={
            design && execution ? 'Design + Execution carries both a BOQ and a Quotation.'
              : design ? 'Design only carries a BOQ — no quotation.'
              : execution ? 'Execution only carries a Quotation — no BOQ.' : 'An AMC is priced on a Quotation.'
          }
          className="mb-6"
        >
          <div className={`grid gap-4 px-5 py-5 ${docs.length === 2 ? 'sm:grid-cols-2' : ''}`}>
            {docs.map((doc) => (
              <div key={doc} className="rounded-xl border border-stone-200 bg-stone-50/60 p-4">
                <p className="flex items-center gap-2 font-semibold text-stone-900">
                  <Icon name="doc" className="h-4 w-4 text-brand-600" /> {doc} checklist
                </p>
                <ul className="mt-3 space-y-1.5">
                  {CHECKLISTS[doc].map((item) => (
                    <li key={item.id} className="flex items-center gap-2 text-sm text-stone-600">
                      <span className="h-3.5 w-3.5 shrink-0 rounded border border-stone-300 bg-white" /> {item.label}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="border-t border-stone-100 px-5 py-3 text-xs text-stone-400">
            Tick these off on the project's BOQ &amp; Quotation tab as the work moves along.
          </p>
        </Section>
      )}

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4">
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button type="submit" className="btn-primary">Create Project</button>
        <button type="button" onClick={() => navigate('/projects')} className="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  )
}
