import { z } from 'zod'

const idSchema = z.string().trim().min(1).max(64)

export const medicalIntelCharacterParamSchema = z.object({ id: idSchema })
export const medicalIntelIncidentParamSchema = z.object({ id: idSchema })
export const medicalIntelResponderParamSchema = z.object({ id: idSchema })

export const medicalIntelTimelineQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().trim().min(1).max(256).optional(),
  since: z.coerce.date().optional(),
  until: z.coerce.date().optional(),
})

export const medicalIntelWindowQuerySchema = z.object({
  windowDays: z.coerce.number().int().min(1).max(365).default(90),
})

export type MedicalIntelTimelineQueryOutput = z.output<typeof medicalIntelTimelineQuerySchema>
export type MedicalIntelWindowQueryOutput = z.output<typeof medicalIntelWindowQuerySchema>
