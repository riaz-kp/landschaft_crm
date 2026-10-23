import { lazy } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useSession } from './state/session'
import { AdminShell } from './shells/AdminShell'
import { FieldShell } from './shells/FieldShell'

// Pages load on first visit, so a foreman's phone never downloads the office screens.
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard').then((m) => ({ default: m.Dashboard })))
const Leads = lazy(() => import('./pages/crm/Leads').then((m) => ({ default: m.Leads })))
const Clients = lazy(() => import('./pages/crm/Clients').then((m) => ({ default: m.Clients })))
const ClientDetail = lazy(() => import('./pages/crm/ClientDetail').then((m) => ({ default: m.ClientDetail })))
const SiteVisits = lazy(() => import('./pages/consultations/SiteVisits').then((m) => ({ default: m.SiteVisits })))
const ProjectList = lazy(() => import('./pages/projects/ProjectList').then((m) => ({ default: m.ProjectList })))
const ProjectDetail = lazy(() => import('./pages/projects/ProjectDetail').then((m) => ({ default: m.ProjectDetail })))
const NewProject = lazy(() => import('./pages/projects/NewProject').then((m) => ({ default: m.NewProject })))
const ProjectsMap = lazy(() => import('./pages/projects/ProjectsMap').then((m) => ({ default: m.ProjectsMap })))
const AllTasks = lazy(() => import('./pages/tasks/Tasks').then((m) => ({ default: m.AllTasks })))
const MyTasks = lazy(() => import('./pages/tasks/Tasks').then((m) => ({ default: m.MyTasks })))
const TeamTasks = lazy(() => import('./pages/tasks/Tasks').then((m) => ({ default: m.TeamTasks })))
const TaskBoard = lazy(() => import('./pages/tasks/Tasks').then((m) => ({ default: m.TaskBoard })))
const DesignPhasePage = lazy(() => import('./pages/design/DesignPhasePage').then((m) => ({ default: m.DesignPhasePage })))
const ExecutionProjects = lazy(() => import('./pages/execution/ExecutionProjects').then((m) => ({ default: m.ExecutionProjects })))
const ExecutionPhasePage = lazy(() => import('./pages/execution/ExecutionPhasePage').then((m) => ({ default: m.ExecutionPhasePage })))
const DailyWorkReports = lazy(() => import('./pages/execution/DailyWorkReports').then((m) => ({ default: m.DailyWorkReports })))
const ReportReview = lazy(() => import('./pages/execution/ReportReview').then((m) => ({ default: m.ReportReview })))
const AmcContracts = lazy(() => import('./pages/amc/AmcContracts').then((m) => ({ default: m.AmcContracts })))
const AmcVisits = lazy(() => import('./pages/amc/AmcVisits').then((m) => ({ default: m.AmcVisits })))
const AmcCalendar = lazy(() => import('./pages/amc/AmcCalendar').then((m) => ({ default: m.AmcCalendar })))
const AmcRenewals = lazy(() => import('./pages/amc/AmcRenewals').then((m) => ({ default: m.AmcRenewals })))
const Consultations = lazy(() => import('./pages/consultations/Consultations').then((m) => ({ default: m.Consultations })))
const Quotations = lazy(() => import('./pages/accounts/Quotations').then((m) => ({ default: m.Quotations })))
const PaymentRequests = lazy(() => import('./pages/accounts/PaymentRequests').then((m) => ({ default: m.PaymentRequests })))
const Payments = lazy(() => import('./pages/accounts/Payments').then((m) => ({ default: m.Payments })))
const Employees = lazy(() => import('./pages/employees/Employees').then((m) => ({ default: m.Employees })))
const EmployeeDetail = lazy(() => import('./pages/employees/EmployeeDetail').then((m) => ({ default: m.EmployeeDetail })))
const ExecutionWorkers = lazy(() => import('./pages/employees/ExecutionWorkers').then((m) => ({ default: m.ExecutionWorkers })))
const WorkerDetail = lazy(() => import('./pages/employees/WorkerDetail').then((m) => ({ default: m.WorkerDetail })))
const Gallery = lazy(() => import('./pages/gallery/Gallery').then((m) => ({ default: m.Gallery })))
const Attendance = lazy(() => import('./pages/employees/Attendance').then((m) => ({ default: m.Attendance })))
const WorkReports = lazy(() => import('./pages/employees/WorkReports').then((m) => ({ default: m.WorkReports })))
const Documents = lazy(() => import('./pages/misc/Documents').then((m) => ({ default: m.Documents })))
const CalendarPage = lazy(() => import('./pages/misc/CalendarPage').then((m) => ({ default: m.CalendarPage })))
const ReportsPage = lazy(() => import('./pages/misc/ReportsPage').then((m) => ({ default: m.ReportsPage })))
const SettingsPage = lazy(() => import('./pages/misc/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const NotFound = lazy(() => import('./pages/misc/Fallbacks').then((m) => ({ default: m.NotFound })))
const NoAccess = lazy(() => import('./pages/misc/Fallbacks').then((m) => ({ default: m.NoAccess })))
const MySites = lazy(() => import('./pages/field/MySites').then((m) => ({ default: m.MySites })))
const DailyWorkReportForm = lazy(() => import('./pages/field/DailyWorkReportForm').then((m) => ({ default: m.DailyWorkReportForm })))
const Submitted = lazy(() => import('./pages/field/Submitted').then((m) => ({ default: m.Submitted })))
const FieldReportView = lazy(() => import('./pages/field/FieldWorks').then((m) => ({ default: m.FieldReportView })))
const FieldWorks = lazy(() => import('./pages/field/FieldWorks').then((m) => ({ default: m.FieldWorks })))
const FieldWorkerView = lazy(() => import('./pages/field/FieldWorkers').then((m) => ({ default: m.FieldWorkerView })))
const FieldAttendance = lazy(() => import('./pages/field/FieldMe').then((m) => ({ default: m.FieldAttendance })))
const FieldChat = lazy(() => import('./pages/field/FieldMe').then((m) => ({ default: m.FieldChat })))
const FieldPay = lazy(() => import('./pages/field/FieldMe').then((m) => ({ default: m.FieldPay })))
const FieldProfile = lazy(() => import('./pages/field/FieldMe').then((m) => ({ default: m.FieldProfile })))

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
          <Route path="works" element={<FieldWorks />} />
          <Route path="works/:reportId" element={<FieldReportView />} />
          <Route path="workers/:workerId" element={<FieldWorkerView />} />
          <Route path="attendance" element={<FieldAttendance />} />
          <Route path="pay" element={<FieldPay />} />
          <Route path="profile" element={<FieldProfile />} />
          <Route path="chat/:projectId" element={<FieldChat />} />
        </Route>

        <Route element={<AdminShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/consultations" element={<Consultations />} />
          <Route path="/consultations/site-visits" element={<SiteVisits />} />

          <Route path="/crm/leads" element={<Leads />} />
          <Route path="/crm/clients" element={<Clients />} />
          <Route path="/crm/clients/:clientId" element={<ClientDetail />} />
          {/* Site visits moved from CRM into Consultations. */}
          <Route path="/crm/site-visits" element={<Navigate to="/consultations/site-visits" replace />} />

          <Route path="/projects" element={<ProjectList scope="all" />} />
          <Route path="/projects/new" element={<NewProject />} />
          <Route path="/projects/design" element={<ProjectList scope="design" />} />
          <Route path="/projects/execution" element={<ProjectList scope="execution" />} />
          <Route path="/projects/amc" element={<ProjectList scope="amc" />} />
          <Route path="/projects/map" element={<ProjectsMap />} />
          <Route path="/projects/:projectId" element={<ProjectDetail />} />

          <Route path="/tasks/mine" element={<MyTasks />} />
          <Route path="/tasks/team" element={<TeamTasks />} />
          <Route path="/tasks/all" element={<AllTasks />} />
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
          {/* Maintenance moved out of Execution into its own AMC department. */}
          <Route path="/execution/maintenance" element={<Navigate to="/amc" replace />} />

          <Route path="/amc" element={<AmcContracts />} />
          <Route path="/amc/calendar" element={<AmcCalendar />} />
          <Route path="/amc/visits" element={<AmcVisits />} />
          <Route path="/amc/renewals" element={<AmcRenewals />} />

          <Route path="/accounts/quotations" element={<Quotations />} />
          <Route path="/accounts/payment-requests" element={<PaymentRequests />} />
          <Route path="/accounts/payments" element={<Payments />} />

          <Route path="/employees" element={<Employees />} />
          <Route path="/employees/workers" element={<ExecutionWorkers />} />
          <Route path="/employees/workers/:workerId" element={<WorkerDetail />} />
          <Route path="/employees/attendance" element={<Attendance />} />
          <Route path="/employees/work-reports" element={<WorkReports />} />
          <Route path="/employees/:employeeId" element={<EmployeeDetail />} />

          <Route path="/gallery" element={<Gallery />} />
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
