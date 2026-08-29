import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useSession } from './state/session'
import { AdminShell } from './shells/AdminShell'
import { FieldShell } from './shells/FieldShell'

import { Dashboard } from './pages/dashboard/Dashboard'
import { Leads } from './pages/crm/Leads'
import { Clients } from './pages/crm/Clients'
import { SiteVisits } from './pages/crm/SiteVisits'
import { ProjectList } from './pages/projects/ProjectList'
import { ProjectDetail } from './pages/projects/ProjectDetail'
import { NewProject } from './pages/projects/NewProject'
import { MyTasks, TeamTasks, TaskBoard } from './pages/tasks/Tasks'
import { DesignPhasePage } from './pages/design/DesignPhasePage'
import { ExecutionProjects } from './pages/execution/ExecutionProjects'
import { ExecutionPhasePage } from './pages/execution/ExecutionPhasePage'
import { DailyWorkReports } from './pages/execution/DailyWorkReports'
import { ReportReview } from './pages/execution/ReportReview'
import { Maintenance } from './pages/execution/Maintenance'
import { Quotations } from './pages/accounts/Quotations'
import { PaymentRequests } from './pages/accounts/PaymentRequests'
import { Payments } from './pages/accounts/Payments'
import { Employees } from './pages/employees/Employees'
import { ExecutionWorkers } from './pages/employees/ExecutionWorkers'
import { Attendance } from './pages/employees/Attendance'
import { WorkReports } from './pages/employees/WorkReports'
import { Documents } from './pages/misc/Documents'
import { CalendarPage } from './pages/misc/CalendarPage'
import { ReportsPage } from './pages/misc/ReportsPage'
import { SettingsPage } from './pages/misc/SettingsPage'
import { NotFound, NoAccess } from './pages/misc/Fallbacks'

import { MySites } from './pages/field/MySites'
import { DailyWorkReportForm } from './pages/field/DailyWorkReportForm'
import { Submitted } from './pages/field/Submitted'

/** Foremen are confined to the field app; everyone else is kept out of it. */
function RoleRouting({ children }: { children: React.ReactNode }) {
  const { roleKey } = useSession()
  const { pathname } = useLocation()
  const inField = pathname.startsWith('/field')

  if (roleKey === 'foreman' && !inField) return <Navigate to="/field" replace />
  if (roleKey !== 'foreman' && inField) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export function App() {
  return (
    <RoleRouting>
      <Routes>
        <Route path="/field" element={<FieldShell />}>
          <Route index element={<MySites />} />
          <Route path="report/:projectId" element={<DailyWorkReportForm />} />
          <Route path="submitted/:reportId" element={<Submitted />} />
        </Route>

        <Route element={<AdminShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />

          <Route path="/crm/leads" element={<Leads />} />
          <Route path="/crm/clients" element={<Clients />} />
          <Route path="/crm/site-visits" element={<SiteVisits />} />

          <Route path="/projects" element={<ProjectList scope="all" />} />
          <Route path="/projects/new" element={<NewProject />} />
          <Route path="/projects/design" element={<ProjectList scope="design" />} />
          <Route path="/projects/execution" element={<ProjectList scope="execution" />} />
          <Route path="/projects/:projectId" element={<ProjectDetail />} />

          <Route path="/tasks/mine" element={<MyTasks />} />
          <Route path="/tasks/team" element={<TeamTasks />} />
          <Route path="/tasks/board" element={<TaskBoard />} />

          <Route path="/design/concept" element={<DesignPhasePage phase="concept" />} />
          <Route path="/design/3d" element={<DesignPhasePage phase="threeD" />} />
          <Route path="/design/civil" element={<DesignPhasePage phase="civilWork" />} />
          <Route path="/design/boq" element={<DesignPhasePage phase="boq" />} />

          <Route path="/execution" element={<ExecutionProjects />} />
          <Route path="/execution/hardscape" element={<ExecutionPhasePage phase="hardscape" />} />
          <Route path="/execution/softscape" element={<ExecutionPhasePage phase="softscape" />} />
          <Route path="/execution/mep" element={<ExecutionPhasePage phase="mep" />} />
          <Route path="/execution/reports" element={<DailyWorkReports />} />
          <Route path="/execution/reports/:reportId" element={<ReportReview />} />
          <Route path="/execution/maintenance" element={<Maintenance />} />

          <Route path="/accounts/quotations" element={<Quotations />} />
          <Route path="/accounts/payment-requests" element={<PaymentRequests />} />
          <Route path="/accounts/payments" element={<Payments />} />

          <Route path="/employees" element={<Employees />} />
          <Route path="/employees/workers" element={<ExecutionWorkers />} />
          <Route path="/employees/attendance" element={<Attendance />} />
          <Route path="/employees/work-reports" element={<WorkReports />} />

          <Route path="/documents" element={<Documents />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />

          <Route path="/no-access" element={<NoAccess />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </RoleRouting>
  )
}
