import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { BrandLogo, BrandMark, BrandWordmark } from '../../components/Logo'
import { BRAND } from '../../components/brand'
import { formatDate } from '../../domain/format'
import type { Client, DocumentSettings, Project, Quotation } from '../../domain/types'
import { layOut, usePages, type Block } from './paginate'
import { editPath, useQuoteAccess } from './access'

/**
 * The company's printed stationery, shared by every commercial document: A4
 * pages with the running head and footer, the cover with its letter, page
 * titles and table bands. QuotePrint lays out BOQs and quotations on it,
 * ScopePrint the Scope of Services & Fee Proposal.
 */


// The page, in CSS pixels: A4 at 96 dpi.
export const PAGE_W = 794
export const PAGE_H = 1123
export const SIDE = 64
export const CONTENT_W = PAGE_W - SIDE * 2
export const CONTENT_TOP = 104
export const CONTENT_BOTTOM = 1022
export const CAPACITY = CONTENT_BOTTOM - CONTENT_TOP

// The logo's colours, with the paper tones of the company's own quotation.
export const DARK = BRAND.dark
export const SAGE = BRAND.sage
export const SAND = BRAND.sand
export const CREAM = '#f6f3ec'
export const TINT = '#faf8f3'
export const LINE = '#e6e0d5'
export const MUTED = '#7a8075'
/** Corner radius of tables and cards, after the logo's rounded blocks. */
export const RADIUS = 14

export function Message({ title }: { title: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-100 p-6">
      <div className="card-pad text-center">
        <p className="font-medium text-stone-700">{title}</p>
        <Link to="/dashboard" className="btn-secondary mt-4">Back to the CRM</Link>
      </div>
    </div>
  )
}

/**
 * A document as A4 pages: the toolbar (back, edit, print), the cover, and the
 * pages `blocks` are laid out on, each with its running head and footer.
 */
export function PrintShell({ quote, project, client, settings, title, cover, blocks }: {
  quote: Quotation; project: Project; client?: Client; settings: DocumentSettings
  /** The document's title, in the toolbar and the running head. */
  title: string
  cover: ReactNode
  blocks: Block[]
}) {
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
            <p className="truncate text-sm font-semibold text-stone-900">{quote.number} <span className="font-normal text-stone-500">· {title}</span></p>
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
          {cover}
          <Footer settings={settings} />
        </Page>
        {pages.map((placed, i) => (
          <Page key={i}>
            <RunningHead title={title} details={details} page={i + 2} total={total} />
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
export async function imagesLoaded(root: HTMLElement | null) {
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
export function place(site: string): string {
  const parts = site.split(',').map((s) => s.trim()).filter(Boolean)
  return parts[parts.length - 1] ?? ''
}

// ---------------------------------------------------------------- page frame

export function Page({ children }: { children: ReactNode }) {
  return (
    <div className="quote-page relative mx-auto mb-6 overflow-hidden bg-white shadow-[0_4px_24px_rgba(0,0,0,0.12)]" style={{ width: PAGE_W, height: PAGE_H }}>
      {children}
    </div>
  )
}

/** The outline round a table's rows on one page; its corners are the table's. */
export function Frame({ children }: { children: ReactNode }) {
  return <div className="quote-frame overflow-hidden border bg-white" style={{ borderColor: LINE, borderRadius: RADIUS }}>{children}</div>
}

export function RunningHead({ title, details, page, total }: { title: string; details: string[]; page: number; total: number }) {
  const two = (n: number) => String(n).padStart(2, '0')
  return (
    <div className="absolute flex items-center justify-between gap-6 border-b pb-2.5" style={{ left: SIDE, right: SIDE, top: 36, borderColor: LINE }}>
      <p className="min-w-0 truncate text-[9.5px] uppercase tracking-[0.06em] text-stone-500">
        <span className="font-bold" style={{ color: DARK }}>{title}</span>
        {details.map((part, i) => <span key={i}><span className="mx-1.5 text-stone-400">·</span>{part}</span>)}
      </p>
      <span className="shrink-0 rounded-full px-2.5 py-[3px] text-[9px] font-bold tabular-nums tracking-[0.08em]" style={{ background: CREAM, color: DARK }}>
        {two(page)} / {two(total)}
      </span>
    </div>
  )
}

/** The logo's three colours as a rule, with the logo's gaps and rounded ends. */
export function BrandBar() {
  const parts: [number, string][] = [[52, DARK], [33, SAGE], [15, SAND]]
  return (
    <div className="flex h-[5px] gap-[3px]">
      {parts.map(([flex, background]) => <span key={background} className="rounded-full" style={{ flex, background }} />)}
    </div>
  )
}

export function Footer({ settings }: { settings: DocumentSettings }) {
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
export function Contours({ left, top }: { left: number; top: number }) {
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
export function Accent({ className = '' }: { className?: string }) {
  return <span className={`block h-[3px] w-11 rounded-full ${className}`} style={{ background: SAND }} />
}

// The cover's panel sits inside the page, clear of the edge printers cannot reach.
export const PANEL = { inset: 24, height: 468, radius: 28 }

export function Cover({ quote, project, client, settings, title, eyebrow = 'Subject', titleSize = 64 }: {
  quote: Quotation; project: Project; client?: Client; settings: DocumentSettings
  /** The big title on the cover: "Bill of Quantities". */
  title: string
  /** The small line over it. */
  eyebrow?: string
  /** A long title is set smaller so it fits the panel. */
  titleSize?: number
}) {
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
          <p className="mt-6 text-[9.5px] font-semibold uppercase tracking-[0.3em]" style={{ color: SAGE }}>{eyebrow}</p>
          <h1 className="mt-1 max-w-[560px] font-display font-bold leading-[1.05] tracking-tight" style={{ color: DARK, fontSize: titleSize }}>
            {title}
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

export function PageTitle({ title, intro }: { title: string; intro?: string }) {
  return (
    <div className="pb-4">
      <Accent />
      <h2 className="mt-5 font-display text-[28px] font-bold leading-tight tracking-tight" style={{ color: DARK }}>{title}</h2>
      {intro && <p className="mt-1.5 max-w-[600px] text-[11.5px] leading-[1.55] text-stone-700">{intro}</p>}
    </div>
  )
}

/** A table's dark heading band, across the top of its frame. */
export function Band({ title, continued }: { title: string; continued?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 px-5 py-3 text-[9.5px] font-bold uppercase tracking-[0.28em] text-white" style={{ background: DARK }}>
      <span className="h-[7px] w-[7px] shrink-0 rounded-[2px]" style={{ background: SAND }} />
      <span>{title}{continued && <span className="font-semibold" style={{ color: SAND }}> · Continued</span>}</span>
    </div>
  )
}

