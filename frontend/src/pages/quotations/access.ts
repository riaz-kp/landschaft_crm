import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { usePermissions } from '../../state/permissions'
import { useSession } from '../../state/session'
import { useDb } from '../../state/useDb'
import { today } from '../../domain/format'
import { newQuotation } from '../../domain/quotation'
import type { CommercialDoc, ModuleKey, Project, Quotation } from '../../domain/types'

/**
 * Who works on which document. Accounts handle both. A BOQ is the design
 * team's (Design → BOQ in the structure document); the quotation for site work
 * is execution's, who send it to the client (Workflow → "Execution quotation sent").
 */
export function useQuoteAccess() {
  const { can } = usePermissions()
  const team = (kind: CommercialDoc): ModuleKey => (kind === 'BOQ' ? 'Design' : 'Execution')
  return {
    canCreate: (kind: CommercialDoc) => can('Accounts', 'create') || can(team(kind), 'create'),
    canEdit: (kind: CommercialDoc) => can('Accounts', 'edit') || can(team(kind), 'edit'),
    canDelete: (kind: CommercialDoc) => can('Accounts', 'delete') || can(team(kind), 'delete'),
  }
}

/** The document's editor. */
export const quotePath = (quote: Pick<Quotation, 'id' | 'projectId'>) => `/projects/${quote.projectId}/commercial/${quote.id}`
/** The document as its printed pages, with Edit and Print: where opening a document lands. */
export const viewPath = (quote: Pick<Quotation, 'id'>) => `/print/commercial/${quote.id}`

/** Makes a document from the company defaults (or from another document) and opens it. */
export function useCreateQuote() {
  const db = useDb()
  const { user } = useSession()
  const navigate = useNavigate()
  return (kind: CommercialDoc, project: Project, from?: Quotation) => {
    const record = api.quotations.create(newQuotation({ kind, project, settings: db.settings, date: today(), by: user.id, from }))
    navigate(quotePath(record))
    return record
  }
}
