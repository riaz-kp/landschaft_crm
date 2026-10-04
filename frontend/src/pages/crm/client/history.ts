import type { DbShape } from '../../../mock/store'
import { DESIGN_PHASES, type Department, type ID, type PhaseKey } from '../../../domain/types'
import { formatCurrency, today } from '../../../domain/format'

export interface HistoryItem {
  id: string
  date: string
  department: Department
  icon: string
  title: string
  detail?: string
  to?: string
}

const isDesignPhase = (phase: PhaseKey) => (DESIGN_PHASES as readonly string[]).includes(phase)

/**
 * Everything done for a client, newest first — assembled from the records the
 * rest of the system already keeps, so nothing has to be logged twice.
 */
export function clientHistory(db: DbShape, clientId: ID): HistoryItem[] {
  const client = db.clients.find((c) => c.id === clientId)
  if (!client) return []

  const projects = db.projects.filter((p) => p.clientId === clientId)
  const projectIds = new Set(projects.map((p) => p.id))
  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? ''
  const departmentOf = (employeeId: ID): Department =>
    db.employees.find((e) => e.id === employeeId)?.department ?? 'Management'
  const lead = db.leads.find((l) => l.id === client.leadId || l.clientId === clientId)

  const items: HistoryItem[] = []

  if (lead) {
    items.push({
      id: `lead-${lead.id}`, date: lead.createdAt, department: 'Marketing', icon: 'users',
      title: `Enquiry received via ${lead.source}`, detail: lead.requirement,
    })
  }
  items.push({
    id: `client-${client.id}`, date: client.createdAt, department: 'Marketing', icon: 'check',
    title: 'Became a client',
  })

  for (const visit of db.siteVisits) {
    const ours = visit.clientId === clientId || (lead && visit.leadId === lead.id)
    if (!ours || visit.status !== 'Completed') continue
    items.push({
      id: `sv-${visit.id}`, date: visit.date, department: departmentOf(visit.assignedTo), icon: 'pin',
      title: `Site visit — ${visit.location}`, detail: visit.notes,
    })
  }

  for (const quote of db.quotations.filter((q) => q.clientId === clientId)) {
    const total = quote.items.reduce((sum, i) => sum + i.quantity * i.rate, 0)
    items.push({
      id: `q-${quote.id}`, date: quote.date, department: 'Accounts', icon: 'doc',
      title: `Quotation ${quote.number} — ${quote.status}`, detail: formatCurrency(total),
      to: '/accounts/quotations',
    })
  }

  for (const project of projects) {
    items.push({
      id: `ps-${project.id}`, date: project.startDate,
      department: project.services.design ? 'Design' : 'Execution', icon: 'folder',
      title: `Project started — ${project.name}`, detail: project.code, to: `/projects/${project.id}`,
    })
    if (project.status === 'Completed') {
      items.push({
        id: `pc-${project.id}`, date: project.expectedCompletion, department: 'Execution', icon: 'check',
        title: `Project handed over — ${project.name}`, to: `/projects/${project.id}`,
      })
    }
  }

  for (const task of db.tasks) {
    if (!projectIds.has(task.projectId) || task.status !== 'Done' || task.dueDate > today()) continue
    const department: Department = task.phase
      ? isDesignPhase(task.phase) ? 'Design' : 'Execution'
      : departmentOf(task.assigneeId)
    items.push({
      id: `t-${task.id}`, date: task.dueDate, department, icon: 'check',
      title: task.title, detail: projectName(task.projectId), to: `/projects/${task.projectId}`,
    })
  }

  for (const report of db.reports) {
    if (!projectIds.has(report.projectId) || report.status === 'Draft' || report.status === 'Sent Back') continue
    const workers = report.attendance.filter((a) => a.present).length
    items.push({
      id: `r-${report.id}`, date: report.date, department: 'Execution', icon: 'hammer',
      title: `Daily site report — ${workers} worker${workers === 1 ? '' : 's'}`,
      detail: report.workDone.filter((w) => w.trim()).join('; '),
      to: `/execution/reports/${report.id}`,
    })
  }

  for (const record of db.maintenance.filter((m) => projectIds.has(m.projectId))) {
    if (record.startDate <= today()) {
      items.push({
        id: `m-${record.id}`, date: record.startDate, department: 'AMC', icon: 'leaf',
        title: `${record.type} began — ${projectName(record.projectId)}`, detail: record.visitSchedule,
        to: '/amc',
      })
    }
    for (const visit of record.visits.filter((v) => v.done)) {
      items.push({
        id: `mv-${visit.id}`, date: visit.date, department: 'AMC', icon: 'leaf',
        title: `${record.type === 'AMC' ? 'AMC' : 'Free maintenance'} visit`,
        detail: [visit.notes, ...visit.issues].filter(Boolean).join(' · '),
        to: '/amc/visits',
      })
    }
  }

  for (const payment of db.payments.filter((p) => p.clientId === clientId)) {
    items.push({
      id: `pay-${payment.id}`, date: payment.date, department: 'Accounts', icon: 'rupee',
      title: `Payment received — ${formatCurrency(payment.amount)}`,
      detail: `${payment.method} · ${payment.reference}`,
    })
  }

  for (const c of db.clarifications.filter((c) => c.clientId === clientId && c.status === 'Resolved')) {
    items.push({
      id: `cl-${c.id}`, date: c.answeredOn ?? c.raisedOn, department: c.department, icon: 'help',
      title: `Clarified: ${c.question}`, detail: c.answer,
    })
  }

  for (const c of db.consultations.filter((c) => c.clientId === clientId && c.status === 'Completed')) {
    items.push({
      id: `cs-${c.id}`, date: c.date, department: 'Management', icon: 'clock',
      title: `CEO consultation — ${c.purpose}`, detail: c.notes,
    })
  }

  return items
    .filter((item) => item.date <= today())
    .sort((a, b) => b.date.localeCompare(a.date))
}
