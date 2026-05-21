import { describe, it, expect } from 'vitest'
import {
  ReconciliationRuntimeError,
  RuntimeMigrationNotFoundError,
  DuplicateMigrationNonceError,
  MigrationAlreadyCompletedError,
  NodeTransferNotFoundError,
  ReconciliationNotFoundError,
  SnapshotReplayNotFoundError,
  RuntimeRecoveryNotFoundError,
} from '@atc/reconciliation-runtime'
import {
  startMigrationSchema,
  transitionMigrationSchema,
  createNodeTransferSchema,
  transitionNodeTransferSchema,
  startReconciliationSchema,
  replayCheckpointSchema,
  createRecoverySchema,
} from '@atc/operations'

// ── Error Hierarchy ───────────────────────────────────────────────────────────

describe('ReconciliationRuntimeError hierarchy', () => {
  it('RuntimeMigrationNotFoundError extends ReconciliationRuntimeError', () => {
    const e = new RuntimeMigrationNotFoundError('migration-1')
    expect(e).toBeInstanceOf(ReconciliationRuntimeError)
    expect(e.message).toContain('migration-1')
    expect(e.name).toBe('RuntimeMigrationNotFoundError')
  })

  it('DuplicateMigrationNonceError extends ReconciliationRuntimeError', () => {
    const e = new DuplicateMigrationNonceError('nonce-abc')
    expect(e).toBeInstanceOf(ReconciliationRuntimeError)
    expect(e.message).toContain('nonce-abc')
    expect(e.name).toBe('DuplicateMigrationNonceError')
  })

  it('MigrationAlreadyCompletedError extends ReconciliationRuntimeError', () => {
    const e = new MigrationAlreadyCompletedError('migration-2')
    expect(e).toBeInstanceOf(ReconciliationRuntimeError)
    expect(e.message).toContain('migration-2')
    expect(e.name).toBe('MigrationAlreadyCompletedError')
  })

  it('NodeTransferNotFoundError extends ReconciliationRuntimeError', () => {
    const e = new NodeTransferNotFoundError('transfer-1')
    expect(e).toBeInstanceOf(ReconciliationRuntimeError)
    expect(e.message).toContain('transfer-1')
    expect(e.name).toBe('NodeTransferNotFoundError')
  })

  it('ReconciliationNotFoundError extends ReconciliationRuntimeError', () => {
    const e = new ReconciliationNotFoundError('reconciliation-1')
    expect(e).toBeInstanceOf(ReconciliationRuntimeError)
    expect(e.message).toContain('reconciliation-1')
    expect(e.name).toBe('ReconciliationNotFoundError')
  })

  it('SnapshotReplayNotFoundError extends ReconciliationRuntimeError', () => {
    const e = new SnapshotReplayNotFoundError('replay-1')
    expect(e).toBeInstanceOf(ReconciliationRuntimeError)
    expect(e.message).toContain('replay-1')
    expect(e.name).toBe('SnapshotReplayNotFoundError')
  })

  it('RuntimeRecoveryNotFoundError extends ReconciliationRuntimeError', () => {
    const e = new RuntimeRecoveryNotFoundError('recovery-1')
    expect(e).toBeInstanceOf(ReconciliationRuntimeError)
    expect(e.message).toContain('recovery-1')
    expect(e.name).toBe('RuntimeRecoveryNotFoundError')
  })
})

// ── startMigrationSchema ──────────────────────────────────────────────────────

describe('startMigrationSchema', () => {
  it('accepts minimal migration start', () => {
    const result = startMigrationSchema.safeParse({
      migrationNonce: 'nonce-mig-abc',
      entityId:       'entity-player-1',
      fromServerId:   'server-1',
      toServerId:     'server-2',
    })
    expect(result.success).toBe(true)
  })

  it('accepts migration with optional migrationData', () => {
    const result = startMigrationSchema.safeParse({
      migrationNonce: 'nonce-mig-xyz',
      entityId:       'entity-npc-1',
      fromServerId:   'server-1',
      toServerId:     'server-2',
      migrationData:  { position: { x: 100, y: 200 }, health: 800 },
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing migrationNonce', () => {
    const result = startMigrationSchema.safeParse({
      entityId:     'entity-1',
      fromServerId: 'server-1',
      toServerId:   'server-2',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing fromServerId', () => {
    const result = startMigrationSchema.safeParse({
      migrationNonce: 'nonce-1',
      entityId:       'entity-1',
      toServerId:     'server-2',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing toServerId', () => {
    const result = startMigrationSchema.safeParse({
      migrationNonce: 'nonce-1',
      entityId:       'entity-1',
      fromServerId:   'server-1',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty migrationNonce', () => {
    const result = startMigrationSchema.safeParse({
      migrationNonce: '',
      entityId:       'entity-1',
      fromServerId:   'server-1',
      toServerId:     'server-2',
    })
    expect(result.success).toBe(false)
  })
})

// ── transitionMigrationSchema ─────────────────────────────────────────────────

describe('transitionMigrationSchema', () => {
  it('accepts transition with only migrationId', () => {
    const result = transitionMigrationSchema.safeParse({
      migrationId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
    })
    expect(result.success).toBe(true)
  })

  it('accepts transition with optional reason', () => {
    const result = transitionMigrationSchema.safeParse({
      migrationId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      reason:      'Target server unreachable',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing migrationId', () => {
    const result = transitionMigrationSchema.safeParse({
      reason: 'Server failure',
    })
    expect(result.success).toBe(false)
  })
})

// ── createNodeTransferSchema ──────────────────────────────────────────────────

describe('createNodeTransferSchema', () => {
  it('accepts minimal node transfer', () => {
    const result = createNodeTransferSchema.safeParse({
      entityId:     'entity-vehicle-1',
      fromServerId: 'server-1',
      toServerId:   'server-2',
    })
    expect(result.success).toBe(true)
  })

  it('accepts transfer with optional transferData', () => {
    const result = createNodeTransferSchema.safeParse({
      entityId:     'entity-npc-1',
      fromServerId: 'server-1',
      toServerId:   'server-2',
      transferData: { state: 'idle', health: 1000 },
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing entityId', () => {
    const result = createNodeTransferSchema.safeParse({
      fromServerId: 'server-1',
      toServerId:   'server-2',
    })
    expect(result.success).toBe(false)
  })
})

// ── transitionNodeTransferSchema ──────────────────────────────────────────────

describe('transitionNodeTransferSchema', () => {
  it('accepts all valid transition statuses', () => {
    for (const status of ['in_progress', 'completed', 'failed'] as const) {
      const result = transitionNodeTransferSchema.safeParse({
        transferId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        status,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid status', () => {
    const result = transitionNodeTransferSchema.safeParse({
      transferId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      status:     'pending',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing transferId', () => {
    const result = transitionNodeTransferSchema.safeParse({
      status: 'completed',
    })
    expect(result.success).toBe(false)
  })
})

// ── startReconciliationSchema ─────────────────────────────────────────────────

describe('startReconciliationSchema', () => {
  it('accepts minimal reconciliation (only type required)', () => {
    const result = startReconciliationSchema.safeParse({
      reconciliationType: 'ownership',
    })
    expect(result.success).toBe(true)
  })

  it('accepts reconciliation with all optional fields', () => {
    const result = startReconciliationSchema.safeParse({
      reconciliationId:   '01JX1234567890ABCDEFG12',
      reconciliationType: 'snapshot',
      regionId:           'region-downtown',
      serverId:           'server-1',
    })
    expect(result.success).toBe(true)
  })

  it('accepts all reconciliation types', () => {
    for (const reconciliationType of ['ownership', 'snapshot', 'migration', 'consistency', 'custom'] as const) {
      const result = startReconciliationSchema.safeParse({ reconciliationType })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid reconciliation type', () => {
    const result = startReconciliationSchema.safeParse({
      reconciliationType: 'state_sync',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing reconciliationType', () => {
    const result = startReconciliationSchema.safeParse({
      regionId: 'region-1',
    })
    expect(result.success).toBe(false)
  })
})

// ── replayCheckpointSchema ────────────────────────────────────────────────────

describe('replayCheckpointSchema', () => {
  it('accepts valid checkpoint replay', () => {
    const result = replayCheckpointSchema.safeParse({
      entityId:   'entity-1',
      snapshotId: '01JX1234567890ABCDEFG12',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing entityId', () => {
    const result = replayCheckpointSchema.safeParse({
      snapshotId: '01JX1234567890ABCDEFG12',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing snapshotId', () => {
    const result = replayCheckpointSchema.safeParse({
      entityId: 'entity-1',
    })
    expect(result.success).toBe(false)
  })
})

// ── createRecoverySchema ──────────────────────────────────────────────────────

describe('createRecoverySchema', () => {
  it('accepts minimal recovery (no targetServerId)', () => {
    const result = createRecoverySchema.safeParse({
      entityId:     'entity-1',
      recoveryType: 'snapshot',
    })
    expect(result.success).toBe(true)
  })

  it('accepts recovery with optional targetServerId', () => {
    const result = createRecoverySchema.safeParse({
      entityId:       'entity-1',
      recoveryType:   'migration',
      targetServerId: 'server-1',
    })
    expect(result.success).toBe(true)
  })

  it('accepts all recovery types', () => {
    for (const recoveryType of ['snapshot', 'migration', 'ownership', 'custom'] as const) {
      const result = createRecoverySchema.safeParse({
        entityId: 'entity-1',
        recoveryType,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid recovery type', () => {
    const result = createRecoverySchema.safeParse({
      entityId:     'entity-1',
      recoveryType: 'rollback',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing entityId', () => {
    const result = createRecoverySchema.safeParse({
      recoveryType: 'snapshot',
    })
    expect(result.success).toBe(false)
  })
})
