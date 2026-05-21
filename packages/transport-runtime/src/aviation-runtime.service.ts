import type { AtcEventBus } from '@atc/events'
import type { AircraftRepository } from './aircraft.repository.js'
import type { AtcAircraft } from './aircraft.repository.js'
import type { FlightRuntimeRepository } from './flight-runtime.repository.js'
import type { AtcFlightRuntime } from './flight-runtime.repository.js'
import type { AirspaceZoneRepository } from './airspace-zone.repository.js'
import type { AtcAirspaceZone } from './airspace-zone.repository.js'
import type { TransportAuditRepository } from './transport-audit.repository.js'
import { AircraftAlreadyAirborneError, FlightNotFoundError } from './errors.js'

export class AviationRuntimeService {
  constructor(
    private readonly aircraftRepo: AircraftRepository,
    private readonly flightRepo: FlightRuntimeRepository,
    private readonly airspaceRepo: AirspaceZoneRepository,
    private readonly auditRepo: TransportAuditRepository,
    private readonly eventBus: AtcEventBus,
  ) {}

  async registerAircraft(params: {
    aircraftId: string
    aircraftName: string
    aircraftType: string
    ownedByPrincipalId?: string
  }): Promise<AtcAircraft> {
    const aircraft = await this.aircraftRepo.upsert(params)
    await this.auditRepo.record(aircraft.aircraftId, 'aircraft', 'registered', undefined, undefined)
    this.eventBus
      .emit('atc:transport:aircraft:registered', { aircraftId: aircraft.aircraftId })
      .catch(() => undefined)
    return aircraft
  }

  async createFlight(params: {
    flightNonce: string
    aircraftId: string
    originZoneId: string
    destinationZoneId: string
  }): Promise<AtcFlightRuntime> {
    const flight = await this.flightRepo.create(params)
    await this.auditRepo.record(
      flight.flightId,
      'flight',
      'created',
      undefined,
      JSON.stringify({ aircraftId: params.aircraftId, originZoneId: params.originZoneId, destinationZoneId: params.destinationZoneId }),
    )
    this.eventBus
      .emit('atc:transport:flight:created', { flightId: flight.flightId })
      .catch(() => undefined)
    return flight
  }

  async departFlight(flightId: string): Promise<AtcFlightRuntime> {
    const existing = await this.flightRepo.findById(flightId)
    if (existing === null) throw new FlightNotFoundError(flightId)

    const aircraft = await this.aircraftRepo.findById(existing.aircraftId)
    if (aircraft !== null && aircraft.status === 'airborne') {
      throw new AircraftAlreadyAirborneError(existing.aircraftId)
    }

    const flight = await this.flightRepo.transition(flightId, 'airborne')
    await this.aircraftRepo.updateStatus(existing.aircraftId, 'airborne')
    await this.auditRepo.record(
      flightId,
      'flight',
      'departed',
      undefined,
      JSON.stringify({ aircraftId: existing.aircraftId }),
    )
    this.eventBus
      .emit('atc:transport:flight:departed', { flightId })
      .catch(() => undefined)
    return flight
  }

  async landFlight(flightId: string): Promise<AtcFlightRuntime> {
    const existing = await this.flightRepo.findById(flightId)
    if (existing === null) throw new FlightNotFoundError(flightId)

    const flight = await this.flightRepo.transition(flightId, 'landed')
    await this.aircraftRepo.updateStatus(existing.aircraftId, 'on_ground')
    await this.auditRepo.record(
      flightId,
      'flight',
      'landed',
      undefined,
      JSON.stringify({ aircraftId: existing.aircraftId }),
    )
    this.eventBus
      .emit('atc:transport:flight:landed', { flightId })
      .catch(() => undefined)
    return flight
  }

  async divertFlight(flightId: string): Promise<AtcFlightRuntime> {
    const existing = await this.flightRepo.findById(flightId)
    if (existing === null) throw new FlightNotFoundError(flightId)

    const flight = await this.flightRepo.transition(flightId, 'diverted')
    await this.aircraftRepo.updateStatus(existing.aircraftId, 'on_ground')
    await this.auditRepo.record(
      flightId,
      'flight',
      'diverted',
      undefined,
      JSON.stringify({ aircraftId: existing.aircraftId }),
    )
    this.eventBus
      .emit('atc:transport:flight:diverted', { flightId })
      .catch(() => undefined)
    return flight
  }

  async registerAirspaceZone(params: {
    zoneId: string
    zoneName: string
    zoneType: string
    minAltitudeM: number
    maxAltitudeM: number
    ownerServerId?: string
  }): Promise<AtcAirspaceZone> {
    const zone = await this.airspaceRepo.upsert(params)
    this.eventBus
      .emit('atc:transport:airspace:zone_registered', { zoneId: zone.zoneId })
      .catch(() => undefined)
    return zone
  }

  async restrictAirspace(zoneId: string): Promise<AtcAirspaceZone> {
    const zone = await this.airspaceRepo.updateStatus(zoneId, 'restricted')
    this.eventBus
      .emit('atc:transport:airspace:restricted', { zoneId })
      .catch(() => undefined)
    return zone
  }

  async openAirspace(zoneId: string): Promise<AtcAirspaceZone> {
    const zone = await this.airspaceRepo.updateStatus(zoneId, 'open')
    this.eventBus
      .emit('atc:transport:airspace:opened', { zoneId })
      .catch(() => undefined)
    return zone
  }
}
