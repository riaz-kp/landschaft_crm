import { normalizeSettings } from '../domain/defaults'
import type { Project } from '../domain/types'
import { store, type DbShape } from './store'

// The offline demo (VITE_DEMO_MODE=true): the seed data, kept in this browser.
// v4 added AMC as a project service with repeat visit schedules, project remarks,
// staff pay records and lead WhatsApp numbers. v5 is the revised company
// structure (hierarchy v2): new foremen, the Site Supervisor and the AMC foremen.
const STORAGE_KEY = 'landschaft-crm-prototype-v5'

type Seed = typeof import('../mock/seed')

function fromSeed(seed: Seed): DbShape {
  // Structured clone keeps the seed module pristine across resets.
  return structuredClone({
    employees: seed.employees,
    workers: seed.workers,
    leads: seed.leads,
    clients: seed.clients,
    siteVisits: seed.siteVisits,
    projects: seed.projects,
    siteAssignments: seed.siteAssignments,
    tasks: seed.tasks,
    reports: seed.reports,
    issues: seed.issues,
    quotations: seed.quotations,
    paymentRequests: seed.paymentRequests,
    payments: seed.payments,
    maintenance: seed.maintenance,
    documents: seed.documents,
    calendarEvents: seed.calendarEvents,
    clarifications: seed.clarifications,
    chatMessages: seed.chatMessages,
    followUps: seed.followUps,
    consultations: seed.consultations,
    attendance: seed.attendance,
    projectMessages: seed.projectMessages,
    payRecords: seed.payRecords,
    reminders: seed.reminders,
    projectLog: seed.projectLog,
    chatReads: {},
    clientBriefs: seed.clientBriefs,
    settings: seed.settings,
  })
}

/**
 * Project type, area and client documents arrived after browsers already held
 * data. A seeded project saved before then picks them up from the seed, so the
 * demo shows them without wiping anything entered since.
 */
function withSeedDetails(project: Project, seeded: Project[]): Project {
  const original = seeded.find((s) => s.id === project.id)
  if (!original || project.category !== undefined) return project
  return { ...project, category: original.category, area: original.area, areaUnit: original.areaUnit, clientDocs: project.clientDocs ?? original.clientDocs }
}

function load(seed: Seed): DbShape {
  const fresh = fromSeed(seed)
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fresh
    const parsed = JSON.parse(raw) as DbShape
    // Guard against a half-written or older payload.
    if (!parsed.projects || !parsed.reports) return fresh
    // Collections and settings added after the payload was written start from the seed.
    return {
      ...fresh,
      ...parsed,
      projects: parsed.projects.map((p) => withSeedDetails(p, fresh.projects)),
      settings: normalizeSettings({ ...fresh.settings, ...parsed.settings }),
    }
  } catch {
    return fresh
  }
}

/** Clears everything entered in the demo and starts again from the seed. */
export function resetDemo() {
  localStorage.removeItem(STORAGE_KEY)
  window.location.reload()
}

/** Loads the demo data, and keeps every change in this browser. */
export async function openDemo(): Promise<void> {
  // Imported on demand, so the seed is not shipped in the production bundle.
  const seed = await import('../mock/seed')
  store.load(load(seed))
  store.setPersister((_touched, db) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
    } catch {
      // Quota or private-browsing failures are non-fatal for the demo.
    }
  })
}
