import type { AtcEventBus } from '@atc/events'
import type { ShipmentRepository, AtcShipment } from './shipment.repository.js'
import type { DeliveryAuditRepository } from './delivery-audit.repository.js'
import {
  ShipmentNotFoundError,
  ShipmentAlreadyInTransitError,
  ShipmentAlreadyDeliveredError,
} from './errors.js'

export interface CreateShipmentParams {
  shipmentNonce: string
  originId: string
  destinationId: string
  carrierPrincipalId?: string
  cargoManifest?: string[]
}

export class ShipmentService {
  constructor(
    private readonly shipmentRepo: ShipmentRepository,
    private readonly auditRepo: DeliveryAuditRepository,
    private readonly eventBus: AtcEventBus,
  ) {}

  async createShipment(params: CreateShipmentParams): Promise<AtcShipment> {
    const shipment = await this.shipmentRepo.create(params)
    await this.auditRepo.record(shipment.shipmentId, 'created', params.carrierPrincipalId)
    this.eventBus.emit('atc:logistics:shipment:created', { shipmentId: shipment.shipmentId }).catch(() => undefined)
    return shipment
  }

  async departShipment(shipmentId: string): Promise<AtcShipment> {
    const shipment = await this.shipmentRepo.findById(shipmentId)
    if (!shipment) throw new ShipmentNotFoundError(shipmentId)
    if (shipment.status === 'in_transit') throw new ShipmentAlreadyInTransitError(shipmentId)
    if (shipment.status === 'delivered') throw new ShipmentAlreadyDeliveredError(shipmentId)
    const updated = await this.shipmentRepo.transition(shipmentId, 'in_transit')
    await this.auditRepo.record(shipmentId, 'departed')
    this.eventBus.emit('atc:logistics:shipment:departed', { shipmentId }).catch(() => undefined)
    return updated
  }

  async deliverShipment(shipmentId: string): Promise<AtcShipment> {
    const shipment = await this.shipmentRepo.findById(shipmentId)
    if (!shipment) throw new ShipmentNotFoundError(shipmentId)
    if (shipment.status === 'delivered') throw new ShipmentAlreadyDeliveredError(shipmentId)
    const updated = await this.shipmentRepo.transition(shipmentId, 'delivered')
    await this.auditRepo.record(shipmentId, 'delivered')
    this.eventBus.emit('atc:logistics:shipment:delivered', { shipmentId }).catch(() => undefined)
    return updated
  }

  async failShipment(shipmentId: string, reason: string): Promise<AtcShipment> {
    const shipment = await this.shipmentRepo.findById(shipmentId)
    if (!shipment) throw new ShipmentNotFoundError(shipmentId)
    if (shipment.status === 'delivered') throw new ShipmentAlreadyDeliveredError(shipmentId)
    const updated = await this.shipmentRepo.transition(shipmentId, 'failed')
    await this.auditRepo.record(shipmentId, 'failed', undefined, reason)
    this.eventBus.emit('atc:logistics:shipment:failed', { shipmentId, reason }).catch(() => undefined)
    return updated
  }

  async getShipment(shipmentId: string): Promise<AtcShipment | null> {
    return this.shipmentRepo.findById(shipmentId)
  }

  async listActiveShipments(): Promise<AtcShipment[]> {
    return this.shipmentRepo.listActive()
  }
}
