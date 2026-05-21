import { z } from 'zod'

// ── Primitives ────────────────────────────────────────────────────────────────

export const vitalNameSchema = z.enum(['health', 'hunger', 'thirst', 'stamina', 'stress', 'armor'])

const vitalValueSchema = z
  .number()
  .int('Vital value must be an integer')
  .min(0, 'Vital value must be at least 0')
  .max(100, 'Vital value must be at most 100')

// ── GET response ──────────────────────────────────────────────────────────────

export const vitalsResponseSchema = z.object({
  characterId: z.string(),
  health:  vitalValueSchema,
  hunger:  vitalValueSchema,
  thirst:  vitalValueSchema,
  stamina: vitalValueSchema,
  stress:  vitalValueSchema,
  armor:   vitalValueSchema,
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
})

// ── PATCH body ────────────────────────────────────────────────────────────────

export const vitalsPatchSchema = z
  .object({
    health:  vitalValueSchema.optional(),
    hunger:  vitalValueSchema.optional(),
    thirst:  vitalValueSchema.optional(),
    stamina: vitalValueSchema.optional(),
    stress:  vitalValueSchema.optional(),
    armor:   vitalValueSchema.optional(),
  })
  .refine(
    (d) => Object.values(d).some((v) => v !== undefined),
    { message: 'Patch must include at least one vital field' },
  )

export type VitalsPatchInput = z.input<typeof vitalsPatchSchema>
export type VitalsPatchOutput = z.output<typeof vitalsPatchSchema>

// ── POST /mutate body ─────────────────────────────────────────────────────────

export const vitalsMutationSchema = z.object({
  vital:  vitalNameSchema,
  mode:   z.enum(['set', 'increment', 'decrement']),
  amount: z
    .number()
    .int('Amount must be an integer')
    .min(0, 'Amount must be at least 0')
    .max(100, 'Amount must be at most 100'),
  metadata: z
    .record(z.unknown())
    .refine((m) => Object.keys(m).length <= 20, 'Metadata must not exceed 20 keys')
    .optional(),
})

export type VitalsMutationInput = z.input<typeof vitalsMutationSchema>
export type VitalsMutationOutput = z.output<typeof vitalsMutationSchema>

// ── Route param ───────────────────────────────────────────────────────────────

export const vitalsCharacterParamSchema = z.object({
  characterId: z
    .string()
    .trim()
    .min(20, 'characterId must be a valid ULID')
    .max(36, 'characterId must be a valid ULID'),
})

export type VitalsCharacterParamInput = z.input<typeof vitalsCharacterParamSchema>

// ── Full vitals schema (used internally for validation) ───────────────────────

export const characterVitalsSchema = z.object({
  health:  vitalValueSchema,
  hunger:  vitalValueSchema,
  thirst:  vitalValueSchema,
  stamina: vitalValueSchema,
  stress:  vitalValueSchema,
  armor:   vitalValueSchema,
})

export type CharacterVitalsInput = z.input<typeof characterVitalsSchema>
