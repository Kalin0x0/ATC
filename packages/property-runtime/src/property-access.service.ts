import type { AtcPropertyAccess, AtcPropertyAccessType, AtcPropertyKey } from '@atc/shared-types'
import { ATC_PROPERTY_EVENTS } from '@atc/shared-types'
import type { AtcEventBus } from '@atc/events'
import type { PropertyAccessRepository, GrantAccessParams } from './property-access.repository.js'

export interface PropertyAccessServiceDeps {
  accessRepo: PropertyAccessRepository
  eventBus: AtcEventBus | undefined
}

export class PropertyAccessService {
  private readonly accessRepo: PropertyAccessRepository
  private readonly eventBus: AtcEventBus | undefined

  constructor(deps: PropertyAccessServiceDeps) {
    this.accessRepo = deps.accessRepo
    this.eventBus   = deps.eventBus
  }

  async grantAccess(params: GrantAccessParams): Promise<AtcPropertyAccess> {
    const access = await this.accessRepo.grant(params)

    this.eventBus?.emit(ATC_PROPERTY_EVENTS.ACCESS_GRANTED, {
      propertyId: params.propertyId,
      principalId: params.principalId,
      accessType: params.accessType,
      grantedByPrincipalId: params.grantedByPrincipalId,
    }).catch(() => undefined)

    return access
  }

  async revokeAccess(accessId: string, revokedByPrincipalId: string): Promise<AtcPropertyAccess> {
    const access = await this.accessRepo.revoke(accessId, revokedByPrincipalId)

    this.eventBus?.emit(ATC_PROPERTY_EVENTS.ACCESS_REVOKED, {
      propertyId: access.propertyId,
      principalId: access.principalId,
      accessId,
      revokedByPrincipalId,
    }).catch(() => undefined)

    return access
  }

  async checkAccess(
    propertyId: string,
    principalId: string,
  ): Promise<{ hasAccess: boolean; accessTypes: AtcPropertyAccessType[] }> {
    const grants = await this.accessRepo.findActiveForPrincipal(propertyId, principalId)
    const keys   = await this.accessRepo.findActiveKeyForPrincipal(propertyId, principalId)
    const hasAccess = grants.length > 0 || keys !== null
    const accessTypes = grants.map(g => g.accessType)
    if (keys) accessTypes.push('guest')
    return { hasAccess, accessTypes: [...new Set(accessTypes)] }
  }

  async listAccessForProperty(propertyId: string): Promise<AtcPropertyAccess[]> {
    return this.accessRepo.listActiveForProperty(propertyId)
  }

  async issueKey(
    propertyId: string,
    issuedToPrincipalId: string,
    issuedByPrincipalId: string,
  ): Promise<AtcPropertyKey> {
    const key = await this.accessRepo.issueKey(propertyId, issuedToPrincipalId, issuedByPrincipalId)

    this.eventBus?.emit(ATC_PROPERTY_EVENTS.KEY_ISSUED, {
      propertyId,
      issuedToPrincipalId,
      issuedByPrincipalId,
      keyId: key.id,
    }).catch(() => undefined)

    return key
  }

  async revokeKey(keyId: string, revokedByPrincipalId: string): Promise<AtcPropertyKey> {
    const key = await this.accessRepo.revokeKey(keyId, revokedByPrincipalId)

    this.eventBus?.emit(ATC_PROPERTY_EVENTS.KEY_REVOKED, {
      propertyId: key.propertyId,
      keyId,
      revokedByPrincipalId,
    }).catch(() => undefined)

    return key
  }

  async listKeysForProperty(propertyId: string): Promise<AtcPropertyKey[]> {
    return this.accessRepo.listActiveKeysForProperty(propertyId)
  }
}
