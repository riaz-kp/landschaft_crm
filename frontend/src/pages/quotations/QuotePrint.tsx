import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useDb } from '../../state/useDb'
import { usePermissions } from '../../state/permissions'
import { Icon } from '../../components/Icon'
import { BrandLogo, BrandMark, BrandWordmark } from '../../components/Logo'
import { BRAND } from '../../components/brand'
import { useFileUrl } from '../../components/StoredImage'
import { formatDate } from '../../domain/format'
import {
  KIND_TITLE, formatQty, formatRupees, gstLabel, groupPlants, isPriced, itemAmount, plantAmount, plantThumb, quoteTotals, serviceAmount,
  shows, showsPlans,
} from '../../domain/quotation'
import type { Client, CommercialDoc, DocumentSettings, PlantLine, Project, Quotation } from '../../domain/types'
import { layOut, usePages, type Block } from './paginate'
import { editPath, useQuoteAccess } from './access'
import { SpecText } from './editors'

// The page, in CSS pixels: A4 at 96 dpi.
const PAGE_W = 794
const PAGE_H = 1123
const SIDE = 64
const CONTENT_W = PAGE_W - SIDE * 2
const CONTENT_TOP = 104
const CONTENT_BOTTOM = 1022
const CAPACITY = CONTENT_BOTTOM - CONTENT_TOP

// The logo's colours, with the paper tones of the company's own quotation.
const DARK = BRAND.dark
const SAGE = BRAND.sage
const SAND = BRAND.sand
const CREAM = '#f6f3ec'
const TINT = '#faf8f3'
const LINE = '#e6e0d5'
const MUTED = '#7a8075'
/** Corner radius of tables and cards, after the logo's rounded blocks. */
const RADIUS = 14

/**
 * A BOQ or quotation as printed pages, after the company's own quotation:
 * a cover with the letter, the Bill of Quantities section by section, the
 * summary, terms, work procedure, payment schedule, work schedule, bank
 * details and the client's acceptance. Opening a document lands here; Edit
 * goes to its editor, for those who may change it. Print it, or save it as a
 * PDF, from here.
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
  const location = useLocation()
  const navigate = useNavigate()
  const { canEdit } = useQuoteAccess()
  const [printing, setPrinting] = useState(false)
  const [zoom, setZoom] = useState(1)
  const total = pages.length + 1
  const details = [quote.number, client?.name, [project.name, place(project.siteLocation)].filter(Boolean).join(', ')]
    .filter((part): part is string => Boolean(part))

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

  // Back to wherever the document was opened from; straight from a link, to the project's documents.
  const back = () => {
    if (location.key !== 'default') navigate(-1)
    else navigate(`/projects/${quote.projectId}?tab=commercial`)
  }

  const print = async () => {
    setPrinting(true)
    await imagesLoaded(sheet.current)
    setPrinting(false)
    window.print()
  }

  return (
    <div className="quote-print min-h-screen bg-stone-200/70">
      <div className="print-hidden sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[820px] items-center gap-2 px-3 py-2.5">
          <button type="button" className="btn-icon shrink-0" onClick={back} title="Back" aria-label="Back">
            <Icon name="back" className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-stone-900">{quote.number} <span className="font-normal text-stone-500">· {KIND_TITLE[quote.kind]}</span></p>
            <p className="truncate text-xs text-stone-500">{ready ? `${quote.status} · ${total} pages · A4` : 'Laying out pages…'}</p>
          </div>
          {canEdit(quote.kind) && (
            <Link to={editPath(quote)} className="btn-secondary shrink-0 py-1.5"><Icon name="edit" className="h-4 w-4" /> Edit</Link>
          )}
          <button type="button" className="btn-primary shrink-0 py-1.5" onClick={() => void print()} disabled={!ready || printing}>
            <Icon name="doc" className="h-4 w-4" />
            {printing ? 'Loading images…' : <><span className="hidden sm:inline">Print / Save as PDF</span><span className="sm:hidden">Print</span></>}
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
            <RunningHead kind={quote.kind} details={details} page={i + 2} total={total} />
            <div className="absolute" style={{ left: SIDE, top: CONTENT_TOP, width: CONTENT_W }}>
              {layOut(placed, (children, key) => <Frame key={key}>{children}</Frame>)}
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

/** The outline round a table's rows on one page; its corners are the table's. */
function Frame({ children }: { children: ReactNode }) {
  return <div className="quote-frame overflow-hidden border bg-white" style={{ borderColor: LINE, borderRadius: RADIUS }}>{children}</div>
}

function RunningHead({ kind, details, page, total }: { kind: CommercialDoc; details: string[]; page: number; total: number }) {
  const two = (n: number) => String(n).padStart(2, '0')
  return (
    <div className="absolute flex items-center justify-between gap-6 border-b pb-2.5" style={{ left: SIDE, right: SIDE, top: 36, borderColor: LINE }}>
      <p className="min-w-0 truncate text-[9.5px] uppercase tracking-[0.06em] text-stone-500">
        <span className="font-bold" style={{ color: DARK }}>{KIND_TITLE[kind]}</span>
        {details.map((part, i) => <span key={i}><span className="mx-1.5 text-stone-400">·</span>{part}</span>)}
      </p>
      <span className="shrink-0 rounded-full px-2.5 py-[3px] text-[9px] font-bold tabular-nums tracking-[0.08em]" style={{ background: CREAM, color: DARK }}>
        {two(page)} / {two(total)}
      </span>
    </div>
  )
}

/** The logo's three colours as a rule, with the logo's gaps and rounded ends. */
function BrandBar() {
  const parts: [number, string][] = [[52, DARK], [33, SAGE], [15, SAND]]
  return (
    <div className="flex h-[5px] gap-[3px]">
      {parts.map(([flex, background]) => <span key={background} className="rounded-full" style={{ flex, background }} />)}
    </div>
  )
}

function Footer({ settings }: { settings: DocumentSettings }) {
  const { company } = settings
  return (
    <div className="absolute" style={{ left: SIDE, right: SIDE, top: 1040 }}>
      <BrandBar />
      <div className="mt-3.5 flex items-center justify-between gap-4">
        <div className="flex shrink-0 items-center gap-2.5">
          <BrandMark size={26} />
          <div>
            <BrandWordmark height={9} label={company.name} className="block" />
            {company.tagline && <p className="mt-[5px] text-[8px] leading-none" style={{ color: MUTED }}>{company.tagline}</p>}
          </div>
        </div>
        <p className="text-right text-[8.5px] uppercase leading-[1.5] tracking-[0.04em] text-stone-600">
          {[company.offices, company.phone, company.email].filter(Boolean).map((part, i) => (
            <span key={i}>{i > 0 && <span className="mx-2 text-stone-400">•</span>}<span className={part === company.email ? 'normal-case' : ''}>{part}</span></span>
          ))}
        </p>
      </div>
    </div>
  )
}

/**
 * A few contour lines in the cover's top corner, after the company's stationery,
 * kept sparse and faint. Drawn, not an image, so they print crisp.
 */
function Contours({ left, top }: { left: number; top: number }) {
  const rings = Array.from({ length: 6 }, (_, k) => {
    const base = 34 + k * 30
    const points = Array.from({ length: 73 }, (_, i) => {
      const t = (i / 72) * Math.PI * 2
      const r = base * (1 + 0.06 * Math.sin(3 * t + k * 0.35) + 0.035 * Math.sin(5 * t + 1.2 + k * 0.1))
      return `${(690 + r * Math.cos(t) * 1.2).toFixed(1)},${(96 + r * Math.sin(t) * 0.9).toFixed(1)}`
    })
    return `M${points.join(' L')}Z`
  })
  return (
    <svg className="absolute" style={{ left, top }} width={PAGE_W} height={492} viewBox={`0 0 ${PAGE_W} 492`} aria-hidden="true">
      <g fill="none" stroke="#cdc3b2" strokeWidth={0.75} opacity={0.7}>
        {rings.map((d, i) => <path key={i} d={d} />)}
      </g>
    </svg>
  )
}

/** The short rounded rule over headings. */
function Accent({ className = '' }: { className?: string }) {
  return <span className={`block h-[3px] w-11 rounded-full ${className}`} style={{ background: SAND }} />
}

// The cover's panel sits inside the page, clear of the edge printers cannot reach.
const PANEL = { inset: 24, height: 468, radius: 28 }

function Cover({ quote, project, client, settings }: { quote: Quotation; project: Project; client?: Client; settings: DocumentSettings }) {
  const paragraphs = quote.letter.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  const { inset } = PANEL
  return (
    <>
      <div className="absolute overflow-hidden" style={{ left: inset, right: inset, top: inset, height: PANEL.height, background: CREAM, borderRadius: PANEL.radius }}>
        <Contours left={-inset} top={-inset} />
        <div className="absolute" style={{ left: 72 - inset, top: 64 - inset }}>
          <BrandLogo width={164} label={settings.company.name} className="block" />
        </div>
        {quote.number && (
          <span
            className="absolute rounded-full bg-white px-3.5 py-1.5 text-[9px] font-bold uppercase tabular-nums tracking-[0.18em]"
            style={{ right: 72 - inset, top: 68 - inset, color: DARK }}
          >
            {quote.number}
          </span>
        )}
        <div className="absolute" style={{ left: 82 - inset, top: 268 - inset }}>
          <Accent />
          <p className="mt-6 text-[9.5px] font-semibold uppercase tracking-[0.3em]" style={{ color: SAGE }}>Subject</p>
          <h1 className="mt-1 font-display text-[64px] font-bold leading-[1.05] tracking-tight" style={{ color: DARK }}>
            {KIND_TITLE[quote.kind]}
          </h1>
        </div>
      </div>
      {/* The date takes only its own width, leaving the room to names and places like "Kowdiar, Thiruvananthapuram". */}
      <div
        className="absolute grid overflow-hidden border bg-white"
        style={{ left: 82, right: 82, top: 458, borderColor: LINE, borderRadius: RADIUS, gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1.15fr) minmax(0, 1.3fr)' }}
      >
        {[
          ['Client', client?.name ?? '—'],
          ['Date', formatDate(quote.date)],
          ['Project', project.name],
          ['Location', project.siteLocation],
        ].map(([label, value], i) => (
          <div key={label} className={`px-5 py-3.5 ${i ? 'border-l' : ''}`} style={{ borderColor: LINE }}>
            <p className="text-[8.5px] font-semibold uppercase tracking-[0.28em]" style={{ color: SAGE }}>{label}</p>
            <p className="mt-1 break-words text-[14px] font-medium leading-snug text-stone-900">{value}</p>
          </div>
        ))}
      </div>
      <div className="absolute" style={{ left: 86, right: 110, top: 600 }}>
        <p className="font-display text-[16px] font-bold" style={{ color: DARK }}>{quote.letter.greeting}</p>
        {paragraphs.map((p, i) => <p key={i} className="mt-3.5 text-[12px] leading-[1.6] text-stone-800">{p}</p>)}
        <Accent className="mt-12" />
        <p className="mt-6 font-display text-[16px] font-bold" style={{ color: DARK }}>{quote.letter.signOff}</p>
      </div>
    </>
  )
}

// ---------------------------------------------------------------- building blocks

function PageTitle({ title, intro }: { title: string; intro?: string }) {
  return (
    <div className="pb-4">
      <Accent />
      <h2 className="mt-5 font-display text-[28px] font-bold leading-tight tracking-tight" style={{ color: DARK }}>{title}</h2>
      {intro && <p className="mt-1.5 max-w-[600px] text-[11.5px] leading-[1.55] text-stone-700">{intro}</p>}
    </div>
  )
}

/** A table's dark heading band, across the top of its frame. */
function Band({ title, continued }: { title: string; continued?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 px-5 py-3 text-[9.5px] font-bold uppercase tracking-[0.28em] text-white" style={{ background: DARK }}>
      <span className="h-[7px] w-[7px] shrink-0 rounded-[2px]" style={{ background: SAND }} />
      <span>{title}{continued && <span className="font-semibold" style={{ color: SAND }}> · Continued</span>}</span>
    </div>
  )
}

/** A table row: the cells side by side with their widths, as the PDF lays them out. */
function Row({ cells, className = '', style }: { cells: { w: number; node: ReactNode; align?: 'left' | 'right' | 'center' }[]; className?: string; style?: CSSProperties }) {
  return (
    <div className={`flex items-center px-3 ${className}`} style={{ borderColor: LINE, ...style }}>
      {cells.map((c, i) => (
        <div key={i} className="min-w-0 px-2" style={{ width: `${c.w}%`, textAlign: c.align ?? 'left' }}>{c.node}</div>
      ))}
    </div>
  )
}

const th = (text: string) => <span className="text-[8px] font-semibold uppercase leading-tight tracking-[0.02em] text-stone-600">{text}</span>

/** A plant category or a hardscape area within a table, with how many lines it has. */
function GroupRow({ label, count, continued, strong }: { label: string; count?: string; continued?: boolean; strong?: boolean }) {
  return (
    <div className="flex items-center gap-2 border-b px-5 py-[5px]" style={{ borderColor: LINE, background: strong ? '#f3eee5' : TINT }}>
      <span className={`text-[9px] uppercase tracking-[0.26em] ${strong ? 'font-bold' : 'font-semibold'}`} style={{ color: strong ? DARK : MUTED }}>{label}</span>
      {count && (
        <span className="rounded-full px-[7px] py-px text-[8px] font-bold uppercase tabular-nums tracking-[0.08em]" style={{ background: strong ? SAND : '#ece6da', color: DARK }}>
          {count}
        </span>
      )}
      {continued && <span className="text-[8.5px] uppercase tracking-[0.22em]" style={{ color: MUTED }}>· Continued</span>}
    </div>
  )
}

function SubtotalRow({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex items-center justify-end gap-10 border-b px-5 py-3.5" style={{ borderColor: LINE, background: CREAM }}>
      <span className="text-[9px] font-semibold uppercase tracking-[0.3em] text-stone-600">{label}</span>
      <span className="min-w-[120px] text-right text-[13px] font-bold tabular-nums text-stone-900">{formatRupees(amount)}</span>
    </div>
  )
}

const THUMB = 'h-[38px] w-[38px] rounded-[8px]'
/** A hardscape item set out with its specification has room for a bigger photo of the stone. */
const THUMB_LARGE = 'h-[60px] w-[60px] rounded-[8px]'

function Thumb({ src, alt }: { src?: string; alt: string }) {
  if (!src) {
    return <span className={`flex items-center justify-center ${THUMB}`} style={{ background: '#eef1ea', color: SAGE }}><Icon name="leaf" className="h-4 w-4" /></span>
  }
  return <img src={src} alt={alt} className={`object-cover ${THUMB}`} />
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
    const frame = 'plants'
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
    const band = <Band title="Plants" continued />
    blocks.push({ key: 'plants-title', node: titleFor(), breakBefore: true, keepWithNext: true })
    blocks.push({ key: 'plants-band', node: <Band title="Plants" />, frame, keepWithNext: true })
    blocks.push({ key: 'plants-head', node: head, frame, keepWithNext: true })
    let serial = 0
    for (const [category, group] of groupPlants(lines)) {
      blocks.push({
        key: `pc-${category}`, node: <GroupRow label={category} count={String(group.length)} />, frame, keepWithNext: true,
        carry: again, carryHead: <>{band}{head}</>,
      })
      for (const line of group) {
        serial += 1
        blocks.push({
          key: `pl-${serial}`, node: <PlantRow line={line} serial={serial} cols={cols} priced={priced} />, frame,
          carry: again, carryHead: <>{band}{head}<GroupRow label={category} continued /></>,
        })
      }
    }
    if (priced) blocks.push({ key: 'plants-total', node: <SubtotalRow label="Plants subtotal" amount={totals.plants} />, frame, carry: again, carryHead: band })
  }

  // ---- hardscape, area by area
  const areas = quote.areas.filter((a) => a.name.trim() || a.items.length || a.planImage)
  if (shows(quote, 'hardscape') && areas.length) {
    const frame = 'hardscape'
    // The description column is the widest: an item can carry its whole specification.
    const cols = priced ? [7, 10, 32, 10, 8, 7, 12, 14] : [8, 11, 45, 12, 12, 12]
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
    const band = <Band title="Hardscape" continued />
    blocks.push({ key: 'hs-title', node: titleFor(), breakBefore: true, keepWithNext: true })
    blocks.push({ key: 'hs-band', node: <Band title="Hardscape" />, frame, keepWithNext: true })
    areas.forEach((area, a) => {
      const name = area.name.trim() || `Area ${a + 1}`
      const count = `${area.items.length} item${area.items.length === 1 ? '' : 's'}`
      blocks.push({ key: `ar-${area.id}`, node: <GroupRow label={name} count={count} strong />, frame, keepWithNext: true, carry: again, carryHead: band })
      if (plans && area.planImage) {
        blocks.push({
          key: `plan-${area.id}`, frame, keepWithNext: true,
          node: (
            <div className="border-b p-3" style={{ borderColor: LINE }}>
              <div className="flex items-center justify-center overflow-hidden rounded-[10px]" style={{ height: 330, background: TINT }}>
                <StoredPicture src={area.planImage} alt={`Plan of ${name}`} className="max-h-full max-w-full object-contain" style={{ height: 330, width: '100%' }} />
              </div>
              <p className="mt-2 text-[8.5px] uppercase tracking-[0.24em] text-stone-500">Plan · {name}</p>
            </div>
          ),
        })
      }
      if (area.items.length) {
        blocks.push({ key: `ah-${area.id}`, node: head, frame, keepWithNext: true })
        area.items.forEach((item, i) => {
          blocks.push({
            key: `ai-${item.id}`, frame, carry: again, carryHead: <>{band}<GroupRow label={name} continued strong />{head}</>,
            node: (
              <Row
                className="border-b py-[3px]" style={{ minHeight: 44 }}
                cells={[
                  { w: cols[0], node: <span className="text-[11px] tabular-nums" style={{ color: SAGE }}>{i + 1}</span> },
                  {
                    w: cols[1],
                    node: item.image
                      ? <StoredPicture src={item.image} alt={item.item} className={`object-cover ${item.specification?.trim() ? THUMB_LARGE : THUMB}`} />
                      : <span className={`block ${THUMB}`} style={{ background: '#f3f1ec' }} />,
                  },
                  {
                    w: cols[2],
                    node: (
                      <div className="py-1">
                        <p className="text-[12.5px] font-medium text-stone-900">{item.item}</p>
                        <SpecText spec={item.specification} className="mt-0.5 text-[10px] leading-[1.45] text-stone-600" headingClassName="text-[8px] text-stone-400" />
                      </div>
                    ),
                  },
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
        blocks.push({ key: `at-${area.id}`, node: <SubtotalRow label={`${name} subtotal`} amount={totals.areas[area.id] ?? 0} />, frame, carry: again, carryHead: band })
      }
    })
    if (priced) blocks.push({ key: 'hs-total', node: <SubtotalRow label="Hardscape subtotal" amount={totals.hardscape} />, frame, carry: again, carryHead: band })
  }

  // ---- project management, planting, soil preparation & logistics
  const services = quote.services.filter((l) => l.title.trim())
  if (shows(quote, 'services') && services.length) {
    const frame = 'services'
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
    const band = <Band title={title} continued />
    blocks.push({ key: 'sv-title', node: titleFor(), breakBefore: true, keepWithNext: true })
    blocks.push({ key: 'sv-band', node: <Band title={title} />, frame, keepWithNext: true })
    blocks.push({ key: 'sv-head', node: head, frame, keepWithNext: true })
    services.forEach((line, i) => {
      blocks.push({
        key: `sv-${line.id}`, frame, carry: again, carryHead: <>{band}{head}</>,
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
    if (priced) blocks.push({ key: 'sv-total', node: <SubtotalRow label={`${short} subtotal`} amount={totals.services} />, frame, carry: again, carryHead: band })
  }

  // ---- summary
  if (priced) {
    const rows: [string, number][] = [
      ...(shows(quote, 'plants') && lines.length ? [['Plants subtotal', totals.plants] as [string, number]] : []),
      ...(shows(quote, 'hardscape') && areas.length ? [['Hardscape subtotal', totals.hardscape] as [string, number]] : []),
      ...(shows(quote, 'services') && services.length ? [[(quote.servicesTitle.trim() || 'Project management').split(',')[0].trim(), totals.services] as [string, number]] : []),
      ['Discount', totals.discount],
      ...(totals.gstRate !== undefined ? [['Taxable value', totals.taxable], [gstLabel(totals.gstRate), totals.gst]] as [string, number][] : []),
    ]
    blocks.push({
      key: 'summary', breakBefore: blocks.length === 0,
      node: (
        <div className="flex items-start justify-between gap-8 pt-7">
          <div className="pt-1">
            <Accent />
            <h2 className="mt-5 font-display text-[22px] font-bold" style={{ color: DARK }}>Quotation Summary</h2>
          </div>
          <div className="w-[380px] overflow-hidden border" style={{ borderColor: LINE, borderRadius: RADIUS }}>
            {rows.map(([label, amount]) => (
              <div key={label} className="flex items-center justify-between gap-4 border-b px-6 py-3" style={{ borderColor: LINE }}>
                <span className="text-[9px] font-semibold uppercase tracking-[0.3em] text-stone-600">{label}</span>
                <span className="text-[13px] font-bold tabular-nums text-stone-900">{label === 'Discount' && amount ? `− ${formatRupees(amount)}` : formatRupees(amount)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between px-6 py-4" style={{ background: DARK }}>
              <span className="text-[8.5px] font-bold uppercase tracking-[0.24em]" style={{ color: SAND }}>Grand total</span>
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
              <div key={n} className="flex gap-3.5 border-b pb-3.5 pt-0.5" style={{ borderColor: LINE, marginBottom: 10 }}>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums" style={{ background: '#f1ece4', color: DARK }}>{n + 1}</span>
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
              <div key={i} className="px-5 pb-5 pt-4" style={{ background: CREAM, minHeight: 124, borderRadius: RADIUS }}>
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
          <div className="mb-2 flex items-start gap-3 px-6 py-4 text-[11.5px] leading-[1.55] text-stone-800" style={{ background: '#f4efe6', borderRadius: RADIUS }}>
            <span className="mt-px shrink-0 rounded-full px-2 py-[3px] text-[8.5px] font-bold uppercase leading-none tracking-[0.2em]" style={{ background: SAND, color: DARK }}>Note</span>
            <span>{quote.procedureNote}</span>
          </div>
        ),
      })
    }
  }
  if (showPayment) {
    const frame = 'payment'
    const sum = stages.reduce((s, x) => s + x.percent, 0) || 1
    const palette = [DARK, '#4c644d', SAGE, '#a9ad95', SAND, '#e9e1d4']
    const cells = (a: ReactNode, b: ReactNode, c: ReactNode, d: ReactNode) => (
      <>
        <span className="w-14 shrink-0">{a}</span>
        <span className="min-w-0 flex-1">{b}</span>
        <span className="w-24 shrink-0 text-right">{c}</span>
        <span className="w-40 shrink-0 text-right">{d}</span>
      </>
    )
    const head = (
      <div className="flex items-center border-b px-5 py-2.5" style={{ borderColor: LINE, background: CREAM }}>
        {cells(th('Stage'), th('Milestone'), th('Share'), th('Amount'))}
      </div>
    )
    blocks.push({ key: 'pay-title', node: <PageTitle title="Payment Schedule" />, breakBefore: true, keepWithNext: true })
    blocks.push({
      key: 'pay-bar', keepWithNext: true,
      node: (
        <div className="mb-4 flex h-[34px] gap-[3px]">
          {stages.map((s, i) => (
            <div
              key={i} className="flex items-center justify-center rounded-[8px] text-[9px] font-bold tabular-nums"
              style={{ flex: Math.max(s.percent, 4) / sum, background: palette[i % palette.length], color: i < 3 ? '#fff' : DARK }}
            >
              {s.percent >= 10 ? `${i + 1} · ${s.percent}%` : i + 1}
            </div>
          ))}
        </div>
      ),
    })
    blocks.push({ key: 'pay-head', node: head, frame, keepWithNext: true })
    const carry = <PageTitle title="Payment Schedule · Continued" />
    stages.forEach((stage, i) => {
      blocks.push({
        // The last stage stays on the total's page, so the total never stands alone.
        key: `pay-${i}`, frame, carry, carryHead: head, keepWithNext: i === stages.length - 1,
        node: (
          <div className="flex items-center border-b px-5 py-3" style={{ borderColor: LINE }}>
            {cells(
              <span className="text-[11px] tabular-nums" style={{ color: SAGE }}>{i + 1}</span>,
              <span className="flex items-center gap-2.5 text-[12.5px] font-medium text-stone-900">
                <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: palette[i % palette.length], boxShadow: `inset 0 0 0 1px ${i >= 4 ? '#d3c9b8' : 'transparent'}` }} />
                {stage.label}
              </span>,
              <span className="text-[12.5px] font-bold tabular-nums text-stone-900">{stage.percent}%</span>,
              <span className="text-[12.5px] font-bold tabular-nums text-stone-900">{formatRupees((totals.total * stage.percent) / 100)}</span>,
            )}
          </div>
        ),
      })
    })
    blocks.push({
      key: 'pay-total', frame, carry, carryHead: head,
      node: (
        <div className="flex items-center justify-end gap-10 px-5 py-4" style={{ background: DARK }}>
          <span className="text-[9px] font-bold uppercase tracking-[0.3em]" style={{ color: SAND }}>Payment schedule total</span>
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
      key: `ws-${i}`, frame: 'schedule', keepWithNext: i === 0,
      node: (
        <div className="flex border-b" style={{ borderColor: LINE }}>
          <span className="w-56 shrink-0 px-5 pb-3.5 pt-4 text-[9px] font-semibold uppercase tracking-[0.3em] text-stone-700" style={{ background: TINT }}>{label}</span>
          <span className="px-5 py-3.5 text-[12px] leading-[1.5] text-stone-800">{value}</span>
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
  }
  if (shows(quote, 'acceptance')) {
    tail.push({ key: 'acc-title', node: <div className={tail.length ? 'pt-6' : ''}><PageTitle title="Client Acceptance" /></div>, keepWithNext: true })
    tail.push({
      key: 'acc',
      node: (
        <div className="border px-8 pb-7 pt-7" style={{ borderColor: LINE, borderRadius: RADIUS }}>
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
