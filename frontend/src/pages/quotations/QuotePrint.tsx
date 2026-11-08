import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useDb } from '../../state/useDb'
import { usePermissions } from '../../state/permissions'
import { Icon } from '../../components/Icon'
import { useFileUrl } from '../../components/StoredImage'
import { formatDate } from '../../domain/format'
import {
  KIND_TITLE, formatQty, formatRupees, groupPlants, isPriced, itemAmount, plantAmount, plantThumb, quoteTotals, serviceAmount,
  shows, showsPlans,
} from '../../domain/quotation'
import type { Client, DocumentSettings, PlantLine, Project, Quotation } from '../../domain/types'
import { usePages, type Block } from './paginate'
import { quotePath } from './access'

// The page, in CSS pixels: A4 at 96 dpi.
const PAGE_W = 794
const PAGE_H = 1123
const SIDE = 64
const CONTENT_W = PAGE_W - SIDE * 2
const CONTENT_TOP = 104
const CONTENT_BOTTOM = 1022
const CAPACITY = CONTENT_BOTTOM - CONTENT_TOP

// The company palette, from its own quotation.
const DARK = '#33463a'
const SAGE = '#8a977f'
const SAND = '#d9cdbb'
const CREAM = '#f6f3ec'
const LINE = '#e6e0d5'
const MUTED = '#7a8075'

/**
 * A BOQ or quotation as printed pages, after the company's own quotation:
 * a cover with the letter, the Bill of Quantities section by section, the
 * summary, terms, work procedure, payment schedule, work schedule, bank
 * details and the client's acceptance. Print it, or save it as a PDF, from here.
 */
export function QuotePrint() {
  const { quoteId = '' } = useParams()
  const db = useDb()
  const { canView } = usePermissions()
  const quote = db.quotations.find((q) => q.id === quoteId)
  const project = quote && db.projects.find((p) => p.id === quote.projectId)
  const client = project && db.clients.find((c) => c.id === project.clientId)

  if (!canView('Projects')) {
    return <Message title="You cannot open this document." />
  }
  if (!quote || !project) return <Message title="Document not found." />
  return <PrintView quote={quote} project={project} client={client} settings={db.settings.documents} />
}

function Message({ title }: { title: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-100 p-6">
      <div className="card-pad text-center">
        <p className="font-medium text-stone-700">{title}</p>
        <Link to="/dashboard" className="btn-secondary mt-4">Back to the CRM</Link>
      </div>
    </div>
  )
}

function PrintView({ quote, project, client, settings }: { quote: Quotation; project: Project; client?: Client; settings: DocumentSettings }) {
  const blocks = useMemo(() => buildBlocks(quote, project, settings), [quote, project, settings])
  const { measure, pages, ready } = usePages(blocks, CONTENT_W, CAPACITY)
  const sheet = useRef<HTMLDivElement>(null)
  const [printing, setPrinting] = useState(false)
  const [zoom, setZoom] = useState(1)
  const total = pages.length + 1
  const header = [KIND_TITLE[quote.kind], client?.name, [project.name, place(project.siteLocation)].filter(Boolean).join(', ')]
    .filter(Boolean).join(' · ')

  // The file name a saved PDF is offered under.
  useEffect(() => {
    const before = document.title
    document.title = [quote.number, client?.name, project.name].filter(Boolean).join(' — ')
    return () => {
      document.title = before
    }
  }, [quote.number, client?.name, project.name])

  // Fit the page to a phone's width on screen; printing always uses the real size.
  useEffect(() => {
    const fit = () => setZoom(Math.min(1, (window.innerWidth - 24) / PAGE_W))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  const print = async () => {
    setPrinting(true)
    await imagesLoaded(sheet.current)
    setPrinting(false)
    window.print()
  }

  return (
    <div className="quote-print min-h-screen bg-stone-200/70">
      <div className="print-hidden sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[820px] flex-wrap items-center justify-between gap-3 px-3 py-2.5">
          <Link to={quotePath(quote)} className="btn-ghost py-1.5"><Icon name="back" className="h-4 w-4" /> Back to {quote.number}</Link>
          <span className="hidden text-sm text-stone-500 sm:inline">{ready ? `${total} pages · A4` : 'Laying out pages…'}</span>
          <button type="button" className="btn-primary py-1.5" onClick={() => void print()} disabled={!ready || printing}>
            <Icon name="doc" className="h-4 w-4" /> {printing ? 'Loading images…' : 'Print / Save as PDF'}
          </button>
        </div>
      </div>

      {measure}

      <div ref={sheet} className="quote-sheet mx-auto py-6" style={{ ['--zoom' as string]: zoom, width: PAGE_W }}>
        <Page>
          <Cover quote={quote} project={project} client={client} settings={settings} />
          <Footer settings={settings} />
        </Page>
        {pages.map((placed, i) => (
          <Page key={i}>
            <div className="absolute flex items-end justify-between gap-6 border-b pb-2.5" style={{ left: SIDE, right: SIDE, top: 40, borderColor: LINE }}>
              <p className="min-w-0 truncate text-[9.5px] uppercase tracking-[0.06em] text-stone-500">
                <span className="font-bold" style={{ color: DARK }}>{KIND_TITLE[quote.kind]}</span>
                {header.slice(KIND_TITLE[quote.kind].length)}
              </p>
              <p className="shrink-0 text-[9.5px] font-bold tabular-nums tracking-[0.08em]" style={{ color: SAGE }}>
                {String(i + 2).padStart(2, '0')} / {String(total).padStart(2, '0')}
              </p>
            </div>
            <div className="absolute" style={{ left: SIDE, top: CONTENT_TOP, width: CONTENT_W }}>
              {placed.map((p) => <div key={p.key} style={{ display: 'flow-root' }}>{p.node}</div>)}
            </div>
            <Footer settings={settings} />
          </Page>
        ))}
      </div>
    </div>
  )
}

/** Waits for every picture on the pages, so none prints blank. Gives up on any after a few seconds. */
async function imagesLoaded(root: HTMLElement | null) {
  if (!root) return
  const deadline = Date.now() + 8000
  // Stored files are still being signed while their placeholder shows.
  while (root.querySelector('[data-loading]') && Date.now() < deadline) await new Promise((r) => setTimeout(r, 150))
  await Promise.all([...root.querySelectorAll('img')].map((img) => (img.complete ? null : new Promise((resolve) => {
    img.addEventListener('load', resolve, { once: true })
    img.addEventListener('error', resolve, { once: true })
    setTimeout(resolve, Math.max(0, deadline - Date.now()))
  }))))
}

/** "Panampilly Nagar, Kochi" → "Kochi": the town, for the running header. */
function place(site: string): string {
  const parts = site.split(',').map((s) => s.trim()).filter(Boolean)
  return parts[parts.length - 1] ?? ''
}

// ---------------------------------------------------------------- page frame

function Page({ children }: { children: ReactNode }) {
  return (
    <div className="quote-page relative mx-auto mb-6 overflow-hidden bg-white shadow-[0_4px_24px_rgba(0,0,0,0.12)]" style={{ width: PAGE_W, height: PAGE_H }}>
      {children}
    </div>
  )
}

/** The company mark in its three colours. */
function Mark({ size }: { size: number }) {
  return (
    <svg viewBox="40 40 320 320" width={size} height={size} aria-hidden="true">
      <g transform="translate(-85,0)">
        <path d="M125 70 Q125 40 155 40 H245 Q275 40 275 70 V190 H125 Z" fill={DARK} />
        <path d="M125 210 H275 V360 H155 Q125 360 125 330 V210 Z" fill={SAGE} />
        <path d="M295 210 H415 Q445 210 445 240 V330 Q445 360 415 360 H295 V210 Z" fill={SAND} />
      </g>
    </svg>
  )
}

function Footer({ settings }: { settings: DocumentSettings }) {
  const { company } = settings
  return (
    <>
      <div className="absolute flex items-center justify-between gap-4 border-t pt-3" style={{ left: SIDE, right: SIDE, top: 1042, borderColor: LINE }}>
        <div className="flex items-center gap-2.5">
          <Mark size={28} />
          <div className="leading-tight">
            <p className="text-[12.5px] uppercase tracking-[0.08em]" style={{ color: DARK }}>{company.name}</p>
            <p className="text-[8.5px]" style={{ color: MUTED }}>{company.tagline}</p>
          </div>
        </div>
        <p className="text-right text-[8.5px] uppercase tracking-[0.04em] text-stone-600">
          {[company.offices, company.phone, company.email].filter(Boolean).map((part, i) => (
            <span key={i}>{i > 0 && <span className="mx-2 text-stone-400">•</span>}<span className={part === company.email ? 'normal-case' : ''}>{part}</span></span>
          ))}
        </p>
      </div>
      <div className="absolute bottom-0 left-0 right-0 flex h-2">
        <span style={{ flex: 52, background: DARK }} />
        <span style={{ flex: 33, background: SAGE }} />
        <span style={{ flex: 15, background: SAND }} />
      </div>
    </>
  )
}

/** Contour lines, as on the company's stationery. Drawn, not an image, so they print crisp. */
function Contours() {
  const rings = Array.from({ length: 16 }, (_, k) => {
    const base = 26 + k * 21
    const points = Array.from({ length: 73 }, (_, i) => {
      const t = (i / 72) * Math.PI * 2
      const r = base * (1 + 0.07 * Math.sin(3 * t + k * 0.35) + 0.045 * Math.sin(5 * t + 1.2 + k * 0.1) + 0.03 * Math.cos(2 * t - k * 0.2))
      return `${(640 + r * Math.cos(t) * 1.25).toFixed(1)},${(118 + r * Math.sin(t) * 0.92).toFixed(1)}`
    })
    return `M${points.join(' L')}Z`
  })
  const flows = Array.from({ length: 7 }, (_, k) => {
    const y = 300 + k * 26
    return `M330 ${y} C 470 ${y - 60 - k * 8}, 560 ${y + 40}, 700 ${y - 30 - k * 4} S 820 ${y - 120}, 860 ${y - 200 - k * 6}`
  })
  return (
    <svg className="absolute inset-0" width={PAGE_W} height={492} viewBox={`0 0 ${PAGE_W} 492`} aria-hidden="true">
      <g fill="none" stroke="#c9c0b1" strokeWidth={0.8} opacity={0.75}>
        {rings.map((d, i) => <path key={i} d={d} />)}
        {flows.map((d, i) => <path key={`f${i}`} d={d} />)}
      </g>
    </svg>
  )
}

function Cover({ quote, project, client, settings }: { quote: Quotation; project: Project; client?: Client; settings: DocumentSettings }) {
  const paragraphs = quote.letter.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  return (
    <>
      <div className="absolute left-0 right-0 top-0 overflow-hidden" style={{ height: 492, background: CREAM }}>
        <Contours />
        <div className="absolute flex flex-col items-start" style={{ left: 72, top: 62 }}>
          <Mark size={58} />
          <p className="mt-2 text-[21px] uppercase tracking-[0.06em]" style={{ color: DARK }}>{settings.company.name}</p>
        </div>
        <div className="absolute" style={{ left: 82, top: 268 }}>
          <span className="block h-[3px] w-11" style={{ background: SAND }} />
          <p className="mt-6 text-[9.5px] font-semibold uppercase tracking-[0.3em]" style={{ color: SAGE }}>Subject</p>
          <h1 className="mt-1 font-display text-[64px] font-bold leading-[1.05] tracking-tight" style={{ color: DARK }}>
            {KIND_TITLE[quote.kind]}
          </h1>
        </div>
      </div>
      <div className="absolute grid grid-cols-4 border bg-white" style={{ left: 82, right: 82, top: 458, borderColor: LINE }}>
        {[
          ['Client', client?.name ?? '—'],
          ['Date', formatDate(quote.date)],
          ['Project', project.name],
          ['Location', project.siteLocation],
        ].map(([label, value], i) => (
          <div key={label} className={`px-5 py-3.5 ${i ? 'border-l' : ''}`} style={{ borderColor: LINE }}>
            <p className="text-[8.5px] font-semibold uppercase tracking-[0.28em]" style={{ color: SAGE }}>{label}</p>
            <p className="mt-1 text-[14px] font-medium leading-snug text-stone-900">{value}</p>
          </div>
        ))}
      </div>
      <div className="absolute" style={{ left: 86, right: 110, top: 600 }}>
        <p className="font-display text-[16px] font-bold" style={{ color: DARK }}>{quote.letter.greeting}</p>
        {paragraphs.map((p, i) => <p key={i} className="mt-3.5 text-[12px] leading-[1.6] text-stone-800">{p}</p>)}
        <span className="mt-12 block h-[3px] w-11" style={{ background: SAND }} />
        <p className="mt-6 font-display text-[16px] font-bold" style={{ color: DARK }}>{quote.letter.signOff}</p>
      </div>
    </>
  )
}

// ---------------------------------------------------------------- building blocks

function PageTitle({ title, intro }: { title: string; intro?: string }) {
  return (
    <div className="pb-4">
      <span className="block h-[3px] w-11" style={{ background: SAND }} />
      <h2 className="mt-5 font-display text-[28px] font-bold leading-tight tracking-tight" style={{ color: DARK }}>{title}</h2>
      {intro && <p className="mt-1.5 max-w-[600px] text-[11.5px] leading-[1.55] text-stone-700">{intro}</p>}
    </div>
  )
}

function Band({ title, continued }: { title: string; continued?: boolean }) {
  return (
    <div className="px-6 py-3 text-[9.5px] font-bold uppercase tracking-[0.28em] text-white" style={{ background: DARK }}>
      • {title}{continued && ' · Continued'}
    </div>
  )
}

/** A table row: the cells side by side with their widths, as the PDF lays them out. */
function Row({ cells, className = '', style }: { cells: { w: number; node: ReactNode; align?: 'left' | 'right' | 'center' }[]; className?: string; style?: CSSProperties }) {
  return (
    <div className={`flex items-center border-x ${className}`} style={{ borderColor: LINE, ...style }}>
      {cells.map((c, i) => (
        <div key={i} className="min-w-0 px-2" style={{ width: `${c.w}%`, textAlign: c.align ?? 'left' }}>{c.node}</div>
      ))}
    </div>
  )
}

const th = (text: string) => <span className="text-[8px] font-semibold uppercase leading-tight tracking-[0.02em] text-stone-600">{text}</span>

function GroupRow({ label, strong }: { label: string; strong?: boolean }) {
  return (
    <div className="border-x border-b px-6 py-1" style={{ borderColor: LINE, background: strong ? '#f1ece4' : '#faf8f4' }}>
      <span className={`text-[9px] uppercase tracking-[0.3em] ${strong ? 'font-bold' : 'font-semibold'}`} style={{ color: strong ? DARK : MUTED }}>{label}</span>
    </div>
  )
}

function SubtotalRow({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex items-center justify-end gap-10 border px-6 py-3.5" style={{ borderColor: LINE, background: '#faf8f4' }}>
      <span className="text-[9px] font-semibold uppercase tracking-[0.3em] text-stone-600">{label}</span>
      <span className="min-w-[120px] text-right text-[13px] font-bold tabular-nums text-stone-900">{formatRupees(amount)}</span>
    </div>
  )
}

function Thumb({ src, alt }: { src?: string; alt: string }) {
  if (!src) {
    return <span className="flex h-[38px] w-[38px] items-center justify-center bg-[#eef1ea]" style={{ color: SAGE }}><Icon name="leaf" className="h-4 w-4" /></span>
  }
  return <img src={src} alt={alt} className="h-[38px] w-[38px] object-cover" />
}

/** A stored picture (a plan, an item photo): signed on demand; a placeholder holds its place meanwhile. */
function StoredPicture({ src, alt, className, style }: { src: string; alt: string; className?: string; style?: CSSProperties }) {
  const url = useFileUrl(src)
  if (!url) return <span data-loading="" className={`block bg-stone-100 ${className ?? ''}`} style={style} />
  return <img src={url} alt={alt} className={className} style={style} />
}

// ---------------------------------------------------------------- the document, block by block

function buildBlocks(quote: Quotation, project: Project, settings: DocumentSettings): Block[] {
  const blocks: Block[] = []
  const priced = isPriced(quote.kind)
  const plans = showsPlans(quote.kind, project.services)
  const totals = quoteTotals(quote)
  let firstTable = true
  const titleFor = () => {
    const intro = firstTable ? quote.intro : undefined
    firstTable = false
    return <PageTitle title="Bill of Quantities" intro={intro} />
  }
  const again = <PageTitle title="Bill of Quantities" />

  // ---- plants
  const lines = quote.plants?.lines ?? []
  if (shows(quote, 'plants') && lines.length) {
    const cols = priced ? [7, 9, 30, 11, 10, 8, 11, 14] : [8, 10, 40, 14, 14, 14]
    const head = (
      <Row
        className="border-b py-2.5" style={{ background: CREAM }}
        cells={[
          { w: cols[0], node: th('Sl. No.') }, { w: cols[1], node: th('Image') }, { w: cols[2], node: th('Plant name / botanical name') },
          { w: cols[3], node: th('Height / size (ft)'), align: 'center' }, { w: cols[4], node: th('Quantity'), align: 'center' }, { w: cols[5], node: th('Unit'), align: 'center' },
          ...(priced ? [{ w: cols[6], node: th('Rate'), align: 'center' as const }, { w: cols[7], node: th('Amount'), align: 'right' as const }] : []),
        ]}
      />
    )
    const carry = (category?: string) => <>{again}<Band title="Plants" continued />{head}{category && <GroupRow label={`${category} · Continued`} />}</>
    blocks.push({ key: 'plants-title', node: titleFor(), breakBefore: true, keepWithNext: true })
    blocks.push({ key: 'plants-band', node: <Band title="Plants" />, keepWithNext: true })
    blocks.push({ key: 'plants-head', node: head, keepWithNext: true })
    let serial = 0
    for (const [category, group] of groupPlants(lines)) {
      blocks.push({ key: `pc-${category}`, node: <GroupRow label={`${category} · ${group.length}`} />, keepWithNext: true, carry: carry() })
      for (const line of group) {
        serial += 1
        blocks.push({ key: `pl-${serial}`, node: <PlantRow line={line} serial={serial} cols={cols} priced={priced} />, carry: carry(category) })
      }
    }
    if (priced) blocks.push({ key: 'plants-total', node: <SubtotalRow label="Plants subtotal" amount={totals.plants} />, carry: <>{again}<Band title="Plants" continued /></> })
  }

  // ---- hardscape, area by area
  const areas = quote.areas.filter((a) => a.name.trim() || a.items.length || a.planImage)
  if (shows(quote, 'hardscape') && areas.length) {
    const cols = priced ? [7, 9, 30, 10, 11, 8, 11, 14] : [8, 10, 40, 14, 14, 14]
    const head = (
      <Row
        className="border-b py-2.5" style={{ background: CREAM }}
        cells={[
          { w: cols[0], node: th('Sl. No.') }, { w: cols[1], node: th('Image') }, { w: cols[2], node: th('Stone / item description') },
          { w: cols[3], node: th('Size'), align: 'center' }, { w: cols[4], node: th('Quantity'), align: 'center' }, { w: cols[5], node: th('Unit'), align: 'center' },
          ...(priced ? [{ w: cols[6], node: th('Rate'), align: 'center' as const }, { w: cols[7], node: th('Amount'), align: 'right' as const }] : []),
        ]}
      />
    )
    blocks.push({ key: 'hs-title', node: titleFor(), breakBefore: true, keepWithNext: true })
    blocks.push({ key: 'hs-band', node: <Band title="Hardscape" />, keepWithNext: true })
    areas.forEach((area, a) => {
      const name = area.name.trim() || `Area ${a + 1}`
      const heading = `${name} · ${area.items.length} item${area.items.length === 1 ? '' : 's'}`
      const carry = <>{again}<Band title="Hardscape" continued /><GroupRow label={`${name} · Continued`} strong />{head}</>
      blocks.push({ key: `ar-${area.id}`, node: <GroupRow label={heading} strong />, keepWithNext: true, carry: <>{again}<Band title="Hardscape" continued /></> })
      if (plans && area.planImage) {
        blocks.push({
          key: `plan-${area.id}`, keepWithNext: true,
          node: (
            <div className="border-x border-b p-3" style={{ borderColor: LINE }}>
              <div className="flex items-center justify-center" style={{ height: 330, background: '#fbfaf7' }}>
                <StoredPicture src={area.planImage} alt={`Plan of ${name}`} className="max-h-full max-w-full object-contain" style={{ height: 330, width: '100%' }} />
              </div>
              <p className="mt-1.5 text-[8.5px] uppercase tracking-[0.24em] text-stone-500">Plan · {name}</p>
            </div>
          ),
        })
      }
      if (area.items.length) {
        blocks.push({ key: `ah-${area.id}`, node: head, keepWithNext: true })
        area.items.forEach((item, i) => {
          blocks.push({
            key: `ai-${item.id}`, carry,
            node: (
              <Row
                className="border-b py-[3px]" style={{ minHeight: 44 }}
                cells={[
                  { w: cols[0], node: <span className="text-[11px] tabular-nums" style={{ color: SAGE }}>{i + 1}</span> },
                  { w: cols[1], node: item.image ? <StoredPicture src={item.image} alt={item.item} className="h-[38px] w-[38px] object-cover" /> : <span className="block h-[38px] w-[38px] bg-[#f3f1ec]" /> },
                  { w: cols[2], node: <span className="text-[12.5px] font-medium text-stone-900">{item.item}</span> },
                  { w: cols[3], node: <span className="text-[12px] text-stone-700">{item.dimension?.trim() || '—'}</span>, align: 'center' },
                  { w: cols[4], node: <span className="text-[12px] tabular-nums text-stone-800">{formatQty(item.quantity)}</span>, align: 'center' },
                  { w: cols[5], node: <span className="text-[12px] text-stone-700">{item.unit || '—'}</span>, align: 'center' },
                  ...(priced ? [
                    { w: cols[6], node: <span className="text-[12px] tabular-nums text-stone-800">{item.rate ? formatRupees(item.rate) : '—'}</span>, align: 'center' as const },
                    { w: cols[7], node: <span className="text-[12.5px] font-bold tabular-nums text-stone-900">{formatRupees(itemAmount(item))}</span>, align: 'right' as const },
                  ] : []),
                ]}
              />
            ),
          })
        })
      }
      if (priced && areas.length > 1 && area.items.length) {
        blocks.push({ key: `at-${area.id}`, node: <SubtotalRow label={`${name} subtotal`} amount={totals.areas[area.id] ?? 0} />, carry: <>{again}<Band title="Hardscape" continued /></> })
      }
    })
    if (priced) blocks.push({ key: 'hs-total', node: <SubtotalRow label="Hardscape subtotal" amount={totals.hardscape} />, carry: <>{again}<Band title="Hardscape" continued /></> })
  }

  // ---- project management, planting, soil preparation & logistics
  const services = quote.services.filter((l) => l.title.trim())
  if (shows(quote, 'services') && services.length) {
    const cols = priced ? [7, 49, 9, 7, 13, 15] : [10, 62, 14, 14]
    const title = quote.servicesTitle.trim() || 'Project management'
    // "Project Management, Planting, Soil Preparation & Logistics" → "Project Management" where room is short.
    const short = title.split(',')[0].trim()
    const head = (
      <Row
        className="border-b py-2.5" style={{ background: CREAM }}
        cells={[
          { w: cols[0], node: th('Sl. No.') }, { w: cols[1], node: th('Item / scope description') },
          { w: cols[2], node: th('Quantity'), align: 'center' }, { w: cols[3], node: th('Unit'), align: 'center' },
          ...(priced ? [{ w: cols[4], node: th('Rate'), align: 'right' as const }, { w: cols[5], node: th('Amount'), align: 'right' as const }] : []),
        ]}
      />
    )
    blocks.push({ key: 'sv-title', node: titleFor(), breakBefore: true, keepWithNext: true })
    blocks.push({ key: 'sv-band', node: <Band title={title} />, keepWithNext: true })
    blocks.push({ key: 'sv-head', node: head, keepWithNext: true })
    services.forEach((line, i) => {
      blocks.push({
        key: `sv-${line.id}`, carry: <>{again}<Band title={title} continued />{head}</>,
        node: (
          <Row
            className="border-b py-3"
            cells={[
              { w: cols[0], node: <span className="text-[11px] tabular-nums" style={{ color: SAGE }}>{i + 1}</span> },
              {
                w: cols[1],
                node: (
                  <div className="pr-3">
                    <p className="text-[12.5px] font-medium text-stone-900">{line.title}</p>
                    {line.description && <p className="mt-0.5 text-[9.5px] leading-[1.45] text-stone-600">{line.description}</p>}
                  </div>
                ),
              },
              { w: cols[2], node: <span className="text-[12px] tabular-nums">{formatQty(line.quantity)}</span>, align: 'center' },
              { w: cols[3], node: <span className="text-[12px] text-stone-700">{line.unit || '—'}</span>, align: 'center' },
              ...(priced ? [
                { w: cols[4], node: <span className="text-[12px] tabular-nums">{formatRupees(line.rate)}</span>, align: 'right' as const },
                { w: cols[5], node: <span className="text-[12.5px] font-bold tabular-nums text-stone-900">{formatRupees(serviceAmount(line))}</span>, align: 'right' as const },
              ] : []),
            ]}
          />
        ),
      })
    })
    if (priced) blocks.push({ key: 'sv-total', node: <SubtotalRow label={`${short} subtotal`} amount={totals.services} />, carry: <>{again}<Band title={title} continued /></> })
  }

  // ---- summary
  if (priced) {
    const rows: [string, number][] = [
      ...(shows(quote, 'plants') && lines.length ? [['Plants subtotal', totals.plants] as [string, number]] : []),
      ...(shows(quote, 'hardscape') && areas.length ? [['Hardscape subtotal', totals.hardscape] as [string, number]] : []),
      ...(shows(quote, 'services') && services.length ? [[(quote.servicesTitle.trim() || 'Project management').split(',')[0].trim(), totals.services] as [string, number]] : []),
      ['Discount', totals.discount],
    ]
    blocks.push({
      key: 'summary', breakBefore: blocks.length === 0,
      node: (
        <div className="flex items-start justify-between gap-8 pt-7">
          <div className="pt-1">
            <span className="block h-[3px] w-11" style={{ background: SAND }} />
            <h2 className="mt-5 font-display text-[22px] font-bold" style={{ color: DARK }}>Quotation Summary</h2>
          </div>
          <div className="w-[380px] border" style={{ borderColor: LINE }}>
            {rows.map(([label, amount]) => (
              <div key={label} className="flex items-center justify-between gap-4 border-b px-6 py-3" style={{ borderColor: LINE }}>
                <span className="text-[9px] font-semibold uppercase tracking-[0.3em] text-stone-600">{label}</span>
                <span className="text-[13px] font-bold tabular-nums text-stone-900">{label === 'Discount' && amount ? `− ${formatRupees(amount)}` : formatRupees(amount)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between px-6 py-4" style={{ background: DARK }}>
              <span className="text-[8.5px] font-bold uppercase tracking-[0.24em] text-[#d9cdbb]">Grand total</span>
              <span className="font-display text-[28px] font-bold tabular-nums text-white">{formatRupees(totals.total)}</span>
            </div>
          </div>
        </div>
      ),
    })
  }

  // ---- terms
  const terms = quote.terms.filter((t) => t.title.trim() || t.text.trim())
  if (shows(quote, 'terms') && terms.length) {
    blocks.push({ key: 'terms-title', node: <PageTitle title="Terms / Project-Specific Notes" />, breakBefore: true, keepWithNext: true })
    const half = Math.ceil(terms.length / 2)
    for (let i = 0; i < half; i += 1) {
      const pair = [i, i + half].filter((n) => n < terms.length)
      blocks.push({
        key: `term-${i}`, carry: <PageTitle title="Terms / Project-Specific Notes · Continued" />,
        node: (
          <div className="grid grid-cols-2 gap-8">
            {pair.map((n) => (
              <div key={n} className="flex gap-4 border-b pb-3.5 pt-0.5" style={{ borderColor: LINE, marginBottom: 10 }}>
                <span className="flex h-6 w-7 shrink-0 items-center justify-center text-[10px] font-bold tabular-nums text-stone-800" style={{ background: '#f1ece4' }}>{n + 1}</span>
                <div>
                  <p className="text-[12px] font-bold text-stone-900">{terms[n].title}</p>
                  <p className="mt-0.5 text-[9.5px] leading-[1.5] text-stone-600">{terms[n].text}</p>
                </div>
              </div>
            ))}
          </div>
        ),
      })
    }
  }

  // ---- scope and work procedure, then the payment schedule
  const steps = quote.procedure.filter((s) => s.title.trim() || s.text.trim())
  const showSteps = shows(quote, 'procedure') && steps.length > 0
  const stages = quote.paymentStages.filter((s) => s.label.trim() || s.percent)
  const showPayment = shows(quote, 'payment') && stages.length > 0
  if (showSteps) {
    blocks.push({ key: 'proc-title', node: <PageTitle title="Scope and Work Procedure" />, breakBefore: true, keepWithNext: true })
    for (let r = 0; r < steps.length; r += 3) {
      blocks.push({
        key: `proc-${r}`, carry: <PageTitle title="Scope and Work Procedure · Continued" />,
        node: (
          <div className="mb-3 grid grid-cols-3 gap-3">
            {steps.slice(r, r + 3).map((step, i) => (
              <div key={i} className="px-5 pb-5 pt-4" style={{ background: CREAM, minHeight: 124 }}>
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: DARK }}>{r + i + 1}</span>
                  <span className="flex-1 border-t border-dashed" style={{ borderColor: '#b8b2a6' }} />
                </div>
                <p className="mt-3.5 text-[12.5px] font-bold text-stone-900">{step.title}</p>
                <p className="mt-1 text-[11px] leading-[1.5] text-stone-600">{step.text}</p>
              </div>
            ))}
          </div>
        ),
      })
    }
    if (quote.procedureNote.trim()) {
      blocks.push({
        key: 'proc-note',
        node: (
          <div className="mb-2 border-l-[3px] px-7 py-4 text-[11.5px] leading-[1.55] text-stone-800" style={{ borderColor: SAND, background: '#fbfaf7' }}>
            NOTE: {quote.procedureNote}
          </div>
        ),
      })
    }
  }
  if (showPayment) {
    const sum = stages.reduce((s, x) => s + x.percent, 0) || 1
    const palette = [DARK, '#4b5d50', SAGE, '#b3bba9', SAND, '#e8e1d4']
    blocks.push({ key: 'pay-title', node: <div className={showSteps ? 'pt-6' : ''}><PageTitle title="Payment Schedule" /></div>, breakBefore: !showSteps, keepWithNext: true })
    blocks.push({
      key: 'pay-bar', keepWithNext: true,
      node: (
        <div className="mb-4 flex h-[34px] gap-[3px]">
          {stages.map((s, i) => (
            <div
              key={i} className="flex items-center justify-center text-[9px] font-bold tabular-nums"
              style={{ flex: Math.max(s.percent, 4) / sum, background: palette[i % palette.length], color: i < 3 ? '#fff' : DARK }}
            >
              {s.percent >= 10 ? `${i + 1} · ${s.percent}%` : i + 1}
            </div>
          ))}
        </div>
      ),
    })
    stages.forEach((stage, i) => {
      blocks.push({
        key: `pay-${i}`, carry: <PageTitle title="Payment Schedule · Continued" />,
        node: (
          <div className={`flex items-center border-x border-b px-6 py-3 ${i === 0 ? 'border-t' : ''}`} style={{ borderColor: LINE }}>
            <span className="w-14 text-[11px] tabular-nums" style={{ color: SAGE }}>{i + 1}</span>
            <span className="flex-1 text-[12.5px] font-medium text-stone-900"><span className="mr-2 text-[9px]" style={{ color: DARK }}>■</span>{stage.label}</span>
            <span className="w-24 text-right text-[12.5px] font-bold tabular-nums text-stone-900">{stage.percent}%</span>
            <span className="w-40 text-right text-[12.5px] font-bold tabular-nums text-stone-900">{formatRupees((totals.total * stage.percent) / 100)}</span>
          </div>
        ),
      })
    })
    blocks.push({
      key: 'pay-total',
      node: (
        <div className="flex items-center justify-end gap-10 px-6 py-4" style={{ background: DARK }}>
          <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-[#d9cdbb]">Payment schedule total</span>
          <span className="min-w-[140px] text-right text-[15px] font-bold tabular-nums text-white">
            {formatRupees((totals.total * stages.reduce((s, x) => s + x.percent, 0)) / 100)}
          </span>
        </div>
      ),
    })
  }

  // ---- work schedule, bank details, client acceptance
  const blank = <span className="inline-block w-20 border-b border-stone-500 align-baseline" />
  const schedule = quote.schedule
  const tail: Block[] = []
  if (shows(quote, 'schedule')) {
    tail.push({ key: 'ws-title', node: <PageTitle title="Work Schedule / Details" />, keepWithNext: true })
    const rows: [string, ReactNode][] = [
      ['Mobilisation', <>Within {schedule.mobilisationDays ? <strong className="font-semibold">{schedule.mobilisationDays}</strong> : blank} days from advance / work order and site clearance</>],
      ['Execution period', <>Approximately {schedule.executionDays ? <strong className="font-semibold">{schedule.executionDays}</strong> : blank} working days, subject to clear access and coordination</>],
      ['Quotation validity', schedule.validity],
      ['Maintenance period', schedule.maintenance],
      ['Billing basis', schedule.billing],
    ]
    rows.forEach(([label, value], i) => tail.push({
      key: `ws-${i}`,
      node: (
        <div className={`flex gap-6 border-b py-3.5 ${i === 0 ? 'border-t' : ''}`} style={{ borderColor: LINE }}>
          <span className="w-56 shrink-0 pt-0.5 text-[9px] font-semibold uppercase tracking-[0.3em] text-stone-700">{label}</span>
          <span className="text-[12px] leading-[1.5] text-stone-800">{value}</span>
        </div>
      ),
    }))
  }
  if (shows(quote, 'bank')) {
    const { bank } = settings
    tail.push({ key: 'bank-title', node: <div className={tail.length ? 'pt-6' : ''}><PageTitle title="Bank Details" /></div>, keepWithNext: true })
    tail.push({
      key: 'bank',
      node: (
        <div className="grid grid-cols-[1fr_0.9fr_1.4fr_1fr] px-2 py-6" style={{ background: DARK }}>
          {[['Account name', bank.accountName], ['Bank name', bank.bankName], ['Account number', bank.accountNumber], ['IFSC code', bank.ifsc]].map(([label, value]) => (
            <div key={label} className="min-w-0 px-4">
              <p className="text-[8.5px] font-semibold uppercase tracking-[0.28em] text-[#d9cdbb]">{label}</p>
              <p className="mt-1.5 whitespace-nowrap text-[14px] font-bold text-white">{value}</p>
            </div>
          ))}
        </div>
      ),
    })
  }
  if (shows(quote, 'acceptance')) {
    tail.push({ key: 'acc-title', node: <div className={tail.length ? 'pt-6' : ''}><PageTitle title="Client Acceptance" /></div>, keepWithNext: true })
    tail.push({
      key: 'acc',
      node: (
        <div className="border px-8 pb-7 pt-7" style={{ borderColor: LINE }}>
          <p className="text-[12px] leading-[1.6] text-stone-800">{settings.acceptance[quote.kind]}</p>
          <div className="mt-16 grid grid-cols-2 gap-6">
            <div className="border-t border-stone-800 pt-3 text-[9px] font-semibold uppercase tracking-[0.3em] text-stone-800">For client / authorised signatory</div>
            <div className="border-t border-stone-800 pt-3 text-[9px] font-semibold uppercase tracking-[0.3em] text-stone-800">Consultant</div>
          </div>
        </div>
      ),
    })
  }
  if (tail.length) tail[0] = { ...tail[0], breakBefore: true }
  blocks.push(...tail)

  if (blocks.length === 0) {
    blocks.push({ key: 'empty', node: <p className="pt-10 text-center text-[13px] text-stone-500">Nothing to show yet — add plants, areas or lines to the document.</p> })
  }
  return blocks
}

function PlantRow({ line, serial, cols, priced }: { line: PlantLine; serial: number; cols: number[]; priced: boolean }) {
  return (
    <Row
      className="border-b py-[3px]" style={{ minHeight: 44 }}
      cells={[
        { w: cols[0], node: <span className="text-[11px] tabular-nums" style={{ color: SAGE }}>{serial}</span> },
        { w: cols[1], node: <Thumb src={plantThumb(line.image, 140)} alt={line.name} /> },
        {
          w: cols[2],
          node: (
            <div className="pr-2">
              <p className="text-[12.5px] font-medium leading-snug text-stone-900">{line.name}</p>
              {line.botanical && <p className="text-[10px] italic leading-snug text-stone-600">{line.botanical}</p>}
            </div>
          ),
        },
        { w: cols[3], node: <span className="text-[12px] text-stone-700">{line.size || '—'}</span>, align: 'center' },
        { w: cols[4], node: <span className="text-[12px] tabular-nums text-stone-800">{formatQty(line.quantity)}</span>, align: 'center' },
        { w: cols[5], node: <span className="text-[12px] text-stone-700">{line.unit || '—'}</span>, align: 'center' },
        ...(priced ? [
          { w: cols[6], node: <span className="text-[12px] tabular-nums text-stone-800">{line.rate ? formatRupees(line.rate) : '—'}</span>, align: 'center' as const },
          { w: cols[7], node: <span className="text-[12.5px] font-bold tabular-nums text-stone-900">{formatRupees(plantAmount(line))}</span>, align: 'right' as const },
        ] : []),
      ]}
    />
  )
}
