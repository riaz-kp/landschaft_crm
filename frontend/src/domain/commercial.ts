import type { CommercialDoc, Project } from './types'

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
}

/**
 * Which documents a project carries follows its services:
 * Design only → BOQ, Execution only → Quotation, Design + Execution → both.
 * An AMC-only project carries a Quotation.
 */
export function commercialDocs(services: Project['services']): CommercialDoc[] {
  const docs: CommercialDoc[] = []
  if (services.design) docs.push('BOQ')
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
