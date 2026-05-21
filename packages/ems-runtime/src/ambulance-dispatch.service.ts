import type { AtcAmbulanceUnit, AtcAmbulanceStatus } from '@atc/shared-types'
import type { AmbulanceRepository } from './ambulance.repository.js'
import type { AtcEventBus } from '@atc/events'
import { ATC_EMS_EVENTS } from '@atc/shared-types'

export class AmbulanceDispatchService {
  constructor(
    private readonly ambulanceRepo: AmbulanceRepository,
    private readonly eventBus: AtcEventBus | undefined,
  ) {}

  async registerUnit(unitId: string, principalId: string): Promise<AtcAmbulanceUnit> {
    return this.ambulanceRepo.register(unitId, principalId)
  }

  async dispatch(emergencyId: string, unitId: string, principalId: string): Promise<AtcAmbulanceUnit> {
    const unit = await this.ambulanceRepo.dispatch(unitId, emergencyId, principalId)
    this.eventBus?.emit(ATC_EMS_EVENTS.EMS_DISPATCHED, { unitId, emergencyId, principalId }).catch(() => undefined)
    return unit
  }

  async markEnRoute(unitId: string, principalId: string): Promise<AtcAmbulanceUnit> {
    return this.ambulanceRepo.transition(unitId, 'en_route', principalId)
  }

  async markTransporting(unitId: string, principalId: string): Promise<AtcAmbulanceUnit> {
    return this.ambulanceRepo.transition(unitId, 'transporting', principalId)
  }

  async markAtHospital(unitId: string, principalId: string, facilityId: string): Promise<AtcAmbulanceUnit> {
    return this.ambulanceRepo.transition(unitId, 'hospital', principalId, facilityId)
  }

  async returnToService(unitId: string, principalId: string): Promise<AtcAmbulanceUnit> {
    return this.ambulanceRepo.transition(unitId, 'available', principalId, null)
  }

  async updateStatus(unitId: string, newStatus: AtcAmbulanceStatus, principalId: string, facilityId?: string | null): Promise<AtcAmbulanceUnit> {
    return this.ambulanceRepo.transition(unitId, newStatus, principalId, facilityId)
  }

  async listAvailable(): Promise<AtcAmbulanceUnit[]> {
    return this.ambulanceRepo.listAvailable()
  }

  async listActive(): Promise<AtcAmbulanceUnit[]> {
    return this.ambulanceRepo.listActive()
  }

  async findUnit(unitId: string): Promise<AtcAmbulanceUnit | null> {
    return this.ambulanceRepo.findByUnitId(unitId)
  }

  // Suggest the best available unit for dispatch (currently: first available)
  async suggestUnit(): Promise<AtcAmbulanceUnit | null> {
    const available = await this.ambulanceRepo.listAvailable()
    return available[0] ?? null
  }
}
