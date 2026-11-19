import { useEffect, useState } from 'react'
import { useDb } from '../../state/useDb'
import { Field } from '../../components/ui'
import type { Quotation } from '../../domain/types'

/**
 * The document's serial number (SC-LND26100-01, QT-…, BQ-…). Given on
 * creation and changeable here; saved when the field is left or Enter is
 * pressed. Two documents may not share a number.
 */
export function DocNumberField({
  quote, disabled, onSave,
}: { quote: Quotation; disabled?: boolean; onSave: (number: string) => void }) {
  const db = useDb()
  const [text, setText] = useState(quote.number)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { setText(quote.number) }, [quote.number])

  const commit = () => {
    const next = text.trim().replace(/\s+/g, ' ')
    if (next === quote.number) return setError(null)
    if (!next) {
      setText(quote.number)
      return setError('A document needs a serial number — kept the old one.')
    }
    const taken = db.quotations.find((q) => q.id !== quote.id && q.number.toLowerCase() === next.toLowerCase())
    if (taken) return setError(`${taken.number} is already used by another ${taken.kind === 'BOQ' ? 'BOQ' : taken.kind === 'Scope' ? 'scope proposal' : 'quotation'}.`)
    setError(null)
    setText(next)
    onSave(next)
  }

  return (
    <Field label="Serial No." hint={error ? undefined : 'Printed on the document.'}>
      <input
        className={`input font-mono tracking-wide ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : ''}`}
        value={text}
        disabled={disabled}
        onChange={(e) => { setText(e.target.value); setError(null) }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit() }
          if (e.key === 'Escape') { setText(quote.number); setError(null) }
        }}
        aria-invalid={Boolean(error)}
        aria-label="Serial number"
      />
      {error && <span className="mt-1 block text-xs font-medium text-red-700">{error}</span>}
    </Field>
  )
}
