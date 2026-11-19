import { COLLECTIONS, setCollection, type Row } from './collections'
import { emptyDb, store, type CollectionKey, type DbShape } from './store'

/**
 * A backup is every collection the signed-in person has loaded, as one JSON
 * file. Restoring lays a backup back over the data: records it holds are put
 * back as they were, and records made since are removed. The change then goes
 * to the server like any other edit.
 *
 * Photos and files are not inside it, only their references: the stored files
 * stay where they are. Logins are not inside it either.
 */

const APP = 'landschaft-crm'
const FORMAT = 1

export interface BackupFile {
  app: typeof APP
  format: number
  /** ISO date-time the backup was taken. */
  exportedAt: string
  /** Name of the person who took it. */
  exportedBy?: string
  data: Partial<DbShape>
}

/** Records in a collection: a list's length, or the keys of a keyed one. Settings count as one. */
export function recordCount(value: unknown): number {
  if (Array.isArray(value)) return value.length
  if (value && typeof value === 'object') return Object.keys(value).length
  return 0
}

/** The collection's name in words, for the summary: "siteVisits" → "Site visits". */
export function collectionLabel(key: CollectionKey): string {
  const words = key.replace(/([A-Z])/g, ' $1').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function makeBackup(exportedBy?: string): BackupFile {
  const db = store.db
  const data = Object.fromEntries(COLLECTIONS.map((spec) => [spec.key, structuredClone(db[spec.key])])) as Partial<DbShape>
  return { app: APP, format: FORMAT, exportedAt: new Date().toISOString(), exportedBy, data }
}

/** Saves a backup to the device as a .json file. */
export function downloadBackup(backup: BackupFile, label = 'backup') {
  const d = new Date(backup.exportedAt)
  const two = (n: number) => String(n).padStart(2, '0')
  const stamp = `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}_${two(d.getHours())}${two(d.getMinutes())}`
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `landschaft-crm-${label}-${stamp}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Reads a chosen file; refuses anything that is not a CRM backup. */
export async function readBackup(file: File): Promise<BackupFile> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    throw new Error('That file is not a CRM backup (it is not readable JSON).')
  }
  const backup = parsed as Partial<BackupFile>
  if (!backup || backup.app !== APP || typeof backup.data !== 'object' || !backup.data) {
    throw new Error('That file is not a Landschaft CRM backup.')
  }
  if (typeof backup.format !== 'number' || backup.format > FORMAT) {
    throw new Error('This backup was made by a newer version of the CRM. Reload the app and try again.')
  }
  const known = COLLECTIONS.filter((spec) => spec.key in backup.data!)
  if (!known.length) throw new Error('The backup holds no data.')
  return backup as BackupFile
}

/** The collections a backup would restore, with how many records each holds there and now. */
export function restorePlan(backup: BackupFile): { key: CollectionKey; now: number; backup: number }[] {
  return COLLECTIONS.filter((spec) => spec.key in backup.data).map((spec) => ({
    key: spec.key,
    now: recordCount(store.db[spec.key]),
    backup: recordCount(backup.data[spec.key]),
  }))
}

/**
 * Replaces every collection the backup holds with the backup's copy. Each is
 * passed through the same tidying as data loaded from the server, so a backup
 * from an older version comes back in today's shape. Collections the backup
 * does not hold are left alone.
 */
export function restoreBackup(backup: BackupFile) {
  const source = { ...emptyDb(), ...backup.data } as DbShape
  store.update((draft) => {
    for (const spec of COLLECTIONS) {
      if (!(spec.key in backup.data)) continue
      const rows: Row[] = [...spec.rows(source)].map(([id, data]) => ({ id, data: structuredClone(data) }))
      // Lists shown newest first are held that way; build takes them oldest first.
      setCollection(draft, spec, spec.build(spec.newestFirst ? rows.reverse() : rows))
    }
  })
}
