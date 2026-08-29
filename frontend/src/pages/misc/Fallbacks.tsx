import { Link } from 'react-router-dom'
import { EmptyState, Section } from '../../components/ui'

export function NotFound() {
  return (
    <Section>
      <EmptyState title="Page not found." hint="This screen is not part of the prototype." />
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
