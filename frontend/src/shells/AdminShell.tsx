import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { navForRole, sectionForPath, titleOf, type NavSection } from '../domain/roles'
import { formatDateLong, today } from '../domain/format'
import { useSession } from '../state/session'
import { useDb } from '../state/useDb'
import { usePermissions } from '../state/permissions'
import { Icon } from '../components/Icon'
import { Avatar } from '../components/ui'
import { LogoLockup } from '../components/Logo'
import { RoleSwitcher } from '../components/RoleSwitcher'
import { GlobalSearch } from '../components/GlobalSearch'
import { NotificationBell } from '../components/NotificationBell'
import { NoAccess } from '../pages/misc/Fallbacks'
import { useClock } from '../state/clock'

function Logo() {
  return (
    <Link to="/dashboard" className="block px-5 pb-5 pt-6">
      <LogoLockup />
    </Link>
  )
}

/** The child tab whose path is the longest prefix of the URL, so detail pages keep their tab lit. */
function activeChild(section: NavSection, pathname: string) {
  return section.children
    ?.filter((c) => pathname === c.path || pathname.startsWith(c.path + '/'))
    .sort((a, b) => b.path.length - a.path.length)[0]
}

/** A section's sub-pages, shown as tabs across the top of the page. */
function SectionTabs({ section, pathname }: { section: NavSection; pathname: string }) {
  const active = activeChild(section, pathname)
  const count = section.children!.length
  // On a phone the tabs sit in an even grid rather than a strip that scrolls sideways.
  const cols = count <= 3 ? 'grid-cols-3' : count === 4 ? 'grid-cols-2' : 'grid-cols-3'
  return (
    <div className="mb-6">
      <nav className={`grid ${count < 3 ? 'grid-cols-2' : cols} gap-1 rounded-2xl border border-stone-200/80 bg-white p-1 shadow-card sm:inline-flex`}>
        {section.children!.map((child) => {
          const on = child.path === active?.path
          return (
            <Link
              key={child.path}
              to={child.path}
              className={`rounded-xl px-2 py-2 text-center text-[13px] font-semibold leading-tight transition sm:px-3.5 sm:text-sm ${
                on ? 'bg-brand-600 text-white shadow-sm' : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800'
              }`}
            >
              {child.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

/** Desktop CRM shell. Foremen never reach this — they are routed to /field. */
export function AdminShell() {
  const { user, roleKey } = useSession()
  const { settings } = useDb()
  const { canView } = usePermissions()
  const { pathname } = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  // Re-render every time on this device when the 12h / 24h setting changes.
  useClock()
  const sections = navForRole(roleKey, settings.permissions)
  const current = sectionForPath(pathname)
  const tab = current && activeChild(current, pathname)

  // Close the drawer and return to the top whenever the page changes.
  useEffect(() => {
    setMobileNavOpen(false)
    window.scrollTo({ top: 0 })
  }, [pathname])

  // Anyone may open their own profile, whatever the Employees permission says.
  const ownProfile = pathname === `/employees/${user.id}`
  const allowed = !current || ownProfile || canView(current.label)

  const nav = (
    <nav className="sidebar-scroll flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
      {sections.map((section) => {
        const active = current?.label === section.label
        return (
          <NavLink
            key={section.label}
            to={section.path}
            className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              active
                ? 'bg-white/[0.12] text-white shadow-inner shadow-black/10'
                : 'text-brand-100/80 hover:bg-white/[0.06] hover:text-white'
            }`}
          >
            {active && <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-brand-300" />}
            <Icon
              name={section.icon}
              className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-brand-200' : 'text-brand-300/70 group-hover:text-brand-200'}`}
            />
            <span className="truncate">{section.label}</span>
          </NavLink>
        )
      })}
    </nav>
  )

  const sidebar = (
    <>
      <Logo />
      {nav}
      <Link
        to={`/employees/${user.id}`}
        className="m-3 flex items-center gap-3 rounded-xl bg-white/[0.06] p-3 transition hover:bg-white/[0.1]"
      >
        <Avatar name={user.name} size="sm" src={user.photo} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-white">{user.name}</span>
          <span className="block truncate text-[11px] text-brand-200/80">{titleOf(user)}</span>
        </span>
      </Link>
    </>
  )

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-gradient-to-b from-brand-900 via-brand-950 to-brand-950 lg:flex">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-stone-950/50 backdrop-blur-sm" onClick={() => setMobileNavOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] animate-fade-in flex-col bg-gradient-to-b from-brand-900 to-brand-950 shadow-2xl">
            <button
              onClick={() => setMobileNavOpen(false)}
              className="absolute right-3 top-6 rounded-lg p-1.5 text-brand-200 hover:bg-white/10"
              aria-label="Close navigation"
            >
              <Icon name="x" className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-stone-200/70 bg-white/80 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="btn-icon -ml-1 h-10 w-10 lg:hidden"
              aria-label="Open navigation"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M4 6h16M4 12h10M4 18h16" strokeLinecap="round" />
              </svg>
            </button>

            {current && (
              <p className="hidden min-w-0 items-center gap-2 text-sm md:flex">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <Icon name={current.icon} className="h-4 w-4" />
                </span>
                <span className="font-semibold text-stone-800">{current.label}</span>
                {tab && current.children && (
                  <>
                    <Icon name="chevron" className="h-3.5 w-3.5 text-stone-300" />
                    <span className="truncate text-stone-500">{tab.label}</span>
                  </>
                )}
              </p>
            )}

            <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3">
              <GlobalSearch />
              <NotificationBell />
              <span className="hidden whitespace-nowrap rounded-full bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-500 xl:inline">
                {formatDateLong(today())}
              </span>
              <RoleSwitcher />
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-[1440px] animate-fade-in" key={current?.label}>
            {allowed && current?.children && <SectionTabs section={current} pathname={pathname} />}
            {allowed ? <Outlet /> : <NoAccess />}
          </div>
        </main>
      </div>
    </div>
  )
}
