import { Link } from 'react-router-dom'
import { EmptyState, Section } from '../../components/ui'

export function NotFound() {
  return (
    <Section>
      <EmptyState title="Page not found." hint="Check the address, or go back to the dashboard." />
      <div className="pb-8 text-center">
        <Link to="/dashboard" className="btn-secondary">Back to dashboard</Link>
      </div>
    </Section>
  )
}

export function NoAccess() {
  return (
    <Section>
      <EmptyState
        title="You do not have access to this section."
        hint="Your role does not include this part of the system."
      />
      <div className="pb-8 text-center">
        <Link to="/dashboard" className="btn-secondary">Back to dashboard</Link>
      </div>
    </Section>
  )
}

/** Shown for the moment a page's code is still on its way. */
export function PageLoading() {
  return (
    <div className="flex items-center justify-center py-24" aria-label="Loading">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
    </div>
  )
}
