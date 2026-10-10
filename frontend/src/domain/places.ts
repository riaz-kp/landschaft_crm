import type { Consultation, ID, LatLng, Project, SiteVisit } from './types'

/** Where something sits on the map, and whether the pin was borrowed from the client's project. */
export interface MapPlace {
  coords: LatLng
  label: string
  fromProject: boolean
}

/** A client's pinned project site — a running project first. */
export function clientSite(clientId: ID | undefined, projects: Project[]): { coords: LatLng; label: string } | undefined {
  if (!clientId) return undefined
  const sites = projects.filter((p) => p.clientId === clientId && p.siteCoords)
  const project = sites.find((p) => p.status !== 'Completed') ?? sites[0]
  return project && { coords: project.siteCoords!, label: project.siteLocation }
}

/** A site visit's pin, or its client's project site when the visit was not pinned. */
export function visitPlace(v: SiteVisit, projects: Project[]): MapPlace | undefined {
  if (v.coords) return { coords: v.coords, label: v.location, fromProject: false }
  const site = clientSite(v.clientId, projects)
  return site && { ...site, fromProject: true }
}

/**
 * Only consultations held on site have a place to map; office, phone and
 * video meetings do not.
 */
export function consultationPlace(c: Consultation, projects: Project[]): MapPlace | undefined {
  if (c.mode !== 'Site') return undefined
  if (c.coords) return { coords: c.coords, label: c.location || 'Site', fromProject: false }
  const site = clientSite(c.clientId, projects)
  return site && { ...site, fromProject: true }
}

/** "Map: https://…" for a message, when the place is known. */
export function mapLinkLine(place?: MapPlace): string {
  return place ? `Map: https://www.google.com/maps/search/?api=1&query=${place.coords.lat},${place.coords.lng}` : ''
}
