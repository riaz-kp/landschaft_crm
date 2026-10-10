import type { DbShape } from '../mock/store'
import type { Client, Employee, Lead, Project } from '../domain/types'
import { titleOf } from '../domain/roles'
import type { SelectOption } from './SearchSelect'

/** Projects for a SearchSelect: running ones first, searchable by code, site and client. */
export function projectOptions(
  db: DbShape, projects: Project[] = db.projects, describe?: (p: Project) => string,
): SelectOption[] {
  const running = projects.filter((p) => p.status !== 'Completed')
  const done = projects.filter((p) => p.status === 'Completed')
  return [...running, ...done].map((p) => {
    const client = db.clients.find((c) => c.id === p.clientId)
    return {
      value: p.id,
      label: p.name,
      sub: [describe?.(p), p.code, p.siteLocation, client?.name].filter(Boolean).join(' · '),
      group: done.length ? (p.status === 'Completed' ? 'Completed' : 'Running') : undefined,
    }
  })
}

export function clientOptions(clients: Client[]): SelectOption[] {
  return clients.map((c) => ({
    value: c.id,
    label: c.name,
    sub: [c.address, c.phone].filter(Boolean).join(' · '),
    keywords: [c.whatsapp, c.email].filter(Boolean).join(' '),
    avatar: true,
  }))
}

export function leadOptions(leads: Lead[]): SelectOption[] {
  return leads.map((l) => ({
    value: l.id,
    label: l.name,
    sub: [l.status, l.location].filter(Boolean).join(' · '),
    keywords: [l.phone, l.requirement].filter(Boolean).join(' '),
    avatar: true,
  }))
}

export function employeeOptions(employees: Employee[]): SelectOption[] {
  return employees.map((e) => ({
    value: e.id,
    label: e.name,
    sub: titleOf(e),
    keywords: e.department,
    avatar: e.photo ?? true,
  }))
}
