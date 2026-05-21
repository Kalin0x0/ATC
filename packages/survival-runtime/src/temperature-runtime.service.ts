import type { AtcEventBus } from '@atc/events'
import type { TemperatureRuntimeRepository, AtcTemperatureRuntime } from './temperature-runtime.repository.js'

export class TemperatureRuntimeService {
  constructor(
    private readonly tempRepo: TemperatureRuntimeRepository,
    private readonly eventBus: AtcEventBus | undefined,
  ) {}

  async updateTemperature(
    playerId: string,
    currentTemp: number,
    tempTrend: number,
    exposureZone?: string | undefined,
  ): Promise<AtcTemperatureRuntime> {
    const state = await this.tempRepo.upsert(playerId, currentTemp, tempTrend, exposureZone)

    if (currentTemp < 35 || currentTemp > 40) {
      this.eventBus?.emit('atc:survival:temperature_updated', {
        playerId,
        currentTemp,
        tempTrend,
        ...(exposureZone !== undefined ? { exposureZone } : {}),
      }).catch(() => undefined)
    }

    return state
  }

  async getTemperature(playerId: string): Promise<AtcTemperatureRuntime | null> {
    return this.tempRepo.findByPlayerId(playerId)
  }
}
