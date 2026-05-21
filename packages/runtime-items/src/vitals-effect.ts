import type { AtcVitalName, AtcVitalsMutationMode } from '@atc/shared-types'
import type { EffectHandler } from './effect-registry.js'

// Minimal interface — runtime-items does not depend on @atc/db directly.
// The concrete VitalsRepository satisfies this contract.
interface VitalsService {
  mutate(
    characterId: string,
    vital: AtcVitalName,
    mode: AtcVitalsMutationMode,
    amount: number,
  ): Promise<unknown>
}

const VALID_VITALS = new Set<string>(['health', 'hunger', 'thirst', 'stamina', 'stress', 'armor'])
const VALID_MODES  = new Set<string>(['set', 'increment', 'decrement'])

// Factory that returns an EffectHandler for the 'vitals.modify' effect type.
// Wire it up in the API bootstrap: effects.register('vitals.modify', createVitalsModifyHandler(vitalsRepo))
export function createVitalsModifyHandler(service: VitalsService): EffectHandler {
  return async (characterId, _itemId, data) => {
    const vital  = data['vital']
    const mode   = data['mode']
    const amount = data['amount']

    // Strict validation — all three fields must be present and correct values.
    // Protects against malformed effect configs in action_config JSON.
    if (typeof vital !== 'string' || !VALID_VITALS.has(vital)) return { success: false }
    if (typeof mode  !== 'string' || !VALID_MODES.has(mode))   return { success: false }
    if (
      typeof amount !== 'number' ||
      !Number.isFinite(amount)   ||
      !Number.isInteger(amount)  ||
      amount < 0                 ||
      amount > 100
    ) return { success: false }

    try {
      await service.mutate(characterId, vital as AtcVitalName, mode as AtcVitalsMutationMode, amount)
      return { success: true, data: { vital, mode, amount } }
    } catch {
      return { success: false }
    }
  }
}
