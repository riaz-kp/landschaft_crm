import type { Employee, ID } from '../domain/types'
import { titleOf } from '../domain/roles'
import { Avatar } from './ui'
import { Icon } from './Icon'
import { SearchSelect } from './SearchSelect'
import { employeeOptions } from './pickerOptions'

/**
 * Picks several employees: the chosen ones sit as removable chips, and a
 * searchable dropdown underneath adds another.
 */
export function PeoplePicker({
  value, onChange, people, exclude = [], placeholder = 'Add a person…', title = 'Add a person',
}: {
  value: ID[]
  onChange: (next: ID[]) => void
  people: Employee[]
  /** People who cannot be added, e.g. whoever is already leading. */
  exclude?: ID[]
  placeholder?: string
  title?: string
}) {
  const chosen = value.map((id) => people.find((e) => e.id === id)).filter((e): e is Employee => Boolean(e))
  const addable = people.filter((e) => !value.includes(e.id) && !exclude.includes(e.id))

  return (
    <div className="space-y-2">
      {chosen.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {chosen.map((e) => (
            <li key={e.id} className="flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 py-1 pl-1 pr-1.5">
              <Avatar name={e.name} size="sm" src={e.photo} />
              <span className="min-w-0 leading-tight">
                <span className="block text-sm font-medium text-stone-800">{e.name}</span>
                <span className="block max-w-[10rem] truncate text-[10px] text-stone-500">{titleOf(e)}</span>
              </span>
              <button
                type="button"
                onClick={() => onChange(value.filter((id) => id !== e.id))}
                className="btn-icon h-6 w-6 rounded-full hover:bg-red-50 hover:text-red-600"
                aria-label={`Remove ${e.name}`}
              >
                <Icon name="x" className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {addable.length > 0 && (
        <SearchSelect
          value=""
          onChange={(id) => id && onChange([...value, id])}
          options={employeeOptions(addable)}
          placeholder={placeholder}
          searchPlaceholder="Search people"
          title={title}
        />
      )}
    </div>
  )
}
