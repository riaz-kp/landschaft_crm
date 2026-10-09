import type { ID, ProjectMessage } from './types'

/** Messages others have posted on a project since the person last opened its remarks. */
export function unreadRemarks(
  messages: ProjectMessage[], reads: Record<string, string>, personId: ID, projectId: ID,
): number {
  const seen = reads[`${personId}:${projectId}`] ?? ''
  return messages.filter((m) => m.projectId === projectId && m.authorId !== personId && m.at > seen).length
}

/** A stable colour per person for names in the chat, as WhatsApp groups do. */
const NAME_COLOURS = ['text-sky-700', 'text-violet-700', 'text-rose-700', 'text-amber-700', 'text-teal-700', 'text-fuchsia-700', 'text-orange-700', 'text-indigo-700']

export function nameColour(id: ID): string {
  return NAME_COLOURS[[...id].reduce((s, c) => s + c.charCodeAt(0), 0) % NAME_COLOURS.length]
}
