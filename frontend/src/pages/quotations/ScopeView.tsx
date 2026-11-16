import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { BrandMark } from '../../components/Logo'
import { BRAND } from '../../components/brand'
import { Badge, StatusBadge } from '../../components/ui'
import { formatDate } from '../../domain/format'
import { KIND_TITLE, gstLabel, shows } from '../../domain/quotation'
import { filledGroups, filledPoints, formatFee, groupLetter, scopeTotals } from '../../domain/scope'
import type { Client, DocumentSettings, Project, Quotation, ScopeGroup } from '../../domain/types'
import { editPath, pdfPath, useQuoteAccess } from './access'
import { CREAM, Card, Num, PaymentCard } from './viewKit'

/**
 * A Scope of Services & Fee Proposal to read on any screen: the same parts as
 * the printed proposal, laid out to reflow on a phone. Edit goes to its
 * editor; PDF view shows the A4 pages to print or save.
 */
export function ScopeView({ quote, project, client, settings }: { quote: Quotation; project: Project; client?: Client; settings: DocumentSettings }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { canEdit } = useQuoteAccess()
  const scope = quote.scope
  const totals = scopeTotals(quote)
  const paragraphs = quote.letter.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  const services = filledGroups(scope?.services ?? [])
  const phases = shows(quote, 'schedule') ? filledGroups(scope?.phases ?? []) : []
  const fees = (scope?.fees ?? []).filter((f) => f.label.trim() || f.amount)
  const stages = shows(quote, 'payment') ? quote.paymentStages.filter((s) => s.label.trim() || s.percent) : []
  const rates = (scope?.visits.rates ?? []).filter((r) => r.label.trim() || r.rate)
  const terms = shows(quote, 'terms') ? (scope?.terms ?? []).map((t) => t.trim()).filter(Boolean) : []
  const signOff = (scope?.signOff ?? '').split('\n').map((l) => l.trim()).filter(Boolean)

  const back = () => {
    if (location.key !== 'default') navigate(-1)
    else navigate(`/projects/${project.id}?tab=commercial`)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={back} className="btn-ghost -ml-2 py-1.5"><Icon name="back" className="h-4 w-4" /> Back</button>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit(quote.kind) && <Link to={editPath(quote)} className="btn-secondary"><Icon name="edit" className="h-4 w-4" /> Edit</Link>}
          <Link to={pdfPath(quote)} className="btn-primary"><Icon name="doc" className="h-4 w-4" /> PDF view</Link>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
        <div className="px-5 pb-5 pt-6 sm:px-8 sm:pt-8" style={{ background: CREAM }}>
          <div className="flex items-start justify-between gap-4">
            <BrandMark size={34} />
            <span className="flex flex-wrap justify-end gap-2">
              <Badge tone="amber">Scope</Badge>
              <StatusBadge status={quote.status} />
            </span>
          </div>
          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.25em]" style={{ color: BRAND.sage }}>
            {[quote.number, scope?.subject.trim()].filter(Boolean).join(' · ')}
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: BRAND.dark }}>{KIND_TITLE.Scope}</h1>
        </div>
        <dl className="grid grid-cols-2 border-t border-stone-200 sm:grid-cols-4">
          {[
            ['To', client?.name ?? '—'],
            ['Date', formatDate(quote.date)],
            ['Project', project.name],
            ['Location', project.siteLocation || '—'],
          ].map(([label, value], i) => (
            <div key={label} className={`min-w-0 px-5 py-3.5 ${i % 2 ? 'border-l' : ''} ${i > 1 ? 'border-t sm:border-t-0' : ''} ${i === 2 ? 'sm:border-l' : ''} border-stone-200`}>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: BRAND.sage }}>{label}</dt>
              <dd className="mt-0.5 break-words font-medium text-stone-900">{value}</dd>
            </div>
          ))}
        </dl>
        {(quote.letter.greeting || paragraphs.length > 0) && (
          <div className="border-t border-stone-200 px-5 py-5 text-sm leading-relaxed text-stone-700 sm:px-8 sm:py-6">
            <p className="font-display font-bold text-stone-900">{quote.letter.greeting}</p>
            {paragraphs.map((p, i) => <p key={i} className="mt-3">{p}</p>)}
            {quote.letter.signOff && <p className="mt-4 font-display font-bold text-stone-900">{quote.letter.signOff}</p>}
          </div>
        )}
      </section>

      {services.length > 0 && (
        <Card title="Scope of services" note={`${services.length} part${services.length === 1 ? '' : 's'}`}>
          <Groups groups={services} badge={(i) => groupLetter(i)} />
        </Card>
      )}

      {phases.length > 0 && (
        <Card title="Work schedule" note={`${phases.length} phase${phases.length === 1 ? '' : 's'}`}>
          <Groups groups={phases} badge={(i) => `Phase ${i + 1}`} />
        </Card>
      )}

      {fees.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          <h2 className="border-b border-stone-100 px-5 py-4 font-semibold text-stone-900">Fee structure</h2>
          <dl className="divide-y divide-stone-100">
            {[
              ...fees.map((f) => [f.label.trim() || 'Fee', f.amount] as const),
              ...(fees.length > 1 ? [['Total fee', totals.fee] as const] : []),
              ...(totals.gstRate !== undefined ? [[gstLabel(totals.gstRate), totals.gst] as const] : []),
            ].map(([label, amount], i) => (
              <div key={`${label}-${i}`} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                <dt className="text-stone-600">{label}</dt>
                <dd className="font-semibold tabular-nums text-stone-900">{formatFee(amount || 0)}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4" style={{ background: BRAND.dark }}>
            <span className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: BRAND.sand }}>Net amount</span>
            <span className="font-display text-2xl font-bold tabular-nums text-white sm:text-3xl">{formatFee(totals.total)}</span>
          </div>
        </section>
      )}

      {stages.length > 0 && <PaymentCard stages={stages} total={totals.total} title="Payment terms" format={formatFee} />}

      {scope && (scope.visits.note.trim() || scope.visits.included.trim() || rates.length > 0) && (
        <Card title="Site visit fees">
          <div className="space-y-4 p-5">
            {scope.visits.note.trim() && <p className="text-sm leading-relaxed text-stone-700">{scope.visits.note}</p>}
            {scope.visits.included.trim() && (
              <p className="rounded-xl px-4 py-3 text-sm" style={{ background: CREAM }}>
                <span className="mr-2 text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: BRAND.sage }}>Included</span>
                <span className="font-semibold text-stone-900">{scope.visits.included}</span>
              </p>
            )}
          </div>
          {rates.length > 0 && (
            <ul className="divide-y divide-stone-100 border-t border-stone-100">
              {rates.map((r, i) => (
                <li key={i} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                  <span className="text-stone-700">{r.label}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-stone-900">{formatFee(r.rate).replace('/-', '')} <span className="font-normal text-stone-500">per visit</span></span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {scope && (scope.executionNote.trim() || scope.amcNote.trim()) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {[['Execution works', scope.executionNote], ['Annual maintenance (AMC)', scope.amcNote]].filter(([, t]) => t.trim()).map(([label, text]) => (
            <section key={label} className="rounded-2xl border border-stone-200 bg-white p-5">
              <h2 className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: BRAND.sage }}>{label}</h2>
              <p className="mt-2 text-sm leading-relaxed text-stone-700">{text}</p>
            </section>
          ))}
        </div>
      )}

      {shows(quote, 'bank') && (
        <section className="rounded-2xl p-5 sm:p-6" style={{ background: BRAND.dark }}>
          <h2 className="font-semibold text-white">Bank details for payment</h2>
          <dl className="mt-4 grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-4">
            {[['Account name', settings.bank.accountName], ['Bank name', settings.bank.bankName], ['Account number', settings.bank.accountNumber], ['IFSC code', settings.bank.ifsc]].map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: BRAND.sand }}>{label}</dt>
                <dd className="mt-1 break-words font-semibold text-white">{value || '—'}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {terms.length > 0 && (
        <Card title="Terms & conditions">
          <ol className="space-y-3 p-5">
            {terms.map((term, i) => (
              <li key={i} className="flex gap-3">
                <Num n={i + 1} />
                <p className="min-w-0 pt-0.5 text-sm text-stone-700">{term}</p>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {shows(quote, 'acceptance') && (
        <Card title="Client acceptance">
          <p className="p-5 text-sm leading-relaxed text-stone-700">{settings.acceptance.Scope}</p>
        </Card>
      )}

      {scope && (scope.closing.trim() || signOff.length > 0) && (
        <section className="px-1 text-sm leading-relaxed text-stone-700">
          {scope.closing.trim() && <p>{scope.closing}</p>}
          {signOff.map((line, i) => <p key={i} className={`${i === 0 ? 'mt-4' : ''} font-display font-bold text-stone-900`}>{line}</p>)}
        </section>
      )}
    </div>
  )
}

function Groups({ groups, badge }: { groups: ScopeGroup[]; badge: (index: number) => string }) {
  return (
    <ol className="divide-y divide-stone-100">
      {groups.map((group, i) => (
        <li key={i} className="px-5 py-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="rounded-md px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: BRAND.dark }}>{badge(i)}</span>
            <h3 className="text-sm font-semibold uppercase tracking-[0.06em] text-stone-900">{group.title}</h3>
            {group.note?.trim() && <span className="text-xs italic text-stone-500">({group.note.trim()})</span>}
          </div>
          {filledPoints(group).length > 0 && (
            <ul className="mt-2.5 space-y-1.5 pl-1">
              {filledPoints(group).map((point, j) => (
                <li key={j} className="flex gap-2.5 text-sm text-stone-700">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: BRAND.sage }} />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  )
}
