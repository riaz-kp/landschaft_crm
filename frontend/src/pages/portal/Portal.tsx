import { lazy, Suspense, type ReactNode } from 'react'
import { Route, Routes } from 'react-router-dom'
import { LogoLockup } from '../../components/Logo'
import { Icon } from '../../components/Icon'

const AmcReport = lazy(() => import('./AmcReport').then((m) => ({ default: m.AmcReport })))
const ChecklistForm = lazy(() => import('./ChecklistForm').then((m) => ({ default: m.ChecklistForm })))

/**
 * Pages a client opens from a link the team sends them — no login, no CRM
 * around them. main.tsx renders this instead of the app for /portal/… paths.
 */
export function Portal() {
  return (
    <Suspense fallback={<PortalFrame><PortalLoading /></PortalFrame>}>
      <Routes>
        <Route path="/portal/amc/:token" element={<AmcReport />} />
        <Route path="/portal/checklist/:token" element={<ChecklistForm />} />
        <Route path="*" element={<PortalFrame><PortalMessage title="Link not found" message="Check the link you were sent, or ask Landschaft for a new one." /></PortalFrame>} />
      </Routes>
    </Suspense>
  )
}

/** The brand band across the top, and the page on a warm background. */
export function PortalFrame({ eyebrow, title, subtitle, children }: { eyebrow?: string; title?: ReactNode; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-gradient-to-br from-brand-900 via-brand-950 to-brand-950 text-white">
        <div className="mx-auto max-w-3xl px-4 pb-10 pt-6 sm:px-6">
          <LogoLockup sub="Landscape studio" />
          {title && (
            <div className="mt-8">
              {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#C8B8A2]">{eyebrow}</p>}
              <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
              {subtitle && <div className="mt-2 text-sm text-brand-100/80">{subtitle}</div>}
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto -mt-5 max-w-3xl px-4 pb-16 sm:px-6">{children}</main>
      <footer className="mx-auto max-w-3xl px-4 pb-10 text-center text-xs text-stone-400 sm:px-6">
        Shared with you by Landschaft. Keep this link to yourself — anyone who has it can open this page.
      </footer>
    </div>
  )
}

export function PortalLoading() {
  return (
    <div className="card flex items-center justify-center gap-3 px-5 py-16 text-sm text-stone-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /> Loading…
    </div>
  )
}

export function PortalMessage({ title, message }: { title: string; message: string }) {
  return (
    <div className="card flex flex-col items-center px-5 py-14 text-center">
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
        <Icon name="alert" className="h-5 w-5" />
      </span>
      <p className="font-semibold text-stone-900">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-stone-500">{message}</p>
    </div>
  )
}
