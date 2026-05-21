import { z } from 'zod'

// ── Primitives ────────────────────────────────────────────────────────────────

export const statusEffectTypeSchema = z.enum([
  'fatigue',
  'dehydrated',
  'starving',
  'stressed',
  'injured',
  'custom',
])

export const statusEffectSeveritySchema = z.enum(['low', 'medium', 'high', 'critical'])

export const statusEffectSourceSchema = z.enum(['vitals', 'item', 'system', 'admin'])

const metadataSchema = z
  .record(z.unknown())
  .refine((m) => Object.keys(m).length <= 20, 'metadata must have at most 20 keys')
  .optional()

// ── Full effect object ────────────────────────────────────────────────────────

export const statusEffectSchema = z.object({
  id: z.string().min(1).max(128),
  characterId: z.string().trim().min(20).max(36),
  type: statusEffectTypeSchema,
  severity: statusEffectSeveritySchema,
  source: statusEffectSourceSchema,
  reason: z.string().min(3).max(128),
  startedAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable(),
  metadata: metadataSchema,
})

export type StatusEffectInput = z.input<typeof statusEffectSchema>
export type StatusEffectOutput = z.output<typeof statusEffectSchema>

// ── POST body: apply an effect ────────────────────────────────────────────────

export const applyStatusEffectSchema = z.object({
  type: statusEffectTypeSchema,
  severity: statusEffectSeveritySchema,
  source: statusEffectSourceSchema,
  reason: z.string().min(3).max(128),
  durationSeconds: z.number().int().min(1).max(86400).optional(),
  metadata: metadataSchema,
})

export type ApplyStatusEffectInput = z.input<typeof applyStatusEffectSchema>
export type ApplyStatusEffectOutput = z.output<typeof applyStatusEffectSchema>

// ── List response ─────────────────────────────────────────────────────────────

export const statusEffectsResponseSchema = z.object({
  characterId: z.string().min(20).max(36),
  effects: z.array(statusEffectSchema),
})

export type StatusEffectsResponseInput = z.input<typeof statusEffectsResponseSchema>

// ── Route params ──────────────────────────────────────────────────────────────

export const statusEffectCharacterParamSchema = z.object({
  characterId: z.string().trim().min(20).max(36),
})

export type StatusEffectCharacterParamInput = z.input<typeof statusEffectCharacterParamSchema>

export const statusEffectTypeParamSchema = z.object({
  characterId: z.string().trim().min(20).max(36),
  type: statusEffectTypeSchema,
})

export type StatusEffectTypeParamInput = z.input<typeof statusEffectTypeParamSchema>
