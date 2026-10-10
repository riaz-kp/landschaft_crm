import { useState } from 'react'
import { whatsappUrl } from '../domain/format'
import { Checkbox, Field } from './ui'
import { Icon } from './Icon'

/**
 * Phone and WhatsApp are kept as separate numbers. Ticking "same as phone"
 * mirrors the phone into WhatsApp and keeps it in step while ticked.
 */
export function PhoneWhatsAppFields({
  phone, whatsapp, onChange, required,
}: {
  phone: string
  whatsapp: string
  onChange: (next: { phone: string; whatsapp: string }) => void
  required?: boolean
}) {
  const [same, setSame] = useState(() => !whatsapp || whatsapp === phone)

  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone Number" required={required}>
          <input
            type="tel" className="input" value={phone} placeholder="+91 98470 00000"
            onChange={(e) => onChange({ phone: e.target.value, whatsapp: same ? e.target.value : whatsapp })}
          />
        </Field>
        <Field label="WhatsApp Number">
          <input
            type="tel" className="input" value={same ? phone : whatsapp} disabled={same}
            placeholder="+91 98470 00000"
            onChange={(e) => onChange({ phone, whatsapp: e.target.value })}
          />
        </Field>
      </div>
      <Checkbox
        checked={same}
        onChange={(checked) => {
          setSame(checked)
          onChange({ phone, whatsapp: checked ? phone : whatsapp === phone ? '' : whatsapp })
        }}
        label="WhatsApp number is the same as the phone number"
      />
    </div>
  )
}

/** Read-only phone + WhatsApp, collapsing to one line when they match. */
export function ContactNumbers({ phone, whatsapp }: { phone: string; whatsapp?: string }) {
  const wa = whatsapp || phone
  return (
    <span className="block space-y-0.5">
      <a href={`tel:${phone.replace(/\s/g, '')}`} className="flex flex-wrap items-center gap-x-1.5 hover:text-brand-700">
        <Icon name="phone" className="h-3.5 w-3.5 text-stone-400" />
        <span className="whitespace-nowrap tabular-nums">{phone || '—'}</span>
        {wa === phone && phone && <span className="whitespace-nowrap text-xs text-stone-400">· WhatsApp</span>}
      </a>
      {wa !== phone && wa && (
        <a href={whatsappUrl(wa)} target="_blank" rel="noreferrer" className="flex flex-wrap items-center gap-x-1.5 hover:text-brand-700">
          <Icon name="chat" className="h-3.5 w-3.5 text-brand-600" />
          <span className="whitespace-nowrap tabular-nums">{wa}</span>
          <span className="whitespace-nowrap text-xs text-stone-400">· WhatsApp</span>
        </a>
      )}
    </span>
  )
}
