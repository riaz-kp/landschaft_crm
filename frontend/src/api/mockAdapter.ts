import { nextId, nowTime, store } from '../mock/store'
import { addDays, today } from '../domain/format'
import type {
  ChatMessage, Clarification, Client, Consultation, DailyWorkReport, DocumentRecord, Employee, ID,
  Lead, MaintenanceRecord, PayRecord, PaymentFollowUp, Project, ProjectMessage, Quotation, Settings, SiteVisit,
  Task, Worker, Reminder,
} from '../domain/types'
import type { Api, NewProjectInput } from './client'
import { workerSkills } from '../domain/workers'

type WithId = { id: ID }

function patchIn<T extends WithId>(list: T[], id: ID, patch: Partial<Omit<T, 'id'>>) {
  const record = list.find((x) => x.id === id)
  if (record) Object.assign(record, patch)
}

function removeFrom<T extends WithId>(list: T[], id: ID) {
  const index = list.findIndex((x) => x.id === id)
  if (index >= 0) list.splice(index, 1)
}

/** A blank issue line, or the literal "Nothing", raises no alert. */
function isRealIssue(text: string): boolean {
  const t = text.trim().toLowerCase()
  return t.length > 0 && t !== 'nothing' && t !== 'nil' && t !== 'none'
}

/** The project's foreman-facing manager, who reviews their reports. */
function reviewerFor(projectId: ID): ID {
  const project = store.db.projects.find((p) => p.id === projectId)
  return project?.projectManagerId ?? 'e7'
}

export const adapter: Api = {
  projects: {
    create(input: NewProjectInput): Project {
      const id = nextId('p')
      const year = new Date().getFullYear()
      const seq = String(store.db.projects.length + 1).padStart(3, '0')
      const project: Project = {
        id,
        code: `LS-${year}-${seq}`,
        name: input.name,
        clientId: input.clientId,
        siteLocation: input.siteLocation,
        projectManagerId: input.projectManagerId,
        startDate: input.startDate,
        expectedCompletion: input.expectedCompletion,
        status: 'Planning',
        services: input.services,
        design: {
          concept: { enabled: input.services.design && input.designPhases.concept, progress: 0 },
          threeD: { enabled: input.services.design && input.designPhases.threeD, progress: 0 },
          civilWork: { enabled: input.services.design && input.designPhases.civilWork, progress: 0 },
          boq: { enabled: input.services.design && input.designPhases.boq, progress: 0 },
        },
        execution: {
          hardscape: { enabled: input.services.execution && input.executionPhases.hardscape, progress: 0 },
          softscape: { enabled: input.services.execution && input.executionPhases.softscape, progress: 0 },
          mep: {
            enabled: input.services.execution && input.executionPhases.mep,
            progress: 0,
            services: {
              irrigation: input.executionPhases.irrigation,
              electrical: input.executionPhases.electrical,
              drainage: input.executionPhases.drainage,
            },
          },
          // Maintenance follows execution automatically — the free month.
          maintenance: { enabled: input.services.execution, progress: 0 },
        },
        value: input.value,
        delayed: false,
        siteCoords: input.siteCoords,
        checklist: {},
      }
      store.update((db) => {
        db.projects.push(project)
        // Selling AMC with the project opens its maintenance contract straight away.
        if (input.services.amc && input.amc) {
          db.maintenance.push({ ...input.amc, id: nextId('m'), projectId: id, type: 'AMC', visits: [] })
        }
      })
      return project
    },

    update(projectId, patch) {
      store.update((db) => patchIn(db.projects, projectId, patch))
    },

    setChecklist(projectId, itemId, done, by) {
      store.update((db) => {
        const project = db.projects.find((p) => p.id === projectId)
        if (!project) return
        project.checklist = { ...project.checklist, [itemId]: done ? { done, by, on: today() } : { done } }
      })
    },

    setForemen(projectId, foremanIds) {
      store.update((db) => {
        db.siteAssignments = [
          ...db.siteAssignments.filter((a) => a.projectId !== projectId),
          ...[...new Set(foremanIds)].map((foremanId) => ({ foremanId, projectId })),
        ]
      })
    },

    setPhaseProgress(projectId, phaseKey, progress) {
      store.update((db) => {
        const project = db.projects.find((p) => p.id === projectId)
        if (!project) return
        const clamped = Math.max(0, Math.min(100, Math.round(progress)))
        if (phaseKey in project.design) {
          project.design[phaseKey as keyof typeof project.design].progress = clamped
        } else if (phaseKey in project.execution) {
          project.execution[phaseKey as keyof typeof project.execution].progress = clamped
        }
      })
    },
  },

  reports: {
    draftFor(projectId, foremanId, date) {
      const existing = store.db.reports.find(
        (r) => r.projectId === projectId && r.foremanId === foremanId && r.date === date,
      )
      if (existing) return existing

      const project = store.db.projects.find((p) => p.id === projectId)
      const report: DailyWorkReport = {
        id: nextId('r'),
        projectId,
        siteLocation: project?.siteLocation ?? '',
        date,
        foremanId,
        // Every active worker starts unticked; the foreman marks who turned up.
        attendance: store.db.workers
          .filter((w) => w.active)
          .map((w) => ({ workerId: w.id, present: false })),
        startTime: '',
        endTime: '',
        otHours: 0,
        workDone: [''],
        issues: [''],
        nextDayPlan: [''],
        ta: [],
        photos: [],
        status: 'Draft',
      }
      store.update((db) => {
        db.reports.push(report)
      })
      return report
    },

    save(report) {
      store.update((db) => {
        const index = db.reports.findIndex((r) => r.id === report.id)
        if (index >= 0) db.reports[index] = report
      })
    },

    submit(reportId, foremanId) {
      store.update((db) => {
        const report = db.reports.find((r) => r.id === reportId)
        if (!report) return
        report.status = 'Submitted'
        report.submittedAt = nowTime()
        report.submittedBy = foremanId
        report.reviewNote = undefined

        // Anything other than "Nothing" becomes an alert for the Execution PM.
        const assignedTo = reviewerFor(report.projectId)
        for (const text of report.issues) {
          if (!isRealIssue(text)) continue
          const duplicate = db.issues.some((i) => i.reportId === report.id && i.text === text.trim())
          if (duplicate) continue
          db.issues.push({
            id: nextId('i'),
            projectId: report.projectId,
            reportId: report.id,
            text: text.trim(),
            raisedBy: foremanId,
            assignedTo,
            date: report.date,
            status: 'Open',
          })
        }
      })
    },

    approve(reportId, reviewerId, note) {
      store.update((db) => {
        const report = db.reports.find((r) => r.id === reportId)
        if (!report) return
        report.status = 'Approved'
        report.reviewedAt = nowTime()
        report.reviewedBy = reviewerId
        report.reviewNote = note

        // An approved report feeds the next day's plan into real tasks.
        const project = db.projects.find((p) => p.id === report.projectId)
        for (const line of report.nextDayPlan) {
          if (!line.trim()) continue
          const already = db.tasks.some((t) => t.fromReportId === report.id && t.title === line.trim())
          if (already) continue
          db.tasks.push({
            id: nextId('t'),
            projectId: report.projectId,
            title: line.trim(),
            assigneeId: project?.projectManagerId ?? reviewerId,
            status: 'To Do',
            priority: 'Medium',
            dueDate: addDays(report.date, 1),
            fromReportId: report.id,
          })
        }
      })
    },

    sendBack(reportId, reviewerId, note) {
      store.update((db) => {
        const report = db.reports.find((r) => r.id === reportId)
        if (!report) return
        report.status = 'Sent Back'
        report.reviewedAt = nowTime()
        report.reviewedBy = reviewerId
        report.reviewNote = note
      })
    },

    setOt(reportId, hours) {
      store.update((db) => {
        const report = db.reports.find((r) => r.id === reportId)
        if (report) report.otHours = Math.max(0, hours)
      })
    },
  },

  leads: {
    create(input): Lead {
      const lead: Lead = { ...input, id: nextId('l'), createdAt: today() }
      store.update((db) => {
        db.leads.unshift(lead)
      })
      return lead
    },
    update(leadId, patch) {
      store.update((db) => patchIn(db.leads, leadId, patch))
    },
    remove(leadId) {
      store.update((db) => {
        removeFrom(db.leads, leadId)
        // Visits booked against the lead go with it; a converted client stays.
        db.siteVisits = db.siteVisits.filter((v) => v.leadId !== leadId)
      })
    },

    setStatus(leadId, status) {
      store.update((db) => {
        const lead = db.leads.find((l) => l.id === leadId)
        if (lead) lead.status = status
      })
    },

    convert(leadId): Client {
      const lead = store.db.leads.find((l) => l.id === leadId)
      const client: Client = {
        id: nextId('c'),
        name: lead?.name ?? 'New Client',
        phone: lead?.phone ?? '',
        // The lead's WhatsApp carries over; older leads without one fall back to the phone.
        whatsapp: lead?.whatsapp || lead?.phone || '',
        email: lead?.email,
        address: lead?.location ?? '',
        leadId,
        createdAt: today(),
      }
      store.update((db) => {
        db.clients.push(client)
        const target = db.leads.find((l) => l.id === leadId)
        if (target) {
          target.status = 'Won'
          target.clientId = client.id
        }
      })
      return client
    },
  },

  clients: {
    create(input): Client {
      const client: Client = { ...input, id: nextId('c'), createdAt: today() }
      store.update((db) => {
        db.clients.push(client)
      })
      return client
    },
    update(clientId, patch) {
      store.update((db) => patchIn(db.clients, clientId, patch))
    },
    /** Callers block this while the client still has projects. */
    remove(clientId) {
      store.update((db) => {
        removeFrom(db.clients, clientId)
        for (const lead of db.leads) if (lead.clientId === clientId) lead.clientId = undefined
        db.clarifications = db.clarifications.filter((c) => c.clientId !== clientId)
        db.chatMessages = db.chatMessages.filter((c) => c.clientId !== clientId)
        db.followUps = db.followUps.filter((f) => f.clientId !== clientId)
        db.siteVisits = db.siteVisits.filter((v) => v.clientId !== clientId)
      })
    },
  },

  clarifications: {
    create(input): Clarification {
      const record: Clarification = { ...input, id: nextId('cl'), status: 'Open' }
      store.update((db) => {
        db.clarifications.push(record)
      })
      return record
    },
    resolve(clarificationId, answer, answeredBy) {
      store.update((db) => {
        const record = db.clarifications.find((c) => c.id === clarificationId)
        if (!record) return
        record.status = 'Resolved'
        record.answer = answer
        record.answeredBy = answeredBy
        record.answeredOn = today()
      })
    },
  },

  chat: {
    post(input): ChatMessage {
      const message: ChatMessage = { ...input, id: nextId('ch'), at: `${today()}T${nowTime()}` }
      store.update((db) => {
        db.chatMessages.push(message)
      })
      return message
    },
  },

  followUps: {
    create(input): PaymentFollowUp {
      const record: PaymentFollowUp = { ...input, id: nextId('fu') }
      store.update((db) => {
        db.followUps.push(record)
      })
      return record
    },
  },

  documents: {
    create(input): DocumentRecord {
      const record: DocumentRecord = { ...input, id: nextId('d') }
      store.update((db) => {
        db.documents.push(record)
      })
      return record
    },
  },

  employees: {
    create(input): Employee {
      const employee: Employee = { ...input, id: nextId('e') }
      store.update((db) => {
        db.employees.push(employee)
      })
      return employee
    },
    update(employeeId, patch) {
      store.update((db) => patchIn(db.employees, employeeId, patch))
    },
    remove(employeeId) {
      store.update((db) => {
        // Their direct reports move up to whoever they reported to.
        const leaving = db.employees.find((e) => e.id === employeeId)
        removeFrom(db.employees, employeeId)
        for (const e of db.employees) if (e.reportsTo === employeeId) e.reportsTo = leaving?.reportsTo
        db.attendance = db.attendance.filter((a) => !(a.kind === 'employee' && a.personId === employeeId))
        db.siteAssignments = db.siteAssignments.filter((a) => a.foremanId !== employeeId)
      })
    },
  },

  workers: {
    create(input): Worker {
      const worker: Worker = { ...input, id: nextId('w') }
      store.update((db) => {
        db.workers.push(worker)
      })
      return worker
    },
    update(workerId, patch) {
      store.update((db) => patchIn(db.workers, workerId, patch))
    },
    /** Past reports keep the worker's lines; they simply show the id. Deactivate to keep history readable. */
    remove(workerId) {
      store.update((db) => {
        removeFrom(db.workers, workerId)
        db.attendance = db.attendance.filter((a) => !(a.kind === 'worker' && a.personId === workerId))
      })
    },
    addSkill(name) {
      const clean = name.trim().replace(/\s+/g, ' ')
      const existing = workerSkills(store.db).find((s) => s.toLowerCase() === clean.toLowerCase())
      if (existing) {
        if (!store.db.settings.workerSkills.includes(existing)) {
          store.update((db) => { db.settings.workerSkills = [...db.settings.workerSkills, existing] })
        }
        return existing
      }
      store.update((db) => { db.settings.workerSkills = [...db.settings.workerSkills, clean] })
      return clean
    },
    renameSkill(from, to) {
      const clean = to.trim().replace(/\s+/g, ' ')
      if (!clean || clean === from) return
      store.update((db) => {
        const rest = db.settings.workerSkills.filter((s) => s !== from && s.toLowerCase() !== clean.toLowerCase())
        db.settings.workerSkills = [...rest, clean]
        for (const w of db.workers) if (w.skill === from) w.skill = clean
      })
    },
    removeSkill(name) {
      store.update((db) => { db.settings.workerSkills = db.settings.workerSkills.filter((s) => s !== name) })
    },
  },

  attendance: {
    set(kind, personId, date, patch) {
      store.update((db) => {
        const index = db.attendance.findIndex((a) => a.kind === kind && a.personId === personId && a.date === date)
        if (patch === null) {
          if (index >= 0) db.attendance.splice(index, 1)
          return
        }
        const existing = index >= 0 ? db.attendance[index] : undefined
        const status = patch.status ?? existing?.status ?? 'Present'
        const working = (s?: string) => s === 'Present' || s === 'Half Day'
        // A field named in the patch wins even when it is empty, so a time or overtime can be cleared.
        const pick = <K extends 'checkIn' | 'checkOut' | 'otHours'>(key: K) =>
          key in patch ? patch[key] || undefined : existing?.[key]

        // Someone newly marked in gets the working hours from Settings. Switching between a
        // full and a half day moves a time out that was still the default along with it.
        const hours = db.settings.workHours
        const defaultOut = status === 'Half Day' ? hours.halfDayEnd : hours.end
        const otherOut = status === 'Half Day' ? hours.end : hours.halfDayEnd
        const wasWorking = working(existing?.status)
        const keptOut = existing?.checkOut === otherOut ? defaultOut : existing?.checkOut

        const entry = {
          kind, personId, date, status,
          // Leave and absence clear the times.
          checkIn: working(status) ? ('checkIn' in patch ? pick('checkIn') : wasWorking ? existing?.checkIn : hours.start) : undefined,
          checkOut: working(status) ? ('checkOut' in patch ? pick('checkOut') : wasWorking ? keptOut : defaultOut) : undefined,
          otHours: working(status) ? pick('otHours') : undefined,
        }
        if (index >= 0) db.attendance[index] = entry
        else db.attendance.push(entry)
      })
    },
    setHoliday(date, off) {
      store.update((db) => {
        const rest = db.settings.holidays.filter((d) => d !== date)
        db.settings.holidays = off ? [...rest, date].sort() : rest
      })
    },
  },

  consultations: {
    create(input): Consultation {
      const record: Consultation = { ...input, id: nextId('cs'), status: 'Scheduled' }
      store.update((db) => {
        db.consultations.push(record)
      })
      return record
    },
    setStatus(consultationId, status, notes) {
      store.update((db) => {
        const record = db.consultations.find((c) => c.id === consultationId)
        if (!record) return
        record.status = status
        if (notes !== undefined) record.notes = notes
      })
    },
    setPlace(consultationId, location, coords) {
      store.update((db) => patchIn(db.consultations, consultationId, { location, coords }))
    },
    postpone(consultationId, date, start, reason, by) {
      store.update((db) => {
        const record = db.consultations.find((c) => c.id === consultationId)
        if (!record) return
        record.postponements = [
          ...(record.postponements ?? []),
          { fromDate: record.date, fromStart: record.start, toDate: date, toStart: start, reason, by, at: `${today()}T${nowTime()}` },
        ]
        record.date = date
        record.start = start
      })
    },
  },

  amc: {
    create(input): MaintenanceRecord {
      const record: MaintenanceRecord = { ...input, id: nextId('m'), visits: [] }
      store.update((db) => {
        db.maintenance.push(record)
        const project = db.projects.find((p) => p.id === input.projectId)
        if (project && input.type === 'AMC') project.services = { ...project.services, amc: true }
      })
      return record
    },
    update(recordId, patch) {
      store.update((db) => {
        const record = db.maintenance.find((m) => m.id === recordId)
        if (record) Object.assign(record, patch)
      })
    },
    remove(recordId) {
      store.update((db) => {
        const index = db.maintenance.findIndex((m) => m.id === recordId)
        if (index >= 0) db.maintenance.splice(index, 1)
      })
    },
    scheduleVisit(recordId, date, teamIds, plannedFor) {
      store.update((db) => {
        const record = db.maintenance.find((m) => m.id === recordId)
        record?.visits.push({ id: nextId('mv'), date, teamIds, notes: '', issues: [], photoCount: 0, done: false, plannedFor })
      })
    },
    moveVisit(recordId, visitId, date, teamIds) {
      store.update((db) => {
        const visit = db.maintenance.find((m) => m.id === recordId)?.visits.find((v) => v.id === visitId)
        if (!visit) return
        visit.plannedFor = visit.plannedFor ?? visit.date
        visit.date = date
        visit.teamIds = teamIds
      })
    },
    completeVisit(recordId, visitId, notes, issues) {
      store.update((db) => {
        const visit = db.maintenance.find((m) => m.id === recordId)?.visits.find((v) => v.id === visitId)
        if (!visit) return
        visit.done = true
        visit.notes = notes
        visit.issues = issues.filter((i) => i.trim())
      })
    },
    recordVisit(recordId, input) {
      store.update((db) => {
        const record = db.maintenance.find((m) => m.id === recordId)
        record?.visits.push({
          id: nextId('mv'), date: input.date, plannedFor: input.plannedFor, teamIds: input.teamIds,
          notes: input.notes, issues: input.issues.filter((i) => i.trim()), photoCount: 0, done: true,
        })
      })
    },
  },

  projectChat: {
    post(input): ProjectMessage {
      const message: ProjectMessage = { ...input, id: nextId('pm'), at: `${today()}T${nowTime()}` }
      store.update((db) => {
        db.projectMessages.push(message)
        // Posting counts as having read the thread.
        db.chatReads[`${input.authorId}:${input.projectId}`] = message.at
      })
      return message
    },
    remove(messageId) {
      store.update((db) => {
        db.projectMessages = db.projectMessages.filter((m) => m.id !== messageId)
      })
    },
    markRead(personId, projectId) {
      const key = `${personId}:${projectId}`
      const latest = store.db.projectMessages.filter((m) => m.projectId === projectId).reduce((max, m) => (m.at > max ? m.at : max), '')
      if (!latest || (store.db.chatReads[key] ?? '') >= latest) return
      store.update((db) => {
        db.chatReads[key] = latest
      })
    },
  },

  reminders: {
    create(input): Reminder {
      const record: Reminder = { ...input, id: nextId('rm') }
      store.update((db) => {
        db.reminders.push(record)
      })
      return record
    },
    update(reminderId, patch) {
      store.update((db) => patchIn(db.reminders, reminderId, patch))
    },
    remove(reminderId) {
      store.update((db) => removeFrom(db.reminders, reminderId))
    },
    setDone(reminderId, date, done) {
      store.update((db) => {
        const reminder = db.reminders.find((r) => r.id === reminderId)
        if (!reminder) return
        const rest = reminder.doneDates.filter((d) => d !== date)
        reminder.doneDates = done ? [...rest, date] : rest
      })
    },
  },

  pay: {
    create(input): PayRecord {
      const record: PayRecord = { ...input, id: nextId('pay') }
      store.update((db) => {
        db.payRecords.push(record)
      })
      return record
    },
    remove(payId) {
      store.update((db) => {
        db.payRecords = db.payRecords.filter((p) => p.id !== payId)
      })
    },
  },

  siteVisits: {
    create(visit): SiteVisit {
      const record: SiteVisit = { ...visit, id: nextId('sv') }
      store.update((db) => {
        db.siteVisits.push(record)
      })
      return record
    },
    update(visitId, patch) {
      store.update((db) => patchIn(db.siteVisits, visitId, patch))
    },
    remove(visitId) {
      store.update((db) => removeFrom(db.siteVisits, visitId))
    },
  },

  quotations: {
    create(input): Quotation {
      const year = input.date.slice(0, 4)
      const prefix = input.kind === 'BOQ' ? 'BOQ' : 'QT'
      const seq = store.db.quotations.filter((q) => q.number.startsWith(`${prefix}-${year}`)).length + 31
      const record: Quotation = { ...input, id: nextId('q'), number: `${prefix}-${year}-${String(seq).padStart(3, '0')}` }
      store.update((db) => {
        db.quotations.unshift(record)
      })
      return record
    },
    update(quotationId, patch) {
      store.update((db) => patchIn(db.quotations, quotationId, patch))
    },
    remove(quotationId) {
      store.update((db) => removeFrom(db.quotations, quotationId))
    },
  },

  tasks: {
    setStatus(taskId, status) {
      store.update((db) => {
        const task = db.tasks.find((t) => t.id === taskId)
        if (task) task.status = status
      })
    },
    create(task): Task {
      const record: Task = { ...task, id: nextId('t') }
      store.update((db) => {
        db.tasks.push(record)
      })
      return record
    },
    update(taskId, patch) {
      store.update((db) => patchIn(db.tasks, taskId, patch))
    },
    remove(taskId) {
      store.update((db) => removeFrom(db.tasks, taskId))
    },
  },

  issues: {
    resolve(issueId) {
      store.update((db) => {
        const issue = db.issues.find((i) => i.id === issueId)
        if (issue) issue.status = 'Resolved'
      })
    },
  },

  settings: {
    save(next: Settings) {
      store.update((db) => {
        db.settings = next
      })
    },
  },

  reset() {
    store.reset()
  },
}

export type { Lead }
