/**
 * The single seam between the UI and its data source.
 *
 * The prototype binds this to an in-memory mock adapter. Swapping to the real
 * FastAPI backend means implementing the same interface with fetch calls and
 * changing the one export at the bottom of this file — no page needs to change.
 */
import type {
  ChatMessage, Clarification, Client, Consultation, ConsultationStatus, DailyWorkReport,
  DocumentRecord, Employee, ID, Issue, Lead, PaymentFollowUp, Project, Settings, SiteVisit,
  StaffAttendanceStatus, Task,
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
  clients: {
    create(input: Omit<Client, 'id' | 'createdAt'>): Client
    update(clientId: ID, patch: Partial<Omit<Client, 'id'>>): void
  }
  clarifications: {
    create(input: Omit<Clarification, 'id' | 'status'>): Clarification
    resolve(clarificationId: ID, answer: string, answeredBy: ID): void
  }
  chat: { post(input: Omit<ChatMessage, 'id' | 'at'>): ChatMessage }
  followUps: { create(input: Omit<PaymentFollowUp, 'id'>): PaymentFollowUp }
  documents: { create(input: Omit<DocumentRecord, 'id'>): DocumentRecord }
  employees: {
    update(employeeId: ID, patch: Partial<Omit<Employee, 'id'>>): void
    /** A null status clears the day. */
    setAttendance(employeeId: ID, date: string, status: StaffAttendanceStatus | null): void
  }
  consultations: {
    /** Callers check for clashes first with findClash() from domain/consultations. */
    create(input: Omit<Consultation, 'id' | 'status'>): Consultation
    setStatus(consultationId: ID, status: ConsultationStatus, notes?: string): void
  }
  amc: {
    scheduleVisit(recordId: ID, date: string, teamIds: ID[]): void
    completeVisit(recordId: ID, visitId: ID, notes: string, issues: string[]): void
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
