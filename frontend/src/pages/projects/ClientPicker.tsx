import { useEffect, useRef, useState } from 'react'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import type { ID } from '../../domain/types'
import { Avatar, Badge } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { ClientFormModal } from '../crm/ClientForm'

/**
 * Choosing the client for a project. Search existing clients by name, phone
 * or place; pick a won lead that has not been made a client yet (it is
 * converted on the spot); or add a brand-new client without leaving the form.
 */
export function ClientPicker({ value, onChange }: { value: ID; onChange: (clientId: ID) => void }) {
  const db = useDb()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const search = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    search.current?.focus()
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const selected = db.clients.find((c) => c.id === value)
  const q = query.trim().toLowerCase()
  const has = (...parts: (string | undefined)[]) => !q || parts.some((p) => p?.toLowerCase().includes(q))
  const clients = db.clients.filter((c) => has(c.name, c.phone, c.whatsapp, c.address, c.email))
  const leads = db.leads.filter((l) => !l.clientId && ['Won', 'Quoted'].includes(l.status) && has(l.name, l.phone, l.location))
  const projectCount = (id: ID) => db.projects.filter((p) => p.clientId === id).length

  const choose = (id: ID) => {
    onChange(id)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex w-full items-center gap-3 rounded-xl border bg-white px-3 py-2 text-left shadow-sm transition ${open ? 'border-brand-500 ring-4 ring-brand-500/15' : 'border-stone-300 hover:border-stone-400'}`}
      >
        {selected ? (
          <>
            <Avatar name={selected.name} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-stone-900">{selected.name}</span>
              <span className="block truncate text-xs text-stone-500">{selected.phone} · {selected.address}</span>
            </span>
          </>
        ) : (
          <span className="flex-1 text-sm text-stone-400">Choose a client…</span>
        )}
        <Icon name="chevron" className={`h-4 w-4 shrink-0 text-stone-400 transition ${open ? '-rotate-90' : 'rotate-90'}`} />
      </button>

      {open && (
        <div className="absolute z-30 mt-2 w-full min-w-[300px] animate-fade-in overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl">
          <div className="border-b border-stone-100 p-2">
            <label className="relative block">
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                ref={search}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}
                placeholder="Search clients by name, phone or place"
                className="input border-0 bg-stone-50 pl-9 shadow-none"
              />
            </label>
          </div>
          <div className="max-h-80 overflow-y-auto py-1">
            {clients.length > 0 && <p className="px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-stone-400">Clients</p>}
            {clients.map((c) => (
              <button
                key={c.id} type="button" onClick={() => choose(c.id)}
                className={`flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-brand-50 ${c.id === value ? 'bg-brand-50/70' : ''}`}
              >
                <Avatar name={c.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-stone-800">{c.name}</span>
                  <span className="block truncate text-xs text-stone-400">{c.address} · {c.phone}</span>
                </span>
                {projectCount(c.id) > 0 && <Badge tone="stone">{projectCount(c.id)} project{projectCount(c.id) === 1 ? '' : 's'}</Badge>}
                {c.id === value && <Icon name="check" className="h-4 w-4 text-brand-600" />}
              </button>
            ))}

            {leads.length > 0 && (
              <>
                <p className="px-4 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-stone-400">From leads — becomes a client</p>
                {leads.map((l) => (
                  <button
                    key={l.id} type="button" onClick={() => choose(api.leads.convert(l.id).id)}
                    className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-brand-50"
                  >
                    <Avatar name={l.name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-stone-800">{l.name}</span>
                      <span className="block truncate text-xs text-stone-400">{l.location} · {l.requirement}</span>
                    </span>
                    <Badge tone={l.status === 'Won' ? 'green' : 'clay'}>{l.status} lead</Badge>
                  </button>
                ))}
              </>
            )}

            {clients.length === 0 && leads.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-stone-400">No client or lead matches “{query.trim()}”.</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => { setAdding(true); setOpen(false) }}
            className="flex w-full items-center gap-2 border-t border-stone-100 px-4 py-3 text-sm font-semibold text-brand-700 hover:bg-brand-50"
          >
            <Icon name="plus" className="h-4 w-4" /> Add a new client{q ? ` “${query.trim()}”` : ''}
          </button>
        </div>
      )}

      {adding && <ClientFormModal onClose={() => setAdding(false)} onSaved={(c) => onChange(c.id)} />}
    </div>
  )
}
