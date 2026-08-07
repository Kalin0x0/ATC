// GENERATED — do not edit by hand.
//
// AppContext declares one optional field per runtime service, and index.ts used
// to construct thirty of them. Every route begins with a `if (!ctx.thing) return
// 503` guard, so the rest of the API answered 503 for services that existed and
// were merely never built.
//
// The constructors are regular enough to derive rather than transcribe: most
// take the shared connection pool, the rest take other services and the event
// bus. This file is generated from the built type declarations by
// tools/scripts/generate-wiring.py; run that after adding or changing a
// service, and read the list of skipped ones it prints.
//
// Construction is side-effect free — no constructor in these packages opens a
// connection or starts a timer — so building them all at startup costs a few
// hundred object allocations and nothing else.

import type { DbPool } from '@atc/db'
import type { RedisClient } from '@atc/cache'
import type { AtcEventBus } from '@atc/events'
import type { AtcTelemetryService } from '@atc/telemetry'
import {
  AiAuditRepository,
  AiPatrolRepository,
  AiRecoveryService,
  AiReinforcementRepository,
  AiResponseRuntimeRepository,
  AiRuntimeRepository,
  AiRuntimeService,
  AiThreatAssessmentRepository,
  AutonomousPatrolService,
  ReinforcementCoordinationService,
  TacticalResponseService,
  ThreatAssessmentService,
} from '@atc/ai-runtime'
import {
  AtcAuditService,
} from '@atc/audit'
import {
  CityInfrastructureRepository,
  CityInfrastructureService,
  EnvironmentRuntimeRepository,
  EnvironmentRuntimeService,
  InfrastructureFailureRepository,
  InfrastructureRecoveryService,
  ResourceConsumptionRepository,
  ResourceConsumptionService,
  TrafficSignalRepository,
  TrafficSignalService,
  UtilityGridRepository,
  UtilityGridService,
} from '@atc/city-runtime'
import {
  ClusterAllocationService,
  ClusterAuditRepository,
  ClusterNodeRepository,
  ClusterRuntimeService,
  ClusterScalingRepository,
  DeploymentOrchestrationService,
  DistributedDeploymentRecoveryService,
  NodeLifecycleRepository,
  NodeLifecycleService,
  RuntimeAllocationRepository as RuntimeAllocationRepository_cluster_runtime,
  RuntimeDeploymentRepository,
  RuntimeScalingService,
} from '@atc/cluster-runtime'
import {
  BallisticsRepository,
  BallisticsService,
  CombatAuditService,
  CombatRuntimeService,
  CombatSessionRepository,
  DamageRepository,
  DamageService,
  InjuryPropagationService,
  InjuryRepository as InjuryRepository_combat_runtime,
  WeaponRepository,
  WeaponRuntimeRepository,
  WeaponStateService,
} from '@atc/combat-runtime'
import {
  ArmorPenetrationService,
  ArmorRuntimeRepository,
  BallisticsRuntimeRepository,
  BallisticsRuntimeService,
  CombatAuditRepository,
  CombatRecoveryService,
  CombatRuntimeRepository,
  CombatSimulationService,
  SuppressionRuntimeRepository,
  SuppressionRuntimeService,
  TacticalDamageRepository,
  TacticalDamageService,
} from '@atc/combat-simulation-runtime'
import {
  CommerceService,
  OrderRepository,
  ReceiptRepository,
  ShopItemRepository,
  ShopRepository,
  TaxRuleRepository,
} from '@atc/commerce'
import {
  CommunicationAuditRepository,
  EmergencyBroadcastRepository,
  EmergencyBroadcastService,
  EncryptedChannelRepository,
  EncryptionRuntimeService,
  RadioChannelRepository,
  RadioMembershipRepository,
  RadioRuntimeService,
  SignalRuntimeRepository,
  SignalRuntimeService,
} from '@atc/communication-runtime'
import {
  CheckpointRuntimeRepository,
  ContinuityAuditRepository,
  ContinuityRuntimeRepository,
  ContinuityRuntimeService,
  DistributedContinuityService,
  InfinitePersistenceRepository,
  InfinitePersistenceService,
  RuntimeCheckpointCoordinator,
  TemporalIntegrityRecoveryService,
  TemporalIntegrityRepository,
  TemporalRecoveryRepository,
  TemporalRecoveryService,
} from '@atc/continuity-runtime'
import {
  CoreClosureAuditRepository,
  CoreClosureRepository,
  CoreClosureService,
  DeterministicCompletionValidator,
  DistributedClosureOrchestrator,
  DistributedClosureRepository,
  FinalRecoveryCoordinator,
  FinalValidationRepository,
  ProductionFreezeRepository,
  ProductionImmutabilityService,
  RuntimeFreezeCoordinator,
  RuntimeImmutabilityRepository,
} from '@atc/core-closure-runtime'
import {
  CoreFinalizationAuditRepository,
  CoreFinalizationRepository,
  CoreFinalizationService,
  DeterministicSealService,
  DeterministicSealingRepository,
  DistributedFinalSealService,
  FinalizationCoordinationRepository,
  FinalizationRecoveryService,
  ProductionCompletionService,
  ProductionSealRepository,
  RuntimeCompletionCoordinator,
  RuntimeCompletionRepository,
} from '@atc/core-finalization-runtime'
import {
  BlueprintService,
  CraftingAuditRepository,
  CraftingBlueprintRepository,
  CraftingRecipeRepository,
  ManufacturingQueueRepository,
  ManufacturingQueueService,
  ProductionJobRepository,
  ProductionJobService,
} from '@atc/crafting-runtime'
import {
  BlackMarketRepository,
  BlackMarketService,
  ContrabandRepository,
  ContrabandService,
  CriminalOperationRepository,
  CriminalRuntimeService,
  GangMemberRepository,
  GangOperationService,
  GangRepository,
  IllegalTradeService,
  RaidRepository,
  RaidRuntimeService,
} from '@atc/criminal-runtime'
import {
  ContractValidationRepository,
  DeveloperAuditRepository,
  DeveloperPlatformRepository,
  DeveloperPlatformService,
  DeveloperRecoveryService,
  ExtensionLifecycleService,
  ExtensionRuntimeRepository,
  PluginCompatibilityRepository,
  PluginCompatibilityService,
  RuntimeContractValidationService,
  RuntimeSdkRegistryService,
  SdkRegistryRepository,
} from '@atc/developer-platform'
import {
  DisasterAuditRepository,
  DisasterEventRepository,
  DisasterRuntimeService,
  EmergencyResponseRepository,
  EmergencyResponseService,
  EvacuationRuntimeRepository,
  EvacuationRuntimeService,
  HazardZoneRepository,
  RecoveryOrchestrationService,
  RecoveryRuntimeRepository,
} from '@atc/disaster-runtime'
import {
  BoloRepository,
  DispatchCallRepository,
  DispatchService,
  IncidentRepository,
  ResponderAssignmentRepository,
} from '@atc/dispatch'
import {
  ClimatePersistenceService,
  ClimateRuntimeRepository,
  EcologyAuditRepository,
  EcologyRecoveryService,
  EcologyRuntimeRepository,
  EcologyRuntimeService,
  EnvironmentalEvolutionRepository,
  EnvironmentalEvolutionService,
  ResourceRegenerationRepository,
  ResourceRegenerationService,
  WildlifeRuntimeRepository,
  WildlifeSimulationService,
} from '@atc/ecology-runtime'
import {
  AutonomousTaxAdjustmentService,
  EconomicRecoveryService,
  EconomyAuditRepository,
  EconomyRegulationRepository,
  EconomyRegulationService,
  InflationControlService,
  InflationRuntimeRepository,
  MarketStabilizationRepository,
  MarketStabilizationService,
  ResourceBalancingRepository,
  ResourceBalancingService,
  TaxRuntimeRepository,
} from '@atc/economy-regulation-runtime'
import {
  AmbulanceDispatchService,
  AmbulanceRepository,
  EmergencyRepository,
  EmergencyRuntimeService,
  HospitalCapacityRepository,
  HospitalCapacityService,
  MedicalEscalationService,
  ReviveAuditRepository,
  TriageService,
} from '@atc/ems-runtime'
import {
  DeterministicAuditRepository,
  DeterministicAuditService,
  DistributedAuditOrchestrator,
  DistributedAuditRepository,
  EnterpriseAuditRepository,
  EnterpriseReadinessRepository,
  EnterpriseReadinessService,
  EnterpriseRecoveryService,
  IntegrityVerificationRepository,
  ProductionReadinessCoordinator,
  ProductionReadinessRepository,
  RuntimeIntegrityVerificationService,
} from '@atc/enterprise-readiness-runtime'
import {
  AtcEntityIntelligenceSDK,
} from '@atc/entity-correlation'
import {
  AtcEntityGraphSDK,
  EntityRegistryRepository,
  RelationshipRepository,
} from '@atc/entity-graph'
import {
  AdaptiveOptimizationRepository,
  AdaptiveOptimizationService,
  AutonomousEvolutionRepository,
  AutonomousEvolutionService,
  DistributedOptimizationRepository,
  DistributedOptimizationService,
  EvolutionAuditRepository,
  EvolutionRecoveryService,
  EvolutionRuntimeService,
  RuntimeEvolutionRepository,
  RuntimeTuningRepository,
  RuntimeTuningService,
} from '@atc/evolution-runtime'
import {
  ConflictRuntimeService,
  FactionConflictRepository,
  FactionRepository,
  FactionRuntimeService,
  InfluenceRuntimeRepository,
  InfluenceRuntimeService,
  ResourceNodeRepository,
  ResourceNodeService,
  TerritoryClaimRepository,
  TerritoryControlService,
  TerritoryRepository,
  ZoneClaimService,
} from '@atc/faction-runtime'
import {
  FederationAuditRepository,
  FederationNodeRepository,
  FederationOwnershipRepository,
  FederationOwnershipService,
  FederationRecoveryService,
  FederationRuntimeService,
  InterclusterRouteRepository,
  InterclusterRoutingService,
  MultiRegionSyncService,
  RegionRuntimeRepository,
  RegionalConsistencyRepository,
  RegionalConsistencyService,
} from '@atc/federation-runtime'
import {
  CrossSystemArbitrationRepository,
  CrossSystemArbitrationService,
  DistributedPolicyCoordinator,
  GlobalGovernanceRepository,
  GlobalGovernanceService,
  GlobalOwnershipAuthority,
  GlobalOwnershipRepository,
  GlobalPolicyRepository,
  GovernanceContinuityAuditRepository,
  GovernanceContinuityService,
  RuntimeConsensusRepository,
  RuntimeConsensusService,
} from '@atc/global-governance-runtime'
import {
  AutonomousPolicyService,
  CivicInfluenceRepository,
  CivicInfluenceService,
  ElectionRepository,
  GovernanceAuditRepository,
  GovernanceRecoveryService,
  GovernanceRuntimeRepository,
  GovernanceRuntimeService,
  LegislativeRepository,
  LegislativeRuntimeService,
  PolicyRepository,
  PoliticalElectionService,
} from '@atc/governance-runtime'
import {
  AssetValuationRepository,
  AssetValuationService,
  ForeclosureRepository,
  ForeclosureService,
  HousingEconomyService,
  HousingPaymentRepository,
  PropertyTaxRepository,
  PropertyTaxService,
  RentalContractRepository,
  RentalContractService,
  TenantHistoryRepository,
  TenantManagementService,
} from '@atc/housing-economy'
import {
  AtcIamCache,
} from '@atc/iam'
import {
  EmploymentContractRepository,
  JobGradeRepository,
  JobRepository,
  PayrollRepository,
  PayrollService,
  ProfessionRepository,
  WorkSessionRepository,
} from '@atc/jobs'
import {
  AgencyRepository,
  ArrestRepository,
  CitationRepository,
  EvidenceRepository,
  JailRepository,
  LawEnforcementService,
  LegalCaseRepository,
  WarrantRepository,
} from '@atc/law'
import {
  AccountRepository as AccountRepository_ledger,
  LedgerService,
} from '@atc/ledger'
import {
  CargoRuntimeRepository,
  DeliveryAuditRepository,
  LogisticsFleetRepository,
  LogisticsFleetService,
  ShipmentRepository,
  ShipmentService,
  SupplyChainRepository,
  SupplyChainService,
  SupplyRouteRepository,
  SupplyRouteService,
} from '@atc/logistics-runtime'
import {
  AuctionRuntimeService,
  BankAccountRepository,
  BankTransactionRepository,
  BankingRuntimeService,
  FinancialFlagRepository,
  FinancialFraudService,
  MarketAuctionRepository,
  MarketListingRepository,
  MarketplaceService,
  TaxRecordRepository,
  TaxationRuntimeService,
} from '@atc/market-runtime'
import {
  MdtService,
} from '@atc/mdt'
import {
  HospitalRepository,
  InjuryRepository as InjuryRepository_medical,
  MedicalReportRepository,
  MedicalService,
  TraumaRepository,
  TreatmentRepository,
} from '@atc/medical'
import {
  AutonomousHealingService,
  DistributedRepairRepository,
  DistributedRepairService,
  HealingOperationRepository,
  MetaAllocationRepository,
  MetaAllocationService,
  MetaAuditRepository,
  MetaRuntimeRepository,
  MetaRuntimeService,
  RuntimeCoordinationRepository,
  RuntimeCoordinationService,
  SelfHealingRecoveryService,
} from '@atc/meta-runtime'
import {
  DynamicEventRepository,
  DynamicEventService,
  MissionAssignmentRepository,
  MissionAuditRepository,
  MissionCleanupService,
  MissionObjectiveRepository,
  MissionProgressionService,
  MissionRepository,
  MissionRuntimeService,
  ObjectiveTrackingService,
  ScenarioOrchestrationService,
  ScenarioRuntimeRepository,
} from '@atc/mission-runtime'
import {
  CampaignOrchestrationService,
  CampaignRuntimeRepository,
  DynamicNarrativeService,
  DynamicStoryStateRepository,
  NarrativeAuditRepository,
  NarrativeRecoveryService,
  NarrativeRuntimeService,
  NarrativeSessionRepository,
  StoryProgressionRepository,
  StoryProgressionService,
  WorldEventRepository,
  WorldEventService,
} from '@atc/narrative-runtime'
import {
  AmbientBehaviorService,
  CrowdRuntimeRepository,
  CrowdSimulationService,
  DynamicSpawnService,
  NpcBehaviorRepository,
  NpcCleanupRepository,
  NpcRuntimeRepository,
  NpcRuntimeService,
  NpcSpawnPointRepository,
  PopulationZoneRepository,
} from '@atc/npc-runtime'
import {
  InvoiceRepository,
  MemberRepository,
  OrganizationRepository,
} from '@atc/organization'
import {
  DistributedSnapshotService,
  GlobalPersistenceService,
  GlobalSnapshotRepository,
  LongTermRecoveryService,
  LongtermRecoveryRepository,
  PersistenceAuditRepository,
  PersistenceConsistencyService,
  PersistenceRuntimeRepository,
  RuntimeArchivalService,
  SnapshotArchiveRepository,
  SnapshotCompressionRepository,
  SnapshotCompressionService,
} from '@atc/persistence-runtime'
import {
  EmergencyAccessService,
  InteriorStateService,
  PropertyAccessRepository,
  PropertyAccessService,
  PropertyGarageRepository,
  PropertyGarageService,
  PropertyRepository,
  PropertyRuntimeRepository,
  PropertyRuntimeService,
  PropertyStashRepository,
  StorageContainerService,
} from '@atc/property-runtime'
import {
  CrossNodeReconciliationService,
  NodeTransferRepository,
  OwnershipTransferService,
  ReconciliationRuntimeRepository,
  RuntimeConsistencyAuditRepository,
  RuntimeConsistencyService,
  RuntimeMigrationRepository,
  RuntimeMigrationService,
  RuntimeRecoveryRepository,
  RuntimeRecoveryService,
  SnapshotReplayRepository,
  SnapshotReplayService,
} from '@atc/reconciliation-runtime'
import {
  DistributedReleaseOrchestrator,
  GlobalDeploymentGovernanceService,
  GlobalReleaseRuntimeRepository,
  ProductionDeploymentCoordinator,
  ProductionDeploymentRepository,
  ReleaseAuditRepository,
  ReleaseGovernanceRepository,
  ReleaseGovernanceService,
  ReleaseOrchestrationRepository,
  ReleaseRecoveryService,
  ReleaseValidationRepository,
  RuntimeReleaseValidationService,
} from '@atc/release-governance-runtime'
import {
  InterestManagementService,
  InterestRegionRepository,
  ReplicationAuditRepository,
  ReplicationRuntimeService,
  RuntimeSnapshotRepository,
  RuntimeStreamingService,
  SnapshotSynchronizationService,
  SpatialNodeRepository,
  SpatialOwnershipRepository,
  SpatialOwnershipService,
  SpatialPartitionService,
  StreamingRuntimeRepository,
} from '@atc/replication-runtime'
import {
  DiplomacyService,
  DiplomaticRelationsRepository,
  FactionRelationshipService,
  InfluenceHistoryRepository,
  InfluenceTrackingService,
  RelationshipAuditRepository,
  ReputationDecayRepository,
  ReputationDecayService,
  ReputationRuntimeRepository,
  ReputationRuntimeService,
  SocialStandingRepository,
  SocialStandingService,
} from '@atc/reputation-runtime'
import {
  CertificationAuditRepository,
  CertificationRecoveryService,
  ComplianceCoordinationRepository,
  ComplianceEnforcementService,
  DeterministicValidationRepository,
  DeterministicValidationService,
  DistributedComplianceCoordinator,
  RuntimeCertificationRepository,
  RuntimeCertificationService,
  RuntimeComplianceRepository,
  RuntimeVerificationService,
  VerificationRuntimeRepository,
} from '@atc/runtime-certification'
import {
  AccessMeshRepository,
  DeterministicAccessMeshService,
  DistributedApiRoutingService,
  GatewayAuditRepository,
  GatewayRecoveryService,
  GatewayRoutingRepository,
  RuntimeExposureCoordinator,
  RuntimeExposureRepository,
  RuntimeGatewayRepository,
  RuntimeGatewayService,
  RuntimeSurfaceProtectionService,
  SurfaceProtectionRepository,
} from '@atc/runtime-gateway'
import {
  AutonomousThreatMitigationService,
  DistributedSecurityValidationService,
  HardeningAuditRepository,
  HardeningRecoveryService,
  ImmutableSecurityCoordinator,
  ImmutableSecurityRepository,
  RuntimeHardeningRepository,
  RuntimeHardeningService,
  RuntimeSealVerificationService,
  SealValidationRepository,
  SecurityValidationRepository,
  ThreatMitigationRepository,
} from '@atc/runtime-hardening'
import {
  DeterministicClosureRepository,
  DeterministicClosureService,
  DistributedFinalizationService,
  FinalizationRuntimeRepository,
  LockdownAuditRepository,
  LockdownRecoveryService,
  ProductionIntegrityRepository,
  ProductionIntegrityService,
  RuntimeLockdownRepository,
  RuntimeLockdownService,
  RuntimeSealRepository,
  RuntimeSealService,
} from '@atc/runtime-lockdown'
import {
  DistributedTracingService,
  FailureCorrelationRepository,
  FailureCorrelationService,
  ObservabilityAuditRepository,
  RuntimeDiagnosticsRepository,
  RuntimeDiagnosticsService,
  RuntimeMetricsRepository as RuntimeMetricsRepository_runtime_observability,
  RuntimeMetricsService,
  RuntimeTelemetryService,
  TraceRecoveryService,
  TraceRuntimeRepository,
  TraceRuntimeStateRepository,
} from '@atc/runtime-observability'
import {
  DistributedContractRegistry,
  FederationContractRepository,
  FederationContractService,
  InterSystemBridgeService,
  ProtocolAuditRepository,
  ProtocolBridgeRepository,
  ProtocolRecoveryService,
  ProtocolRegistryRepository,
  RuntimeHandshakeRepository,
  RuntimeHandshakeService,
  RuntimeProtocolRepository,
  RuntimeProtocolService,
} from '@atc/runtime-protocol'
import {
  ChaosRuntimeRepository,
  ChaosSimulationService,
  DistributedHealthRecoveryService,
  FailoverAuditRepository,
  FailoverOrchestrationService,
  RecoveryOperationRepository,
  RecoverySnapshotRepository,
  RuntimeFailoverRepository,
  RuntimeRecoveryCoordinator,
  RuntimeResilienceRepository,
  RuntimeResilienceService,
  SnapshotRecoveryService,
} from '@atc/runtime-resilience'
import {
  AutonomousFinalizationRepository,
  AutonomousFinalizationService,
  ClusterContinuityRepository,
  DistributedSovereigntyCoordinator,
  InfiniteClusterContinuityService,
  RuntimeSovereigntyRepository,
  RuntimeSovereigntyService,
  RuntimeSuccessionRepository,
  RuntimeSuccessionService,
  SovereigntyAuditRepository,
  SovereigntyCoordinationRepository,
  SovereigntyRecoveryService,
} from '@atc/runtime-sovereignty'
import {
  AutonomousMaintenanceRepository,
  AutonomousMaintenanceService,
  DistributedSustainmentRepository,
  DistributedSustainmentService,
  InfiniteRecoveryCoordinator,
  InfiniteRecoveryRepository,
  RuntimeLongevityRepository,
  RuntimeLongevityService,
  RuntimeSustainmentRepository,
  RuntimeSustainmentService,
  SustainmentAuditRepository,
  SustainmentRecoveryService,
} from '@atc/runtime-sustainment'
import {
  AutonomousProtectionService,
  RuntimeIntrusionDetectionService,
  RuntimeIntrusionRepository,
  RuntimeIsolationRepository,
  RuntimeIsolationService,
  RuntimeSecurityRecoveryService,
  RuntimeThreatRepository,
  SecurityAuditRepository,
  SecurityEscalationRepository,
  SecurityEscalationService,
  ThreatContainmentRepository,
  ThreatContainmentService,
} from '@atc/security-runtime'
import {
  EnvironmentalExposureRepository,
  EnvironmentalHazardRepository,
  EnvironmentalHazardService,
  FatigueRuntimeRepository,
  FatigueRuntimeService,
  HydrationRuntimeRepository,
  HydrationRuntimeService,
  SurvivalRuntimeRepository,
  SurvivalRuntimeService,
  TemperatureRuntimeRepository,
  TemperatureRuntimeService,
} from '@atc/survival-runtime'
import {
  AircraftRepository,
  AirspaceZoneRepository,
  AviationRuntimeService,
  DockingRuntimeRepository,
  FlightRuntimeRepository,
  MaritimeRuntimeService,
  TransportAuditRepository,
  VesselRepository,
} from '@atc/transport-runtime'
import {
  FleetRepository,
  FleetService,
  GarageRepository,
  GarageService,
  ImpoundRepository,
  ImpoundService,
  VehicleRepository,
  VehicleRuntimeRepository,
  VehicleRuntimeService,
} from '@atc/vehicle-runtime'
import {
  DamageRuntimeRepository,
  DamageRuntimeService,
  FuelRepository,
  FuelRuntimeService,
  PursuitRepository,
  PursuitRuntimeService,
  RegistrationRepository,
  RegistrationRuntimeService,
  RuntimeMetricsRepository as RuntimeMetricsRepository_vehicle_simulation,
  TrafficControlService,
  TrafficViolationRepository,
  VehicleSimulationService,
} from '@atc/vehicle-simulation'
import {
  DeterministicConsistencyService,
  DistributedLockRepository,
  DistributedLockingService,
  GlobalWorldValidationService,
  IntegrityAuditRepository,
  IntegrityRecoveryService,
  IntegrityValidationRepository,
  RuntimeConsistencyRepository,
  RuntimeIntegrityCoordinator,
  WorldIntegrityRepository,
  WorldIntegrityService,
  WorldReconciliationRepository,
} from '@atc/world-integrity-runtime'
import {
  DistributedShardService,
  PersistentWorldRecoveryService,
  RegionalSimulationRepository,
  RegionalSimulationService,
  RuntimeAllocationRepository as RuntimeAllocationRepository_world_orchestrator,
  RuntimeAllocationService,
  RuntimeBalancingService,
  ShardRuntimeRepository,
  WorldBalancingRepository,
  WorldOrchestrationAuditRepository,
  WorldOrchestratorService,
  WorldRegionRepository,
} from '@atc/world-orchestrator'
import {
  CleanupOrchestrationService,
  EntityOwnershipRepository,
  EntityOwnershipService,
  PersistentSceneRepository,
  PersistentSceneService,
  RuntimeCleanupRepository,
  RuntimeReplicationService,
  SceneRuntimeRepository,
  SceneSynchronizationService,
  WorldEntityRepository,
  WorldRuntimeService,
} from '@atc/world-runtime'

export interface RuntimeServiceDeps {
  pool: DbPool
  redis: RedisClient
  eventBus: AtcEventBus
  telemetry: AtcTelemetryService
}

/**
 * Construct every runtime service and return them keyed by their AppContext
 * field name, ready to spread into the context object.
 */
export function buildRuntimeServices(deps: RuntimeServiceDeps) {
  const { pool, redis, eventBus, telemetry } = deps

  // Every runtime package declares its own event-bus shape rather than
  // importing the real one, and all of them are `emit(event, payload):
  // Promise<void>` while AtcEventBus.emit resolves to an AtcEventEmitResult.
  // Promise<AtcEventEmitResult> is not assignable to Promise<void>, so the
  // real bus cannot be handed over directly even though it does everything
  // asked of it. This forwards and drops the result.
  const runtimeEventBus = {
    emit: async (event: string, payload: unknown): Promise<void> => {
      await eventBus.emit(event as Parameters<AtcEventBus['emit']>[0], payload)
    },
  }

  const _atcAuditService = new AtcAuditService({ telemetry })
  const _atcIamCache = new AtcIamCache(redis, { telemetry })
  const _ledgerService = new LedgerService(pool, telemetry)
  const _accountRepository_ledger = new AccountRepository_ledger(pool, telemetry)
  const _organizationRepository = new OrganizationRepository(pool, telemetry)
  const _memberRepository = new MemberRepository(pool, telemetry)
  const _invoiceRepository = new InvoiceRepository(pool, telemetry)
  const _commerceService = new CommerceService(pool, _ledgerService, runtimeEventBus)
  const _shopRepository = new ShopRepository(pool, telemetry)
  const _shopItemRepository = new ShopItemRepository(pool, telemetry)
  const _orderRepository = new OrderRepository(pool)
  const _receiptRepository = new ReceiptRepository(pool)
  const _taxRuleRepository = new TaxRuleRepository(pool, telemetry)
  const _jobRepository = new JobRepository(pool)
  const _jobGradeRepository = new JobGradeRepository(pool)
  const _professionRepository = new ProfessionRepository(pool)
  const _employmentContractRepository = new EmploymentContractRepository(pool)
  const _workSessionRepository = new WorkSessionRepository(pool)
  const _payrollRepository = new PayrollRepository(pool)
  const _payrollService = new PayrollService(_payrollRepository, _ledgerService, runtimeEventBus)
  const _agencyRepository = new AgencyRepository(pool)
  const _warrantRepository = new WarrantRepository(pool)
  const _citationRepository = new CitationRepository(pool)
  const _arrestRepository = new ArrestRepository(pool)
  const _jailRepository = new JailRepository(pool)
  const _evidenceRepository = new EvidenceRepository(pool)
  const _legalCaseRepository = new LegalCaseRepository(pool)
  const _lawEnforcementService = new LawEnforcementService({ agencies: _agencyRepository, warrants: _warrantRepository, citations: _citationRepository, arrests: _arrestRepository, jail: _jailRepository, evidence: _evidenceRepository, cases: _legalCaseRepository, ledger: _ledgerService, eventBus: eventBus, telemetry: telemetry })
  const _dispatchCallRepository = new DispatchCallRepository(pool)
  const _incidentRepository = new IncidentRepository(pool)
  const _responderAssignmentRepository = new ResponderAssignmentRepository(pool)
  const _boloRepository = new BoloRepository(pool)
  const _dispatchService = new DispatchService({ calls: _dispatchCallRepository, incidents: _incidentRepository, responders: _responderAssignmentRepository, bolos: _boloRepository, eventBus: eventBus, telemetry: telemetry })
  const _mdtService = new MdtService({ warrants: _warrantRepository, arrests: _arrestRepository, citations: _citationRepository, jail: _jailRepository, evidence: _evidenceRepository, incidents: _incidentRepository, bolos: _boloRepository, responders: _responderAssignmentRepository })
  const _injuryRepository_medical = new InjuryRepository_medical(pool)
  const _traumaRepository = new TraumaRepository(pool)
  const _treatmentRepository = new TreatmentRepository(pool)
  const _medicalReportRepository = new MedicalReportRepository(pool)
  const _hospitalRepository = new HospitalRepository(pool)
  const _medicalService = new MedicalService({ injuryRepo: _injuryRepository_medical, traumaRepo: _traumaRepository, treatmentRepo: _treatmentRepository, reportRepo: _medicalReportRepository, hospitalRepo: _hospitalRepository, eventBus: eventBus, vitalsBridge: undefined })
  const _emergencyRepository = new EmergencyRepository(pool)
  const _ambulanceRepository = new AmbulanceRepository(pool)
  const _ambulanceDispatchService = new AmbulanceDispatchService(_ambulanceRepository, eventBus)
  const _hospitalCapacityRepository = new HospitalCapacityRepository(pool)
  const _hospitalCapacityService = new HospitalCapacityService(_hospitalCapacityRepository)
  const _medicalEscalationService = new MedicalEscalationService(eventBus)
  const _triageService = new TriageService()
  const _emergencyRuntimeService = new EmergencyRuntimeService({ emergencyRepo: _emergencyRepository, dispatchService: _ambulanceDispatchService, capacityService: _hospitalCapacityService, escalationService: _medicalEscalationService, triageService: _triageService, eventBus: eventBus })
  const _reviveAuditRepository = new ReviveAuditRepository(pool)
  const _entityRegistryRepository = new EntityRegistryRepository(pool)
  const _relationshipRepository = new RelationshipRepository(pool)
  const _atcEntityGraphSDK = new AtcEntityGraphSDK({ registry: _entityRegistryRepository, relationships: _relationshipRepository })
  const _atcEntityIntelligenceSDK = new AtcEntityIntelligenceSDK({ registry: _entityRegistryRepository, relationships: _relationshipRepository })
  const _vehicleRepository = new VehicleRepository(pool)
  const _vehicleRuntimeRepository = new VehicleRuntimeRepository(pool)
  const _garageRepository = new GarageRepository(pool)
  const _impoundRepository = new ImpoundRepository(pool)
  const _vehicleRuntimeService = new VehicleRuntimeService({ vehicleRepo: _vehicleRepository, runtimeRepo: _vehicleRuntimeRepository, garageRepo: _garageRepository, impoundRepo: _impoundRepository, pool: pool, eventBus: eventBus })
  const _fleetRepository = new FleetRepository(pool)
  const _garageService = new GarageService({ garageRepo: _garageRepository })
  const _impoundService = new ImpoundService({ impoundRepo: _impoundRepository })
  const _fleetService = new FleetService({ fleetRepo: _fleetRepository, eventBus: eventBus })
  const _propertyRepository = new PropertyRepository(pool)
  const _propertyRuntimeRepository = new PropertyRuntimeRepository(pool)
  const _propertyRuntimeService = new PropertyRuntimeService({ propertyRepo: _propertyRepository, runtimeRepo: _propertyRuntimeRepository, eventBus: eventBus })
  const _propertyAccessRepository = new PropertyAccessRepository(pool)
  const _propertyStashRepository = new PropertyStashRepository(pool)
  const _propertyGarageRepository = new PropertyGarageRepository(pool)
  const _interiorStateService = new InteriorStateService({ propertyRepo: _propertyRepository, runtimeRepo: _propertyRuntimeRepository, eventBus: eventBus })
  const _propertyAccessService = new PropertyAccessService({ accessRepo: _propertyAccessRepository, eventBus: eventBus })
  const _storageContainerService = new StorageContainerService({ stashRepo: _propertyStashRepository, eventBus: eventBus })
  const _propertyGarageService = new PropertyGarageService({ garageRepo: _propertyGarageRepository, vehicleRuntimeService: _vehicleRuntimeService, eventBus: eventBus })
  const _emergencyAccessService = new EmergencyAccessService({ propertyRepo: _propertyRepository, runtimeRepo: _propertyRuntimeRepository, accessRepo: _propertyAccessRepository, eventBus: eventBus })
  const _combatSessionRepository = new CombatSessionRepository(pool)
  const _combatRuntimeService = new CombatRuntimeService({ sessionRepo: _combatSessionRepository, pool: pool, eventBus: eventBus })
  const _damageRepository = new DamageRepository(pool)
  const _ballisticsRepository = new BallisticsRepository(pool)
  const _injuryRepository_combat_runtime = new InjuryRepository_combat_runtime(pool)
  const _damageService = new DamageService({ damageRepo: _damageRepository, ballisticsRepo: _ballisticsRepository, injuryRepo: _injuryRepository_combat_runtime, sessionRepo: _combatSessionRepository, pool: pool, eventBus: eventBus })
  const _weaponRepository = new WeaponRepository(pool)
  const _weaponRuntimeRepository = new WeaponRuntimeRepository(pool)
  const _weaponStateService = new WeaponStateService({ weaponRepo: _weaponRepository, runtimeRepo: _weaponRuntimeRepository, pool: pool, eventBus: eventBus })
  const _ballisticsService = new BallisticsService({ ballisticsRepo: _ballisticsRepository })
  const _injuryPropagationService = new InjuryPropagationService({ injuryRepo: _injuryRepository_combat_runtime, eventBus: eventBus })
  const _combatAuditService = new CombatAuditService({ damageRepo: _damageRepository, sessionRepo: _combatSessionRepository })
  const _gangRepository = new GangRepository(pool)
  const _gangMemberRepository = new GangMemberRepository(pool)
  const _criminalRuntimeService = new CriminalRuntimeService({ gangRepo: _gangRepository, memberRepo: _gangMemberRepository, pool: pool, eventBus: eventBus })
  const _criminalOperationRepository = new CriminalOperationRepository(pool)
  const _gangOperationService = new GangOperationService({ operationRepo: _criminalOperationRepository, eventBus: eventBus })
  const _contrabandRepository = new ContrabandRepository(pool)
  const _contrabandService = new ContrabandService({ contrabandRepo: _contrabandRepository, eventBus: eventBus })
  const _blackMarketRepository = new BlackMarketRepository(pool)
  const _blackMarketService = new BlackMarketService({ blackMarketRepo: _blackMarketRepository, eventBus: eventBus })
  const _illegalTradeService = new IllegalTradeService({ blackMarketRepo: _blackMarketRepository })
  const _raidRepository = new RaidRepository(pool)
  const _raidRuntimeService = new RaidRuntimeService({ raidRepo: _raidRepository, pool: pool, eventBus: eventBus })
  const _worldEntityRepository = new WorldEntityRepository(pool)
  const _sceneRuntimeRepository = new SceneRuntimeRepository(pool)
  const _worldRuntimeService = new WorldRuntimeService({ entityRepo: _worldEntityRepository, sceneRepo: _sceneRuntimeRepository, pool: pool, eventBus: eventBus })
  const _entityOwnershipRepository = new EntityOwnershipRepository(pool)
  const _sceneSynchronizationService = new SceneSynchronizationService({ sceneRepo: _sceneRuntimeRepository, entityRepo: _worldEntityRepository, ownershipRepo: _entityOwnershipRepository, pool: pool, eventBus: eventBus })
  const _persistentSceneRepository = new PersistentSceneRepository(pool)
  const _persistentSceneService = new PersistentSceneService({ persistentRepo: _persistentSceneRepository, eventBus: eventBus })
  const _entityOwnershipService = new EntityOwnershipService({ ownershipRepo: _entityOwnershipRepository, entityRepo: _worldEntityRepository, pool: pool, eventBus: eventBus })
  const _runtimeReplicationService = new RuntimeReplicationService({ entityRepo: _worldEntityRepository, sceneRepo: _sceneRuntimeRepository, pool: pool, eventBus: eventBus })
  const _runtimeCleanupRepository = new RuntimeCleanupRepository(pool)
  const _cleanupOrchestrationService = new CleanupOrchestrationService({ cleanupRepo: _runtimeCleanupRepository, entityRepo: _worldEntityRepository, sceneRepo: _sceneRuntimeRepository, pool: pool, eventBus: eventBus })
  const _fuelRepository = new FuelRepository(pool)
  const _damageRuntimeRepository = new DamageRuntimeRepository(pool)
  const _runtimeMetricsRepository_vehicle_simulation = new RuntimeMetricsRepository_vehicle_simulation(pool)
  const _fuelRuntimeService = new FuelRuntimeService({ fuelRepo: _fuelRepository, pool: pool, eventBus: eventBus })
  const _damageRuntimeService = new DamageRuntimeService({ damageRepo: _damageRuntimeRepository, pool: pool, eventBus: eventBus })
  const _vehicleSimulationService = new VehicleSimulationService({ fuelRepo: _fuelRepository, damageRepo: _damageRuntimeRepository, metricsRepo: _runtimeMetricsRepository_vehicle_simulation, fuelService: _fuelRuntimeService, damageService: _damageRuntimeService, pool: pool, eventBus: eventBus })
  const _registrationRepository = new RegistrationRepository(pool)
  const _registrationRuntimeService = new RegistrationRuntimeService({ registrationRepo: _registrationRepository, pool: pool, eventBus: eventBus })
  const _pursuitRepository = new PursuitRepository(pool)
  const _pursuitRuntimeService = new PursuitRuntimeService({ pursuitRepo: _pursuitRepository, pool: pool, eventBus: eventBus })
  const _trafficViolationRepository = new TrafficViolationRepository(pool)
  const _trafficControlService = new TrafficControlService({ violationRepo: _trafficViolationRepository, eventBus: eventBus })
  const _bankAccountRepository = new BankAccountRepository(pool)
  const _bankTransactionRepository = new BankTransactionRepository(pool)
  const _financialFlagRepository = new FinancialFlagRepository(pool)
  const _bankingRuntimeService = new BankingRuntimeService(_bankAccountRepository, _bankTransactionRepository, _financialFlagRepository, pool, eventBus)
  const _marketListingRepository = new MarketListingRepository(pool)
  const _taxRecordRepository = new TaxRecordRepository(pool)
  const _marketplaceService = new MarketplaceService(_marketListingRepository, _bankingRuntimeService, _taxRecordRepository, eventBus)
  const _marketAuctionRepository = new MarketAuctionRepository(pool)
  const _auctionRuntimeService = new AuctionRuntimeService(_marketAuctionRepository, _bankingRuntimeService, _taxRecordRepository, eventBus, pool)
  const _taxationRuntimeService = new TaxationRuntimeService(_taxRecordRepository, _bankingRuntimeService, eventBus)
  const _financialFraudService = new FinancialFraudService(_financialFlagRepository, eventBus)
  const _factionRuntimeService = new FactionRuntimeService(pool, eventBus)
  const _territoryControlService = new TerritoryControlService(pool, eventBus)
  const _influenceRuntimeService = new InfluenceRuntimeService(pool, eventBus)
  const _conflictRuntimeService = new ConflictRuntimeService(pool, eventBus)
  const _zoneClaimService = new ZoneClaimService(pool, eventBus)
  const _resourceNodeService = new ResourceNodeService(pool, eventBus)
  const _factionRepository = new FactionRepository(pool)
  const _territoryRepository = new TerritoryRepository(pool)
  const _territoryClaimRepository = new TerritoryClaimRepository(pool)
  const _factionConflictRepository = new FactionConflictRepository(pool)
  const _resourceNodeRepository = new ResourceNodeRepository(pool)
  const _influenceRuntimeRepository = new InfluenceRuntimeRepository(pool)
  const _rentalContractRepository = new RentalContractRepository(pool)
  const _housingPaymentRepository = new HousingPaymentRepository(pool)
  const _tenantHistoryRepository = new TenantHistoryRepository(pool)
  const _rentalContractService = new RentalContractService(_rentalContractRepository, _housingPaymentRepository, _tenantHistoryRepository, pool, eventBus)
  const _foreclosureRepository = new ForeclosureRepository(pool)
  const _foreclosureService = new ForeclosureService(_foreclosureRepository, eventBus)
  const _propertyTaxRepository = new PropertyTaxRepository(pool)
  const _propertyTaxService = new PropertyTaxService(_propertyTaxRepository, eventBus)
  const _assetValuationRepository = new AssetValuationRepository(pool)
  const _assetValuationService = new AssetValuationService(_assetValuationRepository, eventBus)
  const _tenantManagementService = new TenantManagementService(_rentalContractRepository, _tenantHistoryRepository, eventBus)
  const _housingEconomyService = new HousingEconomyService(_rentalContractService, _foreclosureService, _propertyTaxService, _assetValuationService, _tenantManagementService)
  const _npcRuntimeRepository = new NpcRuntimeRepository(pool)
  const _npcCleanupRepository = new NpcCleanupRepository(pool)
  const _npcRuntimeService = new NpcRuntimeService(_npcRuntimeRepository, _npcCleanupRepository, pool, eventBus)
  const _npcSpawnPointRepository = new NpcSpawnPointRepository(pool)
  const _dynamicSpawnService = new DynamicSpawnService(_npcRuntimeRepository, _npcSpawnPointRepository, _npcCleanupRepository, pool, eventBus)
  const _crowdRuntimeRepository = new CrowdRuntimeRepository(pool)
  const _populationZoneRepository = new PopulationZoneRepository(pool)
  const _crowdSimulationService = new CrowdSimulationService(_crowdRuntimeRepository, _populationZoneRepository, eventBus)
  const _npcBehaviorRepository = new NpcBehaviorRepository(pool)
  const _ambientBehaviorService = new AmbientBehaviorService(_npcBehaviorRepository, _npcRuntimeRepository, eventBus)
  const _cityInfrastructureRepository = new CityInfrastructureRepository(pool)
  const _infrastructureFailureRepository = new InfrastructureFailureRepository(pool)
  const _cityInfrastructureService = new CityInfrastructureService(_cityInfrastructureRepository, _infrastructureFailureRepository, pool, eventBus)
  const _infrastructureRecoveryService = new InfrastructureRecoveryService(_infrastructureFailureRepository, _cityInfrastructureRepository, pool, eventBus)
  const _trafficSignalRepository = new TrafficSignalRepository(pool)
  const _trafficSignalService = new TrafficSignalService(_trafficSignalRepository, eventBus)
  const _environmentRuntimeRepository = new EnvironmentRuntimeRepository(pool)
  const _environmentRuntimeService = new EnvironmentRuntimeService(_environmentRuntimeRepository, eventBus)
  const _resourceConsumptionRepository = new ResourceConsumptionRepository(pool)
  const _resourceConsumptionService = new ResourceConsumptionService(_resourceConsumptionRepository, eventBus)
  const _utilityGridRepository = new UtilityGridRepository(pool)
  const _utilityGridService = new UtilityGridService(_utilityGridRepository, pool, eventBus)
  const _survivalRuntimeRepository = new SurvivalRuntimeRepository(pool)
  const _temperatureRuntimeRepository = new TemperatureRuntimeRepository(pool)
  const _hydrationRuntimeRepository = new HydrationRuntimeRepository(pool)
  const _fatigueRuntimeRepository = new FatigueRuntimeRepository(pool)
  const _survivalRuntimeService = new SurvivalRuntimeService(_survivalRuntimeRepository, _temperatureRuntimeRepository, _hydrationRuntimeRepository, _fatigueRuntimeRepository, pool, eventBus)
  const _temperatureRuntimeService = new TemperatureRuntimeService(_temperatureRuntimeRepository, eventBus)
  const _hydrationRuntimeService = new HydrationRuntimeService(_hydrationRuntimeRepository, pool, eventBus)
  const _fatigueRuntimeService = new FatigueRuntimeService(_fatigueRuntimeRepository, pool, eventBus)
  const _environmentalHazardRepository = new EnvironmentalHazardRepository(pool)
  const _environmentalExposureRepository = new EnvironmentalExposureRepository(pool)
  const _environmentalHazardService = new EnvironmentalHazardService(_environmentalHazardRepository, _environmentalExposureRepository, eventBus)
  const _craftingBlueprintRepository = new CraftingBlueprintRepository(pool)
  const _craftingRecipeRepository = new CraftingRecipeRepository(pool)
  const _blueprintService = new BlueprintService(_craftingBlueprintRepository, _craftingRecipeRepository, eventBus)
  const _manufacturingQueueRepository = new ManufacturingQueueRepository(pool)
  const _manufacturingQueueService = new ManufacturingQueueService(_manufacturingQueueRepository, eventBus)
  const _productionJobRepository = new ProductionJobRepository(pool)
  const _craftingAuditRepository = new CraftingAuditRepository(pool)
  const _productionJobService = new ProductionJobService(_productionJobRepository, _manufacturingQueueRepository, _craftingRecipeRepository, _craftingAuditRepository, eventBus)
  const _shipmentRepository = new ShipmentRepository(pool)
  const _deliveryAuditRepository = new DeliveryAuditRepository(pool)
  const _shipmentService = new ShipmentService(_shipmentRepository, _deliveryAuditRepository, eventBus)
  const _supplyRouteRepository = new SupplyRouteRepository(pool)
  const _supplyRouteService = new SupplyRouteService(_supplyRouteRepository, eventBus)
  const _logisticsFleetRepository = new LogisticsFleetRepository(pool)
  const _logisticsFleetService = new LogisticsFleetService(_logisticsFleetRepository, eventBus)
  const _supplyChainRepository = new SupplyChainRepository(pool)
  const _supplyChainService = new SupplyChainService(_supplyChainRepository, eventBus)
  const _cargoRuntimeRepository = new CargoRuntimeRepository(pool)
  const _vesselRepository = new VesselRepository(pool)
  const _dockingRuntimeRepository = new DockingRuntimeRepository(pool)
  const _transportAuditRepository = new TransportAuditRepository(pool)
  const _maritimeRuntimeService = new MaritimeRuntimeService(_vesselRepository, _dockingRuntimeRepository, _transportAuditRepository, eventBus)
  const _aircraftRepository = new AircraftRepository(pool)
  const _flightRuntimeRepository = new FlightRuntimeRepository(pool)
  const _airspaceZoneRepository = new AirspaceZoneRepository(pool)
  const _aviationRuntimeService = new AviationRuntimeService(_aircraftRepository, _flightRuntimeRepository, _airspaceZoneRepository, _transportAuditRepository, eventBus)
  const _radioChannelRepository = new RadioChannelRepository(pool)
  const _radioMembershipRepository = new RadioMembershipRepository(pool)
  const _communicationAuditRepository = new CommunicationAuditRepository(pool)
  const _radioRuntimeService = new RadioRuntimeService(_radioChannelRepository, _radioMembershipRepository, _communicationAuditRepository, eventBus)
  const _emergencyBroadcastRepository = new EmergencyBroadcastRepository(pool)
  const _emergencyBroadcastService = new EmergencyBroadcastService(_emergencyBroadcastRepository, _communicationAuditRepository, eventBus)
  const _signalRuntimeRepository = new SignalRuntimeRepository(pool)
  const _signalRuntimeService = new SignalRuntimeService(_signalRuntimeRepository, _communicationAuditRepository, eventBus)
  const _encryptedChannelRepository = new EncryptedChannelRepository(pool)
  const _encryptionRuntimeService = new EncryptionRuntimeService(_encryptedChannelRepository, _radioChannelRepository, _communicationAuditRepository, eventBus)
  const _disasterEventRepository = new DisasterEventRepository(pool)
  const _hazardZoneRepository = new HazardZoneRepository(pool)
  const _disasterAuditRepository = new DisasterAuditRepository(pool)
  const _disasterRuntimeService = new DisasterRuntimeService(_disasterEventRepository, _hazardZoneRepository, _disasterAuditRepository, eventBus)
  const _evacuationRuntimeRepository = new EvacuationRuntimeRepository(pool)
  const _evacuationRuntimeService = new EvacuationRuntimeService(_evacuationRuntimeRepository, _disasterAuditRepository, eventBus)
  const _emergencyResponseRepository = new EmergencyResponseRepository(pool)
  const _emergencyResponseService = new EmergencyResponseService(_emergencyResponseRepository, _disasterAuditRepository, eventBus)
  const _recoveryRuntimeRepository = new RecoveryRuntimeRepository(pool)
  const _recoveryOrchestrationService = new RecoveryOrchestrationService(_recoveryRuntimeRepository, _disasterAuditRepository, eventBus)
  const _missionRepository = new MissionRepository(pool)
  const _missionAuditRepository = new MissionAuditRepository(pool)
  const _missionRuntimeService = new MissionRuntimeService(_missionRepository, _missionAuditRepository, eventBus)
  const _missionObjectiveRepository = new MissionObjectiveRepository(pool)
  const _objectiveTrackingService = new ObjectiveTrackingService(_missionObjectiveRepository, _missionAuditRepository, eventBus)
  const _scenarioRuntimeRepository = new ScenarioRuntimeRepository(pool)
  const _scenarioOrchestrationService = new ScenarioOrchestrationService(_scenarioRuntimeRepository, _missionAuditRepository, eventBus)
  const _missionProgressionService = new MissionProgressionService(_missionRepository, _missionObjectiveRepository, _missionAuditRepository, eventBus)
  const _dynamicEventRepository = new DynamicEventRepository(pool)
  const _dynamicEventService = new DynamicEventService(_dynamicEventRepository, _missionAuditRepository, eventBus)
  const _missionCleanupService = new MissionCleanupService(_missionRepository, _scenarioRuntimeRepository, _missionAuditRepository)
  const _missionAssignmentRepository = new MissionAssignmentRepository(pool)
  const _reputationRuntimeRepository = new ReputationRuntimeRepository(pool)
  const _influenceHistoryRepository = new InfluenceHistoryRepository(pool)
  const _relationshipAuditRepository = new RelationshipAuditRepository(pool)
  const _reputationRuntimeService = new ReputationRuntimeService(_reputationRuntimeRepository, _influenceHistoryRepository, _relationshipAuditRepository, runtimeEventBus)
  const _diplomaticRelationsRepository = new DiplomaticRelationsRepository(pool)
  const _diplomacyService = new DiplomacyService(_diplomaticRelationsRepository, _relationshipAuditRepository, runtimeEventBus)
  const _influenceTrackingService = new InfluenceTrackingService(_influenceHistoryRepository, _relationshipAuditRepository, runtimeEventBus)
  const _factionRelationshipService = new FactionRelationshipService(_diplomaticRelationsRepository, _relationshipAuditRepository, runtimeEventBus)
  const _socialStandingRepository = new SocialStandingRepository(pool)
  const _socialStandingService = new SocialStandingService(_socialStandingRepository, _relationshipAuditRepository, runtimeEventBus)
  const _reputationDecayRepository = new ReputationDecayRepository(pool)
  const _reputationDecayService = new ReputationDecayService(_reputationDecayRepository, _reputationRuntimeRepository, _influenceHistoryRepository, _relationshipAuditRepository, runtimeEventBus)
  const _aiRuntimeRepository = new AiRuntimeRepository(pool)
  const _aiAuditRepository = new AiAuditRepository(pool)
  const _aiRuntimeService = new AiRuntimeService(_aiRuntimeRepository, _aiAuditRepository, runtimeEventBus)
  const _aiResponseRuntimeRepository = new AiResponseRuntimeRepository(pool)
  const _tacticalResponseService = new TacticalResponseService(_aiResponseRuntimeRepository, _aiAuditRepository, runtimeEventBus)
  const _aiPatrolRepository = new AiPatrolRepository(pool)
  const _autonomousPatrolService = new AutonomousPatrolService(_aiPatrolRepository, _aiRuntimeRepository, _aiAuditRepository, runtimeEventBus)
  const _aiThreatAssessmentRepository = new AiThreatAssessmentRepository(pool)
  const _threatAssessmentService = new ThreatAssessmentService(_aiThreatAssessmentRepository, _aiAuditRepository, runtimeEventBus)
  const _aiReinforcementRepository = new AiReinforcementRepository(pool)
  const _reinforcementCoordinationService = new ReinforcementCoordinationService(_aiReinforcementRepository, _aiAuditRepository, runtimeEventBus)
  const _aiRecoveryService = new AiRecoveryService(_aiRuntimeRepository, _aiPatrolRepository, _aiResponseRuntimeRepository, _aiAuditRepository, runtimeEventBus)
  const _spatialOwnershipRepository = new SpatialOwnershipRepository(pool)
  const _replicationAuditRepository = new ReplicationAuditRepository(pool)
  const _spatialOwnershipService = new SpatialOwnershipService(_spatialOwnershipRepository, _replicationAuditRepository, runtimeEventBus)
  const _runtimeSnapshotRepository = new RuntimeSnapshotRepository(pool)
  const _replicationRuntimeService = new ReplicationRuntimeService(_runtimeSnapshotRepository, _replicationAuditRepository, runtimeEventBus)
  const _interestRegionRepository = new InterestRegionRepository(pool)
  const _interestManagementService = new InterestManagementService(_interestRegionRepository, _replicationAuditRepository)
  const _streamingRuntimeRepository = new StreamingRuntimeRepository(pool)
  const _runtimeStreamingService = new RuntimeStreamingService(_streamingRuntimeRepository, _replicationAuditRepository, runtimeEventBus)
  const _spatialNodeRepository = new SpatialNodeRepository(pool)
  const _spatialPartitionService = new SpatialPartitionService(_spatialNodeRepository, _replicationAuditRepository)
  const _snapshotSynchronizationService = new SnapshotSynchronizationService(_runtimeSnapshotRepository)
  const _runtimeMigrationRepository = new RuntimeMigrationRepository(pool)
  const _runtimeConsistencyAuditRepository = new RuntimeConsistencyAuditRepository(pool)
  const _runtimeMigrationService = new RuntimeMigrationService(_runtimeMigrationRepository, _runtimeConsistencyAuditRepository, runtimeEventBus)
  const _nodeTransferRepository = new NodeTransferRepository(pool)
  const _ownershipTransferService = new OwnershipTransferService(_nodeTransferRepository, _runtimeConsistencyAuditRepository, runtimeEventBus)
  const _runtimeRecoveryRepository = new RuntimeRecoveryRepository(pool)
  const _runtimeRecoveryService = new RuntimeRecoveryService(_runtimeRecoveryRepository, _runtimeConsistencyAuditRepository, runtimeEventBus)
  const _reconciliationRuntimeRepository = new ReconciliationRuntimeRepository(pool)
  const _crossNodeReconciliationService = new CrossNodeReconciliationService(_reconciliationRuntimeRepository, _runtimeMigrationRepository, _nodeTransferRepository, _runtimeConsistencyAuditRepository, runtimeEventBus)
  const _snapshotReplayRepository = new SnapshotReplayRepository(pool)
  const _snapshotReplayService = new SnapshotReplayService(_snapshotReplayRepository, _runtimeConsistencyAuditRepository, runtimeEventBus)
  const _runtimeConsistencyService = new RuntimeConsistencyService(_runtimeMigrationRepository, _nodeTransferRepository, _runtimeConsistencyAuditRepository)
  const _worldRegionRepository = new WorldRegionRepository(pool)
  const _worldOrchestrationAuditRepository = new WorldOrchestrationAuditRepository(pool)
  const _worldOrchestratorService = new WorldOrchestratorService(_worldRegionRepository, _worldOrchestrationAuditRepository, runtimeEventBus)
  const _shardRuntimeRepository = new ShardRuntimeRepository(pool)
  const _runtimeAllocationRepository_world_orchestrator = new RuntimeAllocationRepository_world_orchestrator(pool)
  const _distributedShardService = new DistributedShardService(_shardRuntimeRepository, _runtimeAllocationRepository_world_orchestrator, _worldOrchestrationAuditRepository, runtimeEventBus)
  const _regionalSimulationRepository = new RegionalSimulationRepository(pool)
  const _regionalSimulationService = new RegionalSimulationService(_regionalSimulationRepository, _worldOrchestrationAuditRepository, runtimeEventBus)
  const _worldBalancingRepository = new WorldBalancingRepository(pool)
  const _runtimeBalancingService = new RuntimeBalancingService(_shardRuntimeRepository, _worldBalancingRepository, _worldOrchestrationAuditRepository, runtimeEventBus)
  const _runtimeAllocationService = new RuntimeAllocationService(_runtimeAllocationRepository_world_orchestrator, _worldOrchestrationAuditRepository)
  const _persistentWorldRecoveryService = new PersistentWorldRecoveryService(_shardRuntimeRepository, _regionalSimulationRepository, _worldOrchestrationAuditRepository, runtimeEventBus)
  const _combatRuntimeRepository = new CombatRuntimeRepository(pool)
  const _combatAuditRepository = new CombatAuditRepository(pool)
  const _combatSimulationService = new CombatSimulationService(_combatRuntimeRepository, _combatAuditRepository, runtimeEventBus)
  const _ballisticsRuntimeRepository = new BallisticsRuntimeRepository(pool)
  const _ballisticsRuntimeService = new BallisticsRuntimeService(_ballisticsRuntimeRepository, _combatAuditRepository, runtimeEventBus)
  const _tacticalDamageRepository = new TacticalDamageRepository(pool)
  const _tacticalDamageService = new TacticalDamageService(_tacticalDamageRepository, _combatAuditRepository, runtimeEventBus)
  const _armorRuntimeRepository = new ArmorRuntimeRepository(pool)
  const _armorPenetrationService = new ArmorPenetrationService(_armorRuntimeRepository, runtimeEventBus)
  const _suppressionRuntimeRepository = new SuppressionRuntimeRepository(pool)
  const _suppressionRuntimeService = new SuppressionRuntimeService(_suppressionRuntimeRepository, _combatAuditRepository, runtimeEventBus)
  const _combatRecoveryService = new CombatRecoveryService(_combatRuntimeRepository, _ballisticsRuntimeRepository, _tacticalDamageRepository, _suppressionRuntimeRepository, _combatAuditRepository, runtimeEventBus)
  const _narrativeSessionRepository = new NarrativeSessionRepository(pool)
  const _narrativeAuditRepository = new NarrativeAuditRepository(pool)
  const _narrativeRuntimeService = new NarrativeRuntimeService(_narrativeSessionRepository, _narrativeAuditRepository, runtimeEventBus)
  const _campaignRuntimeRepository = new CampaignRuntimeRepository(pool)
  const _storyProgressionRepository = new StoryProgressionRepository(pool)
  const _campaignOrchestrationService = new CampaignOrchestrationService(_campaignRuntimeRepository, _storyProgressionRepository, _narrativeAuditRepository, runtimeEventBus)
  const _worldEventRepository = new WorldEventRepository(pool)
  const _worldEventService = new WorldEventService(_worldEventRepository, _narrativeAuditRepository, runtimeEventBus)
  const _storyProgressionService = new StoryProgressionService(_storyProgressionRepository, _narrativeAuditRepository, runtimeEventBus)
  const _dynamicStoryStateRepository = new DynamicStoryStateRepository(pool)
  const _dynamicNarrativeService = new DynamicNarrativeService(_dynamicStoryStateRepository, runtimeEventBus)
  const _narrativeRecoveryService = new NarrativeRecoveryService(_campaignRuntimeRepository, _narrativeSessionRepository, _worldEventRepository, _narrativeAuditRepository, runtimeEventBus)
  const _recoveryOperationRepository = new RecoveryOperationRepository(pool)
  const _recoverySnapshotRepository = new RecoverySnapshotRepository(pool)
  const _failoverAuditRepository = new FailoverAuditRepository(pool)
  const _runtimeRecoveryCoordinator = new RuntimeRecoveryCoordinator(_recoveryOperationRepository, _recoverySnapshotRepository, _failoverAuditRepository, runtimeEventBus)
  const _runtimeFailoverRepository = new RuntimeFailoverRepository(pool)
  const _failoverOrchestrationService = new FailoverOrchestrationService(_runtimeFailoverRepository, _failoverAuditRepository, runtimeEventBus)
  const _chaosRuntimeRepository = new ChaosRuntimeRepository(pool)
  const _chaosSimulationService = new ChaosSimulationService(_chaosRuntimeRepository, _failoverAuditRepository, runtimeEventBus)
  const _runtimeResilienceRepository = new RuntimeResilienceRepository(pool)
  const _runtimeResilienceService = new RuntimeResilienceService(_runtimeResilienceRepository, runtimeEventBus)
  const _snapshotRecoveryService = new SnapshotRecoveryService(_recoverySnapshotRepository, _failoverAuditRepository, runtimeEventBus)
  const _distributedHealthRecoveryService = new DistributedHealthRecoveryService(_runtimeFailoverRepository, _recoveryOperationRepository, _runtimeResilienceRepository, _failoverAuditRepository, runtimeEventBus)
  const _traceRuntimeRepository = new TraceRuntimeRepository(pool)
  const _observabilityAuditRepository = new ObservabilityAuditRepository(pool)
  const _runtimeTelemetryService = new RuntimeTelemetryService(_traceRuntimeRepository, _observabilityAuditRepository, runtimeEventBus)
  const _traceRuntimeStateRepository = new TraceRuntimeStateRepository(pool)
  const _distributedTracingService = new DistributedTracingService(_traceRuntimeStateRepository, runtimeEventBus)
  const _runtimeMetricsRepository_runtime_observability = new RuntimeMetricsRepository_runtime_observability(pool)
  const _runtimeMetricsService = new RuntimeMetricsService(_runtimeMetricsRepository_runtime_observability, _observabilityAuditRepository, runtimeEventBus)
  const _failureCorrelationRepository = new FailureCorrelationRepository(pool)
  const _failureCorrelationService = new FailureCorrelationService(_failureCorrelationRepository, _observabilityAuditRepository, runtimeEventBus)
  const _runtimeDiagnosticsRepository = new RuntimeDiagnosticsRepository(pool)
  const _runtimeDiagnosticsService = new RuntimeDiagnosticsService(_runtimeDiagnosticsRepository, _observabilityAuditRepository, runtimeEventBus)
  const _traceRecoveryService = new TraceRecoveryService(_traceRuntimeRepository, _traceRuntimeStateRepository, _runtimeMetricsRepository_runtime_observability, _observabilityAuditRepository, runtimeEventBus)
  const _clusterNodeRepository = new ClusterNodeRepository(pool)
  const _clusterAuditRepository = new ClusterAuditRepository(pool)
  const _clusterRuntimeService = new ClusterRuntimeService(_clusterNodeRepository, _clusterAuditRepository, runtimeEventBus)
  const _runtimeDeploymentRepository = new RuntimeDeploymentRepository(pool)
  const _deploymentOrchestrationService = new DeploymentOrchestrationService(_runtimeDeploymentRepository, _clusterAuditRepository, runtimeEventBus)
  const _nodeLifecycleRepository = new NodeLifecycleRepository(pool)
  const _nodeLifecycleService = new NodeLifecycleService(_nodeLifecycleRepository, _clusterAuditRepository, runtimeEventBus)
  const _clusterScalingRepository = new ClusterScalingRepository(pool)
  const _runtimeScalingService = new RuntimeScalingService(_clusterScalingRepository, _clusterAuditRepository, runtimeEventBus)
  const _runtimeAllocationRepository_cluster_runtime = new RuntimeAllocationRepository_cluster_runtime(pool)
  const _clusterAllocationService = new ClusterAllocationService(_runtimeAllocationRepository_cluster_runtime, _clusterAuditRepository, runtimeEventBus)
  const _distributedDeploymentRecoveryService = new DistributedDeploymentRecoveryService(_clusterNodeRepository, _runtimeDeploymentRepository, _runtimeAllocationRepository_cluster_runtime, _clusterAuditRepository, runtimeEventBus)
  const _globalSnapshotRepository = new GlobalSnapshotRepository(pool)
  const _persistenceAuditRepository = new PersistenceAuditRepository(pool)
  const _globalPersistenceService = new GlobalPersistenceService(_globalSnapshotRepository, _persistenceAuditRepository, runtimeEventBus)
  const _snapshotCompressionRepository = new SnapshotCompressionRepository(pool)
  const _snapshotCompressionService = new SnapshotCompressionService(_snapshotCompressionRepository, _persistenceAuditRepository, runtimeEventBus)
  const _persistenceRuntimeRepository = new PersistenceRuntimeRepository(pool)
  const _distributedSnapshotService = new DistributedSnapshotService(_persistenceRuntimeRepository, runtimeEventBus)
  const _longtermRecoveryRepository = new LongtermRecoveryRepository(pool)
  const _longTermRecoveryService = new LongTermRecoveryService(_longtermRecoveryRepository, _persistenceAuditRepository, runtimeEventBus)
  const _snapshotArchiveRepository = new SnapshotArchiveRepository(pool)
  const _runtimeArchivalService = new RuntimeArchivalService(_snapshotArchiveRepository, _persistenceAuditRepository, runtimeEventBus)
  const _persistenceConsistencyService = new PersistenceConsistencyService(_globalSnapshotRepository, _persistenceRuntimeRepository, _longtermRecoveryRepository, _persistenceAuditRepository, runtimeEventBus)
  const _federationNodeRepository = new FederationNodeRepository(pool)
  const _federationAuditRepository = new FederationAuditRepository(pool)
  const _federationRuntimeService = new FederationRuntimeService(_federationNodeRepository, _federationAuditRepository, runtimeEventBus)
  const _regionRuntimeRepository = new RegionRuntimeRepository(pool)
  const _multiRegionSyncService = new MultiRegionSyncService(_regionRuntimeRepository, runtimeEventBus)
  const _interclusterRouteRepository = new InterclusterRouteRepository(pool)
  const _interclusterRoutingService = new InterclusterRoutingService(_interclusterRouteRepository, _federationAuditRepository, runtimeEventBus)
  const _federationOwnershipRepository = new FederationOwnershipRepository(pool)
  const _federationOwnershipService = new FederationOwnershipService(_federationOwnershipRepository, _federationAuditRepository, runtimeEventBus)
  const _regionalConsistencyRepository = new RegionalConsistencyRepository(pool)
  const _regionalConsistencyService = new RegionalConsistencyService(_regionalConsistencyRepository, _federationAuditRepository, runtimeEventBus)
  const _federationRecoveryService = new FederationRecoveryService(_federationNodeRepository, _interclusterRouteRepository, _regionalConsistencyRepository, _federationAuditRepository, runtimeEventBus)
  const _runtimeIntrusionRepository = new RuntimeIntrusionRepository(pool)
  const _securityAuditRepository = new SecurityAuditRepository(pool)
  const _runtimeIntrusionDetectionService = new RuntimeIntrusionDetectionService(_runtimeIntrusionRepository, _securityAuditRepository, runtimeEventBus)
  const _runtimeThreatRepository = new RuntimeThreatRepository(pool)
  const _autonomousProtectionService = new AutonomousProtectionService(_runtimeThreatRepository, _securityAuditRepository, runtimeEventBus)
  const _runtimeIsolationRepository = new RuntimeIsolationRepository(pool)
  const _runtimeIsolationService = new RuntimeIsolationService(_runtimeIsolationRepository, _securityAuditRepository, runtimeEventBus)
  const _securityEscalationRepository = new SecurityEscalationRepository(pool)
  const _securityEscalationService = new SecurityEscalationService(_securityEscalationRepository, _securityAuditRepository, runtimeEventBus)
  const _threatContainmentRepository = new ThreatContainmentRepository(pool)
  const _threatContainmentService = new ThreatContainmentService(_threatContainmentRepository, _securityAuditRepository, runtimeEventBus)
  const _runtimeSecurityRecoveryService = new RuntimeSecurityRecoveryService(_runtimeIntrusionRepository, _runtimeThreatRepository, _threatContainmentRepository, _securityAuditRepository, runtimeEventBus)
  const _economyRegulationRepository = new EconomyRegulationRepository(pool)
  const _economyAuditRepository = new EconomyAuditRepository(pool)
  const _economyRegulationService = new EconomyRegulationService(_economyRegulationRepository, _economyAuditRepository, runtimeEventBus)
  const _resourceBalancingRepository = new ResourceBalancingRepository(pool)
  const _resourceBalancingService = new ResourceBalancingService(_resourceBalancingRepository, _economyAuditRepository, runtimeEventBus)
  const _inflationRuntimeRepository = new InflationRuntimeRepository(pool)
  const _inflationControlService = new InflationControlService(_inflationRuntimeRepository, runtimeEventBus)
  const _taxRuntimeRepository = new TaxRuntimeRepository(pool)
  const _autonomousTaxAdjustmentService = new AutonomousTaxAdjustmentService(_taxRuntimeRepository, _economyAuditRepository, runtimeEventBus)
  const _marketStabilizationRepository = new MarketStabilizationRepository(pool)
  const _marketStabilizationService = new MarketStabilizationService(_marketStabilizationRepository, _economyAuditRepository, runtimeEventBus)
  const _economicRecoveryService = new EconomicRecoveryService(_economyRegulationRepository, _resourceBalancingRepository, _marketStabilizationRepository, _economyAuditRepository, runtimeEventBus)
  const _governanceRuntimeRepository = new GovernanceRuntimeRepository(pool)
  const _governanceAuditRepository = new GovernanceAuditRepository(pool)
  const _governanceRuntimeService = new GovernanceRuntimeService(_governanceRuntimeRepository, _governanceAuditRepository, runtimeEventBus)
  const _electionRepository = new ElectionRepository(pool)
  const _politicalElectionService = new PoliticalElectionService(_electionRepository, _governanceAuditRepository, runtimeEventBus)
  const _legislativeRepository = new LegislativeRepository(pool)
  const _legislativeRuntimeService = new LegislativeRuntimeService(_legislativeRepository, _governanceAuditRepository, runtimeEventBus)
  const _civicInfluenceRepository = new CivicInfluenceRepository(pool)
  const _civicInfluenceService = new CivicInfluenceService(_civicInfluenceRepository, _governanceAuditRepository, runtimeEventBus)
  const _policyRepository = new PolicyRepository(pool)
  const _autonomousPolicyService = new AutonomousPolicyService(_policyRepository, _governanceAuditRepository, runtimeEventBus)
  const _governanceRecoveryService = new GovernanceRecoveryService(_governanceRuntimeRepository, _electionRepository, _legislativeRepository, _policyRepository, _governanceAuditRepository, runtimeEventBus)
  const _ecologyRuntimeRepository = new EcologyRuntimeRepository(pool)
  const _ecologyAuditRepository = new EcologyAuditRepository(pool)
  const _ecologyRuntimeService = new EcologyRuntimeService(_ecologyRuntimeRepository, _ecologyAuditRepository, runtimeEventBus)
  const _environmentalEvolutionRepository = new EnvironmentalEvolutionRepository(pool)
  const _environmentalEvolutionService = new EnvironmentalEvolutionService(_environmentalEvolutionRepository, _ecologyAuditRepository, runtimeEventBus)
  const _resourceRegenerationRepository = new ResourceRegenerationRepository(pool)
  const _resourceRegenerationService = new ResourceRegenerationService(_resourceRegenerationRepository, _ecologyAuditRepository, runtimeEventBus)
  const _climateRuntimeRepository = new ClimateRuntimeRepository(pool)
  const _climatePersistenceService = new ClimatePersistenceService(_climateRuntimeRepository, _ecologyAuditRepository, runtimeEventBus)
  const _wildlifeRuntimeRepository = new WildlifeRuntimeRepository(pool)
  const _wildlifeSimulationService = new WildlifeSimulationService(_wildlifeRuntimeRepository, _ecologyAuditRepository, runtimeEventBus)
  const _ecologyRecoveryService = new EcologyRecoveryService(_ecologyRuntimeRepository, _environmentalEvolutionRepository, _resourceRegenerationRepository, _ecologyAuditRepository, runtimeEventBus)
  const _metaRuntimeRepository = new MetaRuntimeRepository(pool)
  const _metaAuditRepository = new MetaAuditRepository(pool)
  const _metaRuntimeService = new MetaRuntimeService(_metaRuntimeRepository, _metaAuditRepository, runtimeEventBus)
  const _healingOperationRepository = new HealingOperationRepository(pool)
  const _autonomousHealingService = new AutonomousHealingService(_healingOperationRepository, _metaAuditRepository, runtimeEventBus)
  const _distributedRepairRepository = new DistributedRepairRepository(pool)
  const _distributedRepairService = new DistributedRepairService(_distributedRepairRepository, _metaAuditRepository, runtimeEventBus)
  const _metaAllocationRepository = new MetaAllocationRepository(pool)
  const _metaAllocationService = new MetaAllocationService(_metaAllocationRepository, _metaAuditRepository, runtimeEventBus)
  const _runtimeCoordinationRepository = new RuntimeCoordinationRepository(pool)
  const _runtimeCoordinationService = new RuntimeCoordinationService(_runtimeCoordinationRepository, _metaAuditRepository, runtimeEventBus)
  const _selfHealingRecoveryService = new SelfHealingRecoveryService(_metaRuntimeRepository, _healingOperationRepository, _distributedRepairRepository, _metaAllocationRepository, _metaAuditRepository, runtimeEventBus)
  const _runtimeProtocolRepository = new RuntimeProtocolRepository(pool)
  const _protocolAuditRepository = new ProtocolAuditRepository(pool)
  const _runtimeProtocolService = new RuntimeProtocolService(_runtimeProtocolRepository, _protocolAuditRepository, runtimeEventBus)
  const _federationContractRepository = new FederationContractRepository(pool)
  const _federationContractService = new FederationContractService(_federationContractRepository, _protocolAuditRepository, runtimeEventBus)
  const _protocolRegistryRepository = new ProtocolRegistryRepository(pool)
  const _distributedContractRegistry = new DistributedContractRegistry(_protocolRegistryRepository, _protocolAuditRepository, runtimeEventBus)
  const _runtimeHandshakeRepository = new RuntimeHandshakeRepository(pool)
  const _runtimeHandshakeService = new RuntimeHandshakeService(_runtimeHandshakeRepository, _protocolAuditRepository, runtimeEventBus)
  const _protocolBridgeRepository = new ProtocolBridgeRepository(pool)
  const _interSystemBridgeService = new InterSystemBridgeService(_protocolBridgeRepository, _protocolAuditRepository, runtimeEventBus)
  const _protocolRecoveryService = new ProtocolRecoveryService(_runtimeProtocolRepository, _federationContractRepository, _runtimeHandshakeRepository, _protocolBridgeRepository, _protocolAuditRepository, runtimeEventBus)
  const _runtimeEvolutionRepository = new RuntimeEvolutionRepository(pool)
  const _evolutionAuditRepository = new EvolutionAuditRepository(pool)
  const _evolutionRuntimeService = new EvolutionRuntimeService(_runtimeEvolutionRepository, _evolutionAuditRepository, runtimeEventBus)
  const _adaptiveOptimizationRepository = new AdaptiveOptimizationRepository(pool)
  const _adaptiveOptimizationService = new AdaptiveOptimizationService(_adaptiveOptimizationRepository, _evolutionAuditRepository, runtimeEventBus)
  const _runtimeTuningRepository = new RuntimeTuningRepository(pool)
  const _runtimeTuningService = new RuntimeTuningService(_runtimeTuningRepository, _evolutionAuditRepository, runtimeEventBus)
  const _autonomousEvolutionRepository = new AutonomousEvolutionRepository(pool)
  const _autonomousEvolutionService = new AutonomousEvolutionService(_autonomousEvolutionRepository, _evolutionAuditRepository, runtimeEventBus)
  const _distributedOptimizationRepository = new DistributedOptimizationRepository(pool)
  const _distributedOptimizationService = new DistributedOptimizationService(_distributedOptimizationRepository, _evolutionAuditRepository, runtimeEventBus)
  const _evolutionRecoveryService = new EvolutionRecoveryService(_runtimeEvolutionRepository, _adaptiveOptimizationRepository, _runtimeTuningRepository, _autonomousEvolutionRepository, _evolutionAuditRepository, runtimeEventBus)
  const _worldIntegrityRepository = new WorldIntegrityRepository(pool)
  const _integrityAuditRepository = new IntegrityAuditRepository(pool)
  const _worldIntegrityService = new WorldIntegrityService(_worldIntegrityRepository, _integrityAuditRepository, runtimeEventBus)
  const _distributedLockRepository = new DistributedLockRepository(pool)
  const _distributedLockingService = new DistributedLockingService(_distributedLockRepository, _integrityAuditRepository, runtimeEventBus)
  const _runtimeConsistencyRepository = new RuntimeConsistencyRepository(pool)
  const _deterministicConsistencyService = new DeterministicConsistencyService(_runtimeConsistencyRepository, _integrityAuditRepository, runtimeEventBus)
  const _integrityValidationRepository = new IntegrityValidationRepository(pool)
  const _globalWorldValidationService = new GlobalWorldValidationService(_integrityValidationRepository, _integrityAuditRepository, runtimeEventBus)
  const _worldReconciliationRepository = new WorldReconciliationRepository(pool)
  const _runtimeIntegrityCoordinator = new RuntimeIntegrityCoordinator(_worldReconciliationRepository, _integrityAuditRepository, runtimeEventBus)
  const _integrityRecoveryService = new IntegrityRecoveryService(_worldIntegrityRepository, _distributedLockRepository, _integrityValidationRepository, _worldReconciliationRepository, _integrityAuditRepository, runtimeEventBus)
  const _globalGovernanceRepository = new GlobalGovernanceRepository(pool)
  const _governanceContinuityAuditRepository = new GovernanceContinuityAuditRepository(pool)
  const _globalGovernanceService = new GlobalGovernanceService(_globalGovernanceRepository, _governanceContinuityAuditRepository, runtimeEventBus)
  const _crossSystemArbitrationRepository = new CrossSystemArbitrationRepository(pool)
  const _crossSystemArbitrationService = new CrossSystemArbitrationService(_crossSystemArbitrationRepository, _governanceContinuityAuditRepository, runtimeEventBus)
  const _runtimeConsensusRepository = new RuntimeConsensusRepository(pool)
  const _runtimeConsensusService = new RuntimeConsensusService(_runtimeConsensusRepository, _governanceContinuityAuditRepository, runtimeEventBus)
  const _globalPolicyRepository = new GlobalPolicyRepository(pool)
  const _distributedPolicyCoordinator = new DistributedPolicyCoordinator(_globalPolicyRepository, _governanceContinuityAuditRepository, runtimeEventBus)
  const _globalOwnershipRepository = new GlobalOwnershipRepository(pool)
  const _globalOwnershipAuthority = new GlobalOwnershipAuthority(_globalOwnershipRepository, _governanceContinuityAuditRepository, runtimeEventBus)
  const _governanceContinuityService = new GovernanceContinuityService(_globalGovernanceRepository, _crossSystemArbitrationRepository, _runtimeConsensusRepository, _globalPolicyRepository, _globalOwnershipRepository, _governanceContinuityAuditRepository, runtimeEventBus)
  const _continuityRuntimeRepository = new ContinuityRuntimeRepository(pool)
  const _continuityAuditRepository = new ContinuityAuditRepository(pool)
  const _continuityRuntimeService = new ContinuityRuntimeService(_continuityRuntimeRepository, _continuityAuditRepository, runtimeEventBus)
  const _temporalRecoveryRepository = new TemporalRecoveryRepository(pool)
  const _temporalRecoveryService = new TemporalRecoveryService(_temporalRecoveryRepository, _continuityAuditRepository, runtimeEventBus)
  const _infinitePersistenceRepository = new InfinitePersistenceRepository(pool)
  const _infinitePersistenceService = new InfinitePersistenceService(_infinitePersistenceRepository, _continuityAuditRepository, runtimeEventBus)
  const _checkpointRuntimeRepository = new CheckpointRuntimeRepository(pool)
  const _runtimeCheckpointCoordinator = new RuntimeCheckpointCoordinator(_checkpointRuntimeRepository, _continuityAuditRepository, runtimeEventBus)
  const _distributedContinuityService = new DistributedContinuityService(_infinitePersistenceRepository, _continuityAuditRepository, runtimeEventBus)
  const _temporalIntegrityRepository = new TemporalIntegrityRepository(pool)
  const _temporalIntegrityRecoveryService = new TemporalIntegrityRecoveryService(_continuityRuntimeRepository, _temporalRecoveryRepository, _checkpointRuntimeRepository, _infinitePersistenceRepository, _temporalIntegrityRepository, _continuityAuditRepository, runtimeEventBus)
  const _runtimeLockdownRepository = new RuntimeLockdownRepository(pool)
  const _lockdownAuditRepository = new LockdownAuditRepository(pool)
  const _runtimeLockdownService = new RuntimeLockdownService(_runtimeLockdownRepository, _lockdownAuditRepository, runtimeEventBus)
  const _deterministicClosureRepository = new DeterministicClosureRepository(pool)
  const _deterministicClosureService = new DeterministicClosureService(_deterministicClosureRepository, _lockdownAuditRepository, runtimeEventBus)
  const _productionIntegrityRepository = new ProductionIntegrityRepository(pool)
  const _productionIntegrityService = new ProductionIntegrityService(_productionIntegrityRepository, _lockdownAuditRepository, runtimeEventBus)
  const _runtimeSealRepository = new RuntimeSealRepository(pool)
  const _runtimeSealService = new RuntimeSealService(_runtimeSealRepository, _lockdownAuditRepository, runtimeEventBus)
  const _finalizationRuntimeRepository = new FinalizationRuntimeRepository(pool)
  const _distributedFinalizationService = new DistributedFinalizationService(_finalizationRuntimeRepository, _lockdownAuditRepository, runtimeEventBus)
  const _lockdownRecoveryService = new LockdownRecoveryService(_runtimeLockdownRepository, _productionIntegrityRepository, _runtimeSealRepository, _finalizationRuntimeRepository, _deterministicClosureRepository, _lockdownAuditRepository, runtimeEventBus)
  const _runtimeCertificationRepository = new RuntimeCertificationRepository(pool)
  const _certificationAuditRepository = new CertificationAuditRepository(pool)
  const _runtimeCertificationService = new RuntimeCertificationService(_runtimeCertificationRepository, _certificationAuditRepository, runtimeEventBus)
  const _deterministicValidationRepository = new DeterministicValidationRepository(pool)
  const _deterministicValidationService = new DeterministicValidationService(_deterministicValidationRepository, _certificationAuditRepository, runtimeEventBus)
  const _runtimeComplianceRepository = new RuntimeComplianceRepository(pool)
  const _complianceEnforcementService = new ComplianceEnforcementService(_runtimeComplianceRepository, _certificationAuditRepository, runtimeEventBus)
  const _verificationRuntimeRepository = new VerificationRuntimeRepository(pool)
  const _runtimeVerificationService = new RuntimeVerificationService(_verificationRuntimeRepository, _certificationAuditRepository, runtimeEventBus)
  const _complianceCoordinationRepository = new ComplianceCoordinationRepository(pool)
  const _distributedComplianceCoordinator = new DistributedComplianceCoordinator(_complianceCoordinationRepository, _certificationAuditRepository, runtimeEventBus)
  const _certificationRecoveryService = new CertificationRecoveryService(_runtimeCertificationRepository, _deterministicValidationRepository, _runtimeComplianceRepository, _verificationRuntimeRepository, _complianceCoordinationRepository, _certificationAuditRepository, runtimeEventBus)
  const _runtimeSovereigntyRepository = new RuntimeSovereigntyRepository(pool)
  const _sovereigntyAuditRepository = new SovereigntyAuditRepository(pool)
  const _runtimeSovereigntyService = new RuntimeSovereigntyService(_runtimeSovereigntyRepository, _sovereigntyAuditRepository, runtimeEventBus)
  const _clusterContinuityRepository = new ClusterContinuityRepository(pool)
  const _infiniteClusterContinuityService = new InfiniteClusterContinuityService(_clusterContinuityRepository, _sovereigntyAuditRepository, runtimeEventBus)
  const _autonomousFinalizationRepository = new AutonomousFinalizationRepository(pool)
  const _autonomousFinalizationService = new AutonomousFinalizationService(_autonomousFinalizationRepository, _sovereigntyAuditRepository, runtimeEventBus)
  const _sovereigntyCoordinationRepository = new SovereigntyCoordinationRepository(pool)
  const _distributedSovereigntyCoordinator = new DistributedSovereigntyCoordinator(_sovereigntyCoordinationRepository, _sovereigntyAuditRepository, runtimeEventBus)
  const _runtimeSuccessionRepository = new RuntimeSuccessionRepository(pool)
  const _runtimeSuccessionService = new RuntimeSuccessionService(_runtimeSuccessionRepository, _sovereigntyAuditRepository, runtimeEventBus)
  const _sovereigntyRecoveryService = new SovereigntyRecoveryService(_runtimeSovereigntyRepository, _clusterContinuityRepository, _autonomousFinalizationRepository, _runtimeSuccessionRepository, _sovereigntyCoordinationRepository, _sovereigntyAuditRepository, runtimeEventBus)
  const _coreFinalizationRepository = new CoreFinalizationRepository(pool)
  const _coreFinalizationAuditRepository = new CoreFinalizationAuditRepository(pool)
  const _coreFinalizationService = new CoreFinalizationService(_coreFinalizationRepository, _coreFinalizationAuditRepository, runtimeEventBus)
  const _deterministicSealingRepository = new DeterministicSealingRepository(pool)
  const _deterministicSealService = new DeterministicSealService(_deterministicSealingRepository, _coreFinalizationAuditRepository, runtimeEventBus)
  const _runtimeCompletionRepository = new RuntimeCompletionRepository(pool)
  const _productionCompletionService = new ProductionCompletionService(_runtimeCompletionRepository, _coreFinalizationAuditRepository, runtimeEventBus)
  const _finalizationCoordinationRepository = new FinalizationCoordinationRepository(pool)
  const _runtimeCompletionCoordinator = new RuntimeCompletionCoordinator(_finalizationCoordinationRepository, _coreFinalizationAuditRepository, runtimeEventBus)
  const _productionSealRepository = new ProductionSealRepository(pool)
  const _distributedFinalSealService = new DistributedFinalSealService(_productionSealRepository, _coreFinalizationAuditRepository, runtimeEventBus)
  const _finalizationRecoveryService = new FinalizationRecoveryService(_coreFinalizationRepository, _runtimeCompletionRepository, _productionSealRepository, _finalizationCoordinationRepository, _deterministicSealingRepository, _coreFinalizationAuditRepository, runtimeEventBus)
  const _runtimeGatewayRepository = new RuntimeGatewayRepository(pool)
  const _gatewayAuditRepository = new GatewayAuditRepository(pool)
  const _runtimeGatewayService = new RuntimeGatewayService(_runtimeGatewayRepository, _gatewayAuditRepository, runtimeEventBus)
  const _accessMeshRepository = new AccessMeshRepository(pool)
  const _deterministicAccessMeshService = new DeterministicAccessMeshService(_accessMeshRepository, _gatewayAuditRepository, runtimeEventBus)
  const _gatewayRoutingRepository = new GatewayRoutingRepository(pool)
  const _distributedApiRoutingService = new DistributedApiRoutingService(_gatewayRoutingRepository, _gatewayAuditRepository, runtimeEventBus)
  const _runtimeExposureRepository = new RuntimeExposureRepository(pool)
  const _runtimeExposureCoordinator = new RuntimeExposureCoordinator(_runtimeExposureRepository, _gatewayAuditRepository, runtimeEventBus)
  const _surfaceProtectionRepository = new SurfaceProtectionRepository(pool)
  const _runtimeSurfaceProtectionService = new RuntimeSurfaceProtectionService(_surfaceProtectionRepository, _gatewayAuditRepository, runtimeEventBus)
  const _gatewayRecoveryService = new GatewayRecoveryService(_runtimeGatewayRepository, _accessMeshRepository, _gatewayRoutingRepository, _runtimeExposureRepository, _surfaceProtectionRepository, _gatewayAuditRepository, runtimeEventBus)
  const _runtimeHardeningRepository = new RuntimeHardeningRepository(pool)
  const _hardeningAuditRepository = new HardeningAuditRepository(pool)
  const _runtimeHardeningService = new RuntimeHardeningService(_runtimeHardeningRepository, _hardeningAuditRepository, runtimeEventBus)
  const _immutableSecurityRepository = new ImmutableSecurityRepository(pool)
  const _immutableSecurityCoordinator = new ImmutableSecurityCoordinator(_immutableSecurityRepository, _hardeningAuditRepository, runtimeEventBus)
  const _securityValidationRepository = new SecurityValidationRepository(pool)
  const _distributedSecurityValidationService = new DistributedSecurityValidationService(_securityValidationRepository, _hardeningAuditRepository, runtimeEventBus)
  const _sealValidationRepository = new SealValidationRepository(pool)
  const _runtimeSealVerificationService = new RuntimeSealVerificationService(_sealValidationRepository, _hardeningAuditRepository, runtimeEventBus)
  const _threatMitigationRepository = new ThreatMitigationRepository(pool)
  const _autonomousThreatMitigationService = new AutonomousThreatMitigationService(_threatMitigationRepository, _hardeningAuditRepository, runtimeEventBus)
  const _hardeningRecoveryService = new HardeningRecoveryService(_runtimeHardeningRepository, _immutableSecurityRepository, _securityValidationRepository, _sealValidationRepository, _threatMitigationRepository, _hardeningAuditRepository, runtimeEventBus)
  const _runtimeSustainmentRepository = new RuntimeSustainmentRepository(pool)
  const _sustainmentAuditRepository = new SustainmentAuditRepository(pool)
  const _runtimeSustainmentService = new RuntimeSustainmentService(_runtimeSustainmentRepository, _sustainmentAuditRepository, runtimeEventBus)
  const _infiniteRecoveryRepository = new InfiniteRecoveryRepository(pool)
  const _infiniteRecoveryCoordinator = new InfiniteRecoveryCoordinator(_infiniteRecoveryRepository, _sustainmentAuditRepository, runtimeEventBus)
  const _autonomousMaintenanceRepository = new AutonomousMaintenanceRepository(pool)
  const _autonomousMaintenanceService = new AutonomousMaintenanceService(_autonomousMaintenanceRepository, _sustainmentAuditRepository, runtimeEventBus)
  const _distributedSustainmentRepository = new DistributedSustainmentRepository(pool)
  const _distributedSustainmentService = new DistributedSustainmentService(_distributedSustainmentRepository, _sustainmentAuditRepository, runtimeEventBus)
  const _runtimeLongevityRepository = new RuntimeLongevityRepository(pool)
  const _runtimeLongevityService = new RuntimeLongevityService(_runtimeLongevityRepository, _sustainmentAuditRepository, runtimeEventBus)
  const _sustainmentRecoveryService = new SustainmentRecoveryService(_runtimeSustainmentRepository, _infiniteRecoveryRepository, _autonomousMaintenanceRepository, _distributedSustainmentRepository, _runtimeLongevityRepository, _sustainmentAuditRepository, runtimeEventBus)
  const _developerPlatformRepository = new DeveloperPlatformRepository(pool)
  const _developerAuditRepository = new DeveloperAuditRepository(pool)
  const _developerPlatformService = new DeveloperPlatformService(_developerPlatformRepository, _developerAuditRepository, runtimeEventBus)
  const _sdkRegistryRepository = new SdkRegistryRepository(pool)
  const _runtimeSdkRegistryService = new RuntimeSdkRegistryService(_sdkRegistryRepository, _developerAuditRepository, runtimeEventBus)
  const _pluginCompatibilityRepository = new PluginCompatibilityRepository(pool)
  const _pluginCompatibilityService = new PluginCompatibilityService(_pluginCompatibilityRepository, _developerAuditRepository, runtimeEventBus)
  const _extensionRuntimeRepository = new ExtensionRuntimeRepository(pool)
  const _extensionLifecycleService = new ExtensionLifecycleService(_extensionRuntimeRepository, _developerAuditRepository, runtimeEventBus)
  const _contractValidationRepository = new ContractValidationRepository(pool)
  const _runtimeContractValidationService = new RuntimeContractValidationService(_contractValidationRepository, _developerAuditRepository, runtimeEventBus)
  const _developerRecoveryService = new DeveloperRecoveryService(_developerPlatformRepository, _sdkRegistryRepository, _pluginCompatibilityRepository, _extensionRuntimeRepository, _contractValidationRepository, _developerAuditRepository, runtimeEventBus)
  const _releaseGovernanceRepository = new ReleaseGovernanceRepository(pool)
  const _releaseAuditRepository = new ReleaseAuditRepository(pool)
  const _releaseGovernanceService = new ReleaseGovernanceService(_releaseGovernanceRepository, _releaseAuditRepository, runtimeEventBus)
  const _productionDeploymentRepository = new ProductionDeploymentRepository(pool)
  const _productionDeploymentCoordinator = new ProductionDeploymentCoordinator(_productionDeploymentRepository, _releaseAuditRepository, runtimeEventBus)
  const _releaseValidationRepository = new ReleaseValidationRepository(pool)
  const _runtimeReleaseValidationService = new RuntimeReleaseValidationService(_releaseValidationRepository, _releaseAuditRepository, runtimeEventBus)
  const _releaseOrchestrationRepository = new ReleaseOrchestrationRepository(pool)
  const _distributedReleaseOrchestrator = new DistributedReleaseOrchestrator(_releaseOrchestrationRepository, _releaseAuditRepository, runtimeEventBus)
  const _globalReleaseRuntimeRepository = new GlobalReleaseRuntimeRepository(pool)
  const _globalDeploymentGovernanceService = new GlobalDeploymentGovernanceService(_globalReleaseRuntimeRepository, _releaseAuditRepository, runtimeEventBus)
  const _releaseRecoveryService = new ReleaseRecoveryService(_releaseGovernanceRepository, _productionDeploymentRepository, _releaseValidationRepository, _releaseOrchestrationRepository, _globalReleaseRuntimeRepository, _releaseAuditRepository, runtimeEventBus)
  const _enterpriseReadinessRepository = new EnterpriseReadinessRepository(pool)
  const _enterpriseAuditRepository = new EnterpriseAuditRepository(pool)
  const _enterpriseReadinessService = new EnterpriseReadinessService(_enterpriseReadinessRepository, _enterpriseAuditRepository, runtimeEventBus)
  const _deterministicAuditRepository = new DeterministicAuditRepository(pool)
  const _deterministicAuditService = new DeterministicAuditService(_deterministicAuditRepository, _enterpriseAuditRepository, runtimeEventBus)
  const _integrityVerificationRepository = new IntegrityVerificationRepository(pool)
  const _runtimeIntegrityVerificationService = new RuntimeIntegrityVerificationService(_integrityVerificationRepository, _enterpriseAuditRepository, runtimeEventBus)
  const _productionReadinessRepository = new ProductionReadinessRepository(pool)
  const _productionReadinessCoordinator = new ProductionReadinessCoordinator(_productionReadinessRepository, _enterpriseAuditRepository, runtimeEventBus)
  const _distributedAuditRepository = new DistributedAuditRepository(pool)
  const _distributedAuditOrchestrator = new DistributedAuditOrchestrator(_distributedAuditRepository, _enterpriseAuditRepository, runtimeEventBus)
  const _enterpriseRecoveryService = new EnterpriseRecoveryService(_enterpriseReadinessRepository, _deterministicAuditRepository, _integrityVerificationRepository, _productionReadinessRepository, _distributedAuditRepository, _enterpriseAuditRepository, runtimeEventBus)
  const _coreClosureRepository = new CoreClosureRepository(pool)
  const _coreClosureAuditRepository = new CoreClosureAuditRepository(pool)
  const _coreClosureService = new CoreClosureService(_coreClosureRepository, _coreClosureAuditRepository, runtimeEventBus)
  const _runtimeImmutabilityRepository = new RuntimeImmutabilityRepository(pool)
  const _productionImmutabilityService = new ProductionImmutabilityService(_runtimeImmutabilityRepository, _coreClosureAuditRepository, runtimeEventBus)
  const _productionFreezeRepository = new ProductionFreezeRepository(pool)
  const _runtimeFreezeCoordinator = new RuntimeFreezeCoordinator(_productionFreezeRepository, _coreClosureAuditRepository, runtimeEventBus)
  const _distributedClosureRepository = new DistributedClosureRepository(pool)
  const _distributedClosureOrchestrator = new DistributedClosureOrchestrator(_distributedClosureRepository, _coreClosureAuditRepository, runtimeEventBus)
  const _finalValidationRepository = new FinalValidationRepository(pool)
  const _deterministicCompletionValidator = new DeterministicCompletionValidator(_finalValidationRepository, _coreClosureAuditRepository, runtimeEventBus)
  const _finalRecoveryCoordinator = new FinalRecoveryCoordinator(_coreClosureRepository, _runtimeImmutabilityRepository, _productionFreezeRepository, _distributedClosureRepository, _finalValidationRepository, _coreClosureAuditRepository, runtimeEventBus)

  return {
    accessMeshRepo: _accessMeshRepository,
    adaptiveOptimizationRepo: _adaptiveOptimizationRepository,
    adaptiveOptimizationService: _adaptiveOptimizationService,
    aiAuditRepo: _aiAuditRepository,
    aiPatrolRepo: _aiPatrolRepository,
    aiRecoveryService: _aiRecoveryService,
    aiReinforcementRepo: _aiReinforcementRepository,
    aiResponseRuntimeRepo: _aiResponseRuntimeRepository,
    aiRuntimeRepo: _aiRuntimeRepository,
    aiRuntimeService: _aiRuntimeService,
    aiThreatAssessmentRepo: _aiThreatAssessmentRepository,
    aircraftRepo: _aircraftRepository,
    airspaceZoneRepo: _airspaceZoneRepository,
    ambientBehaviorService: _ambientBehaviorService,
    armorPenetrationService: _armorPenetrationService,
    assetValuationRepo: _assetValuationRepository,
    assetValuationService: _assetValuationService,
    auctionRuntimeService: _auctionRuntimeService,
    auditService: _atcAuditService,
    autonomousEvolutionRepo: _autonomousEvolutionRepository,
    autonomousEvolutionService: _autonomousEvolutionService,
    autonomousFinalizationRepo: _autonomousFinalizationRepository,
    autonomousFinalizationService: _autonomousFinalizationService,
    autonomousHealingService: _autonomousHealingService,
    autonomousMaintenanceRepo: _autonomousMaintenanceRepository,
    autonomousMaintenanceService: _autonomousMaintenanceService,
    autonomousPatrolService: _autonomousPatrolService,
    autonomousPolicyService: _autonomousPolicyService,
    autonomousProtectionService: _autonomousProtectionService,
    autonomousTaxAdjustmentService: _autonomousTaxAdjustmentService,
    autonomousThreatMitigationService: _autonomousThreatMitigationService,
    aviationRuntimeService: _aviationRuntimeService,
    ballisticsRepo: _ballisticsRepository,
    ballisticsRuntimeService: _ballisticsRuntimeService,
    ballisticsService: _ballisticsService,
    bankAccountRepo: _bankAccountRepository,
    bankTransactionRepo: _bankTransactionRepository,
    bankingRuntimeService: _bankingRuntimeService,
    blackMarketRepo: _blackMarketRepository,
    blackMarketService: _blackMarketService,
    blueprintService: _blueprintService,
    boloRepo: _boloRepository,
    campaignOrchestrationService: _campaignOrchestrationService,
    campaignRuntimeRepo: _campaignRuntimeRepository,
    cargoRuntimeRepo: _cargoRuntimeRepository,
    certificationAuditRepo: _certificationAuditRepository,
    certificationRecoveryService: _certificationRecoveryService,
    chaosRuntimeRepo: _chaosRuntimeRepository,
    chaosSimulationService: _chaosSimulationService,
    checkpointRuntimeRepo: _checkpointRuntimeRepository,
    cityInfrastructureRepo: _cityInfrastructureRepository,
    cityInfrastructureService: _cityInfrastructureService,
    civicInfluenceRepo: _civicInfluenceRepository,
    civicInfluenceService: _civicInfluenceService,
    cleanupOrchestrationService: _cleanupOrchestrationService,
    climatePersistenceService: _climatePersistenceService,
    climateRuntimeRepo: _climateRuntimeRepository,
    clusterAllocationService: _clusterAllocationService,
    clusterAuditRepo: _clusterAuditRepository,
    clusterContinuityRepo: _clusterContinuityRepository,
    clusterNodeRepo: _clusterNodeRepository,
    clusterRuntimeService: _clusterRuntimeService,
    clusterScalingRepo: _clusterScalingRepository,
    combatAuditService: _combatAuditService,
    combatInjuryRepo: _injuryRepository_combat_runtime,
    combatRecoveryService: _combatRecoveryService,
    combatRuntimeService: _combatRuntimeService,
    combatSessionRepo: _combatSessionRepository,
    combatSimArmorRepo: _armorRuntimeRepository,
    combatSimAuditRepo: _combatAuditRepository,
    combatSimBallisticsRepo: _ballisticsRuntimeRepository,
    combatSimDamageRepo: _tacticalDamageRepository,
    combatSimRuntimeRepo: _combatRuntimeRepository,
    combatSimSuppressionRepo: _suppressionRuntimeRepository,
    combatSimulationService: _combatSimulationService,
    commerceOrders: _orderRepository,
    commerceReceipts: _receiptRepository,
    commerceService: _commerceService,
    commerceShopItems: _shopItemRepository,
    commerceShops: _shopRepository,
    commerceTaxRules: _taxRuleRepository,
    communicationAuditRepo: _communicationAuditRepository,
    complianceCoordinationRepo: _complianceCoordinationRepository,
    complianceEnforcementService: _complianceEnforcementService,
    conflictRuntimeService: _conflictRuntimeService,
    continuityAuditRepo: _continuityAuditRepository,
    continuityRuntimeRepo: _continuityRuntimeRepository,
    continuityRuntimeService: _continuityRuntimeService,
    contrabandRepo: _contrabandRepository,
    contrabandService: _contrabandService,
    contractValidationRepo: _contractValidationRepository,
    coreClosureAuditRepo: _coreClosureAuditRepository,
    coreClosureRepo: _coreClosureRepository,
    coreClosureService: _coreClosureService,
    coreFinalizationAuditRepo: _coreFinalizationAuditRepository,
    coreFinalizationRepo: _coreFinalizationRepository,
    coreFinalizationService: _coreFinalizationService,
    craftingAuditRepo: _craftingAuditRepository,
    craftingBlueprintRepo: _craftingBlueprintRepository,
    criminalOperationRepo: _criminalOperationRepository,
    criminalRuntimeService: _criminalRuntimeService,
    crossNodeReconciliationService: _crossNodeReconciliationService,
    crossSystemArbitrationRepo: _crossSystemArbitrationRepository,
    crossSystemArbitrationService: _crossSystemArbitrationService,
    crowdRuntimeRepo: _crowdRuntimeRepository,
    crowdSimulationService: _crowdSimulationService,
    damageRepo: _damageRepository,
    damageRuntimeService: _damageRuntimeService,
    damageService: _damageService,
    deliveryAuditRepo: _deliveryAuditRepository,
    deploymentOrchestrationService: _deploymentOrchestrationService,
    deterministicAccessMeshService: _deterministicAccessMeshService,
    deterministicAuditRepo: _deterministicAuditRepository,
    deterministicAuditService: _deterministicAuditService,
    deterministicClosureRepo: _deterministicClosureRepository,
    deterministicClosureService: _deterministicClosureService,
    deterministicCompletionValidator: _deterministicCompletionValidator,
    deterministicConsistencyService: _deterministicConsistencyService,
    deterministicSealService: _deterministicSealService,
    deterministicSealingRepo: _deterministicSealingRepository,
    deterministicValidationRepo: _deterministicValidationRepository,
    deterministicValidationService: _deterministicValidationService,
    developerAuditRepo: _developerAuditRepository,
    developerPlatformRepo: _developerPlatformRepository,
    developerPlatformService: _developerPlatformService,
    developerRecoveryService: _developerRecoveryService,
    diplomacyService: _diplomacyService,
    diplomaticRelationsRepo: _diplomaticRelationsRepository,
    disasterAuditRepo: _disasterAuditRepository,
    disasterEventRepo: _disasterEventRepository,
    disasterRuntimeService: _disasterRuntimeService,
    dispatchCallRepo: _dispatchCallRepository,
    dispatchService: _dispatchService,
    distributedApiRoutingService: _distributedApiRoutingService,
    distributedAuditOrchestrator: _distributedAuditOrchestrator,
    distributedAuditRepo: _distributedAuditRepository,
    distributedClosureOrchestrator: _distributedClosureOrchestrator,
    distributedClosureRepo: _distributedClosureRepository,
    distributedComplianceCoordinator: _distributedComplianceCoordinator,
    distributedContinuityService: _distributedContinuityService,
    distributedContractRegistry: _distributedContractRegistry,
    distributedDeploymentRecoveryService: _distributedDeploymentRecoveryService,
    distributedFinalSealService: _distributedFinalSealService,
    distributedFinalizationService: _distributedFinalizationService,
    distributedHealthRecoveryService: _distributedHealthRecoveryService,
    distributedLockRepo: _distributedLockRepository,
    distributedLockingService: _distributedLockingService,
    distributedOptimizationRepo: _distributedOptimizationRepository,
    distributedOptimizationService: _distributedOptimizationService,
    distributedPolicyCoordinator: _distributedPolicyCoordinator,
    distributedReleaseOrchestrator: _distributedReleaseOrchestrator,
    distributedRepairRepo: _distributedRepairRepository,
    distributedRepairService: _distributedRepairService,
    distributedSecurityValidationService: _distributedSecurityValidationService,
    distributedShardService: _distributedShardService,
    distributedSnapshotService: _distributedSnapshotService,
    distributedSovereigntyCoordinator: _distributedSovereigntyCoordinator,
    distributedSustainmentRepo: _distributedSustainmentRepository,
    distributedSustainmentService: _distributedSustainmentService,
    distributedTracingService: _distributedTracingService,
    dockingRuntimeRepo: _dockingRuntimeRepository,
    dynamicEventRepo: _dynamicEventRepository,
    dynamicEventService: _dynamicEventService,
    dynamicNarrativeService: _dynamicNarrativeService,
    dynamicSpawnService: _dynamicSpawnService,
    dynamicStoryStateRepo: _dynamicStoryStateRepository,
    ecologyAuditRepo: _ecologyAuditRepository,
    ecologyRecoveryService: _ecologyRecoveryService,
    ecologyRuntimeRepo: _ecologyRuntimeRepository,
    ecologyRuntimeService: _ecologyRuntimeService,
    economicRecoveryService: _economicRecoveryService,
    economyAuditRepo: _economyAuditRepository,
    economyRegulationRepo: _economyRegulationRepository,
    economyRegulationService: _economyRegulationService,
    electionRepo: _electionRepository,
    emergencyAccessService: _emergencyAccessService,
    emergencyBroadcastRepo: _emergencyBroadcastRepository,
    emergencyBroadcastService: _emergencyBroadcastService,
    emergencyResponseRepo: _emergencyResponseRepository,
    emergencyResponseService: _emergencyResponseService,
    employmentRepo: _employmentContractRepository,
    emsAmbulanceRepo: _ambulanceRepository,
    emsEmergencyRepo: _emergencyRepository,
    emsHospitalCapacityRepo: _hospitalCapacityRepository,
    emsRuntimeService: _emergencyRuntimeService,
    encryptedChannelRepo: _encryptedChannelRepository,
    encryptionRuntimeService: _encryptionRuntimeService,
    enterpriseAuditRepo: _enterpriseAuditRepository,
    enterpriseReadinessRepo: _enterpriseReadinessRepository,
    enterpriseReadinessService: _enterpriseReadinessService,
    enterpriseRecoveryService: _enterpriseRecoveryService,
    entityGraphSdk: _atcEntityGraphSDK,
    entityIntelSdk: _atcEntityIntelligenceSDK,
    entityOwnershipRepo: _entityOwnershipRepository,
    entityOwnershipService: _entityOwnershipService,
    environmentRuntimeRepo: _environmentRuntimeRepository,
    environmentRuntimeService: _environmentRuntimeService,
    environmentalEvolutionRepo: _environmentalEvolutionRepository,
    environmentalEvolutionService: _environmentalEvolutionService,
    environmentalExposureRepo: _environmentalExposureRepository,
    environmentalHazardRepo: _environmentalHazardRepository,
    environmentalHazardService: _environmentalHazardService,
    evacuationRuntimeRepo: _evacuationRuntimeRepository,
    evacuationRuntimeService: _evacuationRuntimeService,
    evolutionAuditRepo: _evolutionAuditRepository,
    evolutionRecoveryService: _evolutionRecoveryService,
    evolutionRuntimeService: _evolutionRuntimeService,
    extensionLifecycleService: _extensionLifecycleService,
    extensionRuntimeRepo: _extensionRuntimeRepository,
    factionConflictRepo: _factionConflictRepository,
    factionRelationshipService: _factionRelationshipService,
    factionRepo: _factionRepository,
    factionRuntimeService: _factionRuntimeService,
    failoverAuditRepo: _failoverAuditRepository,
    failoverOrchestrationService: _failoverOrchestrationService,
    failureCorrelationRepo: _failureCorrelationRepository,
    failureCorrelationService: _failureCorrelationService,
    fatigueRuntimeRepo: _fatigueRuntimeRepository,
    fatigueRuntimeService: _fatigueRuntimeService,
    federationAuditRepo: _federationAuditRepository,
    federationContractRepo: _federationContractRepository,
    federationContractService: _federationContractService,
    federationNodeRepo: _federationNodeRepository,
    federationOwnershipRepo: _federationOwnershipRepository,
    federationOwnershipService: _federationOwnershipService,
    federationRecoveryService: _federationRecoveryService,
    federationRuntimeService: _federationRuntimeService,
    finalRecoveryCoordinator: _finalRecoveryCoordinator,
    finalValidationRepo: _finalValidationRepository,
    finalizationCoordinationRepo: _finalizationCoordinationRepository,
    finalizationRecoveryService: _finalizationRecoveryService,
    finalizationRuntimeRepo: _finalizationRuntimeRepository,
    financialAccounts: _accountRepository_ledger,
    financialFlagRepo: _financialFlagRepository,
    financialFraudService: _financialFraudService,
    fleetRepo: _fleetRepository,
    fleetService: _fleetService,
    flightRuntimeRepo: _flightRuntimeRepository,
    foreclosureRepo: _foreclosureRepository,
    foreclosureService: _foreclosureService,
    fuelRepo: _fuelRepository,
    fuelRuntimeService: _fuelRuntimeService,
    gangMemberRepo: _gangMemberRepository,
    gangOperationService: _gangOperationService,
    gangRepo: _gangRepository,
    garageRepo: _garageRepository,
    garageService: _garageService,
    gatewayAuditRepo: _gatewayAuditRepository,
    gatewayRecoveryService: _gatewayRecoveryService,
    gatewayRoutingRepo: _gatewayRoutingRepository,
    globalDeploymentGovernanceService: _globalDeploymentGovernanceService,
    globalGovernanceRepo: _globalGovernanceRepository,
    globalGovernanceService: _globalGovernanceService,
    globalOwnershipAuthority: _globalOwnershipAuthority,
    globalOwnershipRepo: _globalOwnershipRepository,
    globalPersistenceService: _globalPersistenceService,
    globalPolicyRepo: _globalPolicyRepository,
    globalReleaseRuntimeRepo: _globalReleaseRuntimeRepository,
    globalSnapshotRepo: _globalSnapshotRepository,
    globalWorldValidationService: _globalWorldValidationService,
    governanceAuditRepo: _governanceAuditRepository,
    governanceContinuityAuditRepo: _governanceContinuityAuditRepository,
    governanceContinuityService: _governanceContinuityService,
    governanceRecoveryService: _governanceRecoveryService,
    governanceRuntimeRepo: _governanceRuntimeRepository,
    governanceRuntimeService: _governanceRuntimeService,
    hardeningAuditRepo: _hardeningAuditRepository,
    hardeningRecoveryService: _hardeningRecoveryService,
    hazardZoneRepo: _hazardZoneRepository,
    healingOperationRepo: _healingOperationRepository,
    hospitalRepo: _hospitalRepository,
    housingEconomyService: _housingEconomyService,
    housingPaymentRepo: _housingPaymentRepository,
    hydrationRuntimeRepo: _hydrationRuntimeRepository,
    hydrationRuntimeService: _hydrationRuntimeService,
    iamCache: _atcIamCache,
    illegalTradeService: _illegalTradeService,
    immutableSecurityCoordinator: _immutableSecurityCoordinator,
    immutableSecurityRepo: _immutableSecurityRepository,
    impoundRepo: _impoundRepository,
    impoundService: _impoundService,
    incidentRepo: _incidentRepository,
    infiniteClusterContinuityService: _infiniteClusterContinuityService,
    infinitePersistenceRepo: _infinitePersistenceRepository,
    infinitePersistenceService: _infinitePersistenceService,
    infiniteRecoveryCoordinator: _infiniteRecoveryCoordinator,
    infiniteRecoveryRepo: _infiniteRecoveryRepository,
    inflationControlService: _inflationControlService,
    inflationRuntimeRepo: _inflationRuntimeRepository,
    influenceHistoryRepo: _influenceHistoryRepository,
    influenceRepo: _influenceRuntimeRepository,
    influenceRuntimeService: _influenceRuntimeService,
    influenceTrackingService: _influenceTrackingService,
    infrastructureFailureRepo: _infrastructureFailureRepository,
    infrastructureRecoveryService: _infrastructureRecoveryService,
    injuryPropagationService: _injuryPropagationService,
    injuryRepo: _injuryRepository_medical,
    integrityAuditRepo: _integrityAuditRepository,
    integrityRecoveryService: _integrityRecoveryService,
    integrityValidationRepo: _integrityValidationRepository,
    integrityVerificationRepo: _integrityVerificationRepository,
    interSystemBridgeService: _interSystemBridgeService,
    interclusterRouteRepo: _interclusterRouteRepository,
    interclusterRoutingService: _interclusterRoutingService,
    interestManagementService: _interestManagementService,
    interestRegionRepo: _interestRegionRepository,
    interiorStateService: _interiorStateService,
    invoices: _invoiceRepository,
    jobGradeRepo: _jobGradeRepository,
    jobRepo: _jobRepository,
    lawAgencyRepo: _agencyRepository,
    lawArrestRepo: _arrestRepository,
    lawCaseRepo: _legalCaseRepository,
    lawCitationRepo: _citationRepository,
    lawEvidenceRepo: _evidenceRepository,
    lawJailRepo: _jailRepository,
    lawService: _lawEnforcementService,
    lawWarrantRepo: _warrantRepository,
    ledger: _ledgerService,
    legislativeRepo: _legislativeRepository,
    legislativeRuntimeService: _legislativeRuntimeService,
    lockdownAuditRepo: _lockdownAuditRepository,
    lockdownRecoveryService: _lockdownRecoveryService,
    logisticsFleetRepo: _logisticsFleetRepository,
    logisticsFleetService: _logisticsFleetService,
    longTermRecoveryService: _longTermRecoveryService,
    longtermRecoveryRepo: _longtermRecoveryRepository,
    manufacturingQueueRepo: _manufacturingQueueRepository,
    manufacturingQueueService: _manufacturingQueueService,
    maritimeRuntimeService: _maritimeRuntimeService,
    marketAuctionRepo: _marketAuctionRepository,
    marketListingRepo: _marketListingRepository,
    marketStabilizationRepo: _marketStabilizationRepository,
    marketStabilizationService: _marketStabilizationService,
    marketplaceService: _marketplaceService,
    mdtService: _mdtService,
    medicalService: _medicalService,
    members: _memberRepository,
    metaAllocationRepo: _metaAllocationRepository,
    metaAllocationService: _metaAllocationService,
    metaAuditRepo: _metaAuditRepository,
    metaRuntimeRepo: _metaRuntimeRepository,
    metaRuntimeService: _metaRuntimeService,
    missionAssignmentRepo: _missionAssignmentRepository,
    missionAuditRepo: _missionAuditRepository,
    missionCleanupService: _missionCleanupService,
    missionObjectiveRepo: _missionObjectiveRepository,
    missionProgressionService: _missionProgressionService,
    missionRepo: _missionRepository,
    missionRuntimeService: _missionRuntimeService,
    multiRegionSyncService: _multiRegionSyncService,
    narrativeAuditRepo: _narrativeAuditRepository,
    narrativeRecoveryService: _narrativeRecoveryService,
    narrativeRuntimeService: _narrativeRuntimeService,
    narrativeSessionRepo: _narrativeSessionRepository,
    nodeLifecycleRepo: _nodeLifecycleRepository,
    nodeLifecycleService: _nodeLifecycleService,
    nodeTransferRepo: _nodeTransferRepository,
    npcBehaviorRepo: _npcBehaviorRepository,
    npcCleanupRepo: _npcCleanupRepository,
    npcRuntimeRepo: _npcRuntimeRepository,
    npcRuntimeService: _npcRuntimeService,
    npcSpawnPointRepo: _npcSpawnPointRepository,
    objectiveTrackingService: _objectiveTrackingService,
    observabilityAuditRepo: _observabilityAuditRepository,
    organizations: _organizationRepository,
    ownershipTransferService: _ownershipTransferService,
    payrollRepo: _payrollRepository,
    payrollService: _payrollService,
    persistenceAuditRepo: _persistenceAuditRepository,
    persistenceConsistencyService: _persistenceConsistencyService,
    persistenceRuntimeRepo: _persistenceRuntimeRepository,
    persistentSceneRepo: _persistentSceneRepository,
    persistentSceneService: _persistentSceneService,
    persistentWorldRecoveryService: _persistentWorldRecoveryService,
    pluginCompatibilityRepo: _pluginCompatibilityRepository,
    pluginCompatibilityService: _pluginCompatibilityService,
    policyRepo: _policyRepository,
    politicalElectionService: _politicalElectionService,
    populationZoneRepo: _populationZoneRepository,
    productionCompletionService: _productionCompletionService,
    productionDeploymentCoordinator: _productionDeploymentCoordinator,
    productionDeploymentRepo: _productionDeploymentRepository,
    productionFreezeRepo: _productionFreezeRepository,
    productionImmutabilityService: _productionImmutabilityService,
    productionIntegrityRepo: _productionIntegrityRepository,
    productionIntegrityService: _productionIntegrityService,
    productionJobRepo: _productionJobRepository,
    productionJobService: _productionJobService,
    productionReadinessCoordinator: _productionReadinessCoordinator,
    productionReadinessRepo: _productionReadinessRepository,
    productionSealRepo: _productionSealRepository,
    professionRepo: _professionRepository,
    propertyAccessRepo: _propertyAccessRepository,
    propertyAccessService: _propertyAccessService,
    propertyGarageRepo: _propertyGarageRepository,
    propertyGarageService: _propertyGarageService,
    propertyRepo: _propertyRepository,
    propertyRuntimeRepo: _propertyRuntimeRepository,
    propertyRuntimeService: _propertyRuntimeService,
    propertyStashRepo: _propertyStashRepository,
    propertyTaxRepo: _propertyTaxRepository,
    propertyTaxService: _propertyTaxService,
    protocolAuditRepo: _protocolAuditRepository,
    protocolBridgeRepo: _protocolBridgeRepository,
    protocolRecoveryService: _protocolRecoveryService,
    protocolRegistryRepo: _protocolRegistryRepository,
    pursuitRepo: _pursuitRepository,
    pursuitRuntimeService: _pursuitRuntimeService,
    radioChannelRepo: _radioChannelRepository,
    radioMembershipRepo: _radioMembershipRepository,
    radioRuntimeService: _radioRuntimeService,
    raidRepo: _raidRepository,
    raidRuntimeService: _raidRuntimeService,
    reconciliationRuntimeRepo: _reconciliationRuntimeRepository,
    recoveryOperationRepo: _recoveryOperationRepository,
    recoveryOrchestrationService: _recoveryOrchestrationService,
    recoveryRuntimeRepo: _recoveryRuntimeRepository,
    recoverySnapshotRepo: _recoverySnapshotRepository,
    regionRuntimeRepo: _regionRuntimeRepository,
    regionalConsistencyRepo: _regionalConsistencyRepository,
    regionalConsistencyService: _regionalConsistencyService,
    regionalSimulationRepo: _regionalSimulationRepository,
    regionalSimulationService: _regionalSimulationService,
    registrationRuntimeService: _registrationRuntimeService,
    reinforcementCoordinationService: _reinforcementCoordinationService,
    relationshipAuditRepo: _relationshipAuditRepository,
    releaseAuditRepo: _releaseAuditRepository,
    releaseGovernanceRepo: _releaseGovernanceRepository,
    releaseGovernanceService: _releaseGovernanceService,
    releaseOrchestrationRepo: _releaseOrchestrationRepository,
    releaseRecoveryService: _releaseRecoveryService,
    releaseValidationRepo: _releaseValidationRepository,
    rentalContractRepo: _rentalContractRepository,
    rentalContractService: _rentalContractService,
    replicationAuditRepo: _replicationAuditRepository,
    replicationRuntimeService: _replicationRuntimeService,
    reportRepo: _medicalReportRepository,
    reputationDecayRepo: _reputationDecayRepository,
    reputationDecayService: _reputationDecayService,
    reputationRepo: _reputationRuntimeRepository,
    reputationRuntimeService: _reputationRuntimeService,
    resilienceRepo: _runtimeResilienceRepository,
    resilienceService: _runtimeResilienceService,
    resourceBalancingRepo: _resourceBalancingRepository,
    resourceBalancingService: _resourceBalancingService,
    resourceConsumptionRepo: _resourceConsumptionRepository,
    resourceConsumptionService: _resourceConsumptionService,
    resourceNodeRepo: _resourceNodeRepository,
    resourceNodeService: _resourceNodeService,
    resourceRegenerationRepo: _resourceRegenerationRepository,
    resourceRegenerationService: _resourceRegenerationService,
    responderRepo: _responderAssignmentRepository,
    runtimeAllocationRepo: _runtimeAllocationRepository_cluster_runtime,
    runtimeAllocationService: _runtimeAllocationService,
    runtimeArchivalService: _runtimeArchivalService,
    runtimeBalancingService: _runtimeBalancingService,
    runtimeCertificationRepo: _runtimeCertificationRepository,
    runtimeCertificationService: _runtimeCertificationService,
    runtimeCheckpointCoordinator: _runtimeCheckpointCoordinator,
    runtimeCleanupRepo: _runtimeCleanupRepository,
    runtimeCompletionCoordinator: _runtimeCompletionCoordinator,
    runtimeCompletionRepo: _runtimeCompletionRepository,
    runtimeComplianceRepo: _runtimeComplianceRepository,
    runtimeConsensusRepo: _runtimeConsensusRepository,
    runtimeConsensusService: _runtimeConsensusService,
    runtimeConsistencyAuditRepo: _runtimeConsistencyAuditRepository,
    runtimeConsistencyRepo: _runtimeConsistencyRepository,
    runtimeConsistencyService: _runtimeConsistencyService,
    runtimeContractValidationService: _runtimeContractValidationService,
    runtimeCoordinationRepo: _runtimeCoordinationRepository,
    runtimeCoordinationService: _runtimeCoordinationService,
    runtimeDeploymentRepo: _runtimeDeploymentRepository,
    runtimeDiagnosticsRepo: _runtimeDiagnosticsRepository,
    runtimeDiagnosticsService: _runtimeDiagnosticsService,
    runtimeEvolutionRepo: _runtimeEvolutionRepository,
    runtimeExposureCoordinator: _runtimeExposureCoordinator,
    runtimeExposureRepo: _runtimeExposureRepository,
    runtimeFailoverRepo: _runtimeFailoverRepository,
    runtimeFreezeCoordinator: _runtimeFreezeCoordinator,
    runtimeGatewayRepo: _runtimeGatewayRepository,
    runtimeGatewayService: _runtimeGatewayService,
    runtimeHandshakeRepo: _runtimeHandshakeRepository,
    runtimeHandshakeService: _runtimeHandshakeService,
    runtimeHardeningRepo: _runtimeHardeningRepository,
    runtimeHardeningService: _runtimeHardeningService,
    runtimeImmutabilityRepo: _runtimeImmutabilityRepository,
    runtimeIntegrityCoordinator: _runtimeIntegrityCoordinator,
    runtimeIntegrityVerificationService: _runtimeIntegrityVerificationService,
    runtimeIntrusionDetectionService: _runtimeIntrusionDetectionService,
    runtimeIntrusionRepo: _runtimeIntrusionRepository,
    runtimeIsolationRepo: _runtimeIsolationRepository,
    runtimeIsolationService: _runtimeIsolationService,
    runtimeLockdownRepo: _runtimeLockdownRepository,
    runtimeLockdownService: _runtimeLockdownService,
    runtimeLongevityRepo: _runtimeLongevityRepository,
    runtimeLongevityService: _runtimeLongevityService,
    runtimeMetricsRepo: _runtimeMetricsRepository_runtime_observability,
    runtimeMetricsService: _runtimeMetricsService,
    runtimeMigrationRepo: _runtimeMigrationRepository,
    runtimeMigrationService: _runtimeMigrationService,
    runtimeProtocolRepo: _runtimeProtocolRepository,
    runtimeProtocolService: _runtimeProtocolService,
    runtimeRecoveryCoordinator: _runtimeRecoveryCoordinator,
    runtimeRecoveryRepo: _runtimeRecoveryRepository,
    runtimeRecoveryService: _runtimeRecoveryService,
    runtimeReleaseValidationService: _runtimeReleaseValidationService,
    runtimeReplicationService: _runtimeReplicationService,
    runtimeScalingService: _runtimeScalingService,
    runtimeSdkRegistryService: _runtimeSdkRegistryService,
    runtimeSealRepo: _runtimeSealRepository,
    runtimeSealService: _runtimeSealService,
    runtimeSealVerificationService: _runtimeSealVerificationService,
    runtimeSecurityRecoveryService: _runtimeSecurityRecoveryService,
    runtimeSnapshotRepo: _runtimeSnapshotRepository,
    runtimeSovereigntyRepo: _runtimeSovereigntyRepository,
    runtimeSovereigntyService: _runtimeSovereigntyService,
    runtimeStreamingService: _runtimeStreamingService,
    runtimeSuccessionRepo: _runtimeSuccessionRepository,
    runtimeSuccessionService: _runtimeSuccessionService,
    runtimeSurfaceProtectionService: _runtimeSurfaceProtectionService,
    runtimeSustainmentRepo: _runtimeSustainmentRepository,
    runtimeSustainmentService: _runtimeSustainmentService,
    runtimeTelemetryService: _runtimeTelemetryService,
    runtimeThreatRepo: _runtimeThreatRepository,
    runtimeTuningRepo: _runtimeTuningRepository,
    runtimeTuningService: _runtimeTuningService,
    runtimeVerificationService: _runtimeVerificationService,
    scenarioOrchestrationService: _scenarioOrchestrationService,
    scenarioRuntimeRepo: _scenarioRuntimeRepository,
    sceneRuntimeRepo: _sceneRuntimeRepository,
    sceneSynchronizationService: _sceneSynchronizationService,
    sdkRegistryRepo: _sdkRegistryRepository,
    sealValidationRepo: _sealValidationRepository,
    securityAuditRepo: _securityAuditRepository,
    securityEscalationRepo: _securityEscalationRepository,
    securityEscalationService: _securityEscalationService,
    securityValidationRepo: _securityValidationRepository,
    selfHealingRecoveryService: _selfHealingRecoveryService,
    shardRuntimeRepo: _shardRuntimeRepository,
    shipmentRepo: _shipmentRepository,
    shipmentService: _shipmentService,
    signalRuntimeRepo: _signalRuntimeRepository,
    signalRuntimeService: _signalRuntimeService,
    snapshotArchiveRepo: _snapshotArchiveRepository,
    snapshotCompressionRepo: _snapshotCompressionRepository,
    snapshotCompressionService: _snapshotCompressionService,
    snapshotRecoveryService: _snapshotRecoveryService,
    snapshotReplayRepo: _snapshotReplayRepository,
    snapshotReplayService: _snapshotReplayService,
    snapshotSyncService: _snapshotSynchronizationService,
    socialStandingRepo: _socialStandingRepository,
    socialStandingService: _socialStandingService,
    sovereigntyAuditRepo: _sovereigntyAuditRepository,
    sovereigntyCoordinationRepo: _sovereigntyCoordinationRepository,
    sovereigntyRecoveryService: _sovereigntyRecoveryService,
    spatialNodeRepo: _spatialNodeRepository,
    spatialOwnershipRepo: _spatialOwnershipRepository,
    spatialOwnershipService: _spatialOwnershipService,
    spatialPartitionService: _spatialPartitionService,
    storageContainerService: _storageContainerService,
    storyProgressionRepo: _storyProgressionRepository,
    storyProgressionService: _storyProgressionService,
    streamingRuntimeRepo: _streamingRuntimeRepository,
    supplyChainRepo: _supplyChainRepository,
    supplyChainService: _supplyChainService,
    supplyRouteRepo: _supplyRouteRepository,
    supplyRouteService: _supplyRouteService,
    suppressionRuntimeService: _suppressionRuntimeService,
    surfaceProtectionRepo: _surfaceProtectionRepository,
    survivalRuntimeRepo: _survivalRuntimeRepository,
    survivalRuntimeService: _survivalRuntimeService,
    sustainmentAuditRepo: _sustainmentAuditRepository,
    sustainmentRecoveryService: _sustainmentRecoveryService,
    tacticalDamageService: _tacticalDamageService,
    tacticalResponseService: _tacticalResponseService,
    taxRecordRepo: _taxRecordRepository,
    taxRuntimeRepo: _taxRuntimeRepository,
    taxationRuntimeService: _taxationRuntimeService,
    temperatureRuntimeRepo: _temperatureRuntimeRepository,
    temperatureRuntimeService: _temperatureRuntimeService,
    temporalIntegrityRecoveryService: _temporalIntegrityRecoveryService,
    temporalIntegrityRepo: _temporalIntegrityRepository,
    temporalRecoveryRepo: _temporalRecoveryRepository,
    temporalRecoveryService: _temporalRecoveryService,
    tenantHistoryRepo: _tenantHistoryRepository,
    territoryClaimRepo: _territoryClaimRepository,
    territoryControlService: _territoryControlService,
    territoryRepo: _territoryRepository,
    threatAssessmentService: _threatAssessmentService,
    threatContainmentRepo: _threatContainmentRepository,
    threatContainmentService: _threatContainmentService,
    threatMitigationRepo: _threatMitigationRepository,
    traceRecoveryService: _traceRecoveryService,
    traceRuntimeRepo: _traceRuntimeRepository,
    traceRuntimeStateRepo: _traceRuntimeStateRepository,
    trafficControlService: _trafficControlService,
    trafficSignalRepo: _trafficSignalRepository,
    trafficSignalService: _trafficSignalService,
    trafficViolationRepo: _trafficViolationRepository,
    transportAuditRepo: _transportAuditRepository,
    traumaRepo: _traumaRepository,
    treatmentRepo: _treatmentRepository,
    utilityGridRepo: _utilityGridRepository,
    utilityGridService: _utilityGridService,
    vehicleDamageRepo: _damageRuntimeRepository,
    vehicleMetricsRepo: _runtimeMetricsRepository_vehicle_simulation,
    vehicleRegistrationRepo: _registrationRepository,
    vehicleRepo: _vehicleRepository,
    vehicleRuntimeRepo: _vehicleRuntimeRepository,
    vehicleRuntimeService: _vehicleRuntimeService,
    vehicleSimService: _vehicleSimulationService,
    verificationRuntimeRepo: _verificationRuntimeRepository,
    vesselRepo: _vesselRepository,
    weaponRepo: _weaponRepository,
    weaponRuntimeRepo: _weaponRuntimeRepository,
    weaponStateService: _weaponStateService,
    wildlifeRuntimeRepo: _wildlifeRuntimeRepository,
    wildlifeSimulationService: _wildlifeSimulationService,
    workSessionRepo: _workSessionRepository,
    worldBalancingRepo: _worldBalancingRepository,
    worldEntityRepo: _worldEntityRepository,
    worldEventRepo: _worldEventRepository,
    worldEventService: _worldEventService,
    worldIntegrityRepo: _worldIntegrityRepository,
    worldIntegrityService: _worldIntegrityService,
    worldOrchestrationAuditRepo: _worldOrchestrationAuditRepository,
    worldOrchestratorService: _worldOrchestratorService,
    worldReconciliationRepo: _worldReconciliationRepository,
    worldRegionRepo: _worldRegionRepository,
    worldRuntimeAllocationRepo: _runtimeAllocationRepository_world_orchestrator,
    worldRuntimeService: _worldRuntimeService,
    zoneClaimService: _zoneClaimService,
  }
}
