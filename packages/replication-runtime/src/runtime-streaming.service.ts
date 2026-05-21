import type { StreamingRuntimeRepository } from './streaming-runtime.repository.js'
import type {
  AtcStreamingRuntime,
  UpsertStreamingParams,
} from './streaming-runtime.repository.js'
import type { ReplicationAuditRepository } from './replication-audit.repository.js'
import type { ReplicationEventBus } from './spatial-ownership.service.js'

export class RuntimeStreamingService {
  constructor(
    private readonly streamingRepo: StreamingRuntimeRepository,
    private readonly auditRepo: ReplicationAuditRepository,
    private readonly eventBus?: ReplicationEventBus | undefined
  ) {}

  async updateStreamingState(params: UpsertStreamingParams): Promise<AtcStreamingRuntime> {
    const runtime = await this.streamingRepo.upsert(params)
    await this.auditRepo.record(
      params.entityId,
      'streaming.state.updated',
      params.ownerServerId,
      {
        streamingState: params.streamingState,
      }
    )
    return runtime
  }

  async getStreamingState(entityId: string): Promise<AtcStreamingRuntime | null> {
    return this.streamingRepo.findByEntityId(entityId)
  }

  async cleanupStaleStreaming(thresholdMs: number): Promise<number> {
    const count = await this.streamingRepo.deleteStale(thresholdMs)
    if (count > 0) {
      await this.auditRepo.record('system', 'streaming.cleanup.stale', undefined, {
        count,
        thresholdMs,
      })
    }
    return count
  }
}
