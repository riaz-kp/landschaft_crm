import type { DbShape } from '../../data/store'
import type { ID, ProjectLogEntry, Task } from '../../domain/types'
import { formatCurrency, today } from '../../domain/format'
import { projectType } from '../../domain/progress'
import { CLIENT_DOCS, clientDocLabel } from '../../domain/clientDocs'

export type HistoryKind = 'tasks' | 'handovers' | 'documents' | 'site' | 'money' | 'project'

export const HISTORY_KINDS: { key: HistoryKind; label: string }[] = [
  { key: 'tasks', label: 'Tasks' },
  { key: 'handovers', label: 'Reassignments' },
  { key: 'documents', label: 'Client documents' },
  { key: 'site', label: 'Site & AMC' },
  { key: 'money', label: 'Accounts' },
  { key: 'project', label: 'Project' },
]

export interface ProjectHistoryItem {
  id: string
  date: string
  /** HH:mm, for entries written as they happened. */
  time?: string
  kind: HistoryKind
  icon: string
  title: string
  detail?: string
  /** Who did it. */
  byId?: ID
  to?: string
}

const nameOf = (db: DbShape, id?: ID) => db.employees.find((e) => e.id === id)?.name ?? 'someone'

/** One logged task or project event as a history line. */
function fromLog(db: DbShape, entry: ProjectLogEntry): ProjectHistoryItem {
  const base = { id: entry.id, date: entry.at.slice(0, 10), time: entry.at.slice(11, 16), byId: entry.byId }
  switch (entry.kind) {
    case 'task-created':
      return {
        ...base, kind: 'tasks', icon: 'plus', title: `Task created — ${entry.title}`,
        detail: [entry.toId && `Assigned to ${nameOf(db, entry.toId)}`, entry.detail].filter(Boolean).join(' · '),
      }
    case 'task-reassigned':
      return {
        ...base, kind: 'handovers', icon: 'repeat', title: `Task reassigned — ${entry.title}`,
        detail: `${nameOf(db, entry.fromId)} → ${nameOf(db, entry.toId)}${entry.detail ? ` · “${entry.detail}”` : ''}`,
      }
    case 'task-done':
      return { ...base, kind: 'tasks', icon: 'check', title: `Task done — ${entry.title}`, detail: entry.detail }
    case 'task-reopened':
      return { ...base, kind: 'tasks', icon: 'history', title: `Task reopened — ${entry.title}`, detail: entry.detail }
    case 'task-deleted':
      return { ...base, kind: 'tasks', icon: 'trash', title: `Task deleted — ${entry.title}`, detail: entry.fromId && `Was with ${nameOf(db, entry.fromId)}` }
    case 'project-edited':
      return { ...base, kind: 'project', icon: 'edit', title: entry.title, detail: entry.detail }
  }
}

/** A finished task with no logged completion (done before the log began) still shows, from the task itself. */
function doneFromTask(task: Task): ProjectHistoryItem {
  return {
    id: `done-${task.id}`, date: task.doneOn ?? task.dueDate, kind: 'tasks', icon: 'check',
    title: `Task done — ${task.title}`, detail: task.doneNote, byId: task.doneBy ?? task.assigneeId,
  }
}

/**
 * Everything that has happened on a project, newest first: task hand-overs,
 * completions and edits as they were logged, plus what the rest of the system
 * already records — documents received, site reports, payments, AMC visits.
 */
export function projectHistory(db: DbShape, projectId: ID): ProjectHistoryItem[] {
  const project = db.projects.find((p) => p.id === projectId)
  if (!project) return []

  const logged = db.projectLog.filter((l) => l.projectId === projectId)
  const items: ProjectHistoryItem[] = logged.map((entry) => fromLog(db, entry))

  items.push({
    id: `start-${project.id}`, date: project.startDate, kind: 'project', icon: 'folder',
    title: 'Project started', detail: [project.code, project.category, projectType(project)].filter(Boolean).join(' · '),
  })
  if (project.status === 'Completed') {
    items.push({ id: `end-${project.id}`, date: project.expectedCompletion, kind: 'project', icon: 'check', title: 'Project handed over' })
  }

  const loggedDone = new Set(logged.filter((l) => l.kind === 'task-done').map((l) => l.taskId))
  for (const task of db.tasks) {
    if (task.projectId === projectId && task.status === 'Done' && !loggedDone.has(task.id)) items.push(doneFromTask(task))
  }

  for (const doc of CLIENT_DOCS) {
    const tick = project.clientDocs?.[doc.key]
    if (tick?.status !== 'Received' || !tick.on) continue
    items.push({
      id: `doc-${doc.key}`, date: tick.on, kind: 'documents', icon: 'doc', byId: tick.by,
      title: `Received from the client — ${clientDocLabel(doc.key)}`, detail: tick.note,
    })
  }

  for (const report of db.reports) {
    if (report.projectId !== projectId || report.status === 'Draft') continue
    const workers = report.attendance.filter((a) => a.present).length
    items.push({
      id: `r-${report.id}`, date: report.date, kind: 'site', icon: 'hammer', byId: report.foremanId,
      title: `Daily site report — ${workers} worker${workers === 1 ? '' : 's'} · ${report.status}`,
      detail: report.workDone.filter((w) => w.trim()).join('; '), to: `/execution/reports/${report.id}`,
    })
  }

  for (const record of db.maintenance.filter((m) => m.projectId === projectId)) {
    for (const visit of record.visits.filter((v) => v.done)) {
      items.push({
        id: `mv-${visit.id}`, date: visit.date, kind: 'site', icon: 'leaf',
        title: `${record.type === 'AMC' ? 'AMC' : 'Free maintenance'} visit`,
        detail: [visit.notes, ...visit.issues].filter(Boolean).join(' · '),
      })
    }
  }

  for (const quote of db.quotations.filter((q) => q.projectId === projectId)) {
    items.push({
      id: `q-${quote.id}`, date: quote.date, kind: 'money', icon: 'doc',
      title: `${quote.kind} ${quote.number} — ${quote.status}`,
      detail: formatCurrency(quote.items.reduce((sum, i) => sum + i.quantity * i.rate, 0)),
    })
  }

  for (const payment of db.payments.filter((p) => p.projectId === projectId)) {
    items.push({
      id: `pay-${payment.id}`, date: payment.date, kind: 'money', icon: 'rupee',
      title: `Payment received — ${formatCurrency(payment.amount)}`, detail: `${payment.method} · ${payment.reference}`,
    })
  }

  return items
    .filter((item) => item.date <= today())
    .sort((a, b) => `${b.date}T${b.time ?? '00:00'}`.localeCompare(`${a.date}T${a.time ?? '00:00'}`))
}

/** One task's own history — created, handed over, done, reopened — newest first. */
export function taskHistory(db: DbShape, task: Task): ProjectHistoryItem[] {
  const logged = db.projectLog.filter((l) => l.taskId === task.id).map((entry) => fromLog(db, entry))
  const doneLogged = db.projectLog.some((l) => l.taskId === task.id && l.kind === 'task-done')
  const items = task.status === 'Done' && !doneLogged ? [...logged, doneFromTask(task)] : logged
  return items.sort((a, b) => `${b.date}T${b.time ?? '00:00'}`.localeCompare(`${a.date}T${a.time ?? '00:00'}`))
}
