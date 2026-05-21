import { describe, it, expect } from 'vitest'
import {
  WorldOrchestratorError,
  WorldRegionNotFoundError,
  DuplicateWorldRegionError,
  RuntimeAllocationNotFoundError,
  ShardRuntimeNotFoundError,
  DuplicateShardError,
  RegionalSimulationNotFoundError,
  StaleShardError,
} from '@atc/world-orchestrator'
import {
  upsertWorldRegionSchema,
  transferRegionSchema,
  allocateShardSchema,
  transferShardSchema,
  upsertRegionalSimulationSchema,
  rebalanceWorldSchema,
  cleanupShardsSchema,
} from '@atc/operations'

// ── Error Hierarchy ───────────────────────────────────────────────────────────

describe('WorldOrchestratorError hierarchy', () => {
  it('WorldRegionNotFoundError extends WorldOrchestratorError', () => {
    const e = new WorldRegionNotFoundError('region-1')
    expect(e).toBeInstanceOf(WorldOrchestratorError)
    expect(e.message).toContain('region-1')
    expect(e.name).toBe('WorldRegionNotFoundError')
  })

  it('DuplicateWorldRegionError extends WorldOrchestratorError', () => {
    const e = new DuplicateWorldRegionError('region-1')
    expect(e).toBeInstanceOf(WorldOrchestratorError)
    expect(e.message).toContain('region-1')
    expect(e.name).toBe('DuplicateWorldRegionError')
  })

  it('RuntimeAllocationNotFoundError extends WorldOrchestratorError', () => {
    const e = new RuntimeAllocationNotFoundError('allocation-1')
    expect(e).toBeInstanceOf(WorldOrchestratorError)
    expect(e.message).toContain('allocation-1')
    expect(e.name).toBe('RuntimeAllocationNotFoundError')
  })

  it('ShardRuntimeNotFoundError extends WorldOrchestratorError', () => {
    const e = new ShardRuntimeNotFoundError('shard-1')
    expect(e).toBeInstanceOf(WorldOrchestratorError)
    expect(e.message).toContain('shard-1')
    expect(e.name).toBe('ShardRuntimeNotFoundError')
  })

  it('DuplicateShardError extends WorldOrchestratorError', () => {
    const e = new DuplicateShardError('shard-1')
    expect(e).toBeInstanceOf(WorldOrchestratorError)
    expect(e.message).toContain('shard-1')
    expect(e.name).toBe('DuplicateShardError')
  })

  it('RegionalSimulationNotFoundError extends WorldOrchestratorError', () => {
    const e = new RegionalSimulationNotFoundError('region-1')
    expect(e).toBeInstanceOf(WorldOrchestratorError)
    expect(e.message).toContain('region-1')
    expect(e.name).toBe('RegionalSimulationNotFoundError')
  })

  it('StaleShardError extends WorldOrchestratorError', () => {
    const e = new StaleShardError('shard-1')
    expect(e).toBeInstanceOf(WorldOrchestratorError)
    expect(e.message).toContain('shard-1')
    expect(e.name).toBe('StaleShardError')
  })
})

// ── upsertWorldRegionSchema ───────────────────────────────────────────────────

describe('upsertWorldRegionSchema', () => {
  it('accepts minimal valid region', () => {
    const result = upsertWorldRegionSchema.safeParse({
      regionId:   'region-downtown',
      regionType: 'city',
    })
    expect(result.success).toBe(true)
  })

  it('accepts region with all optional fields', () => {
    const result = upsertWorldRegionSchema.safeParse({
      regionId:      'region-wilderness-1',
      regionType:    'wilderness',
      ownerServerId: 'server-1',
      boundsData:    { minX: -1000, maxX: 1000, minY: -1000, maxY: 1000 },
      capacityLimit: 500,
    })
    expect(result.success).toBe(true)
  })

  it('accepts all region types', () => {
    for (const regionType of ['city', 'wilderness', 'ocean', 'interior', 'instance', 'custom'] as const) {
      const result = upsertWorldRegionSchema.safeParse({
        regionId: `region-${regionType}-1`,
        regionType,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid region type', () => {
    const result = upsertWorldRegionSchema.safeParse({
      regionId:   'region-1',
      regionType: 'desert',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing regionId', () => {
    const result = upsertWorldRegionSchema.safeParse({
      regionType: 'city',
    })
    expect(result.success).toBe(false)
  })

  it('rejects capacityLimit below 1', () => {
    const result = upsertWorldRegionSchema.safeParse({
      regionId:      'region-1',
      regionType:    'city',
      capacityLimit: 0,
    })
    expect(result.success).toBe(false)
  })
})

// ── transferRegionSchema ──────────────────────────────────────────────────────

describe('transferRegionSchema', () => {
  it('accepts valid region transfer', () => {
    const result = transferRegionSchema.safeParse({
      regionId:     'region-downtown',
      fromServerId: 'server-1',
      toServerId:   'server-2',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing regionId', () => {
    const result = transferRegionSchema.safeParse({
      fromServerId: 'server-1',
      toServerId:   'server-2',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing fromServerId', () => {
    const result = transferRegionSchema.safeParse({
      regionId:   'region-1',
      toServerId: 'server-2',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing toServerId', () => {
    const result = transferRegionSchema.safeParse({
      regionId:     'region-1',
      fromServerId: 'server-1',
    })
    expect(result.success).toBe(false)
  })
})

// ── allocateShardSchema ───────────────────────────────────────────────────────

describe('allocateShardSchema', () => {
  it('accepts minimal shard allocation', () => {
    const result = allocateShardSchema.safeParse({
      shardId:       'shard-world-1',
      shardType:     'world',
      ownerServerId: 'server-1',
    })
    expect(result.success).toBe(true)
  })

  it('accepts shard with all optional fields', () => {
    const result = allocateShardSchema.safeParse({
      shardId:       'shard-instance-1',
      shardType:     'instance',
      ownerServerId: 'server-1',
      regionId:      'region-downtown',
      capacityLimit: 50,
    })
    expect(result.success).toBe(true)
  })

  it('accepts all shard types', () => {
    for (const shardType of ['world', 'instance', 'arena', 'lobby', 'custom'] as const) {
      const result = allocateShardSchema.safeParse({
        shardId:       `shard-${shardType}-1`,
        shardType,
        ownerServerId: 'server-1',
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid shard type', () => {
    const result = allocateShardSchema.safeParse({
      shardId:       'shard-1',
      shardType:     'dungeon',
      ownerServerId: 'server-1',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing ownerServerId', () => {
    const result = allocateShardSchema.safeParse({
      shardId:   'shard-1',
      shardType: 'world',
    })
    expect(result.success).toBe(false)
  })

  it('rejects capacityLimit below 1', () => {
    const result = allocateShardSchema.safeParse({
      shardId:       'shard-1',
      shardType:     'world',
      ownerServerId: 'server-1',
      capacityLimit: 0,
    })
    expect(result.success).toBe(false)
  })
})

// ── transferShardSchema ───────────────────────────────────────────────────────

describe('transferShardSchema', () => {
  it('accepts valid shard transfer', () => {
    const result = transferShardSchema.safeParse({
      shardId:      'shard-world-1',
      fromServerId: 'server-1',
      toServerId:   'server-2',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing shardId', () => {
    const result = transferShardSchema.safeParse({
      fromServerId: 'server-1',
      toServerId:   'server-2',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing fromServerId', () => {
    const result = transferShardSchema.safeParse({
      shardId:    'shard-1',
      toServerId: 'server-2',
    })
    expect(result.success).toBe(false)
  })
})

// ── upsertRegionalSimulationSchema ────────────────────────────────────────────

describe('upsertRegionalSimulationSchema', () => {
  it('accepts minimal simulation', () => {
    const result = upsertRegionalSimulationSchema.safeParse({
      regionId:       'region-downtown',
      simulationType: 'full',
    })
    expect(result.success).toBe(true)
  })

  it('accepts simulation with all optional fields', () => {
    const result = upsertRegionalSimulationSchema.safeParse({
      regionId:       'region-industrial',
      simulationType: 'partial',
      ownerServerId:  'server-1',
      simulationData: { tickRate: 20, entityBudget: 500 },
    })
    expect(result.success).toBe(true)
  })

  it('accepts all simulation types', () => {
    for (const simulationType of ['full', 'partial', 'minimal', 'frozen'] as const) {
      const result = upsertRegionalSimulationSchema.safeParse({
        regionId: 'region-1',
        simulationType,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid simulation type', () => {
    const result = upsertRegionalSimulationSchema.safeParse({
      regionId:       'region-1',
      simulationType: 'active',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing regionId', () => {
    const result = upsertRegionalSimulationSchema.safeParse({
      simulationType: 'full',
    })
    expect(result.success).toBe(false)
  })
})

// ── rebalanceWorldSchema ──────────────────────────────────────────────────────

describe('rebalanceWorldSchema', () => {
  it('accepts rebalance without any fields (all optional + defaults)', () => {
    const result = rebalanceWorldSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts rebalance with all fields', () => {
    const result = rebalanceWorldSchema.safeParse({
      regionId:         'region-downtown',
      thresholdPercent: 75,
    })
    expect(result.success).toBe(true)
  })

  it('accepts thresholdPercent at boundary values', () => {
    expect(rebalanceWorldSchema.safeParse({ thresholdPercent: 1 }).success).toBe(true)
    expect(rebalanceWorldSchema.safeParse({ thresholdPercent: 100 }).success).toBe(true)
  })

  it('rejects thresholdPercent above 100', () => {
    const result = rebalanceWorldSchema.safeParse({ thresholdPercent: 101 })
    expect(result.success).toBe(false)
  })

  it('rejects thresholdPercent below 1', () => {
    const result = rebalanceWorldSchema.safeParse({ thresholdPercent: 0 })
    expect(result.success).toBe(false)
  })
})

// ── cleanupShardsSchema ───────────────────────────────────────────────────────

describe('cleanupShardsSchema', () => {
  it('accepts valid threshold', () => {
    const result = cleanupShardsSchema.safeParse({ thresholdMs: 300000 })
    expect(result.success).toBe(true)
  })

  it('accepts cleanup without threshold (uses default)', () => {
    const result = cleanupShardsSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejects threshold below 1000', () => {
    const result = cleanupShardsSchema.safeParse({ thresholdMs: 999 })
    expect(result.success).toBe(false)
  })
})
