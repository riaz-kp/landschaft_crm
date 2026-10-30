import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { addDays, today } from '../../domain/format'
import { PageHeader, Section, Field, Badge } from '../../components/ui'
import { newScope, scopeProblem, type ProjectScope } from '../../domain/projectScope'
import { DesignPhasePicker, ExecutionPhasePicker, ServicePicker } from './ProjectScope'
import { MapPicker } from '../../components/MapPicker'
import { ClientPicker } from './ClientPicker'
import { AmcFields, draftToRecord, emptyAmcDraft, endOf, validateAmc, type AmcDraft } from '../amc/AmcContractForm'
import { CHECKLISTS, commercialDocs } from '../../domain/commercial'
import { AREA_UNITS, PROJECT_CATEGORIES, type AreaUnit, type ClientDocKey, type LatLng, type ProjectCategory, type RoleKey } from '../../domain/types'
import { codeOwner, normaliseCode, suggestProjectCode } from '../../domain/projectInfo'
import { ClientDocsPicker, type DocState, type DraftDocFile } from './ClientDocuments'
import { useSession } from '../../state/session'
import { usePermissions } from '../../state/permissions'
import { NoAccess } from '../misc/Fallbacks'
import { Icon } from '../../components/Icon'
import { SearchSelect } from '../../components/SearchSelect'
import { employeeOptions } from '../../components/pickerOptions'
import { IntakeFields, MoneyFields, intakeOf, moneyFields, moneyOf, moneyProblem } from './ProjectIntake'
import { linkName, toLink } from '../../components/docLinks'

/** Roles that manage projects — who a new project is given to by default. */
const MANAGER_ROLES: RoleKey[] = ['design_pm', 'execution_pm', 'design_director', 'execution_head']

/**
 * Project creation from §18. Services come first and everything below reacts
 * to them, so a project only ever carries the phases actually sold. At least
 * one of Design or Execution must be selected.
 */
export function NewProject() {
  const db = useDb()
  const navigate = useNavigate()
  const { can } = usePermissions()
  // Budget and values are Accounts' to see and set; anyone else opens the project without them.
  const canSeeMoney = can('Accounts', 'view')
  const { user } = useSession()
  const [error, setError] = useState<string | null>(null)
  const [siteCoords, setSiteCoords] = useState<LatLng | undefined>()
  const [clientDocs, setClientDocs] = useState<Partial<Record<ClientDocKey, DocState>>>({})
  const [intake, setIntake] = useState(intakeOf)
  const [money, setMoney] = useState(moneyOf)
  const [links, setLinks] = useState<{ name: string; url: string }[]>([])
  const [docFiles, setDocFiles] = useState<DraftDocFile[]>([])

  const [form, setForm] = useState({
    code: suggestProjectCode(db.projects),
    category: '' as ProjectCategory | '',
    area: '',
    areaUnit: 'sq ft' as AreaUnit,
    name: '',
    clientId: db.clients[0]?.id ?? '',
    siteLocation: '',
    // The person opening it when they manage projects, else the first project manager.
    projectManagerId: MANAGER_ROLES.includes(user.role) ? user.id : db.employees.find((e) => MANAGER_ROLES.includes(e.role))?.id ?? user.id,
    startDate: today(),
    expectedCompletion: addDays(today(), 90),
  })
  const [scope, setScope] = useState<ProjectScope>(newScope)
  const { design, execution, amc } = scope.services
  const [amcDraft, setAmcDraft] = useState<AmcDraft>(() => emptyAmcDraft(today()))

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
    const problem = scopeProblem(scope)
    if (problem) return setError(problem)
    if (amc) {
      const problem = validateAmc(amcDraft)
      if (problem) return setError(`AMC: ${problem}`)
    }
    const moneyIssue = moneyProblem(money)
    if (moneyIssue) return setError(moneyIssue)
    const badLink = links.find((l) => l.url.trim() && !toLink(l.url))
    if (badLink) return setError(`“${badLink.url}” is not a link. Paste the full address, e.g. a Google Drive share link.`)

    setError(null)
    const { category, area, areaUnit, ...basics } = form
    const values = moneyFields({ ...money, designValue: design ? money.designValue : '', executionValue: execution ? money.executionValue : '' }, 0)
    const project = api.projects.create({
      ...basics,
      ...values,
      requirement: intake.requirement,
      siteVisitRequired: design && intake.siteVisitRequired,
      feeBasis: intake.feeBasis || undefined,
      nextAction: intake.nextAction || undefined,
      clientDocFiles: docFiles,
      documentLinks: links
        .filter((l) => toLink(l.url))
        .map((l) => ({ url: toLink(l.url)!, name: l.name.trim() || linkName(toLink(l.url)!) })),
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
      ...scope,
      amc: amc ? draftToRecord(amcDraft) : undefined,
      // An AMC-only project runs for the contract term and is worth the contract value.
      ...(amc && !design && !execution
        ? { expectedCompletion: endOf(amcDraft), value: amcDraft.value }
        : {}),
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

      <Section
        title="Enquiry"
        description="The client's preliminary requirement and what happens next. Opening a design project gives the Design Director the scope proposal as a task."
        className="mb-6"
      >
        <div className="px-5 py-5">
          <IntakeFields value={intake} onChange={setIntake} />
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
        <div className="px-5 py-5">
          <ServicePicker value={scope.services} onChange={(services) => setScope({ ...scope, services })} />
        </div>
      </Section>

      {/* Step 3 — conditional phase selection */}
      {design && (
        <Section title="Design Phases" className="mb-6">
          <div className="px-5 py-5">
            <DesignPhasePicker value={scope.designPhases} onChange={(designPhases) => setScope({ ...scope, designPhases })} />
          </div>
        </Section>
      )}

      {execution && (
        <Section title="Execution Phases" className="mb-6">
          <div className="space-y-3 px-5 py-5">
            <ExecutionPhasePicker value={scope.executionPhases} onChange={(executionPhases) => setScope({ ...scope, executionPhases })} />

            <p className="text-xs text-stone-500">
              The free maintenance month follows execution automatically. Tick AMC above to add an annual contract now.
            </p>
          </div>
        </Section>
      )}

      {canSeeMoney && (design || execution) && (
        <Section
          title="Budget & Project Value"
          description="The budget is what the client mentioned. The project values are fixed by Accounts, can change as the project goes on, and are what the dashboards show. Payment slabs come from Settings."
          className="mb-6"
        >
          <div className="px-5 py-5">
            <MoneyFields value={money} onChange={setMoney} services={{ design, execution }} fallbackValue={0} />
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
        description="Mark what the client has already handed over, and attach the files or paste links to them. Attaching either marks the document received. The rest stays pending on the project's Client Documents tab."
        className="mb-6"
        actions={<Badge tone="stone">{Object.values(clientDocs).filter((s) => s === 'Received').length} received</Badge>}
      >
        <div className="px-5 py-2">
          <ClientDocsPicker
            value={clientDocs}
            onChange={(key, state) => setClientDocs((docs) => ({ ...docs, [key]: state }))}
            files={docFiles}
            onFilesChange={setDocFiles}
          />
        </div>
      </Section>

      <Section
        title="Other Document Links"
        description="Anything that is not one of the client documents above — briefs, references, reports — kept in Google Drive, Dropbox or elsewhere. They are filed under the project's documents."
        className="mb-6"
        actions={<button type="button" onClick={() => setLinks([...links, { name: '', url: '' }])} className="btn-secondary py-1.5"><Icon name="link" className="h-4 w-4" /> Add link</button>}
      >
        <div className="space-y-3 px-5 py-4">
          {links.length === 0 && <p className="text-sm text-stone-400">No links yet.</p>}
          {links.map((link, i) => (
            <div key={i} className="flex flex-col gap-2 sm:flex-row">
              <input
                className="input sm:w-56" value={link.name} placeholder="Name (optional)" aria-label="Link name"
                onChange={(e) => setLinks(links.map((l, j) => (j === i ? { ...l, name: e.target.value } : l)))}
              />
              <input
                className="input min-w-0 flex-1" value={link.url} placeholder="https://drive.google.com/…" aria-label="Link address"
                onChange={(e) => setLinks(links.map((l, j) => (j === i ? { ...l, url: e.target.value } : l)))}
              />
              <button type="button" onClick={() => setLinks(links.filter((_, j) => j !== i))} className="btn-icon self-end sm:self-auto" aria-label="Remove link">
                <Icon name="trash" className="h-4 w-4" />
              </button>
            </div>
          ))}
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
