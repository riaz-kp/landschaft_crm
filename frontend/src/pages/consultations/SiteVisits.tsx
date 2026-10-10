import { useState } from 'react'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { usePermissions } from '../../state/permissions'
import { titleOf } from '../../domain/roles'
import { addDays, formatDate, formatDateLong, formatTime, today, whatsappUrl } from '../../domain/format'
import {
  REMIND_OPTIONS, isOnVisit, remindLabel, visitPeople, visitReminderText, visitSubject,
} from '../../domain/siteVisits'
import type { Employee, SiteVisit, SiteVisitStatus } from '../../domain/types'
import {
  PageHeader, Section, StatusBadge, Table, EmptyState, Pills, SearchInput, Toolbar, RowActions,
  ConfirmDialog, Modal, Field, FormError, StatTile, Badge, Avatar,
} from '../../components/ui'
import { Icon } from '../../components/Icon'
import { SearchSelect } from '../../components/SearchSelect'
import { PeoplePicker } from '../../components/PeoplePicker'
import { TimeInput } from '../../components/TimeInput'
import { PinField } from '../../components/PinField'
import { directionsUrl } from '../../components/mapLinks'
import { clientSite, mapLinkLine, visitPlace } from '../../domain/places'
import { clientOptions, employeeOptions, leadOptions } from '../../components/pickerOptions'

const STATUSES: SiteVisitStatus[] = ['Scheduled', 'Completed', 'Cancelled']
type Filter = 'upcoming' | 'mine' | 'past' | 'all'

/**
 * Visits to leads' and clients' sites. One person leads each visit and others
 * can go along; everyone on it is reminded ahead of the day, in the app and
 * over WhatsApp.
 */
export function SiteVisits() {
  const db = useDb()
  const { user } = useSession()
  const { can } = usePermissions()
  const [filter, setFilter] = useState<Filter>('upcoming')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<SiteVisit | 'new' | null>(null)
  const [deleting, setDeleting] = useState<SiteVisit | null>(null)
  const [reminding, setReminding] = useState<SiteVisit | null>(null)

  const subject = (v: SiteVisit) => visitSubject(v, db.leads, db.clients)
  const staffName = (id: string) => db.employees.find((e) => e.id === id)?.name ?? '—'
  const isUpcoming = (v: SiteVisit) => v.date >= today() && v.status === 'Scheduled'

  const q = query.trim().toLowerCase()
  const visits = [...db.siteVisits]
    .filter((v) => {
      if (filter === 'upcoming') return isUpcoming(v)
      if (filter === 'mine') return isUpcoming(v) && isOnVisit(v, user.id)
      if (filter === 'past') return !isUpcoming(v)
      return true
    })
    .filter((v) => !q || [subject(v), v.location, v.notes, ...visitPeople(v).map(staffName)].some((s) => s.toLowerCase().includes(q)))
    .sort((a, b) => {
      const ka = a.date + (a.time ?? '')
      const kb = b.date + (b.time ?? '')
      return filter === 'past' || filter === 'all' ? kb.localeCompare(ka) : ka.localeCompare(kb)
    })

  const upcoming = db.siteVisits.filter(isUpcoming)
  const mine = upcoming.filter((v) => isOnVisit(v, user.id))

  return (
    <div>
      <PageHeader
        title="Site Visits"
        subtitle="Visits to leads' and clients' sites. Take colleagues along as a group — everyone on the visit is reminded before the day."
        actions={can('Site Visits', 'create') && (
          <button onClick={() => setEditing('new')} className="btn-primary"><Icon name="plus" className="h-4 w-4" /> Schedule visit</button>
        )}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Upcoming" value={upcoming.length} tone="blue" icon="calendar" />
        <StatTile label="Next 7 Days" value={upcoming.filter((v) => v.date <= addDays(today(), 7)).length} tone="amber" icon="clock" />
        <StatTile label="I'm On" value={mine.length} tone="clay" icon="users" sub={mine[0] ? `Next ${mine[0].date === today() ? 'today' : formatDate(mine[0].date)}` : 'Nothing coming up'} />
        <StatTile label="Completed" value={db.siteVisits.filter((v) => v.status === 'Completed').length} tone="green" icon="check" />
      </div>

      <Toolbar>
        <Pills<Filter>
          active={filter}
          onChange={setFilter}
          options={[
            { key: 'upcoming', label: 'Upcoming', count: upcoming.length },
            { key: 'mine', label: 'My visits', count: mine.length },
            { key: 'past', label: 'Past & closed', count: db.siteVisits.length - upcoming.length },
            { key: 'all', label: 'All', count: db.siteVisits.length },
          ]}
        />
        <SearchInput value={query} onChange={setQuery} placeholder="Search visits or people…" className="lg:w-72" />
      </Toolbar>

      <Section>
        {visits.length === 0 ? (
          <EmptyState title={filter === 'mine' ? 'You are not on any upcoming visit.' : 'No site visits here.'} icon="pin" />
        ) : (
          <Table head={['Visit', 'When', 'Location', 'Team', 'Reminder', 'Status', '']}>
            {visits.map((visit) => {
              const people = visitPeople(visit)
              const place = visitPlace(visit, db.projects)
              return (
                <tr key={visit.id} className="row-hover">
                  <td className="td md:min-w-[15rem]">
                    <span className="flex flex-wrap items-center gap-1.5 font-medium text-stone-900">
                      {subject(visit)}
                      <Badge tone={visit.leadId ? 'blue' : 'green'}>{visit.leadId ? 'Lead' : 'Client'}</Badge>
                      {isOnVisit(visit, user.id) && isUpcoming(visit) && <Badge tone="clay">You're on it</Badge>}
                    </span>
                    {visit.notes && <span className="mt-0.5 line-clamp-2 block max-w-sm text-xs text-stone-500">{visit.notes}</span>}
                  </td>
                  <td className="td whitespace-nowrap tabular-nums">
                    <span className="block font-medium text-stone-900">{visit.date === today() ? 'Today' : formatDate(visit.date)}</span>
                    {visit.time && <span className="block text-xs text-stone-500">{formatTime(visit.time)}</span>}
                  </td>
                  <td className="td">
                    {visit.location}
                    {place && (
                      <a href={directionsUrl(place.coords)} target="_blank" rel="noreferrer" className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-brand-700">
                        <Icon name="map" className="h-3 w-3" /> Directions
                      </a>
                    )}
                  </td>
                  <td className="td"><TeamCell people={people.map((id) => db.employees.find((e) => e.id === id)).filter((e): e is Employee => Boolean(e))} /></td>
                  <td className="td whitespace-nowrap">
                    {visit.remindDaysBefore === undefined
                      ? <span className="text-stone-400">None</span>
                      : <span className="inline-flex items-center gap-1 text-stone-700"><Icon name="bell" className="h-3.5 w-3.5 text-amber-600" />{remindLabel(visit.remindDaysBefore)}</span>}
                  </td>
                  <td className="td">
                    {can('Site Visits', 'edit') ? (
                      <select
                        value={visit.status}
                        onChange={(e) => api.siteVisits.update(visit.id, { status: e.target.value as SiteVisitStatus })}
                        className="input w-32 py-1 text-xs" aria-label="Visit status"
                      >
                        {STATUSES.map((s) => <option key={s}>{s}</option>)}
                      </select>
                    ) : <StatusBadge status={visit.status} />}
                  </td>
                  <td className="td">
                    <RowActions
                      extra={isUpcoming(visit) && (
                        <button type="button" onClick={() => setReminding(visit)} className="btn-icon text-brand-700" title="Remind the team" aria-label="Remind the team">
                          <Icon name="bell" className="h-4 w-4" />
                        </button>
                      )}
                      onEdit={can('Site Visits', 'edit') ? () => setEditing(visit) : undefined}
                      onDelete={can('Site Visits', 'delete') ? () => setDeleting(visit) : undefined}
                    />
                  </td>
                </tr>
              )
            })}
          </Table>
        )}
      </Section>

      {editing && <SiteVisitFormModal visit={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {reminding && <RemindTeamModal visit={reminding} onClose={() => setReminding(null)} />}
      {deleting && (
        <ConfirmDialog
          title="Delete this site visit?"
          message={<>The visit to {subject(deleting)} on {formatDate(deleting.date)} will be removed.</>}
          onClose={() => setDeleting(null)}
          onConfirm={() => api.siteVisits.remove(deleting.id)}
        />
      )}
    </div>
  )
}

/** Overlapping avatars for everyone on the visit, the leader named. */
function TeamCell({ people }: { people: Employee[] }) {
  if (people.length === 0) return <span className="text-stone-400">—</span>
  const [leader, ...rest] = people
  return (
    <span className="flex items-center gap-2" title={people.map((p) => p.name).join(', ')}>
      <span className="flex -space-x-2">
        {people.slice(0, 4).map((p) => <Avatar key={p.id} name={p.name} size="sm" src={p.photo} />)}
      </span>
      <span className="min-w-0 text-sm leading-tight">
        <span className="block whitespace-nowrap font-medium text-stone-800">{leader.name}</span>
        <span className="block whitespace-nowrap text-xs text-stone-500">{rest.length ? `+ ${rest.length} more` : 'Going alone'}</span>
      </span>
    </span>
  )
}

/** Nudge everyone on a visit over WhatsApp, with the visit details pre-filled. */
function RemindTeamModal({ visit, onClose }: { visit: SiteVisit; onClose: () => void }) {
  const db = useDb()
  const people = visitPeople(visit).map((id) => db.employees.find((e) => e.id === id)).filter((e): e is Employee => Boolean(e))
  const subject = visitSubject(visit, db.leads, db.clients)
  const leader = db.employees.find((e) => e.id === visit.assignedTo)?.name ?? '—'
  const text = [visitReminderText(visit, subject, leader), mapLinkLine(visitPlace(visit, db.projects))].filter(Boolean).join('\n')

  return (
    <Modal title="Remind the team" onClose={onClose} footer={<button onClick={onClose} className="btn-secondary">Done</button>}>
      <div className="space-y-4">
        <div className="rounded-xl bg-stone-50 p-3 text-sm">
          <p className="font-medium text-stone-900">Site visit — {subject}</p>
          <p className="mt-0.5 text-stone-500">
            {formatDateLong(visit.date)}{visit.time && ` · ${formatTime(visit.time)}`} · {visit.location}
          </p>
        </div>
        <p className="flex items-start gap-2 text-sm text-stone-600">
          <Icon name="bell" className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          {visit.remindDaysBefore === undefined
            ? 'No in-app reminder is set — edit the visit to add one.'
            : `Everyone below sees it under their bell ${visit.remindDaysBefore === 0 ? 'on the day' : `from ${formatDateLong(addDays(visit.date, -visit.remindDaysBefore))}`}.`}
        </p>
        <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200">
          {people.map((p, i) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2.5">
              <Avatar name={p.name} src={p.photo} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-stone-900">{p.name}{i === 0 && <span className="ml-1.5 text-xs font-normal text-stone-400">leading</span>}</span>
                <span className="block truncate text-xs text-stone-500">{titleOf(p)}</span>
              </span>
              <a
                href={whatsappUrl(p.whatsapp || p.phone, text)}
                target="_blank" rel="noreferrer"
                className="btn-secondary shrink-0 py-1.5 text-xs"
              >
                <Icon name="chat" className="h-4 w-4 text-brand-600" /> WhatsApp
              </a>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  )
}

function SiteVisitFormModal({ visit, onClose }: { visit?: SiteVisit; onClose: () => void }) {
  const db = useDb()
  const { user } = useSession()
  const openLeads = db.leads.filter((l) => l.status !== 'Lost')
  const staff = db.employees.filter((e) => e.role !== 'super_admin')
  const [form, setForm] = useState({
    party: (visit?.clientId ? 'Client' : 'Lead') as 'Lead' | 'Client',
    leadId: visit?.leadId ?? openLeads[0]?.id ?? '',
    clientId: visit?.clientId ?? db.clients[0]?.id ?? '',
    location: visit?.location ?? openLeads[0]?.location ?? '',
    coords: visit?.coords,
    date: visit?.date ?? addDays(today(), 1),
    time: visit?.time ?? '10:00',
    assignedTo: visit?.assignedTo ?? (user.role === 'super_admin' ? 'e2' : user.id),
    teamIds: visit?.teamIds ?? [],
    remind: visit ? (visit.remindDaysBefore === undefined ? 'none' : String(visit.remindDaysBefore)) : '1',
    status: visit?.status ?? ('Scheduled' as SiteVisitStatus),
    notes: visit?.notes ?? '',
  })
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<typeof form>) => { setForm({ ...form, ...patch }); setError(null) }
  const projectSite = form.party === 'Client' ? clientSite(form.clientId, db.projects) : undefined

  // Pick up the location from the lead or client unless one has been typed.
  const suggestLocation = (patch: Partial<typeof form>) => {
    const next = { ...form, ...patch }
    const place = next.party === 'Lead'
      ? db.leads.find((l) => l.id === next.leadId)?.location
      : db.clients.find((c) => c.id === next.clientId)?.address
    set({ ...patch, location: form.location && visit ? form.location : place ?? '' })
  }

  const save = () => {
    if (form.party === 'Lead' && !form.leadId) return setError('Pick the lead.')
    if (form.party === 'Client' && !form.clientId) return setError('Pick the client.')
    if (!form.location.trim()) return setError('Enter where the visit is.')
    if (!form.date) return setError('Pick a date.')
    if (!form.assignedTo) return setError('Pick who leads the visit.')
    const values = {
      leadId: form.party === 'Lead' ? form.leadId : undefined,
      clientId: form.party === 'Client' ? form.clientId : undefined,
      location: form.location.trim(),
      coords: form.coords,
      date: form.date,
      time: form.time || undefined,
      assignedTo: form.assignedTo,
      teamIds: form.teamIds.filter((id) => id !== form.assignedTo),
      remindDaysBefore: form.remind === 'none' ? undefined : Number(form.remind),
      status: form.status,
      notes: form.notes.trim(),
    }
    if (visit) api.siteVisits.update(visit.id, values)
    else api.siteVisits.create(values)
    onClose()
  }

  return (
    <Modal
      title={visit ? 'Edit site visit' : 'Schedule a site visit'}
      size="lg"
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={save} className="btn-primary">{visit ? 'Save changes' : 'Schedule'}</button>
      </>}
    >
      <div className="space-y-5">
        <div>
          <p className="label">Visit for</p>
          <div className="mt-2 flex gap-2">
            {(['Lead', 'Client'] as const).map((p) => (
              <button key={p} type="button" onClick={() => suggestLocation({ party: p })} className={`chip px-3.5 py-1.5 text-sm ${form.party === p ? 'chip-on' : ''}`}>{p}</button>
            ))}
          </div>
          <div className="mt-2">
            {form.party === 'Lead' ? (
              <SearchSelect
                value={form.leadId}
                onChange={(leadId) => suggestLocation({ leadId })}
                options={leadOptions(openLeads)}
                searchPlaceholder="Search leads"
                ariaLabel="Lead"
                title="Lead"
              />
            ) : (
              <SearchSelect
                value={form.clientId}
                onChange={(clientId) => suggestLocation({ clientId })}
                options={clientOptions(db.clients)}
                searchPlaceholder="Search clients by name, phone or place"
                ariaLabel="Client"
                title="Client"
              />
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Field label="Location" required>
            <input className="input" value={form.location} onChange={(e) => set({ location: e.target.value })} />
          </Field>
          <PinField
            value={form.coords}
            onChange={(coords) => set({ coords })}
            query={form.location}
            fallback={projectSite ? `Not pinned — shown at the client's project site, ${projectSite.label}` : undefined}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date" required>
            <input type="date" className="input" value={form.date} onChange={(e) => set({ date: e.target.value })} />
          </Field>
          <div>
            <span className="label">Meet at</span>
            <div className="mt-1.5">
              <TimeInput value={form.time} onChange={(time) => set({ time })} ariaLabel="Visit time" step={15} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-800">
            <Icon name="users" className="h-4 w-4 text-brand-600" /> Who's going
          </p>
          <div className="space-y-4">
            <Field label="Led by" required>
              <SearchSelect
                value={form.assignedTo}
                onChange={(assignedTo) => set({ assignedTo, teamIds: form.teamIds.filter((id) => id !== assignedTo) })}
                options={employeeOptions(staff)}
                searchPlaceholder="Search people"
                title="Led by"
              />
            </Field>
            <div>
              <span className="label">Going along</span>
              <div className="mt-1.5">
                <PeoplePicker
                  value={form.teamIds}
                  onChange={(teamIds) => set({ teamIds })}
                  people={staff}
                  exclude={[form.assignedTo]}
                  placeholder="Add someone to the group…"
                  title="Add to the visit"
                />
              </div>
              <p className="mt-1 text-xs text-stone-400">Optional — add anyone else from the team who should be there.</p>
            </div>
            <Field label="Remind everyone" hint="Shows under the bell for each person on the visit. You can also nudge them on WhatsApp from the list.">
              <select className="input" value={form.remind} onChange={(e) => set({ remind: e.target.value })}>
                <option value="none">No reminder</option>
                {REMIND_OPTIONS.map((o) => <option key={o.days} value={o.days}>{o.label}</option>)}
              </select>
            </Field>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status">
            <select className="input" value={form.status} onChange={(e) => set({ status: e.target.value as SiteVisitStatus })}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Notes">
          <textarea rows={3} className="input" value={form.notes} placeholder="What to check on site" onChange={(e) => set({ notes: e.target.value })} />
        </Field>
        <FormError message={error} />
      </div>
    </Modal>
  )
}
