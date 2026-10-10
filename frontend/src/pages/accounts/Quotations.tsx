import { Fragment, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { usePermissions } from '../../state/permissions'
import { formatCurrency, formatDate, today } from '../../domain/format'
import { commercialDocs } from '../../domain/commercial'
import { projectType } from '../../domain/progress'
import type { CommercialDoc, Quotation, QuotationItem, QuotationStatus } from '../../domain/types'
import {
  PageHeader, Section, Table, EmptyState, StatTile, Pills, SearchInput, Toolbar, RowActions, ConfirmDialog,
  Modal, Field, FormError, Badge,
} from '../../components/ui'
import { Icon } from '../../components/Icon'
import { SearchSelect } from '../../components/SearchSelect'
import { projectOptions } from '../../components/pickerOptions'

const STATUSES: QuotationStatus[] = ['Draft', 'Sent', 'Accepted', 'Rejected']
type KindFilter = 'All' | CommercialDoc

const totalOf = (q: Pick<Quotation, 'items'>) => q.items.reduce((sum, item) => sum + item.quantity * item.rate, 0)

/**
 * BOQs and quotations. Which one a project gets follows its services:
 * Design only → BOQ, Execution only → Quotation, Design + Execution → both.
 */
export function Quotations() {
  const db = useDb()
  const { can } = usePermissions()
  const [kind, setKind] = useState<KindFilter>('All')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editing, setEditing] = useState<Quotation | { projectId?: string; kind?: CommercialDoc } | null>(null)
  const [deleting, setDeleting] = useState<Quotation | null>(null)
  const [params, setParams] = useSearchParams()

  // Linked from a project's BOQ & Quotation tab: ?project=…&kind=…
  useEffect(() => {
    const projectId = params.get('project')
    if (!projectId) return
    if (can('Accounts', 'create')) setEditing({ projectId, kind: (params.get('kind') as CommercialDoc) ?? undefined })
    else setQuery(db.projects.find((p) => p.id === projectId)?.name ?? '')
    setParams({}, { replace: true })
  }, [])

  const clientName = (id: string) => db.clients.find((c) => c.id === id)?.name ?? '—'
  const project = (id: string) => db.projects.find((p) => p.id === id)
  const q = query.trim().toLowerCase()
  const rows = db.quotations.filter((x) =>
    (kind === 'All' || x.kind === kind)
    && (!q || [x.number, project(x.projectId)?.name ?? '', clientName(x.clientId)].some((v) => v.toLowerCase().includes(q))))

  const accepted = db.quotations.filter((x) => x.status === 'Accepted')

  return (
    <div>
      <PageHeader
        title="BOQ & Quotations"
        subtitle="Design projects get a BOQ, execution projects a Quotation, and Design + Execution projects carry both."
        actions={can('Accounts', 'create') && (
          <button onClick={() => setEditing({})} className="btn-primary"><Icon name="plus" className="h-4 w-4" /> New BOQ / Quotation</button>
        )}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="BOQs" value={db.quotations.filter((x) => x.kind === 'BOQ').length} tone="blue" icon="pen" />
        <StatTile label="Quotations" value={db.quotations.filter((x) => x.kind === 'Quotation').length} tone="green" icon="hammer" />
        <StatTile label="Awaiting Client" value={db.quotations.filter((x) => x.status === 'Sent').length} tone="amber" icon="clock" />
        <StatTile label="Accepted Value" value={formatCurrency(accepted.reduce((s, x) => s + totalOf(x), 0), true)} tone="green" icon="rupee" />
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
          <EmptyState title="Nothing here yet." icon="doc" />
        ) : (
          <Table head={['Number', 'Type', 'Project', 'Client', 'Date', 'Value', 'Status', '']}>
            {rows.map((quote) => {
              const p = project(quote.projectId)
              return (
                <Fragment key={quote.id}>
                  <tr className="row-hover">
                    <td className="td whitespace-nowrap font-medium text-stone-900">{quote.number}</td>
                    <td className="td"><Badge tone={quote.kind === 'BOQ' ? 'blue' : 'green'}>{quote.kind}</Badge></td>
                    <td className="td">
                      {p ? <Link to={`/projects/${p.id}`} className="hover:text-brand-700">{p.name}</Link> : '—'}
                      {p && <span className="block text-xs text-stone-400">{projectType(p)}</span>}
                    </td>
                    <td className="td">{clientName(quote.clientId)}</td>
                    <td className="td tabular-nums">{formatDate(quote.date)}</td>
                    <td className="td font-semibold tabular-nums">{formatCurrency(totalOf(quote))}</td>
                    <td className="td">
                      <select
                        value={quote.status}
                        disabled={!can('Accounts', 'edit')}
                        onChange={(e) => api.quotations.update(quote.id, { status: e.target.value as QuotationStatus })}
                        className="input w-28 py-1 text-xs" aria-label={`Status of ${quote.number}`}
                      >
                        {STATUSES.map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="td">
                      <RowActions
                        extra={
                          <button
                            onClick={() => setExpanded(expanded === quote.id ? null : quote.id)}
                            className="btn-icon w-auto gap-1 px-2 text-xs font-semibold text-brand-700"
                          >
                            {quote.items.length} items
                            <Icon name="chevron" className={`h-3.5 w-3.5 transition-transform ${expanded === quote.id ? 'rotate-90' : ''}`} />
                          </button>
                        }
                        onEdit={can('Accounts', 'edit') ? () => setEditing(quote) : undefined}
                        onDelete={can('Accounts', 'delete') ? () => setDeleting(quote) : undefined}
                      />
                    </td>
                  </tr>
                  {expanded === quote.id && (
                    <tr>
                      <td colSpan={8} className="bg-stone-50 px-4 py-3">
                        <table className="w-full">
                          <thead>
                            <tr>
                              <th className="th">Description</th>
                              <th className="th text-right">Qty</th>
                              <th className="th">Unit</th>
                              <th className="th text-right">Rate</th>
                              <th className="th text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {quote.items.map((item, i) => (
                              <tr key={i}>
                                <td className="td">{item.description}</td>
                                <td className="td text-right tabular-nums">{item.quantity}</td>
                                <td className="td">{item.unit}</td>
                                <td className="td text-right tabular-nums">{formatCurrency(item.rate)}</td>
                                <td className="td text-right font-medium tabular-nums">{formatCurrency(item.quantity * item.rate)}</td>
                              </tr>
                            ))}
                            <tr className="border-t border-stone-200">
                              <td className="td font-semibold" colSpan={4}>Total</td>
                              <td className="td text-right font-bold tabular-nums">{formatCurrency(totalOf(quote))}</td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </Table>
        )}
      </Section>

      {editing && (
        <QuotationFormModal
          quote={'id' in editing ? editing : undefined}
          defaults={'id' in editing ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.number}?`}
          message={<>This {deleting.kind} for {project(deleting.projectId)?.name ?? 'the project'} ({formatCurrency(totalOf(deleting))}) will be removed.</>}
          onClose={() => setDeleting(null)}
          onConfirm={() => api.quotations.remove(deleting.id)}
        />
      )}
    </div>
  )
}

const BLANK_ITEM: QuotationItem = { description: '', quantity: 1, unit: 'LS', rate: 0 }

function QuotationFormModal({
  quote, defaults, onClose,
}: { quote?: Quotation; defaults?: { projectId?: string; kind?: CommercialDoc }; onClose: () => void }) {
  const db = useDb()
  const firstProject = defaults?.projectId ?? quote?.projectId ?? db.projects.find((p) => p.status !== 'Completed')?.id ?? ''
  const [projectId, setProjectId] = useState(firstProject)
  const project = db.projects.find((p) => p.id === projectId)
  const allowed = project ? commercialDocs(project.services) : []
  const [kind, setKind] = useState<CommercialDoc>(() => {
    const wanted = quote?.kind ?? defaults?.kind
    const options = db.projects.find((p) => p.id === firstProject)
    const docs = options ? commercialDocs(options.services) : []
    return wanted && docs.includes(wanted) ? wanted : docs[0] ?? 'BOQ'
  })
  const [date, setDate] = useState(quote?.date ?? today())
  const [status, setStatus] = useState<QuotationStatus>(quote?.status ?? 'Draft')
  const [items, setItems] = useState<QuotationItem[]>(quote?.items.length ? quote.items : [{ ...BLANK_ITEM }])
  const [error, setError] = useState<string | null>(null)

  // The type follows the project: switching projects snaps it to what that project allows.
  const chooseProject = (id: string) => {
    setProjectId(id)
    const p = db.projects.find((x) => x.id === id)
    const docs = p ? commercialDocs(p.services) : []
    if (!docs.includes(kind)) setKind(docs[0] ?? 'BOQ')
    setError(null)
  }

  const setItem = (i: number, patch: Partial<QuotationItem>) => setItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it)))
  const total = totalOf({ items })

  const save = () => {
    if (!project) return setError('Pick the project.')
    if (!allowed.includes(kind)) return setError(`${projectType(project)} projects do not carry a ${kind}.`)
    const lines = items.filter((i) => i.description.trim())
    if (lines.length === 0) return setError('Add at least one line item.')
    const values = {
      kind, projectId: project.id, clientId: project.clientId, date, status,
      items: lines.map((i) => ({ ...i, description: i.description.trim(), quantity: Math.max(0, i.quantity), rate: Math.max(0, i.rate) })),
    }
    if (quote) api.quotations.update(quote.id, values)
    else api.quotations.create(values)
    onClose()
  }

  return (
    <Modal
      title={quote ? `Edit ${quote.number}` : `New ${allowed.length === 1 ? allowed[0] : 'BOQ / Quotation'}`}
      size="xl"
      onClose={onClose}
      footer={<>
        <span className="mr-auto self-center text-sm text-stone-600">Total <strong className="ml-1 text-lg tabular-nums text-stone-900">{formatCurrency(total)}</strong></span>
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={save} className="btn-primary">{quote ? 'Save changes' : `Create ${kind}`}</button>
      </>}
    >
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
          <Field label="Project" required>
            <SearchSelect
              value={projectId}
              onChange={chooseProject}
              options={projectOptions(db, db.projects, projectType)}
              searchPlaceholder="Search projects"
              title="Project"
            />
          </Field>
          <Field label="Date">
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Status">
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value as QuotationStatus)}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
        </div>

        {project && (
          <div>
            <p className="label">Document type</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {(['BOQ', 'Quotation'] as const).map((doc) => {
                const ok = allowed.includes(doc)
                return (
                  <button
                    key={doc} type="button" disabled={!ok} onClick={() => setKind(doc)}
                    className={`rounded-xl border-2 p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      kind === doc ? 'border-brand-500 bg-brand-50' : 'border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <span className="block font-semibold text-stone-900">{doc}</span>
                    <span className="block text-xs text-stone-500">
                      {doc === 'BOQ' ? 'Bill of quantities — design work' : 'Priced quotation — execution work'}
                      {!ok && ` · not used on ${projectType(project)} projects`}
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-xs text-stone-500">
              {projectType(project)}: {allowed.length === 2 ? 'carries both a BOQ and a Quotation.' : `carries a ${allowed[0]} only.`}
              {' '}Client: {db.clients.find((c) => c.id === project.clientId)?.name}
            </p>
          </div>
        )}

        <div>
          <p className="label mb-2">Line items</p>
          <div className="overflow-hidden rounded-xl border border-stone-200">
            <div className="hidden grid-cols-[1fr_90px_90px_130px_120px_40px] gap-2 bg-stone-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-stone-500 md:grid">
              <span>Description</span><span className="text-right">Qty</span><span>Unit</span><span className="text-right">Rate (₹)</span><span className="text-right">Amount</span><span />
            </div>
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 border-t border-stone-100 p-3 first:border-t-0 md:grid-cols-[1fr_90px_90px_130px_120px_40px] md:items-center md:py-2">
                <input className="input col-span-2 md:col-span-1" placeholder="e.g. Hardscape — pool deck paving" value={item.description} onChange={(e) => setItem(i, { description: e.target.value })} aria-label="Description" />
                <input type="number" min={0} className="input text-right" value={item.quantity} onChange={(e) => setItem(i, { quantity: Number(e.target.value) })} aria-label="Quantity" />
                <input className="input" value={item.unit} onChange={(e) => setItem(i, { unit: e.target.value })} aria-label="Unit" />
                <input type="number" min={0} className="input text-right" value={item.rate || ''} placeholder="0" onChange={(e) => setItem(i, { rate: Number(e.target.value) })} aria-label="Rate" />
                <span className="self-center text-right text-sm font-semibold tabular-nums text-stone-800">{formatCurrency(item.quantity * item.rate)}</span>
                <button
                  type="button" onClick={() => setItems(items.length > 1 ? items.filter((_, j) => j !== i) : [{ ...BLANK_ITEM }])}
                  className="btn-icon justify-self-end hover:bg-red-50 hover:text-red-600" aria-label="Remove line"
                >
                  <Icon name="trash" className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setItems([...items, { ...BLANK_ITEM }])} className="btn-ghost mt-2 text-brand-700">
            <Icon name="plus" className="h-4 w-4" /> Add line
          </button>
        </div>
        <FormError message={error} />
      </div>
    </Modal>
  )
}
