import { Link } from 'react-router-dom'
import { useDb } from '../../state/useDb'
import { ROLES } from '../../domain/roles'
import { DEPARTMENTS } from '../../domain/types'
import {
  PageHeader, Section, Table, Badge, Avatar, EmptyState,
} from '../../components/ui'
import { ContactNumbers } from '../../components/ContactFields'

/** The organisational structure as supplied by the client. */
export function Employees() {
  const db = useDb()

  const managerName = (id?: string) =>
    id ? db.employees.find((e) => e.id === id)?.name ?? '—' : '—'

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle="Internal logins only — the system has no separate client login. Open anyone for their full profile."
      />

      <div className="space-y-6">
        {DEPARTMENTS.map((department) => {
          const people = db.employees.filter((e) => e.department === department)
          // AMC is shown even before anyone is assigned, so the department is visible.
          if (people.length === 0 && department !== 'AMC') return null
          return (
            <Section key={department} title={department}>
              {people.length === 0 ? (
                <EmptyState
                  title="No one assigned to AMC yet."
                  hint="Open an employee → Role in Company to move them into the AMC department."
                />
              ) : (
              <Table head={['Name', 'Role', 'Reports To', 'Phone / WhatsApp', 'Email']}>
                {people.map((person) => (
                  <tr key={person.id} className="row-hover">
                    <td className="td">
                      <Link to={`/employees/${person.id}`} className="flex items-center gap-2.5">
                        <Avatar name={person.name} size="sm" src={person.photo} />
                        <span className="font-medium text-stone-900 hover:text-brand-700">{person.name}</span>
                      </Link>
                    </td>
                    <td className="td">
                      <Badge tone={person.role === 'foreman' ? 'clay' : 'stone'}>
                        {ROLES[person.role].title}
                      </Badge>
                    </td>
                    <td className="td">{managerName(person.reportsTo)}</td>
                    <td className="td"><ContactNumbers phone={person.phone} whatsapp={person.whatsapp} /></td>
                    <td className="td">{person.email}</td>
                  </tr>
                ))}
              </Table>
              )}
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
