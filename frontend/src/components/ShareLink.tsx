import { useState, type ReactNode } from 'react'
import { whatsappUrl } from '../domain/format'
import { Modal } from './ui'
import { Icon } from './Icon'

/**
 * The secret in a client link. 40 hex characters (160 bits), so a link
 * cannot be guessed; switching the link off clears it and a new one starts fresh.
 */
export function newShareToken(): string {
  const hex = () => crypto.randomUUID().replace(/-/g, '')
  return (hex() + hex()).slice(0, 40)
}

/** The address a client opens without signing in — see pages/portal. */
export const portalUrl = (kind: 'amc' | 'checklist', token: string) => `${window.location.origin}/portal/${kind}/${token}`

/**
 * A client link: copy it, send it on WhatsApp, open it to see what the client
 * sees, or switch it off. Before there is one, offers to create it.
 */
export function ShareLinkModal({
  title, intro, url, phone, message, canManage, onCreate, onDisable, onClose,
}: {
  title: string
  intro: ReactNode
  url?: string
  /** The client's WhatsApp number, for the send button. */
  phone?: string
  /** Sent before the link on WhatsApp. */
  message: string
  canManage: boolean
  onCreate: () => void
  onDisable: () => void
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [confirmingOff, setConfirmingOff] = useState(false)

  const copy = async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // Clipboard blocked: select the text so it can be copied by hand.
      document.querySelector<HTMLInputElement>('#share-link-url')?.select()
      return
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-4">
        <div className="text-sm text-stone-600">{intro}</div>

        {!url ? (
          canManage ? (
            <button onClick={onCreate} className="btn-primary"><Icon name="plus" className="h-4 w-4" /> Create link</button>
          ) : (
            <p className="rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-500">No link has been made yet.</p>
          )
        ) : (
          <>
            <div className="flex gap-2">
              <input
                id="share-link-url" readOnly value={url} onFocus={(e) => e.target.select()}
                className="input min-w-0 flex-1 font-mono text-xs text-stone-600" aria-label="Client link"
              />
              <button onClick={() => void copy()} className="btn-primary shrink-0">
                <Icon name={copied ? 'check' : 'clip'} className="h-4 w-4" /> {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {phone && (
                <a href={whatsappUrl(phone, `${message}\n${url}`)} target="_blank" rel="noreferrer" className="btn-secondary">
                  <Icon name="chat" className="h-4 w-4" /> Send on WhatsApp
                </a>
              )}
              <a href={url} target="_blank" rel="noreferrer" className="btn-secondary">
                <Icon name="eye" className="h-4 w-4" /> Open as the client sees it
              </a>
            </div>

            {canManage && (
              <div className="border-t border-stone-100 pt-4">
                {confirmingOff ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm text-stone-600">Anyone with the link will lose access. A new link can be made after.</p>
                    <button onClick={() => { onDisable(); setConfirmingOff(false) }} className="btn-danger">Turn off link</button>
                    <button onClick={() => setConfirmingOff(false)} className="btn-ghost">Keep it</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmingOff(true)} className="text-sm font-semibold text-red-700 hover:text-red-800">
                    Turn off this link
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
