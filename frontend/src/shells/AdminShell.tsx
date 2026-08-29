import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { navForRole } from '../domain/roles'
import { useSession } from '../state/session'
import { Icon } from '../components/Icon'
import { RoleSwitcher } from '../components/RoleSwitcher'

function Logo() {
  return (
    <div className="flex items-center gap-2.5 px-5 py-5">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-base font-bold text-white">
        L
      </span>
      <span>
        <span className="block text-sm font-bold leading-tight tracking-tight text-white">Landschaft</span>
        <span className="block text-[11px] font-medium uppercase leading-tight tracking-widest text-brand-300">CRM</span>
      </span>
    </div>
  )
}

/** Desktop CRM shell. Foremen never reach this — they are routed to /field. */
export function AdminShell() {
  const { roleKey } = useSession()
  const location = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const sections = navForRole(roleKey)

  const nav = (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-6">
      {sections.map((section) => {
        if (!section.children) {
          return (
            <NavLink
              key={section.label}
              to={section.path!}
              onClick={() => setMobileNavOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand-600 text-white' : 'text-brand-100 hover:bg-brand-800/60'
                }`
              }
            >
              <Icon name={section.icon} className="h-[18px] w-[18px]" />
              {section.label}
            </NavLink>
          )
        }
        const sectionActive = section.children.some(
          (c) => location.pathname === c.path || location.pathname.startsWith(c.path + '/'),
        )
        return (
          <div key={section.label} className="pt-2">
            <p className="flex items-center gap-3 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-400">
              <Icon name={section.icon} className="h-[18px] w-[18px]" />
              {section.label}
            </p>
            <div className="space-y-0.5 pl-[30px]">
              {section.children.map((child) => (
                <NavLink
                  key={child.path}
                  to={child.path}
                  end={child.path === '/projects' || child.path === '/execution' || child.path === '/employees'}
                  onClick={() => setMobileNavOpen(false)}
                  className={({ isActive }) =>
                    `block rounded-lg px-3 py-1.5 text-sm transition-colors ${
                      isActive
                        ? 'bg-brand-600 font-semibold text-white'
                        : `${sectionActive ? 'text-brand-100' : 'text-brand-200'} hover:bg-brand-800/60`
                    }`
                  }
                >
                  {child.label}
                </NavLink>
              ))}
            </div>
          </div>
        )
      })}
    </nav>
  )

  return (
    <div className="flex min-h-screen bg-stone-100">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-brand-900 lg:flex">
        <Logo />
        {nav}
      </aside>

      {/* Mobile drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-stone-900/50" onClick={() => setMobileNavOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-brand-900">
            <Logo />
            {nav}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-stone-200 bg-white/90 px-4 py-2.5 backdrop-blur sm:px-6">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="btn-ghost -ml-2 px-2 lg:hidden"
            aria-label="Open navigation"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>
          <p className="hidden text-sm text-stone-500 sm:block">
            Internal CRM · Design, Execution &amp; Maintenance
          </p>
          <RoleSwitcher />
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
