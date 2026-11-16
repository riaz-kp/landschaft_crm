import { defaultScope } from './documentDefaults'
import type { FeeLine, Quotation, QuoteSection, ScopeDefaults, ScopeGroup, ScopeProposal } from './types'

/**
 * The Scope of Services & Fee Proposal: the consultancy proposal a design
 * client confirms before the work starts, after the company's own proposal
 * (Mr. Mahesh, Apartment, Ernakulam). It is stored with the BOQs and
 * quotations; what it says is in `quote.scope`, and its cover letter, GST
 * rate, payment terms and status are the document's own fields.
 */

/** The parts of a Scope that can be left out, by the document section that switches them. */
export const SCOPE_SECTIONS: QuoteSection[] = ['schedule', 'payment', 'terms', 'bank', 'acceptance']

export const SCOPE_SECTION_LABELS: Partial<Record<QuoteSection, string>> = {
  schedule: 'Work schedule',
  payment: 'Payment terms',
  terms: 'Terms & conditions',
  bank: 'Bank details',
  acceptance: 'Client acceptance',
}

/** A, B, C… for the parts of the scope of services; AA after Z, should it ever come to that. */
export function groupLetter(index: number): string {
  let n = index
  let out = ''
  do {
    out = String.fromCharCode(65 + (n % 26)) + out
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return out
}

/** The proposal without its payment stages, which live on the document. */
export function proposalFrom(defaults: ScopeDefaults): ScopeProposal {
  const { paymentStages: _stages, ...proposal } = structuredClone(defaults)
  return proposal
}

/** A proposal as stored, filled out to the current shape. */
export function normalizeScope(raw?: Partial<ScopeProposal>): ScopeProposal {
  const defaults = proposalFrom(defaultScope())
  if (!raw) return defaults
  return {
    ...defaults,
    ...raw,
    visits: { ...defaults.visits, ...raw.visits },
  }
}

export const feeAmount = (fees: FeeLine[]) => fees.reduce((s, f) => s + (f.amount || 0), 0)

export interface ScopeTotals {
  /** The fee lines added up: what GST is charged on. */
  fee: number
  gstRate?: number
  gst: number
  /** Fee plus GST: the net amount. */
  total: number
}

export function scopeTotals(quote: Pick<Quotation, 'scope' | 'gstRate'>): ScopeTotals {
  const fee = feeAmount(quote.scope?.fees ?? [])
  const gstRate = quote.gstRate
  const gst = gstRate ? Math.round(fee * gstRate) / 100 : 0
  return { fee, gstRate, gst, total: fee + gst }
}

/** 106200 → "1,06,200/-": money as the proposal prints it, without paise unless there are some. */
export function formatFee(amount: number): string {
  const paise = Math.round(amount * 100) % 100 !== 0
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: paise ? 2 : 0, maximumFractionDigits: 2 })}/-`
}

/** Points of a group with something in them. */
export const filledPoints = (group: ScopeGroup) => group.points.map((p) => p.trim()).filter(Boolean)

/** Groups with a title or at least one point. */
export const filledGroups = (groups: ScopeGroup[]) => groups.filter((g) => g.title.trim() || filledPoints(g).length)

/** What still needs filling in before the proposal goes to the client. */
export function scopeWarnings(quote: Quotation): string[] {
  const warnings: string[] = []
  const scope = quote.scope
  if (!scope) return ['This proposal has no scope of services.']
  if (!filledGroups(scope.services).length) warnings.push('The scope of services is empty.')
  const untitled = scope.services.filter((g) => !g.title.trim() && filledPoints(g).length).length
  if (untitled) warnings.push(`${untitled} part${untitled === 1 ? '' : 's'} of the scope ${untitled === 1 ? 'has' : 'have'} no heading.`)
  if (!feeAmount(scope.fees)) warnings.push('No fee has been entered.')
  const unpriced = scope.fees.filter((f) => f.label.trim() && !f.amount).length
  if (unpriced && feeAmount(scope.fees)) warnings.push(`${unpriced} fee line${unpriced === 1 ? ' has' : 's have'} no amount.`)
  if (quote.sections.payment) {
    const total = quote.paymentStages.reduce((s, stage) => s + stage.percent, 0)
    if (total !== 100) warnings.push(`The payment terms add up to ${total}%, not 100%.`)
  }
  return warnings
}
