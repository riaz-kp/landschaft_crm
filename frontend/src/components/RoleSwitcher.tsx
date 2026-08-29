import { useState } from 'react'
import { ROLES } from '../domain/roles'
import { useSession } from '../state/session'
import { Avatar } from './ui'
import { Icon } from './Icon'

/**
 * Stands in for authentication in the prototype. It lets the client see every
 * role's view without needing ten sets of credentials.
 */
export function RoleSwitcher() {
  const { user, role, people, signInAs } = useSession()
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-stone-100"
      >
        <Avatar name={user.name} />
        <span className="hidden sm:block">
          <span className="block text-sm font-semibold leading-tight text-stone-900">{user.name}</span>
          <span className="block text-xs leading-tight text-stone-500">{role.title}</span>
        </span>
        <Icon name="chevron" className="h-4 w-4 rotate-90 text-stone-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl">
            <div className="border-b border-stone-100 bg-stone-50 px-4 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                Prototype — sign in as
              </p>
              <p className="mt-0.5 text-xs text-stone-400">
                Authentication is not built in this prototype.
              </p>
            </div>
            <div className="max-h-96 overflow-y-auto py-1">
              {people.map((person) => (
                <button
                  key={person.id}
                  onClick={() => { signInAs(person.id); setOpen(false) }}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-stone-50 ${
                    person.id === user.id ? 'bg-brand-50' : ''
                  }`}
                >
                  <Avatar name={person.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-stone-800">{person.name}</span>
                    <span className="block truncate text-xs text-stone-500">{ROLES[person.role].title}</span>
                  </span>
                  {person.id === user.id && (
                    <span className="text-xs font-semibold text-brand-700">Current</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
