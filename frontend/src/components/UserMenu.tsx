import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { titleOf } from '../domain/roles'
import { useSession } from '../state/session'
import { DEMO_MODE, supabase } from '../lib/supabase'
import { Avatar, Field, Modal } from './ui'
import { Icon } from './Icon'
import { useClickOutside } from './useClickOutside'

/** The signed-in person: their profile, password and sign out. The demo adds a switcher to view as anyone. */
export function UserMenu() {
  const { user, demo, signOut } = useSession()
  const [open, setOpen] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useClickOutside(root, () => setOpen(false), open)

  return (
    <div ref={root} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-stone-100"
        aria-label="Account menu"
      >
        <Avatar name={user.name} src={user.photo} />
        <span className="hidden sm:block">
          <span className="block text-sm font-semibold leading-tight text-stone-900">{user.name}</span>
          <span className="block max-w-[180px] truncate text-xs leading-tight text-stone-500">{titleOf(user)}</span>
        </span>
        <Icon name="chevron" className="h-4 w-4 rotate-90 text-stone-400" />
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl">
          <div className="border-b border-stone-100 px-4 py-3">
            <p className="truncate text-sm font-semibold text-stone-900">{user.name}</p>
            <p className="truncate text-xs text-stone-500">{user.email || titleOf(user)}</p>
          </div>
          <div className="py-1">
            {user.role !== 'foreman' && (
              <Link
                to={`/employees/${user.id}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                <Icon name="user" className="h-4 w-4 text-stone-400" /> My profile
              </Link>
            )}
            {!DEMO_MODE && (
              <button
                onClick={() => { setChangingPassword(true); setOpen(false) }}
                className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                <Icon name="shield" className="h-4 w-4 text-stone-400" /> Change password
              </button>
            )}
            {!DEMO_MODE && (
              <button
                onClick={() => void signOut()}
                className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                <Icon name="logout" className="h-4 w-4 text-stone-400" /> Sign out
              </button>
            )}
          </div>

          {demo && (
            <>
              <div className="border-y border-stone-100 bg-stone-50 px-4 py-2.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Demo — view as</p>
                <p className="mt-0.5 text-xs text-stone-400">Sample data in this browser; nothing is shared.</p>
              </div>
              <div className="max-h-96 overflow-y-auto py-1">
                {demo.people.map((person) => (
                  <button
                    key={person.id}
                    onClick={() => { demo.signInAs(person.id); setOpen(false) }}
                    className={`flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-stone-50 ${person.id === user.id ? 'bg-brand-50' : ''}`}
                  >
                    <Avatar name={person.name} size="sm" src={person.photo} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-stone-800">{person.name}</span>
                      <span className="block truncate text-xs text-stone-500">{titleOf(person)}</span>
                    </span>
                    {person.id === user.id && <span className="text-xs font-semibold text-brand-700">Current</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {changingPassword && <ChangePasswordModal onClose={() => setChangingPassword(false)} />}
    </div>
  )
}

const MIN_PASSWORD = 8

/** The signed-in person sets a new password for their own login. */
export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < MIN_PASSWORD) return setError(`Use at least ${MIN_PASSWORD} characters.`)
    if (password !== confirm) return setError('The two passwords do not match.')
    setBusy(true)
    setError(null)
    const { error: failure } = await supabase().auth.updateUser({ password })
    setBusy(false)
    if (failure) setError(failure.message)
    else setDone(true)
  }

  return (
    <Modal
      title="Change password"
      onClose={onClose}
      footer={done ? (
        <button onClick={onClose} className="btn-primary">Done</button>
      ) : (
        <>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" form="change-password" disabled={busy} className="btn-primary disabled:opacity-60">
            {busy ? 'Saving…' : 'Save password'}
          </button>
        </>
      )}
    >
      {done ? (
        <p className="text-sm text-stone-600">Your password has been changed. Use the new one next time you sign in.</p>
      ) : (
        <form id="change-password" onSubmit={submit} className="space-y-4">
          <Field label="New password" hint={`At least ${MIN_PASSWORD} characters.`}>
            <input type="password" required autoFocus autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
          </Field>
          <Field label="Confirm new password">
            <input type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="input" />
          </Field>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        </form>
      )}
    </Modal>
  )
}
