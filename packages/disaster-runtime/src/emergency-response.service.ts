import type { AtcEventBus } from '@atc/events'
import type { EmergencyResponseRepository } from './emergency-response.repository.js'
import type { DisasterAuditRepository } from './disaster-audit.repository.js'
import type { AtcEmergencyResponse, AtcResponseType } from './emergency-response.repository.js'

export interface DispatchResponseParams {
  disasterId?: string | undefined
  responseType: AtcResponseType
  responderPrincipalId?: string | undefined
}

export class EmergencyResponseService {
  private readonly responseRepo: EmergencyResponseRepository
  private readonly auditRepo: DisasterAuditRepository
  private readonly eventBus: AtcEventBus | undefined

  constructor(
    responseRepo: EmergencyResponseRepository,
    auditRepo: DisasterAuditRepository,
    eventBus: AtcEventBus | undefined,
  ) {
    this.responseRepo = responseRepo
    this.auditRepo = auditRepo
    this.eventBus = eventBus
  }

  async dispatchResponse(params: DispatchResponseParams): Promise<AtcEmergencyResponse> {
    const response = await this.responseRepo.create({
      ...(params.disasterId !== undefined ? { disasterId: params.disasterId } : {}),
      responseType: params.responseType,
      ...(params.responderPrincipalId !== undefined ? { responderPrincipalId: params.responderPrincipalId } : {}),
    })
    await this.auditRepo.record(
      response.responseId,
      'emergency_response',
      'dispatched',
      params.responderPrincipalId,
      `type=${params.responseType}`,
    )
    this.eventBus?.emit('atc:disaster:response:dispatched', {
      responseId: response.responseId,
      responseType: response.responseType,
    }).catch(() => undefined)
    return response
  }

  async arriveOnScene(responseId: string): Promise<AtcEmergencyResponse> {
    const response = await this.responseRepo.transition(responseId, 'on_scene')
    this.eventBus?.emit('atc:disaster:response:on_scene', {
      responseId: response.responseId,
    }).catch(() => undefined)
    return response
  }

  async completeResponse(responseId: string): Promise<AtcEmergencyResponse> {
    const response = await this.responseRepo.transition(responseId, 'completed')
    this.eventBus?.emit('atc:disaster:response:completed', {
      responseId: response.responseId,
    }).catch(() => undefined)
    return response
  }

  async withdrawResponse(responseId: string): Promise<AtcEmergencyResponse> {
    const response = await this.responseRepo.transition(responseId, 'withdrawn')
    this.eventBus?.emit('atc:disaster:response:withdrawn', {
      responseId: response.responseId,
    }).catch(() => undefined)
    return response
  }
}
