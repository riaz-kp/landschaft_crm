import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDb } from '../../state/useDb'
import { formatCurrency, formatDate } from '../../domain/format'
import { receivable } from '../../domain/finance'
import { PageHeader, Section, Table, EmptyState, Badge } from '../../components/ui'
import { ContactNumbers } from '../../components/ContactFields'
import { ClientFormModal } from './ClientForm'

export function Clients() {
  const db = useDb()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle="Converted leads and their projects. Open a client for their full record."
        actions={<button onClick={() => setCreating(true)} className="btn-primary">New Client</button>}
      />
      <Section>
        {db.clients.length === 0 ? (
          <EmptyState title="No clients yet." />
        ) : (
          <Table head={['Client', 'Phone / WhatsApp', 'Address', 'Projects', 'Value', 'Outstanding', 'Since']}>
            {db.clients.map((client) => {
              const projects = db.projects.filter((p) => p.clientId === client.id)
              const money = receivable(db, client.id)
              const openClarifications = db.clarifications.filter(
                (c) => c.clientId === client.id && c.status === 'Open',
              ).length
              return (
                <tr key={client.id} className="row-hover">
                  <td className="td">
                    <Link to={`/crm/clients/${client.id}`} className="font-medium text-stone-900 hover:text-brand-700">
                      {client.name}
                    </Link>
                    {client.email && <span className="block text-xs text-stone-400">{client.email}</span>}
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
                </tr>
              )
            })}
          </Table>
        )}
      </Section>

      {creating && (
        <ClientFormModal
          onClose={() => setCreating(false)}
          onSaved={(client) => navigate(`/crm/clients/${client.id}`)}
        />
      )}
    </div>
  )
}
