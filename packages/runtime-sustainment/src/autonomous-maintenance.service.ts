import type {
  AutonomousMaintenanceRepository,
  AtcAutonomousMaintenance,
  CreateMaintenanceParams,
} from './autonomous-maintenance.repository.js'
import type { SustainmentAuditRepository } from './sustainment-audit.repository.js'
import type { RuntimeSustainmentEventBus } from './runtime-sustainment.service.js'

export class AutonomousMaintenanceService {
  constructor(
    private readonly repo: AutonomousMaintenanceRepository,
    private readonly audit: SustainmentAuditRepository,
    private readonly bus: RuntimeSustainmentEventBus
  ) {}

  async scheduleMaintenance(params: CreateMaintenanceParams): Promise<AtcAutonomousMaintenance> {
    const record = await this.repo.create(params)
    await this.audit.append(record.id, 'maintenance_scheduled', { maintenanceId: record.maintenanceId })
    this.bus.emit('maintenance.scheduled', { maintenanceId: record.maintenanceId }).catch(() => undefined)
    return record
  }

  async runMaintenance(id: string): Promise<AtcAutonomousMaintenance> {
    const record = await this.repo.updateStatus(id, 'running')
    await this.audit.append(record.id, 'maintenance_running', { maintenanceId: record.maintenanceId })
    this.bus.emit('maintenance.running', { maintenanceId: record.maintenanceId }).catch(() => undefined)
    return record
  }

  async completeMaintenance(id: string): Promise<AtcAutonomousMaintenance> {
    const record = await this.repo.updateStatus(id, 'completed', new Date())
    await this.audit.append(record.id, 'maintenance_completed', { maintenanceId: record.maintenanceId })
    this.bus.emit('autonomous_maintenance_completed', { maintenanceId: record.maintenanceId }).catch(() => undefined)
    return record
  }

  async skipMaintenance(id: string): Promise<AtcAutonomousMaintenance> {
    const record = await this.repo.updateStatus(id, 'skipped')
    await this.audit.append(record.id, 'maintenance_skipped', { maintenanceId: record.maintenanceId })
    this.bus.emit('maintenance.skipped', { maintenanceId: record.maintenanceId }).catch(() => undefined)
    return record
  }

  async failMaintenance(id: string): Promise<AtcAutonomousMaintenance> {
    const record = await this.repo.updateStatus(id, 'failed')
    await this.audit.append(record.id, 'maintenance_failed', { maintenanceId: record.maintenanceId })
    this.bus.emit('maintenance.failed', { maintenanceId: record.maintenanceId }).catch(() => undefined)
    return record
  }

  async getMaintenance(id: string): Promise<AtcAutonomousMaintenance | null> {
    return this.repo.findById(id)
  }
}
