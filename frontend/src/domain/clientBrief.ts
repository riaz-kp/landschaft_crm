import type { BriefAnswers, ClientBrief } from './types'

/**
 * The Landscape Requirement Checklist the client fills in through their link —
 * the questions of the team's paper "Client-Side Information" form, section by
 * section. The portal form and the project's Client Checklist tab both render
 * from this list, so a question added here shows up in both.
 */

type Base = {
  /** Where the answer is kept in BriefAnswers. Never rename a key once answers exist. */
  key: string
  label: string
  /** Asked only when another answer is a given value — "If yes, is any pet space required?" */
  showIf?: { key: string; is: string }
}

export type BriefQuestion = Base & (
  | { kind: 'text' | 'tel' | 'number' | 'textarea'; placeholder?: string }
  /** Pick one. With `other`, "Other" opens a text box kept under `${key}Other`. */
  | { kind: 'one'; options: string[]; other?: boolean }
  /** Tick any. With `other`, "Other" opens a text box kept under `${key}Other`. */
  | { kind: 'many'; options: string[]; other?: boolean }
)

export interface BriefSection {
  title: string
  intro?: string
  questions: BriefQuestion[]
}

const YES_NO = ['Yes', 'No']
const YES_NO_MAYBE = ['Yes', 'No', 'Maybe']
export const OTHER = 'Other'

export const BRIEF_SECTIONS: BriefSection[] = [
  {
    title: 'Client Details',
    questions: [
      { key: 'clientName', label: 'Client name', kind: 'text' },
      { key: 'clientName2', label: '& (spouse / co-owner)', kind: 'text' },
      { key: 'profession', label: 'Profession', kind: 'text' },
      { key: 'projectLocation', label: 'Project location', kind: 'text' },
      { key: 'contactNumber', label: 'Contact number', kind: 'tel' },
    ],
  },
  {
    title: 'Family & User Details',
    questions: [
      { key: 'familyMembers', label: 'Number of family members', kind: 'number' },
      { key: 'residence', label: 'How will the home be used?', kind: 'one', options: ['Will stay here', 'NRI', 'Weekend home'] },
      { key: 'ageGroups', label: 'Age group of users', kind: 'many', options: ['Children', 'Teens', 'Adults', 'Elders'] },
      { key: 'elderlyAccess', label: 'Any elderly-friendly access required?', kind: 'one', options: YES_NO },
      { key: 'pets', label: 'Pets at home?', kind: 'one', options: YES_NO },
      {
        key: 'petSpace', label: 'Is any pet space required?', kind: 'one',
        options: ['Dog kennel', 'Pet cage', 'Open area', 'Not required'], showIf: { key: 'pets', is: 'Yes' },
      },
    ],
  },
  {
    title: 'Garden Usage',
    questions: [
      {
        key: 'usage', label: 'How do you wish to use the outdoor space?', kind: 'many', other: true,
        options: [
          'Daily relaxation', 'Family gathering', 'Guest / event hosting', 'Outdoor dining / BBQ',
          'Meditation / quiet corner', 'Photo spot / feature area', "Children's play area",
        ],
      },
      { key: 'gatheringSize', label: 'Approximate number of people during gatherings / events', kind: 'text', placeholder: 'e.g. 20–30' },
      { key: 'usageTime', label: 'Main usage time', kind: 'many', options: ['Morning', 'Evening', 'Night', 'Weekends', 'Daily'] },
    ],
  },
  {
    title: 'Children & Elderly Requirements',
    questions: [
      { key: 'playArea', label: "Is a children's play area required?", kind: 'one', options: YES_NO },
      {
        key: 'playType', label: 'Preferred play type', kind: 'many', other: true,
        options: ['Lawn play', 'Swings', 'Sand pit', 'Cycling space'], showIf: { key: 'playArea', is: 'Yes' },
      },
      {
        key: 'elderlyNeeds', label: 'Elderly-friendly requirements', kind: 'many',
        options: ['Shaded seating', 'Easy walking path', 'Non-slippery surface', 'Ramp / easy access', 'Handrail support'],
      },
    ],
  },
  {
    title: 'Required Landscape Spaces',
    intro: 'Please select the spaces required.',
    questions: [
      {
        key: 'spaces', label: 'Spaces required', kind: 'many', other: true,
        options: [
          'Lawn', 'Seating area', 'Outdoor dining', 'Pathways', 'Parking', 'Planters / pots',
          'Water feature', 'Stage / event space', 'Service / utility area',
        ],
      },
    ],
  },
  {
    title: 'Design Preference',
    questions: [
      {
        key: 'style', label: 'Preferred landscape style / theme', kind: 'many', other: true,
        options: ['Tropical', 'Kerala traditional', 'Modern minimal', 'Mediterranean', 'Natural / forest feel'],
      },
      { key: 'preferredPlants', label: 'Any specific plants or trees preferred?', kind: 'textarea' },
      { key: 'significantPlants', label: 'Any existing tree / plant with personal, cultural or family importance?', kind: 'textarea' },
      { key: 'waterFeature', label: 'Is a water feature desired?', kind: 'one', options: YES_NO_MAYBE },
    ],
  },
  {
    title: 'Privacy, Lighting & Comfort',
    questions: [
      { key: 'privacy', label: 'Is privacy required from the road / neighbours?', kind: 'one', options: YES_NO_MAYBE },
      { key: 'lighting', label: 'Garden lighting required?', kind: 'one', options: YES_NO_MAYBE },
      {
        key: 'lightingTypes', label: 'Preferred lighting type', kind: 'many',
        options: ['Pathway lighting', 'Mood lighting', 'Feature lighting', 'Seating area lighting', 'Not sure'],
      },
    ],
  },
  {
    title: 'Water & Maintenance',
    questions: [
      { key: 'waterSource', label: 'Water source available for the garden', kind: 'one', other: true, options: ['Well', 'Borewell', 'Municipality'] },
      { key: 'maintenanceLevel', label: 'Preferred maintenance level', kind: 'one', options: ['Low', 'Medium', 'High'] },
      {
        key: 'maintainedBy', label: 'Who will maintain the garden after completion?', kind: 'one',
        options: ['Client', 'Gardener', 'Landschaft maintenance team', 'Not decided'],
      },
    ],
  },
  {
    title: 'Budget & Execution Preference',
    questions: [
      { key: 'budget', label: 'Approximate landscape budget range', kind: 'text', placeholder: 'e.g. ₹5–8 lakh' },
      {
        key: 'execution', label: 'Execution preference', kind: 'one',
        options: ['Full execution together', 'Phase-wise execution', 'Not decided'],
      },
    ],
  },
  {
    title: 'Additional Notes',
    questions: [
      { key: 'notes', label: 'Any special requirements, concerns or ideas', kind: 'textarea' },
    ],
  },
]

const ALL_QUESTIONS = BRIEF_SECTIONS.flatMap((s) => s.questions)

export const otherKey = (key: string) => `${key}Other`

/** Whether a question applies, given the answers so far. */
export function isAsked(q: BriefQuestion, answers: BriefAnswers): boolean {
  return !q.showIf || answers[q.showIf.key] === q.showIf.is
}

/** An answer as one line of text — "Lawn, Pathways, Other: koi pond" — or '' when unanswered. */
export function answerText(q: BriefQuestion, answers: BriefAnswers): string {
  const value = answers[q.key]
  const other = String(answers[otherKey(q.key)] ?? '').trim()
  if (q.kind === 'many') {
    const picked = Array.isArray(value) ? value : []
    return picked.map((v) => (v === OTHER && other ? `${OTHER}: ${other}` : v)).join(', ')
  }
  const text = typeof value === 'string' ? value.trim() : ''
  return text === OTHER && other ? `${OTHER}: ${other}` : text
}

/** How many of the questions that apply have an answer. */
export function briefProgress(answers: BriefAnswers): { answered: number; asked: number } {
  const asked = ALL_QUESTIONS.filter((q) => isAsked(q, answers))
  return { answered: asked.filter((q) => answerText(q, answers)).length, asked: asked.length }
}

/**
 * Answers ready to save: blanks dropped, follow-ups whose condition no longer
 * holds cleared, and "Other" text kept only while Other is picked.
 */
export function cleanAnswers(answers: BriefAnswers): BriefAnswers {
  const out: BriefAnswers = {}
  for (const q of ALL_QUESTIONS) {
    if (!isAsked(q, answers)) continue
    const value = answers[q.key]
    if (Array.isArray(value)) {
      const picked = value.filter((v) => q.kind === 'many' && (q.options.includes(v) || (q.other && v === OTHER)))
      if (picked.length) out[q.key] = picked
    } else if (typeof value === 'string' && value.trim()) {
      out[q.key] = value.trim()
    }
    const picked = out[q.key]
    const hasOther = Array.isArray(picked) ? picked.includes(OTHER) : picked === OTHER
    const other = answers[otherKey(q.key)]
    if (hasOther && typeof other === 'string' && other.trim()) out[otherKey(q.key)] = other.trim()
  }
  return out
}

/** A starting point for a client opening the checklist for the first time: what we already know. */
export function prefill(details: { clientName?: string; phone?: string; siteLocation?: string }): BriefAnswers {
  const out: BriefAnswers = {}
  if (details.clientName) out.clientName = details.clientName
  if (details.phone) out.contactNumber = details.phone
  if (details.siteLocation) out.projectLocation = details.siteLocation
  return out
}

export const briefFor = (briefs: ClientBrief[], projectId: string) => briefs.find((b) => b.projectId === projectId)
