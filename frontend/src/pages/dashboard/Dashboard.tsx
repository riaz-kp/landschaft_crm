import { useSession } from '../../state/session'
import { PeriodProvider } from '../../components/PeriodSwitch'
import { ExecutionDashboard } from './ExecutionDashboard'
import { DesignDashboard } from './DesignDashboard'
import { OverviewDashboard } from './OverviewDashboard'
import { AccountsDashboard } from './AccountsDashboard'
import { MarketingDashboard } from './MarketingDashboard'

function ForRole() {
  const { roleKey } = useSession()
  switch (roleKey) {
    case 'execution_head':
    case 'execution_pm':
      return <ExecutionDashboard />
    case 'design_director':
    case 'design_pm':
    case 'design_member':
      return <DesignDashboard />
    case 'accounts':
      return <AccountsDashboard />
    case 'marketing':
      return <MarketingDashboard />
    default:
      return <OverviewDashboard />
  }
}

/** Each role lands on the dashboard that matches what they actually run, filtered by the chosen time window. */
export function Dashboard() {
  return (
    <PeriodProvider>
      <ForRole />
    </PeriodProvider>
  )
}
