import { useState } from 'react'
import { useDb } from '../../state/useDb'
import { LOCKED_ROLES, NAV, ROLES, defaultPermissions } from '../../domain/roles'
import {
  MODULES, PERMISSION_ACTIONS, type ModuleKey, type ModulePermission, type PermissionAction,
  type PermissionMatrix, type RoleKey,
} from '../../domain/types'
import { Badge } from '../../components/ui'
import { Icon } from '../../components/Icon'

const ACTION_LABEL: Record<PermissionAction, string> = { view: 'View', create: 'Create', edit: 'Edit', delete: 'Delete' }

/** What each action means for modules that have nothing to create or delete. */
const VIEW_ONLY: ModuleKey[] = ['Dashboard', 'Reports']

const EDITABLE_ROLES = (Object.keys(ROLES) as RoleKey[]).filter((r) => !LOCKED_ROLES.includes(r))

/**
 * Settings → Roles & Permissions. Pick a role, then tick what it may do in
 * each module. View decides whether the module appears in the sidebar at all;
 * Create, Edit and Delete decide which buttons appear inside it.
 */
export function PermissionMatrixEditor({
  value, onChange, disabled,
}: { value: PermissionMatrix; onChange: (next: PermissionMatrix) => void; disabled?: boolean }) {
  const db = useDb()
  const [role, setRole] = useState<RoleKey>('design_director')
  const rows = value[role]

  // The CEO can never lock themselves out of Settings.
  const locked = (module: ModuleKey) => role === 'ceo' && module === 'Settings'

  const setCell = (module: ModuleKey, action: PermissionAction, on: boolean) => {
    const current = rows[module]
    let next: ModulePermission = { ...current, [action]: on }
    // Any action needs the module to be visible; hiding it clears everything else.
    if (action === 'view' && !on) next = { view: false, create: false, edit: false, delete: false }
    if (action !== 'view' && on) next.view = true
    onChange({ ...value, [role]: { ...rows, [module]: next } })
  }

  const setRow = (module: ModuleKey, on: boolean) => {
    const next = { view: on, create: on, edit: on, delete: on }
    onChange({ ...value, [role]: { ...rows, [module]: next } })
  }

  const setColumn = (action: PermissionAction, on: boolean) => {
    const updated = { ...rows }
    for (const m of MODULES) {
      if (locked(m)) continue
      const cur = updated[m]
      updated[m] = action === 'view'
        ? (on ? { ...cur, view: true } : { view: false, create: false, edit: false, delete: false })
        : { ...cur, [action]: on, view: on ? true : cur.view }
    }
    onChange({ ...value, [role]: updated })
  }

  const visibleCount = (r: RoleKey) => MODULES.filter((m) => value[r][m].view).length
  const people = (r: RoleKey) => db.employees.filter((e) => e.role === r)
  const icon = (m: ModuleKey) => NAV.find((n) => n.label === m)?.icon ?? 'grid'

  return (
    <div>
      {/* Role picker */}
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto border-b border-stone-100 px-5 pb-4">
        {EDITABLE_ROLES.map((r) => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className={`shrink-0 rounded-xl border px-3 py-2 text-left transition ${
              role === r ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-500/20' : 'border-stone-200 bg-white hover:border-stone-300'
            }`}
          >
            <span className={`block text-sm font-semibold ${role === r ? 'text-brand-800' : 'text-stone-800'}`}>{ROLES[r].title}</span>
            <span className="block text-[11px] text-stone-500">
              {visibleCount(r)} modules · {people(r).length} {people(r).length === 1 ? 'person' : 'people'}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3 py-4">
        <div className="min-w-0">
          <p className="font-semibold text-stone-900">{ROLES[role].title}</p>
          <p className="text-sm text-stone-500">{ROLES[role].remit}</p>
          {people(role).length > 0 && (
            <p className="mt-1 text-xs text-stone-400">Applies to {people(role).map((p) => p.name).join(', ')}</p>
          )}
        </div>
        {!disabled && (
          <button
            onClick={() => onChange({ ...value, [role]: defaultPermissions()[role] })}
            className="btn-secondary shrink-0 py-1.5 text-xs"
          >
            <Icon name="history" className="h-3.5 w-3.5" /> Reset to default
          </button>
        )}
      </div>

      <div className="scroll-x -mx-5">
        <table className="w-full min-w-[560px]">
          <thead className="bg-stone-50/80">
            <tr>
              <th className="th pl-5">Module</th>
              {PERMISSION_ACTIONS.map((a) => {
                const all = MODULES.filter((m) => !VIEW_ONLY.includes(m) || a === 'view').every((m) => rows[m][a])
                return (
                  <th key={a} className="th text-center">
                    <label className="inline-flex cursor-pointer flex-col items-center gap-1">
                      {ACTION_LABEL[a]}
                      <input
                        type="checkbox" checked={all} disabled={disabled}
                        onChange={(e) => setColumn(a, e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-stone-300 accent-brand-600"
                        aria-label={`${ACTION_LABEL[a]} in every module`}
                      />
                    </label>
                  </th>
                )
              })}
              <th className="th pr-5 text-center">All</th>
            </tr>
          </thead>
          <tbody>
            {MODULES.map((m) => {
              const p = rows[m]
              const full = PERMISSION_ACTIONS.every((a) => p[a])
              const isLocked = locked(m)
              return (
                <tr key={m} className={`row-hover ${p.view ? '' : 'opacity-60'}`}>
                  <td className="td pl-5">
                    <span className="flex items-center gap-2.5 font-medium text-stone-800">
                      <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${p.view ? 'bg-brand-50 text-brand-700' : 'bg-stone-100 text-stone-400'}`}>
                        <Icon name={icon(m)} className="h-4 w-4" />
                      </span>
                      {m}
                      {isLocked && <Badge tone="stone">always on</Badge>}
                    </span>
                  </td>
                  {PERMISSION_ACTIONS.map((a) => {
                    const na = VIEW_ONLY.includes(m) && a !== 'view'
                    return (
                      <td key={a} className="td text-center">
                        {na ? <span className="text-xs text-stone-300">—</span> : (
                          <input
                            type="checkbox"
                            checked={p[a]}
                            disabled={disabled || isLocked}
                            onChange={(e) => setCell(m, a, e.target.checked)}
                            className="h-[18px] w-[18px] cursor-pointer rounded border-stone-300 accent-brand-600 disabled:cursor-not-allowed"
                            aria-label={`${ROLES[role].title}: ${ACTION_LABEL[a]} ${m}`}
                          />
                        )}
                      </td>
                    )
                  })}
                  <td className="td pr-5 text-center">
                    <button
                      type="button"
                      disabled={disabled || isLocked}
                      onClick={() => setRow(m, !full)}
                      className={`rounded-lg px-2 py-1 text-xs font-semibold transition disabled:opacity-40 ${full ? 'bg-brand-100 text-brand-800' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}
                    >
                      {full ? 'Full' : 'Grant all'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid gap-3 text-xs text-stone-500 sm:grid-cols-2">
        <p className="flex items-start gap-2 rounded-xl bg-stone-50 p-3">
          <Icon name="shield" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          <span><strong className="text-stone-700">Super Admin</strong> always has full access and cannot be changed.</span>
        </p>
        <p className="flex items-start gap-2 rounded-xl bg-stone-50 p-3">
          <Icon name="hardhat" className="mt-0.5 h-4 w-4 shrink-0 text-clay-600" />
          <span><strong className="text-stone-700">Foremen</strong> use the field app only — My Sites and the Daily Work Report — and never see the CRM.</span>
        </p>
      </div>
    </div>
  )
}
