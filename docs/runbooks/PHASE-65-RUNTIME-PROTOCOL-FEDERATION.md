# Phase 65 Runbook — Universal Runtime Protocol, Inter-System Contracts & Runtime Federation APIs

## Overview

Phase 65 introduces the universal runtime protocol layer for Atlantic Core. This phase establishes:

- **Runtime Protocols** — registered negotiation/federation/bridge/handshake/contract sessions between server nodes
- **Federation Contracts** — formal service-level agreements between initiator and target servers
- **Protocol Registry** — distributed service discovery endpoint registry (upsert-based, keyed by `node_id`)
- **Runtime Handshakes** — auth/capability/state-sync handshake lifecycle
- **Protocol Bridges** — inter-system gRPC/HTTP/WebSocket/TCP bridges (upsert-based, keyed by `bridge_id`)
- **Audit Log** — append-only protocol event log

---

## Package

**`@atc/runtime-protocol`** — `packages/runtime-protocol/`

### Key Files

| File | Purpose |
|---|---|
| `pool.ts` | Duck-typed pool interface (`RuntimeProtocolPool`) |
| `id.ts` | ULID generator via `ulidx` monotonicFactory |
| `errors.ts` | 8 typed error classes |
| `runtime-protocol.repository.ts` | CRUD + FOR UPDATE status transitions |
| `federation-contract.repository.ts` | CRUD + FOR UPDATE status transitions |
| `protocol-registry.repository.ts` | ON DUPLICATE KEY UPDATE upsert by `node_id` |
| `runtime-handshake.repository.ts` | CRUD + FOR UPDATE status transitions |
| `protocol-bridge.repository.ts` | ON DUPLICATE KEY UPDATE upsert by `bridge_id` |
| `protocol-audit.repository.ts` | INSERT-only audit log |
| `runtime-protocol.service.ts` | `RuntimeProtocolService` |
| `federation-contract.service.ts` | `FederationContractService` |
| `protocol-registry.service.ts` | `DistributedContractRegistry` |
| `runtime-handshake.service.ts` | `RuntimeHandshakeService` |
| `protocol-bridge.service.ts` | `InterSystemBridgeService` |
| `protocol-recovery.service.ts` | `ProtocolRecoveryService` — stale cleanup |

---

## Database Migrations

| Migration | Table | Purpose |
|---|---|---|
| 271 | `atc_runtime_protocols` | Protocol registrations with nonce uniqueness |
| 272 | `atc_federation_contracts` | Contracts with optional expiry |
| 273 | `atc_protocol_registry` | Node endpoint registry (UNIQUE on `node_id`) |
| 274 | `atc_runtime_handshakes` | Handshake lifecycle |
| 275 | `atc_protocol_bridges` | Bridge sessions (UNIQUE on `bridge_id`) |
| 276 | `atc_protocol_audit` | Append-only audit log |

---

## API Endpoints

### Runtime Protocol
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/runtime-protocol/register` | Register new protocol session |
| POST | `/api/v1/runtime-protocol/:id/pause` | Pause active protocol |
| POST | `/api/v1/runtime-protocol/:id/terminate` | Terminate protocol |
| GET | `/api/v1/runtime-protocol/:id` | Get protocol by ID |
| GET | `/api/v1/runtime-protocol/active` | List active protocols (optional `?ownerServerId=`) |

### Federation Contracts
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/runtime-protocol/contracts/register` | Register contract |
| POST | `/api/v1/runtime-protocol/contracts/:id/activate` | Activate pending contract |
| POST | `/api/v1/runtime-protocol/contracts/:id/revoke` | Revoke contract |
| GET | `/api/v1/runtime-protocol/contracts/:id` | Get contract |

### Protocol Registry
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/runtime-protocol/registry` | Upsert registry entry |
| POST | `/api/v1/runtime-protocol/registry/:nodeId/deregister` | Deregister node (204) |
| GET | `/api/v1/runtime-protocol/registry/:nodeId` | Get registry entry |

### Runtime Handshakes
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/runtime-protocol/handshake` | Initiate handshake |
| POST | `/api/v1/runtime-protocol/handshake/:id/acknowledge` | Acknowledge |
| POST | `/api/v1/runtime-protocol/handshake/:id/complete` | Complete |
| POST | `/api/v1/runtime-protocol/handshake/:id/reject` | Reject |
| GET | `/api/v1/runtime-protocol/handshake/:id` | Get handshake |

### Protocol Bridges
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/runtime-protocol/bridge` | Upsert bridge |
| POST | `/api/v1/runtime-protocol/bridge/:bridgeId/fail` | Mark bridge failed (204) |
| GET | `/api/v1/runtime-protocol/bridge/:bridgeId` | Get bridge |

### Cleanup
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/runtime-protocol/cleanup` | Cleanup stale records |

---

## FiveM Event Bridge

Lua bridge: `game/atc-core/server/runtime_protocol.lua`

### Events (Server-only)

| Event | Parameters | Description |
|---|---|---|
| `atc:protocol:register` | `protocolType, protocolNonce, protocolData` | Register protocol |
| `atc:protocol:pause` | `id` | Pause protocol |
| `atc:protocol:terminate` | `id` | Terminate protocol |
| `atc:contract:register` | `contractType, initiatorServerId, targetServerId, contractNonce, contractData, expiresAt?` | Register contract |
| `atc:contract:activate` | `id` | Activate contract |
| `atc:contract:revoke` | `id` | Revoke contract |
| `atc:registry:upsert` | `nodeId, endpointUrl, nodeType, endpointData` | Upsert registry |
| `atc:registry:deregister` | `nodeId` | Deregister node |
| `atc:handshake:initiate` | `handshakeType, initiatorServerId, remoteServerId, handshakeNonce, handshakeData` | Initiate handshake |
| `atc:handshake:acknowledge` | `id` | Acknowledge handshake |
| `atc:handshake:complete` | `id` | Complete handshake |
| `atc:handshake:reject` | `id` | Reject handshake |
| `atc:bridge:upsert` | `bridgeId, bridgeType, sourceSystemId, targetSystemId, bridgeData` | Upsert bridge |
| `atc:bridge:fail` | `bridgeId` | Fail bridge |
| `atc:protocol:cleanup` | `thresholdMs` | Trigger cleanup |

Cleanup runs automatically every 5 minutes via `CreateThread`.

---

## Error Reference

| Error Class | Trigger |
|---|---|
| `ProtocolNotFoundError` | Protocol ID not found in status update |
| `DuplicateProtocolError` | Duplicate `(protocol_nonce, owner_server_id)` |
| `FederationContractNotFoundError` | Contract ID not found |
| `DuplicateFederationContractError` | Duplicate contract nonce |
| `RegistryEntryNotFoundError` | Registry node not found |
| `HandshakeNotFoundError` | Handshake ID not found |
| `DuplicateHandshakeError` | Duplicate handshake nonce |
| `BridgeNotFoundError` | Bridge ID not found |

---

## Operational Notes

- Protocol registry and bridge tables use `ON DUPLICATE KEY UPDATE` for idempotent upserts
- `expiresAt` on federation contracts is stored as `DATETIME(3)` and passed as an ISO string from the API layer
- The cleanup endpoint prunes terminated/expired records older than `thresholdMs` milliseconds
- All status transitions use `FOR UPDATE` transactions to prevent concurrent state corruption
