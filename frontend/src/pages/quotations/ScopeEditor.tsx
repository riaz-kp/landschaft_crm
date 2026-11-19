import { DocNumberField } from './DocNumber'
import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { Icon } from '../../components/Icon'
import { Badge, ConfirmDialog, Field, PageHeader, StatusBadge } from '../../components/ui'
import { projectType } from '../../domain/progress'
import { DEFAULT_GST_RATE, KIND_TITLE, QUOTE_STATUSES, gstLabel, kindRule } from '../../domain/quotation'
import { SCOPE_SECTIONS, SCOPE_SECTION_LABELS, formatFee, groupLetter, proposalFrom, scopeTotals, scopeWarnings } from '../../domain/scope'
import type { FeeLine, Quotation, QuotationStatus, QuoteSection, ScopeGroup, ScopeProposal, VisitRate } from '../../domain/types'
import { useCreateQuote, useQuoteAccess, viewPath } from './access'
import { NumberInput, PaymentStagesEditor, RowButtons, SectionCard, Switch, move } from './editors'

/**
 * A Scope of Services & Fee Proposal, part by part as it will print. Every
 * change is saved as it is made; a proposal the client has accepted is locked
 * until its status is changed back.
 */
export function ScopeEditor({ initial }: { initial: Quotation }) {
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
  const locked = draft.status === 'Accepted'
  const readOnly = !access.canEdit(draft.kind) || locked
  const defaults = db.settings.documents
  const scope = draft.scope ?? proposalFrom(defaults.scope)
  const totals = scopeTotals(draft)
  const warnings = scopeWarnings(draft)

  const patch = (changes: Partial<Quotation> | ((current: Quotation) => Partial<Quotation>)) => {
    const values = typeof changes === 'function' ? changes(latest.current) : changes
    const next = { ...latest.current, ...values }
    latest.current = next
    setDraft(next)
    api.quotations.update(next.id, values, user.id)
  }
  const patchScope = (changes: Partial<ScopeProposal> | ((current: ScopeProposal) => Partial<ScopeProposal>)) =>
    patch((q) => {
      const current = q.scope ?? proposalFrom(defaults.scope)
      return { scope: { ...current, ...(typeof changes === 'function' ? changes(current) : changes) } }
    })
  const setSection = (section: QuoteSection, on: boolean) => patch((q) => ({ sections: { ...q.sections, [section]: on } }))
  const fromCompany = proposalFrom(defaults.scope)

  const reset = (label: string, apply: () => void) => !readOnly && (
    <button type="button" className="btn-ghost py-1 text-xs" onClick={apply}>{label}</button>
  )

  const sectionIds: Partial<Record<QuoteSection, string>> = {
    schedule: 's-phases', payment: 's-fee', terms: 's-terms', bank: 's-bank', acceptance: 's-bank',
  }

  return (
    <div className="pb-16">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {draft.number}
            <Badge tone="amber">{KIND_TITLE.Scope}</Badge>
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
            <Link to={viewPath(draft)} className="btn-primary"><Icon name="eye" className="h-4 w-4" /> View document</Link>
          </>
        }
      />

      <p className="-mt-3 mb-5 max-w-3xl text-sm text-stone-500">{kindRule('Scope', project.services)}</p>

      {locked && (
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
          <Icon name="shield" className="h-4 w-4" />
          Accepted by the client, so it is locked. Set the status back to Draft or Sent to change it, or duplicate it for a revision.
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <SectionCard id="s-cover" title="Cover page" description="The subject, date and covering letter. The client, project and location come from the project.">
            <div className="space-y-4 px-5 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <DocNumberField quote={draft} disabled={!access.canEdit(draft.kind)} onSave={(number) => patch({ number })} />
                <Field label="Date">
                  <input type="date" className="input" value={draft.date} disabled={readOnly} onChange={(e) => patch({ date: e.target.value })} />
                </Field>
              </div>
              <div className="grid gap-4">
                <Field label="Subject" hint={`Printed over “${KIND_TITLE.Scope}”.`}>
                  <input className="input" value={scope.subject} disabled={readOnly} placeholder="Landscape Consultancy" onChange={(e) => patchScope({ subject: e.target.value })} />
                </Field>
              </div>
              <Field label="Greeting">
                <input className="input sm:max-w-xs" value={draft.letter.greeting} disabled={readOnly} onChange={(e) => patch((q) => ({ letter: { ...q.letter, greeting: e.target.value } }))} />
              </Field>
              <Field label="Letter" hint="A blank line starts a new paragraph.">
                <textarea
                  className="input min-h-[150px] resize-y" rows={7} value={draft.letter.body} disabled={readOnly}
                  onChange={(e) => patch((q) => ({ letter: { ...q.letter, body: e.target.value } }))}
                />
              </Field>
              <Field label="Signed">
                <input className="input sm:max-w-xs" value={draft.letter.signOff} disabled={readOnly} onChange={(e) => patch((q) => ({ letter: { ...q.letter, signOff: e.target.value } }))} />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            id="s-services" title="Scope of services" description="Each part is lettered A, B, C… in order, with its points under it."
            actions={reset('Use company scope', () => patchScope({ services: structuredClone(fromCompany.services) }))}
          >
            <div className="p-5">
              <GroupsEditor
                groups={scope.services} onChange={(services) => patchScope({ services })} disabled={readOnly}
                badge={groupLetter} noun="part" addLabel="Add a part" titlePlaceholder="e.g. Site Appraisal & Analysis"
              />
            </div>
          </SectionCard>

          <SectionCard
            id="s-phases" title="Work schedule" description="Phase by phase, numbered in order."
            included={draft.sections.schedule} onInclude={(v) => setSection('schedule', v)} readOnly={readOnly}
            actions={reset('Use company phases', () => patchScope({ phases: structuredClone(fromCompany.phases) }))}
          >
            <div className="p-5">
              <GroupsEditor
                groups={scope.phases} onChange={(phases) => patchScope({ phases })} disabled={readOnly}
                badge={(i) => `Phase ${i + 1}`} noun="phase" addLabel="Add a phase" titlePlaceholder="e.g. Engagement & Data Collection"
              />
            </div>
          </SectionCard>

          <SectionCard
            id="s-fee" title="Fee structure & payment terms"
            description="The design and consulting fee, GST on it, and the stages it is paid in."
            actions={<span className="text-sm font-semibold tabular-nums text-stone-700">{formatFee(totals.total)}</span>}
          >
            <div className="space-y-6 p-5">
              <FeesEditor fees={scope.fees} onChange={(fees) => patchScope({ fees })} disabled={readOnly} />
              <div className="flex flex-wrap items-center gap-3 rounded-xl bg-stone-50 px-4 py-3 text-sm">
                <Switch compact checked={draft.gstRate !== undefined} disabled={readOnly} label="Add GST" onChange={(on) => patch({ gstRate: on ? DEFAULT_GST_RATE : undefined })} />
                <span className="text-stone-600">GST</span>
                {draft.gstRate !== undefined ? (
                  <>
                    <span className="flex w-20 items-center gap-1">
                      <NumberInput value={draft.gstRate} onChange={(gstRate) => patch({ gstRate })} disabled={readOnly} label="GST rate in percent" placeholder="18" className="py-1.5" />
                      <span className="text-stone-500">%</span>
                    </span>
                    <span className="tabular-nums text-stone-700">{formatFee(totals.gst)}</span>
                  </>
                ) : <span className="text-stone-400">Not charged</span>}
                <span className="ml-auto font-semibold text-stone-900">Net amount <span className="ml-1 tabular-nums">{formatFee(totals.total)}</span></span>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="label">Payment terms</p>
                  <Switch checked={draft.sections.payment} onChange={(v) => setSection('payment', v)} label="Include payment terms" disabled={readOnly} />
                </div>
                {draft.sections.payment ? (
                  <PaymentStagesEditor
                    stages={draft.paymentStages} total={totals.total} disabled={readOnly}
                    onChange={(paymentStages) => patch({ paymentStages })}
                    onReset={() => patch({ paymentStages: defaults.scope.paymentStages.map((s) => ({ ...s })) })}
                  />
                ) : <p className="text-sm text-stone-400">Left out of this document.</p>}
              </div>
            </div>
          </SectionCard>

          <SectionCard
            id="s-visits" title="Site visit fees" description="What a visit covers, how many are included, and the charge for each extra visit."
            actions={reset('Use company wording', () => patchScope({ visits: structuredClone(fromCompany.visits) }))}
          >
            <div className="space-y-4 p-5">
              <Field label="Site visit charges">
                <textarea className="input min-h-[96px] resize-y" rows={4} value={scope.visits.note} disabled={readOnly}
                  onChange={(e) => patchScope((s) => ({ visits: { ...s.visits, note: e.target.value } }))} />
              </Field>
              <Field label="Included site visits">
                <input className="input" value={scope.visits.included} disabled={readOnly} placeholder="3 Visits by core team."
                  onChange={(e) => patchScope((s) => ({ visits: { ...s.visits, included: e.target.value } }))} />
              </Field>
              <div>
                <p className="label mb-2">Additional site visit charges</p>
                <RatesEditor rates={scope.visits.rates} disabled={readOnly} onChange={(rates) => patchScope((s) => ({ visits: { ...s.visits, rates } }))} />
              </div>
            </div>
          </SectionCard>

          <SectionCard id="s-later" title="Execution & AMC fees" description="How execution works and the annual maintenance contract will be priced. Left blank, a line is not printed.">
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Execution works">
                <textarea className="input min-h-[96px] resize-y" rows={4} value={scope.executionNote} disabled={readOnly} onChange={(e) => patchScope({ executionNote: e.target.value })} />
              </Field>
              <Field label="Annual maintenance (AMC)">
                <textarea className="input min-h-[96px] resize-y" rows={4} value={scope.amcNote} disabled={readOnly} onChange={(e) => patchScope({ amcNote: e.target.value })} />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            id="s-terms" title="Terms & conditions"
            included={draft.sections.terms} onInclude={(v) => setSection('terms', v)} readOnly={readOnly}
            actions={reset('Use company terms', () => patchScope({ terms: [...fromCompany.terms] }))}
          >
            <div className="p-5">
              <TermsEditor terms={scope.terms} onChange={(terms) => patchScope({ terms })} disabled={readOnly} />
            </div>
          </SectionCard>

          <SectionCard id="s-bank" title="Bank details, acceptance & closing" description="Bank details and the acceptance wording are taken from Settings → BOQ & Quotation Documents.">
            <div className="space-y-4 p-5">
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
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="flex-1 rounded-xl border border-stone-200 px-4 py-3 text-sm text-stone-600">{defaults.acceptance.Scope}</p>
                <Switch checked={draft.sections.acceptance} onChange={(v) => setSection('acceptance', v)} label="Include client acceptance" disabled={readOnly} />
              </div>
              <Field label="Closing paragraph">
                <textarea className="input min-h-[64px] resize-y" rows={3} value={scope.closing} disabled={readOnly} onChange={(e) => patchScope({ closing: e.target.value })} />
              </Field>
              <Field label="Signed" hint="One line each, e.g. “Thanks & Regards,” then “Landschaft.”">
                <textarea className="input min-h-[56px] resize-y sm:max-w-sm" rows={2} value={scope.signOff} disabled={readOnly} onChange={(e) => patchScope({ signOff: e.target.value })} />
              </Field>
            </div>
          </SectionCard>

          <Link to={`/projects/${project.id}?tab=commercial`} className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800">
            <Icon name="back" className="h-4 w-4" /> Back to {project.name}
          </Link>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-20 xl:self-start">
          <section className="card overflow-hidden">
            <header className="border-b border-stone-100 px-5 py-3.5">
              <h2 className="font-semibold text-stone-900">Fee summary</h2>
            </header>
            <dl className="divide-y divide-stone-100 text-sm">
              <SummaryRow label="Fee" value={formatFee(totals.fee)} />
              <SummaryRow label={totals.gstRate !== undefined ? gstLabel(totals.gstRate) : 'GST'} value={totals.gstRate !== undefined ? formatFee(totals.gst) : 'Not charged'} />
              <SummaryRow label="Included site visits" value={scope.visits.included.trim() || '—'} />
            </dl>
            <div className="flex items-center justify-between bg-[#33463a] px-5 py-4 text-white">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d9cdbb]">Net amount</span>
              <span className="font-display text-xl font-bold tabular-nums">{formatFee(totals.total)}</span>
            </div>
          </section>

          <section className="card overflow-hidden">
            <header className="border-b border-stone-100 px-5 py-3.5">
              <h2 className="font-semibold text-stone-900">Contents</h2>
              <p className="mt-0.5 text-xs text-stone-500">What the printed proposal carries besides the scope and fee.</p>
            </header>
            <ul className="divide-y divide-stone-100">
              {SCOPE_SECTIONS.map((section) => (
                <li key={section} className="flex items-center justify-between gap-3 px-5 py-2">
                  <a href={`#${sectionIds[section]}`} className="text-sm text-stone-700 hover:text-brand-700">{SCOPE_SECTION_LABELS[section]}</a>
                  <Switch compact checked={draft.sections[section]} onChange={(v) => setSection(section, v)} label={`Include ${SCOPE_SECTION_LABELS[section]}`} disabled={readOnly} />
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
            {access.canDelete(draft.kind) && (
              <button type="button" className="btn-ghost w-full text-red-600 hover:bg-red-50" onClick={() => setDeleting(true)}>
                <Icon name="trash" className="h-4 w-4" /> Delete scope proposal
              </button>
            )}
          </section>
        </aside>
      </div>

      {deleting && (
        <ConfirmDialog
          title={`Delete ${draft.number}?`}
          message={<>This scope proposal for {project.name}{totals.total ? ` (${formatFee(totals.total)})` : ''} will be removed.</>}
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
      <dd className="text-right font-semibold tabular-nums text-stone-900">{value}</dd>
    </div>
  )
}

// ---------------------------------------------------------------- list editors

/** Parts of the scope, or phases of the schedule: a heading, an optional note, and one point per line. */
export function GroupsEditor({ groups, onChange, disabled, badge, noun, addLabel, titlePlaceholder }: {
  groups: ScopeGroup[]; onChange: (groups: ScopeGroup[]) => void; disabled?: boolean
  badge: (index: number) => string; noun: string; addLabel: string; titlePlaceholder: string
}) {
  const set = (i: number, patch: Partial<ScopeGroup>) => onChange(groups.map((g, j) => (j === i ? { ...g, ...patch } : g)))
  return (
    <div>
      {groups.length === 0 && <p className="px-1 pb-2 text-sm text-stone-400">None yet.</p>}
      <ol className="space-y-3">
        {groups.map((group, i) => (
          <li key={i} className="rounded-xl border border-stone-200 bg-white p-3">
            <div className="flex gap-3">
              <span className="mt-1.5 flex h-6 min-w-[24px] shrink-0 items-center justify-center rounded-md bg-[#33463a] px-1.5 text-[11px] font-bold text-white">{badge(i)}</span>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
                  <input
                    className="input font-semibold" value={group.title} placeholder={titlePlaceholder} disabled={disabled}
                    onChange={(e) => set(i, { title: e.target.value })} aria-label={`${noun} ${i + 1} heading`}
                  />
                  <input
                    className="input text-[13px] italic" value={group.note ?? ''} placeholder="Note after the heading (optional)" disabled={disabled}
                    onChange={(e) => set(i, { note: e.target.value || undefined })} aria-label={`${noun} ${i + 1} note`}
                  />
                </div>
                <textarea
                  className="input min-h-[96px] resize-y text-[13px] leading-relaxed" rows={Math.max(3, group.points.length + 1)}
                  value={group.points.join('\n')} placeholder="One point per line" disabled={disabled}
                  onChange={(e) => set(i, { points: e.target.value.split('\n') })} aria-label={`${noun} ${i + 1} points`}
                />
              </div>
              <RowButtons
                index={i} count={groups.length} disabled={disabled} noun={noun}
                onMove={(by) => onChange(move(groups, i, by))} onRemove={() => onChange(groups.filter((_, j) => j !== i))}
              />
            </div>
          </li>
        ))}
      </ol>
      {!disabled && (
        <button type="button" className="btn-ghost mt-2 text-brand-700" onClick={() => onChange([...groups, { title: '', points: [] }])}>
          <Icon name="plus" className="h-4 w-4" /> {addLabel}
        </button>
      )}
    </div>
  )
}

export function FeesEditor({ fees, onChange, disabled }: { fees: FeeLine[]; onChange: (fees: FeeLine[]) => void; disabled?: boolean }) {
  const set = (i: number, patch: Partial<FeeLine>) => onChange(fees.map((f, j) => (j === i ? { ...f, ...patch } : f)))
  return (
    <div>
      <p className="label mb-2">Fee</p>
      <div className="overflow-hidden rounded-xl border border-stone-200">
        {fees.map((fee, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 border-t border-stone-100 bg-white px-3 py-2 first:border-t-0 sm:flex-nowrap">
            <input
              className="input min-w-0 flex-1 font-medium" value={fee.label} placeholder="e.g. Design & Consulting charges" disabled={disabled}
              onChange={(e) => set(i, { label: e.target.value })} aria-label={`Fee ${i + 1} label`}
            />
            <div className="flex items-center gap-1">
              <span className="text-sm text-stone-500">₹</span>
              <NumberInput value={fee.amount} onChange={(amount) => set(i, { amount })} disabled={disabled} label={`Fee ${i + 1} amount`} className="w-36" />
            </div>
            <RowButtons
              index={i} count={fees.length} disabled={disabled} noun="fee"
              onMove={(by) => onChange(move(fees, i, by))} onRemove={() => onChange(fees.filter((_, j) => j !== i))}
            />
          </div>
        ))}
        {fees.length === 0 && <p className="px-3 py-3 text-sm text-stone-400">No fee lines.</p>}
      </div>
      {!disabled && (
        <button type="button" className="btn-ghost mt-2 text-brand-700" onClick={() => onChange([...fees, { label: '', amount: 0 }])}>
          <Icon name="plus" className="h-4 w-4" /> Add fee line
        </button>
      )}
    </div>
  )
}

export function RatesEditor({ rates, onChange, disabled }: { rates: VisitRate[]; onChange: (rates: VisitRate[]) => void; disabled?: boolean }) {
  const set = (i: number, patch: Partial<VisitRate>) => onChange(rates.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-stone-200">
        {rates.map((rate, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 border-t border-stone-100 bg-white px-3 py-2 first:border-t-0 sm:flex-nowrap">
            <input
              className="input min-w-0 flex-1" value={rate.label} placeholder="e.g. Site Engineer / Supervisor Visit" disabled={disabled}
              onChange={(e) => set(i, { label: e.target.value })} aria-label={`Visit ${i + 1}`}
            />
            <div className="flex items-center gap-1">
              <span className="text-sm text-stone-500">₹</span>
              <NumberInput value={rate.rate} onChange={(v) => set(i, { rate: v })} disabled={disabled} label={`Visit ${i + 1} rate`} className="w-28" />
              <span className="whitespace-nowrap text-xs text-stone-500">per visit</span>
            </div>
            <RowButtons
              index={i} count={rates.length} disabled={disabled} noun="visit rate"
              onMove={(by) => onChange(move(rates, i, by))} onRemove={() => onChange(rates.filter((_, j) => j !== i))}
            />
          </div>
        ))}
        {rates.length === 0 && <p className="px-3 py-3 text-sm text-stone-400">No visit charges.</p>}
      </div>
      {!disabled && (
        <button type="button" className="btn-ghost mt-2 text-brand-700" onClick={() => onChange([...rates, { label: '', rate: 0 }])}>
          <Icon name="plus" className="h-4 w-4" /> Add visit charge
        </button>
      )}
    </div>
  )
}

/** Numbered terms, each a paragraph of its own. */
export function TermsEditor({ terms, onChange, disabled }: { terms: string[]; onChange: (terms: string[]) => void; disabled?: boolean }) {
  return (
    <div>
      {terms.length === 0 && <p className="px-1 pb-2 text-sm text-stone-400">None yet.</p>}
      <ol className="space-y-2">
        {terms.map((term, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f1ece4] text-xs font-bold tabular-nums text-stone-700">{i + 1}</span>
            <textarea
              className="input min-h-[44px] flex-1 resize-y text-[13px]" rows={2} value={term} disabled={disabled}
              onChange={(e) => onChange(terms.map((t, j) => (j === i ? e.target.value : t)))} aria-label={`Term ${i + 1}`}
            />
            <RowButtons
              index={i} count={terms.length} disabled={disabled} noun="term"
              onMove={(by) => onChange(move(terms, i, by))} onRemove={() => onChange(terms.filter((_, j) => j !== i))}
            />
          </li>
        ))}
      </ol>
      {!disabled && (
        <button type="button" className="btn-ghost mt-2 text-brand-700" onClick={() => onChange([...terms, ''])}>
          <Icon name="plus" className="h-4 w-4" /> Add a term
        </button>
      )}
    </div>
  )
}
