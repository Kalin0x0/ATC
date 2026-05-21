import { z } from 'zod'

export const correlationTimelineQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().trim().min(1).max(256).optional(),
  since: z.coerce.date().optional(),
  until: z.coerce.date().optional(),
})

export const correlationAssociatesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const correlationHistoricalGraphQuerySchema = z.object({
  asOf: z.coerce.date(),
  depth: z.coerce.number().int().min(1).max(4).default(1),
})

export type CorrelationTimelineQueryOutput = z.output<typeof correlationTimelineQuerySchema>
export type CorrelationAssociatesQueryOutput = z.output<typeof correlationAssociatesQuerySchema>
export type CorrelationHistoricalGraphQueryOutput = z.output<typeof correlationHistoricalGraphQuerySchema>
