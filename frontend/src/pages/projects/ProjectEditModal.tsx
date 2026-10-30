import { useState } from 'react'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { codeOwner, normaliseCode } from '../../domain/projectInfo'
import {
  AREA_UNITS, PROJECT_CATEGORIES, PROJECT_STATUSES, type AreaUnit, type Project, type ProjectCategory, type ProjectStatus,
} from '../../domain/types'
import { Field, FormError, Modal } from '../../components/ui'
import { SearchSelect } from '../../components/SearchSelect'
import { employeeOptions } from '../../components/pickerOptions'
import { Icon } from '../../components/Icon'
import { applyScope, scopeOf, scopeProblem, type ProjectScope } from '../../domain/projectScope'
import { DesignPhasePicker, ExecutionPhasePicker, ServicePicker } from './ProjectScope'
import { IntakeFields, MoneyFields, intakeOf, moneyFields, moneyOf, moneyProblem } from './ProjectIntake'

/** Edits a project's details and scope — its services and phases. Every change is written to the project history. */
export function ProjectEditModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const db = useDb()
  const { user } = useSession()
  const [form, setForm] = useState({
    name: project.name,
    code: project.code,
    category: (project.category ?? '') as ProjectCategory | '',
    area: project.area ? String(project.area) : '',
    areaUnit: project.areaUnit ?? ('sq ft' as AreaUnit),
    status: project.status,
    siteLocation: project.siteLocation,
    projectManagerId: project.projectManagerId,
    startDate: project.startDate,
    expectedCompletion: project.expectedCompletion,
    value: project.value,
  })
  const [scope, setScopeState] = useState<ProjectScope>(() => scopeOf(project))
  const [intake, setIntake] = useState(() => intakeOf(project))
  const [money, setMoney] = useState(() => moneyOf(project))
  const { design, execution } = scope.services
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<typeof form>) => { setForm({ ...form, ...patch }); setError(null) }
  const setScope = (patch: Partial<ProjectScope>) => { setScopeState({ ...scope, ...patch }); setError(null) }
  const managers = db.employees.filter((e) =>
    ['design_pm', 'design_director', 'execution_pm', 'execution_head', 'ceo'].includes(e.role) || e.id === project.projectManagerId,
  )
  const taken = form.code ? codeOwner(db.projects, form.code, project.id) : undefined
  const hasAmcContract = db.maintenance.some((m) => m.projectId === project.id && m.type === 'AMC')
  const was = project.services
  const droppedService = (was.design && !scope.services.design) || (was.execution && !scope.services.execution)

  const save = () => {
    if (!form.name.trim()) return setError('Enter a project name.')
    if (!normaliseCode(form.code)) return setError('Enter a project code.')
    if (taken) return setError(`Project code ${normaliseCode(form.code)} is already used by “${taken.name}”.`)
    if (!form.category) return setError('Choose the project type.')
    if (form.area && !(Number(form.area) > 0)) return setError('The site area must be a number above zero, or left blank.')
    if (!form.siteLocation.trim()) return setError('Enter the site location.')
    if (form.expectedCompletion < form.startDate) return setError('Expected completion cannot be before the start date.')
    const problem = scopeProblem(scope)
    if (problem) return setError(problem)
    const moneyIssue = moneyProblem(money)
    if (moneyIssue) return setError(moneyIssue)
    if (hasAmcContract && !scope.services.amc) {
      return setError('This project has an AMC contract. Delete it from the AMC tab before taking AMC off the services.')
    }
    api.projects.update(project.id, {
      ...applyScope(scope, project),
      name: form.name.trim(),
      code: normaliseCode(form.code),
      category: form.category,
      area: form.area ? Number(form.area) : undefined,
      areaUnit: form.area ? form.areaUnit : undefined,
      status: form.status,
      siteLocation: form.siteLocation.trim(),
      projectManagerId: form.projectManagerId,
      startDate: form.startDate,
      expectedCompletion: form.expectedCompletion,
      ...moneyFields({ ...money, designValue: design ? money.designValue : '', executionValue: execution ? money.executionValue : '' }, Number(form.value) || 0),
      requirement: intake.requirement.trim() || undefined,
      siteVisitRequired: design && intake.siteVisitRequired ? true : undefined,
      feeBasis: intake.feeBasis || undefined,
      nextAction: intake.nextAction || undefined,
    }, user.id)
    onClose()
  }

  return (
    <Modal
      title="Edit project"
      size="lg"
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={save} className="btn-primary">Save changes</button>
      </>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Project Name" required>
            <input className="input" value={form.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
        </div>
        <Field label="Project Code" required>
          <input
            className="input font-mono uppercase tracking-wide" value={form.code}
            onChange={(e) => set({ code: e.target.value.toUpperCase() })}
          />
          {taken && <p className="mt-1 text-xs font-medium text-red-600">Already used by {taken.name}.</p>}
        </Field>
        <Field label="Status">
          <select className="input" value={form.status} onChange={(e) => set({ status: e.target.value as ProjectStatus })}>
            {PROJECT_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <span className="label">Project Type<span className="ml-0.5 text-red-500">*</span></span>
          <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PROJECT_CATEGORIES.map((c) => (
              <button
                key={c} type="button" onClick={() => set({ category: c })}
                className={`chip justify-center py-2 text-sm ${form.category === c ? 'chip-on' : ''}`}
                aria-pressed={form.category === c}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <Field label="Site Area">
          <div className="flex gap-2">
            <input
              type="number" min={0} step="any" className="input min-w-0 flex-1" value={form.area} placeholder="e.g. 4500"
              onChange={(e) => set({ area: e.target.value })}
            />
            <select className="input w-28 shrink-0" value={form.areaUnit} onChange={(e) => set({ areaUnit: e.target.value as AreaUnit })} aria-label="Area unit">
              {AREA_UNITS.map((u) => <option key={u}>{u}</option>)}
            </select>
          </div>
        </Field>
        <Field label="Site Location" required>
          <input className="input" value={form.siteLocation} onChange={(e) => set({ siteLocation: e.target.value })} />
        </Field>
        <Field label="Project Manager">
          <SearchSelect
            value={form.projectManagerId}
            onChange={(projectManagerId) => set({ projectManagerId })}
            options={employeeOptions(managers)}
            searchPlaceholder="Search managers"
            title="Project manager"
          />
        </Field>
        {!design && !execution && (
          <Field label="Contract Value" hint="In rupees.">
            <input type="number" min={0} className="input" value={form.value || ''} onChange={(e) => set({ value: Number(e.target.value) })} />
          </Field>
        )}
        <Field label="Start Date">
          <input type="date" className="input" value={form.startDate} onChange={(e) => set({ startDate: e.target.value })} />
        </Field>
        <Field label="Expected Completion">
          <input type="date" className="input" value={form.expectedCompletion} onChange={(e) => set({ expectedCompletion: e.target.value })} />
        </Field>

        {/* Not a <label>: these hold their own buttons and checkboxes. */}
        <div className="space-y-4 border-t border-stone-100 pt-4 sm:col-span-2">
          <div>
            <span className="label">Services<span className="ml-0.5 text-red-500">*</span></span>
            <div className="mt-1.5">
              <ServicePicker
                value={scope.services} onChange={(services) => setScope({ services })}
                amcHint="Annual Maintenance Contract — repeat visits with reminders."
              />
            </div>
          </div>
          {scope.services.design && (
            <div>
              <span className="label">Design Phases</span>
              <div className="mt-2"><DesignPhasePicker value={scope.designPhases} onChange={(designPhases) => setScope({ designPhases })} /></div>
            </div>
          )}
          {scope.services.execution && (
            <div>
              <span className="label">Execution Phases</span>
              <div className="mt-2"><ExecutionPhasePicker value={scope.executionPhases} onChange={(executionPhases) => setScope({ executionPhases })} /></div>
            </div>
          )}
          {droppedService && (
            <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
              Phase progress is kept, so switching a service back on restores it. Tasks, reports and documents already on the project stay.
            </p>
          )}
          {scope.services.amc && !hasAmcContract && (
            <p className="text-xs text-stone-500">Set up the AMC contract — visit schedule, reminders and renewal — from the project's AMC tab once saved.</p>
          )}
        </div>

        <div className="space-y-4 border-t border-stone-100 pt-4 sm:col-span-2">
          <IntakeFields value={intake} onChange={(v) => { setIntake(v); setError(null) }} />
        </div>
        {(design || execution) && (
          <div className="border-t border-stone-100 pt-4 sm:col-span-2">
            <MoneyFields value={money} onChange={(v) => { setMoney(v); setError(null) }} services={{ design, execution }} fallbackValue={Number(form.value) || 0} />
          </div>
        )}

        <div className="sm:col-span-2"><FormError message={error} /></div>
      </div>
    </Modal>
  )
}
