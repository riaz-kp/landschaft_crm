import { useState, type ReactNode } from 'react'
import { DEMO_MODE } from '../lib/supabase'
import { isStoredFile, openFile, uploadFile } from '../data/files'

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

/** A document's name that opens the file, when the file was stored. */
export function FileLink({ file, name, className = '', children }: { file?: string; name: string; className?: string; children?: ReactNode }) {
  const [error, setError] = useState<string | null>(null)
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
