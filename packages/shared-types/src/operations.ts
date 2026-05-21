// Runtime Operations types (Phase 16 + 17)

export type AtcRuntimeHealthStatus = 'healthy' | 'degraded' | 'failed'

export interface AtcSubsystemHealth {
  status: AtcRuntimeHealthStatus
  latencyMs: number
  lastCheckedAt: string
  message?: string
  metadata?: Record<string, unknown>
}

export interface AtcRuntimeHealthSnapshot {
  status: AtcRuntimeHealthStatus
  subsystems: {
    api: AtcSubsystemHealth
    db: AtcSubsystemHealth
    redis: AtcSubsystemHealth
    eventBus: AtcSubsystemHealth
    taskRuntime: AtcSubsystemHealth
    eventStore: AtcSubsystemHealth
    pluginRuntime: AtcSubsystemHealth
  }
  checkedAt: string
}

export interface AtcDlqItem {
  taskId: string
  type: string
  queueName: string
  failedAt: string | null
  retryCount: number
  payload: unknown
  error: unknown
}

export interface AtcDlqPage {
  items: AtcDlqItem[]
  total: number
  offset: number
  limit: number
}

export interface AtcEventPage {
  events: AtcStoredEventSummary[]
  nextCursor: string | null
}

export interface AtcStoredEventSummary {
  id: string
  streamId: string
  eventName: string
  source: string
  storedAt: string
}

// ── Phase 17 — Distributed Runtime ───────────────────────────────────────────

export type AtcRedisConnectionState = 'connected' | 'reconnecting' | 'degraded' | 'failed'

export interface AtcRuntimeNodeRecord {
  instanceId: string
  hostname: string
  pid: number
  startedAt: string
  capabilities: string[]
  version: string
}

export interface AtcRuntimeNodeStatus extends AtcRuntimeNodeRecord {
  isStale: boolean
  lastHeartbeatAt: string | null
}

export interface AtcClusterSnapshot {
  capturedAt: string
  leader: string | null
  nodes: AtcRuntimeNodeStatus[]
  totalNodes: number
  staleNodes: number
  totalWorkers: number
  activeWorkers: number
  schedulerRunning: boolean
}
