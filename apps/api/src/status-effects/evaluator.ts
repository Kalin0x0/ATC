import type { AtcVitalsChangedEvent, AtcStatusEffectType, AtcStatusEffectSeverity, AtcStatusEffect } from '@atc/shared-types'
import type { AtcEventBus } from '@atc/events'
import type { StatusEffectCache } from '@atc/cache'
import type { Logger } from '../logger.js'

const VITALS_CHANGED_EVENT = 'atc:vitals:changed'
const STATUS_CHANGED_EVENT = 'atc:status:changed'

// apply < value applies effect; clear >= value clears it
// stress is inverted: apply > value applies, clear <= value clears
const THRESHOLDS = {
  starving:    { vital: 'hunger',  applyBelow: 20,  clearAtOrAbove: 25,  severity: 'high'   as AtcStatusEffectSeverity, reason: 'Hunger critically low' },
  dehydrated:  { vital: 'thirst',  applyBelow: 20,  clearAtOrAbove: 25,  severity: 'high'   as AtcStatusEffectSeverity, reason: 'Thirst critically low' },
  fatigue:     { vital: 'stamina', applyBelow: 20,  clearAtOrAbove: 30,  severity: 'medium' as AtcStatusEffectSeverity, reason: 'Stamina critically low' },
  stressed:    { vital: 'stress',  applyAbove: 80,  clearAtOrBelow: 70,  severity: 'high'   as AtcStatusEffectSeverity, reason: 'Stress critically high' },
} as const

type LowVitalKey = 'starving' | 'dehydrated' | 'fatigue'
type HighVitalKey = 'stressed'

function makeEffect(
  characterId: string,
  type: AtcStatusEffectType,
  severity: AtcStatusEffectSeverity,
  reason: string,
  now: string,
): AtcStatusEffect {
  return {
    id: `status:${characterId}:${type}`,
    characterId,
    type,
    severity,
    source: 'vitals',
    reason,
    startedAt: now,
    expiresAt: null,
  }
}

export function registerVitalsThresholdEvaluator(
  eventBus: AtcEventBus,
  statusEffectsCache: StatusEffectCache,
  logger: Logger,
): void {
  eventBus.on(VITALS_CHANGED_EVENT, async (raw) => {
    const event = raw as AtcVitalsChangedEvent
    const { characterId, vitals } = event
    const now = new Date().toISOString()

    try {
      if (!vitals || typeof vitals !== 'object') {
        logger.warn({ characterId }, 'vitals threshold evaluator: missing or invalid vitals payload')
        return
      }

      const applied: AtcStatusEffectType[] = []
      const cleared: AtcStatusEffectType[] = []

      // Low-vital thresholds: hunger, thirst, stamina
      const lowKeys: LowVitalKey[] = ['starving', 'dehydrated', 'fatigue']
      for (const effectType of lowKeys) {
        const cfg = THRESHOLDS[effectType]
        const value = vitals[cfg.vital as keyof typeof vitals] as number
        if (value < cfg.applyBelow) {
          await statusEffectsCache.apply(
            characterId,
            makeEffect(characterId, effectType, cfg.severity, cfg.reason, now),
          )
          applied.push(effectType)
        } else if (value >= cfg.clearAtOrAbove) {
          await statusEffectsCache.clear(characterId, effectType)
          cleared.push(effectType)
        }
      }

      // High-vital threshold: stress (high value is bad)
      const stressCfg = THRESHOLDS.stressed
      const stress = vitals.stress
      if (stress > stressCfg.applyAbove) {
        await statusEffectsCache.apply(
          characterId,
          makeEffect(characterId, 'stressed', stressCfg.severity, stressCfg.reason, now),
        )
        applied.push('stressed')
      } else if (stress <= stressCfg.clearAtOrBelow) {
        await statusEffectsCache.clear(characterId, 'stressed')
        cleared.push('stressed')
      }

      if (applied.length > 0 || cleared.length > 0) {
        logger.info({ characterId, applied, cleared }, STATUS_CHANGED_EVENT)
      }
    } catch (err) {
      logger.warn({ err, characterId }, 'vitals threshold evaluator error')
    }
  })
}
