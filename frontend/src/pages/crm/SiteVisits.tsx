import { useState } from 'react'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { usePermissions } from '../../state/permissions'
import { addDays, formatDate, today } from '../../domain/format'
import type { SiteVisit, SiteVisitStatus } from '../../domain/types'
import {
  PageHeader, Section, StatusBadge, Table, EmptyState, Pills, SearchInput, Toolbar, RowActions,
  ConfirmDialog, Modal, Field, FormError, StatTile, Badge,
} from '../../components/ui'
import { Icon } from '../../components/Icon'
import { SearchSelect } from '../../components/SearchSelect'
import { clientOptions, employeeOptions, leadOptions } from '../../components/pickerOptions'

const STATUSES: SiteVisitStatus[] = ['Scheduled', 'Completed', 'Cancelled']
type Filter = 'upcoming' | 'past' | 'all'

export function SiteVisits() {
  const db = useDb()
  const { can } = usePermissions()
  const [filter, setFilter] = useState<Filter>('upcoming')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<SiteVisit | 'new' | null>(null)
  const [deleting, setDeleting] = useState<SiteVisit | null>(null)

  const subjectName = (v: Pick<SiteVisit, 'leadId' | 'clientId'>) => {
    if (v.leadId) return db.leads.find((l) => l.id === v.leadId)?.name ?? '—'
    if (v.clientId) return db.clients.find((c) => c.id === v.clientId)?.name ?? '—'
    return '—'
  }
  const staffName = (id: string) => db.employees.find((e) => e.id === id)?.name ?? '—'

  const q = query.trim().toLowerCase()
  const visits = [...db.siteVisits]
    .filter((v) => filter === 'all' || (filter === 'upcoming' ? v.date >= today() && v.status === 'Scheduled' : v.date < today() || v.status !== 'Scheduled'))
    .filter((v) => !q || [subjectName(v), v.location, v.notes, staffName(v.assignedTo)].some((s) => s.toLowerCase().includes(q)))
    .sort((a, b) => filter === 'upcoming' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date))

  const upcoming = db.siteVisits.filter((v) => v.date >= today() && v.status === 'Scheduled')

  return (
    <div>
      <PageHeader
        title="Site Visits"
        subtitle="Visits scheduled against leads and clients."
        actions={can('CRM', 'create') && (
          <button onClick={() => setEditing('new')} className="btn-primary"><Icon name="plus" className="h-4 w-4" /> Schedule visit</button>
        )}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Upcoming" value={upcoming.length} tone="blue" icon="calendar" />
        <StatTile label="Next 7 Days" value={upcoming.filter((v) => v.date <= addDays(today(), 7)).length} tone="amber" icon="clock" />
        <StatTile label="Completed" value={db.siteVisits.filter((v) => v.status === 'Completed').length} tone="green" icon="check" />
        <StatTile label="Cancelled" value={db.siteVisits.filter((v) => v.status === 'Cancelled').length} icon="x" />
      </div>

      <Toolbar>
        <Pills<Filter>
          active={filter}
          onChange={setFilter}
          options={[
            { key: 'upcoming', label: 'Upcoming', count: upcoming.length },
            { key: 'past', label: 'Past & closed', count: db.siteVisits.length - upcoming.length },
            { key: 'all', label: 'All', count: db.siteVisits.length },
          ]}
        />
        <SearchInput value={query} onChange={setQuery} placeholder="Search visits…" className="lg:w-72" />
      </Toolbar>

      <Section>
        {visits.length === 0 ? (
          <EmptyState title="No site visits here." icon="pin" />
        ) : (
          <Table head={['Date', 'Lead / Client', 'Location', 'Assigned To', 'Notes', 'Status', '']}>
            {visits.map((visit) => (
              <tr key={visit.id} className="row-hover">
                <td className="td whitespace-nowrap font-medium tabular-nums text-stone-900">
                  {visit.date === today() ? 'Today' : formatDate(visit.date)}
                </td>
                <td className="td">
                  {subjectName(visit)}
                  <span className="ml-1.5"><Badge tone={visit.leadId ? 'blue' : 'green'}>{visit.leadId ? 'Lead' : 'Client'}</Badge></span>
                </td>
                <td className="td">{visit.location}</td>
                <td className="td whitespace-nowrap">{staffName(visit.assignedTo)}</td>
                <td className="td max-w-sm">{visit.notes}</td>
                <td className="td">
                  {can('CRM', 'edit') ? (
                    <select
                      value={visit.status}
                      onChange={(e) => api.siteVisits.update(visit.id, { status: e.target.value as SiteVisitStatus })}
                      className="input w-32 py-1 text-xs" aria-label="Visit status"
                    >
                      {STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  ) : <StatusBadge status={visit.status} />}
                </td>
                <td className="td">
                  <RowActions
                    onEdit={can('CRM', 'edit') ? () => setEditing(visit) : undefined}
                    onDelete={can('CRM', 'delete') ? () => setDeleting(visit) : undefined}
                  />
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Section>

      {editing && <SiteVisitFormModal visit={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmDialog
          title="Delete this site visit?"
          message={<>The visit to {subjectName(deleting)} on {formatDate(deleting.date)} will be removed.</>}
          onClose={() => setDeleting(null)}
          onConfirm={() => api.siteVisits.remove(deleting.id)}
        />
      )}
    </div>
  )
}

function SiteVisitFormModal({ visit, onClose }: { visit?: SiteVisit; onClose: () => void }) {
  const db = useDb()
  const openLeads = db.leads.filter((l) => l.status !== 'Lost')
  const [form, setForm] = useState({
    party: (visit?.clientId ? 'Client' : 'Lead') as 'Lead' | 'Client',
    leadId: visit?.leadId ?? openLeads[0]?.id ?? '',
    clientId: visit?.clientId ?? db.clients[0]?.id ?? '',
    location: visit?.location ?? openLeads[0]?.location ?? '',
    date: visit?.date ?? addDays(today(), 1),
    assignedTo: visit?.assignedTo ?? 'e2',
    status: visit?.status ?? ('Scheduled' as SiteVisitStatus),
    notes: visit?.notes ?? '',
  })
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<typeof form>) => { setForm({ ...form, ...patch }); setError(null) }

  // Pick up the location from the lead or client unless one has been typed.
  const suggestLocation = (patch: Partial<typeof form>) => {
    const next = { ...form, ...patch }
    const place = next.party === 'Lead'
      ? db.leads.find((l) => l.id === next.leadId)?.location
      : db.clients.find((c) => c.id === next.clientId)?.address
    set({ ...patch, location: form.location && visit ? form.location : place ?? '' })
  }

  const save = () => {
    if (form.party === 'Lead' && !form.leadId) return setError('Pick the lead.')
    if (form.party === 'Client' && !form.clientId) return setError('Pick the client.')
    if (!form.location.trim()) return setError('Enter where the visit is.')
    if (!form.date) return setError('Pick a date.')
    const values = {
      leadId: form.party === 'Lead' ? form.leadId : undefined,
      clientId: form.party === 'Client' ? form.clientId : undefined,
      location: form.location.trim(),
      date: form.date,
      assignedTo: form.assignedTo,
      status: form.status,
      notes: form.notes.trim(),
    }
    if (visit) api.siteVisits.update(visit.id, values)
    else api.siteVisits.create(values)
    onClose()
  }

  return (
    <Modal
      title={visit ? 'Edit site visit' : 'Schedule a site visit'}
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={save} className="btn-primary">{visit ? 'Save changes' : 'Schedule'}</button>
      </>}
    >
      <div className="space-y-4">
        <div>
          <p className="label">Visit for</p>
          <div className="mt-2 flex gap-2">
            {(['Lead', 'Client'] as const).map((p) => (
              <button key={p} type="button" onClick={() => suggestLocation({ party: p })} className={`chip px-3.5 py-1.5 text-sm ${form.party === p ? 'chip-on' : ''}`}>{p}</button>
            ))}
          </div>
          <div className="mt-2">
            {form.party === 'Lead' ? (
              <SearchSelect
                value={form.leadId}
                onChange={(leadId) => suggestLocation({ leadId })}
                options={leadOptions(openLeads)}
                searchPlaceholder="Search leads"
                ariaLabel="Lead"
                title="Lead"
              />
            ) : (
              <SearchSelect
                value={form.clientId}
                onChange={(clientId) => suggestLocation({ clientId })}
                options={clientOptions(db.clients)}
                searchPlaceholder="Search clients by name, phone or place"
                ariaLabel="Client"
                title="Client"
              />
            )}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Location" required>
            <input className="input" value={form.location} onChange={(e) => set({ location: e.target.value })} />
          </Field>
          <Field label="Date" required>
            <input type="date" className="input" value={form.date} onChange={(e) => set({ date: e.target.value })} />
          </Field>
          <Field label="Assigned to">
            <SearchSelect
              value={form.assignedTo}
              onChange={(assignedTo) => set({ assignedTo })}
              options={employeeOptions(db.employees.filter((e) => e.role !== 'super_admin'))}
              searchPlaceholder="Search people"
              title="Assign to"
            />
          </Field>
          <Field label="Status">
            <select className="input" value={form.status} onChange={(e) => set({ status: e.target.value as SiteVisitStatus })}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Notes">
          <textarea rows={3} className="input" value={form.notes} placeholder="What to check on site" onChange={(e) => set({ notes: e.target.value })} />
        </Field>
        <FormError message={error} />
      </div>
    </Modal>
  )
}
