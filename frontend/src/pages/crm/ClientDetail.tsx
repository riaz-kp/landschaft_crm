import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { usePermissions } from '../../state/permissions'
import { useDb } from '../../state/useDb'
import { receivable } from '../../domain/finance'
import { formatCurrency, formatDate, whatsappUrl } from '../../domain/format'
import { CLIENT_DEPARTMENTS, type ClientDepartment } from '../../domain/types'
import { PageHeader, Section, EmptyState, StatTile, Tabs, StatusBadge, ConfirmDialog } from '../../components/ui'
import { ContactNumbers } from '../../components/ContactFields'
import { Icon } from '../../components/Icon'
import { ClientFormModal } from './ClientForm'
import { WorkHistory } from './client/WorkHistory'
import { Receivables } from './client/Receivables'
import { DepartmentDesk } from './client/DepartmentDesk'

type Tab = 'history' | 'receivables' | ClientDepartment

export function ClientDetail() {
  const { clientId = '' } = useParams()
  const db = useDb()
  const [tab, setTab] = useState<Tab>('history')
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { can } = usePermissions()
  const navigate = useNavigate()

  const client = db.clients.find((c) => c.id === clientId)
  if (!client) {
    return <Section><EmptyState title="Client not found." hint="It may have been removed." /></Section>
  }

  const lead = db.leads.find((l) => l.id === client.leadId || l.clientId === client.id)
  const projects = db.projects.filter((p) => p.clientId === client.id)
  const money = receivable(db, client.id)
  const openFor = (department: ClientDepartment) =>
    db.clarifications.filter((c) => c.clientId === client.id && c.department === department && c.status === 'Open').length
  const openTotal = CLIENT_DEPARTMENTS.reduce((sum, d) => sum + openFor(d), 0)

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'history', label: 'Work History' },
    { key: 'receivables', label: 'Receivables & Follow-ups' },
    // One desk per department — clarifications, attachments and team chat.
    ...CLIENT_DEPARTMENTS.map((d) => ({ key: d, label: d, count: openFor(d) || undefined })),
  ]

  return (
    <div>
      <PageHeader
        title={client.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{client.address}</span>
            <span className="text-stone-300">·</span>
            <span>Client since {formatDate(client.createdAt)}</span>
          </span>
        }
        actions={<>
          <a href={whatsappUrl(client.whatsapp || client.phone)} target="_blank" rel="noreferrer" className="btn-secondary">
            <Icon name="chat" className="h-4 w-4 text-brand-600" /> WhatsApp
          </a>
          {can('CRM', 'edit') && <button onClick={() => setEditing(true)} className="btn-secondary"><Icon name="edit" className="h-4 w-4" /> Edit</button>}
          {can('CRM', 'delete') && <button onClick={() => setDeleting(true)} className="btn-danger"><Icon name="trash" className="h-4 w-4" /> Delete</button>}
        </>}
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Section title="Contact">
          <dl className="space-y-3 px-5 py-4 text-sm">
            <div>
              <dt className="label">Phone / WhatsApp</dt>
              <dd className="mt-1 text-stone-800"><ContactNumbers phone={client.phone} whatsapp={client.whatsapp} /></dd>
            </div>
            <div>
              <dt className="label">Email</dt>
              <dd className="mt-1 text-stone-800">
                {client.email ? <a href={`mailto:${client.email}`} className="hover:text-brand-700">{client.email}</a> : '—'}
              </dd>
            </div>
            {lead && (
              <div>
                <dt className="label">Came In As</dt>
                <dd className="mt-1 flex items-center gap-2 text-stone-800">
                  {lead.source} lead · {db.employees.find((e) => e.id === lead.ownerId)?.name}
                  <StatusBadge status={lead.status} />
                </dd>
              </div>
            )}
          </dl>
        </Section>
        <div className="grid grid-cols-2 gap-4 lg:col-span-2">
          <StatTile label="Projects" value={projects.length} sub={`${projects.filter((p) => p.status !== 'Completed').length} active`} />
          <StatTile label="Contract Value" value={formatCurrency(money.contracted, true)} />
          <StatTile
            label="Receivable" value={formatCurrency(money.outstanding, true)}
            sub={money.dueNow ? `${formatCurrency(money.dueNow, true)} due now` : 'Nothing raised and unpaid'}
            tone={money.outstanding ? 'amber' : 'green'}
          />
          <StatTile label="Open Clarifications" value={openTotal} tone={openTotal ? 'amber' : 'green'} />
        </div>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'history' && <WorkHistory client={client} />}
      {tab === 'receivables' && <Receivables client={client} />}
      {(CLIENT_DEPARTMENTS as readonly string[]).includes(tab) && (
        <DepartmentDesk key={tab} client={client} department={tab as ClientDepartment} />
      )}

      <Link to="/crm/clients" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800">
        <Icon name="back" className="h-4 w-4" /> All clients
      </Link>

      {editing && <ClientFormModal client={client} onClose={() => setEditing(false)} />}
      {deleting && (
        <ConfirmDialog
          title={`Delete ${client.name}?`}
          onClose={() => setDeleting(false)}
          onConfirm={() => { api.clients.remove(client.id); navigate('/crm/clients') }}
          blocked={projects.length ? `${client.name} has ${projects.length} project(s). A client with projects cannot be deleted.` : undefined}
          message="The client record, its clarifications, team chat and payment follow-ups are removed. The original lead stays."
        />
      )}
    </div>
  )
}
