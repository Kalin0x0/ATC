import type { AccessMeshRepository, AtcAccessMesh, SyncMeshParams } from './access-mesh.repository.js'
import type { GatewayAuditRepository } from './gateway-audit.repository.js'
import type { RuntimeGatewayEventBus } from './runtime-gateway.service.js'

export class DeterministicAccessMeshService {
  constructor(
    private readonly meshRepo: AccessMeshRepository,
    private readonly audit: GatewayAuditRepository,
    private readonly bus: RuntimeGatewayEventBus
  ) {}

  async syncMesh(params: SyncMeshParams): Promise<AtcAccessMesh> {
    const record = await this.meshRepo.upsert(params)
    await this.audit.append(record.id, 'mesh.synced', { meshId: record.meshId })
    this.bus.emit('access_mesh_synchronized', { meshId: record.meshId }).catch(() => undefined)
    return record
  }

  async degradeMesh(meshId: string): Promise<AtcAccessMesh> {
    const record = await this.meshRepo.updateStatus(meshId, 'degraded')
    await this.audit.append(record.id, 'mesh.degraded', { meshId: record.meshId })
    this.bus.emit('mesh.degraded', { meshId: record.meshId }).catch(() => undefined)
    return record
  }

  async desynchronizeMesh(meshId: string): Promise<AtcAccessMesh> {
    const record = await this.meshRepo.updateStatus(meshId, 'desynchronized')
    await this.audit.append(record.id, 'mesh.desynchronized', { meshId: record.meshId })
    this.bus.emit('mesh.desynchronized', { meshId: record.meshId }).catch(() => undefined)
    return record
  }

  async recoverMesh(meshId: string): Promise<AtcAccessMesh> {
    const record = await this.meshRepo.updateStatus(meshId, 'synchronized')
    await this.audit.append(record.id, 'mesh.recovered', { meshId: record.meshId })
    this.bus.emit('access_mesh_synchronized', { meshId: record.meshId }).catch(() => undefined)
    return record
  }

  async getMesh(meshId: string): Promise<AtcAccessMesh | null> {
    return this.meshRepo.findByMeshId(meshId)
  }
}
