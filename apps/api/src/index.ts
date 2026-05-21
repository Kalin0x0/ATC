import {
  createPool,
  testConnection,
  runMigrations,
  AccountRepository,
  SessionRepository,
  BanRepository,
  CharacterRepository,
  WalletRepository,
  ItemDefinitionRepository,
  InventoryRepository,
  VitalsRepository,
} from '@atc/db'
import {
  createRedisClient,
  connectRedis,
  SessionCache,
  VitalsCache,
  RateLimiter,
  StatusEffectCache,
} from '@atc/cache'
import { ItemRuntimeExecutor, ItemCooldownCache, createVitalsModifyHandler } from '@atc/runtime-items'
import { AtcEventBus, AtcRedisEventBridge } from '@atc/events'
import { AtcTelemetryService } from '@atc/telemetry'
import {
  AtcPluginRegistry,
  AtcPluginLifecycleManager,
  AtcPluginHealthMonitor,
  AtcPluginScopedEventBus,
} from '@atc/plugin-registry'
import { AtcPluginStateService } from '@atc/plugin-state'
import { createPluginServiceContainer } from '@atc/plugin-runtime-api'
import type {
  VitalsServiceLike,
  InventoryServiceLike,
  WalletServiceLike,
  StatusEffectsServiceLike,
} from '@atc/plugin-runtime-api'
import { AtcTaskRuntime, RedisTaskQueueStorage } from '@atc/task-runtime'
import { AtcEventStore, RedisEventStoreStorage } from '@atc/event-store'
import { AtcRuntimeNodeService } from '@atc/runtime-node'
import type { AtcStatusEffect, AtcWallet } from '@atc/shared-types'
import { config } from './config.js'
import { logger } from './logger.js'
import { buildServer } from './server.js'
import { registerVitalsThresholdEvaluator } from './status-effects/evaluator.js'

async function main() {
  logger.info({ nodeEnv: config.nodeEnv }, 'ATC API starting')

  const pool = createPool(config.db)
  try {
    await testConnection(pool)
    logger.info('DB connection OK')
  } catch (err) {
    logger.error({ err }, 'DB connection failed')
    process.exit(1)
  }

  const redis = createRedisClient({
    host: config.redis.host,
    port: config.redis.port,
    ...(config.redis.password !== undefined ? { password: config.redis.password } : {}),
    db: config.redis.db,
  })
  try {
    await connectRedis(redis)
    logger.info('Redis connection OK')
  } catch (err) {
    logger.error({ err }, 'Redis connection failed')
    process.exit(1)
  }

  try {
    await runMigrations(pool)
    logger.info('Migrations complete')
  } catch (err) {
    logger.error({ err }, 'Migration failed')
    process.exit(1)
  }

  const inventoryRepo = new InventoryRepository(pool)
  const itemDefinitionsRepo = new ItemDefinitionRepository(pool)
  const vitalsRepo = new VitalsRepository(pool)
  const walletsRepo = new WalletRepository(pool)
  const cooldownCache = new ItemCooldownCache(redis)
  const vitalsCache = new VitalsCache(redis)
  const statusEffectsCache = new StatusEffectCache(redis)
  const itemRuntime = new ItemRuntimeExecutor(inventoryRepo, itemDefinitionsRepo, cooldownCache)
  const telemetry = new AtcTelemetryService()
  const pluginRegistry = new AtcPluginRegistry()
  const pluginState = new AtcPluginStateService(redis)
  const eventBus = new AtcEventBus({ metricsEnabled: config.eventBus.metricsEnabled })
  const scopedEventBus = new AtcPluginScopedEventBus(eventBus)
  const pluginHealth = new AtcPluginHealthMonitor()
  const vitalsRateLimiter = new RateLimiter(redis, {
    prefix: 'atc:ratelimit:vitals:mutation',
    max: config.vitals.mutationRateLimit,
    windowSeconds: config.vitals.mutationRateWindowSeconds,
  })

  // Register built-in vitals.modify effect handler
  itemRuntime.getEffectRegistry().register('vitals.modify', createVitalsModifyHandler(vitalsRepo))

  // Register vitals threshold → status effect evaluator
  registerVitalsThresholdEvaluator(eventBus, statusEffectsCache, logger)

  // Service adapters: simplified interfaces satisfying plugin capability-gated APIs
  const vitalsAdapter: VitalsServiceLike = {
    get: async (characterId) => {
      try { return await vitalsRepo.getOrCreate(characterId) } catch { return undefined }
    },
    mutate: async (characterId, patch, _source, _actor) => vitalsRepo.patch(characterId, patch),
  }

  const inventoryAdapter: InventoryServiceLike = {
    getSlots: async (characterId) => {
      const resp = await inventoryRepo.getByCharacter(characterId)
      return resp.slots
    },
    addItem: async (characterId, itemId, quantity, metadata) => {
      await inventoryRepo.addItem({
        characterId,
        itemId,
        quantity,
        metadata: metadata ?? {},
        reason: 'plugin',
        source: 'api',
        idempotencyKey: `plugin-${characterId}-${itemId}-${Date.now()}`,
      })
    },
    removeItem: async (characterId, itemId, quantity) => {
      await inventoryRepo.removeItem({
        characterId,
        itemId,
        quantity,
        reason: 'plugin',
        source: 'api',
        idempotencyKey: `plugin-${characterId}-${itemId}-${Date.now()}`,
      })
    },
  }

  const walletAdapter: WalletServiceLike = {
    getWallet: async (characterId) => {
      const w = await walletsRepo.getBalance(characterId, 'ATC')
      return (w ?? undefined) as AtcWallet | undefined
    },
    credit: async (characterId, amount, reason, source) => {
      const result = await walletsRepo.credit({
        characterId,
        currency: 'ATC',
        account: 'cash',
        amount,
        reason,
        source: 'api',
        idempotencyKey: `plugin-${source}-${characterId}-${Date.now()}`,
      })
      return result as unknown as AtcWallet
    },
    debit: async (characterId, amount, reason, source) => {
      const result = await walletsRepo.debit({
        characterId,
        currency: 'ATC',
        account: 'cash',
        amount,
        reason,
        source: 'api',
        idempotencyKey: `plugin-${source}-${characterId}-${Date.now()}`,
      })
      return result as unknown as AtcWallet
    },
  }

  const statusEffectsAdapter: StatusEffectsServiceLike = {
    getEffects: (characterId) => statusEffectsCache.list(characterId),
    applyEffect: async (characterId, request) => {
      const effect: AtcStatusEffect = {
        id: `${characterId}-${request.type}-${Date.now()}`,
        characterId,
        type: request.type,
        severity: request.severity,
        source: request.source,
        reason: request.reason,
        startedAt: new Date().toISOString(),
        expiresAt: request.durationSeconds
          ? new Date(Date.now() + request.durationSeconds * 1000).toISOString()
          : null,
        ...(request.metadata !== undefined ? { metadata: request.metadata } : {}),
      }
      await statusEffectsCache.apply(characterId, effect)
    },
    clearEffect: (characterId, type) => statusEffectsCache.clear(characterId, type),
  }

  // Task runtime — Redis-backed distributed task queue
  const taskQueueStorage = new RedisTaskQueueStorage(redis)
  const taskRuntime = new AtcTaskRuntime({
    storage: taskQueueStorage,
    telemetry,
    eventBus,
    instanceId: config.nodeId,
  })
  taskRuntime.start()

  // Event store — Redis Streams-backed event persistence foundation
  const eventStoreStorage = new RedisEventStoreStorage(redis)
  const eventStore = new AtcEventStore(eventStoreStorage)

  // Runtime node service — registers this instance in the cluster registry
  const runtimeNode = new AtcRuntimeNodeService(redis, {
    instanceId: config.nodeId,
    capabilities: ['tasks', 'events', 'api'],
  })
  await runtimeNode.register()
  runtimeNode.startHeartbeat()

  const pluginLifecycle = new AtcPluginLifecycleManager(pluginRegistry, pluginHealth, eventBus, {
    pluginState,
    scopedEventBus,
    containerFactory: (pluginId, capabilities) =>
      createPluginServiceContainer({
        pluginId,
        capabilities,
        logger,
        registry: pluginRegistry,
        scopedEventBus,
        telemetry,
        vitalsService: vitalsAdapter,
        inventoryService: inventoryAdapter,
        walletService: walletAdapter,
        statusEffectsService: statusEffectsAdapter,
        taskRuntime,
      }),
  })

  // Optional Redis pub/sub bridge for cross-process event fanout
  let redisBridge: AtcRedisEventBridge | null = null
  if (config.eventBus.redisEnabled) {
    redisBridge = new AtcRedisEventBridge(redis, config.nodeId)
    eventBus.on('atc:vitals:changed', (payload) => {
      redisBridge!.publish('atc:vitals:changed', payload).catch(() => undefined)
    })
    eventBus.on('atc:status:changed', (payload) => {
      redisBridge!.publish('atc:status:changed', payload).catch(() => undefined)
    })
    logger.info('EventBus Redis bridge enabled')
  }

  const ctx = {
    pool,
    redis,
    accounts: new AccountRepository(pool),
    sessions: new SessionRepository(pool),
    bans: new BanRepository(pool),
    characters: new CharacterRepository(pool),
    wallets: walletsRepo,
    itemDefinitions: itemDefinitionsRepo,
    inventory: inventoryRepo,
    vitals: vitalsRepo,
    sessionCache: new SessionCache(redis),
    vitalsCache,
    itemRuntime,
    eventBus,
    vitalsRateLimiter,
    statusEffectsCache,
    telemetry,
    pluginRegistry,
    pluginState,
    pluginLifecycle,
    scopedEventBus,
    taskRuntime,
    eventStore,
    runtimeNode,
    logger,
  }

  const server = buildServer(ctx)

  try {
    await server.listen({ host: config.host, port: config.port })
    logger.info({ host: config.host, port: config.port }, 'ATC API listening')
  } catch (err) {
    logger.error({ err }, 'Failed to start server')
    process.exit(1)
  }

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down')
    taskRuntime.stop()
    runtimeNode.stopHeartbeat()
    await runtimeNode.deregister()
    await server.close()
    if (redisBridge) await redisBridge.close()
    await redis.quit()
    await pool.end()
    process.exit(0)
  }

  process.on('SIGTERM', () => { void shutdown('SIGTERM') })
  process.on('SIGINT', () => { void shutdown('SIGINT') })
}

main().catch((err: unknown) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
