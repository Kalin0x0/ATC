import { describe, it, expect } from 'vitest'
import {
  ReplicationRuntimeError,
  SpatialOwnershipNotFoundError,
  DuplicateSpatialOwnershipError,
  SpatialNodeNotFoundError,
  SnapshotNotFoundError,
  InterestRegionNotFoundError,
  StreamingRuntimeNotFoundError,
  StaleOwnershipError,
} from '@atc/replication-runtime'
import {
  upsertSpatialNodeSchema,
  claimOwnershipSchema,
  transferOwnershipSchema,
  updateStreamingStateSchema,
  createSnapshotSchema,
  upsertInterestRegionSchema,
  cleanupReplicationSchema,
} from '@atc/operations'

// ── Error Hierarchy ───────────────────────────────────────────────────────────

describe('ReplicationRuntimeError hierarchy', () => {
  it('SpatialOwnershipNotFoundError extends ReplicationRuntimeError', () => {
    const e = new SpatialOwnershipNotFoundError('entity-1')
    expect(e).toBeInstanceOf(ReplicationRuntimeError)
    expect(e.message).toContain('entity-1')
    expect(e.name).toBe('SpatialOwnershipNotFoundError')
  })

  it('DuplicateSpatialOwnershipError extends ReplicationRuntimeError', () => {
    const e = new DuplicateSpatialOwnershipError('entity-1')
    expect(e).toBeInstanceOf(ReplicationRuntimeError)
    expect(e.message).toContain('entity-1')
    expect(e.name).toBe('DuplicateSpatialOwnershipError')
  })

  it('SpatialNodeNotFoundError extends ReplicationRuntimeError', () => {
    const e = new SpatialNodeNotFoundError('node-1')
    expect(e).toBeInstanceOf(ReplicationRuntimeError)
    expect(e.message).toContain('node-1')
    expect(e.name).toBe('SpatialNodeNotFoundError')
  })

  it('SnapshotNotFoundError extends ReplicationRuntimeError', () => {
    const e = new SnapshotNotFoundError('snap-1')
    expect(e).toBeInstanceOf(ReplicationRuntimeError)
    expect(e.message).toContain('snap-1')
    expect(e.name).toBe('SnapshotNotFoundError')
  })

  it('InterestRegionNotFoundError extends ReplicationRuntimeError', () => {
    const e = new InterestRegionNotFoundError('region-1')
    expect(e).toBeInstanceOf(ReplicationRuntimeError)
    expect(e.message).toContain('region-1')
    expect(e.name).toBe('InterestRegionNotFoundError')
  })

  it('StreamingRuntimeNotFoundError extends ReplicationRuntimeError', () => {
    const e = new StreamingRuntimeNotFoundError('entity-1')
    expect(e).toBeInstanceOf(ReplicationRuntimeError)
    expect(e.message).toContain('entity-1')
    expect(e.name).toBe('StreamingRuntimeNotFoundError')
  })

  it('StaleOwnershipError extends ReplicationRuntimeError', () => {
    const e = new StaleOwnershipError('entity-1')
    expect(e).toBeInstanceOf(ReplicationRuntimeError)
    expect(e.message).toContain('entity-1')
    expect(e.name).toBe('StaleOwnershipError')
  })
})

// ── upsertSpatialNodeSchema ───────────────────────────────────────────────────

describe('upsertSpatialNodeSchema', () => {
  it('accepts minimal valid node', () => {
    const result = upsertSpatialNodeSchema.safeParse({
      nodeId:   'node-server-1',
      nodeType: 'server',
    })
    expect(result.success).toBe(true)
  })

  it('accepts node with all optional fields', () => {
    const result = upsertSpatialNodeSchema.safeParse({
      nodeId:        'node-zone-1',
      nodeType:      'zone',
      ownerServerId: 'server-1',
      regionId:      'region-downtown',
      positionData:  { x: 100, y: 200, z: 10 },
    })
    expect(result.success).toBe(true)
  })

  it('accepts all node types', () => {
    for (const nodeType of ['server', 'zone', 'region', 'partition', 'custom'] as const) {
      const result = upsertSpatialNodeSchema.safeParse({
        nodeId: `node-${nodeType}`,
        nodeType,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid node type', () => {
    const result = upsertSpatialNodeSchema.safeParse({
      nodeId:   'node-1',
      nodeType: 'cluster',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing nodeId', () => {
    const result = upsertSpatialNodeSchema.safeParse({
      nodeType: 'zone',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty nodeId', () => {
    const result = upsertSpatialNodeSchema.safeParse({
      nodeId:   '',
      nodeType: 'zone',
    })
    expect(result.success).toBe(false)
  })
})

// ── claimOwnershipSchema ──────────────────────────────────────────────────────

describe('claimOwnershipSchema', () => {
  it('accepts minimal ownership claim', () => {
    const result = claimOwnershipSchema.safeParse({
      entityId:      'entity-npc-1',
      entityType:    'npc',
      ownerServerId: 'server-1',
    })
    expect(result.success).toBe(true)
  })

  it('accepts claim with optional regionId', () => {
    const result = claimOwnershipSchema.safeParse({
      entityId:      'entity-vehicle-1',
      entityType:    'vehicle',
      ownerServerId: 'server-1',
      regionId:      'region-downtown',
    })
    expect(result.success).toBe(true)
  })

  it('accepts all entity types', () => {
    for (const entityType of ['npc', 'vehicle', 'player', 'zone', 'object', 'custom'] as const) {
      const result = claimOwnershipSchema.safeParse({
        entityId:      `entity-${entityType}-1`,
        entityType,
        ownerServerId: 'server-1',
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid entity type', () => {
    const result = claimOwnershipSchema.safeParse({
      entityId:      'entity-1',
      entityType:    'building',
      ownerServerId: 'server-1',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing ownerServerId', () => {
    const result = claimOwnershipSchema.safeParse({
      entityId:   'entity-1',
      entityType: 'npc',
    })
    expect(result.success).toBe(false)
  })
})

// ── transferOwnershipSchema ───────────────────────────────────────────────────

describe('transferOwnershipSchema', () => {
  it('accepts valid transfer', () => {
    const result = transferOwnershipSchema.safeParse({
      entityId:     'entity-1',
      fromServerId: 'server-1',
      toServerId:   'server-2',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing fromServerId', () => {
    const result = transferOwnershipSchema.safeParse({
      entityId:   'entity-1',
      toServerId: 'server-2',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing toServerId', () => {
    const result = transferOwnershipSchema.safeParse({
      entityId:     'entity-1',
      fromServerId: 'server-1',
    })
    expect(result.success).toBe(false)
  })
})

// ── updateStreamingStateSchema ────────────────────────────────────────────────

describe('updateStreamingStateSchema', () => {
  it('accepts minimal streaming state update', () => {
    const result = updateStreamingStateSchema.safeParse({
      entityId:       'entity-1',
      streamingState: 'active',
    })
    expect(result.success).toBe(true)
  })

  it('accepts update with optional ownerServerId', () => {
    const result = updateStreamingStateSchema.safeParse({
      entityId:       'entity-1',
      streamingState: 'paused',
      ownerServerId:  'server-1',
    })
    expect(result.success).toBe(true)
  })

  it('accepts all streaming states', () => {
    for (const streamingState of ['active', 'paused', 'frozen', 'culled'] as const) {
      const result = updateStreamingStateSchema.safeParse({
        entityId: 'entity-1',
        streamingState,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid streaming state', () => {
    const result = updateStreamingStateSchema.safeParse({
      entityId:       'entity-1',
      streamingState: 'dormant',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing entityId', () => {
    const result = updateStreamingStateSchema.safeParse({
      streamingState: 'active',
    })
    expect(result.success).toBe(false)
  })
})

// ── createSnapshotSchema ──────────────────────────────────────────────────────

describe('createSnapshotSchema', () => {
  it('accepts minimal snapshot', () => {
    const result = createSnapshotSchema.safeParse({
      entityId:       'entity-1',
      snapshotType:   'checkpoint',
      ownerServerId:  'server-1',
      snapshotData:   {},
      sequenceNumber: 0,
    })
    expect(result.success).toBe(true)
  })

  it('accepts snapshot with data', () => {
    const result = createSnapshotSchema.safeParse({
      entityId:       'entity-vehicle-1',
      snapshotType:   'full',
      ownerServerId:  'server-1',
      snapshotData:   { position: { x: 100, y: 200 }, health: 1000 },
      sequenceNumber: 42,
    })
    expect(result.success).toBe(true)
  })

  it('accepts all snapshot types', () => {
    for (const snapshotType of ['full', 'delta', 'checkpoint'] as const) {
      const result = createSnapshotSchema.safeParse({
        entityId:       'entity-1',
        snapshotType,
        ownerServerId:  'server-1',
        snapshotData:   {},
        sequenceNumber: 1,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid snapshot type', () => {
    const result = createSnapshotSchema.safeParse({
      entityId:       'entity-1',
      snapshotType:   'incremental',
      ownerServerId:  'server-1',
      snapshotData:   {},
      sequenceNumber: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative sequenceNumber', () => {
    const result = createSnapshotSchema.safeParse({
      entityId:       'entity-1',
      snapshotType:   'full',
      ownerServerId:  'server-1',
      snapshotData:   {},
      sequenceNumber: -1,
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing ownerServerId', () => {
    const result = createSnapshotSchema.safeParse({
      entityId:       'entity-1',
      snapshotType:   'full',
      snapshotData:   {},
      sequenceNumber: 0,
    })
    expect(result.success).toBe(false)
  })
})

// ── upsertInterestRegionSchema ────────────────────────────────────────────────

describe('upsertInterestRegionSchema', () => {
  it('accepts minimal interest region', () => {
    const result = upsertInterestRegionSchema.safeParse({
      regionId:   'interest-zone-1',
      regionType: 'zone',
    })
    expect(result.success).toBe(true)
  })

  it('accepts region with all optional fields', () => {
    const result = upsertInterestRegionSchema.safeParse({
      regionId:      'interest-cell-1',
      regionType:    'cell',
      ownerServerId: 'server-1',
      boundsData:    { minX: 0, maxX: 100, minY: 0, maxY: 100 },
    })
    expect(result.success).toBe(true)
  })

  it('accepts all interest region types', () => {
    for (const regionType of ['zone', 'cell', 'sector', 'custom'] as const) {
      const result = upsertInterestRegionSchema.safeParse({
        regionId: `interest-${regionType}-1`,
        regionType,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid region type', () => {
    const result = upsertInterestRegionSchema.safeParse({
      regionId:   'interest-1',
      regionType: 'chunk',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing regionId', () => {
    const result = upsertInterestRegionSchema.safeParse({
      regionType: 'zone',
    })
    expect(result.success).toBe(false)
  })
})

// ── cleanupReplicationSchema ──────────────────────────────────────────────────

describe('cleanupReplicationSchema', () => {
  it('accepts valid threshold', () => {
    const result = cleanupReplicationSchema.safeParse({ thresholdMs: 120000 })
    expect(result.success).toBe(true)
  })

  it('accepts cleanup without threshold (uses default)', () => {
    const result = cleanupReplicationSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejects threshold below 1000', () => {
    const result = cleanupReplicationSchema.safeParse({ thresholdMs: 500 })
    expect(result.success).toBe(false)
  })
})
