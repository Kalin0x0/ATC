import type {
  ClusterContinuityRepository,
  AtcClusterContinuity,
  UpsertClusterParams,
} from './cluster-continuity.repository.js'
import type { SovereigntyAuditRepository } from './sovereignty-audit.repository.js'
import type { SovereigntyRuntimeEventBus } from './sovereignty-recovery.service.js'

export class InfiniteClusterContinuityService {
  constructor(
    private repo: ClusterContinuityRepository,
    private auditRepo: SovereigntyAuditRepository,
    private eventBus: SovereigntyRuntimeEventBus,
  ) {}

  async registerCluster(params: UpsertClusterParams): Promise<AtcClusterContinuity> {
    const record = await this.repo.upsert(params)
    await this.auditRepo.append({
      eventType: 'cluster_registered',
      sovereigntyId: record.clusterId,
      ownerServerId: record.ownerServerId,
      auditData: { clusterType: record.clusterType },
    })
    this.eventBus.emit('atc:runtime-sovereignty:cluster:registered', { clusterId: record.clusterId }).catch(() => undefined)
    return record
  }

  async degradeCluster(id: string): Promise<AtcClusterContinuity> {
    const record = await this.repo.updateStatus(id, 'degraded')
    await this.auditRepo.append({
      eventType: 'cluster_degraded',
      sovereigntyId: record.clusterId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:runtime-sovereignty:cluster:degraded', { clusterId: record.clusterId }).catch(() => undefined)
    return record
  }

  async recoverCluster(id: string): Promise<AtcClusterContinuity> {
    const record = await this.repo.updateStatus(id, 'recovering')
    await this.auditRepo.append({
      eventType: 'cluster_recovering',
      sovereigntyId: record.clusterId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:runtime-sovereignty:cluster:recovering', { clusterId: record.clusterId }).catch(() => undefined)
    return record
  }

  async failCluster(id: string): Promise<AtcClusterContinuity> {
    const record = await this.repo.updateStatus(id, 'failed')
    await this.auditRepo.append({
      eventType: 'cluster_failed',
      sovereigntyId: record.clusterId,
      ownerServerId: record.ownerServerId,
    })
    this.eventBus.emit('atc:runtime-sovereignty:cluster:failed', { clusterId: record.clusterId }).catch(() => undefined)
    return record
  }

  async getCluster(clusterId: string): Promise<AtcClusterContinuity | null> {
    return this.repo.findByClusterId(clusterId)
  }
}
