import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { usePermissions } from '../../state/permissions'
import { ROLES, titleOf } from '../../domain/roles'
import { DEPARTMENTS, type Department, type Employee } from '../../domain/types'
import {
  PageHeader, Section, Table, Badge, Avatar, EmptyState, Pills, SearchInput, Toolbar, RowActions,
  ConfirmDialog, StatTile,
} from '../../components/ui'
import { ContactNumbers } from '../../components/ContactFields'
import { Icon } from '../../components/Icon'
import { EmployeeFormModal } from './EmployeeForm'

/** The organisational structure as supplied by the client. */
export function Employees() {
  const db = useDb()
  const { user } = useSession()
  const { can } = usePermissions()
  const navigate = useNavigate()
  const [department, setDepartment] = useState<Department | 'All'>('All')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Employee | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Employee | null>(null)

  const managerName = (id?: string) => (id ? db.employees.find((e) => e.id === id)?.name ?? '—' : '—')
  const q = query.trim().toLowerCase()
  const matches = (e: Employee) =>
    !q || [e.name, e.email, e.phone, titleOf(e)].some((v) => v.toLowerCase().includes(q))

  const departments = DEPARTMENTS.filter((d) => department === 'All' || d === department)

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle="Internal logins only — the system has no separate client login. Open anyone for their full profile."
        actions={can('Employees', 'create') && (
          <button onClick={() => setEditing('new')} className="btn-primary">
            <Icon name="plus" className="h-4 w-4" /> Add employee
          </button>
        )}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Employees" value={db.employees.length} icon="users" />
        <StatTile label="Departments" value={new Set(db.employees.map((e) => e.department)).size} icon="grid" />
        <StatTile label="Foremen" value={db.employees.filter((e) => e.role === 'foreman').length} tone="clay" icon="hardhat" />
        <StatTile label="Site Workers" value={db.workers.filter((w) => w.active).length} tone="green" icon="hardhat" to="/employees/workers" />
      </div>

      <Toolbar>
        <Pills<Department | 'All'>
          active={department}
          onChange={setDepartment}
          options={[
            { key: 'All', label: 'All', count: db.employees.length },
            ...DEPARTMENTS.map((d) => ({ key: d, label: d, count: db.employees.filter((e) => e.department === d).length })),
          ]}
        />
        <SearchInput value={query} onChange={setQuery} placeholder="Search name, email, phone…" className="lg:w-72" />
      </Toolbar>

      <div className="space-y-6">
        {departments.map((dept) => {
          const people = db.employees.filter((e) => e.department === dept && matches(e))
          // AMC is shown even before anyone is assigned, so the department is visible.
          if (people.length === 0 && !(dept === 'AMC' && !q)) return null
          return (
            <Section key={dept} title={dept} description={`${people.length} ${people.length === 1 ? 'person' : 'people'}`}>
              {people.length === 0 ? (
                <EmptyState
                  title="No one assigned to AMC yet."
                  hint="Open an employee → Role in Company to move them into the AMC department."
                  icon="leaf"
                />
              ) : (
                <Table head={['Name', 'Role', 'Reports To', 'Phone / WhatsApp', 'Email', '']}>
                  {people.map((person) => (
                    <tr key={person.id} className="row-hover">
                      <td className="td">
                        <Link to={`/employees/${person.id}`} className="flex items-center gap-2.5">
                          <Avatar name={person.name} size="sm" src={person.photo} />
                          <span className="font-medium text-stone-900 hover:text-brand-700">{person.name}</span>
                        </Link>
                      </td>
                      <td className="td">
                        <Badge tone={person.role === 'foreman' ? 'clay' : person.designation ? 'violet' : 'stone'}>
                          {titleOf(person)}
                        </Badge>
                      </td>
                      <td className="td">{managerName(person.reportsTo)}</td>
                      <td className="td"><ContactNumbers phone={person.phone} whatsapp={person.whatsapp} /></td>
                      <td className="td">{person.email}</td>
                      <td className="td">
                        <RowActions
                          onEdit={can('Employees', 'edit') ? () => setEditing(person) : undefined}
                          onDelete={can('Employees', 'delete') && person.role !== 'super_admin' ? () => setDeleting(person) : undefined}
                        />
                      </td>
                    </tr>
                  ))}
                </Table>
              )}
            </Section>
          )
        })}
        {departments.every((d) => !db.employees.some((e) => e.department === d && matches(e))) && q && (
          <Section><EmptyState title={`No employees match “${query.trim()}”.`} icon="search" /></Section>
        )}
      </div>

      <Section
        title="Roles"
        description="What each login role is for. Change what each role can open in Settings → Roles & Permissions."
        className="mt-6"
        actions={can('Settings', 'view') && <Link to="/settings" className="text-sm font-semibold text-brand-700">Manage permissions</Link>}
      >
        <Table head={['Role', 'Remit', 'People']}>
          {Object.values(ROLES).map((role) => (
            <tr key={role.key} className="row-hover">
              <td className="td font-medium text-stone-900">{role.title}</td>
              <td className="td">{role.remit}</td>
              <td className="td tabular-nums">{db.employees.filter((e) => e.role === role.key).length}</td>
            </tr>
          ))}
        </Table>
      </Section>

      {editing && (
        <EmployeeFormModal
          employee={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => editing === 'new' && navigate(`/employees/${saved.id}`)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          onClose={() => setDeleting(null)}
          onConfirm={() => api.employees.remove(deleting.id)}
          blocked={
            deleting.id === user.id ? 'You cannot delete your own login.'
              : db.projects.some((p) => p.projectManagerId === deleting.id)
                ? `${deleting.name} manages ${db.projects.filter((p) => p.projectManagerId === deleting.id).length} project(s). Reassign them to another manager first.`
                : undefined
          }
          message={<>
            This removes their login, profile and attendance.
            {db.tasks.some((t) => t.assigneeId === deleting.id && t.status !== 'Done') && (
              <> Their {db.tasks.filter((t) => t.assigneeId === deleting.id && t.status !== 'Done').length} open task(s) will be left without an assignee.</>
            )}
            {' '}Anyone reporting to them moves up to {managerName(deleting.reportsTo)}.
          </>}
        />
      )}
    </div>
  )
}
