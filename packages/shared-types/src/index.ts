export type {
  AtcAccount,
  AtcCreateAccountDto,
  AtcAccountStatus,
  AtcAccountIdentifiers,
  AtcAccountUpsertRequest,
  AtcAccountUpsertResponse,
  AtcBanCheckResponse,
} from './account.js'

export type {
  AtcCharacter,
  AtcCharacterSummary,
  AtcCreateCharacterDto,
  AtcGender,
  AtcCharacterStatus,
  AtcCreateCharacterRequest,
  AtcCreateCharacterResponse,
  AtcCharacterListResponse,
  AtcCharacterSelectRequest,
  AtcCharacterSelectResponse,
} from './character.js'
export { getCharacterFullName } from './character.js'

export type {
  AtcEventEnvelope,
  AtcClientEventRequest,
  AtcEventRegistration,
  AtcEventHandler,
  AtcRateLimitConfig,
  AtcCoreEventName,
  AtcPlayerEventName,
  AtcSecurityEventName,
  AtcEconomyEventName,
} from './event.js'
export {
  ATC_CORE_EVENTS,
  ATC_PLAYER_EVENTS,
  ATC_SECURITY_EVENTS,
  ATC_LOCALE_EVENTS,
  ATC_ECONOMY_EVENTS,
} from './event.js'

export type {
  AtcLocaleCode,
  AtcLocaleDirection,
  AtcLocaleMeta,
  AtcTranslationMap,
  AtcTranslationValue,
  AtcLocale,
} from './locale.js'
export {
  ATC_LOCALE_META,
  ATC_SUPPORTED_LOCALES,
  ATC_DEFAULT_LOCALE,
  isValidLocaleCode,
} from './locale.js'

export type {
  AtcPermission,
  AtcPermissionAction,
  AtcPermissionDomain,
  AtcAdminLevel,
  AtcAdminIdentity,
} from './permission.js'
export {
  ATC_ADMIN_LEVEL_PERMISSIONS,
  hasPermission,
} from './permission.js'

export type {
  AtcPluginManifest,
  AtcPluginEntryPoints,
  AtcPluginEvents,
  AtcPluginRegistration,
  AtcPluginStatus,
  AtcPluginDependencyGraph,
} from './plugin.js'

export type {
  AtcSecurityRiskScore,
  AtcSecurityViolation,
  AtcRiskEvent,
  AtcRiskLevel,
  AtcViolationType,
  AtcViolationSeverity,
} from './security.js'
export {
  ATC_RISK_THRESHOLDS,
  ATC_VIOLATION_POINTS,
  getRiskLevel,
} from './security.js'

export type {
  AtcPlayerSession,
  AtcCreateSessionDto,
  AtcSessionState,
  AtcSessionStatus,
  AtcSessionCreateRequest,
  AtcSessionResponse,
} from './session.js'

export type {
  AtcItemDefinitionStatus,
  AtcInventoryTransactionType,
  AtcInventoryTransactionSource,
  AtcItemDefinition,
  AtcItemDefinitionCreateRequest,
  AtcItemDefinitionUpdateRequest,
  AtcItemDefinitionBulkUpsertRequest,
  AtcItemDefinitionBulkUpsertResponse,
  AtcItemMetadataValidationRequest,
  AtcItemMetadataValidationResponse,
  AtcItemCatalogQuery,
  AtcInventorySlot,
  AtcInventoryTransaction,
  AtcInventoryWeightSummary,
  AtcInventorySettings,
  AtcInventoryCapacitySummary,
  AtcInventoryResponse,
  AtcInventoryMutationResponse,
  AtcInventoryAddRequest,
  AtcInventoryRemoveRequest,
  AtcInventoryMoveRequest,
  AtcUpsertItemDefinitionRequest,
  AtcItemActionType,
  AtcItemEffectConfig,
  AtcItemActionConfig,
  AtcItemUseRequest,
  AtcItemEffectResult,
  AtcItemUseResponse,
  AtcItemCooldown,
  AtcItemRuntimeValidationResult,
} from './inventory.js'

export type {
  AtcVitalName,
  AtcVitalsMutationMode,
  AtcVitalsEventSource,
  AtcCharacterVitals,
  AtcVitalsPatch,
  AtcVitalsUpdateRequest,
  AtcVitalsMutationRequest,
  AtcVitalsResponse,
  AtcVitalsChangedEvent,
  AtcVitalsDecayConfig,
} from './vitals.js'

export type {
  AtcStatusEffectType,
  AtcStatusEffectSeverity,
  AtcStatusEffectSource,
  AtcStatusEffect,
  AtcApplyStatusEffectRequest,
  AtcStatusEffectsResponse,
  AtcStatusEffectChangedEvent,
} from './status-effects.js'

export type {
  AtcCurrencyCode,
  AtcWalletStatus,
  AtcMoneyAccount,
  AtcTransactionType,
  AtcTransactionSource,
  AtcWallet,
  AtcWalletTransaction,
  AtcWalletBalanceResponse,
  AtcWalletCreditRequest,
  AtcWalletDebitRequest,
  AtcWalletTransferRequest,
  AtcWalletMutationResponse,
  AtcWalletTransactionListResponse,
} from './wallet.js'

export type {
  AtcPluginCapability,
  AtcPluginMetrics,
} from './plugin-runtime.js'

export type {
  AtcTelemetryMetricKind,
  AtcTelemetryMetric,
  AtcTelemetrySnapshot,
} from './telemetry.js'

export type {
  AtcEventBusMetrics,
  AtcDistributedEventEnvelope,
} from './event-metrics.js'

export type {
  AtcPluginRuntimeStatus,
  AtcPluginHealthStatus,
  AtcPluginDependency,
  AtcPluginLifecycleMetrics,
  AtcPluginHealthRecord,
  AtcPluginRecord,
  AtcRegistryManifest,
  AtcPluginHooks,
  AtcPluginLogger,
  AtcPluginPersistedState,
  AtcPluginMetricsSnapshot,
  AtcPluginResourceUsage,
  AtcPluginHealthSnapshot,
} from './plugin-registry.js'

export type {
  AtcPluginApiResult,
  AtcPluginCleanupRegistrar,
  AtcPluginVitalsApi,
  AtcPluginInventoryApi,
  AtcPluginWalletApi,
  AtcPluginStatusEffectsApi,
  AtcPluginEventsApi,
  AtcPluginTelemetryApi,
  AtcPluginServiceContainer,
  AtcPluginExtendedMetrics,
} from './plugin-runtime-api.js'

export type {
  AtcTaskState,
  AtcRetryPolicy,
  AtcTask,
  AtcWorkerMetrics,
  AtcQueueMetrics,
  AtcTaskRuntimeMetrics,
  AtcPluginTaskOptions,
  AtcPluginTasksApi,
  AtcStoredEvent,
  AtcEventRetentionPolicy,
} from './task-runtime.js'

export type {
  AtcRuntimeHealthStatus,
  AtcSubsystemHealth,
  AtcRuntimeHealthSnapshot,
  AtcDlqItem,
  AtcDlqPage,
  AtcEventPage,
  AtcStoredEventSummary,
  AtcRedisConnectionState,
  AtcRuntimeNodeRecord,
  AtcRuntimeNodeStatus,
  AtcClusterSnapshot,
} from './operations.js'

export type {
  AtcPrincipalType,
  AtcPluginTrustLevel,
  AtcRole,
  AtcPrincipal,
  AtcSecurityScope,
  AtcAuthorizationResult,
  AtcAuditEvent,
  PrincipalStatus,
  StoredPrincipal,
  RoleAssignment,
  CapabilityAssignment,
  SecurityEventRecord,
} from './iam.js'

export {
  IAM_READ_ONLY_CAPABILITIES,
  IAM_TRUST_CAPABILITY_LIMITS,
} from './iam.js'

export type {
  ShopType,
  ShopStatus,
  AtcShop,
  AtcShopItem,
  CommerceOrderType,
  CommerceOrderStatus,
  AtcCommerceOrder,
  AtcCommerceOrderPage,
  AtcCommerceReceipt,
  AtcCommerceReceiptPage,
  TaxRuleType,
  TaxRuleCategory,
  AtcTaxRule,
  AtcCommerceTransaction,
  CommerceTotals,
  AtcCommerceEventName,
} from './commerce.js'
export { ATC_COMMERCE_EVENTS } from './commerce.js'

export type {
  FinancialAccountType,
  FinancialAccountStatus,
  FinancialAccountOwnerType,
  FinancialAccount,
  FinancialAccountPage,
  JournalStatus,
  JournalEntryType,
  JournalSource,
  FinancialJournal,
  FinancialEntry,
  FinancialJournalWithEntries,
  FinancialJournalPage,
  OrganizationType,
  OrganizationStatus,
  OrganizationMemberRole,
  Organization,
  OrganizationMember,
  InvoiceStatus,
  InvoicePartyType,
  Invoice,
  InvoicePayment,
  InvoicePage,
} from './economy.js'

export type {
  JobType,
  JobStatus,
  AtcJob,
  AtcJobPage,
  AtcJobGrade,
  AtcProfession,
  EmploymentStatus,
  AtcEmploymentContract,
  AtcEmploymentContractPage,
  WorkSessionStatus,
  AtcWorkSession,
  AtcWorkSessionPage,
  PayrollStatus,
  AtcPayrollRun,
  AtcPayrollRunEntry,
  AtcJobPermission,
  AtcJobEventName,
} from './jobs.js'
export { ATC_JOB_EVENTS } from './jobs.js'

export type {
  AtcAgencyType,
  AtcAgencyStatus,
  AtcAgency,
  AtcLawSeverity,
  AtcWarrantStatus,
  AtcWarrant,
  AtcCitationStatus,
  AtcCitation,
  AtcArrestRecord,
  AtcJailStatus,
  AtcJailRecord,
  AtcCustodyEntry,
  AtcEvidenceRecord,
  AtcLegalCaseStatus,
  AtcLegalCase,
  AtcLawEventName,
} from './law.js'
export { ATC_LAW_EVENTS } from './law.js'

export type {
  AtcDispatchPriority,
  AtcIncidentStatus,
  AtcResponderStatus,
  AtcDispatchSource,
  AtcBoloStatus,
  AtcIncidentNote,
  AtcIncident,
  AtcDispatchCall,
  AtcResponderAssignment,
  AtcBoloNote,
  AtcBoloRecord,
  AtcDispatchEventName,
} from './dispatch.js'
export { ATC_DISPATCH_EVENTS } from './dispatch.js'

export type {
  AtcMdtCharacterProfile,
  AtcMdtSituationSnapshot,
  AtcMdtWarrantSummary,
  AtcMdtEvidenceSummary,
  AtcMdtJailState,
  AtcMdtResponderSummary,
  AtcMdtIncidentSummary,
  AtcMdtSearchResultType,
  AtcMdtSearchResultItem,
  AtcMdtSearchResult,
} from './mdt.js'

export type {
  AtcMedicalSeverity,
  AtcBodyRegion,
  AtcTraumaState,
  AtcHospitalStatus,
  AtcTreatmentType,
  AtcInjuryRecord,
  AtcTraumaRecord,
  AtcTreatmentRecord,
  AtcMedicalReport,
  AtcHospitalRecord,
  AtcReviveRequest,
  AtcMedicalEventName,
} from './medical.js'
export { ATC_MEDICAL_EVENTS } from './medical.js'

export type {
  AtcEntityType,
  AtcEntityVisibility,
  AtcEntityAliasKind,
  AtcRelationshipKind,
  AtcEntityReference,
  AtcEntityAlias,
  AtcEntityNode,
  AtcRelationshipEdge,
  AtcCrossReference,
  AtcEntityNeighbor,
  AtcEntityRelationshipPage,
  AtcEntityRelatedGraph,
  AtcEntityHistoryEntry,
  AtcEntityHistoryPage,
  AtcEntitySearchHit,
  AtcEntitySearchResult,
} from './entity-graph.js'
export { ATC_ENTITY_TYPES } from './entity-graph.js'

export type {
  AtcEmergencyStatus,
  AtcTriageCategory,
  AtcAmbulanceStatus,
  AtcEmsEmergency,
  AtcEmsEmergencyAudit,
  AtcAmbulanceUnit,
  AtcHospitalCapacity,
  AtcReviveAudit,
} from './ems.js'
export { ATC_EMS_EVENTS } from './ems.js'

export type {
  AtcVehicleStatus,
  AtcVehicleCategory,
  AtcImpoundReason,
  AtcVehicle,
  AtcVehicleRuntime,
  AtcVehicleGarageRecord,
  AtcVehicleImpound,
  AtcVehicleFleetAssignment,
  AtcVehicleWithRuntime,
  AtcGarageSummary,
} from './vehicle.js'
export { ATC_VEHICLE_EVENTS } from './vehicle.js'

export type {
  AtcPropertyStatus,
  AtcPropertyAccessType,
  AtcPropertyAlarmState,
  AtcPropertyStashType,
  AtcProperty,
  AtcPropertyAccess,
  AtcPropertyKey,
  AtcPropertyStash,
  AtcPropertyStashItem,
  AtcPropertyGarage,
  AtcPropertyRuntime,
  AtcPropertyOccupant,
} from './property.js'
export { ATC_PROPERTY_EVENTS } from './property.js'

export type {
  AtcWeaponCategory,
  AtcWeaponStatus,
  AtcCombatSessionStatus,
  AtcCombatBodyRegion,
  AtcInjurySeverity,
  AtcWeaponRegistration,
  AtcWeaponRuntime,
  AtcDamageEvent,
  AtcCombatSession,
  AtcBallisticsRecord,
  AtcCombatInjury,
  AtcCombatEventName,
} from './combat.js'
export { ATC_COMBAT_EVENTS } from './combat.js'

export type {
  AtcGangStatus,
  AtcGangMemberRank,
  AtcOperationStatus,
  AtcOperationType,
  AtcRaidStatus,
  AtcRaidOutcome,
  AtcContrabandStatus,
  AtcGang,
  AtcGangMember,
  AtcCriminalOperation,
  AtcContraband,
  AtcBlackMarketTransaction,
  AtcRaid,
  AtcCriminalEventName,
} from './criminal.js'
export { ATC_CRIMINAL_EVENTS } from './criminal.js'

export type {
  AtcWorldEntityStatus,
  AtcWorldEntityType,
  AtcSceneStatus,
  AtcPersistentSceneType,
  AtcCleanupReason,
  AtcWorldEntity,
  AtcSceneRuntime,
  AtcEntityOwnership,
  AtcPersistentScene,
  AtcRuntimeCleanup,
  AtcWorldEventName,
} from './world.js'
export { ATC_WORLD_EVENTS } from './world.js'

export type {
  AtcFuelGrade,
  AtcVehicleRegistrationStatus,
  AtcVehicleViolationType,
  AtcPursuitStatus,
  AtcVehicleFuel,
  AtcVehicleDamageRuntime,
  AtcVehicleRegistration,
  AtcVehicleTrafficViolation,
  AtcVehiclePursuit,
  AtcVehicleRuntimeMetrics,
  AtcVehicleSimEventName,
} from './vehicle-simulation.js'
export { ATC_VEHICLE_SIM_EVENTS } from './vehicle-simulation.js'

export type {
  AtcBankAccountType,
  AtcBankTransactionType,
  AtcBankTransactionStatus,
  AtcMarketListingStatus,
  AtcAuctionStatus,
  AtcTaxType,
  AtcTaxStatus,
  AtcFinancialFlagType,
  AtcFinancialFlagSeverity,
  AtcBankAccount,
  AtcBankTransaction,
  AtcMarketListing,
  AtcMarketAuction,
  AtcTaxRecord,
  AtcFinancialFlag,
  AtcMarketEventName,
} from './market-runtime.js'
export { ATC_MARKET_EVENTS } from './market-runtime.js'

export type {
  AtcFactionType,
  AtcFactionStatus,
  AtcTerritoryType,
  AtcClaimType,
  AtcClaimStatus,
  AtcConflictType,
  AtcConflictStatus,
  AtcConflictOutcome,
  AtcResourceNodeType,
  AtcFaction,
  AtcTerritory,
  AtcTerritoryClaim,
  AtcFactionConflict,
  AtcResourceNode,
  AtcInfluenceRecord,
  AtcFactionEventName,
} from './faction-runtime.js'
export { ATC_FACTION_EVENTS } from './faction-runtime.js'
