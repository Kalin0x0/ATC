import { describe, it, expect } from 'vitest'
import {
  CraftingRuntimeError,
  RecipeNotFoundError,
  RecipeAlreadyExistsError,
  BlueprintNotFoundError,
  BlueprintAlreadyOwnedError,
  ManufacturingQueueNotFoundError,
  ManufacturingQueueOfflineError,
  ProductionJobNotFoundError,
  ProductionJobAlreadyActiveError,
  DuplicateJobNonceError,
  ProductionJobNotActiveError,
} from '@atc/crafting-runtime'
import {
  registerCraftingRecipeSchema,
  acquireBlueprintSchema,
  registerStationSchema,
  startProductionJobSchema,
  completeProductionJobSchema,
  failProductionJobSchema,
  cancelProductionJobSchema,
} from '@atc/operations'

// ── Error Hierarchy ───────────────────────────────────────────────────────────

describe('CraftingRuntimeError hierarchy', () => {
  it('RecipeNotFoundError extends CraftingRuntimeError', () => {
    const e = new RecipeNotFoundError('recipe-1')
    expect(e).toBeInstanceOf(CraftingRuntimeError)
    expect(e.message).toContain('recipe-1')
    expect(e.name).toBe('RecipeNotFoundError')
  })

  it('RecipeAlreadyExistsError extends CraftingRuntimeError', () => {
    const e = new RecipeAlreadyExistsError('recipe-2')
    expect(e).toBeInstanceOf(CraftingRuntimeError)
    expect(e.message).toContain('recipe-2')
  })

  it('BlueprintNotFoundError extends CraftingRuntimeError', () => {
    const e = new BlueprintNotFoundError('bp-1')
    expect(e).toBeInstanceOf(CraftingRuntimeError)
    expect(e.message).toContain('bp-1')
  })

  it('BlueprintAlreadyOwnedError extends CraftingRuntimeError', () => {
    const e = new BlueprintAlreadyOwnedError('principal-1', 'recipe-3')
    expect(e).toBeInstanceOf(CraftingRuntimeError)
    expect(e.message).toContain('principal-1')
    expect(e.message).toContain('recipe-3')
  })

  it('ManufacturingQueueNotFoundError extends CraftingRuntimeError', () => {
    const e = new ManufacturingQueueNotFoundError('station-1')
    expect(e).toBeInstanceOf(CraftingRuntimeError)
    expect(e.message).toContain('station-1')
  })

  it('ManufacturingQueueOfflineError extends CraftingRuntimeError', () => {
    const e = new ManufacturingQueueOfflineError('station-2')
    expect(e).toBeInstanceOf(CraftingRuntimeError)
    expect(e.message).toContain('station-2')
  })

  it('ProductionJobNotFoundError extends CraftingRuntimeError', () => {
    const e = new ProductionJobNotFoundError('job-1')
    expect(e).toBeInstanceOf(CraftingRuntimeError)
    expect(e.message).toContain('job-1')
  })

  it('ProductionJobAlreadyActiveError extends CraftingRuntimeError', () => {
    const e = new ProductionJobAlreadyActiveError('station-3')
    expect(e).toBeInstanceOf(CraftingRuntimeError)
    expect(e.message).toContain('station-3')
  })

  it('DuplicateJobNonceError extends CraftingRuntimeError', () => {
    const e = new DuplicateJobNonceError('nonce-abc')
    expect(e).toBeInstanceOf(CraftingRuntimeError)
    expect(e.message).toContain('nonce-abc')
  })

  it('ProductionJobNotActiveError extends CraftingRuntimeError', () => {
    const e = new ProductionJobNotActiveError('job-2')
    expect(e).toBeInstanceOf(CraftingRuntimeError)
    expect(e.message).toContain('job-2')
  })
})

// ── Schema Validation ─────────────────────────────────────────────────────────

describe('registerCraftingRecipeSchema', () => {
  it('accepts valid recipe', () => {
    const result = registerCraftingRecipeSchema.safeParse({
      recipeId:            'recipe-iron-ingot',
      recipeName:          'Iron Ingot Smelting',
      outputItemId:        'item-iron-ingot',
      outputQuantity:      5,
      recipeType:          'basic',
      craftingTimeSeconds: 120,
    })
    expect(result.success).toBe(true)
  })

  it('accepts recipe with optional fields', () => {
    const result = registerCraftingRecipeSchema.safeParse({
      recipeId:            'recipe-alloy',
      recipeName:          'Advanced Alloy',
      outputItemId:        'item-alloy',
      outputQuantity:      1,
      recipeType:          'industrial',
      requiredStation:     'station-furnace',
      craftingTimeSeconds: 600,
      isDiscoverable:      true,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid recipe type', () => {
    const result = registerCraftingRecipeSchema.safeParse({
      recipeId:            'recipe-1',
      recipeName:          'Test',
      outputItemId:        'item-1',
      outputQuantity:      1,
      recipeType:          'mythical',
      craftingTimeSeconds: 60,
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-positive crafting time', () => {
    const result = registerCraftingRecipeSchema.safeParse({
      recipeId:            'recipe-2',
      recipeName:          'Test',
      outputItemId:        'item-2',
      outputQuantity:      1,
      recipeType:          'basic',
      craftingTimeSeconds: 0,
    })
    expect(result.success).toBe(false)
  })
})

describe('acquireBlueprintSchema', () => {
  it('accepts valid blueprint acquisition', () => {
    const result = acquireBlueprintSchema.safeParse({
      principalId: 'principal-1',
      recipeId:    'recipe-iron-ingot',
      source:      'quest_reward',
    })
    expect(result.success).toBe(true)
  })

  it('requires all three fields', () => {
    const result = acquireBlueprintSchema.safeParse({
      principalId: 'principal-1',
      recipeId:    'recipe-1',
    })
    expect(result.success).toBe(false)
  })
})

describe('registerStationSchema', () => {
  it('accepts valid station', () => {
    const result = registerStationSchema.safeParse({
      stationId:   'station-forge-1',
      stationType: 'forge',
    })
    expect(result.success).toBe(true)
  })
})

describe('startProductionJobSchema', () => {
  it('accepts valid job', () => {
    const result = startProductionJobSchema.safeParse({
      queueId:                'station-forge-1',
      recipeId:               'recipe-iron-ingot',
      initiatedByPrincipalId: 'principal-1',
      quantityOrdered:        10,
      jobNonce:               'job-nonce-abc123',
    })
    expect(result.success).toBe(true)
  })

  it('requires jobNonce', () => {
    const result = startProductionJobSchema.safeParse({
      queueId:                'station-1',
      recipeId:               'recipe-1',
      initiatedByPrincipalId: 'principal-1',
      quantityOrdered:        5,
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-positive quantity', () => {
    const result = startProductionJobSchema.safeParse({
      queueId:                'station-1',
      recipeId:               'recipe-1',
      initiatedByPrincipalId: 'principal-1',
      quantityOrdered:        0,
      jobNonce:               'nonce-1',
    })
    expect(result.success).toBe(false)
  })
})

describe('completeProductionJobSchema', () => {
  it('accepts valid completion', () => {
    const result = completeProductionJobSchema.safeParse({
      jobId:            'job-1',
      quantityProduced: 10,
    })
    expect(result.success).toBe(true)
  })

  it('accepts zero quantity produced', () => {
    const result = completeProductionJobSchema.safeParse({
      jobId:            'job-2',
      quantityProduced: 0,
    })
    expect(result.success).toBe(true)
  })
})

describe('failProductionJobSchema', () => {
  it('accepts valid failure', () => {
    const result = failProductionJobSchema.safeParse({
      jobId:  'job-1',
      reason: 'Insufficient materials',
    })
    expect(result.success).toBe(true)
  })
})

describe('cancelProductionJobSchema', () => {
  it('accepts valid cancellation', () => {
    const result = cancelProductionJobSchema.safeParse({
      jobId:       'job-1',
      cancelledBy: 'principal-1',
    })
    expect(result.success).toBe(true)
  })
})
