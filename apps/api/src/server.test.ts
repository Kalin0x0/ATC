import { describe, it, expect, vi } from 'vitest'
import { buildServer } from './server.js'
import type { AppContext, PrincipalStore } from './context.js'
import type { AtcIamCache } from '@atc/iam'
import type { AtcRuntimeNodeService } from '@atc/runtime-node'
import type { AtcSchedulerLeaderElection } from '@atc/task-runtime'
import pino from 'pino'
import {
  InventoryItemNotFoundError,
  InventorySlotOccupiedError,
  InventoryInsufficientQuantityError,
  InventoryFullError,
  InventoryIdempotencyPayloadMismatchError,
  InventoryOverweightError,
  InventoryCapacityError,
  InventoryMetadataValidationError,
  InventorySettingsConflictError,
  ItemDefinitionDuplicateError,
  ItemDefinitionNotFoundError,
} from '@atc/db'
import {
  ItemNotUsableError,
  ItemCooldownActiveError,
  ItemInsufficientDurabilityError,
} from '@atc/runtime-items'

const CHAR_ID    = '01HZ9XVFG3QKJM5N8P2R4T6WYZ'
const ACCOUNT_ID = '01HZ9XVFG3QKJM5N8P2R4T6WXZ'
const SESSION_ID = '01HZ9XVFG3QKJM5N8P2R4T6WX1'

const silentLogger = pino({ level: 'silent' })

function makeMockCtx(overrides: Partial<AppContext> = {}): AppContext {
  const mockPool = {
    getConnection: vi.fn().mockResolvedValue({
      ping: vi.fn().mockResolvedValue(undefined),
      release: vi.fn(),
    }),
  } as unknown as AppContext['pool']

  const mockRedis = {
    ping: vi.fn().mockResolvedValue('PONG'),
  } as unknown as AppContext['redis']

  const mockAccounts = {
    upsert: vi.fn(),
    findByIdentifier: vi.fn(),
    getStatus: vi.fn().mockResolvedValue('active'),
    getStatusById: vi.fn().mockResolvedValue('active'),
  } as unknown as AppContext['accounts']

  const mockSessions = {
    create: vi.fn(),
    endBySource: vi.fn().mockResolvedValue(false),
    findBySource: vi.fn(),
    findById: vi.fn().mockResolvedValue(null),
    attachCharacter: vi.fn().mockResolvedValue(true),
    activate: vi.fn().mockResolvedValue(undefined),
  } as unknown as AppContext['sessions']

  const mockBans = {
    findActiveByAccountId: vi.fn().mockResolvedValue(null),
    hasActiveBan: vi.fn().mockResolvedValue(false),
  } as unknown as AppContext['bans']

  const mockSessionCache = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockResolvedValue(undefined),
    exists: vi.fn().mockResolvedValue(false),
  } as unknown as AppContext['sessionCache']

  const mockCharacters = {
    create: vi.fn(),
    listByAccount: vi.fn().mockResolvedValue([]),
    // Default: return an active character so wallet route guards pass in happy-path tests.
    // Override with .mockResolvedValue(null) in tests that exercise the 404 path.
    findById: vi.fn().mockResolvedValue({
      id: CHAR_ID,
      accountId: ACCOUNT_ID,
      slot: 1,
      firstName: 'Test',
      lastName: 'Char',
      gender: 'male',
      dateOfBirth: null,
      nationality: null,
      metadata: {},
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    findOwnedByAccount: vi.fn().mockResolvedValue(null),
    countByAccount: vi.fn().mockResolvedValue(0),
    softDelete: vi.fn().mockResolvedValue(false),
    updateStatus: vi.fn().mockResolvedValue(false),
  } as unknown as AppContext['characters']

  const mockWallets = {
    getOrCreate: vi.fn().mockResolvedValue({
      id: '01WALLETID000000000000000W1',
      characterId: CHAR_ID,
      currency: 'ATC',
      cashBalance: 1000,
      bankBalance: 5000,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    getBalance: vi.fn().mockResolvedValue(null),
    credit: vi.fn(),
    debit: vi.fn(),
    transfer: vi.fn(),
    listTransactions: vi.fn().mockResolvedValue({ transactions: [], total: 0 }),
  } as unknown as AppContext['wallets']

  const mockItemDefinitions = {
    upsert:        vi.fn(),
    findById:      vi.fn().mockResolvedValue(null),
    listActive:    vi.fn().mockResolvedValue([]),
    disable:       vi.fn().mockResolvedValue(undefined),
    create:        vi.fn(),
    update:        vi.fn(),
    bulkUpsert:    vi.fn(),
    listCatalog:   vi.fn().mockResolvedValue([]),
    getUsageCount: vi.fn().mockResolvedValue(0),
    safeDisable:   vi.fn(),
    safeDeprecate: vi.fn(),
  } as unknown as AppContext['itemDefinitions']

  const defaultSettings = { characterId: CHAR_ID, maxSlots: 60, maxWeightGrams: 30_000, createdAt: new Date(), updatedAt: new Date() }
  const mockInventory = {
    getByCharacter: vi.fn().mockResolvedValue({
      characterId: CHAR_ID,
      slots: [],
      settings: defaultSettings,
      weightSummary: { totalWeightGrams: 0, maxWeightGrams: 30_000, isOverweight: false, remainingWeightGrams: 30_000 },
      capacitySummary: { usedSlots: 0, maxSlots: 60, freeSlots: 60, isFull: false },
    }),
    getSlot: vi.fn().mockResolvedValue(null),
    addItem: vi.fn(),
    removeItem: vi.fn(),
    moveItem: vi.fn(),
    calculateWeight: vi.fn(),
    listTransactions: vi.fn().mockResolvedValue([]),
    getOrCreateSettings: vi.fn().mockResolvedValue(defaultSettings),
    updateSettings: vi.fn().mockResolvedValue(defaultSettings),
  } as unknown as AppContext['inventory']

  const mockVitals = {
    getOrCreate: vi.fn().mockResolvedValue({
      characterId: CHAR_ID,
      health: 100, hunger: 100, thirst: 100, stamina: 100, stress: 0, armor: 0,
      createdAt: new Date(), updatedAt: new Date(),
    }),
    patch: vi.fn().mockResolvedValue({
      characterId: CHAR_ID,
      health: 75, hunger: 100, thirst: 100, stamina: 100, stress: 0, armor: 0,
      createdAt: new Date(), updatedAt: new Date(),
    }),
    mutate: vi.fn().mockResolvedValue({
      characterId: CHAR_ID,
      health: 100, hunger: 75, thirst: 100, stamina: 100, stress: 0, armor: 0,
      createdAt: new Date(), updatedAt: new Date(),
    }),
    reset: vi.fn().mockResolvedValue({
      characterId: CHAR_ID,
      health: 100, hunger: 100, thirst: 100, stamina: 100, stress: 0, armor: 0,
      createdAt: new Date(), updatedAt: new Date(),
    }),
  } as unknown as AppContext['vitals']

  const mockVitalsCache = {
    get:     vi.fn().mockResolvedValue(null),
    set:     vi.fn().mockResolvedValue(undefined),
    del:     vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockResolvedValue(undefined),
  } as unknown as AppContext['vitalsCache']

  const mockStatusEffectsCache = {
    list:        vi.fn().mockResolvedValue([]),
    apply:       vi.fn().mockResolvedValue(undefined),
    clear:       vi.fn().mockResolvedValue(undefined),
    clearAll:    vi.fn().mockResolvedValue(undefined),
    pruneExpired: vi.fn().mockResolvedValue(0),
  } as unknown as AppContext['statusEffectsCache']

  return {
    pool: mockPool,
    redis: mockRedis,
    accounts: mockAccounts,
    sessions: mockSessions,
    bans: mockBans,
    characters: mockCharacters,
    wallets: mockWallets,
    itemDefinitions: mockItemDefinitions,
    inventory: mockInventory,
    vitals: mockVitals,
    sessionCache: mockSessionCache,
    vitalsCache: mockVitalsCache,
    statusEffectsCache: mockStatusEffectsCache,
    itemRuntime: {
      useItem: vi.fn().mockResolvedValue({
        success: true,
        itemId: 'water_bottle',
        slot: 5,
        consumed: 1,
        remainingQuantity: 2,
        durability: null,
        cooldownExpiresAt: null,
        effects: [],
        idempotent: false,
      }),
    } as unknown as AppContext['itemRuntime'],
    eventBus: {
      emit:  vi.fn().mockResolvedValue({ name: '', handlersInvoked: 0, failures: [] }),
      on:    vi.fn(),
      off:   vi.fn(),
      once:  vi.fn(),
      listenerCount: vi.fn().mockReturnValue(0),
      eventNames:    vi.fn().mockReturnValue([]),
      getMetrics:    vi.fn().mockReturnValue({ emittedTotal: 0, handledTotal: 0, failedTotal: 0, avgDurationMs: 0, activeSubscribers: 0, metricsEnabled: true }),
    } as unknown as AppContext['eventBus'],
    vitalsRateLimiter: {
      check: vi.fn().mockResolvedValue({ allowed: true }),
      reset: vi.fn().mockResolvedValue(undefined),
    } as unknown as AppContext['vitalsRateLimiter'],
    telemetry: {
      counter: vi.fn(),
      increment: vi.fn(),
      gauge: vi.fn(),
      observe: vi.fn(),
      histogram: vi.fn(),
      snapshot: vi.fn().mockReturnValue({ metrics: [], capturedAt: new Date().toISOString() }),
      get: vi.fn().mockReturnValue(undefined),
      reset: vi.fn(),
      clear: vi.fn(),
    } as unknown as AppContext['telemetry'],
    pluginRegistry: {
      getAll: vi.fn().mockReturnValue([]),
      get: vi.fn().mockReturnValue(undefined),
      getEventsHandled: vi.fn().mockReturnValue(0),
      getAvgExecutionMs: vi.fn().mockReturnValue(0),
      getApiCalls: vi.fn().mockReturnValue(0),
      getDeniedCalls: vi.fn().mockReturnValue(0),
      getUptimeMs: vi.fn().mockReturnValue(0),
    } as unknown as AppContext['pluginRegistry'],
    pluginState: {
      load: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
      loadAll: vi.fn().mockResolvedValue(new Map()),
      clear: vi.fn().mockResolvedValue(undefined),
      clearAll: vi.fn().mockResolvedValue(undefined),
    } as unknown as AppContext['pluginState'],
    pluginLifecycle: {
      getContainer: vi.fn().mockReturnValue(undefined),
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      reload: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn().mockResolvedValue(undefined),
      registerHooks: vi.fn(),
      isInflight: vi.fn().mockReturnValue(false),
    } as unknown as AppContext['pluginLifecycle'],
    scopedEventBus: {
      getAllSubscriptionCounts: vi.fn().mockReturnValue({}),
      getSubscriptionCount: vi.fn().mockReturnValue(0),
      subscribe: vi.fn(),
      subscribeOnce: vi.fn(),
      unsubscribe: vi.fn(),
      publish: vi.fn().mockResolvedValue(undefined),
      cleanup: vi.fn().mockReturnValue(0),
    } as unknown as AppContext['scopedEventBus'],
    taskRuntime: {
      start: vi.fn(),
      stop: vi.fn(),
      isRunning: false,
      enqueue: vi.fn().mockResolvedValue('task-id'),
      schedule: vi.fn().mockResolvedValue('task-id'),
      cancel: vi.fn().mockReturnValue(false),
      getMetrics: vi.fn().mockReturnValue({ queuedTotal: 0, completedTotal: 0, failedTotal: 0, retriedTotal: 0, activeWorkers: 0, avgRuntimeMs: 0, queues: [] }),
      getQueueMetrics: vi.fn().mockResolvedValue({ queuedTotal: 0, completedTotal: 0, failedTotal: 0, retriedTotal: 0, activeWorkers: 0, avgRuntimeMs: 0, queues: [] }),
      getWorkerMetrics: vi.fn().mockReturnValue([]),
      registerWorker: vi.fn().mockReturnValue('worker-id'),
      listDeadLetter: vi.fn().mockResolvedValue({ items: [], total: 0, offset: 0, limit: 20 }),
      requeueDeadLetterTask: vi.fn().mockResolvedValue(false),
    } as unknown as AppContext['taskRuntime'],
    eventStore: {
      append: vi.fn().mockResolvedValue({ id: '', streamId: '', eventName: '', payload: null, source: '', storedAt: '' }),
      replay: vi.fn().mockResolvedValue([]),
      snapshot: vi.fn().mockResolvedValue([]),
      prune: vi.fn().mockResolvedValue(undefined),
      getStreamLength: vi.fn().mockResolvedValue(0),
      getAllStreamNames: vi.fn().mockReturnValue([]),
      listEvents: vi.fn().mockResolvedValue({ events: [], nextCursor: null }),
      getEvent: vi.fn().mockResolvedValue(null),
    } as unknown as AppContext['eventStore'],
    logger: silentLogger,
    ...overrides,
  }
}

describe('Auth middleware', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({ method: 'GET', url: '/api/v1/accounts/check/license:abc' })
    expect(res.statusCode).toBe(401)
    expect(JSON.parse(res.body)).toEqual({ error: 'Unauthorized' })
  })

  it('returns 401 when token is wrong', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/accounts/check/license:abc',
      headers: { Authorization: 'Bearer wrong-token' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 401 for Bearer with no token value', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/accounts/check/license:abc',
      headers: { Authorization: 'Bearer ' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('passes through with correct token', async () => {
    const ctx = makeMockCtx()
    ;(ctx.accounts.findByIdentifier as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/accounts/check/license:abc',
      headers: { Authorization: 'Bearer test-secret-token' },
    })
    expect(res.statusCode).not.toBe(401)
  })
})

describe('GET /health (public)', () => {
  it('returns 200 without auth', async () => {
    const ctx = makeMockCtx()
    const conn = { ping: vi.fn().mockResolvedValue(undefined), release: vi.fn() }
    ;(ctx.pool.getConnection as ReturnType<typeof vi.fn>).mockResolvedValue(conn)
    ;(ctx.redis.ping as ReturnType<typeof vi.fn>).mockResolvedValue('PONG')
    const server = buildServer(ctx)
    const res = await server.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { status: string }
    expect(body.status).toBe('ok')
  })

  it('returns 200 with query string (public — no auth bypass required)', async () => {
    const ctx = makeMockCtx()
    const conn = { ping: vi.fn().mockResolvedValue(undefined), release: vi.fn() }
    ;(ctx.pool.getConnection as ReturnType<typeof vi.fn>).mockResolvedValue(conn)
    ;(ctx.redis.ping as ReturnType<typeof vi.fn>).mockResolvedValue('PONG')
    const server = buildServer(ctx)
    const res = await server.inject({ method: 'GET', url: '/health?format=json' })
    // Should be public (no auth required)
    expect(res.statusCode).not.toBe(401)
  })

  it('returns 503 degraded when DB is down', async () => {
    const ctx = makeMockCtx()
    ;(ctx.pool.getConnection as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ECONNREFUSED'))
    ;(ctx.redis.ping as ReturnType<typeof vi.fn>).mockResolvedValue('PONG')
    const server = buildServer(ctx)
    const res = await server.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(503)
    const body = JSON.parse(res.body) as { status: string; components: { db: string } }
    expect(body.status).toBe('degraded')
    expect(body.components.db).toBe('error')
  })
})

describe('404 handler', () => {
  it('returns 404 for unknown routes', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/unknown',
      headers: { Authorization: 'Bearer test-secret-token' },
    })
    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body)).toEqual({ error: 'Not found' })
  })

  it('returns 404 for non-existent POST route', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({
      method: 'POST',
      url: '/api/v2/accounts',
      headers: { Authorization: 'Bearer test-secret-token' },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('Invalid JSON body', () => {
  it('returns 400 for malformed JSON body', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/accounts',
      headers: {
        Authorization: 'Bearer test-secret-token',
        'Content-Type': 'application/json',
      },
      body: '{ this is not valid json }',
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /api/v1/accounts', () => {
  it('returns 400 for missing primaryIdentifier', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/accounts',
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifiers: { license: 'abc' }, preferredLanguage: 'en' }),
    })
    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.body) as { error: string }
    expect(body.error).toBe('Validation failed')
  })

  it('returns 400 for unsupported language', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/accounts',
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        primaryIdentifier: 'license:abc',
        identifiers: { license: 'abc' },
        preferredLanguage: 'zh',
      }),
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 201 for new account', async () => {
    const ctx = makeMockCtx()
    ;(ctx.accounts.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: '01HZ9XVFG3QKJM5N8P2R4T6WYZ',
      created: true,
      status: 'active',
    })
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/accounts',
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        primaryIdentifier: 'license:abc123',
        identifiers: { license: 'abc123' },
        preferredLanguage: 'en',
      }),
    })
    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body) as { accountId: string; status: string; created: boolean }
    expect(body.accountId).toBe('01HZ9XVFG3QKJM5N8P2R4T6WYZ')
    expect(body.created).toBe(true)
    expect(body.status).toBe('active')
  })

  it('returns 200 and banned status for banned account', async () => {
    const ctx = makeMockCtx()
    ;(ctx.accounts.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: '01HZ9XVFG3QKJM5N8P2R4T6WYZ',
      created: false,
      status: 'active',
    })
    ;(ctx.bans.hasActiveBan as ReturnType<typeof vi.fn>).mockResolvedValue(true)
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/accounts',
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        primaryIdentifier: 'license:abc123',
        identifiers: { license: 'abc123' },
        preferredLanguage: 'en',
      }),
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { status: string }
    expect(body.status).toBe('banned')
  })
})

describe('DELETE /api/v1/sessions/:source — idempotent disconnect', () => {
  it('returns 204 when no session exists (idempotent)', async () => {
    const ctx = makeMockCtx()
    ;(ctx.sessions.endBySource as ReturnType<typeof vi.fn>).mockResolvedValue(false)
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'DELETE',
      url: '/api/v1/sessions/42',
      headers: { Authorization: 'Bearer test-secret-token' },
    })
    expect(res.statusCode).toBe(204)
  })

  it('returns 204 when session exists and is ended', async () => {
    const ctx = makeMockCtx()
    ;(ctx.sessions.endBySource as ReturnType<typeof vi.fn>).mockResolvedValue(true)
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'DELETE',
      url: '/api/v1/sessions/42',
      headers: { Authorization: 'Bearer test-secret-token' },
    })
    expect(res.statusCode).toBe(204)
  })

  it('returns 204 even when Redis delete fails (best-effort)', async () => {
    const ctx = makeMockCtx()
    ;(ctx.sessions.endBySource as ReturnType<typeof vi.fn>).mockResolvedValue(true)
    ;(ctx.sessionCache.del as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Redis down'))
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'DELETE',
      url: '/api/v1/sessions/42',
      headers: { Authorization: 'Bearer test-secret-token' },
    })
    expect(res.statusCode).toBe(204)
  })
})

describe('POST /api/v1/sessions', () => {
  it('returns 201 and clears prior session if one existed', async () => {
    const ctx = makeMockCtx()
    ;(ctx.sessions.endBySource as ReturnType<typeof vi.fn>).mockResolvedValue(true)
    ;(ctx.sessions.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: '01HZ9XVFG3QKJM5N8P2R4T6WYZ',
      accountId: '01HZ9XVFG3QKJM5N8P2R4T6WXZ',
      source: 1,
      name: 'Player',
      primaryIdentifier: 'license:abc',
      language: 'en',
      state: 'connecting',
      connectedAt: new Date(),
      disconnectedAt: null,
    })
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/sessions',
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: '01HZ9XVFG3QKJM5N8P2R4T6WXZ',
        source: 1,
        name: 'Player',
        primaryIdentifier: 'license:abc',
        language: 'en',
      }),
    })
    expect(res.statusCode).toBe(201)
    // endBySource must have been called to clear previous session
    expect(ctx.sessions.endBySource).toHaveBeenCalledWith(1)
  })

  it('returns 201 even when Redis cache write fails', async () => {
    const ctx = makeMockCtx()
    ;(ctx.sessions.endBySource as ReturnType<typeof vi.fn>).mockResolvedValue(false)
    ;(ctx.sessions.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: '01HZ9XVFG3QKJM5N8P2R4T6WYZ',
      accountId: '01HZ9XVFG3QKJM5N8P2R4T6WXZ',
      source: 2,
      name: 'Player2',
      primaryIdentifier: 'license:xyz',
      language: 'de',
      state: 'connecting',
      connectedAt: new Date(),
      disconnectedAt: null,
    })
    ;(ctx.sessionCache.set as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Redis down'))
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/sessions',
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: '01HZ9XVFG3QKJM5N8P2R4T6WXZ',
        source: 2,
        name: 'Player2',
        primaryIdentifier: 'license:xyz',
        language: 'de',
      }),
    })
    // Redis failure must not fail the session creation
    expect(res.statusCode).toBe(201)
  })
})

describe('GET /api/v1/sessions/source/:source', () => {
  it('filters out stale ended sessions from cache', async () => {
    const ctx = makeMockCtx()
    ;(ctx.sessionCache.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      sessionId: '01HZ9XVFG3QKJM5N8P2R4T6WYZ',
      accountId: '01HZ9XVFG3QKJM5N8P2R4T6WXZ',
      source: 5,
      language: 'en',
      state: 'ended', // stale!
      characterId: null,
    })
    ;(ctx.sessions.findBySource as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/sessions/source/5',
      headers: { Authorization: 'Bearer test-secret-token' },
    })
    expect(res.statusCode).toBe(404)
  })
})

// ── Character routes ──────────────────────────────────────────────────────────

describe('POST /api/v1/characters', () => {
  const validBody = {
    accountId: ACCOUNT_ID,
    slot: 1,
    firstName: 'John',
    lastName: 'Doe',
    gender: 'male',
  }

  it('returns 201 for a valid character create', async () => {
    const ctx = makeMockCtx()
    ;(ctx.characters.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: CHAR_ID,
      accountId: ACCOUNT_ID,
      slot: 1,
      firstName: 'John',
      lastName: 'Doe',
      gender: 'male',
      dateOfBirth: null,
      nationality: null,
      metadata: {},
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/characters',
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body) as { characterId: string; created: boolean }
    expect(body.characterId).toBe(CHAR_ID)
    expect(body.created).toBe(true)
  })

  it('returns 400 for invalid firstName', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/characters',
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validBody, firstName: 'J0hn123' }),
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 422 when character limit is reached', async () => {
    const ctx = makeMockCtx()
    const { CharacterLimitError } = await import('@atc/db')
    ;(ctx.characters.create as ReturnType<typeof vi.fn>).mockRejectedValue(
      new CharacterLimitError('limit reached')
    )
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/characters',
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    expect(res.statusCode).toBe(422)
  })

  it('returns 409 when slot is already taken', async () => {
    const ctx = makeMockCtx()
    const { CharacterSlotTakenError } = await import('@atc/db')
    ;(ctx.characters.create as ReturnType<typeof vi.fn>).mockRejectedValue(
      new CharacterSlotTakenError('slot taken')
    )
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/characters',
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    expect(res.statusCode).toBe(409)
  })
})

describe('GET /api/v1/characters/account/:accountId', () => {
  it('returns 200 with list of active characters', async () => {
    const ctx = makeMockCtx()
    ;(ctx.characters.listByAccount as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: CHAR_ID,
        accountId: ACCOUNT_ID,
        slot: 1,
        firstName: 'John',
        lastName: 'Doe',
        gender: 'male',
        dateOfBirth: null,
        nationality: null,
        metadata: {},
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/characters/account/${ACCOUNT_ID}`,
      headers: { Authorization: 'Bearer test-secret-token' },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { characters: unknown[] }
    expect(body.characters).toHaveLength(1)
  })

  it('returns 200 with empty array when no characters exist', async () => {
    const ctx = makeMockCtx()
    ;(ctx.characters.listByAccount as ReturnType<typeof vi.fn>).mockResolvedValue([])
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/characters/account/${ACCOUNT_ID}`,
      headers: { Authorization: 'Bearer test-secret-token' },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { characters: unknown[] }
    expect(body.characters).toHaveLength(0)
  })
})

describe('GET /api/v1/characters/:characterId', () => {
  it('returns 200 for an existing character', async () => {
    const ctx = makeMockCtx()
    ;(ctx.characters.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: CHAR_ID,
      accountId: ACCOUNT_ID,
      slot: 1,
      firstName: 'John',
      lastName: 'Doe',
      gender: 'male',
      dateOfBirth: null,
      nationality: null,
      metadata: {},
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/characters/${CHAR_ID}`,
      headers: { Authorization: 'Bearer test-secret-token' },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { characterId: string }
    expect(body.characterId).toBe(CHAR_ID)
  })

  it('returns 404 when character does not exist', async () => {
    const ctx = makeMockCtx()
    ;(ctx.characters.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/characters/${CHAR_ID}`,
      headers: { Authorization: 'Bearer test-secret-token' },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('PATCH /api/v1/sessions/:sessionId/character', () => {
  const activeSession = {
    id: SESSION_ID,
    accountId: ACCOUNT_ID,
    characterId: null,
    source: 7,
    name: 'Player',
    primaryIdentifier: 'license:abc',
    language: 'en' as const,
    state: 'active' as const,
    connectedAt: new Date(),
    disconnectedAt: null,
  }

  const activeCharacter = {
    id: CHAR_ID,
    accountId: ACCOUNT_ID,
    slot: 1,
    firstName: 'John',
    lastName: 'Doe',
    gender: 'male' as const,
    dateOfBirth: null,
    nationality: null,
    metadata: {},
    status: 'active' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  it('returns 200 when character is selected successfully', async () => {
    const ctx = makeMockCtx()
    ;(ctx.sessions.findById as ReturnType<typeof vi.fn>).mockResolvedValue(activeSession)
    ;(ctx.characters.findOwnedByAccount as ReturnType<typeof vi.fn>).mockResolvedValue(activeCharacter)
    ;(ctx.sessions.attachCharacter as ReturnType<typeof vi.fn>).mockResolvedValue(true)
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'PATCH',
      url: `/api/v1/sessions/${SESSION_ID}/character`,
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId: CHAR_ID }),
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { characterId: string; sessionId: string }
    expect(body.characterId).toBe(CHAR_ID)
    expect(body.sessionId).toBe(SESSION_ID)
  })

  it('returns 404 when session does not exist', async () => {
    const ctx = makeMockCtx()
    ;(ctx.sessions.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'PATCH',
      url: `/api/v1/sessions/${SESSION_ID}/character`,
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId: CHAR_ID }),
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 409 when session has ended', async () => {
    const ctx = makeMockCtx()
    ;(ctx.sessions.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...activeSession,
      state: 'ended',
    })
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'PATCH',
      url: `/api/v1/sessions/${SESSION_ID}/character`,
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId: CHAR_ID }),
    })
    expect(res.statusCode).toBe(409)
  })

  it('returns 403 when character is not owned by this account', async () => {
    const ctx = makeMockCtx()
    ;(ctx.sessions.findById as ReturnType<typeof vi.fn>).mockResolvedValue(activeSession)
    ;(ctx.characters.findOwnedByAccount as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'PATCH',
      url: `/api/v1/sessions/${SESSION_ID}/character`,
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId: CHAR_ID }),
    })
    expect(res.statusCode).toBe(403)
  })

  it('returns 422 when character is not active (deleted)', async () => {
    const ctx = makeMockCtx()
    ;(ctx.sessions.findById as ReturnType<typeof vi.fn>).mockResolvedValue(activeSession)
    ;(ctx.characters.findOwnedByAccount as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...activeCharacter,
      status: 'deleted',
    })
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'PATCH',
      url: `/api/v1/sessions/${SESSION_ID}/character`,
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId: CHAR_ID }),
    })
    expect(res.statusCode).toBe(422)
  })

  it('updates Redis cache with characterId on success', async () => {
    const ctx = makeMockCtx()
    ;(ctx.sessions.findById as ReturnType<typeof vi.fn>).mockResolvedValue(activeSession)
    ;(ctx.characters.findOwnedByAccount as ReturnType<typeof vi.fn>).mockResolvedValue(activeCharacter)
    ;(ctx.sessions.attachCharacter as ReturnType<typeof vi.fn>).mockResolvedValue(true)
    ;(ctx.sessionCache.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      sessionId: SESSION_ID,
      accountId: ACCOUNT_ID,
      source: 7,
      language: 'en',
      state: 'active',
      characterId: null,
    })
    const server = buildServer(ctx)
    await server.inject({
      method: 'PATCH',
      url: `/api/v1/sessions/${SESSION_ID}/character`,
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId: CHAR_ID }),
    })
    expect(ctx.sessionCache.set).toHaveBeenCalledWith(
      expect.objectContaining({ characterId: CHAR_ID })
    )
  })

  it('returns 200 even when Redis cache update fails (best-effort)', async () => {
    const ctx = makeMockCtx()
    ;(ctx.sessions.findById as ReturnType<typeof vi.fn>).mockResolvedValue(activeSession)
    ;(ctx.characters.findOwnedByAccount as ReturnType<typeof vi.fn>).mockResolvedValue(activeCharacter)
    ;(ctx.sessions.attachCharacter as ReturnType<typeof vi.fn>).mockResolvedValue(true)
    ;(ctx.sessionCache.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      sessionId: SESSION_ID,
      accountId: ACCOUNT_ID,
      source: 7,
      language: 'en',
      state: 'active',
      characterId: null,
    })
    ;(ctx.sessionCache.set as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Redis down'))
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'PATCH',
      url: `/api/v1/sessions/${SESSION_ID}/character`,
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId: CHAR_ID }),
    })
    expect(res.statusCode).toBe(200)
  })

  it('returns 409 when session ends concurrently (attachCharacter returns false)', async () => {
    const ctx = makeMockCtx()
    ;(ctx.sessions.findById as ReturnType<typeof vi.fn>).mockResolvedValue(activeSession)
    ;(ctx.characters.findOwnedByAccount as ReturnType<typeof vi.fn>).mockResolvedValue(activeCharacter)
    ;(ctx.sessions.attachCharacter as ReturnType<typeof vi.fn>).mockResolvedValue(false)
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'PATCH',
      url: `/api/v1/sessions/${SESSION_ID}/character`,
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId: CHAR_ID }),
    })
    expect(res.statusCode).toBe(409)
  })
})

describe('POST /api/v1/characters — account status hardening', () => {
  const validBody = {
    accountId: ACCOUNT_ID,
    slot: 2,
    firstName: 'Jane',
    lastName: 'Smith',
    gender: 'female',
  }

  it('returns 403 when account is banned', async () => {
    const ctx = makeMockCtx()
    ;(ctx.accounts.getStatusById as ReturnType<typeof vi.fn>).mockResolvedValue('banned')
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/characters',
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    expect(res.statusCode).toBe(403)
    expect(ctx.characters.create).not.toHaveBeenCalled()
  })

  it('returns 403 when account is suspended', async () => {
    const ctx = makeMockCtx()
    ;(ctx.accounts.getStatusById as ReturnType<typeof vi.fn>).mockResolvedValue('suspended')
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/characters',
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    expect(res.statusCode).toBe(403)
    expect(ctx.characters.create).not.toHaveBeenCalled()
  })

  it('returns 404 when account does not exist', async () => {
    const ctx = makeMockCtx()
    ;(ctx.accounts.getStatusById as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/characters',
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    expect(res.statusCode).toBe(404)
    expect(ctx.characters.create).not.toHaveBeenCalled()
  })

  it('returns 400 for all-whitespace firstName', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/characters',
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validBody, firstName: '   ' }),
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for metadata exceeding 20 keys', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const bigMetadata = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`key${i}`, i]))
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/characters',
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validBody, metadata: bigMetadata }),
    })
    expect(res.statusCode).toBe(400)
  })
})

// ── Wallet routes ─────────────────────────────────────────────────────────────

const WALLET_ID = '01WALLETID000000000000000W1'

const validCreditBody = {
  account: 'cash',
  amount: 500,
  currency: 'ATC',
  reason: 'test credit',
  source: 'system',
  idempotencyKey: 'test-idem-key-001',
}

const mockMutationResult = {
  transactionId: '01TX0000000000000000000TX1',
  walletId: WALLET_ID,
  characterId: CHAR_ID,
  currency: 'ATC',
  cashBalance: 1500,
  bankBalance: 5000,
  amount: 500,
  type: 'credit',
  account: 'cash',
  idempotent: false,
}

describe('GET /api/v1/wallets/character/:characterId', () => {
  it('returns 200 with wallet balance', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/wallets/character/${CHAR_ID}`,
      headers: { Authorization: 'Bearer test-secret-token' },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { cashBalance: number; bankBalance: number; currency: string }
    expect(body.cashBalance).toBe(1000)
    expect(body.bankBalance).toBe(5000)
    expect(body.currency).toBe('ATC')
  })

  it('returns 200 with specified currency', async () => {
    const ctx = makeMockCtx()
    ;(ctx.wallets.getOrCreate as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: WALLET_ID,
      characterId: CHAR_ID,
      currency: 'USD',
      cashBalance: 0,
      bankBalance: 0,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/wallets/character/${CHAR_ID}?currency=USD`,
      headers: { Authorization: 'Bearer test-secret-token' },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { currency: string }
    expect(body.currency).toBe('USD')
  })

  it('returns 400 for invalid characterId', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/wallets/character/not-a-valid-id',
      headers: { Authorization: 'Bearer test-secret-token' },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /api/v1/wallets/character/:characterId/credit', () => {
  it('returns 201 for a valid credit', async () => {
    const ctx = makeMockCtx()
    ;(ctx.wallets.credit as ReturnType<typeof vi.fn>).mockResolvedValue(mockMutationResult)
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/wallets/character/${CHAR_ID}/credit`,
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify(validCreditBody),
    })
    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body) as { cashBalance: number; idempotent: boolean }
    expect(body.cashBalance).toBe(1500)
    expect(body.idempotent).toBe(false)
  })

  it('returns 200 for an idempotent credit replay', async () => {
    const ctx = makeMockCtx()
    ;(ctx.wallets.credit as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockMutationResult,
      idempotent: true,
    })
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/wallets/character/${CHAR_ID}/credit`,
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify(validCreditBody),
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { idempotent: boolean }
    expect(body.idempotent).toBe(true)
  })

  it('returns 400 for non-integer amount', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/wallets/character/${CHAR_ID}/credit`,
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validCreditBody, amount: 1.5 }),
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for zero amount', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/wallets/character/${CHAR_ID}/credit`,
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validCreditBody, amount: 0 }),
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for negative amount', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/wallets/character/${CHAR_ID}/credit`,
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validCreditBody, amount: -100 }),
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for invalid account type', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/wallets/character/${CHAR_ID}/credit`,
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validCreditBody, account: 'crypto' }),
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 422 when wallet is frozen', async () => {
    const ctx = makeMockCtx()
    const { WalletFrozenError } = await import('@atc/db')
    ;(ctx.wallets.credit as ReturnType<typeof vi.fn>).mockRejectedValue(new WalletFrozenError())
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/wallets/character/${CHAR_ID}/credit`,
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify(validCreditBody),
    })
    expect(res.statusCode).toBe(422)
    const body = JSON.parse(res.body) as { error: string }
    expect(body.error).toBe('Wallet is frozen')
  })
})

describe('POST /api/v1/wallets/character/:characterId/debit', () => {
  const validDebitBody = {
    account: 'cash',
    amount: 200,
    currency: 'ATC',
    reason: 'test debit',
    source: 'gameplay',
    idempotencyKey: 'test-idem-debit-001',
  }

  it('returns 201 for a valid debit', async () => {
    const ctx = makeMockCtx()
    ;(ctx.wallets.debit as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockMutationResult,
      type: 'debit',
      cashBalance: 800,
      amount: 200,
    })
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/wallets/character/${CHAR_ID}/debit`,
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify(validDebitBody),
    })
    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body) as { cashBalance: number; type: string }
    expect(body.cashBalance).toBe(800)
    expect(body.type).toBe('debit')
  })

  it('returns 422 for insufficient funds', async () => {
    const ctx = makeMockCtx()
    const { InsufficientFundsError } = await import('@atc/db')
    ;(ctx.wallets.debit as ReturnType<typeof vi.fn>).mockRejectedValue(new InsufficientFundsError())
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/wallets/character/${CHAR_ID}/debit`,
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify(validDebitBody),
    })
    expect(res.statusCode).toBe(422)
    const body = JSON.parse(res.body) as { error: string }
    expect(body.error).toBe('Insufficient funds')
  })

  it('returns 422 when wallet is closed', async () => {
    const ctx = makeMockCtx()
    const { WalletClosedError } = await import('@atc/db')
    ;(ctx.wallets.debit as ReturnType<typeof vi.fn>).mockRejectedValue(new WalletClosedError())
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/wallets/character/${CHAR_ID}/debit`,
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify(validDebitBody),
    })
    expect(res.statusCode).toBe(422)
    const body = JSON.parse(res.body) as { error: string }
    expect(body.error).toBe('Wallet is closed')
  })
})

describe('POST /api/v1/wallets/character/:characterId/transfer', () => {
  const validTransferBody = {
    fromAccount: 'cash',
    toAccount: 'bank',
    amount: 1000,
    currency: 'ATC',
    reason: 'deposit to bank',
    idempotencyKey: 'test-idem-transfer-001',
  }

  it('returns 201 for a valid transfer', async () => {
    const ctx = makeMockCtx()
    ;(ctx.wallets.transfer as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockMutationResult,
      type: 'transfer',
      cashBalance: 0,
      bankBalance: 6000,
      amount: 1000,
    })
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/wallets/character/${CHAR_ID}/transfer`,
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify(validTransferBody),
    })
    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body) as { type: string; cashBalance: number; bankBalance: number }
    expect(body.type).toBe('transfer')
    expect(body.cashBalance).toBe(0)
    expect(body.bankBalance).toBe(6000)
  })

  it('returns 400 when fromAccount equals toAccount', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/wallets/character/${CHAR_ID}/transfer`,
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validTransferBody, toAccount: 'cash' }),
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 422 for insufficient funds on transfer', async () => {
    const ctx = makeMockCtx()
    const { InsufficientFundsError } = await import('@atc/db')
    ;(ctx.wallets.transfer as ReturnType<typeof vi.fn>).mockRejectedValue(new InsufficientFundsError())
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/wallets/character/${CHAR_ID}/transfer`,
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify(validTransferBody),
    })
    expect(res.statusCode).toBe(422)
  })
})

describe('Wallet routes — character guard (BUG-4)', () => {
  it('GET /wallets returns 404 when character does not exist', async () => {
    const ctx = makeMockCtx()
    ;(ctx.characters.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/wallets/character/${CHAR_ID}`,
      headers: { Authorization: 'Bearer test-secret-token' },
    })
    expect(res.statusCode).toBe(404)
    expect(ctx.wallets.getOrCreate).not.toHaveBeenCalled()
  })

  it('POST /credit returns 404 when character does not exist', async () => {
    const ctx = makeMockCtx()
    ;(ctx.characters.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/wallets/character/${CHAR_ID}/credit`,
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify(validCreditBody),
    })
    expect(res.statusCode).toBe(404)
    expect(ctx.wallets.credit).not.toHaveBeenCalled()
  })

  it('POST /credit returns 403 when character is not active', async () => {
    const ctx = makeMockCtx()
    ;(ctx.characters.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: CHAR_ID,
      accountId: ACCOUNT_ID,
      slot: 1,
      firstName: 'Test',
      lastName: 'Char',
      gender: 'male',
      dateOfBirth: null,
      nationality: null,
      metadata: {},
      status: 'deleted',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/wallets/character/${CHAR_ID}/credit`,
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify(validCreditBody),
    })
    expect(res.statusCode).toBe(403)
    expect(ctx.wallets.credit).not.toHaveBeenCalled()
  })

  it('GET /transactions returns 404 when character does not exist', async () => {
    const ctx = makeMockCtx()
    ;(ctx.characters.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/wallets/character/${CHAR_ID}/transactions`,
      headers: { Authorization: 'Bearer test-secret-token' },
    })
    expect(res.statusCode).toBe(404)
    expect(ctx.wallets.listTransactions).not.toHaveBeenCalled()
  })
})

describe('Wallet routes — idempotency payload mismatch (BUG-7)', () => {
  it('POST /credit returns 409 when idempotency key reused with different payload', async () => {
    const ctx = makeMockCtx()
    const { IdempotencyPayloadMismatchError } = await import('@atc/db')
    ;(ctx.wallets.credit as ReturnType<typeof vi.fn>).mockRejectedValue(
      new IdempotencyPayloadMismatchError(),
    )
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/wallets/character/${CHAR_ID}/credit`,
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify(validCreditBody),
    })
    expect(res.statusCode).toBe(409)
    const body = JSON.parse(res.body) as { error: string }
    expect(body.error).toContain('Idempotency key reused')
  })

  it('POST /debit returns 409 when idempotency key reused with different payload', async () => {
    const ctx = makeMockCtx()
    const { IdempotencyPayloadMismatchError } = await import('@atc/db')
    ;(ctx.wallets.debit as ReturnType<typeof vi.fn>).mockRejectedValue(
      new IdempotencyPayloadMismatchError(),
    )
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/wallets/character/${CHAR_ID}/debit`,
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account: 'cash',
        amount: 200,
        currency: 'ATC',
        reason: 'test',
        source: 'system',
        idempotencyKey: 'idem-debit-conflict',
      }),
    })
    expect(res.statusCode).toBe(409)
  })

  it('POST /transfer returns 409 when idempotency key reused with different payload', async () => {
    const ctx = makeMockCtx()
    const { IdempotencyPayloadMismatchError } = await import('@atc/db')
    ;(ctx.wallets.transfer as ReturnType<typeof vi.fn>).mockRejectedValue(
      new IdempotencyPayloadMismatchError(),
    )
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/wallets/character/${CHAR_ID}/transfer`,
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromAccount: 'cash',
        toAccount: 'bank',
        amount: 1000,
        currency: 'ATC',
        reason: 'deposit',
        idempotencyKey: 'idem-transfer-conflict',
      }),
    })
    expect(res.statusCode).toBe(409)
  })
})

describe('GET /api/v1/wallets/character/:characterId/transactions', () => {
  it('returns 200 with empty transaction list', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/wallets/character/${CHAR_ID}/transactions`,
      headers: { Authorization: 'Bearer test-secret-token' },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { transactions: unknown[]; total: number }
    expect(body.transactions).toHaveLength(0)
    expect(body.total).toBe(0)
  })

  it('returns 200 with transactions and total', async () => {
    const ctx = makeMockCtx()
    const fakeTx = {
      id: '01TX0000000000000000000TX1',
      walletId: WALLET_ID,
      characterId: CHAR_ID,
      type: 'credit',
      account: 'cash',
      amount: 500,
      balanceAfter: 1500,
      currency: 'ATC',
      reason: 'pay',
      source: 'system',
      idempotencyKey: 'k1',
      metadata: null,
      createdAt: new Date(),
    }
    ;(ctx.wallets.listTransactions as ReturnType<typeof vi.fn>).mockResolvedValue({
      transactions: [fakeTx],
      total: 1,
    })
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/wallets/character/${CHAR_ID}/transactions`,
      headers: { Authorization: 'Bearer test-secret-token' },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { transactions: unknown[]; total: number }
    expect(body.transactions).toHaveLength(1)
    expect(body.total).toBe(1)
  })

  it('returns 400 for limit exceeding 100', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/wallets/character/${CHAR_ID}/transactions?limit=200`,
      headers: { Authorization: 'Bearer test-secret-token' },
    })
    expect(res.statusCode).toBe(400)
  })
})

// ── Item routes ───────────────────────────────────────────────────────────────

describe('GET /api/v1/items', () => {
  it('returns 200 with empty array when no active items', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/items',
      headers: { Authorization: 'Bearer test-secret-token' },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual([])
  })
})

describe('POST /api/v1/items', () => {
  it('returns 200 with the upserted item', async () => {
    const ctx = makeMockCtx()
    const fakeItem = { id: 'water_bottle', label: 'Water Bottle', description: null, category: 'consumable', stackable: true, maxStack: 10, weightGrams: 500, usable: true, tradable: true, metadataSchema: null, status: 'active', createdAt: new Date(), updatedAt: new Date() }
    ;(ctx.itemDefinitions.upsert as ReturnType<typeof vi.fn>).mockResolvedValue(fakeItem)
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/items',
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'water_bottle', label: 'Water Bottle', category: 'consumable' }),
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toMatchObject({ id: 'water_bottle' })
  })

  it('returns 400 for invalid item ID (uppercase)', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/items',
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'WATER_BOTTLE', label: 'Water Bottle', category: 'consumable' }),
    })
    expect(res.statusCode).toBe(400)
  })
})

// ── Inventory routes ──────────────────────────────────────────────────────────

describe('GET /api/v1/inventory/character/:characterId', () => {
  it('returns 200 with empty inventory', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/inventory/character/${CHAR_ID}`,
      headers: { Authorization: 'Bearer test-secret-token' },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { characterId: string; slots: unknown[] }
    expect(body.characterId).toBe(CHAR_ID)
    expect(body.slots).toEqual([])
  })

  it('returns 404 when character does not exist', async () => {
    const ctx = makeMockCtx()
    ;(ctx.characters.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/inventory/character/${CHAR_ID}`,
      headers: { Authorization: 'Bearer test-secret-token' },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('POST /api/v1/inventory/character/:characterId/add', () => {
  const validAdd = { itemId: 'water_bottle', quantity: 1, reason: 'test', source: 'system', idempotencyKey: 'idem-001' }

  it('returns 201 on successful add', async () => {
    const ctx = makeMockCtx()
    const fakeResult = { transactionId: 'tx1', characterId: CHAR_ID, slot: 1, itemId: 'water_bottle', quantity: 1, type: 'add', idempotent: false }
    ;(ctx.inventory.addItem as ReturnType<typeof vi.fn>).mockResolvedValue(fakeResult)
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/inventory/character/${CHAR_ID}/add`,
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify(validAdd),
    })
    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.body)).toMatchObject({ idempotent: false })
  })

  it('returns 200 on idempotent replay', async () => {
    const ctx = makeMockCtx()
    const fakeResult = { transactionId: 'tx1', characterId: CHAR_ID, slot: 1, itemId: 'water_bottle', quantity: 1, type: 'add', idempotent: true }
    ;(ctx.inventory.addItem as ReturnType<typeof vi.fn>).mockResolvedValue(fakeResult)
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/inventory/character/${CHAR_ID}/add`,
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify(validAdd),
    })
    expect(res.statusCode).toBe(200)
  })

  it('returns 404 when item definition is not found or disabled', async () => {
    const ctx = makeMockCtx()
    ;(ctx.inventory.addItem as ReturnType<typeof vi.fn>).mockRejectedValue(new InventoryItemNotFoundError())
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/inventory/character/${CHAR_ID}/add`,
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify(validAdd),
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 409 when slot is occupied', async () => {
    const ctx = makeMockCtx()
    ;(ctx.inventory.addItem as ReturnType<typeof vi.fn>).mockRejectedValue(new InventorySlotOccupiedError())
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/inventory/character/${CHAR_ID}/add`,
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify(validAdd),
    })
    expect(res.statusCode).toBe(409)
  })

  it('returns 409 when inventory is full', async () => {
    const ctx = makeMockCtx()
    ;(ctx.inventory.addItem as ReturnType<typeof vi.fn>).mockRejectedValue(new InventoryFullError())
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/inventory/character/${CHAR_ID}/add`,
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify(validAdd),
    })
    expect(res.statusCode).toBe(409)
  })

  it('returns 409 on idempotency payload mismatch', async () => {
    const ctx = makeMockCtx()
    ;(ctx.inventory.addItem as ReturnType<typeof vi.fn>).mockRejectedValue(new InventoryIdempotencyPayloadMismatchError())
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/inventory/character/${CHAR_ID}/add`,
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify(validAdd),
    })
    expect(res.statusCode).toBe(409)
  })

  it('returns 400 for quantity of 0', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/inventory/character/${CHAR_ID}/add`,
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validAdd, quantity: 0 }),
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /api/v1/inventory/character/:characterId/remove', () => {
  const validRemove = { itemId: 'water_bottle', quantity: 1, reason: 'test', source: 'system', idempotencyKey: 'idem-002' }

  it('returns 200 on successful remove', async () => {
    const ctx = makeMockCtx()
    const fakeResult = { transactionId: 'tx2', characterId: CHAR_ID, slot: 1, itemId: 'water_bottle', quantity: 1, type: 'remove', idempotent: false }
    ;(ctx.inventory.removeItem as ReturnType<typeof vi.fn>).mockResolvedValue(fakeResult)
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/inventory/character/${CHAR_ID}/remove`,
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify(validRemove),
    })
    expect(res.statusCode).toBe(200)
  })

  it('returns 422 when insufficient quantity', async () => {
    const ctx = makeMockCtx()
    ;(ctx.inventory.removeItem as ReturnType<typeof vi.fn>).mockRejectedValue(new InventoryInsufficientQuantityError())
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/inventory/character/${CHAR_ID}/remove`,
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify(validRemove),
    })
    expect(res.statusCode).toBe(422)
  })
})

describe('POST /api/v1/inventory/character/:characterId/move', () => {
  const validMove = { fromSlot: 1, toSlot: 5, idempotencyKey: 'idem-003' }

  it('returns 200 on successful move', async () => {
    const ctx = makeMockCtx()
    const fakeResult = { transactionId: 'tx3', characterId: CHAR_ID, slot: 5, itemId: 'water_bottle', quantity: 1, type: 'move', idempotent: false }
    ;(ctx.inventory.moveItem as ReturnType<typeof vi.fn>).mockResolvedValue(fakeResult)
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/inventory/character/${CHAR_ID}/move`,
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify(validMove),
    })
    expect(res.statusCode).toBe(200)
  })

  it('returns 400 when fromSlot equals toSlot', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/inventory/character/${CHAR_ID}/move`,
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromSlot: 3, toSlot: 3, idempotencyKey: 'idem-004' }),
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /api/v1/inventory/character/:characterId/transactions', () => {
  it('returns 200 with empty list', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/inventory/character/${CHAR_ID}/transactions`,
      headers: { Authorization: 'Bearer test-secret-token' },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual([])
  })
})

// ── Phase 6: Add inventory errors ─────────────────────────────────────────────

describe('POST /api/v1/inventory/character/:characterId/add — Phase 6 errors', () => {
  const validAdd = { itemId: 'water_bottle', quantity: 1, reason: 'test', source: 'system', idempotencyKey: 'idem-p6-001' }

  it('returns 422 when item would exceed weight limit', async () => {
    const ctx = makeMockCtx()
    ;(ctx.inventory.addItem as ReturnType<typeof vi.fn>).mockRejectedValue(new InventoryOverweightError())
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/inventory/character/${CHAR_ID}/add`,
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify(validAdd),
    })
    expect(res.statusCode).toBe(422)
  })

  it('returns 422 when requested slot exceeds character capacity', async () => {
    const ctx = makeMockCtx()
    ;(ctx.inventory.addItem as ReturnType<typeof vi.fn>).mockRejectedValue(new InventoryCapacityError())
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/inventory/character/${CHAR_ID}/add`,
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify(validAdd),
    })
    expect(res.statusCode).toBe(422)
  })

  it('returns 422 when item metadata fails schema validation', async () => {
    const ctx = makeMockCtx()
    ;(ctx.inventory.addItem as ReturnType<typeof vi.fn>).mockRejectedValue(new InventoryMetadataValidationError())
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/inventory/character/${CHAR_ID}/add`,
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify(validAdd),
    })
    expect(res.statusCode).toBe(422)
  })
})

// ── Phase 6: Settings endpoints ───────────────────────────────────────────────

describe('GET /api/v1/inventory/character/:characterId/settings', () => {
  it('returns 200 with settings', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/inventory/character/${CHAR_ID}/settings`,
      headers: { Authorization: 'Bearer test-secret-token' },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.maxSlots).toBe(60)
    expect(body.maxWeightGrams).toBe(30_000)
  })

  it('returns 404 when character not found', async () => {
    const ctx = makeMockCtx()
    ;(ctx.characters.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/inventory/character/${CHAR_ID}/settings`,
      headers: { Authorization: 'Bearer test-secret-token' },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('PATCH /api/v1/inventory/character/:characterId/settings', () => {
  it('returns 200 on successful update', async () => {
    const ctx = makeMockCtx()
    ;(ctx.inventory.updateSettings as ReturnType<typeof vi.fn>).mockResolvedValue({
      characterId: CHAR_ID, maxSlots: 80, maxWeightGrams: 30_000, createdAt: new Date(), updatedAt: new Date(),
    })
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'PATCH',
      url: `/api/v1/inventory/character/${CHAR_ID}/settings`,
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxSlots: 80 }),
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).maxSlots).toBe(80)
  })

  it('returns 400 when no fields provided', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'PATCH',
      url: `/api/v1/inventory/character/${CHAR_ID}/settings`,
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 409 when maxSlots conflicts with existing slot usage', async () => {
    const ctx = makeMockCtx()
    ;(ctx.inventory.updateSettings as ReturnType<typeof vi.fn>).mockRejectedValue(new InventorySettingsConflictError())
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'PATCH',
      url: `/api/v1/inventory/character/${CHAR_ID}/settings`,
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxSlots: 5 }),
    })
    expect(res.statusCode).toBe(409)
  })
})

// ── Phase 7: Item catalog routes ──────────────────────────────────────────────

const ITEM_AUTH = { Authorization: 'Bearer test-secret-token' }
const ITEM_JSON = { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' }

const MOCK_ITEM = {
  id: 'water_bottle',
  label: 'Water Bottle',
  description: null,
  category: 'consumable',
  stackable: true,
  maxStack: 100,
  weightGrams: 250,
  usable: false,
  tradable: true,
  metadataSchema: null,
  status: 'active',
  imageUrl: null,
  icon: null,
  tags: [],
  sortOrder: 0,
  version: 1,
  actionConfig: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('GET /api/v1/items/catalog', () => {
  it('returns 200 with item list', async () => {
    const ctx = makeMockCtx()
    ;(ctx.itemDefinitions.listCatalog as ReturnType<typeof vi.fn>).mockResolvedValue([MOCK_ITEM])
    const server = buildServer(ctx)
    const res = await server.inject({ method: 'GET', url: '/api/v1/items/catalog', headers: ITEM_AUTH })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as unknown[]
    expect(body).toHaveLength(1)
  })

  it('returns 200 with empty array when no items match', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({ method: 'GET', url: '/api/v1/items/catalog?status=disabled', headers: ITEM_AUTH })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual([])
  })

  it('returns 400 for invalid status query param', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({ method: 'GET', url: '/api/v1/items/catalog?status=deleted', headers: ITEM_AUTH })
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /api/v1/items/bulk', () => {
  const validBody = {
    items: [
      { id: 'water_bottle', label: 'Water Bottle', category: 'consumable' },
      { id: 'bread', label: 'Bread', category: 'food' },
    ],
  }

  it('returns 200 with upserted count on success', async () => {
    const ctx = makeMockCtx()
    ;(ctx.itemDefinitions.bulkUpsert as ReturnType<typeof vi.fn>).mockResolvedValue({
      upserted: 2,
      items: [MOCK_ITEM, { ...MOCK_ITEM, id: 'bread', label: 'Bread' }],
    })
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/items/bulk',
      headers: ITEM_JSON,
      body: JSON.stringify(validBody),
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { upserted: number }
    expect(body.upserted).toBe(2)
  })

  it('returns 409 when duplicate item IDs are in the request', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/items/bulk',
      headers: ITEM_JSON,
      body: JSON.stringify({
        items: [
          { id: 'water_bottle', label: 'Water', category: 'x' },
          { id: 'water_bottle', label: 'Water 2', category: 'x' },
        ],
      }),
    })
    expect(res.statusCode).toBe(409)
  })

  it('returns 400 when items array is empty', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/items/bulk',
      headers: ITEM_JSON,
      body: JSON.stringify({ items: [] }),
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /api/v1/items/metadata/validate', () => {
  it('returns 200 valid:true for a well-formed schema', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/items/metadata/validate',
      headers: ITEM_JSON,
      body: JSON.stringify({ metadataSchema: { properties: { durability: { type: 'number', min: 0, max: 100 } } } }),
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { valid: boolean; errors: string[] }
    expect(body.valid).toBe(true)
    expect(body.errors).toEqual([])
  })

  it('returns 200 valid:false when sample metadata fails validation', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/items/metadata/validate',
      headers: ITEM_JSON,
      body: JSON.stringify({
        metadataSchema: { properties: { durability: { type: 'number', min: 0, max: 100 } } },
        sampleMetadata: { durability: 'not-a-number' },
      }),
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { valid: boolean; errors: string[] }
    expect(body.valid).toBe(false)
    expect(body.errors.length).toBeGreaterThan(0)
  })

  it('returns 400 when metadataSchema is missing', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/items/metadata/validate',
      headers: ITEM_JSON,
      body: JSON.stringify({ sampleMetadata: { foo: 'bar' } }),
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('PATCH /api/v1/items/:itemId', () => {
  it('returns 200 with updated item on success', async () => {
    const ctx = makeMockCtx()
    ;(ctx.itemDefinitions.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...MOCK_ITEM,
      label: 'Premium Water',
    })
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'PATCH',
      url: '/api/v1/items/water_bottle',
      headers: ITEM_JSON,
      body: JSON.stringify({ label: 'Premium Water' }),
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { label: string }
    expect(body.label).toBe('Premium Water')
  })

  it('returns 404 when item does not exist', async () => {
    const ctx = makeMockCtx()
    ;(ctx.itemDefinitions.update as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ItemDefinitionNotFoundError('ghost_item'),
    )
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'PATCH',
      url: '/api/v1/items/ghost_item',
      headers: ITEM_JSON,
      body: JSON.stringify({ label: 'Ghost' }),
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 400 when no fields are provided', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'PATCH',
      url: '/api/v1/items/water_bottle',
      headers: ITEM_JSON,
      body: JSON.stringify({}),
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for invalid itemId format', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'PATCH',
      url: '/api/v1/items/INVALID-UPPER',
      headers: ITEM_JSON,
      body: JSON.stringify({ label: 'Bad' }),
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /api/v1/items/:itemId/disable', () => {
  it('returns 200 with disabled item on success', async () => {
    const ctx = makeMockCtx()
    ;(ctx.itemDefinitions.safeDisable as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...MOCK_ITEM,
      status: 'disabled',
    })
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/items/water_bottle/disable',
      headers: ITEM_AUTH,
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { status: string }
    expect(body.status).toBe('disabled')
  })

  it('returns 404 when item does not exist', async () => {
    const ctx = makeMockCtx()
    ;(ctx.itemDefinitions.safeDisable as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ItemDefinitionNotFoundError('ghost_item'),
    )
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/items/ghost_item/disable',
      headers: ITEM_AUTH,
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('POST /api/v1/items/:itemId/deprecate', () => {
  it('returns 200 with deprecated item on success', async () => {
    const ctx = makeMockCtx()
    ;(ctx.itemDefinitions.safeDeprecate as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...MOCK_ITEM,
      status: 'deprecated',
    })
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/items/water_bottle/deprecate',
      headers: ITEM_AUTH,
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { status: string }
    expect(body.status).toBe('deprecated')
  })

  it('returns 404 when item does not exist', async () => {
    const ctx = makeMockCtx()
    ;(ctx.itemDefinitions.safeDeprecate as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ItemDefinitionNotFoundError('ghost_item'),
    )
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/items/ghost_item/deprecate',
      headers: ITEM_AUTH,
    })
    expect(res.statusCode).toBe(404)
  })
})

// ── Phase 7 hardening: POST /api/v1/items/create (BUG-7-1) ───────────────────

describe('POST /api/v1/items/create', () => {
  const validBody = { id: 'premium_water', label: 'Premium Water', category: 'consumable' }

  it('returns 201 with created item on success', async () => {
    const ctx = makeMockCtx()
    ;(ctx.itemDefinitions.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...MOCK_ITEM,
      id: 'premium_water',
      label: 'Premium Water',
    })
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/items/create',
      headers: ITEM_JSON,
      body: JSON.stringify(validBody),
    })
    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body) as { id: string }
    expect(body.id).toBe('premium_water')
  })

  it('returns 409 when item ID already exists (BUG-7-1 fix)', async () => {
    const ctx = makeMockCtx()
    ;(ctx.itemDefinitions.create as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ItemDefinitionDuplicateError('premium_water'),
    )
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/items/create',
      headers: ITEM_JSON,
      body: JSON.stringify(validBody),
    })
    expect(res.statusCode).toBe(409)
  })

  it('returns 400 for invalid request body', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/items/create',
      headers: ITEM_JSON,
      body: JSON.stringify({ label: 'Missing ID' }),
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when metadataSchema has invalid format (BUG-7-3)', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/items/create',
      headers: ITEM_JSON,
      body: JSON.stringify({
        ...validBody,
        metadataSchema: { properties: { x: { type: 'not_a_valid_type' } } },
      }),
    })
    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.body) as { error: string }
    expect(body.error).toContain('metadataSchema')
  })
})

// ── Phase 7 hardening: metadataSchema format validation ──────────────────────

describe('PATCH /api/v1/items/:itemId — metadataSchema format guard (BUG-7-3)', () => {
  it('returns 400 when metadataSchema has invalid type values', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'PATCH',
      url: '/api/v1/items/water_bottle',
      headers: ITEM_JSON,
      body: JSON.stringify({
        metadataSchema: { properties: { durability: { type: 'object' } } },
      }),
    })
    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.body) as { error: string }
    expect(body.error).toContain('metadataSchema')
  })

  it('accepts null metadataSchema (clearing the schema)', async () => {
    const ctx = makeMockCtx()
    ;(ctx.itemDefinitions.update as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_ITEM)
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'PATCH',
      url: '/api/v1/items/water_bottle',
      headers: ITEM_JSON,
      body: JSON.stringify({ metadataSchema: null }),
    })
    expect(res.statusCode).toBe(200)
  })
})

describe('POST /api/v1/items/bulk — metadataSchema format guard (BUG-7-3)', () => {
  it('returns 400 when any item has invalid metadataSchema format', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/items/bulk',
      headers: ITEM_JSON,
      body: JSON.stringify({
        items: [
          { id: 'good_item', label: 'Good', category: 'misc' },
          { id: 'bad_item', label: 'Bad', category: 'misc',
            metadataSchema: { properties: { x: { type: 'array' } } } },
        ],
      }),
    })
    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.body) as { error: string }
    expect(body.error).toContain('bad_item')
  })

  it('proceeds normally when metadataSchema is correctly structured', async () => {
    const ctx = makeMockCtx()
    ;(ctx.itemDefinitions.bulkUpsert as ReturnType<typeof vi.fn>).mockResolvedValue({
      upserted: 1,
      items: [MOCK_ITEM],
    })
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/items/bulk',
      headers: ITEM_JSON,
      body: JSON.stringify({
        items: [{
          id: 'water_bottle',
          label: 'Water Bottle',
          category: 'consumable',
          metadataSchema: { properties: { durability: { type: 'number', min: 0, max: 100 } } },
        }],
      }),
    })
    expect(res.statusCode).toBe(200)
  })
})

// ── Phase 9: Vitals endpoints ─────────────────────────────────────────────────

const VITALS_AUTH = { Authorization: 'Bearer test-secret-token' }
const VITALS_JSON = { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' }

describe('GET /api/v1/vitals/character/:characterId', () => {
  it('returns 200 with vitals on success', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/vitals/character/${CHAR_ID}`,
      headers: VITALS_AUTH,
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { health: number; hunger: number }
    expect(body.health).toBe(100)
    expect(body.hunger).toBe(100)
  })

  it('returns cached vitals when Redis hits', async () => {
    const cached = {
      characterId: CHAR_ID, health: 80, hunger: 70, thirst: 60, stamina: 90, stress: 5, armor: 0,
      createdAt: new Date(), updatedAt: new Date(),
    }
    const ctx = makeMockCtx()
    ;(ctx.vitalsCache.get as ReturnType<typeof vi.fn>).mockResolvedValue(cached)
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/vitals/character/${CHAR_ID}`,
      headers: VITALS_AUTH,
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { health: number }
    expect(body.health).toBe(80)
    expect(ctx.vitals.getOrCreate).not.toHaveBeenCalled()
  })

  it('falls back to DB when Redis get throws', async () => {
    const ctx = makeMockCtx()
    ;(ctx.vitalsCache.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Redis down'))
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/vitals/character/${CHAR_ID}`,
      headers: VITALS_AUTH,
    })
    expect(res.statusCode).toBe(200)
    expect(ctx.vitals.getOrCreate).toHaveBeenCalled()
  })

  it('returns 404 when character does not exist', async () => {
    const ctx = makeMockCtx()
    ;(ctx.characters.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/vitals/character/${CHAR_ID}`,
      headers: VITALS_AUTH,
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 403 when character is not active', async () => {
    const ctx = makeMockCtx()
    ;(ctx.characters.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: CHAR_ID, status: 'suspended',
    })
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/vitals/character/${CHAR_ID}`,
      headers: VITALS_AUTH,
    })
    expect(res.statusCode).toBe(403)
  })

  it('returns 400 for invalid characterId', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/vitals/character/x',
      headers: VITALS_AUTH,
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('PATCH /api/v1/vitals/character/:characterId', () => {
  it('returns 200 with updated vitals', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'PATCH',
      url: `/api/v1/vitals/character/${CHAR_ID}`,
      headers: VITALS_JSON,
      body: JSON.stringify({ health: 75 }),
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { health: number }
    expect(body.health).toBe(75)
  })

  it('returns 400 for empty patch body', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'PATCH',
      url: `/api/v1/vitals/character/${CHAR_ID}`,
      headers: VITALS_JSON,
      body: JSON.stringify({}),
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for value above 100', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'PATCH',
      url: `/api/v1/vitals/character/${CHAR_ID}`,
      headers: VITALS_JSON,
      body: JSON.stringify({ hunger: 150 }),
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /api/v1/vitals/character/:characterId/mutate', () => {
  const validMutate = { vital: 'hunger', mode: 'decrement', amount: 10 }

  it('returns 200 with mutated vitals', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/vitals/character/${CHAR_ID}/mutate`,
      headers: VITALS_JSON,
      body: JSON.stringify(validMutate),
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { hunger: number }
    expect(body.hunger).toBe(75)
  })

  it('returns 400 for invalid vital name', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/vitals/character/${CHAR_ID}/mutate`,
      headers: VITALS_JSON,
      body: JSON.stringify({ vital: 'mana', mode: 'set', amount: 50 }),
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for invalid mode', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/vitals/character/${CHAR_ID}/mutate`,
      headers: VITALS_JSON,
      body: JSON.stringify({ vital: 'health', mode: 'add', amount: 10 }),
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 404 when character does not exist', async () => {
    const ctx = makeMockCtx()
    ;(ctx.characters.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/vitals/character/${CHAR_ID}/mutate`,
      headers: VITALS_JSON,
      body: JSON.stringify(validMutate),
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('POST /api/v1/vitals/character/:characterId/reset', () => {
  it('returns 200 with default vitals', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/vitals/character/${CHAR_ID}/reset`,
      headers: VITALS_AUTH,
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { health: number; stress: number }
    expect(body.health).toBe(100)
    expect(body.stress).toBe(0)
  })

  it('returns 403 when character is not active', async () => {
    const ctx = makeMockCtx()
    ;(ctx.characters.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: CHAR_ID, status: 'deleted',
    })
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/vitals/character/${CHAR_ID}/reset`,
      headers: VITALS_AUTH,
    })
    expect(res.statusCode).toBe(403)
  })
})

// ── Phase 9 Hardening: Character create → eager vitals ───────────────────────

describe('POST /api/v1/characters — eager vitals creation (BUG-9-4)', () => {
  const validBody = {
    accountId: ACCOUNT_ID,
    slot: 2,
    firstName: 'Jane',
    lastName: 'Doe',
    gender: 'female',
  }
  const createdChar = {
    id: CHAR_ID,
    accountId: ACCOUNT_ID,
    slot: 2,
    firstName: 'Jane',
    lastName: 'Doe',
    gender: 'female' as const,
    dateOfBirth: null,
    nationality: null,
    metadata: {},
    status: 'active' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  it('calls vitals.getOrCreate after character creation', async () => {
    const ctx = makeMockCtx()
    ;(ctx.characters.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdChar)
    const server = buildServer(ctx)
    await server.inject({
      method: 'POST',
      url: '/api/v1/characters',
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    // Give the best-effort background promise a tick to resolve
    await new Promise((r) => setTimeout(r, 0))
    expect(ctx.vitals.getOrCreate).toHaveBeenCalledWith(CHAR_ID)
  })

  it('still returns 201 when vitals.getOrCreate throws (best-effort)', async () => {
    const ctx = makeMockCtx()
    ;(ctx.characters.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdChar)
    ;(ctx.vitals.getOrCreate as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB down'))
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/characters',
      headers: { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    // Character is created and response sent before vitals.getOrCreate resolves/rejects
    expect(res.statusCode).toBe(201)
  })
})

// ── Phase 9 Hardening: Cache write non-fatal after mutation ───────────────────

describe('PATCH /api/v1/vitals — Redis set failure is non-fatal (BUG-9-CACHE)', () => {
  it('returns 200 even when vitalsCache.set throws after patch', async () => {
    const ctx = makeMockCtx()
    ;(ctx.vitalsCache.set as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Redis down'))
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'PATCH',
      url: `/api/v1/vitals/character/${CHAR_ID}`,
      headers: VITALS_JSON,
      body: JSON.stringify({ health: 75 }),
    })
    expect(res.statusCode).toBe(200)
  })
})

describe('POST /api/v1/vitals/mutate — Redis set failure is non-fatal', () => {
  it('returns 200 even when vitalsCache.set throws after mutate', async () => {
    const ctx = makeMockCtx()
    ;(ctx.vitalsCache.set as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Redis down'))
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/vitals/character/${CHAR_ID}/mutate`,
      headers: VITALS_JSON,
      body: JSON.stringify({ vital: 'health', mode: 'increment', amount: 10 }),
    })
    expect(res.statusCode).toBe(200)
  })
})

describe('POST /api/v1/vitals/reset — vitalsCache.set called with reset result', () => {
  it('calls vitalsCache.set with the reset vitals', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    await server.inject({
      method: 'POST',
      url: `/api/v1/vitals/character/${CHAR_ID}/reset`,
      headers: VITALS_AUTH,
    })
    expect(ctx.vitalsCache.set).toHaveBeenCalledWith(
      expect.objectContaining({ characterId: CHAR_ID, health: 100, stress: 0 }),
    )
  })

  it('returns 200 even when vitalsCache.set throws after reset', async () => {
    const ctx = makeMockCtx()
    ;(ctx.vitalsCache.set as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Redis down'))
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/vitals/character/${CHAR_ID}/reset`,
      headers: VITALS_AUTH,
    })
    expect(res.statusCode).toBe(200)
  })
})

// ── Phase 9 Hardening: Vitals amount boundary validation ─────────────────────

describe('POST /api/v1/vitals/mutate — amount boundary validation', () => {
  it('returns 400 for amount below 0', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/vitals/character/${CHAR_ID}/mutate`,
      headers: VITALS_JSON,
      body: JSON.stringify({ vital: 'health', mode: 'decrement', amount: -1 }),
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for amount above 100', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/vitals/character/${CHAR_ID}/mutate`,
      headers: VITALS_JSON,
      body: JSON.stringify({ vital: 'health', mode: 'set', amount: 101 }),
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for fractional amount', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/vitals/character/${CHAR_ID}/mutate`,
      headers: VITALS_JSON,
      body: JSON.stringify({ vital: 'thirst', mode: 'increment', amount: 12.5 }),
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 200 for boundary amount 0', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/vitals/character/${CHAR_ID}/mutate`,
      headers: VITALS_JSON,
      body: JSON.stringify({ vital: 'stress', mode: 'set', amount: 0 }),
    })
    expect(res.statusCode).toBe(200)
  })

  it('returns 200 for boundary amount 100', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/vitals/character/${CHAR_ID}/mutate`,
      headers: VITALS_JSON,
      body: JSON.stringify({ vital: 'health', mode: 'set', amount: 100 }),
    })
    expect(res.statusCode).toBe(200)
  })
})

// ── Phase 8: Item use endpoint ────────────────────────────────────────────────

const USE_BODY = { slot: 5, idempotencyKey: 'atc:use:1:char:5:12345:999' }

describe('POST /api/v1/inventory/character/:characterId/use', () => {
  it('returns 200 with use result on success', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/inventory/character/${CHAR_ID}/use`,
      headers: ITEM_JSON,
      body: JSON.stringify(USE_BODY),
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { success: boolean; slot: number; consumed: number }
    expect(body.success).toBe(true)
    expect(body.slot).toBe(5)
    expect(body.consumed).toBe(1)
  })

  it('returns 403 when item is not usable', async () => {
    const ctx = makeMockCtx()
    ;(ctx.itemRuntime.useItem as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ItemNotUsableError(['Item is disabled']),
    )
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/inventory/character/${CHAR_ID}/use`,
      headers: ITEM_JSON,
      body: JSON.stringify(USE_BODY),
    })
    expect(res.statusCode).toBe(403)
    const body = JSON.parse(res.body) as { error: string; details: string[] }
    expect(body.error).toBeTruthy()
    expect(body.details).toBeInstanceOf(Array)
  })

  it('returns 409 when cooldown is active', async () => {
    const expiresAt = new Date(Date.now() + 3000)
    const ctx = makeMockCtx()
    ;(ctx.itemRuntime.useItem as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ItemCooldownActiveError(expiresAt),
    )
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/inventory/character/${CHAR_ID}/use`,
      headers: ITEM_JSON,
      body: JSON.stringify(USE_BODY),
    })
    expect(res.statusCode).toBe(409)
    const body = JSON.parse(res.body) as { cooldownExpiresAt: string }
    expect(body.cooldownExpiresAt).toBe(expiresAt.toISOString())
  })

  it('returns 422 when durability is insufficient', async () => {
    const ctx = makeMockCtx()
    ;(ctx.itemRuntime.useItem as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ItemInsufficientDurabilityError(),
    )
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/inventory/character/${CHAR_ID}/use`,
      headers: ITEM_JSON,
      body: JSON.stringify(USE_BODY),
    })
    expect(res.statusCode).toBe(422)
  })

  it('returns 422 when quantity is insufficient', async () => {
    const ctx = makeMockCtx()
    ;(ctx.itemRuntime.useItem as ReturnType<typeof vi.fn>).mockRejectedValue(
      new InventoryInsufficientQuantityError(),
    )
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/inventory/character/${CHAR_ID}/use`,
      headers: ITEM_JSON,
      body: JSON.stringify(USE_BODY),
    })
    expect(res.statusCode).toBe(422)
  })

  it('returns 404 when slot is empty', async () => {
    const ctx = makeMockCtx()
    ;(ctx.itemRuntime.useItem as ReturnType<typeof vi.fn>).mockRejectedValue(
      new InventoryItemNotFoundError(),
    )
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/inventory/character/${CHAR_ID}/use`,
      headers: ITEM_JSON,
      body: JSON.stringify(USE_BODY),
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 404 when character does not exist', async () => {
    const ctx = makeMockCtx()
    ;(ctx.characters.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/inventory/character/${CHAR_ID}/use`,
      headers: ITEM_JSON,
      body: JSON.stringify(USE_BODY),
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 400 for invalid slot (0)', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/inventory/character/${CHAR_ID}/use`,
      headers: ITEM_JSON,
      body: JSON.stringify({ slot: 0, idempotencyKey: 'key1' }),
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for missing idempotencyKey', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/inventory/character/${CHAR_ID}/use`,
      headers: ITEM_JSON,
      body: JSON.stringify({ slot: 5 }),
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for invalid characterId', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/inventory/character/not-a-ulid/use',
      headers: ITEM_JSON,
      body: JSON.stringify(USE_BODY),
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 422 when InventoryItemBrokenError escapes executeUse (BUG-8-5 fix)', async () => {
    const ctx = makeMockCtx()
    const { InventoryItemBrokenError } = await import('@atc/db')
    ;(ctx.itemRuntime.useItem as ReturnType<typeof vi.fn>).mockRejectedValue(
      new InventoryItemBrokenError(),
    )
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/inventory/character/${CHAR_ID}/use`,
      headers: ITEM_JSON,
      body: JSON.stringify(USE_BODY),
    })
    expect(res.statusCode).toBe(422)
  })

  it('returns 200 with success:true even when effect handler threw (BUG-8-2 fix)', async () => {
    const ctx = makeMockCtx()
    ;(ctx.itemRuntime.useItem as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      itemId: 'water_bottle',
      slot: 5,
      consumed: 1,
      remainingQuantity: 1,
      durability: null,
      cooldownExpiresAt: null,
      effects: [{ type: 'medkit.use', success: false }],
      idempotent: false,
    })
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/inventory/character/${CHAR_ID}/use`,
      headers: ITEM_JSON,
      body: JSON.stringify(USE_BODY),
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { effects: Array<{ success: boolean }> }
    expect(body.effects[0]?.success).toBe(false)
  })
})

// ── Phase 10: Rate limiting on vitals mutation endpoints ─────────────────────

describe('Vitals mutation endpoints — rate limit (429)', () => {
  it('PATCH returns 429 when rate limiter blocks', async () => {
    const ctx = makeMockCtx()
    ;(ctx.vitalsRateLimiter.check as ReturnType<typeof vi.fn>).mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 42,
    })
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'PATCH',
      url: `/api/v1/vitals/character/${CHAR_ID}`,
      headers: VITALS_JSON,
      body: JSON.stringify({ health: 80 }),
    })
    expect(res.statusCode).toBe(429)
    const body = JSON.parse(res.body) as { retryAfterSeconds: number }
    expect(body.retryAfterSeconds).toBe(42)
    expect(res.headers['retry-after']).toBe('42')
  })

  it('POST /mutate returns 429 when rate limiter blocks', async () => {
    const ctx = makeMockCtx()
    ;(ctx.vitalsRateLimiter.check as ReturnType<typeof vi.fn>).mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 30,
    })
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/vitals/character/${CHAR_ID}/mutate`,
      headers: VITALS_JSON,
      body: JSON.stringify({ vital: 'health', mode: 'set', amount: 50 }),
    })
    expect(res.statusCode).toBe(429)
    expect(res.headers['retry-after']).toBe('30')
  })

  it('POST /reset returns 429 when rate limiter blocks', async () => {
    const ctx = makeMockCtx()
    ;(ctx.vitalsRateLimiter.check as ReturnType<typeof vi.fn>).mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 15,
    })
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/vitals/character/${CHAR_ID}/reset`,
      headers: VITALS_AUTH,
    })
    expect(res.statusCode).toBe(429)
  })

  it('PATCH succeeds (200) when rate limiter allows', async () => {
    const ctx = makeMockCtx()
    ;(ctx.vitalsRateLimiter.check as ReturnType<typeof vi.fn>).mockResolvedValue({ allowed: true })
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'PATCH',
      url: `/api/v1/vitals/character/${CHAR_ID}`,
      headers: VITALS_JSON,
      body: JSON.stringify({ health: 80 }),
    })
    expect(res.statusCode).toBe(200)
  })

  it('does not call rate limiter for GET (read-only)', async () => {
    const ctx = makeMockCtx()
    const checkSpy = ctx.vitalsRateLimiter.check as ReturnType<typeof vi.fn>
    const server = buildServer(ctx)
    await server.inject({
      method: 'GET',
      url: `/api/v1/vitals/character/${CHAR_ID}`,
      headers: VITALS_AUTH,
    })
    expect(checkSpy).not.toHaveBeenCalled()
  })
})

// ── Phase 10: EventBus emission after successful mutations ────────────────────

describe('Vitals mutation endpoints — EventBus emission', () => {
  it('emits atc:vitals:changed after successful PATCH', async () => {
    const ctx = makeMockCtx()
    const emitSpy = ctx.eventBus.emit as ReturnType<typeof vi.fn>
    const server = buildServer(ctx)
    await server.inject({
      method: 'PATCH',
      url: `/api/v1/vitals/character/${CHAR_ID}`,
      headers: VITALS_JSON,
      body: JSON.stringify({ health: 75 }),
    })
    expect(emitSpy).toHaveBeenCalledOnce()
    const [eventName, payload] = emitSpy.mock.calls[0] as [string, { source: string; timestamp: string; characterId: string }]
    expect(eventName).toBe('atc:vitals:changed')
    expect(payload.source).toBe('api')
    expect(payload.characterId).toBe(CHAR_ID)
    expect(typeof payload.timestamp).toBe('string')
  })

  it('emits atc:vitals:changed after successful POST /mutate', async () => {
    const ctx = makeMockCtx()
    const emitSpy = ctx.eventBus.emit as ReturnType<typeof vi.fn>
    const server = buildServer(ctx)
    await server.inject({
      method: 'POST',
      url: `/api/v1/vitals/character/${CHAR_ID}/mutate`,
      headers: VITALS_JSON,
      body: JSON.stringify({ vital: 'hunger', mode: 'decrement', amount: 10 }),
    })
    expect(emitSpy).toHaveBeenCalledOnce()
    const [eventName, payload] = emitSpy.mock.calls[0] as [string, { source: string }]
    expect(eventName).toBe('atc:vitals:changed')
    expect(payload.source).toBe('api')
  })

  it('emits atc:vitals:changed after successful POST /reset', async () => {
    const ctx = makeMockCtx()
    const emitSpy = ctx.eventBus.emit as ReturnType<typeof vi.fn>
    const server = buildServer(ctx)
    await server.inject({
      method: 'POST',
      url: `/api/v1/vitals/character/${CHAR_ID}/reset`,
      headers: VITALS_AUTH,
    })
    expect(emitSpy).toHaveBeenCalledOnce()
    const [eventName] = emitSpy.mock.calls[0] as [string]
    expect(eventName).toBe('atc:vitals:changed')
  })

  it('does not emit event when rate limit blocks (429)', async () => {
    const ctx = makeMockCtx()
    ;(ctx.vitalsRateLimiter.check as ReturnType<typeof vi.fn>).mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 60,
    })
    const emitSpy = ctx.eventBus.emit as ReturnType<typeof vi.fn>
    const server = buildServer(ctx)
    await server.inject({
      method: 'PATCH',
      url: `/api/v1/vitals/character/${CHAR_ID}`,
      headers: VITALS_JSON,
      body: JSON.stringify({ health: 75 }),
    })
    expect(emitSpy).not.toHaveBeenCalled()
  })

  it('does not emit event when body validation fails (400)', async () => {
    const ctx = makeMockCtx()
    const emitSpy = ctx.eventBus.emit as ReturnType<typeof vi.fn>
    const server = buildServer(ctx)
    await server.inject({
      method: 'PATCH',
      url: `/api/v1/vitals/character/${CHAR_ID}`,
      headers: VITALS_JSON,
      body: JSON.stringify({}),
    })
    expect(emitSpy).not.toHaveBeenCalled()
  })

  it('does not emit event on GET (read-only route)', async () => {
    const ctx = makeMockCtx()
    const emitSpy = ctx.eventBus.emit as ReturnType<typeof vi.fn>
    const server = buildServer(ctx)
    await server.inject({
      method: 'GET',
      url: `/api/v1/vitals/character/${CHAR_ID}`,
      headers: VITALS_AUTH,
    })
    expect(emitSpy).not.toHaveBeenCalled()
  })

  it('does not emit event when character is not found (404)', async () => {
    const ctx = makeMockCtx()
    ;(ctx.characters.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const emitSpy = ctx.eventBus.emit as ReturnType<typeof vi.fn>
    const server = buildServer(ctx)
    await server.inject({
      method: 'PATCH',
      url: `/api/v1/vitals/character/${CHAR_ID}`,
      headers: VITALS_JSON,
      body: JSON.stringify({ health: 75 }),
    })
    expect(emitSpy).not.toHaveBeenCalled()
  })

  it('does not emit event when character is inactive (403)', async () => {
    const ctx = makeMockCtx()
    ;(ctx.characters.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: CHAR_ID,
      accountId: ACCOUNT_ID,
      slot: 1,
      firstName: 'Test',
      lastName: 'Char',
      gender: 'male',
      dateOfBirth: null,
      nationality: null,
      metadata: {},
      status: 'inactive',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    const emitSpy = ctx.eventBus.emit as ReturnType<typeof vi.fn>
    const server = buildServer(ctx)
    await server.inject({
      method: 'PATCH',
      url: `/api/v1/vitals/character/${CHAR_ID}`,
      headers: VITALS_JSON,
      body: JSON.stringify({ health: 75 }),
    })
    expect(emitSpy).not.toHaveBeenCalled()
  })
})

// ── Phase 11: Status Effects routes ──────────────────────────────────────────

const SE_AUTH = { Authorization: 'Bearer test-secret-token' }
const SE_JSON = { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' }

const MOCK_EFFECT = {
  id: `status:${CHAR_ID}:fatigue`,
  characterId: CHAR_ID,
  type: 'fatigue',
  severity: 'medium',
  source: 'vitals',
  reason: 'Stamina critically low',
  startedAt: new Date().toISOString(),
  expiresAt: null,
}

describe('GET /api/v1/status-effects/character/:characterId', () => {
  it('returns 200 with empty effects array when none exist', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/status-effects/character/${CHAR_ID}`,
      headers: SE_AUTH,
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { characterId: string; effects: unknown[] }
    expect(body.characterId).toBe(CHAR_ID)
    expect(body.effects).toEqual([])
  })

  it('returns 200 with active effects', async () => {
    const ctx = makeMockCtx()
    ;(ctx.statusEffectsCache.list as ReturnType<typeof vi.fn>).mockResolvedValue([MOCK_EFFECT])
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/status-effects/character/${CHAR_ID}`,
      headers: SE_AUTH,
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { effects: unknown[] }
    expect(body.effects).toHaveLength(1)
  })

  it('returns 404 when character does not exist', async () => {
    const ctx = makeMockCtx()
    ;(ctx.characters.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/status-effects/character/${CHAR_ID}`,
      headers: SE_AUTH,
    })
    expect(res.statusCode).toBe(404)
    expect(ctx.statusEffectsCache.list).not.toHaveBeenCalled()
  })

  it('returns 403 when character is not active', async () => {
    const ctx = makeMockCtx()
    ;(ctx.characters.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: CHAR_ID, status: 'deleted',
    })
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/status-effects/character/${CHAR_ID}`,
      headers: SE_AUTH,
    })
    expect(res.statusCode).toBe(403)
  })

  it('returns 503 when Redis is unavailable', async () => {
    const ctx = makeMockCtx()
    ;(ctx.statusEffectsCache.list as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Redis down'))
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/status-effects/character/${CHAR_ID}`,
      headers: SE_AUTH,
    })
    expect(res.statusCode).toBe(503)
  })

  it('returns 400 for invalid characterId', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/status-effects/character/x',
      headers: SE_AUTH,
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /api/v1/status-effects/character/:characterId', () => {
  const validBody = {
    type: 'fatigue',
    severity: 'medium',
    source: 'vitals',
    reason: 'Stamina critically low',
  }

  it('returns 200 with the applied effect', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/status-effects/character/${CHAR_ID}`,
      headers: SE_JSON,
      body: JSON.stringify(validBody),
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { type: string; characterId: string; id: string }
    expect(body.type).toBe('fatigue')
    expect(body.characterId).toBe(CHAR_ID)
    expect(body.id).toBe(`status:${CHAR_ID}:fatigue`)
  })

  it('returns 200 with expiresAt set when durationSeconds provided', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/status-effects/character/${CHAR_ID}`,
      headers: SE_JSON,
      body: JSON.stringify({ ...validBody, durationSeconds: 3600 }),
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { expiresAt: string | null }
    expect(body.expiresAt).not.toBeNull()
  })

  it('emits atc:status:changed after successful apply', async () => {
    const ctx = makeMockCtx()
    const emitSpy = ctx.eventBus.emit as ReturnType<typeof vi.fn>
    const server = buildServer(ctx)
    await server.inject({
      method: 'POST',
      url: `/api/v1/status-effects/character/${CHAR_ID}`,
      headers: SE_JSON,
      body: JSON.stringify(validBody),
    })
    expect(emitSpy).toHaveBeenCalledOnce()
    const [eventName, payload] = emitSpy.mock.calls[0] as [string, { action: string; characterId: string }]
    expect(eventName).toBe('atc:status:changed')
    expect(payload.action).toBe('applied')
    expect(payload.characterId).toBe(CHAR_ID)
  })

  it('returns 400 for invalid type', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/status-effects/character/${CHAR_ID}`,
      headers: SE_JSON,
      body: JSON.stringify({ ...validBody, type: 'poisoned' }),
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when reason is too short', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/status-effects/character/${CHAR_ID}`,
      headers: SE_JSON,
      body: JSON.stringify({ ...validBody, reason: 'ab' }),
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 404 when character does not exist', async () => {
    const ctx = makeMockCtx()
    ;(ctx.characters.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/status-effects/character/${CHAR_ID}`,
      headers: SE_JSON,
      body: JSON.stringify(validBody),
    })
    expect(res.statusCode).toBe(404)
    expect(ctx.statusEffectsCache.apply).not.toHaveBeenCalled()
  })

  it('returns 403 when character is not active', async () => {
    const ctx = makeMockCtx()
    ;(ctx.characters.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: CHAR_ID, status: 'suspended',
    })
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/status-effects/character/${CHAR_ID}`,
      headers: SE_JSON,
      body: JSON.stringify(validBody),
    })
    expect(res.statusCode).toBe(403)
  })

  it('returns 503 when Redis is unavailable', async () => {
    const ctx = makeMockCtx()
    ;(ctx.statusEffectsCache.apply as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Redis down'))
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/status-effects/character/${CHAR_ID}`,
      headers: SE_JSON,
      body: JSON.stringify(validBody),
    })
    expect(res.statusCode).toBe(503)
  })
})

describe('DELETE /api/v1/status-effects/character/:characterId/:type', () => {
  it('returns 204 on successful clear', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'DELETE',
      url: `/api/v1/status-effects/character/${CHAR_ID}/fatigue`,
      headers: SE_AUTH,
    })
    expect(res.statusCode).toBe(204)
    expect(ctx.statusEffectsCache.clear).toHaveBeenCalledWith(CHAR_ID, 'fatigue')
  })

  it('emits atc:status:changed after successful clear', async () => {
    const ctx = makeMockCtx()
    const emitSpy = ctx.eventBus.emit as ReturnType<typeof vi.fn>
    const server = buildServer(ctx)
    await server.inject({
      method: 'DELETE',
      url: `/api/v1/status-effects/character/${CHAR_ID}/fatigue`,
      headers: SE_AUTH,
    })
    expect(emitSpy).toHaveBeenCalledOnce()
    const [eventName, payload] = emitSpy.mock.calls[0] as [string, { action: string }]
    expect(eventName).toBe('atc:status:changed')
    expect(payload.action).toBe('cleared')
  })

  it('returns 400 for invalid type param', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'DELETE',
      url: `/api/v1/status-effects/character/${CHAR_ID}/poisoned`,
      headers: SE_AUTH,
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 404 when character does not exist', async () => {
    const ctx = makeMockCtx()
    ;(ctx.characters.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'DELETE',
      url: `/api/v1/status-effects/character/${CHAR_ID}/fatigue`,
      headers: SE_AUTH,
    })
    expect(res.statusCode).toBe(404)
    expect(ctx.statusEffectsCache.clear).not.toHaveBeenCalled()
  })

  it('returns 503 when Redis is unavailable', async () => {
    const ctx = makeMockCtx()
    ;(ctx.statusEffectsCache.clear as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Redis down'))
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'DELETE',
      url: `/api/v1/status-effects/character/${CHAR_ID}/fatigue`,
      headers: SE_AUTH,
    })
    expect(res.statusCode).toBe(503)
  })
})

describe('DELETE /api/v1/status-effects/character/:characterId', () => {
  it('returns 204 on successful clearAll', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'DELETE',
      url: `/api/v1/status-effects/character/${CHAR_ID}`,
      headers: SE_AUTH,
    })
    expect(res.statusCode).toBe(204)
    expect(ctx.statusEffectsCache.clearAll).toHaveBeenCalledWith(CHAR_ID)
  })

  it('returns 404 when character does not exist', async () => {
    const ctx = makeMockCtx()
    ;(ctx.characters.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'DELETE',
      url: `/api/v1/status-effects/character/${CHAR_ID}`,
      headers: SE_AUTH,
    })
    expect(res.statusCode).toBe(404)
    expect(ctx.statusEffectsCache.clearAll).not.toHaveBeenCalled()
  })

  it('returns 503 when Redis is unavailable', async () => {
    const ctx = makeMockCtx()
    ;(ctx.statusEffectsCache.clearAll as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Redis down'))
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'DELETE',
      url: `/api/v1/status-effects/character/${CHAR_ID}`,
      headers: SE_AUTH,
    })
    expect(res.statusCode).toBe(503)
  })

  it('emits atc:status:changed with action cleared_all after clearAll', async () => {
    const ctx = makeMockCtx()
    const emitSpy = ctx.eventBus.emit as ReturnType<typeof vi.fn>
    const server = buildServer(ctx)
    await server.inject({
      method: 'DELETE',
      url: `/api/v1/status-effects/character/${CHAR_ID}`,
      headers: SE_AUTH,
    })
    expect(emitSpy).toHaveBeenCalledOnce()
    const [eventName, payload] = emitSpy.mock.calls[0] as [string, { action: string; type?: string }]
    expect(eventName).toBe('atc:status:changed')
    expect(payload.action).toBe('cleared_all')
    expect(payload.type).toBeUndefined()
  })
})

// ── Phase 12: Metrics endpoints ───────────────────────────────────────────────

const METRICS_AUTH = { Authorization: 'Bearer test-secret-token' }

describe('GET /api/v1/metrics/eventbus', () => {
  it('returns 200 with eventbus metrics shape', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({ method: 'GET', url: '/api/v1/metrics/eventbus', headers: METRICS_AUTH })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as Record<string, unknown>
    expect(typeof body['emittedTotal']).toBe('number')
    expect(typeof body['handledTotal']).toBe('number')
    expect(typeof body['failedTotal']).toBe('number')
    expect(typeof body['avgDurationMs']).toBe('number')
    expect(typeof body['activeSubscribers']).toBe('number')
    expect(typeof body['metricsEnabled']).toBe('boolean')
  })

  it('returns 401 without auth token', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({ method: 'GET', url: '/api/v1/metrics/eventbus' })
    expect(res.statusCode).toBe(401)
  })

  it('does not expose secrets or internal connection details', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({ method: 'GET', url: '/api/v1/metrics/eventbus', headers: METRICS_AUTH })
    const body = res.body
    expect(body).not.toMatch(/password|secret|token|key/i)
  })
})

describe('GET /api/v1/metrics/plugins', () => {
  it('returns 200 with plugins array', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({ method: 'GET', url: '/api/v1/metrics/plugins', headers: METRICS_AUTH })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { plugins: unknown[] }
    expect(Array.isArray(body.plugins)).toBe(true)
  })

  it('returns 401 without auth token', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({ method: 'GET', url: '/api/v1/metrics/plugins' })
    expect(res.statusCode).toBe(401)
  })
})

describe('GET /api/v1/metrics/runtime', () => {
  it('returns 200 with runtime shape', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({ method: 'GET', url: '/api/v1/metrics/runtime', headers: METRICS_AUTH })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as Record<string, unknown>
    expect(typeof body['uptimeSeconds']).toBe('number')
    expect(body['memoryUsage']).toBeDefined()
    const mem = body['memoryUsage'] as Record<string, unknown>
    expect(typeof mem['heapUsedBytes']).toBe('number')
    expect(typeof mem['heapTotalBytes']).toBe('number')
    expect(typeof mem['rssBytes']).toBe('number')
  })

  it('returns 401 without auth token', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({ method: 'GET', url: '/api/v1/metrics/runtime' })
    expect(res.statusCode).toBe(401)
  })

  it('does not expose secrets or credentials in runtime metrics', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({ method: 'GET', url: '/api/v1/metrics/runtime', headers: METRICS_AUTH })
    const body = res.body
    expect(body).not.toMatch(/password|secret|api.?key|token/i)
  })
})

describe('GET /api/v1/runtime/tasks', () => {
  it('returns 200 with task metrics shape', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({ method: 'GET', url: '/api/v1/runtime/tasks', headers: METRICS_AUTH })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as Record<string, unknown>
    expect(typeof body['queuedTotal']).toBe('number')
    expect(typeof body['completedTotal']).toBe('number')
    expect(typeof body['failedTotal']).toBe('number')
    expect(typeof body['retriedTotal']).toBe('number')
    expect(typeof body['avgRuntimeMs']).toBe('number')
    expect(Array.isArray(body['queues'])).toBe(true)
  })

  it('returns 401 without auth token', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({ method: 'GET', url: '/api/v1/runtime/tasks' })
    expect(res.statusCode).toBe(401)
  })

  it('does not expose secrets or credentials in task metrics', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({ method: 'GET', url: '/api/v1/runtime/tasks', headers: METRICS_AUTH })
    expect(res.body).not.toMatch(/password|secret|api.?key/i)
  })
})

describe('GET /api/v1/runtime/workers', () => {
  it('returns 200 with workers shape', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({ method: 'GET', url: '/api/v1/runtime/workers', headers: METRICS_AUTH })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as Record<string, unknown>
    expect(typeof body['activeWorkers']).toBe('number')
    expect(Array.isArray(body['workers'])).toBe(true)
  })

  it('returns 401 without auth token', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({ method: 'GET', url: '/api/v1/runtime/workers' })
    expect(res.statusCode).toBe(401)
  })

  it('does not expose secrets or credentials in worker metrics', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({ method: 'GET', url: '/api/v1/runtime/workers', headers: METRICS_AUTH })
    expect(res.body).not.toMatch(/password|secret|api.?key/i)
  })
})

describe('GET /api/v1/runtime/queues', () => {
  it('returns 200 with queues and eventStreams shape', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({ method: 'GET', url: '/api/v1/runtime/queues', headers: METRICS_AUTH })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as Record<string, unknown>
    expect(Array.isArray(body['queues'])).toBe(true)
    expect(Array.isArray(body['eventStreams'])).toBe(true)
  })

  it('returns 401 without auth token', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({ method: 'GET', url: '/api/v1/runtime/queues' })
    expect(res.statusCode).toBe(401)
  })

  it('does not expose secrets or credentials in queue metrics', async () => {
    const ctx = makeMockCtx()
    const server = buildServer(ctx)
    const res = await server.inject({ method: 'GET', url: '/api/v1/runtime/queues', headers: METRICS_AUTH })
    expect(res.body).not.toMatch(/password|secret|api.?key/i)
  })
})

const OPS_AUTH = { Authorization: 'Bearer test-secret-token' }
const OPS_JSON = { Authorization: 'Bearer test-secret-token', 'Content-Type': 'application/json' }

describe('GET /api/v1/ops/live', () => {
  it('returns 200 without auth token (unauthenticated probe)', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({ method: 'GET', url: '/api/v1/ops/live' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ status: 'ok' })
  })

  it('returns 200 even with a valid auth token', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({ method: 'GET', url: '/api/v1/ops/live', headers: OPS_AUTH })
    expect(res.statusCode).toBe(200)
  })
})

describe('GET /api/v1/ops/ready', () => {
  it('returns 200 when db and redis are healthy (unauthenticated)', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({ method: 'GET', url: '/api/v1/ops/ready' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ status: 'ready' })
  })

  it('returns 503 when db ping fails', async () => {
    const ctx = makeMockCtx({
      pool: {
        getConnection: vi.fn().mockRejectedValue(new Error('DB down')),
      } as unknown as AppContext['pool'],
    })
    const server = buildServer(ctx)
    const res = await server.inject({ method: 'GET', url: '/api/v1/ops/ready' })
    expect(res.statusCode).toBe(503)
    expect(JSON.parse(res.body)).toEqual({ status: 'not_ready' })
  })

  it('returns 503 when redis ping fails', async () => {
    const ctx = makeMockCtx({
      redis: {
        ping: vi.fn().mockRejectedValue(new Error('Redis down')),
      } as unknown as AppContext['redis'],
    })
    const server = buildServer(ctx)
    const res = await server.inject({ method: 'GET', url: '/api/v1/ops/ready' })
    expect(res.statusCode).toBe(503)
  })

  it('does not expose secrets in the readiness response', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({ method: 'GET', url: '/api/v1/ops/ready' })
    expect(res.body).not.toMatch(/password|secret|api.?key/i)
  })
})

describe('GET /api/v1/ops/health', () => {
  it('returns 200 with full health snapshot shape', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({ method: 'GET', url: '/api/v1/ops/health', headers: OPS_AUTH })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as Record<string, unknown>
    expect(typeof body['status']).toBe('string')
    expect(typeof body['subsystems']).toBe('object')
    expect(typeof body['checkedAt']).toBe('string')
  })

  it('returns 401 without auth token', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({ method: 'GET', url: '/api/v1/ops/health' })
    expect(res.statusCode).toBe(401)
  })

  it('includes api subsystem in snapshot', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({ method: 'GET', url: '/api/v1/ops/health', headers: OPS_AUTH })
    const body = JSON.parse(res.body) as Record<string, unknown>
    const subs = body['subsystems'] as Record<string, unknown>
    expect(subs['api']).toBeDefined()
  })
})

describe('GET /api/v1/ops/diagnostics', () => {
  it('returns 200 with diagnostics shape', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({ method: 'GET', url: '/api/v1/ops/diagnostics', headers: OPS_AUTH })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as Record<string, unknown>
    expect(typeof body['status']).toBe('string')
    expect(body['taskRuntime']).toBeDefined()
    expect(Array.isArray(body['eventStreams'])).toBe(true)
  })

  it('returns 401 without auth', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({ method: 'GET', url: '/api/v1/ops/diagnostics' })
    expect(res.statusCode).toBe(401)
  })
})

describe('GET /api/v1/ops/tasks/dead-letter', () => {
  it('returns 200 with paginated DLQ shape', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({ method: 'GET', url: '/api/v1/ops/tasks/dead-letter', headers: OPS_AUTH })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as Record<string, unknown>
    expect(Array.isArray(body['items'])).toBe(true)
    expect(typeof body['total']).toBe('number')
  })

  it('returns 401 without auth', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({ method: 'GET', url: '/api/v1/ops/tasks/dead-letter' })
    expect(res.statusCode).toBe(401)
  })

  it('rejects invalid limit param', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({ method: 'GET', url: '/api/v1/ops/tasks/dead-letter?limit=999', headers: OPS_AUTH })
    expect(res.statusCode).toBe(500)
  })
})

describe('POST /api/v1/ops/tasks/requeue', () => {
  it('returns 404 when task is not in DLQ', async () => {
    const server = buildServer(makeMockCtx())
    const taskId = '00000000-0000-7000-8000-000000000001'
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/ops/tasks/requeue',
      headers: OPS_JSON,
      body: JSON.stringify({ taskId }),
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 200 when task is requeued', async () => {
    const taskId = '00000000-0000-7000-8000-000000000002'
    const ctx = makeMockCtx({
      taskRuntime: {
        ...makeMockCtx().taskRuntime,
        requeueDeadLetterTask: vi.fn().mockResolvedValue(true),
      } as unknown as AppContext['taskRuntime'],
    })
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/ops/tasks/requeue',
      headers: OPS_JSON,
      body: JSON.stringify({ taskId }),
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toMatchObject({ taskId, requeued: true })
  })

  it('returns 401 without auth', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/ops/tasks/requeue',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: '00000000-0000-7000-8000-000000000003' }),
    })
    expect(res.statusCode).toBe(401)
  })

  it('rejects non-UUID taskId', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/ops/tasks/requeue',
      headers: OPS_JSON,
      body: JSON.stringify({ taskId: 'not-a-uuid' }),
    })
    expect(res.statusCode).toBe(500)
  })
})

describe('GET /api/v1/ops/events', () => {
  it('returns 200 with event page shape', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({ method: 'GET', url: '/api/v1/ops/events', headers: OPS_AUTH })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as Record<string, unknown>
    expect(Array.isArray(body['events'])).toBe(true)
  })

  it('returns 401 without auth', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({ method: 'GET', url: '/api/v1/ops/events' })
    expect(res.statusCode).toBe(401)
  })
})

describe('GET /api/v1/ops/plugins/health', () => {
  it('returns 200 with plugin health array', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({ method: 'GET', url: '/api/v1/ops/plugins/health', headers: OPS_AUTH })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as Record<string, unknown>
    expect(typeof body['total']).toBe('number')
    expect(Array.isArray(body['plugins'])).toBe(true)
  })

  it('returns 401 without auth', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({ method: 'GET', url: '/api/v1/ops/plugins/health' })
    expect(res.statusCode).toBe(401)
  })

  it('does not expose secrets in plugin health response', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({ method: 'GET', url: '/api/v1/ops/plugins/health', headers: OPS_AUTH })
    expect(res.body).not.toMatch(/password|secret|api.?key/i)
  })
})

describe('GET /api/v1/ops/nodes', () => {
  it('returns 200 with nodes array (no runtimeNode in ctx)', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({ method: 'GET', url: '/api/v1/ops/nodes', headers: OPS_AUTH })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { total: number; nodes: unknown[] }
    expect(body.total).toBe(0)
    expect(Array.isArray(body.nodes)).toBe(true)
  })

  it('returns nodes from runtimeNode.listNodes() when configured', async () => {
    const mockNode = {
      instanceId: 'node-1',
      hostname: 'host-a',
      pid: 1234,
      startedAt: new Date().toISOString(),
      capabilities: ['api'],
      version: '22.0.0',
      isStale: false,
      lastHeartbeatAt: new Date().toISOString(),
    }
    const server = buildServer(makeMockCtx({
      runtimeNode: {
        listNodes: vi.fn().mockResolvedValue([mockNode]),
      } as unknown as AtcRuntimeNodeService,
    }))
    const res = await server.inject({ method: 'GET', url: '/api/v1/ops/nodes', headers: OPS_AUTH })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { total: number; nodes: unknown[] }
    expect(body.total).toBe(1)
    expect(body.nodes).toHaveLength(1)
  })

  it('returns 401 without auth', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({ method: 'GET', url: '/api/v1/ops/nodes' })
    expect(res.statusCode).toBe(401)
  })
})

describe('GET /api/v1/ops/cluster', () => {
  it('returns 200 with cluster snapshot (no runtimeNode, no leaderElection)', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({ method: 'GET', url: '/api/v1/ops/cluster', headers: OPS_AUTH })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as Record<string, unknown>
    expect(body['leader']).toBeNull()
    expect(body['totalNodes']).toBe(0)
    expect(Array.isArray(body['nodes'])).toBe(true)
    expect(typeof body['schedulerRunning']).toBe('boolean')
    expect(typeof body['capturedAt']).toBe('string')
  })

  it('includes leader from leaderElection.getLeader() when configured', async () => {
    const server = buildServer(makeMockCtx({
      leaderElection: {
        getLeader: vi.fn().mockResolvedValue('node-leader-1'),
      } as unknown as AtcSchedulerLeaderElection,
    }))
    const res = await server.inject({ method: 'GET', url: '/api/v1/ops/cluster', headers: OPS_AUTH })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { leader: string | null }
    expect(body.leader).toBe('node-leader-1')
  })

  it('includes staleNodes count', async () => {
    const staleNode = {
      instanceId: 'stale-node', hostname: 'h', pid: 1, startedAt: '',
      capabilities: [], version: '', isStale: true, lastHeartbeatAt: null,
    }
    const server = buildServer(makeMockCtx({
      runtimeNode: {
        listNodes: vi.fn().mockResolvedValue([staleNode]),
      } as unknown as AtcRuntimeNodeService,
    }))
    const res = await server.inject({ method: 'GET', url: '/api/v1/ops/cluster', headers: OPS_AUTH })
    const body = JSON.parse(res.body) as { staleNodes: number }
    expect(body.staleNodes).toBe(1)
  })

  it('includes worker counts from taskRuntime.getWorkerMetrics()', async () => {
    const ctx = makeMockCtx()
    ;(ctx.taskRuntime.getWorkerMetrics as ReturnType<typeof vi.fn>).mockReturnValue([
      { workerId: 'w1', isRunning: true },
      { workerId: 'w2', isRunning: false },
    ])
    const server = buildServer(ctx)
    const res = await server.inject({ method: 'GET', url: '/api/v1/ops/cluster', headers: OPS_AUTH })
    const body = JSON.parse(res.body) as { totalWorkers: number; activeWorkers: number }
    expect(body.totalWorkers).toBe(2)
    expect(body.activeWorkers).toBe(1)
  })

  it('returns 401 without auth', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({ method: 'GET', url: '/api/v1/ops/cluster' })
    expect(res.statusCode).toBe(401)
  })
})

describe('GET /api/v1/ops/plugins', () => {
  it('returns 200 with plugins array (no containers in ctx)', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({ method: 'GET', url: '/api/v1/ops/plugins', headers: OPS_AUTH })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { total: number; plugins: unknown[] }
    expect(typeof body.total).toBe('number')
    expect(Array.isArray(body.plugins)).toBe(true)
  })

  it('returns 401 without auth', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({ method: 'GET', url: '/api/v1/ops/plugins' })
    expect(res.statusCode).toBe(401)
  })
})

describe('GET /api/v1/ops/plugins/:pluginId', () => {
  it('returns 404 for unknown plugin', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({ method: 'GET', url: '/api/v1/ops/plugins/no-such-plugin', headers: OPS_AUTH })
    expect(res.statusCode).toBe(404)
  })

  it('returns 401 without auth', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({ method: 'GET', url: '/api/v1/ops/plugins/no-such-plugin' })
    expect(res.statusCode).toBe(401)
  })
})

describe('POST /api/v1/ops/plugins/:pluginId/start', () => {
  it('returns 200 when plugin lifecycle.start succeeds', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({ method: 'POST', url: '/api/v1/ops/plugins/my-plugin/start', headers: OPS_AUTH })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { pluginId: string; action: string; ok: boolean }
    expect(body.action).toBe('start')
    expect(body.ok).toBe(true)
  })

  it('returns 401 without auth', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({ method: 'POST', url: '/api/v1/ops/plugins/my-plugin/start' })
    expect(res.statusCode).toBe(401)
  })
})

describe('POST /api/v1/ops/plugins/:pluginId/stop', () => {
  it('returns 200 when plugin lifecycle.stop succeeds', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({ method: 'POST', url: '/api/v1/ops/plugins/my-plugin/stop', headers: OPS_AUTH })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { pluginId: string; action: string; ok: boolean }
    expect(body.action).toBe('stop')
    expect(body.ok).toBe(true)
  })

  it('returns 401 without auth', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({ method: 'POST', url: '/api/v1/ops/plugins/my-plugin/stop' })
    expect(res.statusCode).toBe(401)
  })
})

describe('POST /api/v1/ops/plugins/:pluginId/restart', () => {
  it('returns 200 when plugin lifecycle.reload succeeds', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({ method: 'POST', url: '/api/v1/ops/plugins/my-plugin/restart', headers: OPS_AUTH })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { pluginId: string; action: string; ok: boolean }
    expect(body.action).toBe('restart')
    expect(body.ok).toBe(true)
  })

  it('returns 401 without auth', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({ method: 'POST', url: '/api/v1/ops/plugins/my-plugin/restart' })
    expect(res.statusCode).toBe(401)
  })
})

describe('POST /api/v1/ops/plugins/:pluginId/reload', () => {
  it('returns 200 when plugin lifecycle.reload succeeds', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({ method: 'POST', url: '/api/v1/ops/plugins/my-plugin/reload', headers: OPS_AUTH })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { pluginId: string; action: string; ok: boolean }
    expect(body.action).toBe('reload')
    expect(body.ok).toBe(true)
  })

  it('returns 401 without auth', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({ method: 'POST', url: '/api/v1/ops/plugins/my-plugin/reload' })
    expect(res.statusCode).toBe(401)
  })
})

// ── Security Routes ────────────────────────────────────────────────────────────

const SEC_AUTH = { Authorization: 'Bearer test-secret-token' }

function makeMockPrincipalStore(
  overrides: {
    principals?: Partial<PrincipalStore['principals']>
    roleAssignments?: Partial<PrincipalStore['roleAssignments']>
    capabilities?: Partial<PrincipalStore['capabilities']>
    securityEvents?: Partial<PrincipalStore['securityEvents']>
  } = {},
): PrincipalStore {
  const stored = { id: 'p-1', type: 'account' as const, status: 'active' as const, displayName: 'Test', accountId: null, trustLevel: null, directPermissions: [], directDenies: [], metadata: null, createdAt: new Date(), updatedAt: new Date() }
  return {
    principals: {
      create: vi.fn().mockResolvedValue(stored),
      findById: vi.fn().mockResolvedValue(stored),
      findByAccountId: vi.fn().mockResolvedValue(null),
      list: vi.fn().mockResolvedValue({ items: [], total: 0, offset: 0, limit: 20 }),
      update: vi.fn().mockResolvedValue(stored),
      disable: vi.fn().mockResolvedValue(true),
      resolve: vi.fn().mockResolvedValue(null),
      ...overrides.principals,
    } as unknown as PrincipalStore['principals'],
    roleAssignments: {
      assign: vi.fn().mockResolvedValue({ id: 'ra-1', principalId: 'p-1', roleId: 'player', assignedBy: 'system', assignedAt: new Date(), expiresAt: null }),
      revoke: vi.fn().mockResolvedValue(true),
      listByPrincipal: vi.fn().mockResolvedValue([]),
      find: vi.fn().mockResolvedValue(null),
      ...overrides.roleAssignments,
    } as unknown as PrincipalStore['roleAssignments'],
    capabilities: {
      grant: vi.fn().mockResolvedValue({ id: 'ca-1', principalId: 'p-1', capability: 'ops.read', grantedBy: 'system', grantedAt: new Date(), expiresAt: null }),
      revoke: vi.fn().mockResolvedValue(true),
      listByPrincipal: vi.fn().mockResolvedValue([]),
      has: vi.fn().mockResolvedValue(false),
      ...overrides.capabilities,
    } as unknown as PrincipalStore['capabilities'],
    securityEvents: {
      append: vi.fn().mockResolvedValue({ id: 'se-1', actorId: 'system', actorType: 'system' as const, action: '', target: null, result: 'granted' as const, sourceInstanceId: null, metadata: null, createdAt: new Date() }),
      list: vi.fn().mockResolvedValue({ events: [], total: 0, offset: 0, limit: 50 }),
      ...overrides.securityEvents,
    } as unknown as PrincipalStore['securityEvents'],
  }
}

describe('GET /api/v1/security/roles', () => {
  it('returns 200 with built-in roles list', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({ method: 'GET', url: '/api/v1/security/roles', headers: SEC_AUTH })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { total: number; roles: { id: string }[] }
    expect(body.total).toBe(8)
    expect(body.roles.some((r) => r.id === 'super_admin')).toBe(true)
    expect(body.roles.some((r) => r.id === 'player')).toBe(true)
  })

  it('returns 401 without auth', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({ method: 'GET', url: '/api/v1/security/roles' })
    expect(res.statusCode).toBe(401)
  })
})

describe('GET /api/v1/security/principals', () => {
  it('returns 200 with empty list when no principal store configured', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({ method: 'GET', url: '/api/v1/security/principals', headers: SEC_AUTH })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { total: number; principals: unknown[] }
    expect(body.total).toBe(0)
    expect(body.principals).toHaveLength(0)
  })

  it('returns 400 for invalid limit', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({
      method: 'GET', url: '/api/v1/security/principals?limit=-1', headers: SEC_AUTH,
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 200 with principal list from store', async () => {
    const stored = { id: 'p-1', type: 'account', status: 'active', displayName: 'Test User', accountId: null, trustLevel: null, directPermissions: [], directDenies: [], metadata: null, createdAt: new Date(), updatedAt: new Date() }
    const principalStore = makeMockPrincipalStore({
      principals: { list: vi.fn().mockResolvedValue({ items: [stored], total: 1, offset: 0, limit: 20 }) },
    })
    const server = buildServer(makeMockCtx({ principalStore }))
    const res = await server.inject({ method: 'GET', url: '/api/v1/security/principals', headers: SEC_AUTH })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { total: number }
    expect(body.total).toBe(1)
  })

  it('returns 401 without auth', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({ method: 'GET', url: '/api/v1/security/principals' })
    expect(res.statusCode).toBe(401)
  })
})

describe('GET /api/v1/security/audit', () => {
  it('returns 200 with empty events when no auditService configured', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({ method: 'GET', url: '/api/v1/security/audit', headers: SEC_AUTH })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { events: unknown[]; total: number }
    expect(body.events).toHaveLength(0)
    expect(body.total).toBe(0)
  })

  it('returns 200 with audit events when auditService is configured', async () => {
    const { AtcAuditService } = await import('@atc/audit')
    const auditService = new AtcAuditService()
    auditService.append({ actorId: 'u-1', actorType: 'account', action: 'player.read', result: 'granted' })
    const server = buildServer(makeMockCtx({ auditService }))
    const res = await server.inject({ method: 'GET', url: '/api/v1/security/audit', headers: SEC_AUTH })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { events: { actorId: string }[]; total: number }
    expect(body.total).toBe(1)
    expect(body.events[0]?.actorId).toBe('u-1')
  })

  it('returns 400 for invalid result filter (must be granted|denied|error)', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/security/audit?result=invalid_value',
      headers: SEC_AUTH,
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for negative limit', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/security/audit?limit=-5',
      headers: SEC_AUTH,
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 401 without auth', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({ method: 'GET', url: '/api/v1/security/audit' })
    expect(res.statusCode).toBe(401)
  })
})

describe('POST /api/v1/security/authorize', () => {
  const validBody = {
    principalId: 'u-1',
    principalType: 'account',
    roles: ['player'],
    permissions: [],
    capabilities: [],
    denies: [],
    permission: 'player.read',
  }

  it('returns 503 when authEngine is not configured', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/security/authorize',
      headers: { ...SEC_AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    expect(res.statusCode).toBe(503)
  })

  it('returns 200 with authorization result when authEngine is configured', async () => {
    const { AtcAuthorizationEngine, BUILT_IN_ROLES } = await import('@atc/iam')
    const authEngine = new AtcAuthorizationEngine(BUILT_IN_ROLES)
    const server = buildServer(makeMockCtx({ authEngine }))
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/security/authorize',
      headers: { ...SEC_AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { authorized: boolean; principalId: string }
    expect(typeof body.authorized).toBe('boolean')
    expect(body.principalId).toBe('u-1')
  })

  it('returns 400 for invalid body', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/security/authorize',
      headers: { ...SEC_AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ invalid: true }),
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when roles array exceeds 50 items', async () => {
    const server = buildServer(makeMockCtx())
    const oversized = { ...validBody, roles: Array.from({ length: 51 }, (_, i) => `role-${i}`) }
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/security/authorize',
      headers: { ...SEC_AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify(oversized),
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when principalId is empty string', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/security/authorize',
      headers: { ...SEC_AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validBody, principalId: '' }),
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 401 without auth', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({ method: 'POST', url: '/api/v1/security/authorize' })
    expect(res.statusCode).toBe(401)
  })
})

describe('POST /api/v1/security/capabilities/check', () => {
  const validBody = {
    principalId: 'svc-1',
    principalType: 'service',
    roles: ['service'],
    permissions: [],
    capabilities: [],
    denies: [],
    capability: 'ops.read',
  }

  it('returns 503 when authEngine is not configured', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/security/capabilities/check',
      headers: { ...SEC_AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    expect(res.statusCode).toBe(503)
  })

  it('returns 200 with capability result when authEngine is configured', async () => {
    const { AtcAuthorizationEngine, BUILT_IN_ROLES } = await import('@atc/iam')
    const authEngine = new AtcAuthorizationEngine(BUILT_IN_ROLES)
    const server = buildServer(makeMockCtx({ authEngine }))
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/security/capabilities/check',
      headers: { ...SEC_AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { authorized: boolean; principalId: string; action: string }
    expect(typeof body.authorized).toBe('boolean')
    expect(body.principalId).toBe('svc-1')
    expect(body.action).toBe('ops.read')
  })

  it('appends to auditService when both are configured', async () => {
    const { AtcAuthorizationEngine, BUILT_IN_ROLES } = await import('@atc/iam')
    const { AtcAuditService } = await import('@atc/audit')
    const authEngine = new AtcAuthorizationEngine(BUILT_IN_ROLES)
    const auditService = new AtcAuditService()
    const server = buildServer(makeMockCtx({ authEngine, auditService }))
    await server.inject({
      method: 'POST',
      url: '/api/v1/security/capabilities/check',
      headers: { ...SEC_AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    expect(auditService.size()).toBe(1)
  })

  it('returns 400 for invalid body', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/security/capabilities/check',
      headers: { ...SEC_AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ missing: 'everything' }),
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 401 without auth', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({ method: 'POST', url: '/api/v1/security/capabilities/check' })
    expect(res.statusCode).toBe(401)
  })
})

// ── Principal Management API (Phase 20) ────────────────────────────────────────

describe('POST /api/v1/security/principals', () => {
  const validBody = { type: 'account', displayName: 'Test User' }

  it('returns 503 when principal store not configured', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({
      method: 'POST', url: '/api/v1/security/principals',
      headers: { ...SEC_AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    expect(res.statusCode).toBe(503)
  })

  it('returns 201 with created principal when store is configured', async () => {
    const principalStore = makeMockPrincipalStore()
    const server = buildServer(makeMockCtx({ principalStore }))
    const res = await server.inject({
      method: 'POST', url: '/api/v1/security/principals',
      headers: { ...SEC_AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body) as { id: string }
    expect(body.id).toBe('p-1')
  })

  it('returns 400 for missing displayName', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({
      method: 'POST', url: '/api/v1/security/principals',
      headers: { ...SEC_AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'account' }),
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for invalid type', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({
      method: 'POST', url: '/api/v1/security/principals',
      headers: { ...SEC_AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'robot', displayName: 'Test' }),
    })
    expect(res.statusCode).toBe(400)
  })

  it('emits PRINCIPAL_CREATED event on success', async () => {
    const principalStore = makeMockPrincipalStore()
    const ctx = makeMockCtx({ principalStore })
    const server = buildServer(ctx)
    await server.inject({
      method: 'POST', url: '/api/v1/security/principals',
      headers: { ...SEC_AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    expect(ctx.eventBus.emit).toHaveBeenCalledWith(
      'atc:security:principal:created',
      expect.objectContaining({ principalId: 'p-1' }),
    )
  })
})

describe('GET /api/v1/security/principals/:id', () => {
  it('returns 503 when principal store not configured', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({
      method: 'GET', url: '/api/v1/security/principals/p-1', headers: SEC_AUTH,
    })
    expect(res.statusCode).toBe(503)
  })

  it('returns 404 when principal not found', async () => {
    const principalStore = makeMockPrincipalStore({
      principals: { findById: vi.fn().mockResolvedValue(null) },
    })
    const server = buildServer(makeMockCtx({ principalStore }))
    const res = await server.inject({
      method: 'GET', url: '/api/v1/security/principals/not-exist', headers: SEC_AUTH,
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 200 with stored principal', async () => {
    const principalStore = makeMockPrincipalStore()
    const server = buildServer(makeMockCtx({ principalStore }))
    const res = await server.inject({
      method: 'GET', url: '/api/v1/security/principals/p-1', headers: SEC_AUTH,
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { id: string }
    expect(body.id).toBe('p-1')
  })
})

describe('PUT /api/v1/security/principals/:id', () => {
  it('returns 503 when principal store not configured', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({
      method: 'PUT', url: '/api/v1/security/principals/p-1',
      headers: { ...SEC_AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'New Name' }),
    })
    expect(res.statusCode).toBe(503)
  })

  it('returns 404 when principal not found', async () => {
    const principalStore = makeMockPrincipalStore({
      principals: { update: vi.fn().mockResolvedValue(null) },
    })
    const server = buildServer(makeMockCtx({ principalStore }))
    const res = await server.inject({
      method: 'PUT', url: '/api/v1/security/principals/not-exist',
      headers: { ...SEC_AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'New' }),
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 200 on success and invalidates cache', async () => {
    const principalStore = makeMockPrincipalStore()
    const iamCache = { getPrincipal: vi.fn().mockResolvedValue(null), setPrincipal: vi.fn(), invalidatePrincipal: vi.fn(), getResolved: vi.fn(), setResolved: vi.fn(), invalidateResolved: vi.fn() }
    const server = buildServer(makeMockCtx({ principalStore, iamCache: iamCache as unknown as AtcIamCache }))
    const res = await server.inject({
      method: 'PUT', url: '/api/v1/security/principals/p-1',
      headers: { ...SEC_AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'New Name' }),
    })
    expect(res.statusCode).toBe(200)
    expect(iamCache.invalidatePrincipal).toHaveBeenCalledWith('p-1')
  })

  it('returns 400 for displayName longer than 256 chars', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({
      method: 'PUT', url: '/api/v1/security/principals/p-1',
      headers: { ...SEC_AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'x'.repeat(257) }),
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /api/v1/security/principals/:id/disable', () => {
  it('returns 503 when principal store not configured', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({
      method: 'POST', url: '/api/v1/security/principals/p-1/disable', headers: SEC_AUTH,
    })
    expect(res.statusCode).toBe(503)
  })

  it('returns 404 when principal not found or already disabled', async () => {
    const principalStore = makeMockPrincipalStore({
      principals: { disable: vi.fn().mockResolvedValue(false) },
    })
    const server = buildServer(makeMockCtx({ principalStore }))
    const res = await server.inject({
      method: 'POST', url: '/api/v1/security/principals/p-1/disable', headers: SEC_AUTH,
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 200 and emits PRINCIPAL_DISABLED event', async () => {
    const principalStore = makeMockPrincipalStore()
    const ctx = makeMockCtx({ principalStore })
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST', url: '/api/v1/security/principals/p-1/disable', headers: SEC_AUTH,
    })
    expect(res.statusCode).toBe(200)
    expect(ctx.eventBus.emit).toHaveBeenCalledWith(
      'atc:security:principal:disabled',
      expect.objectContaining({ principalId: 'p-1' }),
    )
  })
})

describe('POST /api/v1/security/principals/:id/roles', () => {
  const roleBody = { roleId: 'moderator', assignedBy: 'admin-1' }

  it('returns 503 when principal store not configured', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({
      method: 'POST', url: '/api/v1/security/principals/p-1/roles',
      headers: { ...SEC_AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify(roleBody),
    })
    expect(res.statusCode).toBe(503)
  })

  it('returns 404 when principal not found', async () => {
    const principalStore = makeMockPrincipalStore({
      principals: { findById: vi.fn().mockResolvedValue(null) },
    })
    const server = buildServer(makeMockCtx({ principalStore }))
    const res = await server.inject({
      method: 'POST', url: '/api/v1/security/principals/p-1/roles',
      headers: { ...SEC_AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify(roleBody),
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 201 and emits ROLE_ASSIGNED event', async () => {
    const principalStore = makeMockPrincipalStore()
    const ctx = makeMockCtx({ principalStore })
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST', url: '/api/v1/security/principals/p-1/roles',
      headers: { ...SEC_AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify(roleBody),
    })
    expect(res.statusCode).toBe(201)
    expect(ctx.eventBus.emit).toHaveBeenCalledWith(
      'atc:security:role:assigned',
      expect.objectContaining({ principalId: 'p-1', roleId: 'moderator' }),
    )
  })

  it('returns 400 for empty roleId', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({
      method: 'POST', url: '/api/v1/security/principals/p-1/roles',
      headers: { ...SEC_AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleId: '', assignedBy: 'admin-1' }),
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('DELETE /api/v1/security/principals/:id/roles/:roleId', () => {
  it('returns 503 when principal store not configured', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({
      method: 'DELETE', url: '/api/v1/security/principals/p-1/roles/player', headers: SEC_AUTH,
    })
    expect(res.statusCode).toBe(503)
  })

  it('returns 404 when assignment not found', async () => {
    const principalStore = makeMockPrincipalStore({
      roleAssignments: { revoke: vi.fn().mockResolvedValue(false) },
    })
    const server = buildServer(makeMockCtx({ principalStore }))
    const res = await server.inject({
      method: 'DELETE', url: '/api/v1/security/principals/p-1/roles/player', headers: SEC_AUTH,
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 200 and emits ROLE_REVOKED event', async () => {
    const principalStore = makeMockPrincipalStore()
    const ctx = makeMockCtx({ principalStore })
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'DELETE', url: '/api/v1/security/principals/p-1/roles/player', headers: SEC_AUTH,
    })
    expect(res.statusCode).toBe(200)
    expect(ctx.eventBus.emit).toHaveBeenCalledWith(
      'atc:security:role:revoked',
      expect.objectContaining({ principalId: 'p-1', roleId: 'player' }),
    )
  })
})

describe('POST /api/v1/security/principals/:id/capabilities', () => {
  const capBody = { capability: 'ops.read', grantedBy: 'admin-1' }

  it('returns 503 when principal store not configured', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({
      method: 'POST', url: '/api/v1/security/principals/p-1/capabilities',
      headers: { ...SEC_AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify(capBody),
    })
    expect(res.statusCode).toBe(503)
  })

  it('returns 404 when principal not found', async () => {
    const principalStore = makeMockPrincipalStore({
      principals: { findById: vi.fn().mockResolvedValue(null) },
    })
    const server = buildServer(makeMockCtx({ principalStore }))
    const res = await server.inject({
      method: 'POST', url: '/api/v1/security/principals/p-1/capabilities',
      headers: { ...SEC_AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify(capBody),
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 201 and emits CAPABILITY_GRANTED event', async () => {
    const principalStore = makeMockPrincipalStore()
    const ctx = makeMockCtx({ principalStore })
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'POST', url: '/api/v1/security/principals/p-1/capabilities',
      headers: { ...SEC_AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify(capBody),
    })
    expect(res.statusCode).toBe(201)
    expect(ctx.eventBus.emit).toHaveBeenCalledWith(
      'atc:security:capability:granted',
      expect.objectContaining({ principalId: 'p-1', capability: 'ops.read' }),
    )
  })

  it('returns 400 for empty capability', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({
      method: 'POST', url: '/api/v1/security/principals/p-1/capabilities',
      headers: { ...SEC_AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ capability: '', grantedBy: 'admin-1' }),
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('DELETE /api/v1/security/principals/:id/capabilities/:capability', () => {
  it('returns 503 when principal store not configured', async () => {
    const server = buildServer(makeMockCtx())
    const res = await server.inject({
      method: 'DELETE', url: '/api/v1/security/principals/p-1/capabilities/ops.read', headers: SEC_AUTH,
    })
    expect(res.statusCode).toBe(503)
  })

  it('returns 404 when assignment not found', async () => {
    const principalStore = makeMockPrincipalStore({
      capabilities: { revoke: vi.fn().mockResolvedValue(false) },
    })
    const server = buildServer(makeMockCtx({ principalStore }))
    const res = await server.inject({
      method: 'DELETE', url: '/api/v1/security/principals/p-1/capabilities/ops.read', headers: SEC_AUTH,
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 200 and emits CAPABILITY_REVOKED event', async () => {
    const principalStore = makeMockPrincipalStore()
    const ctx = makeMockCtx({ principalStore })
    const server = buildServer(ctx)
    const res = await server.inject({
      method: 'DELETE', url: '/api/v1/security/principals/p-1/capabilities/ops.read', headers: SEC_AUTH,
    })
    expect(res.statusCode).toBe(200)
    expect(ctx.eventBus.emit).toHaveBeenCalledWith(
      'atc:security:capability:revoked',
      expect.objectContaining({ principalId: 'p-1', capability: 'ops.read' }),
    )
  })
})
