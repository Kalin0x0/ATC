import { describe, it, expect } from 'vitest'
import {
  NpcRuntimeError,
  NpcNotFoundError,
  NpcAlreadySpawnedError,
  NpcAlreadyOwnedError,
  NpcSpawnNonceConflictError,
  PopulationZoneNotFoundError,
  SpawnPointNotFoundError,
  CrowdRuntimeNotFoundError,
} from '@atc/npc-runtime'
import {
  spawnNpcSchema,
  despawnNpcSchema,
  recordNpcBehaviorSchema,
  npcHeartbeatSchema,
  updateCrowdDensitySchema,
  cleanupStaleNpcsSchema,
} from '@atc/operations'

// ── Error Hierarchy ───────────────────────────────────────────────────────────

describe('NpcRuntimeError hierarchy', () => {
  it('NpcNotFoundError extends NpcRuntimeError', () => {
    const e = new NpcNotFoundError('npc-1')
    expect(e).toBeInstanceOf(NpcRuntimeError)
    expect(e.message).toContain('npc-1')
    expect(e.name).toBe('NpcNotFoundError')
  })

  it('NpcAlreadySpawnedError extends NpcRuntimeError', () => {
    const e = new NpcAlreadySpawnedError('npc-2')
    expect(e).toBeInstanceOf(NpcRuntimeError)
    expect(e.message).toContain('npc-2')
  })

  it('NpcAlreadyOwnedError extends NpcRuntimeError', () => {
    const e = new NpcAlreadyOwnedError('npc-3', 'server-2')
    expect(e).toBeInstanceOf(NpcRuntimeError)
    expect(e.message).toContain('npc-3')
  })

  it('NpcSpawnNonceConflictError extends NpcRuntimeError', () => {
    const e = new NpcSpawnNonceConflictError('nonce-abc')
    expect(e).toBeInstanceOf(NpcRuntimeError)
    expect(e.message).toContain('nonce-abc')
  })

  it('PopulationZoneNotFoundError extends NpcRuntimeError', () => {
    const e = new PopulationZoneNotFoundError('zone-1')
    expect(e).toBeInstanceOf(NpcRuntimeError)
    expect(e.message).toContain('zone-1')
  })

  it('SpawnPointNotFoundError extends NpcRuntimeError', () => {
    const e = new SpawnPointNotFoundError('sp-1')
    expect(e).toBeInstanceOf(NpcRuntimeError)
    expect(e.message).toContain('sp-1')
  })

  it('CrowdRuntimeNotFoundError extends NpcRuntimeError', () => {
    const e = new CrowdRuntimeNotFoundError('zone-2')
    expect(e).toBeInstanceOf(NpcRuntimeError)
    expect(e.message).toContain('zone-2')
  })
})

// ── Schema Validation ─────────────────────────────────────────────────────────

describe('spawnNpcSchema', () => {
  it('accepts valid spawn with defaults', () => {
    const result = spawnNpcSchema.safeParse({
      zoneId:     'zone-downtown',
      spawnNonce: 'nonce-spawn-1',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.npcType).toBe('civilian')
    }
  })

  it('accepts explicit npcType', () => {
    const result = spawnNpcSchema.safeParse({
      zoneId:     'zone-1',
      spawnNonce: 'nonce-2',
      npcType:    'pedestrian',
    })
    expect(result.success).toBe(true)
  })

  it('accepts metadata', () => {
    const result = spawnNpcSchema.safeParse({
      zoneId:     'zone-1',
      spawnNonce: 'nonce-3',
      metadata:   { modelHash: 'a_m_y_business_01' },
    })
    expect(result.success).toBe(true)
  })

  it('requires spawnNonce', () => {
    const result = spawnNpcSchema.safeParse({
      zoneId: 'zone-1',
    })
    expect(result.success).toBe(false)
  })
})

describe('despawnNpcSchema', () => {
  it('accepts valid despawn', () => {
    const result = despawnNpcSchema.safeParse({
      npcId:  'npc-abc',
      reason: 'player_left_zone',
    })
    expect(result.success).toBe(true)
  })

  it('reason has default', () => {
    const result = despawnNpcSchema.safeParse({ npcId: 'npc-1' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.reason).toBe('manual')
    }
  })

  it('requires npcId', () => {
    const result = despawnNpcSchema.safeParse({ reason: 'timeout' })
    expect(result.success).toBe(false)
  })
})

describe('recordNpcBehaviorSchema', () => {
  it('accepts valid behavior', () => {
    const result = recordNpcBehaviorSchema.safeParse({
      npcId:    'npc-1',
      behavior: 'idle',
    })
    expect(result.success).toBe(true)
  })

  it('accepts behavior with params', () => {
    const result = recordNpcBehaviorSchema.safeParse({
      npcId:    'npc-1',
      behavior: 'fleeing',
      params:   { targetEntityId: 'player-42', speed: 3.0 },
    })
    expect(result.success).toBe(true)
  })
})

describe('updateCrowdDensitySchema', () => {
  it('accepts valid crowd update', () => {
    const result = updateCrowdDensitySchema.safeParse({
      zoneId:         'zone-market',
      density:        0.65,
      targetDensity:  0.7,
      activeNpcCount: 12,
    })
    expect(result.success).toBe(true)
  })

  it('rejects density > 1', () => {
    const result = updateCrowdDensitySchema.safeParse({
      zoneId:  'zone-1',
      density: 1.5,
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative density', () => {
    const result = updateCrowdDensitySchema.safeParse({
      zoneId:  'zone-1',
      density: -0.1,
    })
    expect(result.success).toBe(false)
  })
})

describe('cleanupStaleNpcsSchema', () => {
  it('accepts valid cleanup request', () => {
    const result = cleanupStaleNpcsSchema.safeParse({
      ownerServerId:    'server-1',
      staleThresholdMs: 60000,
    })
    expect(result.success).toBe(true)
  })

  it('has default staleThresholdMs', () => {
    const result = cleanupStaleNpcsSchema.safeParse({
      ownerServerId: 'server-1',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.staleThresholdMs).toBe(30000)
    }
  })
})

describe('npcHeartbeatSchema', () => {
  it('requires npcId and ownerServerId', () => {
    const ok = npcHeartbeatSchema.safeParse({ npcId: 'npc-1', ownerServerId: 'server-1' })
    expect(ok.success).toBe(true)

    const missing = npcHeartbeatSchema.safeParse({ npcId: 'npc-1' })
    expect(missing.success).toBe(false)
  })
})
