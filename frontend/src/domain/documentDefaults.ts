import type { DocumentSettings, ScopeDefaults } from './types'

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
      Scope: {
        greeting: 'Dear Sir,',
        body: [
          WELCOME,
          'Our scope of services is designed to provide end-to-end support - from site analysis and concept planning to '
            + 'detailed design, project coordination, and post-completion guidance. By integrating creativity with technical '
            + 'expertise, we aim to enhance the beauty, usability, and long-term value of your property.',
          'Enclosed is the detailed Scope of Work, Work Schedule, and Fee Structure for your review. We request you to kindly '
            + 'confirm the work order at your earliest convenience so that we may proceed with the assignment.',
        ].join('\n\n'),
        signOff: 'Team Landschaft.',
      },
    },
    intros: {
      Quotation: 'We are pleased to submit the following Bill of Quantities for the proposed landscape works. The rates '
        + 'are based on the approved scope, specifications, and available site information.',
      BOQ: 'We are pleased to submit the following Bill of Quantities for the proposed landscape works. The quantities '
        + 'are based on the approved design, specifications, and available site information.',
      Scope: '',
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
      Scope: 'We confirm that we have reviewed this scope of services, work schedule, fee structure and the terms and conditions, '
        + 'and authorise Landschaft to proceed with the consultancy on the agreed advance.',
    },
    scope: defaultScope(),
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
      Scope: { ...defaults.letters.Scope, ...stored.letters?.Scope },
    },
    intros: { ...defaults.intros, ...stored.intros },
    schedule: { ...defaults.schedule, ...stored.schedule },
    acceptance: { ...defaults.acceptance, ...stored.acceptance },
    scope: {
      ...defaults.scope,
      ...stored.scope,
      visits: { ...defaults.scope.visits, ...stored.scope?.visits },
    },
  }
}

/**
 * What a new Scope of Services & Fee Proposal starts with: the company's own
 * proposal (Mr. Mahesh, Apartment, Ernakulam, November 2026) word for word,
 * without its fee, which is set on each proposal.
 */
export function defaultScope(): ScopeDefaults {
  return {
    subject: 'Landscape Consultancy',
    services: [
      {
        title: 'Site Appraisal & Analysis',
        points: [
          'Preliminary site inspection and documentation.',
          'Collection of topographical and dimensional data.',
          'Soil quality assessment (composition, nutrients, and pH levels).',
          'Study of architectural character, climatic influences, and client requirements.',
          'Ecological and sustainability assessment for long-term viability.',
        ],
      },
      {
        title: 'Conceptual Design',
        points: [
          'Development of landscape concept plan reflecting client vision and project objectives.',
          'Identification of functional zones, circulation patterns, and spatial character.',
          'Preliminary planting strategy and thematic approach.',
          'Concept sketches, mood boards, and initial visualizations.',
        ],
      },
      {
        title: 'Design Development',
        points: [
          'Preparation of detailed master landscape plan in coordination with architectural and structural design.',
          'Grading and site formation plan.',
          'Stormwater drainage integration.',
          'Design of irrigation systems and lighting layouts. (LANDSCAPE MEP)',
          'Selection of plant palettes and material finishes.',
        ],
      },
      {
        title: 'Technical Documentation',
        points: [
          'Working drawings for execution of softscape and hardscape works.',
          'Irrigation system layout.',
          'Electrical and lighting layout for landscape features.',
          'Quantity take-offs and bill of quantities (BOQ).',
          'Specifications for materials, plants, and finishes.',
        ],
      },
      {
        title: 'Project Management',
        points: [
          'Coordination with civil, MEP, and architectural consultants.',
          'Technical guidance during procurement and material selection.',
          'Quality checks during execution.',
          'Review meetings with client/project team.',
        ],
      },
      {
        title: 'Execution Support',
        note: 'If Landschaft is engaged for implementation',
        points: [
          'Deployment of execution team for hardscape and softscape works.',
          'Planting, turfing, and installation of landscape features.',
          'Coordination of irrigation and electrical installations.',
          'Site finishing and handover.',
        ],
      },
      {
        title: 'Post-Completion Services (AMC)',
        points: [
          'Annual Maintenance Contract (AMC) tailored to property requirements, covering lawn care, plant health management, '
            + 'irrigation upkeep, and seasonal treatments.',
          'Training of in-house staff on basic landscape upkeep.',
          'Performance audits and improvement recommendations.',
        ],
      },
    ],
    phases: [
      {
        title: 'Engagement & Data Collection',
        points: [
          'Confirmation of Work Order and advance payment.',
          'Site survey (Client Part), soil testing, and documentation.',
          'Requirement gathering and vision alignment meeting.',
        ],
      },
      {
        title: 'Conceptual & Schematic Design',
        points: [
          'Preparation of initial concept layouts, sketches, and visual references.',
          'Client presentation & approval.',
        ],
      },
      {
        title: 'Design Development',
        points: [
          'Finalization of master landscape plan.',
          'Detailed planting and hardscape design.',
          'Irrigation, electrical, and drainage integration.',
          'Detailed Civil working drawing for Separation walls, seaters, feature walls, Compound walls & Pool/Waterbodies '
            + 'Design (whichever applicable)',
        ],
      },
      {
        title: 'Technical Documentation',
        points: [
          'Preparation of working drawings, BOQ, and specifications.',
          'Tender/quotation assistance for execution if required.',
        ],
      },
      {
        title: 'Execution & Implementation',
        note: 'if appointed',
        points: [
          'Site clearance & grading.',
          'Irrigation & electrical installation.',
          'Hardscape construction.',
          'Softscape works (planting, turfing, etc.)',
          'Quality checks & handover.',
        ],
      },
      {
        title: 'Maintenance & Aftercare',
        points: [
          'Post-installation monitoring for plant establishment.',
          'AMC (if availed) for continuous upkeep and seasonal care.',
        ],
      },
    ],
    fees: [{ label: 'Design & Consulting charges', amount: 0 }],
    visits: {
      note: 'Site visits by Landschaft constitute periodic design review/inspection for the number of visits mentioned only '
        + 'and shall not be construed as continuous or day-to-day supervision. Responsibility for construction methods, '
        + 'workmanship, safety, labour, sequencing and daily site supervision remains with the appointed contractor/site '
        + 'supervisor. Additional visits on request will be billed separately.',
      included: '3 Visits by core team.',
      rates: [
        { label: 'Site Engineer / Supervisor Visit', rate: 5000 },
        { label: 'Landscape Architect / Core Team Visit', rate: 10000 },
      ],
    },
    executionNote: 'Quote will be given with respect to final design. As per approved quotation, payable in phased installments '
      + 'aligned with work progress.',
    amcNote: 'Custom pricing based on site size, plant selection, and service frequency. Proposal to be shared post-completion.',
    terms: [
      'Architectural/design services related to major buildings or built structures are not included within this scope of work.',
      'The scope and professional fee are based on the currently specified project/land area. Any subsequent addition or '
        + 'extension to the land/project area shall be considered additional scope and will be charged separately at the '
        + 'applicable agreed rate.',
      'The fee covers only the services listed in this proposal. Any additional work or major design revisions will be '
        + 'charged separately with prior approval.',
      'The Client shall provide required site information, drawings, surveys and approvals.',
      'Specialist surveys, soil tests and statutory fees, if required, shall be arranged by the Client.',
      'Site visits are for periodic design review and coordination only. Day-to-day supervision, workmanship, safety and '
        + 'construction responsibility remain with the appointed contractor/site team.',
      'Payments shall be made as per the agreed schedule. Invoices are payable within 7 days of issue.',
      'All drawings and design documents remain the intellectual property of Landschaft until full payment is received.',
      'Any significant change in the approved scope, project area, design brief or site conditions may require a revision '
        + 'of the fee and schedule.',
      'If the project is cancelled or suspended, fees for work completed up to that stage shall be payable.',
      'Execution works, AMC and services not specifically included in this proposal will be quoted separately.',
      'The quoted fee is based on completion of the consultancy within 12 months from the date of engagement. If the project '
        + 'is delayed beyond this period for reasons beyond Landschaft’s control, the fee for the remaining services may be '
        + 'reviewed mutually.',
      'This proposal is valid for one month from the date of submission.',
    ],
    closing: 'We look forward to partnering with you to create an inspiring and sustainable landscape. Please confirm your '
      + 'acceptance of this proposal so we may commence immediately.',
    signOff: 'Thanks & Regards,\nLandschaft.',
    paymentStages: [
      { label: 'Advance, payable at the time of engagement', percent: 40 },
      { label: 'Upon submission and approval of the Concept Plan', percent: 20 },
      { label: 'At the Design Development stage', percent: 20 },
      { label: 'Upon submission of the Final Design Package', percent: 20 },
    ],
  }
}
