/**
 * Links pasted in place of uploading a document: where the file is kept
 * elsewhere, such as a Google Drive or Dropbox share.
 */

/** The pasted text as a web address, or null when it holds none. A bare "drive.google.com/…" gets its https://. */
export function toLink(text: string): string | null {
  // A link copied out of a message comes with words around it.
  const candidate = /https?:\/\/\S+/i.exec(text)?.[0] ?? text.trim()
  if (!candidate || /\s/.test(candidate)) return null
  try {
    const url = new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`)
    // A real host, and no "name:password@" in front of it.
    return url.hostname.includes('.') && !url.username && !url.password ? url.href : null
  } catch {
    return null
  }
}

const SERVICES: [RegExp, string][] = [
  [/^drive\.google\.com$/, 'Google Drive'],
  [/(^|\.)dropbox\.com$/, 'Dropbox'],
  [/(^|\.)(onedrive\.live\.com|1drv\.ms|sharepoint\.com)$/, 'OneDrive'],
  [/(^|\.)(wetransfer\.com|we\.tl)$/, 'WeTransfer'],
]

const GOOGLE_EDITORS = new Map([['spreadsheets', 'Google Sheets'], ['presentation', 'Google Slides'], ['forms', 'Google Forms']])

/** Where a link points, in words — "Google Drive", "Dropbox" — or else the site itself. */
function linkSource(url: URL): string {
  const host = url.hostname.replace(/^www\./, '')
  if (host === 'docs.google.com') return GOOGLE_EDITORS.get(url.pathname.split('/')[1]) ?? 'Google Docs'
  return SERVICES.find(([pattern]) => pattern.test(host))?.[1] ?? host
}

/** A name for a link nobody named: the file name in it when it shows one, else where it points. */
export function linkName(link: string): string {
  const url = new URL(link)
  const last = url.pathname.split('/').filter(Boolean).pop() ?? ''
  if (/\.[a-z0-9]{2,5}$/i.test(last)) {
    try {
      return decodeURIComponent(last)
    } catch {
      return last
    }
  }
  if (url.hostname === 'drive.google.com' && url.pathname.includes('/folders/')) return 'Google Drive folder'
  return `${linkSource(url)} link`
}
