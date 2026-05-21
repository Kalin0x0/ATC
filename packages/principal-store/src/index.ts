export { PrincipalRepository } from './principal.repository.js'
export type {
  CreatePrincipalParams,
  UpdatePrincipalParams,
  ListPrincipalsParams,
  PrincipalPage,
} from './principal.repository.js'

export { RoleAssignmentRepository } from './role-assignment.repository.js'
export type { AssignRoleParams } from './role-assignment.repository.js'

export { PrincipalCapabilityRepository } from './capability.repository.js'
export type { GrantCapabilityParams } from './capability.repository.js'

export { SecurityEventRepository } from './security-event.repository.js'
export type {
  AppendSecurityEventParams,
  ListSecurityEventsParams,
  SecurityEventPage,
} from './security-event.repository.js'

export type { PrincipalStorePool } from './pool.js'
