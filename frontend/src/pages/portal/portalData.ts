import { DEMO_MODE, callFunction } from '../../lib/supabase'
import { openDemo } from '../../data/demo'
import { store } from '../../data/store'
import type { BriefAnswers, ClientBrief, MaintenanceRecord } from '../../domain/types'

/**
 * What a client link shows. Live, it comes from the client-portal Edge
 * Function, which looks the link's token up with the service role; in the
 * offline demo it is read from the demo data in this browser.
 */

export interface AmcReportData {
  projectName: string
  siteLocation: string
  clientName: string
  /** The contract with its visits; photo and document links are ready to open. No team, value or token. */
  record: MaintenanceRecord
}

export interface BriefData {
  projectName: string
  siteLocation: string
  clientName: string
  clientPhone: string
  brief: Pick<ClientBrief, 'answers' | 'submittedAt' | 'updatedAt'> | null
}

const GONE = 'This link is not active any more. Ask Landschaft for a new one.'

let demoLoaded: Promise<void> | null = null
const demo = () => (demoLoaded ??= openDemo())

export async function loadAmcReport(token: string): Promise<AmcReportData> {
  if (!DEMO_MODE) return callFunction<AmcReportData>('client-portal', { action: 'amc', token })
  await demo()
  const db = store.db
  const record = db.maintenance.find((m) => m.shareToken === token)
  if (!record) throw new Error(GONE)
  const project = db.projects.find((p) => p.id === record.projectId)
  return {
    projectName: project?.name ?? '',
    siteLocation: project?.siteLocation ?? '',
    clientName: db.clients.find((c) => c.id === project?.clientId)?.name ?? '',
    record: { ...record, value: undefined, shareToken: undefined, teamIds: [] },
  }
}

export async function loadBrief(token: string): Promise<BriefData> {
  if (!DEMO_MODE) return callFunction<BriefData>('client-portal', { action: 'brief', token })
  await demo()
  const db = store.db
  const project = db.projects.find((p) => p.briefToken === token)
  if (!project) throw new Error(GONE)
  const client = db.clients.find((c) => c.id === project.clientId)
  const saved = db.clientBriefs.find((b) => b.projectId === project.id)
  return {
    projectName: project.name,
    siteLocation: project.siteLocation,
    clientName: client?.name ?? '',
    clientPhone: client?.phone ?? '',
    brief: saved ? { answers: saved.answers, submittedAt: saved.submittedAt, updatedAt: saved.updatedAt } : null,
  }
}

export async function saveBrief(token: string, answers: BriefAnswers): Promise<{ submittedAt: string; updatedAt: string }> {
  if (!DEMO_MODE) return callFunction('client-portal', { action: 'brief-save', token, answers })
  await demo()
  const project = store.db.projects.find((p) => p.briefToken === token)
  if (!project) throw new Error(GONE)
  const now = new Date().toISOString()
  const submittedAt = store.db.clientBriefs.find((b) => b.projectId === project.id)?.submittedAt ?? now
  const brief: ClientBrief = { id: project.id, projectId: project.id, answers, submittedAt, updatedAt: now }
  store.update((db) => {
    db.clientBriefs = [...db.clientBriefs.filter((b) => b.projectId !== project.id), brief]
  })
  return { submittedAt, updatedAt: now }
}
