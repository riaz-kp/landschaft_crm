import { useState } from 'react'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { ROLES } from '../../domain/roles'
import { DEPARTMENTS, type Department, type Employee, type RoleKey } from '../../domain/types'
import { Field, FormError, Modal } from '../../components/ui'
import { PhoneWhatsAppFields } from '../../components/ContactFields'
import { today } from '../../domain/format'
import { SearchSelect } from '../../components/SearchSelect'
import { employeeOptions } from '../../components/pickerOptions'

/** The department a role normally sits in, used to pre-fill the form. */
const ROLE_DEPARTMENT: Record<RoleKey, Department> = {
  super_admin: 'Management', ceo: 'Management',
  design_director: 'Design', design_pm: 'Design', design_member: 'Design',
  execution_head: 'Execution', execution_pm: 'Execution', foreman: 'Execution',
  accounts: 'Accounts', marketing: 'Marketing',
}

/** Add an employee, or edit the essentials of one when `employee` is passed. */
export function EmployeeFormModal({
  employee, onClose, onSaved,
}: { employee?: Employee; onClose: () => void; onSaved?: (employee: Employee) => void }) {
  const db = useDb()
  const [form, setForm] = useState({
    name: employee?.name ?? '',
    designation: employee?.designation ?? '',
    role: employee?.role ?? ('design_member' as RoleKey),
    department: employee?.department ?? ('Design' as Department),
    reportsTo: employee?.reportsTo ?? '',
    phone: employee?.phone ?? '',
    whatsapp: employee?.whatsapp ?? '',
    email: employee?.email ?? '',
    joinedOn: employee?.joinedOn ?? (employee ? '' : today()),
    monthlySalary: employee?.monthlySalary ? String(employee.monthlySalary) : '',
  })
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<typeof form>) => { setForm({ ...form, ...patch }); setError(null) }

  const save = () => {
    if (!form.name.trim()) return setError('Enter the employee’s name.')
    if (!form.phone.trim()) return setError('Enter a mobile number.')
    if (!form.email.trim()) return setError('Enter an email address — it is their login.')
    const clash = db.employees.find((e) => e.email.toLowerCase() === form.email.trim().toLowerCase() && e.id !== employee?.id)
    if (clash) return setError(`${clash.name} already uses that email.`)
    const values = {
      name: form.name.trim(),
      designation: form.designation.trim() || undefined,
      role: form.role,
      department: form.department,
      reportsTo: form.reportsTo || undefined,
      phone: form.phone.trim(),
      whatsapp: form.whatsapp.trim() || form.phone.trim(),
      email: form.email.trim(),
      joinedOn: form.joinedOn || undefined,
      monthlySalary: form.monthlySalary ? Math.max(0, Number(form.monthlySalary)) : undefined,
    }
    if (employee) {
      api.employees.update(employee.id, values)
      onSaved?.({ ...employee, ...values })
    } else {
      onSaved?.(api.employees.create(values))
    }
    onClose()
  }

  return (
    <Modal
      title={employee ? `Edit ${employee.name}` : 'Add employee'}
      size="lg"
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={save} className="btn-primary">{employee ? 'Save changes' : 'Add employee'}</button>
      </>}
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required>
            <input className="input" value={form.name} onChange={(e) => set({ name: e.target.value })} autoFocus />
          </Field>
          <Field label="Designation" hint="Shown instead of the role title, e.g. Co-Founder.">
            <input className="input" value={form.designation} placeholder={ROLES[form.role].title} onChange={(e) => set({ designation: e.target.value })} />
          </Field>
          <Field label="System role" required hint="Decides what they can open — see Settings → Roles & Permissions.">
            <select
              className="input" value={form.role}
              onChange={(e) => {
                const role = e.target.value as RoleKey
                set({ role, department: employee ? form.department : ROLE_DEPARTMENT[role] })
              }}
            >
              {Object.values(ROLES).map((r) => <option key={r.key} value={r.key}>{r.title}</option>)}
            </select>
          </Field>
          <Field label="Department">
            <select className="input" value={form.department} onChange={(e) => set({ department: e.target.value as Department })}>
              {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </Field>
          <Field label="Reports to">
            <SearchSelect
              value={form.reportsTo}
              onChange={(reportsTo) => set({ reportsTo })}
              options={employeeOptions(db.employees.filter((e) => e.id !== employee?.id && e.role !== 'foreman'))}
              emptyOption="No one"
              searchPlaceholder="Search people"
              title="Reports to"
            />
          </Field>
          <Field label="Date of joining">
            <input type="date" className="input" value={form.joinedOn} onChange={(e) => set({ joinedOn: e.target.value })} />
          </Field>
          <Field label="Monthly salary" hint="Rupees. Pay is worked out pro rata to days attended.">
            <input type="number" min={0} className="input" value={form.monthlySalary} placeholder="0" onChange={(e) => set({ monthlySalary: e.target.value })} />
          </Field>
        </div>
        <PhoneWhatsAppFields
          required phone={form.phone} whatsapp={form.whatsapp}
          onChange={(numbers) => set(numbers)}
        />
        <Field label="Email" required>
          <input type="email" className="input" value={form.email} onChange={(e) => set({ email: e.target.value })} />
        </Field>
        <FormError message={error} />
      </div>
    </Modal>
  )
}
