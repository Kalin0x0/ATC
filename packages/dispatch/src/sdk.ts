import type { DispatchPool } from './pool.js'
import type { AtcEventBus } from '@atc/events'
import type { AtcTelemetryService } from '@atc/telemetry'
import { DispatchCallRepository } from './dispatch-call.repository.js'
import { IncidentRepository } from './incident.repository.js'
import { ResponderAssignmentRepository } from './responder-assignment.repository.js'
import { BoloRepository } from './bolo.repository.js'
import { DispatchService } from './dispatch.service.js'

export interface AtcDispatchSDKOptions {
  pool: DispatchPool
  eventBus?: AtcEventBus | undefined
  telemetry?: AtcTelemetryService | undefined
}

export class AtcDispatchSDK {
  readonly calls: DispatchCallRepository
  readonly incidents: IncidentRepository
  readonly responders: ResponderAssignmentRepository
  readonly bolos: BoloRepository
  readonly service: DispatchService

  constructor(opts: AtcDispatchSDKOptions) {
    this.calls      = new DispatchCallRepository(opts.pool)
    this.incidents  = new IncidentRepository(opts.pool)
    this.responders = new ResponderAssignmentRepository(opts.pool)
    this.bolos      = new BoloRepository(opts.pool)
    this.service    = new DispatchService({
      calls:     this.calls,
      incidents: this.incidents,
      responders: this.responders,
      bolos:     this.bolos,
      eventBus:  opts.eventBus,
      telemetry: opts.telemetry,
    })
  }
}
