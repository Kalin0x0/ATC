import type { RuntimeDeploymentRepository, AtcRuntimeDeployment, CreateDeploymentParams } from './runtime-deployment.repository.js'
import type { ClusterAuditRepository } from './cluster-audit.repository.js'
import type { ClusterRuntimeEventBus } from './distributed-deployment-recovery.service.js'

export class DeploymentOrchestrationService {
  constructor(
    private deploymentRepo: RuntimeDeploymentRepository,
    private auditRepo: ClusterAuditRepository,
    private eventBus: ClusterRuntimeEventBus,
  ) {}

  async startDeployment(params: CreateDeploymentParams): Promise<AtcRuntimeDeployment> {
    const deployment = await this.deploymentRepo.create(params)
    await this.auditRepo.append({ eventType: 'deployment_started', auditData: { deploymentId: deployment.deploymentId } })
    this.eventBus.emit('atc:cluster:deployment:started', { deploymentId: deployment.deploymentId }).catch(() => undefined)
    return deployment
  }

  async completeDeployment(id: string): Promise<AtcRuntimeDeployment> {
    const deployment = await this.deploymentRepo.updateStatus(id, 'completed', new Date())
    await this.auditRepo.append({ eventType: 'deployment_completed', auditData: { deploymentId: deployment.deploymentId } })
    this.eventBus.emit('atc:cluster:deployment:completed', { deploymentId: deployment.deploymentId }).catch(() => undefined)
    return deployment
  }

  async failDeployment(id: string): Promise<AtcRuntimeDeployment> {
    const deployment = await this.deploymentRepo.updateStatus(id, 'failed')
    await this.auditRepo.append({ eventType: 'deployment_failed', auditData: { deploymentId: deployment.deploymentId } })
    this.eventBus.emit('atc:cluster:deployment:failed', { deploymentId: deployment.deploymentId }).catch(() => undefined)
    return deployment
  }

  async getDeployment(id: string): Promise<AtcRuntimeDeployment | null> {
    return this.deploymentRepo.findById(id)
  }
}
