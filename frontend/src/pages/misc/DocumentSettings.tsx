import { useState, type ReactNode } from 'react'
import { Field, Section } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { defaultDocumentSettings } from '../../domain/documentDefaults'
import { blankService } from '../../domain/quotation'
import type { CommercialDoc, DocumentSettings, ServiceLine } from '../../domain/types'
import { PaymentStagesEditor, ServicesEditor, TitledListEditor } from '../quotations/editors'

/** One collapsible group of settings, so the section stays short until something is opened. */
function Group({ title, hint, children, open: startOpen = false }: { title: string; hint: string; children: ReactNode; open?: boolean }) {
  const [open, setOpen] = useState(startOpen)
  return (
    <div className="border-t border-stone-100 first:border-t-0">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-stone-50">
        <span>
          <span className="block text-sm font-semibold text-stone-900">{title}</span>
          <span className="block text-xs text-stone-500">{hint}</span>
        </span>
        <Icon name="chevron" className={`h-4 w-4 shrink-0 text-stone-400 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  )
}

/**
 * Company details and the wording every new BOQ and quotation starts from.
 * Each document keeps its own copy, so changing these leaves documents already made as they are.
 */
export function DocumentSettingsSection({ value, onChange, disabled }: { value: DocumentSettings; onChange: (next: DocumentSettings) => void; disabled?: boolean }) {
  const set = (patch: Partial<DocumentSettings>) => onChange({ ...value, ...patch })
  const letter = (kind: CommercialDoc, field: 'greeting' | 'body' | 'signOff', text: string) =>
    set({ letters: { ...value.letters, [kind]: { ...value.letters[kind], [field]: text } } })
  const services: ServiceLine[] = value.services.map((s, i) => ({ ...s, id: `default-${i}` }))
  const defaults = defaultDocumentSettings()

  return (
    <Section
      title="BOQ & Quotation Documents"
      description="Company details and the wording each new BOQ and quotation starts with. A document keeps its own copy, so changes here apply to documents made from now on."
      className="mb-6"
    >
      <Group title="Company & bank details" hint="On every page footer, and the bank details on quotations." open>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company name"><input className="input" disabled={disabled} value={value.company.name} onChange={(e) => set({ company: { ...value.company, name: e.target.value } })} /></Field>
          <Field label="Tagline"><input className="input" disabled={disabled} value={value.company.tagline} onChange={(e) => set({ company: { ...value.company, tagline: e.target.value } })} /></Field>
          <Field label="Offices"><input className="input" disabled={disabled} value={value.company.offices} onChange={(e) => set({ company: { ...value.company, offices: e.target.value } })} /></Field>
          <Field label="Phone"><input className="input" disabled={disabled} value={value.company.phone} onChange={(e) => set({ company: { ...value.company, phone: e.target.value } })} /></Field>
          <Field label="Email"><input className="input" disabled={disabled} value={value.company.email} onChange={(e) => set({ company: { ...value.company, email: e.target.value } })} /></Field>
        </div>
        <div className="mt-4 grid gap-4 rounded-xl bg-stone-50 p-4 sm:grid-cols-2">
          <Field label="Account name"><input className="input" disabled={disabled} value={value.bank.accountName} onChange={(e) => set({ bank: { ...value.bank, accountName: e.target.value } })} /></Field>
          <Field label="Bank"><input className="input" disabled={disabled} value={value.bank.bankName} onChange={(e) => set({ bank: { ...value.bank, bankName: e.target.value } })} /></Field>
          <Field label="Account number"><input className="input" disabled={disabled} value={value.bank.accountNumber} onChange={(e) => set({ bank: { ...value.bank, accountNumber: e.target.value } })} /></Field>
          <Field label="IFSC code"><input className="input" disabled={disabled} value={value.bank.ifsc} onChange={(e) => set({ bank: { ...value.bank, ifsc: e.target.value } })} /></Field>
        </div>
      </Group>

      <Group title="Cover letter & introduction" hint="The letter on the cover page and the line under the Bill of Quantities heading, for each kind of document.">
        <div className="grid gap-6 lg:grid-cols-2">
          {(['Quotation', 'BOQ'] as const).map((kind) => (
            <div key={kind} className="space-y-3">
              <p className="text-sm font-semibold text-stone-900">{kind === 'BOQ' ? 'BOQ' : 'Quotation'}</p>
              <Field label="Greeting"><input className="input" disabled={disabled} value={value.letters[kind].greeting} onChange={(e) => letter(kind, 'greeting', e.target.value)} /></Field>
              <Field label="Letter" hint="A blank line starts a new paragraph.">
                <textarea className="input min-h-[150px] resize-y" disabled={disabled} value={value.letters[kind].body} onChange={(e) => letter(kind, 'body', e.target.value)} />
              </Field>
              <Field label="Signed"><input className="input" disabled={disabled} value={value.letters[kind].signOff} onChange={(e) => letter(kind, 'signOff', e.target.value)} /></Field>
              <Field label="Under the Bill of Quantities heading">
                <textarea className="input min-h-[64px] resize-y" disabled={disabled} value={value.intros[kind]} onChange={(e) => set({ intros: { ...value.intros, [kind]: e.target.value } })} />
              </Field>
              <Field label="Client acceptance">
                <textarea className="input min-h-[64px] resize-y" disabled={disabled} value={value.acceptance[kind]} onChange={(e) => set({ acceptance: { ...value.acceptance, [kind]: e.target.value } })} />
              </Field>
            </div>
          ))}
        </div>
      </Group>

      <Group title="Project management lines" hint="The labour, soil preparation and logistics lines a new quotation starts with, without rates.">
        <Field label="Section heading">
          <input className="input" disabled={disabled} value={value.servicesTitle} onChange={(e) => set({ servicesTitle: e.target.value })} />
        </Field>
        <div className="mt-4">
          <ServicesEditor
            lines={services} priced={false} disabled={disabled} blank={blankService}
            onChange={(lines) => set({ services: lines.map(({ id: _id, ...line }) => ({ ...line, rate: 0 })) })}
          />
        </div>
      </Group>

      <Group title="Payment schedule" hint="Stages of payment on a new quotation, as shares of the grand total. Must total 100%.">
        <PaymentStagesEditor
          stages={value.paymentStages} disabled={disabled}
          onChange={(paymentStages) => set({ paymentStages })}
          onReset={() => set({ paymentStages: defaults.paymentStages })}
        />
      </Group>

      <Group title="Terms / project-specific notes" hint={`${value.terms.length} terms on a new quotation.`}>
        <TitledListEditor
          items={value.terms} disabled={disabled} noun="Term" addLabel="Add a term"
          titlePlaceholder="e.g. Site Readiness" textPlaceholder="What it says" onChange={(terms) => set({ terms })}
        />
      </Group>

      <Group title="Scope and work procedure" hint={`${value.procedure.length} steps, and the note under them.`}>
        <TitledListEditor
          items={value.procedure} disabled={disabled} noun="Step" addLabel="Add a step"
          titlePlaceholder="e.g. Site Preparation" textPlaceholder="What happens in this step" onChange={(procedure) => set({ procedure })}
        />
        <div className="mt-4">
          <Field label="Note under the steps">
            <textarea className="input min-h-[56px] resize-y" disabled={disabled} value={value.procedureNote} onChange={(e) => set({ procedureNote: e.target.value })} />
          </Field>
        </div>
      </Group>

      <Group title="Work schedule & plants app" hint="Default validity, maintenance and billing wording, and where the plants app lives.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Quotation validity"><input className="input" disabled={disabled} value={value.schedule.validity} onChange={(e) => set({ schedule: { ...value.schedule, validity: e.target.value } })} /></Field>
          <Field label="Maintenance period"><input className="input" disabled={disabled} value={value.schedule.maintenance} onChange={(e) => set({ schedule: { ...value.schedule, maintenance: e.target.value } })} /></Field>
          <div className="sm:col-span-2">
            <Field label="Billing basis"><input className="input" disabled={disabled} value={value.schedule.billing} onChange={(e) => set({ schedule: { ...value.schedule, billing: e.target.value } })} /></Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Plants app address" hint="Used for “Open in plants app” links. Plant lists themselves are read through the server.">
              <input className="input" disabled={disabled} value={value.plantsAppUrl} onChange={(e) => set({ plantsAppUrl: e.target.value })} />
            </Field>
          </div>
        </div>
      </Group>
    </Section>
  )
}
