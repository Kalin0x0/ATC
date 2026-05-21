import type { RuntimeExposureRepository, AtcRuntimeExposure, CreateExposureParams } from './runtime-exposure.repository.js'
import type { GatewayAuditRepository } from './gateway-audit.repository.js'
import type { RuntimeGatewayEventBus } from './runtime-gateway.service.js'

export class RuntimeExposureCoordinator {
  constructor(
    private readonly exposureRepo: RuntimeExposureRepository,
    private readonly audit: GatewayAuditRepository,
    private readonly bus: RuntimeGatewayEventBus
  ) {}

  async exposeRuntime(params: CreateExposureParams): Promise<AtcRuntimeExposure> {
    const record = await this.exposureRepo.create(params)
    await this.audit.append(record.id, 'exposure.created', { exposureId: record.exposureId })
    this.bus.emit('exposure.created', { exposureId: record.exposureId }).catch(() => undefined)
    return record
  }

  async beginExposing(id: string): Promise<AtcRuntimeExposure> {
    const record = await this.exposureRepo.updateStatus(id, 'exposing')
    await this.audit.append(record.id, 'exposure.exposing', { exposureId: record.exposureId })
    this.bus.emit('exposure.exposing', { exposureId: record.exposureId }).catch(() => undefined)
    return record
  }

  async completeExposure(id: string): Promise<AtcRuntimeExposure> {
    const record = await this.exposureRepo.updateStatus(id, 'exposed', new Date())
    await this.audit.append(record.id, 'exposure.exposed', { exposureId: record.exposureId })
    this.bus.emit('runtime_surface_secured', { exposureId: record.exposureId }).catch(() => undefined)
    return record
  }

  async retractExposure(id: string): Promise<AtcRuntimeExposure> {
    const record = await this.exposureRepo.updateStatus(id, 'retracted')
    await this.audit.append(record.id, 'exposure.retracted', { exposureId: record.exposureId })
    this.bus.emit('exposure.retracted', { exposureId: record.exposureId }).catch(() => undefined)
    return record
  }

  async failExposure(id: string): Promise<AtcRuntimeExposure> {
    const record = await this.exposureRepo.updateStatus(id, 'failed')
    await this.audit.append(record.id, 'exposure.failed', { exposureId: record.exposureId })
    this.bus.emit('exposure.failed', { exposureId: record.exposureId }).catch(() => undefined)
    return record
  }

  async getExposure(id: string): Promise<AtcRuntimeExposure | null> {
    return this.exposureRepo.findById(id)
  }
}
