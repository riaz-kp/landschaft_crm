import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import {
  BRIEF_SECTIONS, OTHER, briefProgress, cleanAnswers, isAsked, otherKey, prefill, type BriefQuestion,
} from '../../domain/clientBrief'
import type { BriefAnswers } from '../../domain/types'
import { ProgressBar } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { BriefAnswersView } from '../../components/BriefAnswersView'
import { PortalFrame, PortalLoading, PortalMessage } from './Portal'
import { loadBrief, saveBrief, type BriefData } from './portalData'

/** Answers typed but not yet sent are kept on the client's phone, so a closed tab loses nothing. */
const draftKey = (token: string) => `landschaft-brief-draft:${token}`

function readDraft(token: string): BriefAnswers | null {
  try {
    const raw = localStorage.getItem(draftKey(token))
    return raw ? (JSON.parse(raw) as BriefAnswers) : null
  } catch {
    return null
  }
}

function writeDraft(token: string, answers: BriefAnswers | null) {
  try {
    if (answers) localStorage.setItem(draftKey(token), JSON.stringify(answers))
    else localStorage.removeItem(draftKey(token))
  } catch {
    // Private browsing or full storage: the form still works, only the draft is not kept.
  }
}

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })

/** The Landscape Requirement Checklist, filled in by the client through their link. */
export function ChecklistForm() {
  const { token = '' } = useParams()
  const [data, setData] = useState<BriefData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [answers, setAnswers] = useState<BriefAnswers>({})
  const [editing, setEditing] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    loadBrief(token).then(
      (loaded) => {
        if (!live) return
        setData(loaded)
        const draft = readDraft(token)
        setAnswers(draft ?? loaded.brief?.answers ?? prefill({ clientName: loaded.clientName, phone: loaded.clientPhone, siteLocation: loaded.siteLocation }))
        // Already sent and nothing half-changed since: show what was sent.
        setEditing(Boolean(draft) || !loaded.brief)
      },
      (e: Error) => live && setError(e.message),
    )
    return () => {
      live = false
    }
  }, [token])

  useEffect(() => {
    document.title = 'Landscape Requirement Checklist — Landschaft'
  }, [])

  if (error) return <PortalFrame><PortalMessage title="This checklist can't be opened" message={error} /></PortalFrame>
  if (!data) return <PortalFrame><PortalLoading /></PortalFrame>

  const change = (patch: BriefAnswers) => {
    const next = { ...answers, ...patch }
    setAnswers(next)
    setSaveError(null)
    writeDraft(token, next)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const clean = cleanAnswers(answers)
    if (briefProgress(clean).answered < 3) {
      return setSaveError('Answer a few more questions before sending — anything you are unsure of can be left blank.')
    }
    setSaving(true)
    setSaveError(null)
    try {
      const stamps = await saveBrief(token, clean)
      writeDraft(token, null)
      setData({ ...data, brief: { answers: clean, ...stamps } })
      setAnswers(clean)
      setEditing(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (failure) {
      setSaveError((failure as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const frame = {
    eyebrow: 'Landscape requirement checklist',
    title: data.projectName || 'Your garden',
    subtitle: data.siteLocation,
  }

  if (!editing && data.brief) {
    const name = String(data.brief.answers.clientName || data.clientName).trim().split(/\s+/)[0]
    return (
      <PortalFrame {...frame}>
        <section className="card px-5 py-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <Icon name="check" className="h-6 w-6" />
          </span>
          <h2 className="mt-3 font-display text-lg font-bold text-stone-900">Thank you{name ? `, ${name}` : ''}!</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-stone-600">
            Your answers have reached the Landschaft design team. You can come back to this link and change them at any time.
          </p>
          <p className="mt-2 text-xs text-stone-400">
            Sent {when(data.brief.submittedAt)}{data.brief.updatedAt !== data.brief.submittedAt && ` · last changed ${when(data.brief.updatedAt)}`}
          </p>
          <button onClick={() => setEditing(true)} className="btn-secondary mt-4">
            <Icon name="edit" className="h-4 w-4" /> Change my answers
          </button>
        </section>
        <section className="card mt-4 overflow-hidden">
          <h2 className="border-b border-stone-100 px-5 py-3.5 font-semibold text-stone-900">Your answers</h2>
          <BriefAnswersView answers={data.brief.answers} />
        </section>
      </PortalFrame>
    )
  }

  const { answered, asked } = briefProgress(answers)

  return (
    <PortalFrame {...frame}>
      <form onSubmit={submit}>
        <section className="card px-5 py-4">
          <p className="text-sm text-stone-600">
            Tell us about your family and how you'd like to use your garden, so the design starts from what matters to you.
            It takes about five minutes. Skip anything you're unsure of — we'll talk it through.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1"><ProgressBar value={asked ? (answered / asked) * 100 : 0} size="sm" /></div>
            <span className="text-xs font-semibold tabular-nums text-stone-500">{answered} of {asked} answered</span>
          </div>
        </section>

        {BRIEF_SECTIONS.map((section, i) => (
          <section key={section.title} className="card mt-4 overflow-hidden">
            <header className="border-b border-stone-100 px-5 py-3.5">
              <h2 className="font-semibold text-stone-900"><span className="text-brand-600">{i + 1}.</span> {section.title}</h2>
              {section.intro && <p className="mt-0.5 text-sm text-stone-500">{section.intro}</p>}
            </header>
            <div className="space-y-5 px-5 py-5">
              {section.questions.filter((q) => isAsked(q, answers)).map((q) => (
                <Question key={q.key} q={q} answers={answers} onChange={change} />
              ))}
            </div>
          </section>
        ))}

        <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t border-stone-200 bg-stone-50/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:backdrop-blur-none">
          {saveError && (
            <p role="alert" className="mb-2 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" /> {saveError}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center py-3 text-base disabled:opacity-60 sm:flex-none sm:px-8">
              <Icon name="send" className="h-4 w-4" /> {saving ? 'Sending…' : data.brief ? 'Save changes' : 'Send to Landschaft'}
            </button>
            {data.brief && (
              <button type="button" onClick={() => { setAnswers(data.brief!.answers); writeDraft(token, null); setEditing(false) }} className="btn-ghost">
                Cancel
              </button>
            )}
          </div>
        </div>
      </form>
    </PortalFrame>
  )
}

function Question({ q, answers, onChange }: { q: BriefQuestion; answers: BriefAnswers; onChange: (patch: BriefAnswers) => void }) {
  const value = answers[q.key]
  const id = `q-${q.key}`

  if (q.kind === 'one' || q.kind === 'many') {
    const options = q.other ? [...q.options, OTHER] : q.options
    const picked = q.kind === 'many' ? (Array.isArray(value) ? value : []) : typeof value === 'string' ? [value] : []
    const toggle = (option: string) => {
      if (q.kind === 'one') onChange({ [q.key]: picked.includes(option) ? '' : option })
      else onChange({ [q.key]: picked.includes(option) ? picked.filter((p) => p !== option) : [...picked, option] })
    }
    return (
      <fieldset>
        <legend className="text-sm font-medium text-stone-800">
          {q.label}
          {q.kind === 'many' && <span className="ml-1.5 text-xs font-normal text-stone-400">Tick all that apply</span>}
        </legend>
        <div className="mt-2 flex flex-wrap gap-2" role={q.kind === 'one' ? 'radiogroup' : 'group'}>
          {options.map((option) => {
            const on = picked.includes(option)
            return (
              <button
                key={option} type="button" onClick={() => toggle(option)}
                role={q.kind === 'one' ? 'radio' : 'checkbox'} aria-checked={on}
                className={`chip px-3 py-1.5 text-sm ${on ? 'chip-on' : ''}`}
              >
                {q.kind === 'many' && (
                  <span className={`flex h-4 w-4 items-center justify-center rounded border ${on ? 'border-white/70 bg-white/20' : 'border-stone-300 bg-white'}`}>
                    {on && <Icon name="check" className="h-3 w-3" />}
                  </span>
                )}
                {option}
              </button>
            )
          })}
        </div>
        {q.other && picked.includes(OTHER) && (
          <input
            className="input mt-2" placeholder="Please describe"
            value={String(answers[otherKey(q.key)] ?? '')}
            onChange={(e) => onChange({ [otherKey(q.key)]: e.target.value })}
            aria-label={`${q.label} — other`}
          />
        )}
      </fieldset>
    )
  }

  const text = typeof value === 'string' ? value : ''
  return (
    <label htmlFor={id} className="block">
      <span className="text-sm font-medium text-stone-800">{q.label}</span>
      {q.kind === 'textarea' ? (
        <textarea id={id} rows={3} className="input mt-1.5" value={text} placeholder={q.placeholder} onChange={(e) => onChange({ [q.key]: e.target.value })} />
      ) : (
        <input
          id={id} className="input mt-1.5" value={text} placeholder={q.placeholder}
          type={q.kind === 'tel' ? 'tel' : 'text'}
          inputMode={q.kind === 'number' ? 'numeric' : q.kind === 'tel' ? 'tel' : undefined}
          onChange={(e) => onChange({ [q.key]: e.target.value })}
        />
      )}
    </label>
  )
}
