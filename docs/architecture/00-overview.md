# ATC Architecture Overview

## Vision

Atlantic Core (ATC) is a next-generation persistent world platform for FiveM. It is designed as an **MMO-class live-service backend** — not a roleplay framework skin over QB or ESX.

ATC provides:
- A modular, plugin-driven game platform
- An enterprise-grade, server-authoritative security model
- A persistent MMO-style world with dynamic systems
- A developer SDK for first- and third-party plugin authors
- Compatibility bridges for legacy framework scripts

---

## Guiding Principles

| Principle | Description |
|---|---|
| **Server Authority** | The server is the single source of truth. The client is a display layer. |
| **Event-Driven** | All cross-module communication happens through the Event Bus, not direct calls. |
| **Plugin Isolation** | Every feature is a plugin with a manifest, versioning, and declared permissions. |
| **Security by Default** | All events are rate-limited, validated, and audited. Risk scoring is built in. |
| **No Framework Coupling** | QB/ESX/Qbox/ND-Core are only ever accessed through bridges, never internally. |
| **Translation-First** | Zero hardcoded strings. All text flows through the localization system. |
| **Scalability-Ready** | Architecture supports horizontal scaling, Redis clustering, and service extraction. |
| **Observability** | Every service emits structured logs, metrics, and traces. |

---

## System Architecture

```
╔══════════════════════════════════════════════════════════════════╗
║                       CLIENT LAYER                               ║
║  ┌─────────────────────────────────────────────────────────┐    ║
║  │  FiveM Game Client (GTA V)                               │    ║
║  │  ┌──────────────────┐  ┌──────────────────────────────┐ │    ║
║  │  │  Lua Client Code  │  │  React NUI (Browser Layer)   │ │    ║
║  │  │  ATC.SDK (client) │  │  Zustand + i18next + Tailwind│ │    ║
║  │  └────────┬─────────┘  └─────────────┬────────────────┘ │    ║
║  └───────────┼──────────────────────────┼──────────────────┘    ║
╚══════════════┼══════════════════════════┼═════════════════════════╝
               │ FiveM NetEvents           │ NUI PostMessage
               ▼                           ▼
╔══════════════════════════════════════════════════════════════════╗
║                      FIVEM SERVER LAYER                          ║
║  ┌─────────────────────────────────────────────────────────┐    ║
║  │  [atc] — Core FiveM Resource                            │    ║
║  │  ┌──────────────────────────────────────────────────┐   │    ║
║  │  │  Event Firewall  │  Session Manager  │  SDK Host  │   │    ║
║  │  └──────────────────────────────────────────────────┘   │    ║
║  │                                                          │    ║
║  │  Plugin Resources (each is an isolated FiveM resource)  │    ║
║  │  [atc-identity] [atc-inventory] [atc-economy] [...]     │    ║
║  └────────────────────────┬────────────────────────────────┘    ║
╚═══════════════════════════┼══════════════════════════════════════╝
                            │ HTTP (REST) / Redis Pub-Sub
                            ▼
╔══════════════════════════════════════════════════════════════════╗
║                       API SERVICE LAYER                          ║
║  ┌────────────────────────────────────────────────────────┐     ║
║  │  ATC API Server (Node.js / TypeScript)                  │     ║
║  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │     ║
║  │  │ Player   │ │ Economy  │ │Inventory │ │Territory │  │     ║
║  │  │ Service  │ │ Service  │ │ Service  │ │ Service  │  │     ║
║  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │     ║
║  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │     ║
║  │  │ Housing  │ │ Vehicle  │ │  Admin   │ │Telemetry │  │     ║
║  │  │ Service  │ │ Service  │ │ Service  │ │ Service  │  │     ║
║  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │     ║
║  └────────────────────────┬────────────────────────────────┘    ║
╚═══════════════════════════┼══════════════════════════════════════╝
                            │
              ┌─────────────┼──────────────┐
              ▼             ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────────┐
        │ MariaDB  │  │  Redis   │  │  Object Store│
        │(persist) │  │(runtime) │  │  (evidence,  │
        │          │  │          │  │   media)     │
        └──────────┘  └──────────┘  └──────────────┘
```

---

## Data Flow: Player Action

```
1. Player presses key → Client Lua receives input
2. Client sends TriggerServerEvent('atc:inventory:request:use_item', payload)
3. Event Firewall validates: is event whitelisted? is player rate-limited?
4. ATC Core validates: is player alive? does player own item?
5. ATC SDK calls API: POST /api/v1/inventory/{playerId}/use
6. API Service validates Zod schema, checks business rules
7. Repository writes to MariaDB, updates Redis cache
8. API returns result to FiveM via HTTP response
9. FiveM emits TriggerClientEvent('atc:inventory:item:used', source, result)
10. Client updates NUI state via Zustand
11. Audit log entry written asynchronously
```

---

## Domain Model

```
World
 ├── Players (Identity, Character, Session)
 ├── Economy (Currency, Transactions, Markets)
 ├── Inventory (Items, Containers, Metadata)
 ├── Territory (Zones, Control Points, Ownership)
 ├── Housing (Properties, Furniture, Access)
 ├── Vehicles (Registry, Mods, Ownership)
 ├── Jobs/Careers (Factions, Ranks, Tasks)
 ├── Combat (Health, Injuries, Respawn)
 ├── Social (Groups, Gangs, Friends)
 ├── Dispatch (Emergency calls, Units)
 └── Admin (Moderation, Bans, Audit)
```

---

## Plugin Execution Model

```
Bootstrap sequence:
1. [atc] resource starts → loads ATC Core, Event Bus, SDK
2. [atc-sdk] resource starts → exposes SDK to other resources
3. Plugin resources start in dependency order (per manifest)
4. Each plugin registers its event handlers with ATC Core
5. ATC Core starts accepting player connections
6. Players connect → identity verified → session created
```

---

## Compatibility Strategy

Legacy framework support is provided through opt-in compatibility bridges:

```
[qbcore-bridge] resource
  → intercepts exports['qb-core']:GetPlayer()
  → translates to ATC.SDK.Player.Get()
  → returns QB-formatted response

[esx-bridge] resource
  → intercepts ESX.GetPlayerData()
  → translates to ATC.SDK.Player.Get()
  → returns ESX-formatted response
```

Bridges are **completely optional** and do not affect ATC internals.

---

## Scalability Path

| Phase | Scale | Architecture |
|---|---|---|
| Phase 1 | 1-64 players | Single server, single API, single DB |
| Phase 2 | 64-256 players | API replicated, Redis cluster, read replicas |
| Phase 3 | 256+ players | Service extraction, message queue, sharded state |
| Phase 4 | MMO scale | Microservices, event streaming (Kafka), distributed sessions |

ATC is designed so Phase 1 runs on a VPS and Phase 4 is architecturally achievable without rewriting business logic.
