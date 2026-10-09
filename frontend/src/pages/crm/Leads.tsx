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

const STATUSES: LeadStatus[] = ['New', 'Contacted', 'Site Visit', 'Quoted', 'Won', 'Lost']
const SOURCES: Lead['source'][] = ['Instagram', 'Referral', 'Website', 'Walk-in', 'Google', 'Exhibition']

/** Leads → Clients → Site Visits is the first of the five connected systems. */
export function Leads() {
  const db = useDb()
  const { can } = usePermissions()
  const [filter, setFilter] = useState<LeadStatus | 'All'>('All')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Lead | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Lead | null>(null)
  const [params, setParams] = useSearchParams()

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
    (filter === 'All' || l.status === filter)
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
        <Pills<LeadStatus | 'All'>
          active={filter}
          onChange={setFilter}
          options={(['All', ...STATUSES] as const).map((s) => ({
            key: s, label: s, count: s === 'All' ? db.leads.length : db.leads.filter((l) => l.status === s).length,
          }))}
        />
        <SearchInput value={query} onChange={setQuery} placeholder="Search leads…" className="lg:w-72" />
      </Toolbar>

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
    ownerId: lead?.ownerId ?? (['marketing', 'ceo'].includes(user.role) ? user.id : 'e10'),
    requirement: lead?.requirement ?? '',
    notes: lead?.notes ?? '',
  })
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<typeof form>) => { setForm({ ...form, ...patch }); setError(null) }

  const save = () => {
    if (!form.name.trim()) return setError('Enter the lead’s name.')
    if (!form.phone.trim()) return setError('Enter a phone number.')
    if (!form.requirement.trim()) return setError('Describe what they are looking for.')
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
          required
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
            <select className="input" value={form.ownerId} onChange={(e) => set({ ownerId: e.target.value })}>
              {db.employees.filter((e) => e.role !== 'foreman' && e.role !== 'super_admin').map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Requirement" required>
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
