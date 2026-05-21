import type { AtcHospitalCapacity } from '@atc/shared-types'
import type { HospitalCapacityRepository, UpsertCapacityParams } from './hospital-capacity.repository.js'

export class HospitalCapacityService {
  constructor(private readonly repo: HospitalCapacityRepository) {}

  async getCapacity(facilityId: string): Promise<AtcHospitalCapacity | null> {
    return this.repo.findByFacilityId(facilityId)
  }

  async listAll(): Promise<AtcHospitalCapacity[]> {
    return this.repo.listAll()
  }

  async updateCapacity(facilityId: string, params: Omit<UpsertCapacityParams, 'facilityId'>): Promise<AtcHospitalCapacity> {
    return this.repo.upsert({ facilityId, ...params })
  }

  // Atomically decrement available bed count — throws HospitalAtCapacityError if full
  async admitPatient(facilityId: string): Promise<AtcHospitalCapacity> {
    return this.repo.admitPatient(facilityId)
  }

  async dischargePatient(facilityId: string): Promise<AtcHospitalCapacity> {
    return this.repo.dischargePatient(facilityId)
  }

  async setDiversion(facilityId: string, isDiversion: boolean): Promise<AtcHospitalCapacity> {
    return this.repo.setDiversion(facilityId, isDiversion)
  }

  // Returns true if the facility can accept patients
  async isAccepting(facilityId: string): Promise<boolean> {
    const capacity = await this.repo.findByFacilityId(facilityId)
    if (!capacity) return false
    return !capacity.isDiversion && capacity.availableBeds > 0
  }

  // Route suggestion: first non-diversion, non-overflow facility with available beds
  async suggestFacility(): Promise<AtcHospitalCapacity | null> {
    const all = await this.repo.listAll()
    return all.find(c => !c.isDiversion && c.availableBeds > 0) ?? null
  }
}
