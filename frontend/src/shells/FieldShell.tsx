import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useSession } from '../state/session'
import { useDb } from '../state/useDb'
import { Avatar } from '../components/ui'
import { Icon } from '../components/Icon'
import { LogoMark } from '../components/Logo'
import { formatDateLong, today } from '../domain/format'
import { unreadRemarks } from '../domain/chat'

const TABS = [
  { to: '/field', label: 'Sites', icon: 'home', end: true },
  { to: '/field/works', label: 'Works', icon: 'doc' },
  { to: '/field/attendance', label: 'Attendance', icon: 'calendar' },
  { to: '/field/pay', label: 'Pay', icon: 'wallet' },
  { to: '/field/profile', label: 'Profile', icon: 'user' },
]

/**
 * The foreman's app. Deliberately narrow: today's sites and report, plus
 * their own past work, attendance, pay and profile. The client was explicit
 * that foremen must not see the rest of the CRM, so nothing else is reachable.
 */
export function FieldShell() {
  const { user, signInAs } = useSession()
  const db = useDb()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const mySites = db.siteAssignments.filter((a) => a.foremanId === user.id).map((a) => a.projectId)
  const unread = mySites.reduce((s, id) => s + unreadRemarks(db.projectMessages, db.chatReads, user.id, id), 0)
  // The chat fills the screen; the tab bar would cover its message box.
  const fullScreen = pathname.startsWith('/field/chat/')

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-20 bg-gradient-to-r from-brand-900 to-brand-950 text-white shadow-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.08] ring-1 ring-white/10">
              <LogoMark className="h-6 w-6" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold leading-tight">{user.name}</span>
              <span className="block text-[11px] leading-tight text-[#C8B8A2]">
                Foreman · {formatDateLong(today())}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate('/field/profile')}
              className="rounded-full ring-2 ring-white/20"
              aria-label="My profile"
            >
              <Avatar name={user.name} size="sm" src={user.photo} />
            </button>
            <button
              onClick={() => { signInAs('e1'); navigate('/dashboard') }}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-brand-200 hover:bg-brand-800"
              title="Prototype: return to the office view"
            >
              <Icon name="logout" className="h-4 w-4" />
              <span className="hidden sm:inline">Exit</span>
            </button>
          </div>
        </div>
      </header>

      <main className={`mx-auto max-w-2xl px-4 pt-5 ${fullScreen ? 'pb-4' : 'pb-28'}`}>
        <Outlet />
      </main>

      {!fullScreen && (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <div className="mx-auto grid max-w-2xl grid-cols-5">
            {TABS.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition ${
                    isActive || (t.end && pathname.startsWith('/field/report')) ? 'text-brand-700' : 'text-stone-400 hover:text-stone-600'
                  }`
                }
              >
                <Icon name={t.icon} className="h-5 w-5" />
                {t.label}
                {t.label === 'Sites' && unread > 0 && (
                  <span className="absolute right-[calc(50%-18px)] top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                    {unread}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  )
}

export function FieldCard({
  children, onClick, className = '',
}: { children: React.ReactNode; onClick?: () => void; className?: string }) {
  const base = `w-full rounded-2xl border border-stone-200 bg-white p-4 text-left shadow-card ${className}`
  return onClick
    ? <button onClick={onClick} className={`${base} transition-shadow active:shadow-inner`}>{children}</button>
    : <div className={base}>{children}</div>
}

export { Avatar }
