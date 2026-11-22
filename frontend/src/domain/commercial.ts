import type { CommercialDoc, Project, Quotation } from './types'

export interface ChecklistItem {
  id: string
  label: string
}

/** The steps each commercial document goes through before the client signs off. */
export const CHECKLISTS: Record<CommercialDoc, ChecklistItem[]> = {
  BOQ: [
    { id: 'boq.measure', label: 'Site measurements taken' },
    { id: 'boq.quantities', label: 'Quantities drafted from the approved design' },
    { id: 'boq.specs', label: 'Materials and specifications listed' },
    { id: 'boq.rates', label: 'Rates applied' },
    { id: 'boq.review', label: 'Internal review by the Design Director' },
    { id: 'boq.shared', label: 'Shared with the client' },
    { id: 'boq.approved', label: 'Approved by the client' },
  ],
  Quotation: [
    { id: 'qt.scope', label: 'Scope of work confirmed' },
    { id: 'qt.survey', label: 'Site survey completed' },
    { id: 'qt.pricing', label: 'Labour and materials priced' },
    { id: 'qt.terms', label: 'Payment terms and timeline added' },
    { id: 'qt.approved', label: 'Approved internally' },
    { id: 'qt.sent', label: 'Sent to the client' },
    { id: 'qt.accepted', label: 'Accepted by the client' },
  ],
  Scope: [
    { id: 'sc.scope', label: 'Client requirements and site area noted' },
    { id: 'sc.fee', label: 'Scope of services and fee drafted' },
    { id: 'sc.review', label: 'Internal review by the Design Director' },
    { id: 'sc.sent', label: 'Sent to the client' },
    { id: 'sc.accepted', label: 'Work order confirmed by the client' },
    { id: 'sc.advance', label: 'Advance received' },
  ],
}

/**
 * Which documents a project carries follows its services:
 * Design only → BOQ, Execution only → Quotation, Design + Execution → both.
 * An AMC-only project carries a Quotation. Design also carries the Scope of
 * Services & Fee Proposal, which comes first.
 */
export function commercialDocs(services: Project['services']): CommercialDoc[] {
  const docs: CommercialDoc[] = []
  if (services.design) docs.push('Scope', 'BOQ')
  // An AMC is priced on a quotation too, whether alone or alongside execution.
  if (services.execution || services.amc) docs.push('Quotation')
  return docs
}

/** Ticked and total checklist items for one document on a project. */
export function checklistProgress(project: Project, doc: CommercialDoc): { done: number; total: number } {
  const items = CHECKLISTS[doc]
  const done = items.filter((item) => project.checklist?.[item.id]?.done).length
  return { done, total: items.length }
}

/**
 * The client approved the design scope: ticked on the Workflow tab ("Client
 * approved the scope" or "Scope confirmed"), on the scope proposal's checklist,
 * or the scope proposal marked Accepted.
 */
export function scopeApproved(project: Project, quotations: Quotation[]): boolean {
  const wf = project.workflow ?? {}
  return Boolean(wf.clientApproved?.done || wf.scopeConfirmed?.done || project.checklist?.['sc.accepted']?.done)
    || quotations.some((q) => q.projectId === project.id && q.kind === 'Scope' && q.status === 'Accepted')
}

/** The client accepted the execution quotation: ticked on its checklist, or the quotation marked Accepted. */
export function quotationApproved(project: Project, quotations: Quotation[]): boolean {
  return Boolean(project.checklist?.['qt.accepted']?.done)
    || quotations.some((q) => q.projectId === project.id && q.kind === 'Quotation' && q.status === 'Accepted')
}
