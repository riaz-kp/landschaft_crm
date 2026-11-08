import { useState } from 'react'
import { useDb } from '../../state/useDb'
import { Field, FormError, Modal } from '../../components/ui'
import { SearchSelect } from '../../components/SearchSelect'
import { projectOptions } from '../../components/pickerOptions'
import { commercialDocs } from '../../domain/commercial'
import { projectType } from '../../domain/progress'
import { KIND_TITLE, kindRule } from '../../domain/quotation'
import { formatDate } from '../../domain/format'
import type { CommercialDoc, Project } from '../../domain/types'
import { useCreateQuote, useQuoteAccess } from './access'

/**
 * Starts a BOQ or quotation: the project, which document (only those its
 * services carry), and for a quotation whether to start from the project's BOQ.
 */
export function NewQuoteModal({ projectId, kind: wanted, onClose }: { projectId?: string; kind?: CommercialDoc; onClose: () => void }) {
  const db = useDb()
  const access = useQuoteAccess()
  const createQuote = useCreateQuote()
  const allowedFor = (p?: Project) => (p ? commercialDocs(p.services).filter((k) => access.canCreate(k)) : [])
  const choosable = db.projects.filter((p) => allowedFor(p).length > 0)
  const [chosen, setChosen] = useState(projectId ?? choosable.find((p) => p.status !== 'Completed')?.id ?? '')
  const project = db.projects.find((p) => p.id === chosen)
  const allowed = allowedFor(project)
  const [kind, setKind] = useState<CommercialDoc | undefined>(wanted)
  const doc = kind && allowed.includes(kind) ? kind : allowed[0]
  const boqs = project ? db.quotations.filter((q) => q.projectId === project.id && q.kind === 'BOQ') : []
  const [fromId, setFromId] = useState<string>('')
  const from = doc === 'Quotation' ? boqs.find((b) => b.id === fromId) : undefined
  const [error, setError] = useState<string | null>(null)

  const create = () => {
    if (!project || !doc) return setError('Pick the project.')
    createQuote(doc, project, from)
    onClose()
  }

  return (
    <Modal
      title={doc ? `New ${KIND_TITLE[doc]}` : 'New BOQ / Quotation'}
      onClose={onClose}
      size="lg"
      footer={<>
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={create} className="btn-primary" disabled={!doc}>Create {doc === 'BOQ' ? 'BOQ' : 'quotation'}</button>
      </>}
    >
      <div className="space-y-5">
        <Field label="Project" required>
          <SearchSelect
            value={chosen}
            onChange={(id) => {
              setChosen(id)
              setFromId('')
              setError(null)
            }}
            options={projectOptions(db, choosable, projectType)}
            searchPlaceholder="Search projects"
            title="Project"
          />
        </Field>

        {project && (
          <div>
            <p className="label">Document</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {(['BOQ', 'Quotation'] as const).map((k) => {
                const ok = allowed.includes(k)
                const carried = commercialDocs(project.services).includes(k)
                return (
                  <button
                    key={k} type="button" disabled={!ok} onClick={() => setKind(k)}
                    className={`rounded-xl border-2 p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      doc === k ? 'border-brand-500 bg-brand-50' : 'border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <span className="block font-semibold text-stone-900">{KIND_TITLE[k]}</span>
                    <span className="mt-0.5 block text-xs text-stone-500">
                      {carried ? kindRule(k, project.services) : `Not carried by ${projectType(project)} projects.`}
                      {carried && !ok && ' You cannot create this one.'}
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-xs text-stone-500">
              {projectType(project)} · {db.clients.find((c) => c.id === project.clientId)?.name}
              {project.plantsProject ? ` · plants from “${project.plantsProject.name}”` : ' · not linked to the plants app yet'}
            </p>
          </div>
        )}

        {doc === 'Quotation' && boqs.length > 0 && (
          <div>
            <p className="label">Start from</p>
            <div className="mt-2 space-y-2">
              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-stone-200 p-3">
                <input type="radio" name="from" checked={!from} onChange={() => setFromId('')} className="mt-0.5 accent-brand-600" />
                <span className="text-sm">
                  <span className="block font-medium text-stone-900">A blank quotation</span>
                  <span className="block text-xs text-stone-500">Company terms and management lines; plants fetched from the plants app.</span>
                </span>
              </label>
              {boqs.map((boq) => (
                <label key={boq.id} className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-stone-200 p-3">
                  <input type="radio" name="from" checked={from?.id === boq.id} onChange={() => setFromId(boq.id)} className="mt-0.5 accent-brand-600" />
                  <span className="text-sm">
                    <span className="block font-medium text-stone-900">The BOQ {boq.number} <span className="font-normal text-stone-500">· {formatDate(boq.date)} · {boq.status}</span></span>
                    <span className="block text-xs text-stone-500">
                      Its plants, {boq.areas.length} area{boq.areas.length === 1 ? '' : 's'} and {boq.areas.reduce((s, a) => s + a.items.length, 0)} items with their plans — add the rates.
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {choosable.length === 0 && <FormError message="There is no project you can create a BOQ or quotation for." />}
        <FormError message={error} />
      </div>
    </Modal>
  )
}
