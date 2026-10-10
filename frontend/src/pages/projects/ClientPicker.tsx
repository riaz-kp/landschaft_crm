import { useState } from 'react'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import type { ID } from '../../domain/types'
import { Avatar, Badge } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { SearchSelect, type SelectOption } from '../../components/SearchSelect'
import { ClientFormModal } from '../crm/ClientForm'

/** Leads offered in the picker carry this prefix, so choosing one converts it. */
const LEAD = 'lead:'

/**
 * Choosing the client for a project. Search existing clients by name, phone
 * or place; pick a won lead that has not been made a client yet (it is
 * converted on the spot); or add a brand-new client without leaving the form.
 */
export function ClientPicker({ value, onChange }: { value: ID; onChange: (clientId: ID) => void }) {
  const db = useDb()
  const [adding, setAdding] = useState<string | null>(null)
  const projectCount = (id: ID) => db.projects.filter((p) => p.clientId === id).length

  const options: SelectOption[] = [
    ...db.clients.map((c) => {
      const count = projectCount(c.id)
      return {
        value: c.id,
        label: c.name,
        sub: `${c.address} · ${c.phone}`,
        keywords: [c.whatsapp, c.email].filter(Boolean).join(' '),
        group: 'Clients',
        avatar: true,
        badge: count > 0 ? <Badge tone="stone">{count} project{count === 1 ? '' : 's'}</Badge> : undefined,
      }
    }),
    ...db.leads
      .filter((l) => !l.clientId && ['Won', 'Quoted'].includes(l.status))
      .map((l) => ({
        value: LEAD + l.id,
        label: l.name,
        sub: `${l.location} · ${l.requirement}`,
        keywords: l.phone,
        group: 'From leads — becomes a client',
        avatar: true,
        badge: <Badge tone={l.status === 'Won' ? 'green' : 'clay'}>{l.status} lead</Badge>,
      })),
  ]

  return (
    <>
      <SearchSelect
        value={value}
        onChange={(v) => onChange(v.startsWith(LEAD) ? api.leads.convert(v.slice(LEAD.length)).id : v)}
        options={options}
        placeholder="Choose a client…"
        searchPlaceholder="Search clients by name, phone or place"
        title="Client"
        renderValue={(o) => (
          <span className="flex items-center gap-3">
            <Avatar name={o.label} size="sm" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-stone-900">{o.label}</span>
              <span className="block truncate text-xs text-stone-500">{o.sub}</span>
            </span>
          </span>
        )}
        footer={(close, query) => (
          <button
            type="button"
            onClick={() => { setAdding(query); close() }}
            className="flex w-full items-center gap-2 border-t border-stone-100 px-4 py-3 text-sm font-semibold text-brand-700 hover:bg-brand-50"
          >
            <Icon name="plus" className="h-4 w-4 shrink-0" />
            <span className="truncate">Add a new client{query ? ` “${query}”` : ''}</span>
          </button>
        )}
      />

      {adding !== null && (
        <ClientFormModal defaults={{ name: adding }} onClose={() => setAdding(null)} onSaved={(c) => onChange(c.id)} />
      )}
    </>
  )
}
