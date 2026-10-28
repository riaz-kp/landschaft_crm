import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { DEMO_MODE } from '../lib/supabase'
import { isLink, isStoredFile, openFile, uploadFile } from '../data/files'
import { linkName, toLink } from './docLinks'
import { Icon } from './Icon'

/** The bucket's per-file limit. */
export const MAX_FILE_MB = 50

/**
 * Uploads a document and returns its reference for DocumentRecord.file. The
 * offline demo keeps only the name and size, as the prototype did.
 */
export async function uploadDocument(file: File, folder: string): Promise<string | undefined> {
  if (DEMO_MODE) return undefined
  if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`${file.name} is over ${MAX_FILE_MB} MB.`)
  return uploadFile(file, folder, file.name.split('.').pop() ?? '')
}

/** A document's name that opens the file, when the file was stored — or the page a link goes to. */
export function FileLink({ file, name, className = '', children }: { file?: string; name: string; className?: string; children?: ReactNode }) {
  const [error, setError] = useState<string | null>(null)
  if (isLink(file)) {
    return (
      <a href={file} target="_blank" rel="noreferrer" className={`text-brand-700 underline-offset-2 hover:underline ${className}`} title={`Open ${name} in a new tab`}>
        {children ?? name}
      </a>
    )
  }
  if (!isStoredFile(file)) return <span className={className}>{children ?? name}</span>
  return (
    <button
      type="button"
      onClick={() => openFile(file, name).then(() => setError(null), (e: Error) => setError(e.message))}
      className={`text-left text-brand-700 underline-offset-2 hover:underline ${className}`}
      title={error ?? `Open ${name}`}
    >
      {children ?? name}
      {error && <span className="ml-1 text-xs text-red-600">(could not open)</span>}
    </button>
  )
}

/**
 * Paste a link to where a document is kept — a Google Drive or Dropbox share —
 * in place of uploading it. A name left blank is made from the link.
 */
export function LinkField({
  onAdd, onCancel, defaultName = linkName,
}: {
  onAdd: (link: { name: string; url: string }) => void
  onCancel: () => void
  /** The name a link gets when none is typed. */
  defaultName?: (url: string) => string
}) {
  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const url = toLink(text)

  const add = () => {
    if (!url) return setError('That is not a web link. Copy the whole address, starting with https://')
    onAdd({ url, name: name.trim() || defaultName(url) })
  }
  // Enter adds the link, and never submits a form around it.
  const addOnEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (text.trim()) add()
  }

  return (
    <div className="rounded-xl bg-stone-50 p-2.5 ring-1 ring-inset ring-stone-200">
      <div className="flex flex-wrap gap-2">
        <input
          value={text} autoFocus inputMode="url" autoComplete="off" autoCapitalize="off" spellCheck={false}
          onChange={(e) => { setText(e.target.value); setError(null) }} onKeyDown={addOnEnter}
          placeholder="Paste a link — Google Drive, Dropbox, OneDrive…"
          className="input min-w-0 flex-[2_1_16rem] py-1.5" aria-label="Link"
        />
        <input
          value={name} onChange={(e) => setName(e.target.value)} onKeyDown={addOnEnter}
          placeholder={url ? defaultName(url) : 'Name (optional)'}
          className="input min-w-0 flex-[1_1_10rem] py-1.5" aria-label="Name for the link"
        />
      </div>
      {error && <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn-ghost px-3 py-1 text-xs">Cancel</button>
        <button type="button" onClick={add} disabled={!text.trim()} className="btn-primary px-3 py-1 text-xs">
          <Icon name="link" className="h-3.5 w-3.5" /> Add link
        </button>
      </div>
    </div>
  )
}
