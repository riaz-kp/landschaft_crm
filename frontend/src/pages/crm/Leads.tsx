import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { usePermissions } from '../../state/permissions'
import { formatDate } from '../../domain/format'
import type { Lead, LeadStatus } from '../../domain/types'
import {
  PageHeader, Section, Table, EmptyState, Badge, Pills, SearchInput, Toolbar, RowActions, ConfirmDialog,
  Modal, Field, FormError, StatTile,
} from '../../components/ui'
import { Icon } from '../../components/Icon'
import { ContactNumbers, PhoneWhatsAppFields } from '../../components/ContactFields'
import { SearchSelect } from '../../components/SearchSelect'
import { employeeOptions } from '../../components/pickerOptions'

const STATUSES: LeadStatus[] = ['New', 'Contacted', 'Site Visit', 'Quoted', 'Won', 'Lost']
const SOURCES: Lead['source'][] = ['Instagram', 'Referral', 'Website', 'Walk-in', 'Google', 'Exhibition']

const STATUS_DOT: Record<LeadStatus, string> = {
  New: 'bg-sky-500', Contacted: 'bg-stone-400', 'Site Visit': 'bg-amber-500', Quoted: 'bg-clay-500', Won: 'bg-brand-500', Lost: 'bg-red-400',
}

type LeadView = 'list' | 'board'
const VIEW_KEY = 'landschaft-leads-view'

function storedView(): LeadView {
  try {
    return localStorage.getItem(VIEW_KEY) === 'board' ? 'board' : 'list'
  } catch {
    return 'list'
  }
}

/** Leads → Clients → Site Visits is the first of the five connected systems. */
export function Leads() {
  const db = useDb()
  const { can } = usePermissions()
  const [filter, setFilter] = useState<LeadStatus | 'All'>('All')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Lead | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Lead | null>(null)
  const [params, setParams] = useSearchParams()
  // List or board, remembered in this browser.
  const [view, setViewState] = useState<LeadView>(storedView)
  const setView = (v: LeadView) => {
    setViewState(v)
    try { localStorage.setItem(VIEW_KEY, v) } catch { /* private mode */ }
  }

  // The header search links to ?open=<lead id>.
  const openId = params.get('open')
  useEffect(() => {
    if (!openId) return
    const lead = db.leads.find((l) => l.id === openId)
    if (lead) setEditing(lead)
    setParams({}, { replace: true })
  }, [openId])

  const q = query.trim().toLowerCase()
  const leads = db.leads.filter((l) =>
    (view === 'board' || filter === 'All' || l.status === filter)
    && (!q || [l.name, l.phone, l.whatsapp ?? '', l.location, l.requirement, l.email ?? ''].some((v) => v.toLowerCase().includes(q))))
  const ownerName = (id: string) => db.employees.find((e) => e.id === id)?.name ?? '—'
  const open = db.leads.filter((l) => !['Won', 'Lost'].includes(l.status))
  const won = db.leads.filter((l) => l.status === 'Won').length
  const decided = db.leads.filter((l) => ['Won', 'Lost'].includes(l.status)).length

  return (
    <div>
      <PageHeader
        title="Leads"
        subtitle="Enquiries from first contact through to a won or lost decision."
        actions={can('CRM', 'create') && (
          <button onClick={() => setEditing('new')} className="btn-primary"><Icon name="plus" className="h-4 w-4" /> New lead</button>
        )}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Open Leads" value={open.length} icon="users" tone="blue" />
        <StatTile label="Awaiting Site Visit" value={db.leads.filter((l) => l.status === 'Site Visit').length} icon="pin" tone="amber" />
        <StatTile label="Quoted" value={db.leads.filter((l) => l.status === 'Quoted').length} icon="doc" tone="clay" />
        <StatTile label="Win Rate" value={decided ? `${Math.round((won / decided) * 100)}%` : '—'} sub={`${won} won of ${decided} decided`} icon="chart" tone="green" />
      </div>

      <Toolbar>
        {view === 'list' ? (
          <Pills<LeadStatus | 'All'>
            active={filter}
            onChange={setFilter}
            options={(['All', ...STATUSES] as const).map((s) => ({
              key: s, label: s, count: s === 'All' ? db.leads.length : db.leads.filter((l) => l.status === s).length,
            }))}
          />
        ) : <span className="text-sm text-stone-500">Drag a card to move it along; click it to open.</span>}
        <div className="flex items-center gap-2">
          <SearchInput value={query} onChange={setQuery} placeholder="Search leads…" className="min-w-0 flex-1 lg:w-72 lg:flex-none" />
          <div className="flex shrink-0 gap-1 rounded-xl bg-stone-100 p-1" role="group" aria-label="View">
            {([['list', 'List', 'list'], ['board', 'Board', 'board']] as const).map(([key, label, icon]) => (
              <button
                key={key} type="button" onClick={() => setView(key)} aria-pressed={view === key} title={`${label} view`}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition sm:text-sm ${
                  view === key ? 'bg-white text-brand-800 shadow-sm' : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                <Icon name={icon} className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
        </div>
      </Toolbar>

      {view === 'board' ? (
        <LeadBoard leads={leads} canEdit={can('CRM', 'edit')} canCreateClient={can('CRM', 'create')} onOpen={setEditing} />
      ) : (
      <Section>
        {leads.length === 0 ? (
          <EmptyState title="No leads match." icon="users" />
        ) : (
          <Table head={['Lead', 'Location', 'Source', 'Requirement', 'Owner', 'Status', '', '']}>
            {leads.map((lead) => (
              <tr key={lead.id} className="row-hover">
                <td className="td">
                  <button onClick={() => can('CRM', 'edit') && setEditing(lead)} className="text-left font-medium text-stone-900 hover:text-brand-700">
                    {lead.name}
                  </button>
                  <span className="mt-0.5 block text-xs text-stone-500"><ContactNumbers phone={lead.phone} whatsapp={lead.whatsapp} /></span>
                  <span className="block text-xs text-stone-400">Since {formatDate(lead.createdAt)}</span>
                </td>
                <td className="td">{lead.location}</td>
                <td className="td"><Badge tone="stone">{lead.source}</Badge></td>
                <td className="td max-w-xs truncate" title={lead.requirement}>{lead.requirement}</td>
                <td className="td whitespace-nowrap">{ownerName(lead.ownerId)}</td>
                <td className="td">
                  <select
                    value={lead.status}
                    disabled={!can('CRM', 'edit')}
                    onChange={(e) => api.leads.setStatus(lead.id, e.target.value as LeadStatus)}
                    className="input w-32 py-1 text-xs"
                    aria-label={`Status for ${lead.name}`}
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="td">
                  {lead.clientId ? (
                    <Link to={`/crm/clients/${lead.clientId}`} className="text-xs font-semibold text-brand-700 hover:text-brand-800">View client</Link>
                  ) : lead.status === 'Won' && can('CRM', 'create') ? (
                    <button onClick={() => api.leads.convert(lead.id)} className="btn-secondary whitespace-nowrap py-1 text-xs">Create client</button>
                  ) : null}
                </td>
                <td className="td">
                  <RowActions
                    onEdit={can('CRM', 'edit') ? () => setEditing(lead) : undefined}
                    onDelete={can('CRM', 'delete') ? () => setDeleting(lead) : undefined}
                  />
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Section>
      )}

      {editing && <LeadFormModal lead={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmDialog
          title={`Delete lead “${deleting.name}”?`}
          onClose={() => setDeleting(null)}
          onConfirm={() => api.leads.remove(deleting.id)}
          message={<>
            The enquiry and any site visits booked against it are removed.
            {deleting.clientId && ' The client record created from it stays.'}
          </>}
        />
      )}
    </div>
  )
}

/**
 * The leads as a column per status, from New to Won and Lost. A card is
 * dragged between columns with a mouse; on a phone the columns scroll sideways
 * and each card carries a "move to" picker instead.
 */
function LeadBoard({
  leads, canEdit, canCreateClient, onOpen,
}: { leads: Lead[]; canEdit: boolean; canCreateClient: boolean; onOpen: (lead: Lead) => void }) {
  const db = useDb()
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<LeadStatus | null>(null)
  const ownerName = (id: string) => db.employees.find((e) => e.id === id)?.name.split(' ')[0] ?? '—'

  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:snap-none lg:grid-cols-6 lg:gap-3 lg:overflow-visible lg:px-0">
      {STATUSES.map((status) => {
        const cards = leads.filter((l) => l.status === status)
        return (
          <div
            key={status}
            onDragOver={(e) => { if (canEdit) { e.preventDefault(); setOver(status) } }}
            onDragLeave={() => setOver((o) => (o === status ? null : o))}
            onDrop={(e) => {
              e.preventDefault()
              const lead = leads.find((l) => l.id === dragging)
              if (lead && lead.status !== status) api.leads.setStatus(lead.id, status)
              setDragging(null)
              setOver(null)
            }}
            className={`w-[78%] max-w-xs shrink-0 snap-start rounded-2xl p-3 transition lg:w-auto lg:max-w-none lg:min-w-0 ${
              over === status ? 'bg-brand-100/70 ring-2 ring-brand-400' : 'bg-stone-200/50'
            }`}
          >
            <h2 className="mb-3 flex items-center justify-between gap-2 px-1 text-sm font-bold text-stone-700">
              <span className="flex min-w-0 items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT[status]}`} /> <span className="truncate">{status}</span>
              </span>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs tabular-nums text-stone-500">{cards.length}</span>
            </h2>
            <div className="min-h-24 space-y-2">
              {cards.map((lead) => (
                <article
                  key={lead.id}
                  draggable={canEdit}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', lead.id)
                    e.dataTransfer.effectAllowed = 'move'
                    setDragging(lead.id)
                  }}
                  onDragEnd={() => { setDragging(null); setOver(null) }}
                  onClick={() => canEdit && onOpen(lead)}
                  className={`rounded-xl border border-stone-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                    canEdit ? 'cursor-pointer' : ''
                  } ${dragging === lead.id ? 'opacity-40' : ''}`}
                >
                  <p className="text-sm font-medium text-stone-900">{lead.name}</p>
                  {lead.location && <p className="mt-0.5 truncate text-xs text-stone-500">{lead.location}</p>}
                  {lead.requirement && <p className="mt-1.5 line-clamp-2 text-xs text-stone-600">{lead.requirement}</p>}
                  <div className="mt-2.5 flex items-center justify-between gap-2 text-xs text-stone-500">
                    <Badge tone="stone">{lead.source}</Badge>
                    <span className="truncate">{ownerName(lead.ownerId)}</span>
                  </div>
                  {lead.phone && <p className="mt-1.5 truncate text-xs tabular-nums text-stone-400">{lead.phone}</p>}
                  {lead.clientId ? (
                    <Link
                      to={`/crm/clients/${lead.clientId}`} onClick={(e) => e.stopPropagation()}
                      className="mt-2 inline-block text-xs font-semibold text-brand-700 hover:text-brand-800"
                    >
                      View client
                    </Link>
                  ) : lead.status === 'Won' && canCreateClient ? (
                    <button
                      type="button" onClick={(e) => { e.stopPropagation(); api.leads.convert(lead.id) }}
                      className="btn-secondary mt-2 w-full py-1 text-xs"
                    >
                      Create client
                    </button>
                  ) : null}
                  {canEdit && (
                    <select
                      value={lead.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => api.leads.setStatus(lead.id, e.target.value as LeadStatus)}
                      className="input mt-2.5 py-1 text-xs lg:hidden"
                      aria-label={`Move ${lead.name} to`}
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                </article>
              ))}
              {cards.length === 0 && (
                <p className="rounded-xl border-2 border-dashed border-stone-300/70 px-1 py-6 text-center text-xs text-stone-400">
                  {dragging ? 'Drop here' : 'Nothing here'}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function LeadFormModal({ lead, onClose }: { lead?: Lead; onClose: () => void }) {
  const db = useDb()
  const { user } = useSession()
  const [form, setForm] = useState({
    name: lead?.name ?? '',
    phone: lead?.phone ?? '',
    whatsapp: lead?.whatsapp ?? '',
    email: lead?.email ?? '',
    location: lead?.location ?? '',
    source: lead?.source ?? ('Instagram' as Lead['source']),
    status: lead?.status ?? ('New' as LeadStatus),
    ownerId: lead?.ownerId ?? (['marketing', 'ceo'].includes(user.role) ? user.id : db.employees.find((e) => e.role === 'marketing')?.id ?? user.id),
    requirement: lead?.requirement ?? '',
    notes: lead?.notes ?? '',
  })
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<typeof form>) => { setForm({ ...form, ...patch }); setError(null) }

  const save = () => {
    if (!form.name.trim()) return setError('Enter the lead’s name.')
    const values = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      // An empty WhatsApp means the box was unticked and left blank — fall back to the phone.
      whatsapp: form.whatsapp.trim() || form.phone.trim(),
      email: form.email.trim() || undefined,
      location: form.location.trim(),
      source: form.source,
      status: form.status,
      ownerId: form.ownerId,
      requirement: form.requirement.trim(),
      notes: form.notes.trim() || undefined,
    }
    if (lead) api.leads.update(lead.id, values)
    else api.leads.create(values)
    onClose()
  }

  return (
    <Modal
      title={lead ? `Edit lead — ${lead.name}` : 'New lead'}
      size="lg"
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={save} className="btn-primary">{lead ? 'Save changes' : 'Add lead'}</button>
      </>}
    >
      <div className="space-y-4">
        <Field label="Name" required>
          <input className="input" value={form.name} onChange={(e) => set({ name: e.target.value })} autoFocus />
        </Field>
        <PhoneWhatsAppFields
          phone={form.phone}
          whatsapp={form.whatsapp}
          onChange={(numbers) => set(numbers)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email">
            <input type="email" className="input" value={form.email} onChange={(e) => set({ email: e.target.value })} />
          </Field>
          <Field label="Location">
            <input className="input" value={form.location} placeholder="e.g. Kochi" onChange={(e) => set({ location: e.target.value })} />
          </Field>
          <Field label="Source">
            <select className="input" value={form.source} onChange={(e) => set({ source: e.target.value as Lead['source'] })}>
              {SOURCES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select className="input" value={form.status} onChange={(e) => set({ status: e.target.value as LeadStatus })}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Owner">
            <SearchSelect
              value={form.ownerId}
              onChange={(ownerId) => set({ ownerId })}
              options={employeeOptions(db.employees.filter((e) => e.role !== 'foreman' && e.role !== 'super_admin'))}
              searchPlaceholder="Search people"
              title="Owner"
            />
          </Field>
        </div>
        <Field label="Requirement">
          <textarea rows={2} className="input" value={form.requirement} placeholder="e.g. Terrace garden, approx 1200 sq ft" onChange={(e) => set({ requirement: e.target.value })} />
        </Field>
        <Field label="Notes">
          <textarea rows={2} className="input" value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
        <FormError message={error} />
      </div>
    </Modal>
  )
}
