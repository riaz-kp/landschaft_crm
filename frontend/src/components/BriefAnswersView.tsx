import { BRIEF_SECTIONS, answerText, isAsked } from '../domain/clientBrief'
import type { BriefAnswers } from '../domain/types'

/**
 * A filled requirement checklist, section by section. Unanswered questions
 * are shown as such, so the team can see what to ask about on the next call.
 */
export function BriefAnswersView({ answers, hideEmpty = false }: { answers: BriefAnswers; hideEmpty?: boolean }) {
  return (
    <div className="divide-y divide-stone-100">
      {BRIEF_SECTIONS.map((section, i) => {
        const questions = section.questions.filter((q) => isAsked(q, answers) && (!hideEmpty || answerText(q, answers)))
        if (!questions.length) return null
        return (
          <section key={section.title} className="px-5 py-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">{i + 1}. {section.title}</h3>
            <dl className="mt-2.5 grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {questions.map((q) => {
                const text = answerText(q, answers)
                return (
                  <div key={q.key} className={q.kind === 'textarea' ? 'sm:col-span-2' : ''}>
                    <dt className="text-xs text-stone-500">{q.label}</dt>
                    <dd className={`mt-0.5 whitespace-pre-line text-sm ${text ? 'font-medium text-stone-900' : 'italic text-stone-300'}`}>
                      {text || 'Not answered'}
                    </dd>
                  </div>
                )
              })}
            </dl>
          </section>
        )
      })}
    </div>
  )
}
