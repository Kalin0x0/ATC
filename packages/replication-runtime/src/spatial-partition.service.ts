import type { SpatialNodeRepository } from './spatial-node.repository.js'
import type {
  AtcSpatialNode,
  UpsertSpatialNodeParams,
} from './spatial-node.repository.js'
import type { ReplicationAuditRepository } from './replication-audit.repository.js'

export class SpatialPartitionService {
  constructor(
    private readonly nodeRepo: SpatialNodeRepository,
    private readonly auditRepo: ReplicationAuditRepository
  ) {}

  async registerNode(params: UpsertSpatialNodeParams): Promise<AtcSpatialNode> {
    const node = await this.nodeRepo.upsert(params)
    await this.auditRepo.record(
      params.nodeId,
      'node.registered',
      params.ownerServerId,
      {
        nodeType: params.nodeType,
        regionId: params.regionId ?? null,
      }
    )
    return node
  }

  async listActiveNodes(): Promise<AtcSpatialNode[]> {
    return this.nodeRepo.listActive()
  }

  async cleanupStaleNodes(thresholdMs: number): Promise<number> {
    const count = await this.nodeRepo.deleteStale(thresholdMs)
    if (count > 0) {
      await this.auditRepo.record('system', 'node.cleanup.stale', undefined, {
        count,
        thresholdMs,
      })
    }
    return count
  }
}
