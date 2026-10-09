/**
 * The single seam between the UI and its data source.
 *
 * The prototype binds this to an in-memory mock adapter. Swapping to the real
 * FastAPI backend means implementing the same interface with fetch calls and
 * changing the one export at the bottom of this file — no page needs to change.
 */
import type {
  AttendanceEntry, ChatMessage, Clarification, Client, Consultation, ConsultationStatus,
  DailyWorkReport, DocumentRecord, Employee, ID, Issue, LatLng, Lead, MaintenanceRecord, PayRecord, PaymentFollowUp, PersonKind,
  ProjectMessage,
  Project, Quotation, Settings, SiteVisit, Task, Worker,
} from '../domain/types'
import * as mock from './mockAdapter'

export interface NewProjectInput {
  name: string
  clientId: ID
  siteLocation: string
  siteCoords?: LatLng
  projectManagerId: ID
  startDate: string
  expectedCompletion: string
  value: number
  services: { design: boolean; execution: boolean; amc: boolean }
  /** The AMC contract created alongside the project when AMC is sold. */
  amc?: Omit<MaintenanceRecord, 'id' | 'projectId' | 'type' | 'visits'>
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

/** Basic create / update / delete for a record type. */
interface Crud<T extends { id: ID }, New = Omit<T, 'id'>> {
  create(input: New): T
  update(id: ID, patch: Partial<Omit<T, 'id'>>): void
  remove(id: ID): void
}

/** What a manager can change on one person's day in the attendance register. */
export type AttendancePatch = Partial<Pick<AttendanceEntry, 'status' | 'checkIn' | 'checkOut' | 'otHours'>>

export interface Api {
  projects: {
    create(input: NewProjectInput): Project
    update(projectId: ID, patch: Partial<Omit<Project, 'id'>>): void
    setPhaseProgress(projectId: ID, phase: string, progress: number): void
    /** Ticks or clears one BOQ / quotation checklist item. */
    setChecklist(projectId: ID, itemId: string, done: boolean, by: ID): void
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
  leads: Crud<Lead, Omit<Lead, 'id' | 'createdAt'>> & {
    setStatus(leadId: ID, status: Lead['status']): void
    convert(leadId: ID): Client
  }
  clients: Crud<Client, Omit<Client, 'id' | 'createdAt'>>
  clarifications: {
    create(input: Omit<Clarification, 'id' | 'status'>): Clarification
    resolve(clarificationId: ID, answer: string, answeredBy: ID): void
  }
  chat: { post(input: Omit<ChatMessage, 'id' | 'at'>): ChatMessage }
  followUps: { create(input: Omit<PaymentFollowUp, 'id'>): PaymentFollowUp }
  documents: { create(input: Omit<DocumentRecord, 'id'>): DocumentRecord }
  employees: Crud<Employee>
  workers: Crud<Worker>
  attendance: {
    /** Sets or corrects one person's day; null clears it back to unmarked. */
    set(kind: PersonKind, personId: ID, date: string, patch: AttendancePatch | null): void
    /** Marks a date as a company-wide off day, or back to a working day. */
    setHoliday(date: string, off: boolean): void
  }
  consultations: {
    /** Callers check for clashes first with findClash() from domain/consultations. */
    create(input: Omit<Consultation, 'id' | 'status'>): Consultation
    setStatus(consultationId: ID, status: ConsultationStatus, notes?: string): void
    /** Moves a consultation to a new slot, keeping a record of where it was. */
    postpone(consultationId: ID, date: string, start: string, reason: string, by: ID): void
  }
  amc: {
    /** Starts a maintenance contract on a project. */
    create(input: Omit<MaintenanceRecord, 'id' | 'visits'>): MaintenanceRecord
    update(recordId: ID, patch: Partial<Omit<MaintenanceRecord, 'id' | 'visits'>>): void
    remove(recordId: ID): void
    /** `plannedFor` ties the visit to the repeat-schedule date it fulfils when moved to another day. */
    scheduleVisit(recordId: ID, date: string, teamIds: ID[], plannedFor?: string): void
    /** Moves a booked visit to another day, keeping the schedule date it fulfils. */
    moveVisit(recordId: ID, visitId: ID, date: string, teamIds: ID[]): void
    completeVisit(recordId: ID, visitId: ID, notes: string, issues: string[]): void
    /** Records a visit that was done straight off the schedule, with no visit booked first. */
    recordVisit(recordId: ID, input: { date: string; plannedFor?: string; teamIds: ID[]; notes: string; issues: string[] }): void
  }
  projectChat: {
    post(input: Omit<ProjectMessage, 'id' | 'at'>): ProjectMessage
    remove(messageId: ID): void
    /** Notes that the person has read the project's remarks up to now. */
    markRead(personId: ID, projectId: ID): void
  }
  pay: {
    create(input: Omit<PayRecord, 'id'>): PayRecord
    remove(payId: ID): void
  }
  siteVisits: Crud<SiteVisit>
  tasks: Crud<Task> & {
    setStatus(taskId: ID, status: Task['status']): void
  }
  quotations: Crud<Quotation, Omit<Quotation, 'id' | 'number'>>
  issues: { resolve(issueId: ID): void }
  settings: { save(next: Settings): void }
  reset(): void
}

export const api: Api = mock.adapter

export type { Issue, Project }
