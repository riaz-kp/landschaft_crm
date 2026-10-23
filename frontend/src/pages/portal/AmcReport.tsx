import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { amcProgress, describeSchedule, occurrencesFor } from '../../domain/amc'
import { formatDate, formatDateLong, today } from '../../domain/format'
import type { MaintenanceVisit } from '../../domain/types'
import { ProgressBar } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { Lightbox } from '../../components/Lightbox'
import { StoredImg } from '../../components/StoredImage'
import { PortalFrame, PortalLoading, PortalMessage } from './Portal'
import { loadAmcReport, type AmcReportData } from './portalData'

/** The client's view of their maintenance contract: every visit's report, newest first, with photos. */
export function AmcReport() {
  const { token = '' } = useParams()
  const [data, setData] = useState<AmcReportData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    loadAmcReport(token).then(
      (loaded) => live && setData(loaded),
      (e: Error) => live && setError(e.message),
    )
    return () => {
      live = false
    }
  }, [token])

  useEffect(() => {
    if (data) document.title = `${data.projectName || 'Your garden'} — Maintenance report`
  }, [data])

  if (error) return <PortalFrame><PortalMessage title="This report can't be opened" message={error} /></PortalFrame>
  if (!data) return <PortalFrame><PortalLoading /></PortalFrame>

  const { record } = data
  const all = occurrencesFor(record, today())
  const progress = amcProgress(record, today())
  const next = all.find((o) => o.status !== 'Done' && o.date >= today())
  const visits = record.visits.filter((v) => v.done).sort((a, b) => b.date.localeCompare(a.date))

  return (
    <PortalFrame
      eyebrow={record.type === 'AMC' ? 'Annual maintenance report' : 'Maintenance report'}
      title={data.projectName || 'Your garden'}
      subtitle={[data.clientName, data.siteLocation].filter(Boolean).join(' · ')}
    >
      <section className="card grid gap-px overflow-hidden bg-stone-100 sm:grid-cols-3">
        <div className="bg-white px-5 py-4">
          <p className="label">Contract</p>
          <p className="mt-1 text-sm font-semibold text-stone-900">{formatDate(record.startDate)} – {formatDate(record.endDate)}</p>
          {record.schedule && <p className="mt-0.5 text-xs text-stone-500">{describeSchedule(record.schedule)}</p>}
        </div>
        <div className="bg-white px-5 py-4">
          <p className="label">Visits done</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1"><ProgressBar value={progress.percent} size="sm" /></div>
            <span className="text-sm font-semibold tabular-nums text-stone-800">{visits.length}{progress.total > 0 && ` of ${progress.total}`}</span>
          </div>
        </div>
        <div className="bg-white px-5 py-4">
          <p className="label">Next visit</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-stone-900">
            <Icon name="calendar" className="h-4 w-4 text-brand-600" />
            {next ? formatDateLong(next.date) : 'None left in this term'}
          </p>
        </div>
      </section>

      {record.scopeOfWork && (
        <section className="card mt-4 px-5 py-4">
          <p className="label">What the contract covers</p>
          <p className="mt-1 text-sm leading-relaxed text-stone-700">{record.scopeOfWork}</p>
        </section>
      )}

      <h2 className="mb-3 mt-8 font-display text-lg font-bold text-stone-900">Visit reports</h2>
      {visits.length === 0 ? (
        <div className="card px-5 py-10 text-center text-sm text-stone-500">
          No visits have been recorded yet. Reports appear here after each visit.
        </div>
      ) : (
        <ol className="space-y-4">
          {visits.map((visit, i) => <VisitCard key={visit.id} visit={visit} number={visits.length - i} />)}
        </ol>
      )}
    </PortalFrame>
  )
}

function VisitCard({ visit, number }: { visit: MaintenanceVisit; number: number }) {
  const [viewing, setViewing] = useState<number | null>(null)
  const photos = visit.photos ?? []
  const files = visit.files ?? []

  return (
    <li className="card overflow-hidden">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-stone-100 px-5 py-3.5">
        <h3 className="font-semibold text-stone-900">{formatDateLong(visit.date)}</h3>
        <span className="text-xs font-medium text-stone-400">Visit {number}</span>
      </header>
      <div className="space-y-4 px-5 py-4">
        <div>
          <p className="label">Work done</p>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-stone-700">{visit.notes || '—'}</p>
        </div>

        {visit.issues.length > 0 && (
          <div className="rounded-xl bg-amber-50 px-4 py-3">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-800">
              <Icon name="alert" className="h-3.5 w-3.5" /> Noticed on this visit
            </p>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-sm text-amber-900">
              {visit.issues.map((issue, i) => <li key={i}>{issue}</li>)}
            </ul>
          </div>
        )}

        {photos.length > 0 && (
          <div>
            <p className="label mb-2">Photos <span className="font-normal normal-case text-stone-400">· {photos.length}</span></p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {photos.map((photo, i) => (
                <button key={photo.id} type="button" onClick={() => setViewing(i)} className="group overflow-hidden rounded-xl bg-stone-100 text-left">
                  <StoredImg src={photo.src} alt={photo.caption ?? `Visit photo ${i + 1}`} className="aspect-[4/3] w-full object-cover transition group-hover:opacity-90" />
                  {photo.caption && <span className="block truncate px-2 py-1.5 text-xs text-stone-600">{photo.caption}</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {files.length > 0 && (
          <div>
            <p className="label mb-2">Report documents</p>
            <ul className="space-y-1.5">
              {files.map((f, i) => (
                <li key={i}>
                  {f.file ? (
                    <a href={f.file} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-brand-700 ring-1 ring-inset ring-stone-200 hover:bg-brand-50">
                      <Icon name="doc" className="h-4 w-4 shrink-0" /> <span className="truncate">{f.name}</span>
                    </a>
                  ) : (
                    <span className="flex items-center gap-2 px-3 py-2 text-sm text-stone-600"><Icon name="doc" className="h-4 w-4" /> {f.name}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {viewing !== null && (
        <Lightbox
          photos={photos.map((p, i) => ({ src: p.src, title: p.caption || `Photo ${i + 1}`, sub: formatDateLong(visit.date) }))}
          index={viewing} onIndex={setViewing} onClose={() => setViewing(null)}
        />
      )}
    </li>
  )
}
