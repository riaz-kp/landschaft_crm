import type { ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useDb } from '../../state/useDb'
import { Icon } from '../../components/Icon'
import { BrandMark } from '../../components/Logo'
import { BRAND } from '../../components/brand'
import { StoredImg } from '../../components/StoredImage'
import { Badge, EmptyState, StatusBadge } from '../../components/ui'
import { formatDate } from '../../domain/format'
import {
  KIND_TITLE, formatQty, formatRupees, groupPlants, isPriced, itemAmount, plantAmount, plantThumb, quoteTotals, serviceAmount,
  shows, showsPlans,
} from '../../domain/quotation'
import type { Client, DocumentSettings, Project, Quotation } from '../../domain/types'
import { editPath, pdfPath, useQuoteAccess } from './access'
import { SpecText } from './editors'

const CREAM = '#f6f3ec'

/** Opens the document named in the URL as a page that fits any screen. */
export function QuoteViewPage() {
  const { quoteId = '' } = useParams()
  const db = useDb()
  const quote = db.quotations.find((q) => q.id === quoteId)
  const project = quote && db.projects.find((p) => p.id === quote.projectId)
  if (!quote || !project) {
    return <EmptyState title="Document not found." hint="It may have been deleted." icon="doc" />
  }
  const client = db.clients.find((c) => c.id === project.clientId)
  return <QuoteView quote={quote} project={project} client={client} settings={db.settings.documents} />
}

/**
 * A BOQ or quotation to read on any screen: the same sections as the printed
 * document, laid out to reflow on a phone. Opening a document lands here;
 * Edit goes to its editor, and PDF view shows the A4 pages to print or save.
 */
function QuoteView({ quote, project, client, settings }: { quote: Quotation; project: Project; client?: Client; settings: DocumentSettings }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { canEdit } = useQuoteAccess()
  const priced = isPriced(quote.kind)
  const plans = showsPlans(quote.kind, project.services)
  const totals = quoteTotals(quote)

  const lines = shows(quote, 'plants') ? quote.plants?.lines ?? [] : []
  const areas = shows(quote, 'hardscape') ? quote.areas.filter((a) => a.name.trim() || a.items.length || a.planImage) : []
  const services = shows(quote, 'services') ? quote.services.filter((l) => l.title.trim()) : []
  const servicesTitle = quote.servicesTitle.trim() || 'Project management'
  const terms = shows(quote, 'terms') ? quote.terms.filter((t) => t.title.trim() || t.text.trim()) : []
  const steps = shows(quote, 'procedure') ? quote.procedure.filter((s) => s.title.trim() || s.text.trim()) : []
  const stages = shows(quote, 'payment') ? quote.paymentStages.filter((s) => s.label.trim() || s.percent) : []
  const paragraphs = quote.letter.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)

  // Back to wherever the document was opened from; straight from a link, to the project's documents.
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

      {/* The cover: who it is for, and the letter. */}
      <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
        <div className="px-5 pb-5 pt-6 sm:px-8 sm:pt-8" style={{ background: CREAM }}>
          <div className="flex items-start justify-between gap-4">
            <BrandMark size={34} />
            <span className="flex flex-wrap justify-end gap-2">
              <Badge tone={quote.kind === 'BOQ' ? 'blue' : 'green'}>{KIND_TITLE[quote.kind]}</Badge>
              <StatusBadge status={quote.status} />
            </span>
          </div>
          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.25em]" style={{ color: BRAND.sage }}>{quote.number}</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-5xl" style={{ color: BRAND.dark }}>{KIND_TITLE[quote.kind]}</h1>
        </div>
        <dl className="grid grid-cols-2 border-t border-stone-200 sm:grid-cols-4">
          {[
            ['Client', client?.name ?? '—'],
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

      {quote.intro.trim() && (lines.length > 0 || areas.length > 0 || services.length > 0) && (
        <p className="px-1 text-sm leading-relaxed text-stone-600">{quote.intro}</p>
      )}

      {lines.length > 0 && (
        <Card title="Plants" note={`${lines.length} line${lines.length === 1 ? '' : 's'}`}>
          <ColumnHeads cols={['Size (ft)', 'Quantity', ...(priced ? ['Rate'] : [])]} priced={priced} />
          {groupPlants(lines).map(([category, group]) => (
            <div key={category}>
              <GroupHead label={category} count={String(group.length)} />
              <ul className="divide-y divide-stone-100">
                {group.map((line, i) => (
                  <LineRow
                    key={`${line.name}-${i}`}
                    image={<Thumb src={plantThumb(line.image, 120)} />}
                    title={line.name} subtitle={line.botanical}
                    cols={[line.size || '—', qty(line.quantity, line.unit), ...(priced ? [line.rate ? formatRupees(line.rate) : '—'] : [])]}
                    labels={['Size', 'Qty', 'Rate']}
                    amount={priced ? plantAmount(line) : undefined}
                  />
                ))}
              </ul>
            </div>
          ))}
          {priced && <Subtotal label="Plants subtotal" amount={totals.plants} />}
        </Card>
      )}

      {areas.length > 0 && (
        <Card title="Hardscape" note={`${areas.length} area${areas.length === 1 ? '' : 's'}`}>
          {areas.map((area, a) => {
            const name = area.name.trim() || `Area ${a + 1}`
            return (
              <div key={area.id}>
                <GroupHead label={name} count={`${area.items.length} item${area.items.length === 1 ? '' : 's'}`} strong />
                {plans && area.planImage && (
                  <div className="border-b border-stone-100 p-3 sm:p-4">
                    <StoredImg src={area.planImage} alt={`Plan of ${name}`} className="max-h-[420px] w-full rounded-xl bg-stone-50 object-contain" />
                  </div>
                )}
                {area.items.length > 0 && (
                  <>
                    <ColumnHeads cols={['Size', 'Quantity', ...(priced ? ['Rate'] : [])]} priced={priced} />
                    <ul className="divide-y divide-stone-100">
                      {area.items.map((item) => (
                        <LineRow
                          key={item.id}
                          image={item.image
                            ? <StoredImg src={item.image} alt={item.item} className={`${item.specification?.trim() ? 'h-16 w-16 sm:h-24 sm:w-24' : 'h-10 w-10'} shrink-0 rounded-lg object-cover`} />
                            : <Thumb />}
                          title={item.item}
                          details={<SpecText spec={item.specification} className="mt-1 text-xs leading-relaxed text-stone-600" headingClassName="text-[10px] text-stone-400" />}
                          cols={[item.dimension?.trim() || '—', qty(item.quantity, item.unit), ...(priced ? [item.rate ? formatRupees(item.rate) : '—'] : [])]}
                          labels={['Size', 'Qty', 'Rate']}
                          amount={priced ? itemAmount(item) : undefined}
                        />
                      ))}
                    </ul>
                  </>
                )}
                {priced && areas.length > 1 && area.items.length > 0 && <Subtotal label={`${name} subtotal`} amount={totals.areas[area.id] ?? 0} />}
              </div>
            )
          })}
          {priced && <Subtotal label="Hardscape subtotal" amount={totals.hardscape} />}
        </Card>
      )}

      {services.length > 0 && (
        <Card title={servicesTitle}>
          <ColumnHeads cols={['Quantity', ...(priced ? ['Rate'] : [])]} priced={priced} />
          <ul className="divide-y divide-stone-100">
            {services.map((line) => (
              <LineRow
                key={line.id}
                title={line.title} description={line.description}
                cols={[qty(line.quantity, line.unit), ...(priced ? [formatRupees(line.rate)] : [])]}
                labels={['Qty', 'Rate']}
                amount={priced ? serviceAmount(line) : undefined}
              />
            ))}
          </ul>
          {priced && <Subtotal label={`${servicesTitle.split(',')[0].trim()} subtotal`} amount={totals.services} />}
        </Card>
      )}

      {priced && (
        <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          <h2 className="border-b border-stone-100 px-5 py-4 font-semibold text-stone-900">Summary</h2>
          <dl className="divide-y divide-stone-100">
            {[
              ...(lines.length ? [['Plants', totals.plants] as const] : []),
              ...(areas.length ? [['Hardscape', totals.hardscape] as const] : []),
              ...(services.length ? [[servicesTitle.split(',')[0].trim(), totals.services] as const] : []),
              ...(totals.discount ? [['Discount', -totals.discount] as const] : []),
            ].map(([label, amount]) => (
              <div key={label} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                <dt className="text-stone-600">{label}</dt>
                <dd className="font-semibold tabular-nums text-stone-900">{amount < 0 ? `− ${formatRupees(-amount)}` : formatRupees(amount)}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4" style={{ background: BRAND.dark }}>
            <span className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: BRAND.sand }}>Grand total</span>
            <span className="font-display text-2xl font-bold tabular-nums text-white sm:text-3xl">{formatRupees(totals.total)}</span>
          </div>
        </section>
      )}

      {terms.length > 0 && (
        <Card title="Terms / project-specific notes">
          <ol className="grid gap-x-8 gap-y-4 p-5 md:grid-cols-2">
            {terms.map((term, i) => (
              <li key={i} className="flex gap-3">
                <Num n={i + 1} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-stone-900">{term.title}</p>
                  <p className="mt-0.5 text-sm text-stone-600">{term.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {steps.length > 0 && (
        <Card title="Scope and work procedure">
          <ol className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
            {steps.map((step, i) => (
              <li key={i} className="rounded-xl p-4" style={{ background: CREAM }}>
                <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: BRAND.dark }}>{i + 1}</span>
                <p className="mt-3 text-sm font-semibold text-stone-900">{step.title}</p>
                <p className="mt-1 text-sm text-stone-600">{step.text}</p>
              </li>
            ))}
          </ol>
          {quote.procedureNote.trim() && (
            <p className="mx-4 mb-4 rounded-xl px-4 py-3 text-sm text-stone-700 sm:mx-5 sm:mb-5" style={{ background: '#f4efe6' }}>
              <span className="mr-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.15em]" style={{ background: BRAND.sand, color: BRAND.dark }}>Note</span>
              {quote.procedureNote}
            </p>
          )}
        </Card>
      )}

      {stages.length > 0 && <PaymentCard stages={stages} total={totals.total} />}

      {shows(quote, 'schedule') && (
        <Card title="Work schedule / details">
          <dl className="divide-y divide-stone-100">
            {[
              ['Mobilisation', quote.schedule.mobilisationDays ? `Within ${quote.schedule.mobilisationDays} days from advance / work order and site clearance` : 'To be agreed'],
              ['Execution period', quote.schedule.executionDays ? `Approximately ${quote.schedule.executionDays} working days, subject to clear access and coordination` : 'To be agreed'],
              ['Quotation validity', quote.schedule.validity],
              ['Maintenance period', quote.schedule.maintenance],
              ['Billing basis', quote.schedule.billing],
            ].filter(([, value]) => value).map(([label, value]) => (
              <div key={label} className="px-5 py-3 sm:flex sm:gap-6">
                <dt className="text-xs font-semibold uppercase tracking-[0.15em] text-stone-500 sm:w-48 sm:shrink-0 sm:pt-0.5">{label}</dt>
                <dd className="mt-1 text-sm text-stone-800 sm:mt-0">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      {shows(quote, 'bank') && (
        <section className="rounded-2xl p-5 sm:p-6" style={{ background: BRAND.dark }}>
          <h2 className="font-semibold text-white">Bank details</h2>
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

      {shows(quote, 'acceptance') && (
        <Card title="Client acceptance">
          <p className="p-5 text-sm leading-relaxed text-stone-700">{settings.acceptance[quote.kind]}</p>
        </Card>
      )}
    </div>
  )
}

const qty = (quantity: number | undefined, unit: string | undefined) => [formatQty(quantity), unit].filter((s) => s && s !== '—').join(' ') || '—'

function Card({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
      <header className="flex items-center justify-between gap-3 px-5 py-3.5" style={{ background: BRAND.dark }}>
        <h2 className="flex min-w-0 items-center gap-2.5 text-sm font-semibold text-white">
          <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: BRAND.sand }} />
          <span className="truncate">{title}</span>
        </h2>
        {note && <span className="shrink-0 text-xs" style={{ color: BRAND.sand }}>{note}</span>}
      </header>
      {children}
    </section>
  )
}

/** Column names over the rows, on screens wide enough to show the columns. */
function ColumnHeads({ cols, priced }: { cols: string[]; priced: boolean }) {
  return (
    <div className="hidden items-center gap-3 border-b border-stone-100 px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-500 sm:flex" style={{ background: CREAM }}>
      <span className="flex-1">Item</span>
      {cols.map((c) => <span key={c} className="w-24 text-right">{c}</span>)}
      {priced && <span className="w-28 text-right">Amount</span>}
    </div>
  )
}

function GroupHead({ label, count, strong }: { label: string; count?: string; strong?: boolean }) {
  return (
    <div className="flex items-center gap-2 border-b border-stone-100 px-5 py-2" style={{ background: strong ? '#f3eee5' : '#faf8f3' }}>
      <span className={`text-[11px] uppercase tracking-[0.18em] ${strong ? 'font-bold text-stone-900' : 'font-semibold text-stone-500'}`}>{label}</span>
      {count && <span className="rounded-full px-2 py-px text-[10px] font-bold" style={{ background: strong ? BRAND.sand : '#ece6da', color: BRAND.dark }}>{count}</span>}
    </div>
  )
}

/**
 * One line: on a phone the figures sit under the name, on a wider screen in
 * columns beside it. The amount stays at the right either way.
 */
function LineRow({ image, title, subtitle, description, details, cols, labels, amount }: {
  image?: ReactNode; title: string; subtitle?: string; description?: string; details?: ReactNode; cols: string[]; labels: string[]; amount?: number
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-3 sm:items-center sm:px-5">
      {image}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-stone-900">{title}</p>
        {subtitle && <p className="text-xs italic text-stone-500">{subtitle}</p>}
        {description && <p className="mt-0.5 text-xs leading-relaxed text-stone-500">{description}</p>}
        {details}
        <p className="mt-1 text-xs text-stone-500 sm:hidden">
          {cols.map((c, i) => <span key={i} className="whitespace-nowrap">{i > 0 && <span className="mx-1.5 text-stone-300">·</span>}{labels[i]} {c}</span>)}
        </p>
      </div>
      {cols.map((c, i) => <span key={i} className="hidden w-24 shrink-0 text-right text-sm tabular-nums text-stone-700 sm:block">{c}</span>)}
      {amount !== undefined && <span className="shrink-0 text-right text-sm font-semibold tabular-nums text-stone-900 sm:w-28">{formatRupees(amount)}</span>}
    </li>
  )
}

function Thumb({ src }: { src?: string }) {
  if (src) return <img src={src} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
  return <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#eef1ea]" style={{ color: BRAND.sage }}><Icon name="leaf" className="h-4 w-4" /></span>
}

function Subtotal({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-stone-100 px-5 py-3" style={{ background: CREAM }}>
      <span className="text-xs font-semibold uppercase tracking-[0.15em] text-stone-600">{label}</span>
      <span className="font-bold tabular-nums text-stone-900">{formatRupees(amount)}</span>
    </div>
  )
}

function Num({ n }: { n: number }) {
  return <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f1ece4] text-xs font-bold" style={{ color: BRAND.dark }}>{n}</span>
}

function PaymentCard({ stages, total }: { stages: Quotation['paymentStages']; total: number }) {
  const sum = stages.reduce((s, x) => s + x.percent, 0) || 1
  const palette = [BRAND.dark, '#4c644d', BRAND.sage, '#a9ad95', BRAND.sand, '#e9e1d4']
  return (
    <Card title="Payment schedule">
      <div className="flex h-8 gap-1 px-4 pt-4 sm:px-5" style={{ boxSizing: 'content-box' }}>
        {stages.map((s, i) => (
          <div
            key={i} className="flex min-w-0 items-center justify-center rounded-md text-[10px] font-bold tabular-nums"
            style={{ flex: Math.max(s.percent, 4) / sum, background: palette[i % palette.length], color: i < 3 ? '#fff' : BRAND.dark }}
          >
            {s.percent >= 15 ? `${s.percent}%` : ''}
          </div>
        ))}
      </div>
      <ul className="mt-3 divide-y divide-stone-100 border-t border-stone-100">
        {stages.map((stage, i) => (
          <li key={i} className="flex items-center gap-3 px-5 py-3 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: palette[i % palette.length] }} />
            <span className="min-w-0 flex-1 text-stone-800">{stage.label}</span>
            <span className="w-12 shrink-0 text-right font-semibold tabular-nums">{stage.percent}%</span>
            <span className="w-28 shrink-0 text-right font-semibold tabular-nums">{formatRupees((total * stage.percent) / 100)}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
