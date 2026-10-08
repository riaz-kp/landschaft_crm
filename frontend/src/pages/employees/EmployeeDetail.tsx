import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { ROLES, titleOf } from '../../domain/roles'
import { usePermissions } from '../../state/permissions'
import { daysBetween, formatDateLong, today } from '../../domain/format'
import { BLOOD_GROUPS, DEPARTMENTS, type Department, type Employee } from '../../domain/types'
import {
  PageHeader, Section, EmptyState, Avatar, DepartmentBadge, Tabs, Field, ProgressBar, ConfirmDialog,
} from '../../components/ui'
import { ContactNumbers, PhoneWhatsAppFields } from '../../components/ContactFields'
import { RepeaterList } from '../../components/RepeaterList'
import { Icon } from '../../components/Icon'
import { resizeImage } from '../../components/imageResize'
import { NoAccess } from '../misc/Fallbacks'
import { EmployeeWorks } from './EmployeeWorks'
import { EmployeeAttendance } from './EmployeeAttendance'
import { EmployeeFormModal } from './EmployeeForm'

type Tab = 'profile' | 'works' | 'attendance' | 'role'

type FieldKey =
  | 'name' | 'dob' | 'address' | 'phone' | 'email' | 'bloodGroup' | 'qualification' | 'joinedOn'
  | 'fatherName' | 'fatherOccupation' | 'motherName' | 'motherOccupation' | 'fatherMobile' | 'siblings'

type FieldDef = { key: FieldKey; label: string; type?: 'date' | 'textarea' | 'tel' | 'email' | 'blood' }

/** The fields the client listed, in the client's order and wording. */
const PERSONAL: FieldDef[] = [
  { key: 'name', label: 'Name' },
  { key: 'dob', label: 'DoB', type: 'date' },
  { key: 'address', label: 'Address', type: 'textarea' },
  { key: 'phone', label: 'Mobile Number', type: 'tel' },
  { key: 'email', label: 'Mail ID', type: 'email' },
  { key: 'bloodGroup', label: 'Blood Group', type: 'blood' },
  { key: 'qualification', label: 'Qualification' },
  { key: 'joinedOn', label: 'Date of Joined', type: 'date' },
]

const FAMILY: FieldDef[] = [
  { key: 'fatherName', label: 'Name of Father' },
  { key: 'fatherOccupation', label: 'Occupation' },
  { key: 'motherName', label: 'Name of Mother' },
  { key: 'motherOccupation', label: 'Occupation' },
  { key: 'fatherMobile', label: 'Mobile Number of Father', type: 'tel' },
  { key: 'siblings', label: 'Siblings', type: 'textarea' },
]

/** "3 yrs 2 mos" between two ISO dates. */
function span(from: string, to: string): string {
  const months = Math.max(0, Math.floor(daysBetween(from, to) / 30.44))
  const years = Math.floor(months / 12)
  const rest = months % 12
  if (years === 0) return `${rest} mo${rest === 1 ? '' : 's'}`
  return rest ? `${years} yr${years === 1 ? '' : 's'} ${rest} mo${rest === 1 ? '' : 's'}` : `${years} yr${years === 1 ? '' : 's'}`
}

export function EmployeeDetail() {
  const { employeeId = '' } = useParams()
  const db = useDb()
  const { user } = useSession()
  const { can, canView: canOpen } = usePermissions()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('profile')
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const employee = db.employees.find((e) => e.id === employeeId)
  if (!employee) {
    return <Section><EmptyState title="Employee not found." /></Section>
  }

  // Personal and family details are sensitive: Employees-section roles, or the person themself.
  const isSelf = employee.id === user.id
  const canView = isSelf || canOpen('Employees')
  if (!canView) return <NoAccess />

  const canEditPersonal = isSelf || can('Employees', 'edit')
  const canEditOrg = can('Employees', 'edit')
  const filled = [...PERSONAL, ...FAMILY].filter((f) => employee[f.key]?.trim()).length
  const total = PERSONAL.length + FAMILY.length

  return (
    <div>
      <PageHeader
        title={employee.name}
        subtitle={<span className="flex flex-wrap items-center gap-2">{titleOf(employee)} <DepartmentBadge department={employee.department} /></span>}
        actions={<>
          {canEditOrg && (
            <button onClick={() => setEditing(true)} className="btn-secondary">
              <Icon name="edit" className="h-4 w-4" /> Edit
            </button>
          )}
          {can('Employees', 'delete') && !isSelf && employee.role !== 'super_admin' && (
            <button onClick={() => setDeleting(true)} className="btn-danger">
              <Icon name="trash" className="h-4 w-4" /> Delete
            </button>
          )}
        </>}
      />
      {editing && <EmployeeFormModal employee={employee} onClose={() => setEditing(false)} />}
      {deleting && (
        <ConfirmDialog
          title={`Delete ${employee.name}?`}
          onClose={() => setDeleting(false)}
          onConfirm={() => { api.employees.remove(employee.id); navigate('/employees') }}
          blocked={db.projects.some((p) => p.projectManagerId === employee.id)
            ? `${employee.name} manages ${db.projects.filter((p) => p.projectManagerId === employee.id).length} project(s). Reassign them to another manager first.`
            : undefined}
          message="This removes their login, profile and attendance. Their tasks stay on the projects without an assignee."
        />
      )}

      {/* Keyed by id so per-person state resets when moving between profiles. */}
      <ProfileHeader key={`h-${employee.id}`} employee={employee} canEdit={canEditPersonal} filled={filled} total={total} />

      <Tabs<Tab>
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'profile', label: 'Profile' },
          { key: 'works', label: 'Works' },
          { key: 'attendance', label: 'Attendance' },
          { key: 'role', label: 'Role in Company' },
        ]}
      />

      {tab === 'profile' && <ProfileDetails key={employee.id} employee={employee} canEdit={canEditPersonal} />}
      {tab === 'works' && <EmployeeWorks key={employee.id} employee={employee} />}
      {tab === 'attendance' && <EmployeeAttendance key={employee.id} employee={employee} canEdit={can('Employees', 'edit')} />}
      {tab === 'role' && <RoleInCompany key={employee.id} employee={employee} canEdit={canEditOrg} />}

      <Link to="/employees" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800">
        <Icon name="back" className="h-4 w-4" /> All employees
      </Link>
    </div>
  )
}

// ---------------------------------------------------------------- header

function ProfileHeader({
  employee, canEdit, filled, total,
}: { employee: Employee; canEdit: boolean; filled: number; total: number }) {
  const db = useDb()
  const inputRef = useRef<HTMLInputElement>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const manager = db.employees.find((e) => e.id === employee.reportsTo)

  const choosePhoto = async (file?: File) => {
    if (!file) return
    try {
      setPhotoError(null)
      api.employees.update(employee.id, { photo: await resizeImage(file) })
    } catch {
      setPhotoError('That file could not be read as an image.')
    }
  }

  return (
    <div className="card mb-6 flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
      <div className="flex flex-col items-center gap-2">
        <Avatar name={employee.name} size="xl" src={employee.photo} />
        {canEdit && (
          <>
            <input
              ref={inputRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { choosePhoto(e.target.files?.[0]); e.target.value = '' }}
            />
            <div className="flex gap-2 text-xs font-semibold">
              <button onClick={() => inputRef.current?.click()} className="text-brand-700 hover:text-brand-800">
                {employee.photo ? 'Change photo' : 'Add photo'}
              </button>
              {employee.photo && (
                <button onClick={() => api.employees.update(employee.id, { photo: undefined })} className="text-stone-400 hover:text-red-600">
                  Remove
                </button>
              )}
            </div>
            {photoError && <p className="text-xs text-red-600">{photoError}</p>}
          </>
        )}
      </div>
      <div className="grid flex-1 gap-4 sm:grid-cols-3">
        <div>
          <p className="label">Contact</p>
          <div className="mt-1 text-sm text-stone-800"><ContactNumbers phone={employee.phone} whatsapp={employee.whatsapp} /></div>
          <a href={`mailto:${employee.email}`} className="mt-0.5 block truncate text-sm text-stone-600 hover:text-brand-700">{employee.email}</a>
        </div>
        <div>
          <p className="label">Reports To</p>
          <p className="mt-1 text-sm text-stone-800">
            {manager ? <Link to={`/employees/${manager.id}`} className="hover:text-brand-700">{manager.name}</Link> : '—'}
          </p>
          {employee.joinedOn && (
            <p className="mt-0.5 text-xs text-stone-500">With Landschaft {span(employee.joinedOn, today())}</p>
          )}
        </div>
        <div>
          <p className="label">Profile</p>
          <p className="mt-1 text-sm text-stone-800">{filled} of {total} details recorded</p>
          <div className="mt-1.5 w-40"><ProgressBar value={(filled / total) * 100} size="sm" tone={filled === total ? 'green' : 'amber'} /></div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- profile

function displayValue(employee: Employee, def: FieldDef) {
  const value = employee[def.key]
  if (def.key === 'phone') return <ContactNumbers phone={employee.phone} whatsapp={employee.whatsapp} />
  if (!value?.trim()) return <span className="text-stone-400">Not recorded</span>
  if (def.key === 'dob') return <>{formatDateLong(value)} <span className="text-stone-400">· {span(value, today())}</span></>
  if (def.type === 'date') return formatDateLong(value)
  return <span className="whitespace-pre-line">{value}</span>
}

function ProfileDetails({ employee, canEdit }: { employee: Employee; canEdit: boolean }) {
  const [editing, setEditing] = useState(false)

  if (editing) return <ProfileForm employee={employee} onDone={() => setEditing(false)} />

  const block = (title: string, defs: FieldDef[], first?: boolean) => (
    <Section
      title={title}
      actions={first && canEdit && <button onClick={() => setEditing(true)} className="btn-secondary py-1.5">Edit details</button>}
    >
      <dl className="grid gap-x-8 gap-y-4 px-5 py-5 sm:grid-cols-2">
        {defs.map((def, i) => (
          <div key={`${def.key}-${i}`} className={def.type === 'textarea' ? 'sm:col-span-2' : ''}>
            <dt className="label">{def.label}</dt>
            <dd className="mt-1 text-sm font-medium text-stone-800">{displayValue(employee, def)}</dd>
          </div>
        ))}
      </dl>
    </Section>
  )

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {block('Personal Details', PERSONAL, true)}
      {block('Family Details', FAMILY)}
    </div>
  )
}

function ProfileForm({ employee, onDone }: { employee: Employee; onDone: () => void }) {
  const [draft, setDraft] = useState(() => {
    const values = {} as Record<FieldKey | 'whatsapp', string>
    for (const def of [...PERSONAL, ...FAMILY]) values[def.key] = employee[def.key] ?? ''
    values.whatsapp = employee.whatsapp ?? ''
    return values
  })
  const [error, setError] = useState<string | null>(null)
  const set = (key: FieldKey, value: string) => setDraft({ ...draft, [key]: value })

  const save = () => {
    if (!draft.name.trim()) return setError('Name is required.')
    if (!draft.phone.trim()) return setError('Mobile number is required.')
    const patch: Partial<Employee> = {}
    for (const [key, value] of Object.entries(draft)) {
      // Blank optional fields are cleared rather than stored as empty strings.
      ;(patch as Record<string, string | undefined>)[key] = value.trim() || undefined
    }
    patch.whatsapp = draft.whatsapp.trim() || draft.phone.trim()
    patch.email = draft.email.trim()
    api.employees.update(employee.id, patch)
    onDone()
  }

  const input = (def: FieldDef) => {
    const value = draft[def.key]
    if (def.type === 'textarea') {
      return <textarea rows={2} className="input" value={value} onChange={(e) => set(def.key, e.target.value)} />
    }
    if (def.type === 'blood') {
      return (
        <select className="input" value={value} onChange={(e) => set(def.key, e.target.value)}>
          <option value="">Select…</option>
          {BLOOD_GROUPS.map((g) => <option key={g}>{g}</option>)}
        </select>
      )
    }
    return (
      <input
        type={def.type ?? 'text'} className="input" value={value}
        onChange={(e) => set(def.key, e.target.value)}
      />
    )
  }

  const block = (title: string, defs: FieldDef[]) => (
    <Section title={title}>
      <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
        {defs.map((def, i) => def.key === 'phone' ? (
          <div key="phone" className="sm:col-span-2">
            <PhoneWhatsAppFields
              required
              phone={draft.phone}
              whatsapp={draft.whatsapp}
              onChange={({ phone, whatsapp }) => setDraft({ ...draft, phone, whatsapp })}
            />
          </div>
        ) : (
          <div key={`${def.key}-${i}`} className={def.type === 'textarea' ? 'sm:col-span-2' : ''}>
            <Field label={def.label} required={def.key === 'name'}>{input(def)}</Field>
          </div>
        ))}
      </div>
    </Section>
  )

  return (
    <div>
      <div className="grid gap-6 lg:grid-cols-2">
        {block('Personal Details', PERSONAL)}
        {block('Family Details', FAMILY)}
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        {error && <p className="mr-auto text-sm font-medium text-red-600">{error}</p>}
        <button onClick={onDone} className="btn-secondary">Cancel</button>
        <button onClick={save} className="btn-primary">Save details</button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- role in company

function RoleInCompany({ employee, canEdit }: { employee: Employee; canEdit: boolean }) {
  const db = useDb()
  const role = ROLES[employee.role]
  const reports = db.employees.filter((e) => e.reportsTo === employee.id)
  const [responsibilities, setResponsibilities] = useState<string[]>(employee.responsibilities?.length ? employee.responsibilities : [''])
  const [saved, setSaved] = useState(false)

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Section title="Position">
          <dl className="grid gap-x-8 gap-y-4 px-5 py-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="label">System Role</dt>
              <dd className="mt-1 text-sm font-semibold text-stone-900">{role.title}</dd>
              <dd className="mt-0.5 text-sm text-stone-600">{role.remit}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="label">Designation</dt>
              <dd className="mt-1">
                {canEdit ? (
                  <input
                    className="input" defaultValue={employee.designation ?? ''} placeholder={role.title}
                    onBlur={(e) => api.employees.update(employee.id, { designation: e.target.value.trim() || undefined })}
                    aria-label="Designation"
                  />
                ) : (
                  <span className="text-sm font-medium text-stone-800">{titleOf(employee)}</span>
                )}
                <span className="mt-1 block text-xs text-stone-400">
                  Shown on the profile and in lists instead of the role title — e.g. Co-Founder.
                </span>
              </dd>
            </div>
            <div>
              <dt className="label">Department</dt>
              <dd className="mt-1">
                {canEdit ? (
                  <select
                    className="input" value={employee.department}
                    onChange={(e) => api.employees.update(employee.id, { department: e.target.value as Department })}
                  >
                    {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
                  </select>
                ) : <DepartmentBadge department={employee.department} />}
              </dd>
            </div>
            <div>
              <dt className="label">Reports To</dt>
              <dd className="mt-1 text-sm text-stone-800">
                {canEdit ? (
                  <select
                    className="input" value={employee.reportsTo ?? ''}
                    onChange={(e) => api.employees.update(employee.id, { reportsTo: e.target.value || undefined })}
                  >
                    <option value="">No one</option>
                    {db.employees.filter((e) => e.id !== employee.id).map((e) => (
                      <option key={e.id} value={e.id}>{e.name} — {titleOf(e)}</option>
                    ))}
                  </select>
                ) : db.employees.find((e) => e.id === employee.reportsTo)?.name ?? '—'}
              </dd>
            </div>
          </dl>
        </Section>

        <Section
          title="Responsibilities in Company"
          description="Anything held beyond the system role — for example covering AMC as well as Execution."
        >
          <div className="px-5 py-5">
            {canEdit ? (
              <>
                <RepeaterList
                  values={responsibilities}
                  onChange={(next) => { setResponsibilities(next); setSaved(false) }}
                  addLabel="Add responsibility"
                  placeholder="e.g. AMC client relationships"
                />
                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={() => {
                      api.employees.update(employee.id, { responsibilities: responsibilities.map((r) => r.trim()).filter(Boolean) })
                      setSaved(true)
                    }}
                    className="btn-primary"
                  >
                    Save responsibilities
                  </button>
                  {saved && <span className="text-sm font-medium text-brand-700">Saved</span>}
                </div>
              </>
            ) : employee.responsibilities?.length ? (
              <ul className="list-disc space-y-1 pl-5 text-sm text-stone-700">
                {employee.responsibilities.map((r) => <li key={r}>{r}</li>)}
              </ul>
            ) : (
              <p className="text-sm text-stone-400">None recorded beyond the system role.</p>
            )}
          </div>
        </Section>
      </div>

      <div className="space-y-6">
        <Section title="Direct Reports" description={`${reports.length} ${reports.length === 1 ? 'person' : 'people'}`}>
          {reports.length === 0 ? (
            <EmptyState title="No direct reports." />
          ) : (
            <ul className="divide-y divide-stone-100">
              {reports.map((r) => (
                <li key={r.id}>
                  <Link to={`/employees/${r.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-stone-50">
                    <Avatar name={r.name} size="sm" src={r.photo} />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-stone-800">{r.name}</span>
                      <span className="block truncate text-xs text-stone-500">{titleOf(r)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

      </div>
    </div>
  )
}
