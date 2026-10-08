import { hasPermission } from '../domain/roles'
import type { ModuleKey, PermissionAction } from '../domain/types'
import { useDb } from './useDb'
import { useSession } from './session'

/**
 * The signed-in person's rights, read from the matrix in Settings. Pages ask
 * `can('CRM', 'delete')` before showing an action rather than checking roles.
 */
export function usePermissions() {
  const { settings } = useDb()
  const { roleKey } = useSession()
  return {
    canView: (module: ModuleKey) => hasPermission(settings.permissions, roleKey, module, 'view'),
    can: (module: ModuleKey, action: PermissionAction) =>
      hasPermission(settings.permissions, roleKey, module, action),
  }
}
