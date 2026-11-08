import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { formatCurrency, formatDate } from '../../domain/format'
import { projectType } from '../../domain/progress'
import { KIND_TITLE, QUOTE_STATUSES, quoteValue } from '../../domain/quotation'
import type { CommercialDoc, Quotation, QuotationStatus } from '../../domain/types'
import {
  PageHeader, Section, Table, EmptyState, StatTile, Pills, SearchInput, Toolbar, RowActions, ConfirmDialog, Badge,
} from '../../components/ui'
import { Icon } from '../../components/Icon'
import { editPath, useQuoteAccess, viewPath } from '../quotations/access'
import { NewQuoteModal } from '../quotations/NewQuoteModal'

type KindFilter = 'All' | CommercialDoc

/**
 * Every BOQ and quotation. Which one a project gets follows its services:
 * Design only → BOQ, Execution only → Quotation, Design + Execution → both.
 * Each opens as its printed pages, with an Edit button for those who may change it.
 */
export function Quotations() {
  const db = useDb()
  const { user } = useSession()
  const navigate = useNavigate()
  const access = useQuoteAccess()
  const [kind, setKind] = useState<KindFilter>('All')
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState<{ projectId?: string; kind?: CommercialDoc } | null>(null)
  const [deleting, setDeleting] = useState<Quotation | null>(null)
  const [params, setParams] = useSearchParams()

  // Older links from a project's tab: ?project=…&kind=… opens a new document for it.
  useEffect(() => {
    const projectId = params.get('project')
    if (!projectId) return
    const wanted = (params.get('kind') as CommercialDoc | null) ?? undefined
    if (access.canCreate(wanted ?? 'Quotation') || access.canCreate('BOQ')) setCreating({ projectId, kind: wanted })
    else setQuery(db.projects.find((p) => p.id === projectId)?.name ?? '')
    setParams({}, { replace: true })
  }, [])

  const clientName = (id: string) => db.clients.find((c) => c.id === id)?.name ?? '—'
  const project = (id: string) => db.projects.find((p) => p.id === id)
  const q = query.trim().toLowerCase()
  const rows = db.quotations.filter((x) =>
    (kind === 'All' || x.kind === kind)
    && (!q || [x.number, project(x.projectId)?.name ?? '', clientName(x.clientId)].some((v) => v.toLowerCase().includes(q))))

  const accepted = db.quotations.filter((x) => x.status === 'Accepted' && x.kind === 'Quotation')
  const canCreateAny = access.canCreate('BOQ') || access.canCreate('Quotation')

  return (
    <div>
      <PageHeader
        title="BOQ & Quotations"
        subtitle="Design projects get a BOQ, execution projects a Quotation, and Design + Execution projects carry both."
        actions={canCreateAny && (
          <button onClick={() => setCreating({})} className="btn-primary"><Icon name="plus" className="h-4 w-4" /> New BOQ / Quotation</button>
        )}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="BOQs" value={db.quotations.filter((x) => x.kind === 'BOQ').length} tone="blue" icon="pen" />
        <StatTile label="Quotations" value={db.quotations.filter((x) => x.kind === 'Quotation').length} tone="green" icon="hammer" />
        <StatTile label="Awaiting Client" value={db.quotations.filter((x) => x.status === 'Sent').length} tone="amber" icon="clock" />
        <StatTile label="Accepted Value" value={formatCurrency(accepted.reduce((s, x) => s + (quoteValue(x) ?? 0), 0), true)} tone="green" icon="rupee" />
      </div>

      <Toolbar>
        <Pills<KindFilter>
          active={kind}
          onChange={setKind}
          options={(['All', 'BOQ', 'Quotation'] as const).map((k) => ({
            key: k, label: k === 'All' ? 'All' : `${k}s`, count: k === 'All' ? db.quotations.length : db.quotations.filter((x) => x.kind === k).length,
          }))}
        />
        <SearchInput value={query} onChange={setQuery} placeholder="Search number, project, client…" className="lg:w-80" />
      </Toolbar>

      <Section>
        {rows.length === 0 ? (
          <EmptyState
            title={db.quotations.length ? 'Nothing matches.' : 'No BOQs or quotations yet.'}
            hint={db.quotations.length ? undefined : 'Start one here, or from a project’s BOQ & Quotation tab.'}
            icon="doc"
          />
        ) : (
          <Table head={['Number', 'Type', 'Project', 'Client', 'Date', 'Value', 'Status', '']}>
            {rows.map((quote) => {
              const p = project(quote.projectId)
              const value = quoteValue(quote)
              return (
                <tr key={quote.id} className="row-hover">
                  <td className="td whitespace-nowrap">
                    <Link to={viewPath(quote)} className="font-medium text-stone-900 hover:text-brand-700">{quote.number}</Link>
                  </td>
                  <td className="td"><Badge tone={quote.kind === 'BOQ' ? 'blue' : 'green'}>{quote.kind}</Badge></td>
                  <td className="td">
                    {p ? <Link to={`/projects/${p.id}?tab=commercial`} className="hover:text-brand-700">{p.name}</Link> : '—'}
                    {p && <span className="block text-xs text-stone-400">{projectType(p)}</span>}
                  </td>
                  <td className="td">{clientName(quote.clientId)}</td>
                  <td className="td tabular-nums">{formatDate(quote.date)}</td>
                  <td className="td font-semibold tabular-nums">{value === undefined ? <span className="font-normal text-stone-400">No prices</span> : formatCurrency(value)}</td>
                  <td className="td">
                    <select
                      value={quote.status}
                      disabled={!access.canEdit(quote.kind)}
                      onChange={(e) => api.quotations.update(quote.id, { status: e.target.value as QuotationStatus }, user.id)}
                      className="input w-28 py-1 text-xs" aria-label={`Status of ${quote.number}`}
                    >
                      {QUOTE_STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="td">
                    <RowActions
                      extra={
                        <Link to={viewPath(quote)} className="btn-icon" title="View" aria-label={`View ${quote.number}`}>
                          <Icon name="eye" className="h-4 w-4" />
                        </Link>
                      }
                      onEdit={access.canEdit(quote.kind) ? () => navigate(editPath(quote)) : undefined}
                      onDelete={access.canDelete(quote.kind) ? () => setDeleting(quote) : undefined}
                    />
                  </td>
                </tr>
              )
            })}
          </Table>
        )}
      </Section>

      {creating && <NewQuoteModal projectId={creating.projectId} kind={creating.kind} onClose={() => setCreating(null)} />}
      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.number}?`}
          message={<>This {KIND_TITLE[deleting.kind].toLowerCase()} for {project(deleting.projectId)?.name ?? 'the project'}{quoteValue(deleting) !== undefined ? ` (${formatCurrency(quoteValue(deleting)!)})` : ''} will be removed.</>}
          onClose={() => setDeleting(null)}
          onConfirm={() => api.quotations.remove(deleting.id)}
        />
      )}
    </div>
  )
}
