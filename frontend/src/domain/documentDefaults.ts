import type { DocumentSettings } from './types'

const WELCOME = 'Thank you for considering Landschaft as your landscape consultancy partner. We appreciate the opportunity '
  + 'to collaborate on your project and are committed to delivering innovative, sustainable, and functional landscape '
  + 'solutions tailored to your requirements.'

/**
 * What BOQs and quotations start from: the company's own quotation (the
 * Ashraf residence quotation) word for word, with a BOQ version of the parts
 * that talk about prices. Changed from Settings → BOQ & Quotation Documents.
 */
export function defaultDocumentSettings(): DocumentSettings {
  return {
    company: {
      name: 'Landschaft',
      tagline: 'environmental planners',
      offices: 'Calicut | Malappuram',
      phone: '+91 9645 333 700',
      email: 'teamlandschaft@gmail.com',
    },
    bank: {
      accountName: 'LANDSCHAFT',
      bankName: 'Federal Bank',
      accountNumber: '2515 0200 0037 66',
      ifsc: 'FDRL0002515',
    },
    letters: {
      Quotation: {
        greeting: 'Dear Sir,',
        body: [
          WELCOME,
          'The attached statement describes the scope of work, our cost for the services, and any additional '
            + 'arrangements. We are pleased to submit our lowest offer as per your requirement.',
          'Please confirm the work order to indicate your agreement with these arrangements and inform us back at '
            + 'your earliest convenience. We shall proceed with the assignment upon your confirmation of the same.',
        ].join('\n\n'),
        signOff: 'Team Landschaft.',
      },
      BOQ: {
        greeting: 'Dear Sir,',
        body: [
          WELCOME,
          'The attached Bill of Quantities sets out, area by area, the plants, stones and other items of the proposed '
            + 'design with their sizes, quantities and units, together with the plan of each area.',
          'Please review the quantities and let us know of any changes at your earliest convenience. We shall be '
            + 'glad to take the work forward upon your confirmation.',
        ].join('\n\n'),
        signOff: 'Team Landschaft.',
      },
    },
    intros: {
      Quotation: 'We are pleased to submit the following Bill of Quantities for the proposed landscape works. The rates '
        + 'are based on the approved scope, specifications, and available site information.',
      BOQ: 'We are pleased to submit the following Bill of Quantities for the proposed landscape works. The quantities '
        + 'are based on the approved design, specifications, and available site information.',
    },
    servicesTitle: 'Project Management, Planting, Soil Preparation & Logistics',
    services: [
      {
        title: 'Planting Labour, Management & Supervision',
        description: 'Includes setting out; pit/bed preparation; planting, staking and initial watering; site supervision, '
          + 'coordination, labour welfare and garden tools. Plant supply and long-term maintenance are excluded unless '
          + 'specifically included.',
        quantity: 1, unit: 'LS', rate: 0,
      },
      {
        title: 'Manure / Potting Mix Preparation',
        description: 'Supply, proportioning, mixing and filling of an approved planting medium using fine red earth / '
          + 'garden soil, cocopeat, vermicompost or organic manure, sawdust, perlite and Trichoderma as required. Includes '
          + 'loading, on-site mixing, filling, labour and supervision.',
        quantity: 1, unit: 'LS', rate: 0,
      },
      {
        title: 'Transportation & Handling',
        description: 'Includes loading from nursery or vendor points, transportation to site, unloading coordination, '
          + 'temporary nursery arrangement and internal shifting of plants, trees, lawn and related materials. Crane, '
          + 'vehicle, manpower and number of loads shall be quoted as required for the project.',
        quantity: 1, unit: 'LS', rate: 0,
      },
    ],
    terms: [
      { title: 'Scope of Work', text: 'Only the items, quantities and specifications mentioned in the approved quotation or BOQ are included. Any additional or revised work will be charged separately.' },
      { title: 'Quotation Basis and Quantities', text: 'This quotation is based on the available drawings, sketches, site details and discussions. Quantities or specifications may change after final site measurement or design approval.' },
      { title: 'Excluded Works', text: 'Red earth supply, major soil filling, site clearing, major levelling, baby metal filling, civil works and underground services are excluded unless specifically mentioned in the BOQ.' },
      { title: 'Site Readiness', text: 'The client shall provide clear site access and ensure that debris removal, required levels, clearances and related works are completed before landscape work begins.' },
      { title: 'Water, Electricity and Storage', text: 'The client shall provide suitable water, electricity and a secure space for storing tools and materials during execution.' },
      { title: 'Labour Accommodation', text: 'If accommodation is required for the labour team, a suitable facility shall be arranged by the client. If arranged by Landschaft, the related cost will be charged separately.' },
      { title: 'Plant and Material Availability', text: 'Plants and natural materials may have minor variations in size, colour, texture and shape. Any plant substitution will be carried out only after approval.' },
      { title: 'Transportation and Unloading', text: 'Transportation and normal unloading are included only as mentioned in the BOQ. Additional crane, union, waiting, restricted-access or repeated-handling charges will be billed separately.' },
      { title: 'Cleaning and Waste Disposal', text: 'Routine cleaning of the work area is included. Final pressure washing, deep cleaning, bulk debris removal and off-site waste disposal are under the client’s scope. Planting waste will be kept at a location identified by the client within the site.' },
      { title: 'Protection of Completed Work', text: 'The client and other contractors shall protect completed landscape areas from cement, paint, tile cutting, vehicles and other damage. Repairs caused by others will be charged separately.' },
      { title: 'Hardscape Curing', text: 'Where hardscape work is included, sufficient curing time must be provided. Vehicle movement and heavy loading are not permitted during the curing period.' },
      { title: 'Additional Work', text: 'Any additional or revised work must be approved before execution. Related labour, transportation, accommodation and food expenses, where applicable, will be charged separately. Extra-work payments shall be settled weekly.' },
      { title: 'Maintenance', text: 'One month of free routine maintenance is included from the date of handover, unless otherwise stated. Replacement due to water shortage, pests, animals, extreme weather, misuse or damage by others is excluded.' },
      { title: 'Payment and Timeline', text: 'Payments shall follow the agreed schedule. Delays in payment, approvals, site readiness, weather, access or material availability may affect the completion date.' },
      { title: 'Validity and Acceptance', text: 'This quotation is valid for 10 days from the date of submission. Work-order confirmation or advance payment will be considered acceptance of the quotation and these terms.' },
    ],
    procedure: [
      { title: 'Work-Order Confirmation', text: 'Confirmation of the quotation, work order and advance payment.' },
      { title: 'Site Assessment', text: 'Detailed site assessment and verification of quantities.' },
      { title: 'Site Preparation', text: 'Minor landscape levelling and preparation within the quoted scope.' },
      { title: 'Hardscape Works', text: 'Execution of hardscape and related works, where included.' },
      { title: 'Softscape Works', text: 'Planting, lawn installation and other softscape works.' },
      { title: 'Finishing and Handover', text: 'Final finishing, handover and commencement of the included maintenance period.' },
    ],
    procedureNote: 'Sufficient time, clear access and a proper working area must be provided at the appropriate stage of the project to achieve the best landscape result.',
    paymentStages: [
      { label: 'Advance on confirmation / work order', percent: 50 },
      { label: 'On mobilisation / material delivery', percent: 20 },
      { label: 'On 50% work completion', percent: 20 },
      { label: 'Before final plant / lawn delivery', percent: 5 },
      { label: 'On completion and handover', percent: 5 },
    ],
    schedule: {
      validity: '10 days from the date of submission',
      maintenance: 'Only if specifically stated on cover / scope; otherwise excluded',
      billing: 'Quoted quantity or actual measured quantity, as stated against each item',
    },
    acceptance: {
      Quotation: 'We confirm that we have reviewed this quotation, BOQ, payment schedule and applicable terms and conditions, '
        + 'and authorise Landschaft to proceed subject to written work order and agreed advance.',
      BOQ: 'We confirm that we have reviewed this Bill of Quantities, including the plan, items and quantities for each '
        + 'area, and approve it as the basis for the landscape works.',
    },
    plantsAppUrl: 'https://plants.landschaft.in',
  }
}

/**
 * Document settings as stored, brought up to date: anything added since they
 * were saved starts from the defaults.
 */
export function normalizeDocumentSettings(stored?: Partial<DocumentSettings> | null): DocumentSettings {
  const defaults = defaultDocumentSettings()
  if (!stored) return defaults
  return {
    ...defaults,
    ...stored,
    company: { ...defaults.company, ...stored.company },
    bank: { ...defaults.bank, ...stored.bank },
    letters: {
      Quotation: { ...defaults.letters.Quotation, ...stored.letters?.Quotation },
      BOQ: { ...defaults.letters.BOQ, ...stored.letters?.BOQ },
    },
    intros: { ...defaults.intros, ...stored.intros },
    schedule: { ...defaults.schedule, ...stored.schedule },
    acceptance: { ...defaults.acceptance, ...stored.acceptance },
  }
}
