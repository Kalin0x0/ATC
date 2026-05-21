import { describe, it, expect } from 'vitest'
import {
  CommunicationRuntimeError,
  RadioChannelNotFoundError,
  RadioChannelAlreadyExistsError,
  MembershipNotFoundError,
  MembershipAlreadyExistsError,
  SignalNotFoundError,
  EmergencyBroadcastNotFoundError,
  DuplicateBroadcastNonceError,
  EncryptedChannelNotFoundError,
} from '@atc/communication-runtime'
import {
  createRadioChannelSchema,
  joinChannelSchema,
  leaveChannelSchema,
  updateChannelStatusSchema,
  upsertSignalSchema,
  emergencyBroadcastSchema,
  cancelBroadcastSchema,
  setEncryptionSchema,
  reconcileSignalsSchema,
} from '@atc/operations'

// ── Error Hierarchy ───────────────────────────────────────────────────────────

describe('CommunicationRuntimeError hierarchy', () => {
  it('RadioChannelNotFoundError extends CommunicationRuntimeError', () => {
    const e = new RadioChannelNotFoundError('ch-1')
    expect(e).toBeInstanceOf(CommunicationRuntimeError)
    expect(e.message).toContain('ch-1')
    expect(e.name).toBe('RadioChannelNotFoundError')
  })

  it('RadioChannelAlreadyExistsError extends CommunicationRuntimeError', () => {
    const e = new RadioChannelAlreadyExistsError('ch-2')
    expect(e).toBeInstanceOf(CommunicationRuntimeError)
    expect(e.message).toContain('ch-2')
  })

  it('MembershipNotFoundError extends CommunicationRuntimeError', () => {
    const e = new MembershipNotFoundError('ch-1', 'principal-1')
    expect(e).toBeInstanceOf(CommunicationRuntimeError)
    expect(e.message).toContain('ch-1')
    expect(e.message).toContain('principal-1')
  })

  it('MembershipAlreadyExistsError extends CommunicationRuntimeError', () => {
    const e = new MembershipAlreadyExistsError('ch-1', 'principal-2')
    expect(e).toBeInstanceOf(CommunicationRuntimeError)
    expect(e.message).toContain('ch-1')
    expect(e.message).toContain('principal-2')
  })

  it('SignalNotFoundError extends CommunicationRuntimeError', () => {
    const e = new SignalNotFoundError('signal-1')
    expect(e).toBeInstanceOf(CommunicationRuntimeError)
    expect(e.message).toContain('signal-1')
  })

  it('EmergencyBroadcastNotFoundError extends CommunicationRuntimeError', () => {
    const e = new EmergencyBroadcastNotFoundError('broadcast-1')
    expect(e).toBeInstanceOf(CommunicationRuntimeError)
    expect(e.message).toContain('broadcast-1')
  })

  it('DuplicateBroadcastNonceError extends CommunicationRuntimeError', () => {
    const e = new DuplicateBroadcastNonceError('nonce-bc-1')
    expect(e).toBeInstanceOf(CommunicationRuntimeError)
    expect(e.message).toContain('nonce-bc-1')
  })

  it('EncryptedChannelNotFoundError extends CommunicationRuntimeError', () => {
    const e = new EncryptedChannelNotFoundError('ch-3')
    expect(e).toBeInstanceOf(CommunicationRuntimeError)
    expect(e.message).toContain('ch-3')
  })
})

// ── Schema Validation ─────────────────────────────────────────────────────────

describe('createRadioChannelSchema', () => {
  it('accepts valid channel', () => {
    const result = createRadioChannelSchema.safeParse({
      channelId:   'ch-dispatch-1',
      channelName: 'Dispatch Alpha',
      channelType: 'dispatch',
      frequency:   154.800,
    })
    expect(result.success).toBe(true)
  })

  it('accepts channel with all optional fields', () => {
    const result = createRadioChannelSchema.safeParse({
      channelId:         'ch-tactical-1',
      channelName:       'Tactical Bravo',
      channelType:       'tactical',
      frequency:         460.100,
      ownerPrincipalId:  'principal-pd-1',
      isEncrypted:       true,
      maxMembers:        20,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid channel type', () => {
    const result = createRadioChannelSchema.safeParse({
      channelId:   'ch-1',
      channelName: 'Test',
      channelType: 'secret',
      frequency:   100.0,
    })
    expect(result.success).toBe(false)
  })

  it('accepts all valid channel types', () => {
    for (const channelType of ['open', 'encrypted', 'emergency', 'dispatch', 'tactical'] as const) {
      const result = createRadioChannelSchema.safeParse({
        channelId:   `ch-${channelType}`,
        channelName: `${channelType} channel`,
        channelType,
        frequency:   100.0,
      })
      expect(result.success).toBe(true)
    }
  })
})

describe('joinChannelSchema', () => {
  it('accepts valid join', () => {
    const result = joinChannelSchema.safeParse({
      channelId:   'ch-1',
      principalId: 'principal-1',
    })
    expect(result.success).toBe(true)
  })

  it('accepts join with role', () => {
    const result = joinChannelSchema.safeParse({
      channelId:   'ch-1',
      principalId: 'principal-1',
      role:        'moderator',
    })
    expect(result.success).toBe(true)
  })
})

describe('leaveChannelSchema', () => {
  it('accepts valid leave', () => {
    const result = leaveChannelSchema.safeParse({
      channelId:   'ch-1',
      principalId: 'principal-1',
    })
    expect(result.success).toBe(true)
  })
})

describe('updateChannelStatusSchema', () => {
  it('accepts all valid statuses', () => {
    for (const status of ['active', 'inactive', 'jammed', 'offline'] as const) {
      const result = updateChannelStatusSchema.safeParse({ channelId: 'ch-1', status })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid status', () => {
    const result = updateChannelStatusSchema.safeParse({ channelId: 'ch-1', status: 'broken' })
    expect(result.success).toBe(false)
  })
})

describe('upsertSignalSchema', () => {
  it('accepts valid signal', () => {
    const result = upsertSignalSchema.safeParse({
      signalId:      'signal-radio-1',
      signalType:    'radio',
      strength:      85.0,
      ownerServerId: 'server-1',
    })
    expect(result.success).toBe(true)
  })

  it('accepts signal with all optional fields', () => {
    const result = upsertSignalSchema.safeParse({
      signalId:      'signal-enc-1',
      channelId:     'ch-1',
      signalType:    'encrypted',
      strength:      60.0,
      status:        'degraded',
      originZoneId:  'zone-1',
      ownerServerId: 'server-1',
    })
    expect(result.success).toBe(true)
  })

  it('rejects strength out of range', () => {
    const result = upsertSignalSchema.safeParse({
      signalId:      'signal-1',
      signalType:    'radio',
      strength:      150.0,
      ownerServerId: 'server-1',
    })
    expect(result.success).toBe(false)
  })
})

describe('emergencyBroadcastSchema', () => {
  it('accepts valid broadcast', () => {
    const result = emergencyBroadcastSchema.safeParse({
      broadcastNonce:         'nonce-bc-abc',
      initiatedByPrincipalId: 'principal-dispatch-1',
      message:                'Evacuation order for Zone 3',
      severity:               'critical',
    })
    expect(result.success).toBe(true)
  })

  it('accepts broadcast with optional fields', () => {
    const result = emergencyBroadcastSchema.safeParse({
      broadcastNonce:         'nonce-bc-xyz',
      initiatedByPrincipalId: 'principal-1',
      message:                'Test alert',
      severity:               'warning',
      targetZoneId:           'zone-downtown',
      expiresAt:              '2026-06-01T12:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid severity', () => {
    const result = emergencyBroadcastSchema.safeParse({
      broadcastNonce:         'nonce-1',
      initiatedByPrincipalId: 'principal-1',
      message:                'Test',
      severity:               'extreme',
    })
    expect(result.success).toBe(false)
  })

  it('accepts all severity levels', () => {
    for (const severity of ['info', 'warning', 'critical', 'emergency'] as const) {
      const result = emergencyBroadcastSchema.safeParse({
        broadcastNonce:         `nonce-${severity}`,
        initiatedByPrincipalId: 'principal-1',
        message:                'Test',
        severity,
      })
      expect(result.success).toBe(true)
    }
  })
})

describe('cancelBroadcastSchema', () => {
  it('accepts valid cancellation', () => {
    const result = cancelBroadcastSchema.safeParse({ broadcastId: 'broadcast-1' })
    expect(result.success).toBe(true)
  })
})

describe('setEncryptionSchema', () => {
  it('accepts valid encryption setup', () => {
    const result = setEncryptionSchema.safeParse({
      channelId:         'ch-encrypted-1',
      encryptionKeyHash: 'sha256-abc123def456',
    })
    expect(result.success).toBe(true)
  })
})

describe('reconcileSignalsSchema', () => {
  it('accepts default threshold', () => {
    const result = reconcileSignalsSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts custom threshold', () => {
    const result = reconcileSignalsSchema.safeParse({ thresholdMs: 60000 })
    expect(result.success).toBe(true)
  })

  it('rejects threshold below 1000ms', () => {
    const result = reconcileSignalsSchema.safeParse({ thresholdMs: 500 })
    expect(result.success).toBe(false)
  })
})
