import type {
  ProductionDeploymentRepository,
  AtcProductionDeployment,
  InitiateDeploymentParams,
} from './production-deployment.repository.js'
import type { ReleaseAuditRepository } from './release-audit.repository.js'
import type { ReleaseGovernanceEventBus } from './release-governance.service.js'

export class ProductionDeploymentCoordinator {
  constructor(
    private readonly repo: ProductionDeploymentRepository,
    private readonly audit: ReleaseAuditRepository,
    private readonly bus: ReleaseGovernanceEventBus
  ) {}

  async initiateDeployment(params: InitiateDeploymentParams): Promise<AtcProductionDeployment> {
    const record = await this.repo.upsert(params)
    await this.audit.append(record.id, 'deployment.initiated', { deploymentId: record.deploymentId })
    this.bus.emit('deployment.initiated', { deploymentId: record.deploymentId }).catch(() => undefined)
    return record
  }

  async activateDeployment(deploymentId: string): Promise<AtcProductionDeployment> {
    const record = await this.repo.updateStatus(deploymentId, 'deploying')
    await this.audit.append(record.id, 'deployment_governed', { deploymentId: record.deploymentId })
    this.bus.emit('deployment_governed', { deploymentId: record.deploymentId }).catch(() => undefined)
    return record
  }

  async completeDeployment(deploymentId: string): Promise<AtcProductionDeployment> {
    const record = await this.repo.updateStatus(deploymentId, 'deployed', new Date())
    await this.audit.append(record.id, 'production_release_completed', { deploymentId: record.deploymentId })
    this.bus.emit('production_release_completed', { deploymentId: record.deploymentId }).catch(() => undefined)
    return record
  }

  async rollbackDeployment(deploymentId: string): Promise<AtcProductionDeployment> {
    const record = await this.repo.updateStatus(deploymentId, 'rolled_back')
    this.bus.emit('deployment.rolled_back', { deploymentId: record.deploymentId }).catch(() => undefined)
    return record
  }

  async getDeployment(deploymentId: string): Promise<AtcProductionDeployment | null> {
    return this.repo.findByDeploymentId(deploymentId)
  }
}
