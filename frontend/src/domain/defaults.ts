import { defaultPermissions, normalizePermissions } from './roles'
import type { Settings } from './types'

/** Settings a new company starts with, before anyone changes them in Settings. */
export function defaultSettings(): Settings {
  return {
    designPaymentSplit: { concept: 50, threeD: 20, civilWork: 15, boq: 15 },
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
      'Carpenter', 'Driver / Helper', 'Electrician', 'Foreman / AMC', 'Foreman / Hardscape', 'Foreman / Lawn', 'Foreman / Planting',
      'Gardener', 'Helper', 'Lawn Specialist', 'Mason', 'Painter', 'Plumber / Irrigation', 'Tile & Paver Layer',
      'Welder / Fabricator',
    ],
  }
}

/**
 * Settings as stored, brought up to date: anything added since they were saved
 * starts from the defaults, and renamed or new permission modules are filled in.
 */
export function normalizeSettings(stored?: Partial<Settings> | null): Settings {
  const defaults = defaultSettings()
  if (!stored) return defaults
  return { ...defaults, ...stored, permissions: normalizePermissions(stored.permissions) }
}
