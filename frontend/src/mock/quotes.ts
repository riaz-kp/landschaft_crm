import { addDays, today } from '../domain/format'
import { defaultDocumentSettings } from '../domain/documentDefaults'
import { defaultSections } from '../domain/quotation'
import type { AreaItem, PlantsCopy, Project, Quotation, QuoteArea, QuoteSection, ServiceLine } from '../domain/types'
import { plantsProjects } from './plants'
import { placeholderPlan } from './photos'

/**
 * The seeded BOQs and quotations, one or two per kind of project:
 *   design only → a BOQ with plans; execution only → a quotation without;
 *   design + execution → both, the quotation made from the BOQ; AMC only → a quotation of visits.
 * The Ashraf residence quotation is the company's own document, line for line,
 * so its totals can be checked against it (grand total ₹6,90,540).
 */

const docs = defaultDocumentSettings()

let serial = 0
const id = (prefix: string) => `${prefix}${(serial += 1)}`

function plantsFrom(name: string, fetchedOn: string): PlantsCopy {
  const source = plantsProjects.find((p) => p.name === name)!
  return {
    projectId: source.id, projectName: source.name, fetchedAt: `${fetchedOn}T05:30:00.000Z`,
    updatedAt: source.updatedAt, lines: structuredClone(source.lines),
  }
}

const item = (name: string, dimension: string | undefined, quantity: number, unit: string, rate?: number): AreaItem =>
  ({ id: id('ai'), item: name, dimension, quantity, unit, rate })

const area = (name: string, items: AreaItem[], withPlan: boolean): QuoteArea => {
  const areaId = id('ar')
  return { id: areaId, name, items, planImage: withPlan ? placeholderPlan(areaId, name) : undefined }
}

/** The company's three standard management lines, at these rates. */
const standardLines = (labour: number, soil: number, transport: number): ServiceLine[] =>
  docs.services.map((line, i) => ({ ...line, id: id('sl'), rate: [labour, soil, transport][i] ?? 0 }))

interface Seed extends Pick<Quotation, 'id' | 'kind' | 'number' | 'projectId' | 'clientId' | 'date' | 'status'> {
  services: Project['services']
  plants?: PlantsCopy
  areas?: QuoteArea[]
  lines?: ServiceLine[]
  sections?: Partial<Record<QuoteSection, boolean>>
  discount?: number
  mobilisationDays?: number
  executionDays?: number
}

function quote({ services, plants, areas = [], lines, sections, discount = 0, mobilisationDays, executionDays, ...base }: Seed): Quotation {
  return {
    ...base,
    letter: { ...docs.letters[base.kind] },
    intro: docs.intros[base.kind],
    sections: { ...defaultSections(base.kind, services), ...sections },
    plants,
    areas,
    servicesTitle: docs.servicesTitle,
    services: lines ?? (base.kind === 'Quotation' ? standardLines(0, 0, 0) : []),
    discount,
    terms: docs.terms.map((t) => ({ ...t })),
    procedure: docs.procedure.map((t) => ({ ...t })),
    procedureNote: docs.procedureNote,
    paymentStages: docs.paymentStages.map((s) => ({ ...s })),
    schedule: { ...docs.schedule, mobilisationDays, executionDays },
  }
}

const DESIGN = { design: true, execution: false }
const EXECUTION = { design: false, execution: true }
const BOTH = { design: true, execution: true }

// The resort's BOQ, and the quotation made from it with the same areas, plans and quantities.
const resortAreas = [
  area('Pool Deck', [item('Kota Stone', '2 x 2', 1800, 'Sqft'), item('Garden Edging', undefined, 240, 'Rft')], true),
  area('Arrival Plaza', [item('Granite Cobble', undefined, 650, 'Sqft'), item('Boulder', undefined, 12, 'Nos')], true),
  area('Beach Walk', [item('Wooden Deck', undefined, 420, 'Sqft'), item('River Pebbles', undefined, 300, 'Sqft')], true),
]
const resortRates: Record<string, number> = {
  'Kota Stone': 165, 'Garden Edging': 120, 'Granite Cobble': 210, Boulder: 2500, 'Wooden Deck': 850, 'River Pebbles': 60,
}
const pricedResortAreas = resortAreas.map((a) => ({
  ...a, id: id('ar'), items: a.items.map((i) => ({ ...i, id: id('ai'), rate: resortRates[i.item] })),
}))

export function seedQuotations(): Quotation[] {
  return [
    quote({
      id: 'q8', kind: 'Quotation', number: 'QT-2026-031', projectId: 'p10', clientId: 'c7', date: '2026-10-31', status: 'Sent',
      services: EXECUTION, plants: plantsFrom('Ashraf Residence', '2026-10-30'),
      areas: [area('Garden & Pathways', [
        item('Bangalore Stone', '1 x 4', 2283, 'Sqft', 140),
        item('Bangalore Cobble Black', undefined, 110, 'Sqft', 180),
        item('Kadappa Stone', '1 x 3', 180, 'Sqft', 90),
        item('Potato Stone', undefined, 18, 'Nos', 340),
      ], false)],
      lines: standardLines(30000, 5000, 8000),
    }),
    quote({
      id: 'q1', kind: 'BOQ', number: 'BOQ-2026-011', projectId: 'p1', clientId: 'c1', date: addDays(today(), -3), status: 'Draft',
      services: DESIGN, plants: plantsFrom('ABC Holdings Villa — Kowdiar', addDays(today(), -3)),
      areas: [
        area('Front Courtyard', [item('Bangalore Stone', '1 x 2', 640, 'Sqft'), item('Black Pebbles', undefined, 120, 'Sqft')], true),
        area('Entrance Pathway', [item('Kadappa Stone', '1 x 3', 210, 'Sqft'), item('Stepping Stone', '2 x 1', 24, 'Nos')], true),
        area('Back Lawn', [item('Natural Grass Lawn', undefined, 1450, 'Sqft'), item('Garden Edging', undefined, 180, 'Rft')], false),
      ],
    }),
    quote({
      id: 'q2', kind: 'Quotation', number: 'QT-2026-014', projectId: 'p2', clientId: 'c2', date: '2026-05-18', status: 'Accepted',
      services: EXECUTION, plants: plantsFrom('XYZ Estates Villa', '2026-05-16'),
      areas: [
        area('Driveway', [item('Bangalore Stone', '1 x 4', 900, 'Sqft', 140)], false),
        area('Garden Path', [item('Potato Stone', undefined, 40, 'Nos', 340), item('White Pebbles', undefined, 150, 'Sqft', 55)], false),
      ],
      lines: standardLines(30000, 6000, 9000), discount: 10000, mobilisationDays: 7, executionDays: 45,
    }),
    quote({
      id: 'q3', kind: 'BOQ', number: 'BOQ-2026-021', projectId: 'p6', clientId: 'c3', date: '2026-07-28', status: 'Sent',
      services: DESIGN, plants: plantsFrom('Kovalam Villa Concept', '2026-07-27'),
      areas: [area('Sit-out Garden', [item('Tandur Stone', '2 x 2', 380, 'Sqft'), item('White Pebbles', undefined, 60, 'Sqft')], true)],
    }),
    quote({
      // Not linked to the plants app yet: opening it shows the plants app's projects matched by name.
      id: 'q4', kind: 'Quotation', number: 'QT-2026-023', projectId: 'p8', clientId: 'c5', date: '2026-08-05', status: 'Draft',
      services: EXECUTION,
      areas: [area('Central Lawn', [item('Natural Grass Lawn', undefined, 5200, 'Sqft', 32), item('Garden Edging', undefined, 600, 'Rft')], false)],
      lines: standardLines(65000, 0, 0),
    }),
    quote({
      id: 'q5', kind: 'BOQ', number: 'BOQ-2026-009', projectId: 'p3', clientId: 'c3', date: '2026-04-05', status: 'Accepted',
      services: BOTH, plants: plantsFrom('DEF Resort — Kovalam', '2026-04-04'), areas: resortAreas,
    }),
    quote({
      id: 'q6', kind: 'Quotation', number: 'QT-2026-012', projectId: 'p3', clientId: 'c3', date: '2026-05-02', status: 'Accepted',
      services: BOTH, plants: plantsFrom('DEF Resort — Kovalam', '2026-05-01'), areas: pricedResortAreas,
      lines: standardLines(145000, 38000, 52000), mobilisationDays: 10, executionDays: 120,
    }),
    quote({
      id: 'q7', kind: 'Quotation', number: 'QT-2026-027', projectId: 'p9', clientId: 'c6', date: addDays(today(), -52), status: 'Accepted',
      services: { design: false, execution: false, amc: true },
      sections: { plants: false, hardscape: false, procedure: false },
      lines: [
        { id: id('sl'), title: 'Annual maintenance — monthly visits', description: 'Lawn mowing and edging, pruning, weeding, pest control and fertilising on each visit, with a visit report on the client link.', quantity: 12, unit: 'Visit', rate: 12500 },
        { id: id('sl'), title: 'Quarterly seasonal replanting', description: 'Seasonal flowering plants replaced in the podium beds every quarter.', quantity: 4, unit: 'Round', rate: 7500 },
      ],
    }),
  ]
}
