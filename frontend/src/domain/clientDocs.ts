import type { ClientDocKey, DocumentRecord, Project } from './types'

export interface ClientDocItem {
  key: ClientDocKey
  label: string
  /** The file format the client normally sends it in. */
  format: string
  /** Rows sharing a group are shown together under its heading. */
  group?: string
  /** Where an uploaded copy is filed on the Documents page. */
  category: DocumentRecord['category']
}

/** What the client hands over at the start of a project, in the order the team asks for it. */
export const CLIENT_DOCS: ClientDocItem[] = [
  { key: 'model3d', label: '3D model', format: 'SketchUp', category: 'Drawing' },
  { key: 'contour', label: 'Contour drawing', format: 'CAD', category: 'Drawing' },
  { key: 'presentation', label: 'Presentation', format: 'PDF', category: 'Other' },
  { key: 'archFloor', label: 'Floor plans', format: 'CAD / PDF', group: 'Architectural drawings', category: 'Drawing' },
  { key: 'archSections', label: 'Sections', format: 'CAD / PDF', group: 'Architectural drawings', category: 'Drawing' },
  { key: 'archElevations', label: 'Elevations', format: 'CAD / PDF', group: 'Architectural drawings', category: 'Drawing' },
  { key: 'sitePhotos', label: 'Site photos', format: 'Photos', category: 'Photo' },
]

export const clientDocLabel = (key: ClientDocKey): string => {
  const item = CLIENT_DOCS.find((d) => d.key === key)
  if (!item) return key
  return item.group ? `${item.group} — ${item.label}` : item.label
}

/** Received, still pending, and the total that applies once "not needed" items are set aside. */
export function clientDocProgress(project: Project): { received: number; pending: number; applicable: number } {
  const ticks = project.clientDocs ?? {}
  const received = CLIENT_DOCS.filter((d) => ticks[d.key]?.status === 'Received').length
  const notNeeded = CLIENT_DOCS.filter((d) => ticks[d.key]?.status === 'Not Needed').length
  const applicable = CLIENT_DOCS.length - notNeeded
  return { received, pending: applicable - received, applicable }
}
