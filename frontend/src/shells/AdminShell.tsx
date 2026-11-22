import { useEffect, useRef, useState, Suspense } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { moduleOf, navForRole, sectionForPath, titleOf, type NavSection } from '../domain/roles'
import { formatDateLong, today } from '../domain/format'
import { useSession } from '../state/session'
import { useDb } from '../state/useDb'
import { usePermissions } from '../state/permissions'
import { Icon } from '../components/Icon'
import { Avatar } from '../components/ui'
import { LogoLockup } from '../components/Logo'
import { UserMenu } from '../components/UserMenu'
import { SyncIndicator } from '../components/SyncIndicator'
import { GlobalSearch } from '../components/GlobalSearch'
import { NotificationBell } from '../components/NotificationBell'
import { NoAccess, PageLoading } from '../pages/misc/Fallbacks'
import { PageTrail, buildCrumbs } from '../components/Breadcrumbs'
import { useSwipeDrawer } from './useSwipeDrawer'

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
  const db = useDb()
  const { settings } = db
  const { canView } = usePermissions()
  const { pathname } = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const drawerRef = useRef<HTMLElement>(null)
  // How far open the phone drawer is while a finger drags it; null when it rests open or shut.
  const drag = useSwipeDrawer(mobileNavOpen, setMobileNavOpen, drawerRef)
  const drawerShown = drag ?? (mobileNavOpen ? 1 : 0)
  const settling = drag === null
  const sections = navForRole(roleKey, settings.permissions)
  const current = sectionForPath(pathname)
  const tab = current && activeChild(current, pathname)
  // The same section with only the tabs this role may open.
  const visible = sections.find((s) => s.label === current?.label)
  // The tabs belong to the list pages; an opened record (a project, a client…) has its own.
  const onListPage = Boolean(visible?.children?.some((c) => c.path === pathname))
  // Back and the breadcrumb trail on every page but the dashboard, which is home.
  const crumbs = pathname === '/dashboard' ? [] : buildCrumbs(pathname, db, current, visible?.path, visible && activeChild(visible, pathname))
  const parentTo = [...crumbs].reverse().find((c) => c.to)?.to ?? '/dashboard'

  // Close the drawer and return to the top whenever the page changes.
  useEffect(() => {
    setMobileNavOpen(false)
    window.scrollTo({ top: 0 })
  }, [pathname])

  // The page behind an open drawer stays still.
  useEffect(() => {
    if (!mobileNavOpen) return
    const before = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileNavOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = before
      window.removeEventListener('keydown', onKey)
    }
  }, [mobileNavOpen])

  // Anyone may open their own profile, whatever the Employees permission says.
  const ownProfile = pathname === `/employees/${user.id}`
  const allowed = !current || ownProfile || canView(moduleOf(current, tab))

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

      {/* Mobile drawer: slides in from the left, by the menu button or a swipe to the right, and follows the finger. */}
      <div
        className="fixed inset-0 z-50 lg:hidden"
        style={{
          visibility: drawerShown > 0 ? 'visible' : 'hidden',
          // Stay visible until the slide out has finished.
          transition: settling ? `visibility 0s linear ${drawerShown > 0 ? '0s' : '280ms'}` : 'none',
        }}
        aria-hidden={!mobileNavOpen}
      >
        <div
          className="absolute inset-0 bg-stone-950/50 backdrop-blur-[2px]"
          style={{ opacity: drawerShown, transition: settling ? 'opacity 280ms ease' : 'none' }}
          onClick={() => setMobileNavOpen(false)}
        />
        <aside
          ref={drawerRef}
          className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-gradient-to-b from-brand-900 to-brand-950 pb-[env(safe-area-inset-bottom)] shadow-2xl will-change-transform"
          style={{
            transform: `translate3d(${(drawerShown - 1) * 100}%, 0, 0)`,
            transition: settling ? 'transform 280ms cubic-bezier(0.22, 0.8, 0.24, 1)' : 'none',
          }}
        >
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

            <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3">
              <SyncIndicator />
              <GlobalSearch />
              <NotificationBell />
              <span className="hidden whitespace-nowrap rounded-full bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-500 xl:inline">
                {formatDateLong(today())}
              </span>
              <UserMenu />
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-5 sm:px-6 sm:pt-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-[1440px] animate-fade-in" key={current?.label}>
            {crumbs.length > 0 && <PageTrail crumbs={crumbs} parentTo={parentTo} />}
            {allowed && onListPage && visible && visible.children!.length > 1 && <SectionTabs section={visible} pathname={pathname} />}
            {allowed ? <Suspense fallback={<PageLoading />}><Outlet /></Suspense> : <NoAccess />}
          </div>
        </main>
      </div>

      <BottomBar sections={sections} current={current} onMenu={() => setMobileNavOpen(true)} />
    </div>
  )
}

/** The sections a phone's bottom bar offers first, in order, when the role can open them. */
const BOTTOM_PREFERENCE = ['Dashboard', 'Projects', 'Tasks', 'CRM', 'Consultations', 'Execution', 'AMC', 'Design', 'Accounts', 'Employees']
const SHORT_LABEL: Record<string, string> = { Dashboard: 'Home', CRM: 'Clients', Consultations: 'Diary', Employees: 'People' }

/**
 * A phone's tab bar: four of the role's main sections within thumb reach, and
 * Menu for the rest. The sidebar also opens with a swipe to the right.
 */
function BottomBar({ sections, current, onMenu }: { sections: NavSection[]; current?: NavSection; onMenu: () => void }) {
  const tabs = BOTTOM_PREFERENCE
    .map((label) => sections.find((s) => s.label === label))
    .filter((s): s is NavSection => Boolean(s))
    .slice(0, 4)
  const elsewhere = Boolean(current) && !tabs.some((t) => t.label === current?.label)
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200/80 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(0,0,0,0.04)] backdrop-blur-xl lg:hidden print:hidden"
      aria-label="Main sections"
    >
      <div className="mx-auto grid max-w-xl" style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}>
        {tabs.map((section) => {
          const on = current?.label === section.label
          return (
            <Link
              key={section.label}
              to={section.path}
              className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold transition active:scale-95 ${on ? 'text-brand-700' : 'text-stone-400'}`}
              aria-current={on ? 'page' : undefined}
            >
              {on && <span className="absolute inset-x-6 top-0 h-0.5 rounded-b-full bg-brand-600" />}
              <span className={`flex h-7 w-12 items-center justify-center rounded-full transition ${on ? 'bg-brand-50' : ''}`}>
                <Icon name={section.icon} className="h-5 w-5" />
              </span>
              {SHORT_LABEL[section.label] ?? section.label}
            </Link>
          )
        })}
        <button
          type="button"
          onClick={onMenu}
          className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold transition active:scale-95 ${elsewhere ? 'text-brand-700' : 'text-stone-400'}`}
          aria-label="Open navigation"
        >
          {elsewhere && <span className="absolute inset-x-6 top-0 h-0.5 rounded-b-full bg-brand-600" />}
          <span className={`flex h-7 w-12 items-center justify-center rounded-full ${elsewhere ? 'bg-brand-50' : ''}`}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </span>
          {elsewhere ? (SHORT_LABEL[current!.label] ?? current!.label) : 'Menu'}
        </button>
      </div>
    </nav>
  )
}
