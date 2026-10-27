import { useDb } from '../../state/useDb'
import { amcTeamPool } from '../../domain/amc'
import type { ID } from '../../domain/types'
import { Checkbox } from '../../components/ui'

/**
 * Ticks for an AMC team: the AMC department's staff first, then the active
 * site workers. With nobody to pick it says where people come from, rather
 * than leaving the required team empty with no way to fill it.
 */
export function AmcTeamPicker({ value, onChange, className = '' }: {
  value: ID[]
  onChange: (ids: ID[]) => void
  /** Extra classes, such as spacing or more columns on wider screens. */
  className?: string
}) {
  const db = useDb()
  const pool = amcTeamPool(db.employees, db.workers)

  if (pool.length === 0) {
    return (
      <p className={`text-sm text-amber-700 ${className}`}>
        Nobody to pick yet. Put staff in the AMC department from their profile’s Role in Company,
        or add site workers under Employees → Execution Workers.
      </p>
    )
  }

  return (
    <div className={`grid grid-cols-2 gap-2 ${className}`}>
      {pool.map((person) => (
        <Checkbox
          key={person.id}
          checked={value.includes(person.id)}
          onChange={(on) => onChange(on ? [...value, person.id] : value.filter((id) => id !== person.id))}
          label={<>{person.name} <span className="text-xs text-stone-400">{person.title}</span></>}
        />
      ))}
    </div>
  )
}
