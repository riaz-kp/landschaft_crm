import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { Icon } from '../../components/Icon'
import { Badge, ConfirmDialog, EmptyState, Field, PageHeader, StatusBadge } from '../../components/ui'
import { commercialDocs } from '../../domain/commercial'
import { projectType } from '../../domain/progress'
import {
  COMMON_ITEMS, COMMON_UNITS, KIND_TITLE, QUOTE_STATUSES, SECTION_LABELS, blankService, formatRupees, isPriced, kindRule,
  quoteTotals, quoteWarnings, sectionApplies, shows, showsPlans,
} from '../../domain/quotation'
import { QUOTE_SECTIONS, type Quotation, type QuotationStatus, type QuoteArea, type QuoteSection } from '../../domain/types'
import { printPath, useCreateQuote, useQuoteAccess } from './access'
import { AreasEditor } from './AreasEditor'
import { PlantsSection } from './PlantsSection'
import { NumberInput, PaymentStagesEditor, SectionCard, ServicesEditor, Switch, TitledListEditor } from './editors'

/** Opens the document named in the URL; keyed by id so moving to another document starts afresh. */
export function QuoteEditorPage() {
  const { quoteId = '' } = useParams()
  const db = useDb()
  const quote = db.quotations.find((q) => q.id === quoteId)
  const project = quote && db.projects.find((p) => p.id === quote.projectId)
  if (!quote || !project) {
    return <EmptyState title="Document not found." hint="It may have been deleted." icon="doc" />
  }
  return <QuoteEditor key={quote.id} initial={quote} />
}

/**
 * A BOQ or quotation, section by section, as it will print. Every change is
 * saved as it is made, like the rest of the app; a document the client has
 * accepted is locked until its status is changed back.
 */
function QuoteEditor({ initial }: { initial: Quotation }) {
  const db = useDb()
  const { user } = useSession()
  const navigate = useNavigate()
  const access = useQuoteAccess()
  const createQuote = useCreateQuote()
  const [draft, setDraft] = useState(initial)
  const latest = useRef(initial)
  const [deleting, setDeleting] = useState(false)

  const project = db.projects.find((p) => p.id === draft.projectId)!
  const client = db.clients.find((c) => c.id === draft.clientId)
  const priced = isPriced(draft.kind)
  const plans = showsPlans(draft.kind, project.services)
  const locked = draft.status === 'Accepted'
  const readOnly = !access.canEdit(draft.kind) || locked
  const totals = quoteTotals(draft)
  const warnings = quoteWarnings(draft, project)
  const boqs = db.quotations.filter((q) => q.projectId === project.id && q.kind === 'BOQ')
  const canQuoteFromBoq = draft.kind === 'BOQ' && commercialDocs(project.services).includes('Quotation') && access.canCreate('Quotation')

  /** Applies a change here and saves it. Only the fields named are written, so a slow plant fetch never undoes a later edit. */
  const patch = (changes: Partial<Quotation> | ((current: Quotation) => Partial<Quotation>)) => {
    const values = typeof changes === 'function' ? changes(latest.current) : changes
    const next = { ...latest.current, ...values }
    latest.current = next
    setDraft(next)
    api.quotations.update(next.id, values, user.id)
  }
  const setSection = (section: QuoteSection, on: boolean) => patch((q) => ({ sections: { ...q.sections, [section]: on } }))
  const setAreas = (update: (areas: QuoteArea[]) => QuoteArea[]) => patch((q) => ({ areas: update(q.areas) }))
  const defaults = db.settings.documents

  const itemSuggestions = useMemo(() => {
    const used = db.quotations.flatMap((q) => q.areas.flatMap((a) => a.items.map((i) => i.item.trim()))).filter(Boolean)
    return [...new Set([...used, ...COMMON_ITEMS])].sort((a, b) => a.localeCompare(b))
  }, [db.quotations])

  const sectionIds: Record<QuoteSection, string> = {
    plants: 'q-plants', hardscape: 'q-hardscape', services: 'q-services', terms: 'q-terms', procedure: 'q-procedure',
    payment: 'q-payment', schedule: 'q-schedule', bank: 'q-bank', acceptance: 'q-bank',
  }

  return (
    <div className="pb-16">
      <datalist id="quote-items">{itemSuggestions.map((i) => <option key={i} value={i} />)}</datalist>
      <datalist id="quote-units">{COMMON_UNITS.map((u) => <option key={u} value={u} />)}</datalist>

      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {draft.number}
            <Badge tone={draft.kind === 'BOQ' ? 'blue' : 'green'}>{KIND_TITLE[draft.kind]}</Badge>
          </span>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link to={`/projects/${project.id}?tab=commercial`} className="font-medium text-stone-700 hover:text-brand-700">{project.name}</Link>
            <span className="text-stone-300">·</span>
            <span>{client?.name ?? '—'}</span>
            <span className="text-stone-300">·</span>
            <span>{projectType(project)}</span>
          </span>
        }
        actions={
          <>
            <select
              className="input w-36 py-2" value={draft.status} aria-label="Status"
              disabled={!access.canEdit(draft.kind)}
              onChange={(e) => patch({ status: e.target.value as QuotationStatus })}
            >
              {QUOTE_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
            <Link to={printPath(draft)} className="btn-primary"><Icon name="eye" className="h-4 w-4" /> Preview &amp; print</Link>
          </>
        }
      />

      <p className="-mt-3 mb-5 max-w-3xl text-sm text-stone-500">{kindRule(draft.kind, project.services)}</p>

      {locked && (
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
          <Icon name="shield" className="h-4 w-4" />
          Accepted by the client, so it is locked. Set the status back to Draft or Sent to change it, or duplicate it for a revision.
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <SectionCard id="q-cover" title="Cover page" description="The date, the covering letter and the line under the Bill of Quantities heading.">
            <div className="space-y-4 px-5 py-5">
              <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
                <Field label="Date">
                  <input type="date" className="input" value={draft.date} disabled={readOnly} onChange={(e) => patch({ date: e.target.value })} />
                </Field>
                <Field label="Greeting">
                  <input className="input" value={draft.letter.greeting} disabled={readOnly} onChange={(e) => patch((q) => ({ letter: { ...q.letter, greeting: e.target.value } }))} />
                </Field>
              </div>
              <Field label="Letter" hint="A blank line starts a new paragraph.">
                <textarea
                  className="input min-h-[150px] resize-y" rows={7} value={draft.letter.body} disabled={readOnly}
                  onChange={(e) => patch((q) => ({ letter: { ...q.letter, body: e.target.value } }))}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Signed">
                  <input className="input" value={draft.letter.signOff} disabled={readOnly} onChange={(e) => patch((q) => ({ letter: { ...q.letter, signOff: e.target.value } }))} />
                </Field>
              </div>
              <Field label="Under the Bill of Quantities heading">
                <textarea className="input min-h-[64px] resize-y" rows={2} value={draft.intro} disabled={readOnly} onChange={(e) => patch({ intro: e.target.value })} />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            id="q-plants" title="Plants"
            description="From the matching project in the plants app, grouped by category. Plants are chosen, sized and priced there."
            included={draft.sections.plants} onInclude={(v) => setSection('plants', v)} readOnly={readOnly}
          >
            <PlantsSection quote={draft} project={project} priced={priced} disabled={readOnly} onChange={(plants) => patch({ plants })} />
          </SectionCard>

          <SectionCard
            id="q-hardscape" title="Hardscape"
            description={plans
              ? 'Each area with its heading, its plan image and the stones and items laid there.'
              : 'Each area with its heading and the stones and items laid there. Execution-only quotations carry no plan images.'}
            included={draft.sections.hardscape} onInclude={(v) => setSection('hardscape', v)} readOnly={readOnly}
            actions={priced && draft.areas.length > 0 && <span className="text-sm font-semibold tabular-nums text-stone-700">{formatRupees(totals.hardscape)}</span>}
          >
            <div className="p-5">
              <AreasEditor areas={draft.areas} onChange={setAreas} priced={priced} plans={plans} disabled={readOnly} history={db.quotations} />
            </div>
          </SectionCard>

          <SectionCard
            id="q-services"
            title={
              readOnly ? draft.servicesTitle || 'Project management' : (
                <input
                  className="-ml-2 w-full min-w-[260px] rounded-lg border border-transparent bg-transparent px-2 py-1 font-semibold text-stone-900 hover:border-stone-200 focus:border-brand-500 focus:outline-none"
                  value={draft.servicesTitle} aria-label="Section heading" onChange={(e) => patch({ servicesTitle: e.target.value })}
                />
              )
            }
            description="Planting labour, supervision, soil preparation, transport — each with what it covers."
            included={draft.sections.services} onInclude={(v) => setSection('services', v)} readOnly={readOnly}
          >
            <div className="p-5">
              <ServicesEditor lines={draft.services} onChange={(services) => patch({ services })} disabled={readOnly} priced={priced} blank={blankService} />
            </div>
          </SectionCard>

          {priced && (
            <SectionCard
              id="q-payment" title="Payment schedule" description="Stages of payment as shares of the grand total."
              included={draft.sections.payment} onInclude={(v) => setSection('payment', v)} readOnly={readOnly}
            >
              <div className="p-5">
                <PaymentStagesEditor
                  stages={draft.paymentStages} total={totals.total} disabled={readOnly}
                  onChange={(paymentStages) => patch({ paymentStages })}
                  onReset={() => patch({ paymentStages: defaults.paymentStages.map((s) => ({ ...s })) })}
                />
              </div>
            </SectionCard>
          )}

          <SectionCard
            id="q-terms" title="Terms / project-specific notes"
            included={draft.sections.terms} onInclude={(v) => setSection('terms', v)} readOnly={readOnly}
            actions={!readOnly && <button type="button" className="btn-ghost py-1 text-xs" onClick={() => patch({ terms: defaults.terms.map((t) => ({ ...t })) })}>Use company terms</button>}
          >
            <div className="p-5">
              <TitledListEditor
                items={draft.terms} onChange={(terms) => patch({ terms })} disabled={readOnly} noun="Term"
                addLabel="Add a term" titlePlaceholder="e.g. Site Readiness" textPlaceholder="What it says"
              />
            </div>
          </SectionCard>

          <SectionCard
            id="q-procedure" title="Scope and work procedure"
            included={draft.sections.procedure} onInclude={(v) => setSection('procedure', v)} readOnly={readOnly}
            actions={!readOnly && <button type="button" className="btn-ghost py-1 text-xs" onClick={() => patch({ procedure: defaults.procedure.map((t) => ({ ...t })), procedureNote: defaults.procedureNote })}>Use company steps</button>}
          >
            <div className="space-y-4 p-5">
              <TitledListEditor
                items={draft.procedure} onChange={(procedure) => patch({ procedure })} disabled={readOnly} noun="Step"
                addLabel="Add a step" titlePlaceholder="e.g. Site Preparation" textPlaceholder="What happens in this step"
              />
              <Field label="Note under the steps">
                <textarea className="input min-h-[56px] resize-y" rows={2} value={draft.procedureNote} disabled={readOnly} onChange={(e) => patch({ procedureNote: e.target.value })} />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            id="q-schedule" title="Work schedule / details"
            included={draft.sections.schedule} onInclude={(v) => setSection('schedule', v)} readOnly={readOnly}
          >
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Mobilisation" hint="Days from the advance / work order and site clearance. Left blank, the line prints for filling in by hand.">
                <NumberInput value={draft.schedule.mobilisationDays} disabled={readOnly} label="Mobilisation days" placeholder="Days"
                  onChange={(v) => patch((q) => ({ schedule: { ...q.schedule, mobilisationDays: v || undefined } }))} />
              </Field>
              <Field label="Execution period" hint="Approximate working days on site.">
                <NumberInput value={draft.schedule.executionDays} disabled={readOnly} label="Execution days" placeholder="Working days"
                  onChange={(v) => patch((q) => ({ schedule: { ...q.schedule, executionDays: v || undefined } }))} />
              </Field>
              <Field label="Quotation validity">
                <input className="input" value={draft.schedule.validity} disabled={readOnly} onChange={(e) => patch((q) => ({ schedule: { ...q.schedule, validity: e.target.value } }))} />
              </Field>
              <Field label="Maintenance period">
                <input className="input" value={draft.schedule.maintenance} disabled={readOnly} onChange={(e) => patch((q) => ({ schedule: { ...q.schedule, maintenance: e.target.value } }))} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Billing basis">
                  <input className="input" value={draft.schedule.billing} disabled={readOnly} onChange={(e) => patch((q) => ({ schedule: { ...q.schedule, billing: e.target.value } }))} />
                </Field>
              </div>
            </div>
          </SectionCard>

          <SectionCard id="q-bank" title={priced ? 'Bank details & client acceptance' : 'Client acceptance'} description="Taken from Settings → BOQ & Quotation Documents.">
            <div className="space-y-4 p-5">
              {priced && (
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <dl className="grid flex-1 gap-3 rounded-xl bg-[#33463a] px-4 py-3 text-white sm:grid-cols-4">
                    {[
                      ['Account name', defaults.bank.accountName], ['Bank', defaults.bank.bankName],
                      ['Account number', defaults.bank.accountNumber], ['IFSC', defaults.bank.ifsc],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#d9cdbb]">{label}</dt>
                        <dd className="mt-0.5 text-sm font-semibold">{value || '—'}</dd>
                      </div>
                    ))}
                  </dl>
                  <Switch checked={draft.sections.bank} onChange={(v) => setSection('bank', v)} label="Include bank details" disabled={readOnly} />
                </div>
              )}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="flex-1 rounded-xl border border-stone-200 px-4 py-3 text-sm text-stone-600">{defaults.acceptance[draft.kind]}</p>
                <Switch checked={draft.sections.acceptance} onChange={(v) => setSection('acceptance', v)} label="Include client acceptance" disabled={readOnly} />
              </div>
            </div>
          </SectionCard>

          <Link to={`/projects/${project.id}?tab=commercial`} className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800">
            <Icon name="back" className="h-4 w-4" /> Back to {project.name}
          </Link>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-20 xl:self-start">
          <section className="card overflow-hidden">
            <header className="border-b border-stone-100 px-5 py-3.5">
              <h2 className="font-semibold text-stone-900">{priced ? 'Quotation summary' : 'In this BOQ'}</h2>
            </header>
            {priced ? (
              <div className="text-sm">
                <dl className="divide-y divide-stone-100">
                  {shows(draft, 'plants') && <SummaryRow label="Plants" value={formatRupees(totals.plants)} />}
                  {shows(draft, 'hardscape') && <SummaryRow label="Hardscape" value={formatRupees(totals.hardscape)} />}
                  {shows(draft, 'services') && <SummaryRow label="Project management" value={formatRupees(totals.services)} />}
                  <div className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <dt className="text-stone-500">Discount (₹)</dt>
                    <dd className="w-32">
                      <NumberInput value={draft.discount} onChange={(discount) => patch({ discount })} disabled={readOnly} label="Discount" className="py-1.5" />
                    </dd>
                  </div>
                </dl>
                <div className="flex items-center justify-between bg-[#33463a] px-5 py-4 text-white">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d9cdbb]">Grand total</span>
                  <span className="font-display text-xl font-bold tabular-nums">{formatRupees(totals.total)}</span>
                </div>
              </div>
            ) : (
              <dl className="divide-y divide-stone-100 text-sm">
                <SummaryRow label="Plants" value={shows(draft, 'plants') ? `${draft.plants?.lines.length ?? 0} lines` : 'Left out'} />
                <SummaryRow label="Areas" value={shows(draft, 'hardscape') ? `${draft.areas.length}` : 'Left out'} />
                <SummaryRow label="Stones & items" value={`${draft.areas.reduce((s, a) => s + a.items.length, 0)}`} />
                <SummaryRow label="Plan images" value={`${draft.areas.filter((a) => a.planImage).length} of ${draft.areas.length}`} />
              </dl>
            )}
          </section>

          <section className="card overflow-hidden">
            <header className="border-b border-stone-100 px-5 py-3.5">
              <h2 className="font-semibold text-stone-900">Contents</h2>
              <p className="mt-0.5 text-xs text-stone-500">What the printed {draft.kind === 'BOQ' ? 'BOQ' : 'quotation'} carries.</p>
            </header>
            <ul className="divide-y divide-stone-100">
              {QUOTE_SECTIONS.filter((s) => sectionApplies(draft.kind, s)).map((section) => (
                <li key={section} className="flex items-center justify-between gap-3 px-5 py-2">
                  <a href={`#${sectionIds[section]}`} className="text-sm text-stone-700 hover:text-brand-700">{SECTION_LABELS[section]}</a>
                  <Switch compact checked={draft.sections[section]} onChange={(v) => setSection(section, v)} label={`Include ${SECTION_LABELS[section]}`} disabled={readOnly} />
                </li>
              ))}
            </ul>
          </section>

          <section className="card overflow-hidden">
            <header className="border-b border-stone-100 px-5 py-3.5">
              <h2 className="font-semibold text-stone-900">Before it goes out</h2>
            </header>
            {warnings.length === 0 ? (
              <p className="flex items-center gap-2 px-5 py-4 text-sm font-medium text-brand-700"><Icon name="check" className="h-4 w-4" /> Nothing missing.</p>
            ) : (
              <ul className="space-y-2 px-5 py-4">
                {warnings.map((w) => (
                  <li key={w} className="flex items-start gap-2 text-sm text-amber-800">
                    <Icon name="alert" className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {w}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card space-y-2 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-stone-500">Status</span>
              <StatusBadge status={draft.status} />
            </div>
            {access.canCreate(draft.kind) && (
              <button type="button" className="btn-secondary w-full" onClick={() => createQuote(draft.kind, project, draft)}>
                <Icon name="clip" className="h-4 w-4" /> Duplicate as a new draft
              </button>
            )}
            {canQuoteFromBoq && (
              <button type="button" className="btn-secondary w-full" onClick={() => createQuote('Quotation', project, draft)}>
                <Icon name="rupee" className="h-4 w-4" /> Make a quotation from this BOQ
              </button>
            )}
            {draft.kind === 'Quotation' && boqs.length > 0 && (
              <p className="text-xs text-stone-500">BOQ on this project: {boqs.map((b) => b.number).join(', ')}</p>
            )}
            {access.canDelete(draft.kind) && (
              <button type="button" className="btn-ghost w-full text-red-600 hover:bg-red-50" onClick={() => setDeleting(true)}>
                <Icon name="trash" className="h-4 w-4" /> Delete {draft.kind === 'BOQ' ? 'BOQ' : 'quotation'}
              </button>
            )}
          </section>
        </aside>
      </div>

      {deleting && (
        <ConfirmDialog
          title={`Delete ${draft.number}?`}
          message={<>This {KIND_TITLE[draft.kind].toLowerCase()} for {project.name}{priced ? ` (${formatRupees(totals.total)})` : ''} will be removed.</>}
          onClose={() => setDeleting(false)}
          onConfirm={() => {
            api.quotations.remove(draft.id)
            navigate(`/projects/${project.id}?tab=commercial`)
          }}
        />
      )}
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-2.5">
      <dt className="text-stone-500">{label}</dt>
      <dd className="font-semibold tabular-nums text-stone-900">{value}</dd>
    </div>
  )
}
