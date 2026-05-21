# Phase 45 — Communication, Radio & Signal Runtime

## Overview

Server-authoritative communication system for radio channels, memberships, signal state, emergency broadcasts, and encryption key management. Channel membership uses a UNIQUE(channel_id, principal_id) constraint; broadcast_nonce UNIQUE enforces idempotency at the DB layer.

## Package

`@atc/communication-runtime` — `/packages/communication-runtime`

## DB Tables

| Table | Purpose |
|---|---|
| `atc_radio_channels` | Channel definitions with type, frequency, and status |
| `atc_radio_memberships` | Per-principal channel membership and role assignments |
| `atc_signal_runtime` | Real-time signal strength and status per server |
| `atc_emergency_broadcasts` | Emergency broadcast records with nonce idempotency |
| `atc_encrypted_channels` | Encryption key hash registry for channels |
| `atc_communication_audit` | Append-only communication audit log |

## Migrations

151–156 (`packages/db/migrations/151_create_radio_channels.sql` through `156_create_communication_audit.sql`)

## API Endpoints

| Method | Path | Capability | Purpose |
|---|---|---|---|
| POST | `/api/v1/comms/channels` | `comms:write` | Create a radio channel |
| GET | `/api/v1/comms/channels` | `comms:read` | List all channels |
| POST | `/api/v1/comms/channels/:channelId/join` | `comms:write` | Join a channel |
| POST | `/api/v1/comms/channels/:channelId/leave` | `comms:write` | Leave a channel |
| POST | `/api/v1/comms/channels/:channelId/jam` | `comms:write` | Jam a channel |
| POST | `/api/v1/comms/channels/:channelId/restore` | `comms:write` | Restore a jammed channel |
| POST | `/api/v1/comms/channels/:channelId/encryption` | `comms:write` | Set channel encryption key |
| POST | `/api/v1/comms/signals` | `comms:write` | Upsert signal state |
| GET | `/api/v1/comms/signals` | `comms:read` | List active signals |
| POST | `/api/v1/comms/signals/reconcile` | `comms:write` | Remove stale signals |
| POST | `/api/v1/comms/broadcasts` | `comms:write` | Issue emergency broadcast |
| GET | `/api/v1/comms/broadcasts` | `comms:read` | List active broadcasts |
| POST | `/api/v1/comms/broadcasts/:broadcastId/cancel` | `comms:write` | Cancel a broadcast |

## EventBus Events Emitted

| Event | Payload | When |
|---|---|---|
| `atc:comms:channel:created` | `{ channelId }` | After channel creation |
| `atc:comms:channel:joined` | `{ channelId, principalId }` | After member joined |
| `atc:comms:channel:left` | `{ channelId, principalId }` | After member left |
| `atc:comms:channel:jammed` | `{ channelId }` | After jamming |
| `atc:comms:channel:restored` | `{ channelId }` | After restoration |
| `atc:comms:signal:updated` | `{ signalId, status }` | After signal upsert |
| `atc:comms:signal:degraded` | `{ signalId }` | After signal degradation |
| `atc:comms:signal:lost` | `{ signalId }` | After signal loss |
| `atc:comms:emergency:broadcast` | `{ broadcastId, severity, targetZoneId }` | After broadcast |
| `atc:comms:emergency:cancelled` | `{ broadcastId }` | After broadcast cancellation |
| `atc:comms:encryption:set` | `{ channelId }` | After encryption key set |

## FiveM SDK

`ATC.Comms.CreateChannel(params, cb)` — create channel  
`ATC.Comms.ListChannels(cb)` — list channels  
`ATC.Comms.JoinChannel(channelId, principalId, role, cb)` — join channel  
`ATC.Comms.LeaveChannel(channelId, principalId, cb)` — leave channel  
`ATC.Comms.JamChannel(channelId, cb)` — jam channel  
`ATC.Comms.RestoreChannel(channelId, cb)` — restore channel  
`ATC.Comms.UpsertSignal(params, cb)` — upsert signal  
`ATC.Comms.ListActiveSignals(cb)` — list active signals  
`ATC.Comms.ReconcileSignals(thresholdMs, cb)` — remove stale signals  
`ATC.Comms.Broadcast(params, cb)` — issue emergency broadcast  
`ATC.Comms.ListActiveBroadcasts(cb)` — list active broadcasts  
`ATC.Comms.CancelBroadcast(broadcastId, cb)` — cancel broadcast  
`ATC.Comms.SetEncryption(channelId, encryptionKeyHash, cb)` — set encryption key

## Concurrency Model

- `RadioChannelRepository.updateStatus()` uses `SELECT FOR UPDATE` — prevents concurrent jam/restore races.
- `SignalRuntimeRepository.updateStatus()` uses `SELECT FOR UPDATE` — prevents signal state races.
- `EmergencyBroadcastRepository.updateStatus()` uses `SELECT FOR UPDATE` — prevents double-cancel.
- `broadcast_nonce` UNIQUE constraint: `ER_DUP_ENTRY` → `DuplicateBroadcastNonceError`.
- UNIQUE(channel_id, principal_id) on `atc_radio_memberships`: `ER_DUP_ENTRY` → `MembershipAlreadyExistsError`.

## Ops Checklist

- [ ] Run migrations 151–156 before deploying
- [ ] Ensure `comms:write` and `comms:read` capabilities are granted to the game server principal
- [ ] Register core channels (dispatch, emergency) at server startup
- [ ] Schedule signal reconcile periodically (e.g., every 60 seconds) with threshold matching tick interval
- [ ] Monitor `atc_emergency_broadcasts` for expired active broadcasts — call `expireStale()` periodically
- [ ] `atc_communication_audit` is append-only — no DELETE without audit retention policy review

## Error Reference

| Error | HTTP | Meaning |
|---|---|---|
| `RadioChannelNotFoundError` | 404 | Channel ID does not exist |
| `RadioChannelAlreadyExistsError` | 409 | Channel already exists |
| `MembershipNotFoundError` | 404 | Membership record does not exist |
| `MembershipAlreadyExistsError` | 409 | Principal already a member of channel |
| `SignalNotFoundError` | 404 | Signal ID does not exist |
| `EmergencyBroadcastNotFoundError` | 404 | Broadcast ID does not exist |
| `DuplicateBroadcastNonceError` | 409 | Broadcast nonce already used |
| `EncryptedChannelNotFoundError` | 404 | Encrypted channel record does not exist |
