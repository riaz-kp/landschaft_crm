import { DEMO_MODE, isNetworkError, supabase } from '../lib/supabase'
import type { PlantLine } from '../domain/types'

/**
 * The plants app (plants.landschaft.in) is where plants are chosen, sized and
 * priced for a project. The CRM only reads its projects, through the `plants`
 * Edge Function, which holds the plants app's login. In the offline demo a
 * few sample projects stand in for it.
 */

export interface PlantsProjectSummary {
  id: string
  name: string
  clientName?: string
  location?: string
  plantCount: number
  /** ISO date-time the project was last changed in the plants app. */
  updatedAt: string
  /** Locked in the plants app: its list is final. */
  locked: boolean
}

export interface PlantsProject extends PlantsProjectSummary {
  lines: PlantLine[]
}

const NOT_SET_UP = 'The link to the plants app is not set up on the server yet. An admin deploys the plants function '
  + 'and saves the plants app login (see the README).'

/** Calls the plants function; its refusals ("That project is no longer in the plants app.") become the error's message. */
async function ask<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase().functions.invoke('plants', { body })
  if (!error) return data as T
  const response = (error as { context?: Response }).context
  if (response && typeof response.json === 'function') {
    const reply = await response.json().catch(() => null) as { error?: string } | null
    if (reply?.error) throw new Error(reply.error)
    // Not our function's answer: Supabase has no function by that name.
    if (response.status === 404) throw new Error(NOT_SET_UP)
  }
  if (isNetworkError(error)) throw new Error('No connection. The plant list can be fetched once you are back online.')
  throw new Error('Could not reach the plants app. Try again in a minute.')
}

/** The project list changes rarely; it is kept for a couple of minutes so searching and re-opening is instant. */
const LIST_MS = 2 * 60_000
let listed: { at: number; projects: PlantsProjectSummary[] } | null = null

async function demo() {
  return import('../mock/plants')
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const plantsApp = {
  /** Every project in the plants app, newest first. `fresh` skips the copy kept from a moment ago. */
  async list(fresh = false): Promise<PlantsProjectSummary[]> {
    if (!fresh && listed && Date.now() - listed.at < LIST_MS) return listed.projects
    let projects: PlantsProjectSummary[]
    if (DEMO_MODE) {
      await pause(350)
      projects = (await demo()).plantsProjects.map(({ lines, ...summary }) => ({ ...summary, plantCount: lines.length }))
    } else {
      projects = (await ask<{ projects: PlantsProjectSummary[] }>({ action: 'list' })).projects
    }
    listed = { at: Date.now(), projects }
    return projects
  },

  /** One project with its plants. */
  async get(id: string): Promise<PlantsProject> {
    if (DEMO_MODE) {
      await pause(450)
      const found = (await demo()).plantsProjects.find((p) => p.id === id)
      if (!found) throw new Error('That project is no longer in the plants app.')
      return structuredClone({ ...found, plantCount: found.lines.length })
    }
    return (await ask<{ project: PlantsProject }>({ action: 'get', id })).project
  },
}

/** A plants-app project's own page, to change its plants there. */
export function plantsProjectUrl(appUrl: string, id: string): string {
  return `${appUrl.replace(/\/+$/, '')}/projects/${id}`
}
