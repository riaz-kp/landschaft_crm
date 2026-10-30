/**
 * The single seam between the UI and its data.
 *
 * Every write goes through here into the in-memory store, which pages read
 * synchronously. data/sync then saves each change to Supabase (or, in the
 * offline demo, data/demo keeps it in the browser) — no page talks to the
 * database directly.
 */
import type {
  AttendanceEntry, ChatMessage, Clarification, Client, Consultation, ConsultationStatus,
  DailyWorkReport, DocumentRecord, Employee, ID, Issue, LatLng, Lead, MaintenanceRecord, PayRecord, PaymentFollowUp, PersonKind,
  ProjectMessage, Reminder, AreaUnit, ClientDocKey, ClientDocTick, ProjectCategory, FeeBasis, NextAction, WorkflowStepKey,
  Project, Quotation, Settings, SiteVisit, Task, Worker, VisitFile, VisitPhoto,
} from '../domain/types'
import { adapter } from './storeAdapter'

export interface NewProjectInput {
  /** The project code, e.g. LS-2026-009. Callers check it is not already taken. */
  code: string
  name: string
  category?: ProjectCategory
  area?: number
  areaUnit?: AreaUnit
  /** Client documents already in hand when the project is opened. */
  clientDocs?: Project['clientDocs']
  clientId: ID
  siteLocation: string
  siteCoords?: LatLng
  projectManagerId: ID
  startDate: string
  expectedCompletion: string
  value: number
  designValue?: number
  executionValue?: number
  budget?: number
  requirement?: string
  siteVisitRequired?: boolean
  feeBasis?: FeeBasis
  nextAction?: NextAction
  /** Links to documents kept elsewhere (Google Drive…), filed on the project as it is opened. */
  documentLinks?: { name: string; url: string }[]
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

/** A maintenance visit's report: the work done, issues found, and the photos and documents the client sees on their link. */
export interface VisitReport {
  notes: string
  issues: string[]
  photos: VisitPhoto[]
  files: VisitFile[]
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
    create(input: NewProjectInput, by: ID): Project
    /** Passing `by` records the change in the project's history. */
    update(projectId: ID, patch: Partial<Omit<Project, 'id'>>, by?: ID): void
    /** Marks a client document received or not needed; null puts it back to pending. */
    setClientDoc(projectId: ID, key: ClientDocKey, tick: ClientDocTick | null, by: ID): void
    setPhaseProgress(projectId: ID, phase: string, progress: number): void
    /** Ticks or clears one BOQ / quotation checklist item. */
    setChecklist(projectId: ID, itemId: string, done: boolean, by: ID): void
    /**
     * Ticks or clears a workflow hand-off. Ticking it writes the project history
     * and puts a reminder on the bell of everyone who acts next.
     */
    setWorkflowStep(projectId: ID, step: WorkflowStepKey, done: boolean, by: ID): void
    /** Puts these foremen on the site — it appears under My Sites on their phones — and takes the rest off. */
    setForemen(projectId: ID, foremanIds: ID[]): void
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
  workers: Crud<Worker> & {
    /** Adds a skill to the list offered on the worker form; returns the stored spelling. */
    addSkill(name: string): string
    /** Renames a skill on the list and on every worker who has it. */
    renameSkill(from: string, to: string): void
    removeSkill(name: string): void
  }
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
    /** Sets where a site consultation is held, and its pin on the map. */
    setPlace(consultationId: ID, location?: string, coords?: LatLng): void
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
    /** Marks a booked visit done — or, on a visit already done, updates its report. */
    completeVisit(recordId: ID, visitId: ID, report: VisitReport): void
    /** Records a visit that was done straight off the schedule, with no visit booked first. */
    recordVisit(recordId: ID, input: { date: string; plannedFor?: string; teamIds: ID[] } & VisitReport): void
  }
  projectChat: {
    post(input: Omit<ProjectMessage, 'id' | 'at'>): ProjectMessage
    remove(messageId: ID): void
    /** Notes that the person has read the project's remarks up to now. */
    markRead(personId: ID, projectId: ID): void
  }
  reminders: Crud<Reminder> & {
    /** Ticks off (or reopens) one occurrence of a reminder. */
    setDone(reminderId: ID, date: string, done: boolean): void
  }
  pay: {
    create(input: Omit<PayRecord, 'id'>): PayRecord
    remove(payId: ID): void
  }
  siteVisits: Crud<SiteVisit>
  /**
   * Every task change names who made it, so hand-overs and completions land in
   * the project's history.
   */
  tasks: {
    create(input: Omit<Task, 'id'>, by: ID): Task
    /** A changed assignee is recorded as a reassignment; moving to or from Done as a completion or reopening. */
    update(taskId: ID, patch: Partial<Omit<Task, 'id'>>, by: ID): void
    remove(taskId: ID, by: ID): void
    /** `note` is the completion note when the task moves to Done. */
    setStatus(taskId: ID, status: Task['status'], by: ID, note?: string): void
    /** Hands the task to someone else, with the reason kept in the project history. */
    reassign(taskId: ID, toId: ID, by: ID, reason?: string): void
  }
  quotations: Crud<Quotation, Omit<Quotation, 'id' | 'number'>>
  issues: { resolve(issueId: ID): void }
  settings: { save(next: Settings): void }
}

export const api: Api = adapter

export type { Issue, Project }
