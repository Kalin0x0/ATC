import type { AtcItemDefinition, AtcItemActionConfig, AtcItemRuntimeValidationResult } from '@atc/shared-types'

export function validateItemForUse(
  itemDef: AtcItemDefinition,
  actionConfig: AtcItemActionConfig | null,
): AtcItemRuntimeValidationResult {
  const errors: string[] = []

  if (itemDef.status !== 'active') {
    errors.push(`Item '${itemDef.id}' is not active (status: ${itemDef.status})`)
  }

  if (!itemDef.usable) {
    errors.push(`Item '${itemDef.id}' is not marked as usable`)
  }

  if (!actionConfig) {
    errors.push(`Item '${itemDef.id}' has no action config — it cannot be used via the runtime`)
  }

  return { valid: errors.length === 0, errors }
}
