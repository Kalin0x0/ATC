import { describe, it, expect, vi } from 'vitest'
import {
  ItemDefinitionRepository,
  ItemDefinitionDuplicateError,
  ItemDefinitionNotFoundError,
} from '@atc/db'

// ── Mock factories ────────────────────────────────────────────────────────────

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

function makePool(executeFn: ReturnType<typeof vi.fn>, conn?: ReturnType<typeof makeConn>) {
  return {
    execute: executeFn,
    ...(conn ? { getConnection: vi.fn().mockResolvedValue(conn) } : {}),
  } as unknown as ConstructorParameters<typeof ItemDefinitionRepository>[0]
}

function makeItemRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'water_bottle',
    label: 'Water Bottle',
    description: null,
    category: 'consumable',
    stackable: 1,
    max_stack: 100,
    weight_grams: 250,
    usable: 0,
    tradable: 1,
    metadata_schema_json: null,
    status: 'active',
    image_url: null,
    icon: null,
    tags_json: '[]',
    sort_order: 0,
    version: 1,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  }
}

// ── create ────────────────────────────────────────────────────────────────────

describe('ItemDefinitionRepository — create', () => {
  it('returns the created item definition on success', async () => {
    const row = makeItemRow()
    const exec = vi.fn()
      .mockResolvedValueOnce([undefined])     // INSERT
      .mockResolvedValueOnce([[row]])          // findById SELECT
    const repo = new ItemDefinitionRepository(makePool(exec))
    const result = await repo.create({ id: 'water_bottle', label: 'Water Bottle', category: 'consumable' })
    expect(result.id).toBe('water_bottle')
    expect(result.label).toBe('Water Bottle')
    expect(result.tags).toEqual([])
    expect(result.version).toBe(1)
  })

  it('throws ItemDefinitionDuplicateError on ER_DUP_ENTRY', async () => {
    const dupErr = Object.assign(new Error('Duplicate entry'), { code: 'ER_DUP_ENTRY' })
    const exec = vi.fn().mockRejectedValueOnce(dupErr)
    const repo = new ItemDefinitionRepository(makePool(exec))
    await expect(repo.create({ id: 'water_bottle', label: 'Water Bottle', category: 'consumable' }))
      .rejects.toBeInstanceOf(ItemDefinitionDuplicateError)
  })

  it('re-throws non-duplicate errors', async () => {
    const exec = vi.fn().mockRejectedValueOnce(new Error('ECONNREFUSED'))
    const repo = new ItemDefinitionRepository(makePool(exec))
    await expect(repo.create({ id: 'water_bottle', label: 'Water Bottle', category: 'consumable' }))
      .rejects.toThrow('ECONNREFUSED')
  })
})

// ── update ────────────────────────────────────────────────────────────────────

describe('ItemDefinitionRepository — update', () => {
  it('returns the updated item on success', async () => {
    const row = makeItemRow({ label: 'Updated Bottle', version: 2 })
    const exec = vi.fn()
      .mockResolvedValueOnce([{ affectedRows: 1 }])  // UPDATE
      .mockResolvedValueOnce([[row]])                  // findById SELECT
    const repo = new ItemDefinitionRepository(makePool(exec))
    const result = await repo.update('water_bottle', { label: 'Updated Bottle' })
    expect(result.label).toBe('Updated Bottle')
    expect(result.version).toBe(2)
  })

  it('throws ItemDefinitionNotFoundError when affectedRows is 0', async () => {
    const exec = vi.fn().mockResolvedValueOnce([{ affectedRows: 0 }])
    const repo = new ItemDefinitionRepository(makePool(exec))
    await expect(repo.update('missing_item', { label: 'Ghost' }))
      .rejects.toBeInstanceOf(ItemDefinitionNotFoundError)
  })

  it('includes tags in SET clause when tags are provided', async () => {
    const row = makeItemRow({ tags_json: '["food","drink"]' })
    const exec = vi.fn()
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[row]])
    const repo = new ItemDefinitionRepository(makePool(exec))
    const result = await repo.update('water_bottle', { tags: ['food', 'drink'] })
    expect(result.tags).toEqual(['food', 'drink'])
  })
})

// ── bulkUpsert ────────────────────────────────────────────────────────────────

describe('ItemDefinitionRepository — bulkUpsert', () => {
  it('returns empty result immediately for an empty items array', async () => {
    const exec = vi.fn()
    const repo = new ItemDefinitionRepository(makePool(exec))
    const result = await repo.bulkUpsert([])
    expect(result).toEqual({ upserted: 0, items: [] })
    expect(exec).not.toHaveBeenCalled()
  })

  it('wraps items in a transaction and returns upserted count', async () => {
    const rows = [makeItemRow(), makeItemRow({ id: 'bread', label: 'Bread' })]
    const conn = makeConn({
      execute: vi.fn().mockResolvedValue([undefined]),  // INSERT for each item
    })
    const poolExec = vi.fn().mockResolvedValueOnce([rows])  // SELECT after commit
    const repo = new ItemDefinitionRepository(makePool(poolExec, conn))

    const items = [
      { id: 'water_bottle', label: 'Water Bottle', category: 'consumable' },
      { id: 'bread', label: 'Bread', category: 'food' },
    ]
    const result = await repo.bulkUpsert(items)

    expect(conn.beginTransaction).toHaveBeenCalledOnce()
    expect(conn.execute).toHaveBeenCalledTimes(2)
    expect(conn.commit).toHaveBeenCalledOnce()
    expect(conn.release).toHaveBeenCalledOnce()
    expect(result.upserted).toBe(2)
    expect(result.items).toHaveLength(2)
  })

  it('rolls back and re-throws on transaction error', async () => {
    const conn = makeConn({
      execute: vi.fn().mockRejectedValueOnce(new Error('DB write failed')),
    })
    const poolExec = vi.fn()
    const repo = new ItemDefinitionRepository(makePool(poolExec, conn))

    await expect(repo.bulkUpsert([{ id: 'bad', label: 'Bad', category: 'x' }]))
      .rejects.toThrow('DB write failed')

    expect(conn.rollback).toHaveBeenCalledOnce()
    expect(conn.release).toHaveBeenCalledOnce()
  })
})

// ── listCatalog ───────────────────────────────────────────────────────────────

describe('ItemDefinitionRepository — listCatalog', () => {
  it('returns all items with no filters', async () => {
    const rows = [makeItemRow(), makeItemRow({ id: 'bread', label: 'Bread' })]
    const exec = vi.fn().mockResolvedValueOnce([rows])
    const repo = new ItemDefinitionRepository(makePool(exec))
    const result = await repo.listCatalog({ limit: 100, offset: 0 })
    expect(result).toHaveLength(2)
    expect(result[0]?.id).toBe('water_bottle')
  })

  it('returns empty array when no items match', async () => {
    const exec = vi.fn().mockResolvedValueOnce([[]])
    const repo = new ItemDefinitionRepository(makePool(exec))
    const result = await repo.listCatalog({ category: 'weapons', limit: 100, offset: 0 })
    expect(result).toEqual([])
  })

  it('parses tags_json correctly for returned rows', async () => {
    const row = makeItemRow({ tags_json: '["food","drink"]' })
    const exec = vi.fn().mockResolvedValueOnce([[row]])
    const repo = new ItemDefinitionRepository(makePool(exec))
    const result = await repo.listCatalog({ limit: 100, offset: 0 })
    expect(result[0]?.tags).toEqual(['food', 'drink'])
  })
})

// ── getUsageCount ─────────────────────────────────────────────────────────────

describe('ItemDefinitionRepository — getUsageCount', () => {
  it('returns the count from atc_character_inventory', async () => {
    const exec = vi.fn().mockResolvedValueOnce([[{ usage_count: 42 }]])
    const repo = new ItemDefinitionRepository(makePool(exec))
    const count = await repo.getUsageCount('water_bottle')
    expect(count).toBe(42)
  })

  it('returns 0 when no rows have that item', async () => {
    const exec = vi.fn().mockResolvedValueOnce([[{ usage_count: 0 }]])
    const repo = new ItemDefinitionRepository(makePool(exec))
    const count = await repo.getUsageCount('unused_item')
    expect(count).toBe(0)
  })
})

// ── safeDisable ───────────────────────────────────────────────────────────────

describe('ItemDefinitionRepository — safeDisable', () => {
  it('returns the disabled item on success', async () => {
    const row = makeItemRow({ status: 'disabled' })
    const exec = vi.fn()
      .mockResolvedValueOnce([{ affectedRows: 1 }])  // UPDATE
      .mockResolvedValueOnce([[row]])                  // findById
    const repo = new ItemDefinitionRepository(makePool(exec))
    const result = await repo.safeDisable('water_bottle')
    expect(result.status).toBe('disabled')
  })

  it('increments version in the UPDATE SQL (BUG-7-2)', async () => {
    const row = makeItemRow({ status: 'disabled', version: 2 })
    const exec = vi.fn()
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[row]])
    const repo = new ItemDefinitionRepository(makePool(exec))
    await repo.safeDisable('water_bottle')
    const updateSql = exec.mock.calls[0]?.[0] as string
    expect(updateSql).toContain('version = version + 1')
    expect(updateSql).toContain("status = 'disabled'")
  })

  it('throws ItemDefinitionNotFoundError when item does not exist', async () => {
    const exec = vi.fn().mockResolvedValueOnce([{ affectedRows: 0 }])
    const repo = new ItemDefinitionRepository(makePool(exec))
    await expect(repo.safeDisable('ghost_item'))
      .rejects.toBeInstanceOf(ItemDefinitionNotFoundError)
  })
})

// ── safeDeprecate ─────────────────────────────────────────────────────────────

describe('ItemDefinitionRepository — safeDeprecate', () => {
  it('returns the deprecated item on success', async () => {
    const row = makeItemRow({ status: 'deprecated' })
    const exec = vi.fn()
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[row]])
    const repo = new ItemDefinitionRepository(makePool(exec))
    const result = await repo.safeDeprecate('water_bottle')
    expect(result.status).toBe('deprecated')
  })

  it('increments version in the UPDATE SQL (BUG-7-2)', async () => {
    const row = makeItemRow({ status: 'deprecated', version: 3 })
    const exec = vi.fn()
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[row]])
    const repo = new ItemDefinitionRepository(makePool(exec))
    await repo.safeDeprecate('water_bottle')
    const updateSql = exec.mock.calls[0]?.[0] as string
    expect(updateSql).toContain('version = version + 1')
    expect(updateSql).toContain("status = 'deprecated'")
  })

  it('throws ItemDefinitionNotFoundError when item does not exist', async () => {
    const exec = vi.fn().mockResolvedValueOnce([{ affectedRows: 0 }])
    const repo = new ItemDefinitionRepository(makePool(exec))
    await expect(repo.safeDeprecate('ghost_item'))
      .rejects.toBeInstanceOf(ItemDefinitionNotFoundError)
  })
})

// ── listActive ────────────────────────────────────────────────────────────────

describe('ItemDefinitionRepository — listActive', () => {
  it('queries with WHERE status = active filter', async () => {
    const exec = vi.fn().mockResolvedValueOnce([[]])
    const repo = new ItemDefinitionRepository(makePool(exec))
    await repo.listActive()
    const sql = exec.mock.calls[0]?.[0] as string
    expect(sql).toContain("status = 'active'")
  })

  it('returns items mapped from DB rows', async () => {
    const rows = [makeItemRow(), makeItemRow({ id: 'bread', label: 'Bread', category: 'food' })]
    const exec = vi.fn().mockResolvedValueOnce([rows])
    const repo = new ItemDefinitionRepository(makePool(exec))
    const result = await repo.listActive()
    expect(result).toHaveLength(2)
    expect(result[0]?.id).toBe('water_bottle')
    expect(result[1]?.id).toBe('bread')
  })
})

// ── listCatalog combined filters ──────────────────────────────────────────────

describe('ItemDefinitionRepository — listCatalog combined filters', () => {
  it('builds SQL with both category and tag filter', async () => {
    const exec = vi.fn().mockResolvedValueOnce([[]])
    const repo = new ItemDefinitionRepository(makePool(exec))
    await repo.listCatalog({ category: 'food', tag: 'drink', limit: 100, offset: 0 })
    const sql = exec.mock.calls[0]?.[0] as string
    expect(sql).toContain('category = ?')
    expect(sql).toContain('JSON_CONTAINS')
    expect(sql).toContain('WHERE')
  })

  it('builds SQL with search LIKE filter using parameterized values', async () => {
    const exec = vi.fn().mockResolvedValueOnce([[]])
    const repo = new ItemDefinitionRepository(makePool(exec))
    await repo.listCatalog({ search: 'water', limit: 50, offset: 0 })
    const sql = exec.mock.calls[0]?.[0] as string
    const params = exec.mock.calls[0]?.[1] as unknown[]
    // SQL uses ? placeholder — not string concat
    expect(sql).toContain('LIKE ?')
    expect(sql).not.toContain('water')   // literal value must NOT appear in SQL string
    expect(params).toContain('%water%')   // value passed as bound parameter
  })
})
