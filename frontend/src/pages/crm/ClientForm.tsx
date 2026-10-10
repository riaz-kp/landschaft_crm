import { useState } from 'react'
import { api } from '../../api/client'
import type { Client } from '../../domain/types'
import { Field, Modal } from '../../components/ui'
import { PhoneWhatsAppFields } from '../../components/ContactFields'

/** Create a client, or edit one when `client` is passed. */
export function ClientFormModal({
  client, defaults, onClose, onSaved,
}: { client?: Client; defaults?: Partial<Client>; onClose: () => void; onSaved?: (client: Client) => void }) {
  const [form, setForm] = useState({
    name: client?.name ?? defaults?.name ?? '',
    phone: client?.phone ?? '',
    whatsapp: client?.whatsapp ?? '',
    email: client?.email ?? '',
    address: client?.address ?? '',
  })
  const [error, setError] = useState<string | null>(null)

  const save = () => {
    if (!form.name.trim()) return setError('Enter the client name.')
    if (!form.phone.trim()) return setError('Enter a phone number.')
    if (!form.address.trim()) return setError('Enter the address.')
    const values = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      // An empty WhatsApp means the box was unticked and left blank — fall back to the phone.
      whatsapp: form.whatsapp.trim() || form.phone.trim(),
      email: form.email.trim() || undefined,
      address: form.address.trim(),
    }
    if (client) {
      api.clients.update(client.id, values)
      onSaved?.({ ...client, ...values })
    } else {
      onSaved?.(api.clients.create(values))
    }
    onClose()
  }

  return (
    <Modal
      title={client ? 'Edit client' : 'New client'}
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={save} className="btn-primary">{client ? 'Save changes' : 'Create client'}</button>
      </>}
    >
      <div className="space-y-4">
        <Field label="Client name" required>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <PhoneWhatsAppFields
          required
          phone={form.phone}
          whatsapp={form.whatsapp}
          onChange={(numbers) => setForm({ ...form, ...numbers })}
        />
        <Field label="Email">
          <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Address" required>
          <textarea rows={2} className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </Field>
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      </div>
    </Modal>
  )
}
