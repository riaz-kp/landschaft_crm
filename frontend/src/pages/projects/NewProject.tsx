import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { addDays, today } from '../../domain/format'
import { PageHeader, Section, Field, Checkbox } from '../../components/ui'
import { Icon } from '../../components/Icon'

/**
 * Project creation from §18. Services come first and everything below reacts
 * to them, so a project only ever carries the phases actually sold. At least
 * one of Design or Execution must be selected.
 */
export function NewProject() {
  const db = useDb()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
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

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return setError('Enter a project name.')
    if (!form.clientId) return setError('Select a client.')
    if (!form.siteLocation.trim()) return setError('Enter the site location.')
    if (!design && !execution) return setError('Select at least one service — Design or Execution.')
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

    setError(null)
    const project = api.projects.create({
      ...form,
      services: { design, execution },
      designPhases,
      executionPhases,
    })
    navigate(`/projects/${project.id}`)
  }

  return (
    <form onSubmit={submit} className="max-w-3xl">
      <PageHeader
        title="New Project"
        subtitle="A project carries Design, Execution, or both — only the services actually required."
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
          <Field label="Client" required>
            <select
              value={form.clientId}
              onChange={(e) => setForm({ ...form, clientId: e.target.value })}
              className="input"
            >
              {db.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Site Location" required>
            <input
              type="text" value={form.siteLocation} placeholder="e.g. Kovalam, Thiruvananthapuram"
              onChange={(e) => setForm({ ...form, siteLocation: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Project Manager">
            <select
              value={form.projectManagerId}
              onChange={(e) => setForm({ ...form, projectManagerId: e.target.value })}
              className="input"
            >
              {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
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

      {/* Step 2 — Project Services */}
      <Section
        title="Project Services"
        description="At least one must be selected."
        className="mb-6"
      >
        <div className="grid gap-3 px-5 py-5 sm:grid-cols-2">
          {[
            { on: design, set: setDesign, label: 'Design', hint: 'Concept, 3D, civil work, BOQ' },
            { on: execution, set: setExecution, label: 'Execution', hint: 'Hardscape, softscape, MEP, maintenance' },
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
              Free Maintenance and AMC are added automatically once execution completes.
            </p>
          </div>
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
