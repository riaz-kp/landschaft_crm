import { useDb } from '../../state/useDb'
import { ROLES } from '../../domain/roles'
import {
  PageHeader, Section, Table, Badge, Avatar,
} from '../../components/ui'

/** The organisational structure as supplied by the client. */
export function Employees() {
  const db = useDb()

  const departments = ['Management', 'Design', 'Execution', 'Accounts', 'Marketing'] as const
  const managerName = (id?: string) =>
    id ? db.employees.find((e) => e.id === id)?.name ?? '—' : '—'

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle="Internal logins only — the system has no separate client login."
      />

      <div className="space-y-6">
        {departments.map((department) => {
          const people = db.employees.filter((e) => e.department === department)
          if (people.length === 0) return null
          return (
            <Section key={department} title={department}>
              <Table head={['Name', 'Role', 'Reports To', 'Phone', 'Email']}>
                {people.map((person) => (
                  <tr key={person.id} className="row-hover">
                    <td className="td">
                      <span className="flex items-center gap-2.5">
                        <Avatar name={person.name} size="sm" />
                        <span className="font-medium text-stone-900">{person.name}</span>
                      </span>
                    </td>
                    <td className="td">
                      <Badge tone={person.role === 'foreman' ? 'clay' : 'stone'}>
                        {ROLES[person.role].title}
                      </Badge>
                    </td>
                    <td className="td">{managerName(person.reportsTo)}</td>
                    <td className="td tabular-nums">{person.phone}</td>
                    <td className="td">{person.email}</td>
                  </tr>
                ))}
              </Table>
            </Section>
          )
        })}
      </div>

      <Section title="Role Permissions" className="mt-6">
        <Table head={['Role', 'Remit']}>
          {Object.values(ROLES).map((role) => (
            <tr key={role.key} className="row-hover">
              <td className="td font-medium text-stone-900">{role.title}</td>
              <td className="td">{role.remit}</td>
            </tr>
          ))}
        </Table>
      </Section>
    </div>
  )
}
