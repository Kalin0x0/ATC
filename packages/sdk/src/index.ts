export { AtcClient, createAtcClient, type AtcClientConfig } from './client.js'

export { AtcHttpClient, type HttpResponse } from './http-client.js'
export { AtcAccountsSDK } from './accounts.js'
export { AtcSessionsSDK } from './sessions.js'
export { AtcCharactersSDK } from './characters.js'
export { AtcWalletsSDK } from './wallets.js'
export { AtcItemsSDK } from './items.js'
export { AtcInventorySDK } from './inventory.js'
export { AtcVitalsSDK } from './vitals.js'
export { AtcStatusEffectsSDK } from './status-effects.js'

export {
  AtcEventBus,
  buildEventEnvelope,
  ATC_EVENTS,
  type AtcEventName,
} from './events.js'

export {
  AtcSecuritySDK,
  buildRiskScore,
  calculateRiskPoints,
  type RiskScoreUpdate,
} from './security.js'

export {
  AtcLocaleSDK,
} from './locales.js'

export {
  AtcPluginRegistry,
} from './plugins.js'

export {
  AtcError,
  AtcNotImplementedError,
  AtcNotFoundError,
  AtcPermissionError,
  AtcValidationError,
  AtcBusinessRuleError,
  type AtcErrorCode,
} from './errors.js'
