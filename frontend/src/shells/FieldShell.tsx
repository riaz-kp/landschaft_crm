import { Outlet, useNavigate } from 'react-router-dom'
import { useSession } from '../state/session'
import { Avatar } from '../components/ui'
import { Icon } from '../components/Icon'
import { formatDateLong, today } from '../domain/format'

/**
 * The foreman's app. Deliberately narrow: sites, then one report. The client
 * was explicit that foremen must not see the rest of the CRM, so this shell
 * carries no navigation at all.
 */
export function FieldShell() {
  const { user, signInAs } = useSession()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-stone-100">
      <header className="sticky top-0 z-20 bg-brand-900 text-white shadow-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 font-bold">
              L
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold leading-tight">{user.name}</span>
              <span className="block text-[11px] leading-tight text-brand-300">
                Foreman · {formatDateLong(today())}
              </span>
            </span>
          </div>
          <button
            onClick={() => { signInAs('e1'); navigate('/dashboard') }}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-brand-200 hover:bg-brand-800"
            title="Prototype: return to the office view"
          >
            <Icon name="logout" className="h-4 w-4" />
            <span className="hidden sm:inline">Exit</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-24 pt-5">
        <Outlet />
      </main>
    </div>
  )
}

export function FieldCard({
  children, onClick, className = '',
}: { children: React.ReactNode; onClick?: () => void; className?: string }) {
  const base = `w-full rounded-xl border border-stone-200 bg-white p-4 text-left shadow-sm ${className}`
  return onClick
    ? <button onClick={onClick} className={`${base} transition-shadow active:shadow-inner`}>{children}</button>
    : <div className={base}>{children}</div>
}

export { Avatar }
