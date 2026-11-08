import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { Icon } from '../../components/Icon'
import { Badge, Checkbox, ProgressBar, Section, StatusBadge } from '../../components/ui'
import { CHECKLISTS, checklistProgress, commercialDocs } from '../../domain/commercial'
import { formatDate } from '../../domain/format'
import { KIND_TITLE, formatRupees, kindRule, quoteValue, shows } from '../../domain/quotation'
import { plantsProjectUrl } from '../../data/plants'
import type { CommercialDoc, Project } from '../../domain/types'
import { quotePath, useCreateQuote, useQuoteAccess, viewPath } from './access'
import { NewQuoteModal } from './NewQuoteModal'

/**
 * A project's BOQ and quotation: the documents themselves, and the checklist
 * each goes through before the client signs off. Which documents a project
 * carries follows its services.
 */
export function CommercialTab({ project, canTick }: { project: Project; canTick: (doc: CommercialDoc) => boolean }) {
  const db = useDb()
  const { user } = useSession()
  const access = useQuoteAccess()
  const createQuote = useCreateQuote()
  const [choosing, setChoosing] = useState<CommercialDoc | null>(null)
  const docs = commercialDocs(project.services)
  const link = project.plantsProject

  const start = (doc: CommercialDoc) => {
    const hasBoq = db.quotations.some((q) => q.projectId === project.id && q.kind === 'BOQ')
    // A quotation can start from the BOQ; otherwise there is nothing to choose.
    if (doc === 'Quotation' && hasBoq) setChoosing(doc)
    else createQuote(doc, project)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white px-5 py-3.5 shadow-card">
        <p className="flex items-center gap-2.5 text-sm text-stone-600">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Icon name="leaf" className="h-4 w-4" /></span>
          {link
            ? <span>Plants come from <strong className="text-stone-900">{link.name}</strong> in the plants app.</span>
            : <span>Not linked to the plants app yet — the matching project is found by name when a BOQ or quotation is opened.</span>}
        </p>
        {link && (
          <a href={plantsProjectUrl(db.settings.documents.plantsAppUrl, link.id)} target="_blank" rel="noreferrer" className="btn-ghost py-1.5 text-xs">
            <Icon name="link" className="h-3.5 w-3.5" /> Open in plants app
          </a>
        )}
      </div>

      <div className={`grid gap-6 ${docs.length === 2 ? 'xl:grid-cols-2' : 'max-w-3xl'}`}>
        {docs.map((doc) => {
          const { done, total } = checklistProgress(project, doc)
          const records = db.quotations.filter((q) => q.projectId === project.id && q.kind === doc)
          return (
            <div key={doc} className="space-y-6">
              <Section
                title={KIND_TITLE[doc]}
                description={kindRule(doc, project.services)}
                actions={access.canCreate(doc) && (
                  <button onClick={() => start(doc)} className="btn-primary py-1.5"><Icon name="plus" className="h-4 w-4" /> New {doc === 'BOQ' ? 'BOQ' : 'quotation'}</button>
                )}
              >
                {records.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-stone-400">No {doc === 'BOQ' ? 'BOQ' : 'quotation'} yet.</p>
                ) : (
                  <ul className="divide-y divide-stone-100">
                    {records.map((q) => {
                      const value = quoteValue(q)
                      const items = q.areas.reduce((s, a) => s + a.items.length, 0)
                      return (
                        <li key={q.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                          <div className="min-w-0">
                            <Link to={viewPath(q)} className="font-semibold text-stone-900 hover:text-brand-700">{q.number}</Link>
                            <p className="text-xs text-stone-500">
                              {[
                                formatDate(q.date),
                                shows(q, 'plants') && `${q.plants?.lines.length ?? 0} plants`,
                                shows(q, 'hardscape') && `${q.areas.length} area${q.areas.length === 1 ? '' : 's'}, ${items} item${items === 1 ? '' : 's'}`,
                              ].filter(Boolean).join(' · ')}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {value !== undefined && <span className="text-sm font-semibold tabular-nums text-stone-800">{formatRupees(value)}</span>}
                            <StatusBadge status={q.status} />
                            {access.canEdit(q.kind) && (
                              <Link to={quotePath(q)} className="btn-icon" title="Edit" aria-label={`Edit ${q.number}`}><Icon name="edit" className="h-4 w-4" /></Link>
                            )}
                            <Link to={viewPath(q)} className="btn-secondary py-1 text-xs">Open</Link>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Section>

              <Section
                title={`${doc} Checklist`}
                description={doc === 'BOQ' ? 'Marking the BOQ Sent or Accepted ticks the last two steps.' : 'Marking the quotation Sent or Accepted ticks the last two steps.'}
                actions={<Badge tone={done === total ? 'green' : done ? 'amber' : 'stone'}>{done} / {total}</Badge>}
              >
                <div className="px-5 pt-4"><ProgressBar value={(done / total) * 100} tone={done === total ? 'green' : 'amber'} /></div>
                <ul className="divide-y divide-stone-100 px-2 py-2">
                  {CHECKLISTS[doc].map((item) => {
                    const tick = project.checklist?.[item.id]
                    return (
                      <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                        <Checkbox
                          checked={Boolean(tick?.done)}
                          disabled={!canTick(doc)}
                          onChange={(v) => api.projects.setChecklist(project.id, item.id, v, user.id)}
                          label={<span className={tick?.done ? 'text-stone-400 line-through' : ''}>{item.label}</span>}
                        />
                        {tick?.done && tick.on && (
                          <span className="text-xs text-stone-400">
                            {db.employees.find((e) => e.id === tick.by)?.name ?? '—'} · {formatDate(tick.on)}
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </Section>
            </div>
          )
        })}
      </div>

      {choosing && <NewQuoteModal projectId={project.id} kind={choosing} onClose={() => setChoosing(null)} />}
    </div>
  )
}
