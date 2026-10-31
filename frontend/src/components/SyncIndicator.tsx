import { DEMO_MODE } from '../lib/supabase'
import { dismissSyncError, useSyncStatus } from '../data/sync'
import { Icon } from './Icon'

/** "31 Oct, 14:05": when the copy on this device was last loaded. */
const loadedAt = (ms: number) => new Date(ms).toLocaleString('en-IN', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
})

/**
 * Whether changes have reached the server. Quiet while everything is saved;
 * amber while offline with changes waiting or showing the copy kept on this
 * device, red when one was refused.
 */
export function SyncIndicator({ dark = false }: { dark?: boolean }) {
  const { state, pending, error, savedCopyFrom } = useSyncStatus()
  if (DEMO_MODE) return null

  if (error) {
    return (
      <span role="alert" className="flex max-w-[16rem] items-center gap-1.5 rounded-full bg-red-50 py-1 pl-2.5 pr-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200">
        <Icon name="alert" className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate" title={error}>Not saved: {error}</span>
        <button onClick={dismissSyncError} className="rounded-full p-0.5 hover:bg-red-100" aria-label="Dismiss">
          <Icon name="x" className="h-3.5 w-3.5" />
        </button>
      </span>
    )
  }
  if (savedCopyFrom) {
    return (
      <span
        className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200"
        title={`No connection. This is the data as last loaded, ${loadedAt(savedCopyFrom)}; others' changes since then show once the connection is back. Your changes are kept on this device and sent then.`}
      >
        <Icon name="clock" className="h-3.5 w-3.5" /> Offline · from {loadedAt(savedCopyFrom)}{pending > 0 ? ` · ${pending} waiting` : ''}
      </span>
    )
  }
  if (state === 'offline' && pending > 0) {
    return (
      <span
        className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200"
        title="Your changes are kept on this device and will be sent when the connection is back."
      >
        <Icon name="clock" className="h-3.5 w-3.5" /> Offline · {pending} waiting
      </span>
    )
  }
  if (state === 'saving' || pending > 0) {
    return (
      <span className={`whitespace-nowrap text-xs font-medium ${dark ? 'text-brand-200' : 'text-stone-400'}`}>Saving…</span>
    )
  }
  return null
}
