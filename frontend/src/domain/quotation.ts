import { defaultDocumentSettings } from './documentDefaults'
import type {
  AreaItem, CommercialDoc, ID, PlantLine, Project, Quotation, QuotationStatus, QuoteArea, QuoteSection, ServiceLine, Settings,
} from './types'

/**
 * BOQs and quotations, following the company's rules for each kind of project:
 *
 *   Design only         → BOQ          item, dimension, quantity, unit, plan image
 *   Design + Execution  → BOQ          item, dimension, quantity, unit, plan image
 *                       → Quotation    the same, with rate and amount
 *   Execution only      → Quotation    item, dimension, quantity, unit, rate, amount — no plan image
 *
 * A BOQ is quantities and specifications; a quotation is the BOQ priced. Each
 * area of the site has its own heading and plan, followed by its items.
 */

export const KIND_TITLE: Record<CommercialDoc, string> = { BOQ: 'Bill of Quantities', Quotation: 'Quotation' }

export const QUOTE_STATUSES: QuotationStatus[] = ['Draft', 'Sent', 'Accepted', 'Rejected']

/** Only a quotation carries rates, amounts, a summary and a payment schedule. */
export const isPriced = (kind: CommercialDoc) => kind === 'Quotation'

/** Plan images: always on a BOQ; on a quotation only when the project has design (execution-only quotations have none). */
export function showsPlans(kind: CommercialDoc, services: Project['services']): boolean {
  return kind === 'BOQ' || Boolean(services.design)
}

/** The parts a BOQ never carries, because they are about money. */
const PRICED_ONLY: QuoteSection[] = ['payment', 'bank']

export function sectionApplies(kind: CommercialDoc, section: QuoteSection): boolean {
  return isPriced(kind) || !PRICED_ONLY.includes(section)
}

/** Whether a document shows a section: switched on, and one its kind can carry. */
export function shows(quote: Pick<Quotation, 'kind' | 'sections'>, section: QuoteSection): boolean {
  return quote.sections[section] && sectionApplies(quote.kind, section)
}

export const SECTION_LABELS: Record<QuoteSection, string> = {
  plants: 'Plants',
  hardscape: 'Hardscape',
  services: 'Project management',
  terms: 'Terms & notes',
  procedure: 'Scope & work procedure',
  payment: 'Payment schedule',
  schedule: 'Work schedule',
  bank: 'Bank details',
  acceptance: 'Client acceptance',
}

/** What a new document carries. A BOQ is the quantities and the plans; a quotation everything. AMC-only work has no plants or hardscape. */
export function defaultSections(kind: CommercialDoc, services: Project['services']): Record<QuoteSection, boolean> {
  if (kind === 'BOQ') {
    return { plants: true, hardscape: true, services: false, terms: false, procedure: false, payment: false, schedule: false, bank: false, acceptance: false }
  }
  const siteWork = services.design || services.execution
  return { plants: siteWork, hardscape: siteWork, services: true, terms: true, procedure: true, payment: true, schedule: true, bank: true, acceptance: true }
}

/** One line under the document's heading on the project page: what it holds, by the rules above. */
export function kindRule(kind: CommercialDoc, services: Project['services']): string {
  if (kind === 'BOQ') return 'Area by area: plan image, then each item with its dimension, quantity and unit. No prices.'
  return showsPlans(kind, services)
    ? 'The BOQ priced: plan image per area, each item with its dimension, quantity, unit, rate and amount.'
    : 'Each item with its dimension, quantity, unit, rate and amount. No plan images on execution-only work.'
}

// ---------------------------------------------------------------- new documents

export const lineId = (prefix: string): ID => `${prefix}${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`

export interface NewQuoteInput {
  kind: CommercialDoc
  project: Project
  settings: Settings
  date: string
  by: ID
  /** Start from another document — a quotation from the project's BOQ, or a copy. */
  from?: Quotation
}

/** Everything a new document starts with, from the company defaults in Settings. */
export function newQuotation({ kind, project, settings, date, by, from }: NewQuoteInput): Omit<Quotation, 'id' | 'number'> {
  const defaults = settings.documents
  const base: Omit<Quotation, 'id' | 'number'> = {
    kind,
    projectId: project.id,
    clientId: project.clientId,
    date,
    status: 'Draft',
    letter: { ...defaults.letters[kind] },
    intro: defaults.intros[kind],
    sections: defaultSections(kind, project.services),
    areas: [],
    servicesTitle: defaults.servicesTitle,
    services: defaults.services.map((line) => ({ ...line, id: lineId('sl') })),
    discount: 0,
    terms: defaults.terms.map((t) => ({ ...t })),
    procedure: defaults.procedure.map((t) => ({ ...t })),
    procedureNote: defaults.procedureNote,
    paymentStages: defaults.paymentStages.map((s) => ({ ...s })),
    schedule: { ...defaults.schedule },
    createdBy: by,
  }
  if (!from) return base
  if (from.kind === kind) {
    // A copy: everything as it was, as a new draft.
    const { id: _id, number: _number, status: _status, createdBy: _by, items: _items, ...rest } = structuredClone(from)
    return { ...rest, date, status: 'Draft', createdBy: by }
  }
  // A quotation from the BOQ: the same plants, areas, plans and quantities, ready for rates.
  const plans = showsPlans(kind, project.services)
  return {
    ...base,
    plants: from.plants && structuredClone(from.plants),
    sections: { ...base.sections, plants: from.sections.plants, hardscape: from.sections.hardscape },
    areas: from.areas.map((area) => ({
      ...structuredClone(area),
      id: lineId('ar'),
      planImage: plans ? area.planImage : undefined,
      items: area.items.map((item) => ({ ...item, id: lineId('ai') })),
    })),
  }
}

export const blankArea = (name = ''): QuoteArea => ({ id: lineId('ar'), name, items: [] })

export const blankAreaItem = (): AreaItem => ({ id: lineId('ai'), item: '', quantity: 0, unit: 'Sqft' })

export const blankService = (): ServiceLine => ({ id: lineId('sl'), title: '', quantity: 1, unit: 'LS', rate: 0 })

// ---------------------------------------------------------------- stored records

/**
 * A document as stored, filled out to the current shape. Documents from before
 * sections existed held a flat list of lines; those are read as management
 * lines so nothing they said is lost.
 */
export function normalizeQuotation(raw: Partial<Quotation> & Pick<Quotation, 'id' | 'kind' | 'number' | 'projectId' | 'clientId'>): Quotation {
  const kind = raw.kind
  const defaults = defaultDocumentSettings()
  const legacy = !raw.areas && !raw.services && Array.isArray(raw.items)
  const services: ServiceLine[] = raw.services
    ?? (raw.items ?? []).map((item, i) => ({
      id: `${raw.id}-l${i}`, title: item.description, quantity: item.quantity, unit: item.unit, rate: item.rate,
    }))
  const sectionDefaults = defaultSections(kind, { design: kind === 'BOQ', execution: kind === 'Quotation' })
  return {
    ...raw,
    kind,
    date: raw.date ?? '',
    status: raw.status ?? 'Draft',
    letter: raw.letter ?? { ...defaults.letters[kind] },
    intro: raw.intro ?? defaults.intros[kind],
    sections: {
      ...sectionDefaults,
      ...(legacy ? { plants: false, hardscape: false, services: true, terms: false, procedure: false, schedule: false, acceptance: false } : {}),
      ...raw.sections,
    },
    areas: raw.areas ?? [],
    servicesTitle: raw.servicesTitle ?? defaults.servicesTitle,
    services,
    discount: raw.discount ?? 0,
    terms: raw.terms ?? [],
    procedure: raw.procedure ?? [],
    procedureNote: raw.procedureNote ?? '',
    paymentStages: raw.paymentStages ?? defaults.paymentStages.map((s) => ({ ...s })),
    schedule: raw.schedule ?? { ...defaults.schedule },
  }
}

/** True for a record in the shape documents had before sections. */
export const isLegacyQuotation = (raw: Partial<Quotation>) => !raw.areas && !raw.services && Array.isArray(raw.items)

// ---------------------------------------------------------------- item specifications

export interface SpecLine {
  text: string
  /** "Material specification", "Laying method" and the like, on a line of their own. */
  heading: boolean
}

const SPEC_HEADING = /^(material specification|specification|laying method|method of laying|notes?)\s*:?$/i

/** A specification as the lines it is printed in, blank lines left out. */
export function specLines(spec: string | undefined): SpecLine[] {
  return (spec ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text) => {
      const heading = SPEC_HEADING.test(text)
      return { text: heading ? text.replace(/\s*:$/, '') : text, heading }
    })
}

// ---------------------------------------------------------------- money

export const plantAmount = (line: PlantLine) => (line.quantity ?? 0) * (line.rate ?? 0)
export const itemAmount = (item: AreaItem) => item.quantity * (item.rate ?? 0)
export const serviceAmount = (line: ServiceLine) => line.quantity * line.rate

export interface QuoteTotals {
  plants: number
  hardscape: number
  /** Each area's subtotal, by area id. */
  areas: Record<string, number>
  services: number
  subtotal: number
  discount: number
  total: number
}

/** The sums a quotation shows. Sections switched off count for nothing. */
export function quoteTotals(quote: Quotation): QuoteTotals {
  const areas = Object.fromEntries(quote.areas.map((area) => [area.id, area.items.reduce((s, item) => s + itemAmount(item), 0)]))
  const plants = shows(quote, 'plants') ? (quote.plants?.lines ?? []).reduce((s, line) => s + plantAmount(line), 0) : 0
  const hardscape = shows(quote, 'hardscape') ? Object.values(areas).reduce((s, v) => s + v, 0) : 0
  const services = shows(quote, 'services') ? quote.services.reduce((s, line) => s + serviceAmount(line), 0) : 0
  const subtotal = plants + hardscape + services
  const discount = Math.min(Math.max(0, quote.discount || 0), subtotal)
  return { plants, hardscape, areas, services, subtotal, discount, total: subtotal - discount }
}

/** The value lists show: a quotation's grand total. A BOQ has none. */
export function quoteValue(quote: Quotation): number | undefined {
  return isPriced(quote.kind) ? quoteTotals(quote).total : undefined
}

/** ₹3,19,620.00 — Indian grouping with paise, as the printed documents show money. */
export function formatRupees(amount: number): string {
  return '₹' + amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** 1180 → "1180"; 2.5 → "2.5" — quantities without grouping, as the company's documents print them. */
export function formatQty(value: number | undefined | null): string {
  return value === undefined || value === null ? '—' : value.toLocaleString('en-IN', { maximumFractionDigits: 2, useGrouping: false })
}

// ---------------------------------------------------------------- checks before sending

/** What still needs filling in before the document goes to the client. */
export function quoteWarnings(quote: Quotation, project?: Project): string[] {
  const warnings: string[] = []
  const priced = isPriced(quote.kind)
  if (shows(quote, 'plants')) {
    const lines = quote.plants?.lines ?? []
    if (!quote.plants) warnings.push('Plants are switched on but no plant list has been fetched from the plants app.')
    const noQty = lines.filter((l) => !l.quantity).length
    if (noQty) warnings.push(`${noQty} plant${noQty === 1 ? ' has' : 's have'} no quantity in the plants app.`)
    const noRate = priced ? lines.filter((l) => !l.rate).length : 0
    if (noRate) warnings.push(`${noRate} plant${noRate === 1 ? ' has' : 's have'} no rate in the plants app.`)
  }
  if (shows(quote, 'hardscape')) {
    if (quote.sections.hardscape && quote.areas.length === 0) warnings.push('Hardscape is switched on but has no areas.')
    const unnamed = quote.areas.filter((a) => !a.name.trim()).length
    if (unnamed) warnings.push(`${unnamed} area${unnamed === 1 ? ' has' : 's have'} no heading.`)
    if (project && showsPlans(quote.kind, project.services)) {
      const noPlan = quote.areas.filter((a) => !a.planImage).length
      if (noPlan) warnings.push(`${noPlan} area${noPlan === 1 ? ' has' : 's have'} no plan image.`)
    }
    const items = quote.areas.flatMap((a) => a.items)
    const incomplete = items.filter((i) => !i.item.trim() || !i.quantity).length
    if (incomplete) warnings.push(`${incomplete} hardscape item${incomplete === 1 ? ' is' : 's are'} missing a name or quantity.`)
    const unpriced = priced ? items.filter((i) => i.item.trim() && !i.rate).length : 0
    if (unpriced) warnings.push(`${unpriced} hardscape item${unpriced === 1 ? ' has' : 's have'} no rate.`)
  }
  if (priced && shows(quote, 'services')) {
    const unpriced = quote.services.filter((l) => l.title.trim() && !l.rate).length
    if (unpriced) warnings.push(`${unpriced} management line${unpriced === 1 ? ' has' : 's have'} no rate.`)
  }
  if (shows(quote, 'payment')) {
    const total = quote.paymentStages.reduce((s, stage) => s + stage.percent, 0)
    if (total !== 100) warnings.push(`The payment stages add up to ${total}%, not 100%.`)
  }
  return warnings
}

// ---------------------------------------------------------------- plants

/** Plants grouped by category, categories A→Z, each keeping the plants app's order — as the plants app prints them. */
export function groupPlants(lines: PlantLine[]): [string, PlantLine[]][] {
  const groups = new Map<string, PlantLine[]>()
  for (const line of lines) {
    const category = line.category?.trim() || 'Other'
    groups.set(category, [...(groups.get(category) ?? []), line])
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
}

/** A small, square copy of a plant photo. The plants app keeps photos on Cloudinary, which resizes on request. */
export function plantThumb(url: string | undefined, px = 120): string | undefined {
  if (!url) return undefined
  if (url.includes('res.cloudinary.com/') && url.includes('/image/upload/')) {
    return url.replace('/image/upload/', `/image/upload/c_fill,w_${px},h_${px},f_auto,q_auto/`)
  }
  return url
}

// ---------------------------------------------------------------- matching projects by name

/** Words that say nothing about which project it is. */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'of', 'and', 'at', 'in', 'on', 'for', 'to', 'project', 'landscape', 'landscaping', 'garden',
  'gardens', 'works', 'work', 'mr', 'mrs', 'ms', 'dr', 'sir', 'new',
])

export function nameTokens(text: string): string[] {
  return text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim().split(' ')
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t))
}

function bigrams(word: string): string[] {
  const out: string[] = []
  for (let i = 0; i < word.length - 1; i += 1) out.push(word.slice(i, i + 2))
  return out
}

/** How alike two words are, 0–1: exact, one the start of the other, or near-identical spelling (Kondotty / Kondoty). */
function wordSimilarity(a: string, b: string): number {
  if (a === b) return 1
  if (a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a))) return 0.85
  const left = bigrams(a)
  const pool = bigrams(b)
  if (!left.length || !pool.length) return 0
  let hits = 0
  for (const gram of left) {
    const at = pool.indexOf(gram)
    if (at >= 0) {
      hits += 1
      pool.splice(at, 1)
    }
  }
  const dice = (2 * hits) / (left.length + bigrams(b).length)
  return dice >= 0.6 ? dice : 0
}

/** How alike two names are, 0–1, word by word in either direction. */
function tokenSimilarity(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0
  const best = (from: string[], to: string[]) => from.reduce((sum, t) => sum + Math.max(...to.map((u) => wordSimilarity(t, u))), 0)
  return (best(a, b) + best(b, a)) / (a.length + b.length)
}

/** Share of `part`'s words found in `whole`: the client "Ashraf" in "Ashraf Residence". */
function containment(part: string[], whole: string[]): number {
  if (!part.length || !whole.length) return 0
  return part.filter((t) => whole.some((u) => wordSimilarity(t, u) >= 0.85)).length / part.length
}

export interface MatchTarget {
  name: string
  client?: string
  location?: string
}

export interface MatchCandidate {
  name: string
  clientName?: string
  location?: string
}

/**
 * How well a plants-app project matches a CRM project, 0–1. The plants app
 * often names a project after the client ("Ashraf Residence") where the CRM
 * has the client apart ("Residence", client Ashraf), so the client and the
 * site count as well as the name.
 */
export function matchScore(target: MatchTarget, candidate: MatchCandidate): number {
  const targetName = nameTokens(target.name)
  const candidateName = nameTokens(candidate.name)
  if (targetName.length && targetName.join(' ') === candidateName.join(' ')) return 1
  const name = tokenSimilarity(targetName, candidateName)
  const combined = tokenSimilarity(
    nameTokens(`${target.client ?? ''} ${target.name}`),
    nameTokens(`${candidate.clientName ?? ''} ${candidate.name}`),
  )
  const clientWords = nameTokens(target.client ?? '')
  const client = Math.max(
    tokenSimilarity(clientWords, nameTokens(candidate.clientName ?? '')),
    containment(clientWords, candidateName),
  )
  const place = tokenSimilarity(nameTokens(target.location ?? ''), nameTokens(candidate.location ?? ''))
  return Math.min(1, Math.max(name, combined) + 0.15 * client + 0.1 * place)
}

/** Candidates best first, with their score; weak matches are left out. */
export function rankMatches<T extends MatchCandidate>(target: MatchTarget, candidates: T[], floor = 0.25): { candidate: T; score: number }[] {
  return candidates
    .map((candidate) => ({ candidate, score: matchScore(target, candidate) }))
    .filter((m) => m.score >= floor)
    .sort((a, b) => b.score - a.score)
}

// ---------------------------------------------------------------- suggestions while typing

/** Stones and items the company quotes often; items used on earlier documents are suggested as well. */
export const COMMON_ITEMS = [
  'Bangalore Stone', 'Bangalore Cobble Black', 'Kadappa Stone', 'Potato Stone', 'Tandur Stone', 'Kota Stone',
  'Granite Cobble', 'River Pebbles', 'White Pebbles', 'Black Pebbles', 'Stepping Stone', 'Paver Block',
  'Natural Grass Lawn', 'Artificial Grass', 'Garden Edging', 'Boulder', 'Wooden Deck',
]

export const COMMON_UNITS = ['Sqft', 'Nos', 'Rft', 'Cft', 'Sqm', 'LS', 'Kg', 'Bag', 'Load', 'Trip']
