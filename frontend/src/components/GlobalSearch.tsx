import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDb } from '../state/useDb'
import { useSession } from '../state/session'
import { usePermissions } from '../state/permissions'
import { titleOf } from '../domain/roles'
import type { ModuleKey } from '../domain/types'
import { Icon } from './Icon'

interface Hit {
  group: string
  icon: string
  label: string
  sub: string
  to: string
}

/** Header search across the records the signed-in person can open. Ctrl+K / ⌘K focuses it. */
export function GlobalSearch() {
  const db = useDb()
  const { user } = useSession()
  const { canView } = usePermissions()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const hits = useMemo<Hit[]>(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    const has = (...parts: (string | undefined)[]) => parts.some((p) => p?.toLowerCase().includes(q))
    const out: Hit[] = []
    const add = (module: ModuleKey, items: Hit[]) => { if (canView(module)) out.push(...items.slice(0, 5)) }

    add('Projects', db.projects.filter((p) => has(p.name, p.code, p.siteLocation)).map((p) => ({
      group: 'Projects', icon: 'folder', label: p.name, sub: `${p.code} · ${p.siteLocation}`, to: `/projects/${p.id}`,
    })))
    add('CRM', db.clients.filter((c) => has(c.name, c.phone, c.address)).map((c) => ({
      group: 'Clients', icon: 'users', label: c.name, sub: c.address, to: `/crm/clients/${c.id}`,
    })))
    add('CRM', db.leads.filter((l) => has(l.name, l.phone, l.location, l.requirement)).map((l) => ({
      group: 'Leads', icon: 'users', label: l.name, sub: `${l.status} · ${l.location}`, to: `/crm/leads?open=${l.id}`,
    })))
    add('Employees', db.employees.filter((e) => has(e.name, e.email, e.phone)).map((e) => ({
      group: 'Employees', icon: 'id', label: e.name, sub: titleOf(e), to: `/employees/${e.id}`,
    })))
    add('Employees', db.workers.filter((w) => has(w.name, w.skill, w.phone)).map((w) => ({
      group: 'Execution Workers', icon: 'hardhat', label: w.name, sub: w.skill, to: `/employees/workers/${w.id}`,
    })))
    add('Tasks', db.tasks.filter((t) => has(t.title)).map((t) => ({
      group: 'Tasks', icon: 'check', label: t.title, sub: db.projects.find((p) => p.id === t.projectId)?.name ?? '',
      to: `/tasks/all?open=${t.id}`,
    })))
    // Everyone can find their own profile.
    if (!canView('Employees') && has(user.name)) {
      out.push({ group: 'Employees', icon: 'id', label: user.name, sub: 'My profile', to: `/employees/${user.id}` })
    }
    return out
  }, [query, db, canView, user])

  const go = (hit: Hit) => {
    navigate(hit.to)
    setQuery('')
    setOpen(false)
    inputRef.current?.blur()
  }

  let lastGroup = ''

  return (
    <div className="relative w-full max-w-xs sm:max-w-sm">
      <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setCursor(0) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, hits.length - 1)) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)) }
          if (e.key === 'Enter' && hits[cursor]) go(hits[cursor])
          if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur() }
        }}
        placeholder="Search…"
        aria-label="Search projects, clients, leads, people and tasks"
        className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2 pl-9 pr-3 text-sm text-stone-800 placeholder:text-stone-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/15 sm:pr-14"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded-md border border-stone-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-stone-400 sm:block">
        Ctrl K
      </kbd>

      {open && query.trim().length >= 2 && (
        <div className="absolute right-0 z-40 mt-2 max-h-[70vh] w-[min(26rem,calc(100vw-2rem))] animate-fade-in overflow-y-auto rounded-2xl border border-stone-200 bg-white py-2 shadow-2xl">
          {hits.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-stone-400">Nothing matches “{query.trim()}”.</p>
          ) : hits.map((hit, i) => {
            const header = hit.group !== lastGroup
            lastGroup = hit.group
            return (
              <div key={hit.to + i}>
                {header && <p className="px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-stone-400">{hit.group}</p>}
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => go(hit)}
                  onMouseEnter={() => setCursor(i)}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-left ${i === cursor ? 'bg-brand-50' : ''}`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-500">
                    <Icon name={hit.icon} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-stone-800">{hit.label}</span>
                    <span className="block truncate text-xs text-stone-400">{hit.sub}</span>
                  </span>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
