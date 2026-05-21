import type { AtcEventBus } from '@atc/events'
import type {
  EnvironmentRuntimeRepository,
  AtcEnvironmentRuntime,
  AtcWeatherType,
  AtcTimeOfDay,
} from './environment-runtime.repository.js'

export interface UpdateEnvironmentParams {
  weather?: AtcWeatherType | undefined
  timeOfDay?: AtcTimeOfDay | undefined
  temperature?: number | undefined
  windSpeed?: number | undefined
  visibility?: number | undefined
  isEmergencyWeather?: boolean | undefined
  activeEventId?: string | null | undefined
}

export class EnvironmentRuntimeService {
  constructor(
    private readonly envRepo: EnvironmentRuntimeRepository,
    private readonly eventBus: AtcEventBus | undefined,
  ) {}

  async updateEnvironment(
    regionId: string,
    params: UpdateEnvironmentParams,
  ): Promise<AtcEnvironmentRuntime> {
    const env = await this.envRepo.upsert(regionId, params)

    this.eventBus?.emit('atc:city:environment_updated', {
      regionId: env.regionId,
      weather: env.weather,
      timeOfDay: env.timeOfDay,
      isEmergencyWeather: env.isEmergencyWeather,
    }).catch(() => undefined)

    return env
  }

  async getEnvironment(regionId: string): Promise<AtcEnvironmentRuntime | null> {
    return this.envRepo.findByRegion(regionId)
  }

  async listAll(): Promise<AtcEnvironmentRuntime[]> {
    return this.envRepo.listAll()
  }
}
