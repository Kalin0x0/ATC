export interface AtcEventBusMetrics {
  emittedTotal: number
  handledTotal: number
  failedTotal: number
  avgDurationMs: number
  activeSubscribers: number
  metricsEnabled: boolean
}

export interface AtcDistributedEventEnvelope {
  eventId: string
  sourceNodeId: string
  emittedAt: string
  eventName: string
  payload: unknown
}
