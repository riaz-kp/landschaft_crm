import { nextId, nowTime, store } from '../mock/store'
import { addDays, today } from '../domain/format'
import type {
  Client, DailyWorkReport, ID, Lead, Project, Settings, SiteVisit, Task,
} from '../domain/types'
import type { Api, NewProjectInput } from './client'

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
      }
      store.update((db) => {
        db.projects.push(project)
      })
      return project
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

  siteVisits: {
    create(visit): SiteVisit {
      const record: SiteVisit = { ...visit, id: nextId('sv') }
      store.update((db) => {
        db.siteVisits.push(record)
      })
      return record
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
