import type { ClusterScalingRepository, AtcClusterScaling, CreateScalingParams } from './cluster-scaling.repository.js'
import type { ClusterAuditRepository } from './cluster-audit.repository.js'
import type { ClusterRuntimeEventBus } from './distributed-deployment-recovery.service.js'

export class RuntimeScalingService {
  constructor(
    private scalingRepo: ClusterScalingRepository,
    private auditRepo: ClusterAuditRepository,
    private eventBus: ClusterRuntimeEventBus,
  ) {}

  async startScaling(params: CreateScalingParams): Promise<AtcClusterScaling> {
    const scaling = await this.scalingRepo.create(params)
    await this.auditRepo.append({ eventType: 'scaling_started', auditData: { scalingId: scaling.scalingId } })
    this.eventBus.emit('atc:cluster:scaling:started', { scalingId: scaling.scalingId }).catch(() => undefined)
    return scaling
  }

  async completeScaling(id: string): Promise<AtcClusterScaling> {
    const scaling = await this.scalingRepo.updateStatus(id, 'completed', new Date())
    await this.auditRepo.append({ eventType: 'scaling_completed', auditData: { scalingId: scaling.scalingId } })
    this.eventBus.emit('atc:cluster:scaling:completed', { scalingId: scaling.scalingId }).catch(() => undefined)
    return scaling
  }

  async failScaling(id: string): Promise<AtcClusterScaling> {
    const scaling = await this.scalingRepo.updateStatus(id, 'failed')
    this.eventBus.emit('atc:cluster:scaling:failed', { scalingId: scaling.scalingId }).catch(() => undefined)
    return scaling
  }

  async getScaling(id: string): Promise<AtcClusterScaling | null> {
    return this.scalingRepo.findById(id)
  }
}
