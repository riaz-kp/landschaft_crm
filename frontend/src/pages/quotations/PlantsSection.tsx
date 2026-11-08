import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { Icon } from '../../components/Icon'
import { Badge, SearchInput } from '../../components/ui'
import { plantsApp, plantsProjectUrl, type PlantsProjectSummary } from '../../data/plants'
import { formatDate } from '../../domain/format'
import { formatQty, formatRupees, groupPlants, nameTokens, plantAmount, plantThumb, rankMatches } from '../../domain/quotation'
import type { PlantLine, PlantsCopy, Project, Quotation } from '../../domain/types'

interface Props {
  quote: Quotation
  project: Project
  priced: boolean
  disabled?: boolean
  onChange: (plants: PlantsCopy | undefined) => void
}

const when = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : `${formatDate(iso.slice(0, 10))} ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
}

/** A plant's photo, or a leaf where the plants app has none. */
export function PlantPhoto({ line, size = 40 }: { line: PlantLine; size?: number }) {
  const [broken, setBroken] = useState(false)
  const src = plantThumb(line.image, size * 3)
  const box = { width: size, height: size }
  if (!src || broken) {
    return (
      <span style={box} className="flex shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
        <Icon name="leaf" className="h-4 w-4" />
      </span>
    )
  }
  return <img src={src} alt={line.name} style={box} loading="lazy" className="shrink-0 rounded-lg object-cover" onError={() => setBroken(true)} />
}

/**
 * The plants on the document. They come from the matching project in the
 * plants app — found by name, or picked by hand — and are only read here:
 * quantities, sizes and rates are changed in the plants app, then fetched again.
 */
export function PlantsSection({ quote, project, priced, disabled, onChange }: Props) {
  const db = useDb()
  const { user } = useSession()
  const settings = db.settings.documents
  const client = db.clients.find((c) => c.id === project.clientId)
  const link = project.plantsProject
  const copy = quote.plants
  const [matching, setMatching] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newer, setNewer] = useState<PlantsProjectSummary | null>(null)
  const tried = useRef(false)

  const fetchLines = async (id: string) => {
    setFetching(true)
    setError(null)
    try {
      const found = await plantsApp.get(id)
      onChange({ projectId: found.id, projectName: found.name, fetchedAt: new Date().toISOString(), updatedAt: found.updatedAt, lines: found.lines })
      setNewer(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The plant list could not be fetched.')
    } finally {
      setFetching(false)
    }
  }

  // A linked project with no list on this document yet: fetch it straight away.
  const fetchNow = useRef(fetchLines)
  useEffect(() => {
    fetchNow.current = fetchLines
  })
  const linkId = link?.id
  const hasCopy = Boolean(copy)
  useEffect(() => {
    if (tried.current || disabled || !linkId || hasCopy) return
    tried.current = true
    void fetchNow.current(linkId)
  }, [linkId, hasCopy, disabled])

  // Has the list changed in the plants app since this copy was taken?
  const copiedFrom = copy?.projectId
  const copiedAt = copy?.updatedAt
  useEffect(() => {
    if (!copiedFrom || !copiedAt) return
    let live = true
    plantsApp.list().then((projects) => {
      const current = projects.find((p) => p.id === copiedFrom)
      if (live && current && current.updatedAt > copiedAt) setNewer(current)
    }).catch(() => {
      // Only a hint; without a connection the copy is shown as it is.
    })
    return () => {
      live = false
    }
  }, [copiedFrom, copiedAt])

  const choose = (picked: PlantsProjectSummary) => {
    if (link?.id !== picked.id) api.projects.update(project.id, { plantsProject: { id: picked.id, name: picked.name } }, user.id)
    setMatching(false)
    void fetchLines(picked.id)
  }

  const showMatcher = !disabled && (matching || !link)
  const lines = copy?.lines ?? []
  const groups = groupPlants(lines)
  const subtotal = lines.reduce((s, l) => s + plantAmount(l), 0)
  const missingQty = lines.filter((l) => !l.quantity).length
  const missingRate = priced ? lines.filter((l) => !l.rate).length : 0
  const linkedElsewhere = copy && link && copy.projectId !== link.id

  return (
    <div>
      {/* Where the list comes from. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 bg-stone-50/60 px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700"><Icon name="leaf" className="h-4 w-4" /></span>
          <div className="min-w-0">
            {copy ? (
              <>
                <p className="truncate text-sm font-semibold text-stone-900">From the plants app: {copy.projectName}</p>
                <p className="text-xs text-stone-500">{lines.length} plant{lines.length === 1 ? '' : 's'} · fetched {when(copy.fetchedAt)}</p>
              </>
            ) : link ? (
              <>
                <p className="truncate text-sm font-semibold text-stone-900">Linked to {link.name} in the plants app</p>
                <p className="text-xs text-stone-500">{fetching ? 'Fetching its plant list…' : 'Plant list not fetched yet.'}</p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-stone-900">Not linked to the plants app yet</p>
                <p className="text-xs text-stone-500">Pick the project in the plants app this project’s plants are chosen in.</p>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(copy || link) && (
            <a href={plantsProjectUrl(settings.plantsAppUrl, copy?.projectId ?? link!.id)} target="_blank" rel="noreferrer" className="btn-ghost py-1.5 text-xs">
              <Icon name="link" className="h-3.5 w-3.5" /> Open in plants app
            </a>
          )}
          {!disabled && link && (
            <button type="button" className="btn-secondary py-1.5 text-xs" onClick={() => void fetchLines(link.id)} disabled={fetching}>
              <Icon name="repeat" className={`h-3.5 w-3.5 ${fetching ? 'animate-spin' : ''}`} /> {fetching ? 'Fetching…' : copy ? 'Fetch again' : 'Fetch plants'}
            </button>
          )}
          {!disabled && link && !matching && (
            <button type="button" className="btn-ghost py-1.5 text-xs" onClick={() => setMatching(true)}>Change project</button>
          )}
        </div>
      </div>

      {error && (
        <p className="flex items-start gap-2 border-b border-red-100 bg-red-50 px-5 py-2.5 text-sm text-red-700">
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      )}
      {newer && !disabled && !fetching && (
        <p className="flex flex-wrap items-center gap-2 border-b border-amber-100 bg-amber-50 px-5 py-2.5 text-sm text-amber-900">
          <Icon name="alert" className="h-4 w-4 shrink-0" />
          {newer.name} was changed in the plants app after this list was fetched.
          <button type="button" className="font-semibold underline underline-offset-2" onClick={() => void fetchLines(newer.id)}>Fetch the new list</button>
        </p>
      )}
      {linkedElsewhere && !disabled && !fetching && (
        <p className="flex flex-wrap items-center gap-2 border-b border-amber-100 bg-amber-50 px-5 py-2.5 text-sm text-amber-900">
          <Icon name="alert" className="h-4 w-4 shrink-0" />
          This list came from {copy.projectName}, but the project is now linked to {link.name}.
          <button type="button" className="font-semibold underline underline-offset-2" onClick={() => void fetchLines(link.id)}>Fetch from {link.name}</button>
        </p>
      )}

      {showMatcher && (
        <ProjectMatcher
          target={{ name: project.name, client: client?.name, location: project.siteLocation }}
          current={link?.id}
          onChoose={choose}
          onCancel={link ? () => setMatching(false) : undefined}
        />
      )}

      {copy && lines.length === 0 && <p className="px-5 py-6 text-center text-sm text-stone-400">That project has no plants in the plants app yet.</p>}

      {lines.length > 0 && (
        <>
          {(missingQty > 0 || missingRate > 0) && (
            <p className="flex items-start gap-2 px-5 pt-3 text-xs text-amber-800">
              <Icon name="alert" className="mt-px h-3.5 w-3.5 shrink-0" />
              {[missingQty && `${missingQty} without a quantity`, missingRate && `${missingRate} without a rate`].filter(Boolean).join(', ')} — set them in the plants app, then fetch again.
            </p>
          )}
          <div className="scroll-x">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="border-b border-stone-200">
                  <th className="th w-10">#</th>
                  <th className="th w-14">Image</th>
                  <th className="th">Plant / botanical name</th>
                  <th className="th text-center">Size (ft)</th>
                  <th className="th text-right">Qty</th>
                  <th className="th">Unit</th>
                  {priced && <><th className="th text-right">Rate</th><th className="th text-right">Amount</th></>}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let serial = 0
                  return groups.map(([category, list]) => (
                    <Fragment key={category}>
                      <tr className="bg-[#faf8f4]">
                        <td colSpan={priced ? 8 : 6} className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7a8075]">
                          {category} · {list.length}
                        </td>
                      </tr>
                      {list.map((line) => {
                        serial += 1
                        return (
                          <tr key={`${line.plantId}-${serial}`} className="border-t border-stone-100">
                            <td className="td py-2 tabular-nums text-stone-400">{serial}</td>
                            <td className="td py-2"><PlantPhoto line={line} /></td>
                            <td className="td py-2">
                              <span className="block font-medium text-stone-900">{line.name}</span>
                              {line.botanical && <span className="block text-xs italic text-stone-500">{line.botanical}</span>}
                            </td>
                            <td className="td py-2 text-center tabular-nums">{line.size || '—'}</td>
                            <td className={`td py-2 text-right tabular-nums ${line.quantity ? 'font-medium text-stone-900' : 'bg-amber-50 text-amber-700'}`}>{formatQty(line.quantity)}</td>
                            <td className="td py-2 text-stone-500">{line.unit || '—'}</td>
                            {priced && (
                              <>
                                <td className={`td py-2 text-right tabular-nums ${line.rate ? '' : 'bg-amber-50 text-amber-700'}`}>{line.rate ? formatRupees(line.rate) : '—'}</td>
                                <td className="td py-2 text-right font-semibold tabular-nums text-stone-900">{formatRupees(plantAmount(line))}</td>
                              </>
                            )}
                          </tr>
                        )
                      })}
                    </Fragment>
                  ))
                })()}
              </tbody>
            </table>
          </div>
          {priced && (
            <p className="border-t border-stone-100 px-5 py-3 text-right text-sm text-stone-500">
              Plants subtotal <strong className="ml-1 tabular-nums text-stone-900">{formatRupees(subtotal)}</strong>
            </p>
          )}
        </>
      )}
    </div>
  )
}

/**
 * Finds the plants-app project for a CRM project. Projects are ranked by how
 * well their name, client and site match; the likeliest is marked, and any
 * other can be searched for and picked instead.
 */
function ProjectMatcher({ target, current, onChoose, onCancel }: {
  target: { name: string; client?: string; location?: string }
  current?: string
  onChoose: (project: PlantsProjectSummary) => void
  onCancel?: () => void
}) {
  const [projects, setProjects] = useState<PlantsProjectSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const load = (fresh = false) =>
    plantsApp.list(fresh).then((list) => {
      setProjects(list)
      setError(null)
    }).catch((e: unknown) => setError(e instanceof Error ? e.message : 'The plants app could not be reached.'))
  useEffect(() => {
    void load()
  }, [])

  const { name, client, location } = target
  const ranked = useMemo(() => {
    if (!projects) return []
    const wanted = { name, client, location }
    const words = nameTokens(query)
    if (!words.length) return rankMatches(wanted, projects).slice(0, 6)
    // Searching: every project whose name, client or place holds what was typed, best matches first.
    const scored = rankMatches(wanted, projects, 0)
    return scored.filter(({ candidate }) => {
      const haystack = nameTokens(`${candidate.name} ${candidate.clientName ?? ''} ${candidate.location ?? ''}`).join(' ')
      return words.every((w) => haystack.includes(w))
    }).slice(0, 12)
  }, [projects, query, name, client, location])

  const best = !query.trim() && ranked[0]?.score >= 0.55 ? ranked[0].candidate.id : undefined

  return (
    <div className="border-b border-stone-100 px-5 py-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-stone-600">
          {query.trim() ? 'Projects in the plants app matching your search:' : <>Projects in the plants app that match <strong className="text-stone-900">{target.name}</strong>{target.client ? <> for {target.client}</> : null}:</>}
        </p>
        <div className="flex items-center gap-2">
          <SearchInput value={query} onChange={setQuery} placeholder="Search the plants app…" className="w-56" />
          {onCancel && <button type="button" className="btn-ghost py-1.5 text-xs" onClick={onCancel}>Cancel</button>}
        </div>
      </div>

      {error ? (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="flex items-start gap-2"><Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" /> {error}</p>
          <button type="button" className="mt-2 font-semibold underline underline-offset-2" onClick={() => void load(true)}>Try again</button>
        </div>
      ) : !projects ? (
        <p className="flex items-center gap-2 py-3 text-sm text-stone-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-stone-300 border-t-brand-600" /> Looking in the plants app…
        </p>
      ) : ranked.length === 0 ? (
        <p className="rounded-xl bg-stone-50 px-4 py-3 text-sm text-stone-500">
          {query.trim() ? 'No project in the plants app matches that.' : 'No project in the plants app has a similar name. Search for it above.'}
        </p>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {ranked.map(({ candidate, score }) => (
            <li key={candidate.id}>
              <button
                type="button" onClick={() => onChoose(candidate)}
                className={`flex w-full items-start gap-3 rounded-xl border-2 p-3 text-left transition hover:border-brand-400 hover:bg-brand-50/40 ${
                  candidate.id === best ? 'border-brand-500 bg-brand-50/60' : 'border-stone-200 bg-white'
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-stone-900">{candidate.name}</span>
                    {candidate.id === best && <Badge tone="green">Best match</Badge>}
                    {candidate.id === current && <Badge tone="blue">Linked now</Badge>}
                    {candidate.locked && <Badge tone="stone">Locked</Badge>}
                  </span>
                  <span className="mt-0.5 block text-xs text-stone-500">
                    {[candidate.clientName, candidate.location].filter(Boolean).join(' · ') || 'No client or place recorded'}
                  </span>
                  <span className="mt-1 block text-xs text-stone-400">
                    {candidate.plantCount} plant{candidate.plantCount === 1 ? '' : 's'} · changed {formatDate(candidate.updatedAt.slice(0, 10))}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-xs font-semibold tabular-nums text-stone-500">{Math.round(score * 100)}%</span>
                  <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-700">Use <Icon name="chevron" className="h-3 w-3" /></span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
