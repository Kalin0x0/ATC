import { z } from 'zod'
import { vitalNameSchema, vitalsResponseSchema } from './vitals.schema.js'

export const vitalsEventSourceSchema = z.enum(['api', 'lua', 'decay', 'item_effect', 'system'])

export const vitalsChangedEventSchema = z.object({
  characterId: z.string().min(20).max(36),
  source: vitalsEventSourceSchema,
  timestamp: z.string().datetime(),
  changed: z.record(vitalNameSchema, z.number().int().min(0).max(100)).optional(),
  vitals: vitalsResponseSchema,
  metadata: z.record(z.unknown()).optional(),
})

export type VitalsChangedEventInput = z.input<typeof vitalsChangedEventSchema>
export type VitalsChangedEventOutput = z.output<typeof vitalsChangedEventSchema>

export const vitalsDecayConfigSchema = z.object({
  enabled: z.boolean(),
  intervalSeconds: z.number().int().min(1).max(3600),
  hunger: z.number().int().min(0).max(100),
  thirst: z.number().int().min(0).max(100),
  stamina: z.number().int().min(0).max(100),
  stress: z.number().int().min(0).max(100),
})

export type VitalsDecayConfigInput = z.input<typeof vitalsDecayConfigSchema>
export type VitalsDecayConfigOutput = z.output<typeof vitalsDecayConfigSchema>
