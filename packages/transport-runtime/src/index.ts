// Pool interface
export type { PoolConnection, TransportRuntimePool } from './pool.js'

// ID utility
export { generateId } from './id.js'

// Errors
export {
  TransportRuntimeError,
  VesselNotFoundError,
  VesselAlreadyDockedError,
  AircraftNotFoundError,
  AircraftAlreadyAirborneError,
  FlightNotFoundError,
  DuplicateFlightNonceError,
  AirspaceZoneNotFoundError,
  DockingSlotNotFoundError,
  DuplicateDockingNonceError,
} from './errors.js'

// Vessel repository
export type { AtcVesselStatus, AtcVessel } from './vessel.repository.js'
export { VesselRepository } from './vessel.repository.js'

// Aircraft repository
export type { AtcFlightStatus, AtcAircraftStatus, AtcAircraft } from './aircraft.repository.js'
export { AircraftRepository } from './aircraft.repository.js'

// Flight runtime repository
export type { AtcFlightRuntime } from './flight-runtime.repository.js'
export { FlightRuntimeRepository } from './flight-runtime.repository.js'

// Airspace zone repository
export type { AtcAirspaceStatus, AtcAirspaceZone } from './airspace-zone.repository.js'
export { AirspaceZoneRepository } from './airspace-zone.repository.js'

// Docking runtime repository
export type { AtcDockStatus, AtcDockingRuntime } from './docking-runtime.repository.js'
export { DockingRuntimeRepository } from './docking-runtime.repository.js'

// Transport audit repository
export { TransportAuditRepository } from './transport-audit.repository.js'

// Services
export { MaritimeRuntimeService } from './maritime-runtime.service.js'
export { AviationRuntimeService } from './aviation-runtime.service.js'
