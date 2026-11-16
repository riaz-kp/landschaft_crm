import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { usePermissions } from '../../state/permissions'
import { formatCurrency, formatDate, today } from '../../domain/format'
import { materialKey, materialRows, type MaterialRow } from '../../domain/materials'
import type { ID } from '../../domain/types'
import {
  Badge, ConfirmDialog, EmptyState, Field, FormError, Modal, PageHeader, Pills, SearchInput, Section, StatTile, Table,
} from '../../components/ui'
import { SearchSelect } from '../../components/SearchSelect'
import { projectOptions } from '../../components/pickerOptions'
import { Icon } from '../../components/Icon'
import { viewPath } from '../quotations/access'
import { StoredImg } from '../../components/StoredImage'
import { compressImage } from '../../components/imageResize'
import { storePhoto } from '../../data/files'

type SourceFilter = 'all' | 'documents' | 'library'
type MaterialView = 'table' | 'cards'

/** Units the BOQs use most, offered as suggestions. Any other can be typed. */
const UNITS = ['Sqft', 'Rft', 'Nos', 'Cft', 'Cum', 'Sqm', 'Kg', 'Ltr', 'Bag', 'Lump sum']

const VIEW_KEY = 'landschaft-materials-view'
const VIEWS: { key: MaterialView; label: string; icon: string }[] = [
  { key: 'table', label: 'Table', icon: 'list' },
  { key: 'cards', label: 'Cards', icon: 'grid' },
]

/** The table or card choice, remembered between visits in this browser. */
function useMaterialView(): [MaterialView, (v: MaterialView) => void] {
  const [view, setViewState] = useState<MaterialView>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === 'cards' ? 'cards' : 'table'
    } catch {
      return 'table'
    }
  })
  const setView = (v: MaterialView) => {
    setViewState(v)
    try { localStorage.setItem(VIEW_KEY, v) } catch { /* private mode */ }
  }
  return [view, setView]
}

/**
 * The company's materials: every stone and item used on a BOQ or quotation,
 * gathered automatically with the projects it is used on, and materials added
 * here by hand with the projects they are included in. Shown as a table or as
 * picture cards.
 */
export function Materials() {
  const db = useDb()
  const { can } = usePermissions()
  const [query, setQuery] = useState('')
  const [projectId, setProjectId] = useState('')
  const [source, setSource] = useState<SourceFilter>('all')
  const [open, setOpen] = useState<MaterialRow | 'new' | null>(null)
  const [view, setView] = useMaterialView()

  const rows = useMemo(() => materialRows(db.materials, db.quotations), [db.materials, db.quotations])
  const q = query.trim().toLowerCase()
  const inSource = (row: MaterialRow, s: SourceFilter) => s === 'all' || (s === 'documents' ? row.uses.length > 0 : Boolean(row.record))
  const shown = rows.filter((row) =>
    inSource(row, source)
    && (!projectId || row.projectIds.includes(projectId))
    && (!q || [row.name, row.dimension, row.specification, row.unit].some((v) => v?.toLowerCase().includes(q))))

  const projectsUsed = new Set(rows.flatMap((r) => r.projectIds)).size

  return (
    <div>
      <PageHeader
        title="Materials"
        subtitle="Every stone and item used on a BOQ or quotation, with the projects it is used on — and materials added here by hand."
        actions={can('Materials', 'create') && (
          <button onClick={() => setOpen('new')} className="btn-primary"><Icon name="plus" className="h-4 w-4" /> Add material</button>
        )}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatTile label="Materials" value={rows.length} tone="green" icon="box" />
        <StatTile label="On BOQs & Quotations" value={rows.filter((r) => r.uses.length).length} tone="blue" icon="doc" />
        <StatTile label="Projects Using Them" value={projectsUsed} tone="amber" icon="folder" />
      </div>

      {/* Stacked until wide screens: the source pills and the filters do not fit one row before that. */}
      <div className="mb-4 flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <Pills<SourceFilter>
          active={source}
          onChange={setSource}
          options={[
            { key: 'all', label: 'All', count: rows.length },
            { key: 'documents', label: 'From BOQs & quotations', count: rows.filter((r) => inSource(r, 'documents')).length },
            { key: 'library', label: 'Added here', count: rows.filter((r) => inSource(r, 'library')).length },
          ]}
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <SearchSelect
            value={projectId} onChange={setProjectId} options={projectOptions(db)}
            emptyOption="All projects" placeholder="All projects" searchPlaceholder="Search projects" title="Project"
            ariaLabel="Filter by project" className="sm:w-60"
          />
          <div className="flex items-center gap-2">
            <SearchInput value={query} onChange={setQuery} placeholder="Search material, size, specification…" className="min-w-0 flex-1 sm:w-72 sm:flex-none" />
            <ViewSwitch view={view} setView={setView} />
          </div>
        </div>
      </div>

      {shown.length === 0 ? (
        <Section>
          <EmptyState
            icon="box"
            title={rows.length ? 'Nothing matches.' : 'No materials yet.'}
            hint={rows.length ? undefined : 'Materials appear here as they are added to BOQs and quotations, or add one by hand.'}
          />
        </Section>
      ) : view === 'cards' ? (
        <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {shown.map((row) => <MaterialCard key={row.key} row={row} onOpen={() => setOpen(row)} />)}
        </div>
      ) : (
        <Section>
          <Table head={['Image', 'Material', 'Size', 'Unit', 'Rate', 'Projects', 'Found on']}>
            {shown.map((row) => (
              <tr key={row.key} className="row-hover cursor-pointer" onClick={() => setOpen(row)}>
                <td className="td w-16"><Thumb row={row} className="h-12 w-12 rounded-lg" /></td>
                <td className="td">
                  <button type="button" className="text-left font-medium text-stone-900 hover:text-brand-700">{row.name}</button>
                  {row.specification && <span className="block max-w-xs truncate text-xs text-stone-400">{row.specification.split('\n')[0]}</span>}
                </td>
                <td className="td whitespace-nowrap">{row.dimension ?? <span className="text-stone-300">—</span>}</td>
                <td className="td whitespace-nowrap">{row.unit || <span className="text-stone-300">—</span>}</td>
                <td className="td whitespace-nowrap tabular-nums"><RateText row={row} /></td>
                <td className="td"><ProjectLinks row={row} /></td>
                <td className="td"><FoundOn row={row} /></td>
              </tr>
            ))}
          </Table>
        </Section>
      )}

      {open && <MaterialModal row={open === 'new' ? undefined : open} onClose={() => setOpen(null)} />}
    </div>
  )
}

function ViewSwitch({ view, setView }: { view: MaterialView; setView: (v: MaterialView) => void }) {
  return (
    <div className="flex shrink-0 gap-1 rounded-xl bg-stone-100 p-1" role="group" aria-label="View">
      {VIEWS.map((v) => (
        <button
          key={v.key} type="button" onClick={() => setView(v.key)} aria-pressed={view === v.key} title={`${v.label} view`}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition sm:text-sm ${
            view === v.key ? 'bg-white text-brand-800 shadow-sm' : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <Icon name={v.icon} className="h-4 w-4" /> <span className="hidden sm:inline">{v.label}</span>
        </button>
      ))}
    </div>
  )
}

/** The material's photo, or a placeholder when it has none. */
function Thumb({ row, className }: { row: MaterialRow; className: string }) {
  return row.image
    ? <StoredImg src={row.image} alt={row.name} className={`${className} bg-stone-100 object-cover`} />
    : (
      <span className={`${className} flex items-center justify-center bg-stone-100 text-stone-300`} aria-hidden="true">
        <Icon name="image" className="h-5 w-5" />
      </span>
    )
}

function RateText({ row }: { row: MaterialRow }) {
  if (!row.rate) return <span className="text-stone-300">—</span>
  return (
    <>
      {formatCurrency(row.rate)}
      <span className="block text-xs font-normal text-stone-400">{row.rateFrom === 'library' ? 'library rate' : `last quoted · ${row.rateFrom?.number}`}</span>
    </>
  )
}

function ProjectLinks({ row, max = 3 }: { row: MaterialRow; max?: number }) {
  const db = useDb()
  if (row.projectIds.length === 0) return <span className="text-sm text-stone-400">No project yet</span>
  return (
    <span className="flex flex-wrap gap-x-2 gap-y-0.5 text-sm">
      {row.projectIds.slice(0, max).map((id) => (
        <Link key={id} to={`/projects/${id}`} onClick={(e) => e.stopPropagation()} className="text-brand-700 hover:text-brand-800">
          {db.projects.find((p) => p.id === id)?.name ?? 'Deleted project'}
        </Link>
      ))}
      {row.projectIds.length > max && <span className="text-stone-400">+{row.projectIds.length - max} more</span>}
    </span>
  )
}

function FoundOn({ row }: { row: MaterialRow }) {
  const docs = [...new Map(row.uses.map((u) => [u.quote.id, u.quote])).values()]
  return (
    <span className="flex flex-wrap gap-1">
      {docs.slice(0, 2).map((quote) => (
        <Badge key={quote.id} tone={quote.kind === 'BOQ' ? 'blue' : 'green'}>{quote.number}</Badge>
      ))}
      {docs.length > 2 && <Badge tone="stone">+{docs.length - 2}</Badge>}
      {row.record && <Badge tone="clay">Added here</Badge>}
    </span>
  )
}

/** A material as a picture card: the photo, then its size, rate and where it is used. */
function MaterialCard({ row, onOpen }: { row: MaterialRow; onOpen: () => void }) {
  return (
    <div
      role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      className="card group flex cursor-pointer flex-col overflow-hidden text-left transition hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <Thumb row={row} className="aspect-[4/3] w-full" />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <p className="font-semibold text-stone-900 group-hover:text-brand-700">{row.name}</p>
          <p className="mt-0.5 text-sm text-stone-500">{[row.dimension, row.unit].filter(Boolean).join(' · ') || '—'}</p>
          {row.specification && <p className="mt-1.5 line-clamp-2 text-xs text-stone-400">{row.specification.replace(/\n/g, ' · ')}</p>}
        </div>
        <div className="text-sm font-semibold tabular-nums text-stone-900"><RateText row={row} /></div>
        <div className="mt-auto space-y-2 border-t border-stone-100 pt-3">
          <ProjectLinks row={row} max={2} />
          <FoundOn row={row} />
        </div>
      </div>
    </div>
  )
}

/**
 * Adds a material, or edits one. A material found only on BOQs and quotations
 * is saved into the library when changed here — its documents keep their own
 * copy of the item.
 */
function MaterialModal({ row, onClose }: { row?: MaterialRow; onClose: () => void }) {
  const db = useDb()
  const { user } = useSession()
  const { can } = usePermissions()
  const record = row?.record
  const canSave = record ? can('Materials', 'edit') : can('Materials', 'create')
  const [form, setForm] = useState({
    name: row?.name ?? '',
    dimension: row?.dimension ?? '',
    unit: row?.unit ?? 'Sqft',
    rate: record?.rate ? String(record.rate) : '',
    specification: row?.specification ?? '',
    notes: record?.notes ?? '',
    // A material found only on documents starts with the photo they give it.
    image: row?.image,
  })
  const [included, setIncluded] = useState<ID[]>(record?.projectIds ?? [])
  const [projectQuery, setProjectQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const set = (patch: Partial<typeof form>) => { setForm((f) => ({ ...f, ...patch })); setError(null) }

  // Projects already using it through a BOQ or quotation; they are listed whatever is ticked here.
  const fromDocs = new Set(row?.uses.map((u) => u.quote.projectId) ?? [])
  const pq = projectQuery.trim().toLowerCase()
  const projects = db.projects
    .filter((p) => !pq || [p.name, p.code, p.siteLocation].some((v) => v.toLowerCase().includes(pq)))
    .sort((a, b) => Number(included.includes(b.id)) - Number(included.includes(a.id)) || a.name.localeCompare(b.name))
  const docs = [...new Map((row?.uses ?? []).map((u) => [u.quote.id, u.quote])).values()]

  const save = () => {
    const name = form.name.trim()
    if (!name) return setError('Enter the material name.')
    if (!form.unit.trim()) return setError('Enter the unit, e.g. Sqft or Nos.')
    if (form.rate && !(Number(form.rate) > 0)) return setError('The rate must be a number above zero, or left blank.')
    const key = materialKey(name, form.dimension)
    const clash = db.materials.find((m) => m.id !== record?.id && materialKey(m.name, m.dimension) === key)
    if (clash) return setError(`${clash.name}${clash.dimension ? ` (${clash.dimension})` : ''} is already in the library.`)
    const fields = {
      name,
      dimension: form.dimension.trim() || undefined,
      unit: form.unit.trim(),
      rate: form.rate ? Number(form.rate) : undefined,
      specification: form.specification.trim() || undefined,
      notes: form.notes.trim() || undefined,
      image: form.image,
      projectIds: included,
    }
    if (record) api.materials.update(record.id, fields)
    else api.materials.create({ ...fields, createdBy: user.id, createdAt: today() })
    onClose()
  }

  if (deleting && record) {
    return (
      <ConfirmDialog
        title="Remove from the library?"
        message={<>{record.name} is taken out of the materials library. {docs.length ? 'It stays on the BOQs and quotations that use it, and keeps showing here from them.' : ''}</>}
        confirmLabel="Remove"
        onConfirm={() => { api.materials.remove(record.id); onClose() }}
        onClose={() => setDeleting(false)}
      />
    )
  }

  return (
    <Modal
      title={row ? row.name : 'Add material'}
      size="lg"
      onClose={onClose}
      footer={<>
        {record && can('Materials', 'delete') && (
          <button onClick={() => setDeleting(true)} className="btn-secondary mr-auto text-red-700"><Icon name="trash" className="h-4 w-4" /> Remove</button>
        )}
        <button onClick={onClose} className="btn-secondary">{canSave ? 'Cancel' : 'Close'}</button>
        {canSave && <button onClick={save} className="btn-primary">{record ? 'Save changes' : row ? 'Save to library' : 'Add material'}</button>}
      </>}
    >
      <fieldset disabled={!canSave} className="space-y-5">
        {row && !record && (
          <p className="rounded-xl bg-sky-50 px-3 py-2.5 text-sm text-sky-900">
            Found on {docs.length} BOQ{docs.length === 1 ? '' : 's'} / quotation{docs.length === 1 ? '' : 's'}. Saving adds it to the library, where you can set its rate and the projects it is included in.
          </p>
        )}
        <MaterialImageField value={form.image} name={form.name} onChange={(image) => set({ image })} disabled={!canSave} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Material" required>
              <input className="input" value={form.name} placeholder="e.g. Bangalore Stone" onChange={(e) => set({ name: e.target.value })} />
            </Field>
          </div>
          <Field label="Size" hint="Optional, e.g. 1 x 4 or 600 x 600 mm.">
            <input className="input" value={form.dimension} onChange={(e) => set({ dimension: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Unit" required>
              <input className="input" list="material-units" value={form.unit} onChange={(e) => set({ unit: e.target.value })} />
              <datalist id="material-units">{UNITS.map((u) => <option key={u} value={u} />)}</datalist>
            </Field>
            <Field label="Rate (₹)">
              <input type="number" min={0} step="any" className="input" value={form.rate} placeholder="Optional" onChange={(e) => set({ rate: e.target.value })} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Specification" hint="One point per line, as on the BOQ.">
              <textarea className="input min-h-24" value={form.specification} onChange={(e) => set({ specification: e.target.value })} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Notes">
              <input className="input" value={form.notes} placeholder="Supplier, colour, finish…" onChange={(e) => set({ notes: e.target.value })} />
            </Field>
          </div>
        </div>

        {/* Not a <label>: it holds a list of checkboxes. */}
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="label">Included in projects</span>
            <span className="text-xs text-stone-500">{included.length} chosen</span>
          </div>
          <SearchInput value={projectQuery} onChange={setProjectQuery} placeholder="Search projects" className="mt-1.5" />
          <div className="mt-2 max-h-52 divide-y divide-stone-100 overflow-y-auto rounded-xl border border-stone-200">
            {projects.length === 0 && <p className="px-3 py-3 text-sm text-stone-400">No project matches.</p>}
            {projects.map((p) => {
              const on = included.includes(p.id)
              return (
                <label key={p.id} className="flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-stone-50">
                  <input
                    type="checkbox" checked={on} className="h-4 w-4 accent-brand-600"
                    onChange={() => setIncluded(on ? included.filter((id) => id !== p.id) : [...included, p.id])}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-stone-800">{p.name}</span>
                    <span className="block truncate text-xs text-stone-400"><span className="font-mono">{p.code}</span> · {p.siteLocation}</span>
                  </span>
                  {fromDocs.has(p.id) && <Badge tone="blue">On its BOQ / quotation</Badge>}
                </label>
              )
            })}
          </div>
        </div>
      </fieldset>

      {docs.length > 0 && (
        <div className="mt-5">
          <span className="label">Used on</span>
          <ul className="mt-1.5 divide-y divide-stone-100 rounded-xl border border-stone-200">
            {docs.map((quote) => {
              const use = row!.uses.find((u) => u.quote.id === quote.id)!
              return (
                <li key={quote.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0">
                    <Link to={viewPath(quote)} className="font-medium text-stone-900 hover:text-brand-700">{quote.number}</Link>
                    <span className="text-stone-500"> · {db.projects.find((p) => p.id === quote.projectId)?.name ?? '—'} · {use.area}</span>
                  </span>
                  <span className="whitespace-nowrap text-xs tabular-nums text-stone-500">
                    {use.item.quantity} {use.item.unit}{use.item.rate ? ` @ ${formatCurrency(use.item.rate)}` : ''} · {formatDate(quote.date)}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="mt-4"><FormError message={error} /></div>
    </Modal>
  )
}

/**
 * The material's photo: shrunk on the device and stored, like an item photo
 * on a BOQ. Large enough to fill a card.
 */
function MaterialImageField({ value, name, onChange, disabled }: {
  value?: string; name: string; onChange: (v: string | undefined) => void; disabled?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const take = async (file?: File) => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const { dataUrl } = await compressImage(file, 900, 150)
      onChange(await storePhoto(dataUrl, 'materials'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The picture could not be added.')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    // Not a <label>: it holds buttons.
    <div>
      <span className="label">Photo</span>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => void take(e.target.files?.[0])} />
      <div className="mt-1.5 flex items-center gap-4">
        <span className="flex h-24 w-32 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
          {busy ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-brand-600" />
            : value ? <StoredImg src={value} alt={name || 'Material'} className="h-full w-full object-cover" />
              : <Icon name="image" className="h-6 w-6 text-stone-300" />}
        </span>
        {!disabled && (
          <div className="flex flex-col items-start gap-1.5">
            <button type="button" className="btn-secondary py-1.5 text-sm" onClick={() => input.current?.click()} disabled={busy}>
              <Icon name="upload" className="h-4 w-4" /> {value ? 'Change photo' : 'Add a photo'}
            </button>
            {value && (
              <button type="button" className="btn-ghost py-1 text-xs text-red-600 hover:bg-red-50" onClick={() => onChange(undefined)}>
                <Icon name="trash" className="h-3.5 w-3.5" /> Remove
              </button>
            )}
            <span className="text-xs text-stone-400">JPG or PNG — shrunk before it is saved.</span>
          </div>
        )}
      </div>
      {error && <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}
    </div>
  )
}
