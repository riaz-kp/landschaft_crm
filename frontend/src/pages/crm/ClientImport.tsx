import { useRef, useState } from 'react'
import { readSheet } from 'read-excel-file/browser'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { Badge, Checkbox, Modal } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { exportWorkbook, sheet } from '../../components/excel'

type Field = 'name' | 'phone' | 'whatsapp' | 'email' | 'address'

/** Column titles we recognise for each field — clients' own spreadsheets rarely match a template exactly. */
const ALIASES: Record<Field, string[]> = {
  name: ['name', 'client', 'client name', 'customer', 'customer name', 'company'],
  phone: ['phone', 'phone number', 'mobile', 'mobile number', 'contact', 'contact number', 'ph', 'tel'],
  whatsapp: ['whatsapp', 'whatsapp number', 'wa', 'whats app'],
  email: ['email', 'e-mail', 'mail', 'mail id', 'email id'],
  address: ['address', 'location', 'place', 'city', 'site', 'area'],
}

interface ParsedRow {
  line: number
  name: string
  phone: string
  whatsapp: string
  email: string
  address: string
  problem?: string
  duplicate?: string
}

const digits = (s: string) => s.replace(/\D/g, '').slice(-10)

/** Turns any cell into text; phone numbers typed as numbers lose nothing. */
function text(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(value)
  return String(value).trim()
}

/** A small CSV reader that copes with quoted commas, for files saved as .csv. */
function parseCsv(source: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i]
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') { cell += '"'; i += 1 }
      else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i += 1
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += ch
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows.filter((r) => r.some((c) => c.trim()))
}

export async function downloadClientTemplate(): Promise<void> {
  await exportWorkbook('Landschaft client import template', [
    sheet({
      name: 'Clients',
      rows: [
        { name: 'Sample Villas Association', phone: '+91 94470 00000', whatsapp: '+91 94470 00000', email: 'office@samplevillas.in', address: 'Kakkanad, Kochi' },
      ],
      columns: [
        { header: 'Name', value: (r) => r.name, width: 30 },
        { header: 'Phone', value: (r) => r.phone, width: 18 },
        { header: 'WhatsApp', value: (r) => r.whatsapp, width: 18 },
        { header: 'Email', value: (r) => r.email, width: 28 },
        { header: 'Address', value: (r) => r.address, width: 36 },
      ],
    }),
  ])
}

/**
 * Bring clients in from a spreadsheet. Columns are matched by their titles
 * (Name, Phone, WhatsApp, Email, Address — and common variants), every row is
 * checked before anything is saved, and numbers already on file are flagged
 * as duplicates.
 */
export function ClientImportModal({ onClose }: { onClose: () => void }) {
  const db = useDb()
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<ParsedRow[] | null>(null)
  const [missing, setMissing] = useState<Field[]>([])
  const [error, setError] = useState<string | null>(null)
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [done, setDone] = useState<number | null>(null)

  const read = async (file?: File) => {
    if (!file) return
    setError(null)
    setDone(null)
    setFileName(file.name)
    try {
      const table: unknown[][] = file.name.toLowerCase().endsWith('.csv')
        ? parseCsv(await file.text())
        : (await readSheet(file)) as unknown[][]
      if (table.length < 2) throw new Error('The sheet has no rows under the header.')

      const header = table[0].map((h) => text(h).toLowerCase().replace(/[*:]/g, '').trim())
      const column = {} as Record<Field, number>
      for (const field of Object.keys(ALIASES) as Field[]) column[field] = header.findIndex((h) => ALIASES[field].includes(h))
      setMissing((['name', 'phone', 'address'] as Field[]).filter((f) => column[f] < 0))

      const known = new Map<string, string>()
      for (const c of db.clients) {
        if (digits(c.phone)) known.set(digits(c.phone), c.name)
        if (digits(c.whatsapp)) known.set(digits(c.whatsapp), c.name)
      }
      const seen = new Map<string, number>()
      const parsed = table.slice(1).map((r, i): ParsedRow => {
        const get = (f: Field) => (column[f] >= 0 ? text(r[column[f]]) : '')
        const row: ParsedRow = { line: i + 2, name: get('name'), phone: get('phone'), whatsapp: get('whatsapp'), email: get('email'), address: get('address') }
        if (!row.name) row.problem = 'Name missing'
        else if (!row.phone) row.problem = 'Phone missing'
        else if (!row.address) row.problem = 'Address missing'
        else if (row.email && !/^\S+@\S+\.\S+$/.test(row.email)) row.problem = 'Email looks wrong'
        const key = digits(row.phone)
        if (!row.problem && key) {
          if (known.has(key)) row.duplicate = `Already a client: ${known.get(key)}`
          else if (seen.has(key)) row.duplicate = `Same phone as row ${seen.get(key)}`
          else seen.set(key, row.line)
        }
        return row
      }).filter((r) => r.name || r.phone || r.address)
      setRows(parsed)
    } catch (e) {
      setRows(null)
      setError(e instanceof Error && e.message ? `Could not read that file — ${e.message}` : 'Could not read that file. Save it as .xlsx or .csv and try again.')
    }
  }

  const importable = (rows ?? []).filter((r) => !r.problem && (!r.duplicate || !skipDuplicates))
  const problems = (rows ?? []).filter((r) => r.problem).length
  const duplicates = (rows ?? []).filter((r) => r.duplicate).length

  const save = () => {
    for (const r of importable) {
      api.clients.create({
        name: r.name, phone: r.phone, whatsapp: r.whatsapp || r.phone,
        email: r.email || undefined, address: r.address,
      })
    }
    setDone(importable.length)
    setRows(null)
    setFileName('')
  }

  return (
    <Modal
      title="Import clients from Excel"
      size="xl"
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className="btn-secondary">{done !== null ? 'Close' : 'Cancel'}</button>
        {rows && (
          <button onClick={save} disabled={importable.length === 0 || missing.length > 0} className="btn-primary">
            Import {importable.length} client{importable.length === 1 ? '' : 's'}
          </button>
        )}
      </>}
    >
      <div className="space-y-5">
        {done !== null && (
          <p className="flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-3 text-sm font-medium text-brand-900">
            <Icon name="check" className="h-5 w-5 text-brand-600" /> {done} client{done === 1 ? '' : 's'} imported. They are on the Clients list now.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-stone-200 p-4">
            <p className="text-sm font-semibold text-stone-900">1. Use the template — or your own sheet</p>
            <p className="mt-1 text-xs text-stone-500">
              Columns: <strong>Name</strong>, <strong>Phone</strong>, WhatsApp, Email, <strong>Address</strong>. Bold ones are required.
              Titles like “Mobile”, “Customer” or “Location” are recognised too.
            </p>
            <button onClick={downloadClientTemplate} className="btn-secondary mt-3 py-1.5 text-xs">
              <Icon name="upload" className="h-3.5 w-3.5 rotate-180" /> Download template (.xlsx)
            </button>
          </div>
          <div className="rounded-xl border-2 border-dashed border-stone-300 p-4">
            <p className="text-sm font-semibold text-stone-900">2. Choose the file</p>
            <p className="mt-1 text-xs text-stone-500">Excel (.xlsx) or .csv. The first sheet is read; the first row must be the column titles.</p>
            <input ref={fileRef} type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" className="hidden" onChange={(e) => { read(e.target.files?.[0]); e.target.value = '' }} />
            <button onClick={() => fileRef.current?.click()} className="btn-primary mt-3 py-1.5 text-xs">
              <Icon name="upload" className="h-3.5 w-3.5" /> Choose file
            </button>
            {fileName && <p className="mt-2 truncate text-xs text-stone-500">{fileName}</p>}
          </div>
        </div>

        {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
        {missing.length > 0 && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
            The sheet has no column for: <strong>{missing.join(', ')}</strong>. Rename the column titles to match the template.
          </p>
        )}

        {rows && (
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <p className="text-sm font-semibold text-stone-900">3. Check the rows</p>
              <Badge tone="green">{rows.length - problems - duplicates} ready</Badge>
              {duplicates > 0 && <Badge tone="amber">{duplicates} duplicate{duplicates === 1 ? '' : 's'}</Badge>}
              {problems > 0 && <Badge tone="red">{problems} with problems — skipped</Badge>}
              {duplicates > 0 && (
                <span className="ml-auto"><Checkbox checked={skipDuplicates} onChange={setSkipDuplicates} label="Skip duplicates" /></span>
              )}
            </div>
            <div className="max-h-[340px] overflow-auto rounded-xl border border-stone-200">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="sticky top-0 bg-stone-50">
                  <tr>{['Row', 'Name', 'Phone', 'WhatsApp', 'Email', 'Address', 'Check'].map((h) => <th key={h} className="th">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.line} className={`border-t border-stone-100 ${r.problem ? 'bg-red-50/50' : r.duplicate ? 'bg-amber-50/50' : ''}`}>
                      <td className="td tabular-nums text-stone-400">{r.line}</td>
                      <td className="td font-medium text-stone-900">{r.name || '—'}</td>
                      <td className="td tabular-nums">{r.phone || '—'}</td>
                      <td className="td tabular-nums">{r.whatsapp || <span className="text-stone-400">same as phone</span>}</td>
                      <td className="td">{r.email || '—'}</td>
                      <td className="td">{r.address || '—'}</td>
                      <td className="td">
                        {r.problem ? <Badge tone="red">{r.problem}</Badge>
                          : r.duplicate ? <Badge tone="amber">{r.duplicate}</Badge>
                          : <Badge tone="green">Ready</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
