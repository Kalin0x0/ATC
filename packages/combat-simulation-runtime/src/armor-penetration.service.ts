import type { ArmorRuntimeRepository, AtcArmorRuntime, UpsertArmorParams } from './armor-runtime.repository.js'
import type { CombatSimulationEventBus } from './combat-simulation.service.js'

export class ArmorPenetrationService {
  constructor(
    private armorRepo: ArmorRuntimeRepository,
    private eventBus: CombatSimulationEventBus,
  ) {}

  async upsertArmor(params: UpsertArmorParams): Promise<AtcArmorRuntime> {
    return this.armorRepo.upsert(params)
  }

  async getArmor(entityId: string): Promise<AtcArmorRuntime | null> {
    return this.armorRepo.findByEntityId(entityId)
  }

  async applyDamageToArmor(entityId: string, penetration: number): Promise<AtcArmorRuntime | null> {
    const armor = await this.armorRepo.findByEntityId(entityId)
    if (!armor) return null
    const newIntegrity = Math.max(0, armor.currentIntegrity - penetration)
    const updated = await this.armorRepo.updateIntegrity(entityId, newIntegrity)
    this.eventBus.emit('atc:combat:armor:damaged', { entityId, integrity: newIntegrity }).catch(() => undefined)
    return updated
  }

  async deactivateArmor(entityId: string): Promise<void> {
    await this.armorRepo.deactivate(entityId)
  }
}
