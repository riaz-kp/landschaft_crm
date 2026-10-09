import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { usePermissions } from '../../state/permissions'
import { formatCurrency, formatDate, today } from '../../domain/format'
import { receivable } from '../../domain/finance'
import type { Client } from '../../domain/types'
import {
  PageHeader, Section, Table, EmptyState, Badge, SearchInput, Toolbar, RowActions, ConfirmDialog, StatTile, Avatar,
} from '../../components/ui'
import { ContactNumbers } from '../../components/ContactFields'
import { Icon } from '../../components/Icon'
import { ClientFormModal } from './ClientForm'
import { ClientImportModal } from './ClientImport'
import { RUPEES, excelDate, exportWorkbook, sheet } from '../../components/excel'

export function Clients() {
  const db = useDb()
  const { can } = usePermissions()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Client | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Client | null>(null)
  const [importing, setImporting] = useState(false)

  const q = query.trim().toLowerCase()
  const clients = db.clients.filter((c) =>
    !q || [c.name, c.phone, c.whatsapp, c.address, c.email ?? ''].some((v) => v.toLowerCase().includes(q)))
  const totals = db.clients.map((c) => receivable(db, c.id))
  const outstanding = totals.reduce((s, m) => s + m.outstanding, 0)

  /** The client list as shown — search applied — with contact details and money. */
  const exportClients = () => exportWorkbook(`Landschaft clients ${today()}`, [
    sheet({
      name: 'Clients',
      rows: clients,
      columns: [
        { header: 'Name', value: (c) => c.name, width: 30 },
        { header: 'Phone', value: (c) => c.phone, width: 18 },
        { header: 'WhatsApp', value: (c) => c.whatsapp, width: 18 },
        { header: 'Email', value: (c) => c.email, width: 28 },
        { header: 'Address', value: (c) => c.address, width: 32 },
        { header: 'Projects', value: (c) => db.projects.filter((p) => p.clientId === c.id).length, width: 10 },
        { header: 'Contract value (₹)', value: (c) => receivable(db, c.id).contracted, width: 18, format: RUPEES },
        { header: 'Outstanding (₹)', value: (c) => receivable(db, c.id).outstanding, width: 16, format: RUPEES },
        { header: 'Client since', value: (c) => excelDate(c.createdAt), width: 13 },
      ],
    }),
  ])

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle="Converted leads and their projects. Open a client for their full record."
        actions={<>
          <button onClick={exportClients} className="btn-secondary"><Icon name="upload" className="h-4 w-4 rotate-180" /> Export</button>
          {can('CRM', 'create') && (
            <>
              <button onClick={() => setImporting(true)} className="btn-secondary"><Icon name="upload" className="h-4 w-4" /> Import from Excel</button>
              <button onClick={() => setEditing('new')} className="btn-primary"><Icon name="plus" className="h-4 w-4" /> New client</button>
            </>
          )}
        </>}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Clients" value={db.clients.length} icon="users" />
        <StatTile label="With Live Projects" value={db.clients.filter((c) => db.projects.some((p) => p.clientId === c.id && p.status !== 'Completed')).length} tone="green" icon="folder" />
        <StatTile label="Contract Value" value={formatCurrency(totals.reduce((s, m) => s + m.contracted, 0), true)} tone="blue" icon="rupee" />
        <StatTile label="Outstanding" value={formatCurrency(outstanding, true)} tone={outstanding ? 'amber' : 'green'} icon="alert" />
      </div>

      <Toolbar>
        <p className="text-sm text-stone-500">{clients.length} of {db.clients.length} clients</p>
        <SearchInput value={query} onChange={setQuery} placeholder="Search name, phone, address…" className="lg:w-80" />
      </Toolbar>

      <Section>
        {clients.length === 0 ? (
          <EmptyState title={q ? 'No clients match.' : 'No clients yet.'} icon="users" />
        ) : (
          <Table head={['Client', 'Phone / WhatsApp', 'Address', 'Projects', 'Value', 'Outstanding', 'Since', '']}>
            {clients.map((client) => {
              const projects = db.projects.filter((p) => p.clientId === client.id)
              const money = receivable(db, client.id)
              const openClarifications = db.clarifications.filter(
                (c) => c.clientId === client.id && c.status === 'Open',
              ).length
              return (
                <tr key={client.id} className="row-hover">
                  <td className="td">
                    <Link to={`/crm/clients/${client.id}`} className="flex items-center gap-2.5">
                      <Avatar name={client.name} size="sm" />
                      <span className="min-w-0">
                        <span className="block font-medium text-stone-900 hover:text-brand-700">{client.name}</span>
                        {client.email && <span className="block truncate text-xs text-stone-400">{client.email}</span>}
                      </span>
                    </Link>
                    {openClarifications > 0 && (
                      <span className="mt-1 block"><Badge tone="amber">{openClarifications} open clarification{openClarifications > 1 ? 's' : ''}</Badge></span>
                    )}
                  </td>
                  <td className="td"><ContactNumbers phone={client.phone} whatsapp={client.whatsapp} /></td>
                  <td className="td">{client.address}</td>
                  <td className="td">
                    {projects.length === 0 ? (
                      <span className="text-stone-400">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {projects.map((p) => (
                          <Link key={p.id} to={`/projects/${p.id}`}>
                            <Badge tone="green">{p.code}</Badge>
                          </Link>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="td tabular-nums">{money.contracted ? formatCurrency(money.contracted) : '—'}</td>
                  <td className="td tabular-nums">
                    {money.outstanding ? (
                      <span className="font-semibold text-amber-700">{formatCurrency(money.outstanding)}</span>
                    ) : '—'}
                  </td>
                  <td className="td tabular-nums">{formatDate(client.createdAt)}</td>
                  <td className="td">
                    <RowActions
                      onEdit={can('CRM', 'edit') ? () => setEditing(client) : undefined}
                      onDelete={can('CRM', 'delete') ? () => setDeleting(client) : undefined}
                    />
                  </td>
                </tr>
              )
            })}
          </Table>
        )}
      </Section>

      {editing && (
        <ClientFormModal
          client={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={(client) => editing === 'new' && navigate(`/crm/clients/${client.id}`)}
        />
      )}
      {importing && <ClientImportModal onClose={() => setImporting(false)} />}
      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          onClose={() => setDeleting(null)}
          onConfirm={() => api.clients.remove(deleting.id)}
          blocked={db.projects.some((p) => p.clientId === deleting.id)
            ? `${deleting.name} has ${db.projects.filter((p) => p.clientId === deleting.id).length} project(s). A client with projects cannot be deleted.`
            : undefined}
          message="The client record, its clarifications, team chat and payment follow-ups are removed. The original lead stays."
        />
      )}
    </div>
  )
}
