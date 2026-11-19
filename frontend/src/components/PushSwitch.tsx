import { useEffect, useState } from 'react'
import { pushState, sendTestPush, turnOffPush, turnOnPush, type PushState } from '../lib/push'

/**
 * Notifications on this device, at the foot of the bell panel: turn them on,
 * send a test, or turn them off. On an iPhone in Safari it explains adding
 * the CRM to the Home Screen first, the only place iOS allows them.
 */
export function PushSwitch() {
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ text: string; error?: boolean } | null>(null)

  useEffect(() => {
    let live = true
    void pushState().then((s) => live && setState(s)).catch(() => live && setState('unsupported'))
    return () => {
      live = false
    }
  }, [])

  if (!state || state === 'unsupported') return null

  const act = async (work: () => Promise<PushState | void>, done?: string) => {
    setBusy(true)
    setNote(null)
    try {
      const next = await work()
      if (next) setState(next)
      if (next === 'blocked') setNote({ text: 'Notifications were blocked. Allow them for the CRM in the browser or phone settings.', error: true })
      else if (done) setNote({ text: done })
    } catch (e) {
      setNote({ text: (e as Error).message || 'That did not work. Try again.', error: true })
    } finally {
      setBusy(false)
    }
  }

  const button = 'rounded-lg px-2.5 py-1 text-xs font-semibold disabled:opacity-50'

  return (
    <div className="border-t border-stone-100 bg-stone-50/60 px-4 py-3">
      {state === 'needs-install' && (
        <p className="text-xs text-stone-600">
          <span className="font-semibold text-stone-800">Get these as notifications on your iPhone:</span>{' '}
          tap <span className="font-semibold">Share</span>, then <span className="font-semibold">Add to Home Screen</span>.
          Open the CRM from the Home Screen and turn notifications on there.
        </p>
      )}
      {state === 'blocked' && (
        <p className="text-xs text-stone-600">
          Notifications are blocked for the CRM on this device. Allow them in the browser or phone settings, then come back here.
        </p>
      )}
      {state === 'off' && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-stone-600">Get these as notifications on this device, even when the CRM is closed.</p>
          <button disabled={busy} onClick={() => void act(turnOnPush, 'A test notification is on its way.')} className={`${button} shrink-0 bg-brand-700 text-white hover:bg-brand-800`}>
            {busy ? 'Turning on…' : 'Turn on'}
          </button>
        </div>
      )}
      {state === 'on' && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-stone-600">Notifications are on for this device.</p>
          <div className="flex shrink-0 gap-1">
            <button disabled={busy} onClick={() => void act(sendTestPush, 'Sent. It should appear in a few seconds.')} className={`${button} text-brand-700 hover:bg-brand-50`}>
              Test
            </button>
            <button disabled={busy} onClick={() => void act(turnOffPush, 'Notifications are off for this device.')} className={`${button} text-stone-500 hover:bg-stone-100`}>
              Turn off
            </button>
          </div>
        </div>
      )}
      {note && <p className={`mt-1.5 text-xs ${note.error ? 'text-red-600' : 'text-brand-700'}`}>{note.text}</p>}
    </div>
  )
}
