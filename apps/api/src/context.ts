import type { DbPool } from '@atc/db'
import type { RedisClient } from '@atc/cache'
import type {
  AccountRepository,
  SessionRepository,
  BanRepository,
  CharacterRepository,
  WalletRepository,
  ItemDefinitionRepository,
  InventoryRepository,
  VitalsRepository,
} from '@atc/db'
import type { SessionCache, VitalsCache, RateLimiter, StatusEffectCache } from '@atc/cache'
import type { ItemRuntimeExecutor } from '@atc/runtime-items'
import type { AtcEventBus } from '@atc/events'
import type { AtcTelemetryService } from '@atc/telemetry'
import type { AtcPluginRegistry, AtcPluginLifecycleManager, AtcPluginScopedEventBus } from '@atc/plugin-registry'
import type { AtcPluginStateService } from '@atc/plugin-state'
import type { AtcPluginContainer } from '@atc/plugin-runtime'
import type { AtcTaskRuntime, AtcSchedulerLeaderElection } from '@atc/task-runtime'
import type { AtcEventStore } from '@atc/event-store'
import type { AtcRuntimeNodeService } from '@atc/runtime-node'
import type { AtcAuthorizationEngine, AtcIamCache } from '@atc/iam'
import type { AtcAuditService } from '@atc/audit'
import type {
  PrincipalRepository,
  RoleAssignmentRepository,
  PrincipalCapabilityRepository,
  SecurityEventRepository,
} from '@atc/principal-store'
import type { LedgerService, AccountRepository as FinancialAccountRepository } from '@atc/ledger'
import type { OrganizationRepository, MemberRepository, InvoiceRepository } from '@atc/organization'
import type {
  CommerceService,
  ShopRepository,
  ShopItemRepository,
  OrderRepository,
  ReceiptRepository,
  TaxRuleRepository,
} from '@atc/commerce'
import type {
  JobRepository,
  JobGradeRepository,
  ProfessionRepository,
  EmploymentContractRepository,
  WorkSessionRepository,
  PayrollRepository,
  PayrollService,
} from '@atc/jobs'
import type {
  AgencyRepository,
  WarrantRepository,
  CitationRepository,
  ArrestRepository,
  JailRepository,
  EvidenceRepository,
  LegalCaseRepository,
  LawEnforcementService,
} from '@atc/law'
import type {
  DispatchCallRepository,
  IncidentRepository,
  ResponderAssignmentRepository,
  BoloRepository,
  DispatchService,
} from '@atc/dispatch'
import type { MdtService } from '@atc/mdt'
import type {
  MedicalService,
  InjuryRepository,
  TraumaRepository,
  TreatmentRepository,
  MedicalReportRepository,
  HospitalRepository,
} from '@atc/medical'
import type {
  EmergencyRuntimeService,
  EmergencyRepository,
  AmbulanceRepository,
  HospitalCapacityRepository,
  ReviveWorkflowService,
} from '@atc/ems-runtime'
import type { AtcEntityGraphSDK } from '@atc/entity-graph'
import type { AtcEntityIntelligenceSDK } from '@atc/entity-correlation'
import type { AtcMedicalIntelligenceSDK } from '@atc/medical-intelligence'
import type {
  VehicleRuntimeService,
  VehicleRepository,
  VehicleRuntimeRepository,
  GarageRepository,
  ImpoundRepository,
  FleetRepository,
  GarageService,
  ImpoundService,
  FleetService,
} from '@atc/vehicle-runtime'
import type {
  PropertyRuntimeService,
  PropertyRepository,
  PropertyAccessRepository,
  PropertyStashRepository,
  PropertyGarageRepository,
  PropertyRuntimeRepository,
  InteriorStateService,
  PropertyAccessService,
  StorageContainerService,
  PropertyGarageService,
  EmergencyAccessService,
} from '@atc/property-runtime'
import type {
  CombatRuntimeService,
  DamageService,
  WeaponStateService,
  BallisticsService,
  InjuryPropagationService,
  CombatAuditService,
  WeaponRepository,
  WeaponRuntimeRepository,
  DamageRepository,
  CombatSessionRepository,
  BallisticsRepository,
  InjuryRepository as CombatInjuryRepository,
} from '@atc/combat-runtime'
import type {
  CriminalRuntimeService,
  GangOperationService,
  ContrabandService,
  BlackMarketService,
  IllegalTradeService,
  RaidRuntimeService,
  GangRepository,
  GangMemberRepository,
  CriminalOperationRepository,
  ContrabandRepository,
  BlackMarketRepository,
  RaidRepository,
} from '@atc/criminal-runtime'
import type {
  WorldRuntimeService,
  SceneSynchronizationService,
  PersistentSceneService,
  EntityOwnershipService,
  RuntimeReplicationService,
  CleanupOrchestrationService,
  WorldEntityRepository,
  SceneRuntimeRepository,
  EntityOwnershipRepository,
  PersistentSceneRepository,
  RuntimeCleanupRepository,
} from '@atc/world-runtime'
import type {
  VehicleSimulationService,
  FuelRuntimeService,
  DamageRuntimeService,
  RegistrationRuntimeService,
  PursuitRuntimeService,
  TrafficControlService,
  FuelRepository,
  DamageRuntimeRepository,
  RegistrationRepository,
  PursuitRepository,
  TrafficViolationRepository,
  RuntimeMetricsRepository,
} from '@atc/vehicle-simulation'
import type {
  BankingRuntimeService,
  MarketplaceService,
  AuctionRuntimeService,
  TaxationRuntimeService,
  FinancialFraudService,
  BankAccountRepository,
  BankTransactionRepository,
  MarketListingRepository,
  MarketAuctionRepository,
  TaxRecordRepository,
  FinancialFlagRepository,
} from '@atc/market-runtime'
import type {
  FactionRuntimeService,
  TerritoryControlService,
  InfluenceRuntimeService,
  ConflictRuntimeService,
  ZoneClaimService,
  ResourceNodeService,
  FactionRepository,
  TerritoryRepository,
  TerritoryClaimRepository,
  FactionConflictRepository,
  ResourceNodeRepository,
  InfluenceRuntimeRepository,
} from '@atc/faction-runtime'
import type { Logger } from './logger.js'

export interface PrincipalStore {
  principals: PrincipalRepository
  roleAssignments: RoleAssignmentRepository
  capabilities: PrincipalCapabilityRepository
  securityEvents: SecurityEventRepository
}

export interface AppContext {
  pool: DbPool
  redis: RedisClient
  accounts: AccountRepository
  sessions: SessionRepository
  bans: BanRepository
  characters: CharacterRepository
  wallets: WalletRepository
  itemDefinitions: ItemDefinitionRepository
  inventory: InventoryRepository
  vitals: VitalsRepository
  sessionCache: SessionCache
  vitalsCache: VitalsCache
  itemRuntime: ItemRuntimeExecutor
  eventBus: AtcEventBus
  vitalsRateLimiter: RateLimiter
  statusEffectsCache: StatusEffectCache
  telemetry: AtcTelemetryService
  pluginRegistry: AtcPluginRegistry
  pluginState: AtcPluginStateService
  pluginLifecycle: AtcPluginLifecycleManager
  scopedEventBus: AtcPluginScopedEventBus
  taskRuntime: AtcTaskRuntime
  eventStore: AtcEventStore
  runtimeNode?: AtcRuntimeNodeService
  leaderElection?: AtcSchedulerLeaderElection
  pluginContainers?: Map<string, AtcPluginContainer>
  authEngine?: AtcAuthorizationEngine
  auditService?: AtcAuditService
  iamCache?: AtcIamCache
  principalStore?: PrincipalStore
  ledger?: LedgerService
  financialAccounts?: FinancialAccountRepository
  organizations?: OrganizationRepository
  members?: MemberRepository
  invoices?: InvoiceRepository
  commerceService?: CommerceService
  commerceShops?: ShopRepository
  commerceShopItems?: ShopItemRepository
  commerceOrders?: OrderRepository
  commerceReceipts?: ReceiptRepository
  commerceTaxRules?: TaxRuleRepository
  jobRepo?: JobRepository
  jobGradeRepo?: JobGradeRepository
  professionRepo?: ProfessionRepository
  employmentRepo?: EmploymentContractRepository
  workSessionRepo?: WorkSessionRepository
  payrollRepo?: PayrollRepository
  payrollService?: PayrollService
  lawService?: LawEnforcementService
  lawAgencyRepo?: AgencyRepository
  lawWarrantRepo?: WarrantRepository
  lawCitationRepo?: CitationRepository
  lawArrestRepo?: ArrestRepository
  lawJailRepo?: JailRepository
  lawEvidenceRepo?: EvidenceRepository
  lawCaseRepo?: LegalCaseRepository
  dispatchService?: DispatchService
  dispatchCallRepo?: DispatchCallRepository
  incidentRepo?: IncidentRepository
  responderRepo?: ResponderAssignmentRepository
  boloRepo?: BoloRepository
  mdtService?: MdtService
  medicalService?: MedicalService
  injuryRepo?: InjuryRepository
  traumaRepo?: TraumaRepository
  treatmentRepo?: TreatmentRepository
  reportRepo?: MedicalReportRepository
  hospitalRepo?: HospitalRepository
  emsRuntimeService?: EmergencyRuntimeService
  emsEmergencyRepo?: EmergencyRepository
  emsAmbulanceRepo?: AmbulanceRepository
  emsHospitalCapacityRepo?: HospitalCapacityRepository
  emsReviveWorkflow?: ReviveWorkflowService
  entityGraphSdk?: AtcEntityGraphSDK
  entityIntelSdk?: AtcEntityIntelligenceSDK
  medicalIntelSdk?: AtcMedicalIntelligenceSDK
  vehicleRuntimeService?: VehicleRuntimeService
  vehicleRepo?: VehicleRepository
  vehicleRuntimeRepo?: VehicleRuntimeRepository
  garageRepo?: GarageRepository
  impoundRepo?: ImpoundRepository
  fleetRepo?: FleetRepository
  garageService?: GarageService
  impoundService?: ImpoundService
  fleetService?: FleetService
  propertyRuntimeService?: PropertyRuntimeService
  propertyRepo?: PropertyRepository
  propertyAccessRepo?: PropertyAccessRepository
  propertyStashRepo?: PropertyStashRepository
  propertyGarageRepo?: PropertyGarageRepository
  propertyRuntimeRepo?: PropertyRuntimeRepository
  interiorStateService?: InteriorStateService
  propertyAccessService?: PropertyAccessService
  storageContainerService?: StorageContainerService
  propertyGarageService?: PropertyGarageService
  emergencyAccessService?: EmergencyAccessService
  combatRuntimeService?: CombatRuntimeService
  damageService?: DamageService
  weaponStateService?: WeaponStateService
  ballisticsService?: BallisticsService
  injuryPropagationService?: InjuryPropagationService
  combatAuditService?: CombatAuditService
  weaponRepo?: WeaponRepository
  weaponRuntimeRepo?: WeaponRuntimeRepository
  damageRepo?: DamageRepository
  combatSessionRepo?: CombatSessionRepository
  ballisticsRepo?: BallisticsRepository
  combatInjuryRepo?: CombatInjuryRepository
  criminalRuntimeService?: CriminalRuntimeService
  gangOperationService?: GangOperationService
  contrabandService?: ContrabandService
  blackMarketService?: BlackMarketService
  illegalTradeService?: IllegalTradeService
  raidRuntimeService?: RaidRuntimeService
  gangRepo?: GangRepository
  gangMemberRepo?: GangMemberRepository
  criminalOperationRepo?: CriminalOperationRepository
  contrabandRepo?: ContrabandRepository
  blackMarketRepo?: BlackMarketRepository
  raidRepo?: RaidRepository
  worldRuntimeService?: WorldRuntimeService
  sceneSynchronizationService?: SceneSynchronizationService
  persistentSceneService?: PersistentSceneService
  entityOwnershipService?: EntityOwnershipService
  runtimeReplicationService?: RuntimeReplicationService
  cleanupOrchestrationService?: CleanupOrchestrationService
  worldEntityRepo?: WorldEntityRepository
  sceneRuntimeRepo?: SceneRuntimeRepository
  entityOwnershipRepo?: EntityOwnershipRepository
  persistentSceneRepo?: PersistentSceneRepository
  runtimeCleanupRepo?: RuntimeCleanupRepository
  vehicleSimService?: VehicleSimulationService
  fuelRuntimeService?: FuelRuntimeService
  damageRuntimeService?: DamageRuntimeService
  registrationRuntimeService?: RegistrationRuntimeService
  pursuitRuntimeService?: PursuitRuntimeService
  trafficControlService?: TrafficControlService
  fuelRepo?: FuelRepository
  vehicleDamageRepo?: DamageRuntimeRepository
  vehicleRegistrationRepo?: RegistrationRepository
  pursuitRepo?: PursuitRepository
  trafficViolationRepo?: TrafficViolationRepository
  vehicleMetricsRepo?: RuntimeMetricsRepository
  bankingRuntimeService?: BankingRuntimeService
  marketplaceService?: MarketplaceService
  auctionRuntimeService?: AuctionRuntimeService
  taxationRuntimeService?: TaxationRuntimeService
  financialFraudService?: FinancialFraudService
  bankAccountRepo?: BankAccountRepository
  bankTransactionRepo?: BankTransactionRepository
  marketListingRepo?: MarketListingRepository
  marketAuctionRepo?: MarketAuctionRepository
  taxRecordRepo?: TaxRecordRepository
  financialFlagRepo?: FinancialFlagRepository
  factionRuntimeService?: FactionRuntimeService
  territoryControlService?: TerritoryControlService
  influenceRuntimeService?: InfluenceRuntimeService
  conflictRuntimeService?: ConflictRuntimeService
  zoneClaimService?: ZoneClaimService
  resourceNodeService?: ResourceNodeService
  factionRepo?: FactionRepository
  territoryRepo?: TerritoryRepository
  territoryClaimRepo?: TerritoryClaimRepository
  factionConflictRepo?: FactionConflictRepository
  resourceNodeRepo?: ResourceNodeRepository
  influenceRepo?: InfluenceRuntimeRepository
  logger: Logger
}
