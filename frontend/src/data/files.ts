import { DEMO_MODE, supabase } from '../lib/supabase'

/**
 * Photos and documents live in the private "files" bucket. A record keeps a
 * reference — "sb:" plus the path in the bucket — and the app shows the file
 * through a short-lived signed URL. Older records, the demo, and a photo taken
 * with no connection hold a data URL instead, which still displays as it is.
 * A document can also be a link to where it is kept — a Google Drive share
 * pasted in place of uploading the file — which opens as it is.
 */

const BUCKET = 'files'
const PREFIX = 'sb:'
/** Signed URLs last an hour; they are renewed a little before that. */
const URL_SECONDS = 3600
const RENEW_MS = 50 * 60_000

export const isStoredFile = (value?: string): value is string => Boolean(value?.startsWith(PREFIX))

export const isLink = (value?: string): value is string => /^https?:\/\//i.test(value ?? '')

const pathOf = (ref: string) => ref.slice(PREFIX.length)

/** Uploads a file under `folder` and returns the reference to keep on the record. */
export async function uploadFile(file: Blob, folder: string, extension: string): Promise<string> {
  const month = new Date().toISOString().slice(0, 7)
  const path = `${folder}/${month}/${crypto.randomUUID()}.${extension.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin'}`
  const { error } = await supabase().storage.from(BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  })
  if (error) throw new Error(`Upload failed: ${error.message}`)
  return PREFIX + path
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',')
  const type = /data:([^;]+)/.exec(head)?.[1] ?? 'application/octet-stream'
  const bytes = atob(body)
  const buffer = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i += 1) buffer[i] = bytes.charCodeAt(i)
  return new Blob([buffer], { type })
}

/**
 * Saves an already-compressed photo (a JPEG data URL) and returns what to keep
 * on the record. With no connection the data URL itself is kept, so a foreman's
 * report is never held up; it is saved with the report when the line is back.
 */
export async function storePhoto(dataUrl: string, folder: string): Promise<string> {
  if (DEMO_MODE) return dataUrl
  try {
    return await uploadFile(dataUrlToBlob(dataUrl), folder, 'jpg')
  } catch (e) {
    if (!navigator.onLine) return dataUrl
    throw e
  }
}

// ---------------------------------------------------------------- showing files

const cache = new Map<string, { url: string; at: number }>()
const waiting = new Map<string, ((url: string | null) => void)[]>()
let batch: ReturnType<typeof setTimeout> | undefined

/** A signed URL already in hand for this reference, if it is still fresh. */
export function cachedUrl(ref: string): string | undefined {
  const hit = cache.get(ref)
  return hit && Date.now() - hit.at < RENEW_MS ? hit.url : undefined
}

/** Signs every reference asked for in the same moment with one request — a gallery asks for dozens. */
async function signWaiting() {
  batch = undefined
  const refs = [...waiting.keys()]
  const callbacks = new Map(waiting)
  waiting.clear()
  const { data, error } = await supabase().storage.from(BUCKET).createSignedUrls(refs.map(pathOf), URL_SECONDS)
  const signed = new Map((error ? [] : data).map((item) => [item.path, item.signedUrl]))
  for (const ref of refs) {
    const url = signed.get(pathOf(ref)) ?? null
    if (url) cache.set(ref, { url, at: Date.now() })
    callbacks.get(ref)?.forEach((done) => done(url))
  }
}

/** A URL the browser can load for a stored file. */
export function signedUrl(ref: string): Promise<string | null> {
  const hit = cachedUrl(ref)
  if (hit) return Promise.resolve(hit)
  return new Promise((resolve) => {
    waiting.set(ref, [...(waiting.get(ref) ?? []), resolve])
    batch ??= setTimeout(() => void signWaiting(), 10)
  })
}

/** Opens a stored document in a new tab — or, for a file the browser cannot show, downloads it. */
export async function openFile(ref: string, name: string): Promise<void> {
  // Opened before the URL is fetched, so the browser does not block it as a pop-up.
  const tab = window.open('', '_blank')
  const { data, error } = await supabase().storage.from(BUCKET).createSignedUrl(pathOf(ref), 300, { download: false })
  if (error || !data) {
    tab?.close()
    throw new Error(`Could not open ${name}: ${error?.message ?? 'not found'}`)
  }
  if (tab) tab.location.href = data.signedUrl
  else window.location.href = data.signedUrl
}
