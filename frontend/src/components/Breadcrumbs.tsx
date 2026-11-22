import { Fragment } from 'react'
import { Link, matchPath, useLocation, useNavigate } from 'react-router-dom'
import type { NavItem, NavSection } from '../domain/roles'
import type { DbShape } from '../data/store'
import { KIND_TITLE } from '../domain/quotation'
import { formatDate } from '../domain/format'
import { Icon } from './Icon'

export interface Crumb {
  label: string
  to?: string
}

/** The opened record (a project, a client, a quotation…) the URL points at, as crumbs after the section. */
function recordCrumbs(pathname: string, db: DbShape): Crumb[] {
  const m = (pattern: string) => matchPath(pattern, pathname)?.params

  let p = m('/crm/clients/:clientId')
  if (p) return [{ label: db.clients.find((c) => c.id === p!.clientId)?.name ?? 'Client' }]

  if (pathname === '/projects/new') return [{ label: 'New Project' }]

  p = m('/projects/:projectId/commercial/:quoteId/*') ?? m('/projects/:projectId/commercial/:quoteId')
  if (p) {
    const project = db.projects.find((x) => x.id === p!.projectId)
    const quote = db.quotations.find((q) => q.id === p!.quoteId)
    const crumbs: Crumb[] = [
      { label: project?.name ?? 'Project', to: `/projects/${p.projectId}?tab=commercial` },
      {
        label: quote ? quote.number || KIND_TITLE[quote.kind] : 'Document',
        to: `/projects/${p.projectId}/commercial/${p.quoteId}`,
      },
    ]
    if (pathname.endsWith('/edit')) crumbs.push({ label: 'Edit' })
    return crumbs
  }

  p = m('/projects/:projectId')
  // The list tabs (/projects/design, /projects/map…) are not projects.
  if (p && !['design', 'execution', 'amc', 'map'].includes(p.projectId!)) return [{ label: db.projects.find((x) => x.id === p!.projectId)?.name ?? 'Project' }]

  p = m('/execution/reports/:reportId')
  if (p) {
    const report = db.reports.find((r) => r.id === p!.reportId)
    const project = report && db.projects.find((x) => x.id === report.projectId)
    return [{ label: report ? `${project?.name ?? report.siteLocation} · ${formatDate(report.date)}` : 'Report' }]
  }

  p = m('/employees/workers/:workerId')
  if (p) return [{ label: db.workers.find((w) => w.id === p!.workerId)?.name ?? 'Worker' }]

  p = m('/employees/:employeeId')
  if (p && !['workers', 'attendance', 'work-reports'].includes(p.employeeId!)) {
    return [{ label: db.employees.find((e) => e.id === p!.employeeId)?.name ?? 'Employee' }]
  }

  return []
}

/** Section › tab › record for the current URL. The last crumb is the page itself. */
export function buildCrumbs(
  pathname: string, db: DbShape, section: NavSection | undefined, sectionPath: string | undefined, tab: NavItem | undefined,
): Crumb[] {
  const crumbs: Crumb[] = []
  if (section) {
    crumbs.push({ label: section.label, to: sectionPath ?? section.path })
    // "Consultations › Consultations" says nothing; the section crumb already covers it.
    if (tab && tab.label !== section.label) crumbs.push({ label: tab.label, to: tab.path })
  }
  crumbs.push(...recordCrumbs(pathname, db))
  if (!crumbs.length) crumbs.push({ label: pathname === '/no-access' ? 'No access' : 'Page not found' })
  // The page you are on is not a link.
  crumbs[crumbs.length - 1] = { label: crumbs[crumbs.length - 1].label }
  return crumbs
}

/**
 * A Back button and the trail of pages above this one, at the top of every
 * CRM page. Back returns to the page you came from; opened straight from a
 * link (no history in the app), it goes one level up the trail instead.
 */
export function PageTrail({ crumbs, parentTo }: { crumbs: Crumb[]; parentTo: string }) {
  const navigate = useNavigate()
  const location = useLocation()

  const back = () => {
    if (location.key !== 'default') navigate(-1)
    else navigate(parentTo)
  }

  return (
    <div className="mb-4 flex min-w-0 items-center gap-2 text-sm">
      <button
        type="button"
        onClick={back}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 font-medium text-stone-600 shadow-sm transition hover:border-stone-300 hover:text-stone-900"
        aria-label="Go back"
      >
        <Icon name="back" className="h-4 w-4" />
        <span>Back</span>
      </button>

      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex min-w-0 items-center gap-1.5">
          <li className="hidden shrink-0 sm:block">
            <Link to="/dashboard" className="flex rounded-md p-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700" aria-label="Dashboard">
              <Icon name="home" className="h-4 w-4" />
            </Link>
          </li>
          {crumbs.map((c, i) => {
            const isLast = i === crumbs.length - 1
            // On a phone only the page above and this one fit; the rest show from the small breakpoint up.
            const early = i < crumbs.length - 2
            const firstOnPhone = i === Math.max(0, crumbs.length - 2)
            return (
              <Fragment key={i}>
                <li className={`shrink-0 text-stone-300 ${early || firstOnPhone ? 'hidden sm:block' : ''}`} aria-hidden>
                  <Icon name="chevron" className="h-3.5 w-3.5" />
                </li>
                <li className={`min-w-0 ${isLast ? 'max-w-[70%] shrink-0' : ''} ${early ? 'hidden sm:block' : ''}`}>
                  {c.to && !isLast ? (
                    <Link to={c.to} className="block max-w-[14rem] truncate rounded-md px-1 py-0.5 text-stone-500 transition hover:bg-stone-100 hover:text-stone-900">
                      {c.label}
                    </Link>
                  ) : (
                    <span className="block truncate px-1 py-0.5 font-semibold text-stone-800" aria-current="page">{c.label}</span>
                  )}
                </li>
              </Fragment>
            )
          })}
        </ol>
      </nav>
    </div>
  )
}
