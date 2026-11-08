import { defaultPermissions, normalizePermissions } from './roles'
import { defaultDocumentSettings, normalizeDocumentSettings } from './documentDefaults'
import type { PaymentSlab, Settings, SlabDue } from './types'

/** Settings a new company starts with, before anyone changes them in Settings. */
export function defaultSettings(): Settings {
  return {
    designPaymentSplit: { concept: 30, threeD: 30, civilWork: 30, boq: 10 },
    executionPaymentSlabs: [
      { label: 'Work start', percent: 50, dueAt: 'workStarted' },
      { label: 'Hardscape complete', percent: 25, dueAt: 'hardscape' },
      { label: 'Softscape complete', percent: 20, dueAt: 'softscape' },
      { label: 'Handover', percent: 5, dueAt: 'completed' },
    ],
    taEnabled: false,
    taRatePerKm: 0,
    photosMandatory: true,
    photoMaxPx: 1600,
    photoMaxKb: 300,
    otAdjustRoles: ['super_admin', 'ceo', 'execution_head', 'execution_pm'],
    freeMaintenanceMonths: 1,
    permissions: defaultPermissions(),
    holidays: [],
    workHours: { start: '09:00', end: '18:00', halfDayEnd: '13:30' },
    workerSkills: [
      'Carpenter', 'Driver / Helper', 'Electrician', 'Foreman / Hardscape', 'Foreman / Lawn', 'Foreman / Planting',
      'Gardener', 'Helper', 'Lawn Specialist', 'Mason', 'Painter', 'Plumber / Irrigation', 'Tile & Paver Layer',
      'Welder / Fabricator',
    ],
    documents: defaultDocumentSettings(),
  }
}

/**
 * Settings as stored, brought up to date: anything added since they were saved
 * starts from the defaults, and renamed or new permission modules are filled in.
 */
export function normalizeSettings(stored?: Partial<Settings> | null): Settings {
  const defaults = defaultSettings()
  if (!stored) return defaults
  return {
    ...defaults,
    ...stored,
    permissions: normalizePermissions(stored.permissions),
    executionPaymentSlabs: normalizeSlabs(stored.executionPaymentSlabs ?? defaults.executionPaymentSlabs),
    documents: normalizeDocumentSettings(stored.documents),
  }
}

/**
 * Slabs saved before each said when it falls due get one from its name, or
 * failing that its place: the first when work starts, the rest at completion.
 */
function normalizeSlabs(slabs: Partial<PaymentSlab>[]): PaymentSlab[] {
  return slabs.map((slab, i) => {
    const label = slab.label ?? ''
    const guessed: SlabDue = /hardscape/i.test(label) ? 'hardscape'
      : /softscape|planting|lawn/i.test(label) ? 'softscape'
        : /mep|irrigation|electric|drainage|plumb/i.test(label) ? 'mep'
          : i === 0 || /start|advance|mobili/i.test(label) ? 'workStarted'
            : 'completed'
    return { label, percent: slab.percent ?? 0, dueAt: slab.dueAt ?? guessed }
  })
}
