import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VitalsRepository } from '@atc/db'

// ── Mock pool factory ─────────────────────────────────────────────────────────

function makeConn(overrides: Record<string, unknown> = {}) {
  return {
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    commit:           vi.fn().mockResolvedValue(undefined),
    rollback:         vi.fn().mockResolvedValue(undefined),
    release:          vi.fn(),
    execute:          vi.fn(),
    ...overrides,
  }
}

function makePool(conn: ReturnType<typeof makeConn>) {
  return { getConnection: vi.fn().mockResolvedValue(conn) } as unknown as ConstructorParameters<typeof VitalsRepository>[0]
}

const CHAR_ID = '01HZ9XVFG3QKJM5N8P2R4T6WYZ'

function vitalsRow(overrides: Record<string, unknown> = {}) {
  return {
    character_id: CHAR_ID,
    health:       100,
    hunger:       100,
    thirst:       100,
    stamina:      100,
    stress:       0,
    armor:        0,
    created_at:   new Date(),
    updated_at:   new Date(),
    ...overrides,
  }
}

// ── getOrCreate ───────────────────────────────────────────────────────────────

describe('VitalsRepository — getOrCreate', () => {
  it('returns existing row without inserting', async () => {
    const conn = makeConn({
      execute: vi.fn().mockResolvedValue([[vitalsRow()]]),
    })
    const repo = new VitalsRepository(makePool(conn))
    const result = await repo.getOrCreate(CHAR_ID)
    expect(result.characterId).toBe(CHAR_ID)
    expect(result.health).toBe(100)
  })

  it('inserts then selects when row does not exist', async () => {
    const row = vitalsRow()
    const conn = makeConn({
      execute: vi.fn()
        .mockResolvedValueOnce([[]])    // SELECT → no row
        .mockResolvedValueOnce([{}])    // INSERT
        .mockResolvedValueOnce([[row]]) // SELECT after INSERT
    })
    const repo = new VitalsRepository(makePool(conn))
    const result = await repo.getOrCreate(CHAR_ID)
    expect(result.health).toBe(100)
    expect(result.stress).toBe(0)
  })

  it('handles ER_DUP_ENTRY race condition on INSERT', async () => {
    const row = vitalsRow()
    const dupError = Object.assign(new Error('Duplicate entry'), { code: 'ER_DUP_ENTRY' })
    const conn = makeConn({
      execute: vi.fn()
        .mockResolvedValueOnce([[]])      // SELECT → no row
        .mockRejectedValueOnce(dupError)  // INSERT → race collision
        .mockResolvedValueOnce([[row]])   // retry SELECT → winner's row
    })
    const repo = new VitalsRepository(makePool(conn))
    const result = await repo.getOrCreate(CHAR_ID)
    expect(result.characterId).toBe(CHAR_ID)
  })
})

// ── patch ─────────────────────────────────────────────────────────────────────

describe('VitalsRepository — patch', () => {
  it('calls INSERT ON DUPLICATE and UPDATE, returns updated vitals', async () => {
    const updated = vitalsRow({ health: 75, hunger: 50 })
    const conn = makeConn({
      execute: vi.fn()
        .mockResolvedValueOnce([{}])          // INSERT ON DUPLICATE
        .mockResolvedValueOnce([{}])          // UPDATE
        .mockResolvedValueOnce([[updated]])   // SELECT
    })
    const repo = new VitalsRepository(makePool(conn))
    const result = await repo.patch(CHAR_ID, { health: 75, hunger: 50 })
    expect(result.health).toBe(75)
    expect(result.hunger).toBe(50)
  })

  it('throws when patch is empty', async () => {
    const conn = makeConn()
    const repo = new VitalsRepository(makePool(conn))
    await expect(repo.patch(CHAR_ID, {})).rejects.toThrow(/at least one vital/)
  })

  it('releases connection even on error', async () => {
    const conn = makeConn({
      execute: vi.fn().mockRejectedValue(new Error('DB error')),
    })
    const repo = new VitalsRepository(makePool(conn))
    await expect(repo.patch(CHAR_ID, { health: 50 })).rejects.toThrow('DB error')
    expect(conn.release).toHaveBeenCalled()
  })
})

// ── mutate ────────────────────────────────────────────────────────────────────

describe('VitalsRepository — mutate', () => {
  beforeEach(() => { vi.clearAllMocks() })

  function mutateConn(finalRow: Record<string, unknown> = {}) {
    const row = vitalsRow(finalRow)
    return makeConn({
      execute: vi.fn()
        .mockResolvedValueOnce([{}])          // INSERT ON DUPLICATE (upsert)
        .mockResolvedValueOnce([[row]])        // SELECT FOR UPDATE
        .mockResolvedValueOnce([{}])          // UPDATE
        .mockResolvedValueOnce([[row]])        // final SELECT
    })
  }

  it('runs transaction with FOR UPDATE and commits', async () => {
    const conn = mutateConn()
    const repo = new VitalsRepository(makePool(conn))
    await repo.mutate(CHAR_ID, 'thirst', 'increment', 25)
    expect(conn.beginTransaction).toHaveBeenCalled()
    expect(conn.commit).toHaveBeenCalled()
    expect(conn.rollback).not.toHaveBeenCalled()
  })

  it('returns updated vitals after increment', async () => {
    const conn = mutateConn({ thirst: 85 })
    const repo = new VitalsRepository(makePool(conn))
    const result = await repo.mutate(CHAR_ID, 'thirst', 'increment', 25)
    expect(result.thirst).toBe(85)
  })

  it('rolls back on DB error and re-throws', async () => {
    const conn = makeConn({
      execute: vi.fn()
        .mockResolvedValueOnce([{}])                           // upsert
        .mockResolvedValueOnce([[vitalsRow()]])                // SELECT FOR UPDATE
        .mockRejectedValueOnce(new Error('UPDATE failed')),   // UPDATE fails
    })
    const repo = new VitalsRepository(makePool(conn))
    await expect(repo.mutate(CHAR_ID, 'health', 'decrement', 10)).rejects.toThrow('UPDATE failed')
    expect(conn.rollback).toHaveBeenCalled()
    expect(conn.release).toHaveBeenCalled()
  })

  it('clamping is handled in SQL — decrement below zero stays at 0', async () => {
    // We trust MariaDB GREATEST(0, col - ?) handles clamping.
    // This test verifies the correct SQL clause is chosen for decrement.
    const execMock = vi.fn()
      .mockResolvedValueOnce([{}])              // upsert
      .mockResolvedValueOnce([[vitalsRow()]])   // SELECT FOR UPDATE
      .mockResolvedValueOnce([{}])              // UPDATE
      .mockResolvedValueOnce([[vitalsRow({ health: 0 })]])  // SELECT after
    const conn = makeConn({ execute: execMock })
    const repo = new VitalsRepository(makePool(conn))
    const result = await repo.mutate(CHAR_ID, 'health', 'decrement', 9999)

    // The UPDATE call (index 2) should use GREATEST(0, health - ?)
    const updateCall = execMock.mock.calls[2]
    expect(updateCall[0]).toMatch(/GREATEST\(0/)
    expect(result.health).toBe(0)
  })

  it('clamping is handled in SQL — increment above 100 stays at 100', async () => {
    const execMock = vi.fn()
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[vitalsRow()]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[vitalsRow({ hunger: 100 })]])
    const conn = makeConn({ execute: execMock })
    const repo = new VitalsRepository(makePool(conn))
    const result = await repo.mutate(CHAR_ID, 'hunger', 'increment', 9999)

    const updateCall = execMock.mock.calls[2]
    expect(updateCall[0]).toMatch(/LEAST\(100/)
    expect(result.hunger).toBe(100)
  })
})

// ── reset ─────────────────────────────────────────────────────────────────────

describe('VitalsRepository — reset', () => {
  it('inserts or updates to default values and returns the row', async () => {
    const defaults = vitalsRow()
    const conn = makeConn({
      execute: vi.fn()
        .mockResolvedValueOnce([{}])            // INSERT ON DUPLICATE KEY UPDATE
        .mockResolvedValueOnce([[defaults]])    // SELECT
    })
    const repo = new VitalsRepository(makePool(conn))
    const result = await repo.reset(CHAR_ID)
    expect(result.health).toBe(100)
    expect(result.stress).toBe(0)
    expect(result.armor).toBe(0)
  })
})
