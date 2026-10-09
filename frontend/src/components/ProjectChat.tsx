import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { useDb } from '../state/useDb'
import { useSession } from '../state/session'
import { titleOf } from '../domain/roles'
import { addDays, formatDateLong, formatTime, today } from '../domain/format'
import { nameColour } from '../domain/chat'
import type { ID, ProjectMessage } from '../domain/types'
import { Avatar } from './ui'
import { Icon } from './Icon'
import { Lightbox } from './Lightbox'
import { compressImage } from './imageResize'

const QUICK_EMOJI = ['👍', '🙏', '✅', '👌', '🌿', '🚧', '⚠️', '📸', '😊', '🔥']

/** "Today", "Yesterday" or a date, for the day dividers in the thread. */
function dayLabel(iso: string): string {
  if (iso === today()) return 'Today'
  if (iso === addDays(today(), -1)) return 'Yesterday'
  return formatDateLong(iso)
}

/**
 * A project's remarks thread, laid out like a WhatsApp group: your messages
 * on the right in green, everyone else's on the left with their name, a
 * divider for each day, replies quoting the message they answer, and photos
 * compressed on the device before they are posted. Enter sends; Shift+Enter
 * starts a new line.
 */
export function ProjectChat({ projectId, height = 'h-[620px]' }: { projectId: ID; height?: string }) {
  const db = useDb()
  const { user, roleKey } = useSession()
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<ProjectMessage | null>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [emoji, setEmoji] = useState(false)
  const [viewing, setViewing] = useState<number | null>(null)
  const [flash, setFlash] = useState<ID | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const project = db.projects.find((p) => p.id === projectId)
  const messages = db.projectMessages
    .filter((m) => m.projectId === projectId)
    .sort((a, b) => a.at.localeCompare(b.at))
  const person = (id: ID) => db.employees.find((e) => e.id === id)
  const photos = messages.filter((m) => m.photo)

  // Everyone who can be expected in the thread: posters, the PM and the site's foremen.
  const members = [...new Set([
    ...messages.map((m) => m.authorId),
    project?.projectManagerId,
    ...db.siteAssignments.filter((a) => a.projectId === projectId).map((a) => a.foremanId),
  ].filter(Boolean) as ID[])]

  // Opening the thread marks it read; so does anything new arriving while it is open.
  useEffect(() => {
    api.projectChat.markRead(user.id, projectId)
  }, [messages.length, projectId, user.id])

  // Keep the newest message in view.
  useLayoutEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  // Grow the box with the message, up to a few lines.
  useLayoutEffect(() => {
    const el = input.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`
  }, [text])

  const send = () => {
    const body = text.trim()
    if (!body && !photo) return
    api.projectChat.post({ projectId, authorId: user.id, text: body, photo: photo ?? undefined, replyToId: replyTo?.id })
    setText('')
    setPhoto(null)
    setReplyTo(null)
    setEmoji(false)
    input.current?.focus()
  }

  const attach = async (file?: File) => {
    if (!file) return
    setBusy(true)
    try {
      setPhoto((await compressImage(file, db.settings.photoMaxPx, db.settings.photoMaxKb)).dataUrl)
    } finally {
      setBusy(false)
    }
  }

  const jumpTo = (id: ID) => {
    document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setFlash(id)
    setTimeout(() => setFlash(null), 1200)
  }

  const canDelete = (m: ProjectMessage) => m.authorId === user.id || roleKey === 'ceo' || roleKey === 'super_admin'

  let lastDay = ''

  return (
    <div className={`flex ${height} min-h-[420px] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-card`}>
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-stone-200 bg-[#f0f2f5] px-4 py-2.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
          <Icon name="chat" className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-stone-900">{project?.name ?? 'Project'} — Remarks</p>
          <p className="truncate text-xs text-stone-500">
            {members.map((id) => (id === user.id ? 'You' : person(id)?.name)).filter(Boolean).join(', ')}
          </p>
        </div>
        <div className="hidden -space-x-2 sm:flex">
          {members.slice(0, 5).map((id) => {
            const p = person(id)
            return p ? <Avatar key={id} name={p.name} size="sm" src={p.photo} /> : null
          })}
        </div>
      </header>

      {/* Thread */}
      <div
        ref={scroller}
        className="flex-1 space-y-1 overflow-y-auto px-3 py-4 sm:px-6"
        style={{
          backgroundColor: '#efeae2',
          backgroundImage: 'radial-gradient(rgba(27,56,41,0.06) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
        }}
      >
        {messages.length === 0 && (
          <div className="mx-auto mt-10 max-w-xs rounded-xl bg-[#fff5c4] px-4 py-3 text-center text-xs text-stone-600 shadow-sm">
            No remarks yet. Updates, questions and site notes for this project go here — everyone on the project sees them.
          </div>
        )}
        {messages.map((m, i) => {
          const mine = m.authorId === user.id
          const author = person(m.authorId)
          const day = m.at.slice(0, 10)
          const showDay = day !== lastDay
          lastDay = day
          const prev = messages[i - 1]
          // Consecutive messages from one person within a few minutes stack without repeating the name.
          const grouped = !showDay && prev?.authorId === m.authorId
          const quoted = m.replyToId ? messages.find((x) => x.id === m.replyToId) : undefined
          return (
            <Fragment key={m.id}>
              {showDay && (
                <div className="sticky top-0 z-10 flex justify-center py-2">
                  <span className="rounded-lg bg-white/95 px-3 py-1 text-[11px] font-medium text-stone-500 shadow-sm">{dayLabel(day)}</span>
                </div>
              )}
              <div id={`msg-${m.id}`} className={`group flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'} ${grouped ? '' : 'pt-2'}`}>
                {!mine && (
                  <span className="w-7 shrink-0">
                    {!grouped && author && <Avatar name={author.name} size="sm" src={author.photo} />}
                  </span>
                )}
                {mine && <MessageActions onReply={() => { setReplyTo(m); input.current?.focus() }} onDelete={canDelete(m) ? () => api.projectChat.remove(m.id) : undefined} />}
                <div
                  className={`relative max-w-[78%] rounded-xl px-2.5 pb-1.5 pt-1.5 text-sm shadow-sm transition sm:max-w-[65%] ${
                    mine ? 'bg-[#d9fdd3] text-stone-900' : 'bg-white text-stone-900'
                  } ${grouped ? '' : mine ? 'rounded-tr-sm' : 'rounded-tl-sm'} ${flash === m.id ? 'ring-2 ring-amber-400' : ''}`}
                >
                  {!mine && !grouped && (
                    <p className={`mb-0.5 text-xs font-semibold ${nameColour(m.authorId)}`}>
                      {author?.name ?? 'Former employee'}
                      {author && <span className="ml-1.5 font-normal text-stone-400">{titleOf(author)}</span>}
                    </p>
                  )}
                  {quoted && (
                    <button
                      type="button"
                      onClick={() => jumpTo(quoted.id)}
                      className={`mb-1 block w-full rounded-lg border-l-4 px-2 py-1 text-left text-xs ${mine ? 'border-brand-600 bg-brand-900/5' : 'border-sky-500 bg-stone-100'}`}
                    >
                      <span className={`block font-semibold ${nameColour(quoted.authorId)}`}>
                        {quoted.authorId === user.id ? 'You' : person(quoted.authorId)?.name}
                      </span>
                      <span className="line-clamp-2 text-stone-500">{quoted.text || '📷 Photo'}</span>
                    </button>
                  )}
                  {m.photo && (
                    <button type="button" onClick={() => setViewing(photos.indexOf(m))} className="mb-1 block overflow-hidden rounded-lg">
                      <img src={m.photo} alt="Attached" className="max-h-64 w-full object-cover" />
                    </button>
                  )}
                  {m.text && (
                    <p className="whitespace-pre-wrap break-words leading-snug">
                      {m.text}
                      {/* Room on the last line for the time, as WhatsApp leaves it. */}
                      <span aria-hidden className="inline-block h-3" style={{ width: mine ? 76 : 58 }} />
                    </p>
                  )}
                  <span className="absolute bottom-1 right-2 flex items-center gap-0.5 text-[10px] text-stone-500">
                    {formatTime(m.at.slice(11, 16)).replace(/^0/, '')}
                    {mine && <Icon name="checks" className="h-3.5 w-3.5 text-sky-500" />}
                  </span>
                </div>
                {!mine && <MessageActions onReply={() => { setReplyTo(m); input.current?.focus() }} onDelete={canDelete(m) ? () => api.projectChat.remove(m.id) : undefined} />}
              </div>
            </Fragment>
          )
        })}
      </div>

      {/* Composer */}
      <div className="border-t border-stone-200 bg-[#f0f2f5] px-3 py-2.5">
        {replyTo && (
          <div className="mb-2 flex items-start gap-2 rounded-lg border-l-4 border-brand-600 bg-white px-3 py-2">
            <div className="min-w-0 flex-1 text-xs">
              <p className={`font-semibold ${nameColour(replyTo.authorId)}`}>
                Replying to {replyTo.authorId === user.id ? 'yourself' : person(replyTo.authorId)?.name}
              </p>
              <p className="truncate text-stone-500">{replyTo.text || '📷 Photo'}</p>
            </div>
            <button onClick={() => setReplyTo(null)} className="btn-icon h-6 w-6" aria-label="Cancel reply"><Icon name="x" className="h-4 w-4" /></button>
          </div>
        )}
        {(photo || busy) && (
          <div className="mb-2 flex items-center gap-3 rounded-lg bg-white p-2">
            {busy ? (
              <span className="flex items-center gap-2 px-2 text-xs text-stone-500">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /> Compressing photo…
              </span>
            ) : (
              <>
                <img src={photo!} alt="To send" className="h-14 w-14 rounded-md object-cover" />
                <span className="flex-1 text-xs text-stone-500">Photo ready — add a caption or just send.</span>
                <button onClick={() => setPhoto(null)} className="btn-icon h-7 w-7" aria-label="Remove photo"><Icon name="x" className="h-4 w-4" /></button>
              </>
            )}
          </div>
        )}
        {emoji && (
          <div className="mb-2 flex flex-wrap gap-1 rounded-lg bg-white p-2">
            {QUICK_EMOJI.map((e) => (
              <button key={e} type="button" onClick={() => { setText(text + e); input.current?.focus() }} className="rounded-md px-1.5 py-1 text-lg hover:bg-stone-100">
                {e}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <div className="flex flex-1 items-end gap-1 rounded-3xl bg-white px-2 py-1 shadow-sm">
            <button type="button" onClick={() => setEmoji(!emoji)} className={`btn-icon h-9 w-9 shrink-0 rounded-full ${emoji ? 'text-brand-700' : ''}`} aria-label="Emoji">
              <Icon name="smile" className="h-5 w-5" />
            </button>
            <textarea
              ref={input}
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              placeholder="Type a remark"
              className="max-h-[132px] min-h-[36px] flex-1 resize-none border-0 bg-transparent px-1 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-0"
              aria-label="Remark"
            />
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { attach(e.target.files?.[0]); e.target.value = '' }} />
            <button type="button" onClick={() => fileRef.current?.click()} className="btn-icon h-9 w-9 shrink-0 rounded-full" aria-label="Attach photo">
              <Icon name="camera" className="h-5 w-5" />
            </button>
          </div>
          <button
            type="button"
            onClick={send}
            disabled={(!text.trim() && !photo) || busy}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white shadow-md transition hover:bg-brand-700 disabled:opacity-40"
            aria-label="Send"
          >
            <Icon name="send" className="h-5 w-5" />
          </button>
        </div>
      </div>

      {viewing !== null && (
        <Lightbox
          photos={photos.map((m) => ({ src: m.photo!, title: m.text || 'Photo', sub: `${person(m.authorId)?.name ?? ''} · ${dayLabel(m.at.slice(0, 10))} ${formatTime(m.at.slice(11, 16))}` }))}
          index={viewing}
          onIndex={setViewing}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  )
}

function MessageActions({ onReply, onDelete }: { onReply: () => void; onDelete?: () => void }) {
  return (
    <span className="mb-1 flex shrink-0 gap-0.5 opacity-60 transition sm:opacity-0 sm:group-hover:opacity-100">
      <button type="button" onClick={onReply} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-stone-500 shadow-sm hover:text-brand-700" aria-label="Reply">
        <Icon name="reply" className="h-3.5 w-3.5" />
      </button>
      {onDelete && (
        <button type="button" onClick={onDelete} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-stone-500 shadow-sm hover:text-red-600" aria-label="Delete">
          <Icon name="trash" className="h-3.5 w-3.5" />
        </button>
      )}
    </span>
  )
}
