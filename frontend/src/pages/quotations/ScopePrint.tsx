import { useMemo, type ReactNode } from 'react'
import { KIND_TITLE, gstLabel, shows } from '../../domain/quotation'
import { filledGroups, filledPoints, formatFee, groupLetter, scopeTotals } from '../../domain/scope'
import type { Client, DocumentSettings, Project, Quotation, ScopeGroup } from '../../domain/types'
import { type Block } from './paginate'
import { Accent, Band, CREAM, Cover, DARK, LINE, MUTED, PageTitle, PrintShell, RADIUS, SAGE, SAND, TINT } from './printKit'

/**
 * The Scope of Services & Fee Proposal as A4 pages, after the company's own
 * proposal: the cover letter, the scope of services part by part, the work
 * schedule phase by phase, the fee and payment terms, site visits, execution
 * and AMC, bank details, terms and conditions, and the closing.
 */
export function ScopePrintView({ quote, project, client, settings }: { quote: Quotation; project: Project; client?: Client; settings: DocumentSettings }) {
  const blocks = useMemo(() => buildScopeBlocks(quote, settings), [quote, settings])
  const title = KIND_TITLE.Scope
  return (
    <PrintShell
      quote={quote} project={project} client={client} settings={settings} title={title} blocks={blocks}
      cover={
        <Cover
          quote={quote} project={project} client={client} settings={settings}
          eyebrow={quote.scope?.subject.trim() || 'Subject'} title={title} titleSize={46}
        />
      }
    />
  )
}

// ---------------------------------------------------------------- pieces

/** A section's title, with room above it when something comes before it on the page. */
function Title({ title, first }: { title: string; first?: boolean }) {
  return <div className={first ? '' : 'pt-7'}><PageTitle title={title} /></div>
}

/** "A  Site Appraisal & Analysis (note)": the badge, the heading and its note. */
function GroupHead({ badge, title, note }: { badge: string; title: string; note?: string }) {
  return (
    <div className="flex items-center gap-3 pb-1.5 pt-3.5">
      <span
        className="flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-[6px] px-1.5 text-[9.5px] font-bold uppercase tracking-[0.06em] text-white"
        style={{ background: DARK }}
      >
        {badge}
      </span>
      <p className="text-[12px] font-bold uppercase leading-snug tracking-[0.1em]" style={{ color: DARK }}>
        {title}
        {note && <span className="ml-2 text-[11px] font-normal normal-case italic tracking-normal" style={{ color: MUTED }}>({note})</span>}
      </p>
    </div>
  )
}

function Point({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 py-[3px] pl-[34px] text-[11.5px] leading-[1.55] text-stone-800">
      <span className="mt-[7px] h-[5px] w-[5px] shrink-0 rounded-full" style={{ background: SAGE }} />
      <span className="min-w-0">{children}</span>
    </div>
  )
}

/** A group's heading and points as blocks: the heading keeps with its first point, and points split across pages one by one. */
function groupBlocks(key: string, group: ScopeGroup, badge: string, fallback: string): Block[] {
  const points = filledPoints(group)
  const out: Block[] = [{
    key: `${key}-head`, keepWithNext: points.length > 0,
    node: <GroupHead badge={badge} title={group.title.trim() || fallback} note={group.note?.trim() || undefined} />,
  }]
  points.forEach((point, i) => out.push({ key: `${key}-${i}`, node: <Point>{point}</Point> }))
  return out
}

/** A label and its amount, as one row of the fee table. */
function FeeRow({ label, amount, strong }: { label: string; amount: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b px-5 py-3" style={{ borderColor: LINE }}>
      <span className={`text-[12.5px] ${strong ? 'font-semibold text-stone-900' : 'text-stone-700'}`}>{label}</span>
      <span className={`text-[13px] tabular-nums ${strong ? 'font-bold text-stone-900' : 'text-stone-800'}`}>{amount}</span>
    </div>
  )
}

function Paragraph({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`text-[11.5px] leading-[1.6] text-stone-800 ${className}`}>{children}</p>
}

// ---------------------------------------------------------------- the proposal, block by block

export function buildScopeBlocks(quote: Quotation, settings: DocumentSettings): Block[] {
  const scope = quote.scope
  const blocks: Block[] = []
  if (!scope) return [{ key: 'empty', node: <p className="pt-10 text-center text-[13px] text-stone-500">This proposal has no content yet.</p> }]
  const totals = scopeTotals(quote)

  // ---- scope of services
  const services = filledGroups(scope.services)
  if (services.length) {
    blocks.push({ key: 'sv-title', node: <Title title="Scope of Services" first />, keepWithNext: true })
    services.forEach((group, i) => blocks.push(...groupBlocks(`sv${i}`, group, groupLetter(i), `Part ${groupLetter(i)}`)))
  }

  // ---- work schedule
  const phases = shows(quote, 'schedule') ? filledGroups(scope.phases) : []
  if (phases.length) {
    blocks.push({ key: 'ph-title', node: <Title title="Work Schedule" first={!blocks.length} />, keepWithNext: true })
    phases.forEach((group, i) => blocks.push(...groupBlocks(`ph${i}`, group, `Phase ${i + 1}`, `Phase ${i + 1}`)))
  }

  // ---- fee structure and payment terms, straight after the schedule; the title keeps with the fee table
  const fees = scope.fees.filter((f) => f.label.trim() || f.amount)
  const stages = shows(quote, 'payment') ? quote.paymentStages.filter((s) => s.label.trim() || s.percent) : []
  if (fees.length || stages.length) {
    blocks.push({ key: 'fee-title', node: <Title title={stages.length ? 'Fee Structure & Payment Terms' : 'Fee Structure'} first={!blocks.length} />, keepWithNext: true })
  }
  if (fees.length) {
    const frame = 'fees'
    blocks.push({ key: 'fee-band', frame, keepWithNext: true, node: <Band title="Design & consultancy fee" /> })
    fees.forEach((fee, i) => blocks.push({
      key: `fee-${i}`, frame, keepWithNext: true,
      node: <FeeRow label={fee.label.trim() || 'Fee'} amount={formatFee(fee.amount)} strong={fees.length === 1} />,
    }))
    if (fees.length > 1) blocks.push({ key: 'fee-sum', frame, keepWithNext: true, node: <FeeRow label="Total fee" amount={formatFee(totals.fee)} strong /> })
    if (totals.gstRate !== undefined) blocks.push({ key: 'fee-gst', frame, keepWithNext: true, node: <FeeRow label={gstLabel(totals.gstRate)} amount={formatFee(totals.gst)} /> })
    blocks.push({
      key: 'fee-net', frame,
      node: (
        <div className="flex items-center justify-between gap-6 px-5 py-4" style={{ background: DARK }}>
          <span className="text-[9.5px] font-bold uppercase tracking-[0.3em]" style={{ color: SAND }}>Net amount</span>
          <span className="text-[17px] font-bold tabular-nums text-white">{formatFee(totals.total)}</span>
        </div>
      ),
    })
  }
  if (stages.length) {
    const frame = 'stages'
    const head = (
      <div className="flex items-center border-b px-5 py-2.5" style={{ borderColor: LINE, background: CREAM }}>
        <span className="w-10 text-[8px] font-semibold uppercase tracking-[0.02em] text-stone-600">Stage</span>
        <span className="flex-1 text-[8px] font-semibold uppercase tracking-[0.02em] text-stone-600">Payable</span>
        <span className="w-16 text-right text-[8px] font-semibold uppercase tracking-[0.02em] text-stone-600">Share</span>
        {totals.total > 0 && <span className="w-32 text-right text-[8px] font-semibold uppercase tracking-[0.02em] text-stone-600">Amount</span>}
      </div>
    )
    blocks.push({ key: 'st-gap', node: <div className="h-5" />, keepWithNext: true })
    blocks.push({ key: 'st-band', frame, keepWithNext: true, node: <Band title="Payment terms" /> })
    blocks.push({ key: 'st-head', frame, keepWithNext: true, node: head })
    stages.forEach((stage, i) => blocks.push({
      key: `st-${i}`, frame, carryHead: head,
      node: (
        <div className="flex items-center border-b px-5 py-3 last:border-b-0" style={{ borderColor: LINE }}>
          <span className="w-10 text-[11px] tabular-nums" style={{ color: SAGE }}>{i + 1}</span>
          <span className="flex-1 pr-3 text-[12px] text-stone-900">{stage.label}</span>
          <span className="w-16 text-right text-[12.5px] font-bold tabular-nums text-stone-900">{stage.percent}%</span>
          {totals.total > 0 && <span className="w-32 text-right text-[12px] tabular-nums text-stone-800">{formatFee((totals.total * stage.percent) / 100)}</span>}
        </div>
      ),
    }))
  }

  // ---- site visits
  const rates = scope.visits.rates.filter((r) => r.label.trim() || r.rate)
  if (scope.visits.note.trim() || scope.visits.included.trim() || rates.length) {
    blocks.push({ key: 'sv-fees-title', node: <Title title="Site Visit Fees" first={!blocks.length} />, keepWithNext: true })
    if (scope.visits.note.trim()) {
      blocks.push({ key: 'visit-note', node: <Paragraph className="pb-3"><strong className="font-semibold text-stone-900">Site visit charges: </strong>{scope.visits.note.trim()}</Paragraph> })
    }
    if (scope.visits.included.trim()) {
      blocks.push({
        key: 'visit-included', keepWithNext: rates.length > 0,
        node: (
          <div className="mb-3 flex items-center gap-3 px-5 py-3" style={{ background: CREAM, borderRadius: RADIUS }}>
            <span className="text-[9px] font-bold uppercase tracking-[0.28em]" style={{ color: SAGE }}>Included site visits</span>
            <span className="text-[12.5px] font-semibold text-stone-900">{scope.visits.included.trim()}</span>
          </div>
        ),
      })
    }
    if (rates.length) {
      const frame = 'visits'
      blocks.push({ key: 'visit-band', frame, keepWithNext: true, node: <Band title="Additional site visit charges" /> })
      rates.forEach((r, i) => blocks.push({
        key: `visit-${i}`, frame,
        node: <FeeRow label={r.label.trim() || 'Site visit'} amount={`${formatFee(r.rate).replace('/-', '')} per visit`} />,
      }))
    }
  }

  // ---- execution and AMC
  const notes = [
    ['Execution Works', scope.executionNote.trim()],
    ['Annual Maintenance (AMC)', scope.amcNote.trim()],
  ].filter(([, text]) => text)
  if (notes.length) {
    blocks.push({ key: 'ex-title', node: <Title title="Execution & Maintenance Fees" first={!blocks.length} />, keepWithNext: true })
    blocks.push({
      key: 'ex',
      node: (
        <div className={`grid gap-3 ${notes.length === 2 ? 'grid-cols-2' : ''}`}>
          {notes.map(([label, text]) => (
            <div key={label} className="border px-5 py-4" style={{ borderColor: LINE, borderRadius: RADIUS }}>
              <p className="text-[9px] font-bold uppercase tracking-[0.28em]" style={{ color: SAGE }}>{label}</p>
              <p className="mt-2 text-[11.5px] leading-[1.55] text-stone-800">{text}</p>
            </div>
          ))}
        </div>
      ),
    })
  }

  // ---- bank details
  if (shows(quote, 'bank')) {
    const { bank } = settings
    blocks.push({ key: 'bank-title', node: <Title title="Bank Details for Payment" first={!blocks.length} />, keepWithNext: true })
    blocks.push({
      key: 'bank', keepWithNext: true,
      node: (
        <div className="grid grid-cols-[1fr_0.9fr_1.4fr_1fr] px-2 py-6" style={{ background: DARK, borderRadius: RADIUS }}>
          {[['Account name', bank.accountName], ['Bank name', bank.bankName], ['Account number', bank.accountNumber], ['IFSC code', bank.ifsc]].map(([label, value]) => (
            <div key={label} className="min-w-0 px-4">
              <p className="text-[8.5px] font-semibold uppercase tracking-[0.28em]" style={{ color: SAND }}>{label}</p>
              <p className="mt-1.5 whitespace-nowrap text-[14px] font-bold text-white">{value}</p>
            </div>
          ))}
        </div>
      ),
    })
    blocks.push({
      key: 'bank-note',
      node: <p className="pt-2.5 text-[10.5px] text-stone-600">Payments can be made via NEFT / RTGS / IMPS or cheque in favour of “{bank.accountName}”.</p>,
    })
  }

  // ---- terms and conditions
  const terms = shows(quote, 'terms') ? scope.terms.map((t) => t.trim()).filter(Boolean) : []
  if (terms.length) {
    blocks.push({ key: 'tc-title', node: <Title title="Terms & Conditions" first={!blocks.length} />, keepWithNext: true })
    terms.forEach((term, i) => blocks.push({
      key: `tc-${i}`,
      node: (
        <div className="flex gap-3 py-[5px]">
          <span className="flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full text-[9.5px] font-bold tabular-nums" style={{ background: '#f1ece4', color: DARK }}>{i + 1}</span>
          <p className="min-w-0 pt-[2px] text-[11.5px] leading-[1.55] text-stone-800">{term}</p>
        </div>
      ),
    }))
  }

  // ---- client acceptance
  if (shows(quote, 'acceptance')) {
    blocks.push({ key: 'acc-title', node: <Title title="Client Acceptance" first={!blocks.length} />, keepWithNext: true })
    blocks.push({
      key: 'acc',
      node: (
        <div className="border px-8 pb-7 pt-7" style={{ borderColor: LINE, borderRadius: RADIUS }}>
          <p className="text-[12px] leading-[1.6] text-stone-800">{settings.acceptance.Scope}</p>
          <div className="mt-16 grid grid-cols-2 gap-6">
            <div className="border-t border-stone-800 pt-3 text-[9px] font-semibold uppercase tracking-[0.3em] text-stone-800">For client / authorised signatory</div>
            <div className="border-t border-stone-800 pt-3 text-[9px] font-semibold uppercase tracking-[0.3em] text-stone-800">Consultant</div>
          </div>
        </div>
      ),
    })
  }

  // ---- closing
  const signOff = scope.signOff.split('\n').map((l) => l.trim()).filter(Boolean)
  if (scope.closing.trim() || signOff.length) {
    blocks.push({
      key: 'closing',
      node: (
        <div className="pt-8">
          {scope.closing.trim() && <Paragraph className="max-w-[560px] text-[12px]">{scope.closing.trim()}</Paragraph>}
          <Accent className="mt-8" />
          {signOff.map((line, i) => (
            <p key={i} className={`${i === 0 ? 'mt-5' : 'mt-0.5'} font-display text-[14px] ${i === signOff.length - 1 ? 'font-bold' : 'font-medium'}`} style={{ color: DARK }}>{line}</p>
          ))}
        </div>
      ),
    })
  }

  return blocks.length ? blocks : [{ key: 'empty', node: <p className="pt-10 text-center text-[13px] text-stone-500" style={{ background: TINT }}>Nothing to show yet.</p> }]
}
