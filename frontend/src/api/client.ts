/**
 * The single seam between the UI and its data source.
 *
 * The prototype binds this to an in-memory mock adapter. Swapping to the real
 * FastAPI backend means implementing the same interface with fetch calls and
 * changing the one export at the bottom of this file — no page needs to change.
 */
import type {
  Client, DailyWorkReport, ID, Issue, Lead, Project, Settings, SiteVisit, Task,
} from '../domain/types'
import * as mock from './mockAdapter'

export interface NewProjectInput {
  name: string
  clientId: ID
  siteLocation: string
  projectManagerId: ID
  startDate: string
  expectedCompletion: string
  value: number
  services: { design: boolean; execution: boolean }
  designPhases: { concept: boolean; threeD: boolean; civilWork: boolean; boq: boolean }
  executionPhases: {
    hardscape: boolean
    softscape: boolean
    mep: boolean
    irrigation: boolean
    electrical: boolean
    drainage: boolean
  }
}

export interface Api {
  projects: {
    create(input: NewProjectInput): Project
    setPhaseProgress(projectId: ID, phase: string, progress: number): void
  }
  reports: {
    /** Returns the foreman's existing draft for the site, or creates one. */
    draftFor(projectId: ID, foremanId: ID, date: string): DailyWorkReport
    save(report: DailyWorkReport): void
    /** Submits, raising issue alerts for anything other than "Nothing". */
    submit(reportId: ID, foremanId: ID): void
    approve(reportId: ID, reviewerId: ID, note?: string): void
    sendBack(reportId: ID, reviewerId: ID, note: string): void
    setOt(reportId: ID, hours: number): void
  }
  leads: {
    setStatus(leadId: ID, status: Lead['status']): void
    convert(leadId: ID): Client
  }
  siteVisits: { create(visit: Omit<SiteVisit, 'id'>): SiteVisit }
  tasks: {
    setStatus(taskId: ID, status: Task['status']): void
    create(task: Omit<Task, 'id'>): Task
  }
  issues: { resolve(issueId: ID): void }
  settings: { save(next: Settings): void }
  reset(): void
}

export const api: Api = mock.adapter

export type { Issue, Project }
