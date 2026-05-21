# Phase 77 — Developer Platform, Runtime SDK Stabilization & Plugin Ecosystem Finalization

## Overview

Phase 77 finalizes the ATC developer ecosystem layer. It manages the developer platform lifecycle, SDK registry, plugin compatibility validation, extension lifecycle management, and runtime contract validation. Records in this phase represent the operational health and stability of the developer and plugin ecosystem.

**Package:** `@atc/developer-platform`
**API prefix:** `/api/v1/developer-platform`
**Migrations:** 343–348

---

## Architecture

### Services

| Service | Context field | Purpose |
|---|---|---|
| `DeveloperPlatformService` | `developerPlatformService` | Orchestrate developer platform lifecycle |
| `RuntimeSdkRegistryService` | `runtimeSdkRegistryService` | Register and manage SDK versions |
| `PluginCompatibilityService` | `pluginCompatibilityService` | Validate plugin compatibility |
| `ExtensionLifecycleService` | `extensionLifecycleService` | Manage extension runtime lifecycle |
| `RuntimeContractValidationService` | `runtimeContractValidationService` | Validate runtime contracts |
| `DeveloperRecoveryService` | `developerRecoveryService` | Stale-record cleanup across all repos |

### Tables

| Table | Key column | Cleanup states |
|---|---|---|
| `atc_developer_platform` | `platform_id` | `deprecated`, `archived`, `failed` |
| `atc_sdk_registry` | `sdk_id` (UPSERT) | `retired`, `failed` |
| `atc_plugin_compatibility` | `compatibility_id` | `incompatible`, `failed` |
| `atc_extension_runtime` | `extension_id` | `suspended`, `deactivated`, `failed` |
| `atc_contract_validation` | `contract_id` | `invalid`, `failed` |
| `atc_developer_audit` | — (append-only) | never |

---

## State Machines

### DeveloperPlatform
```
pending → active → deprecated → archived
               → failed
```

### SdkRegistry (UPSERT)
```
active → deprecated → retired
       → failed
```

### PluginCompatibility
```
pending → validating → compatible
                    → incompatible
                    → failed
```

### ExtensionRuntime
```
pending → active → suspended → deactivated
               → deactivated
               → failed
```

### ContractValidation
```
pending → validating → valid
                    → invalid
                    → failed
```

---

## API Endpoints

### Developer Platform
- `POST /api/v1/developer-platform` — create platform
- `POST /api/v1/developer-platform/:id/activate`
- `POST /api/v1/developer-platform/:id/deprecate`
- `GET  /api/v1/developer-platform/:id`

### SDK Registry
- `POST /api/v1/developer-platform/sdk` — register SDK (UPSERT by sdkId)
- `POST /api/v1/developer-platform/sdk/:sdkId/deprecate`
- `POST /api/v1/developer-platform/sdk/:sdkId/retire`
- `GET  /api/v1/developer-platform/sdk/:sdkId`

### Plugin Compatibility
- `POST /api/v1/developer-platform/compatibility` — create check
- `POST /api/v1/developer-platform/compatibility/:id/validate`
- `POST /api/v1/developer-platform/compatibility/:id/pass`
- `POST /api/v1/developer-platform/compatibility/:id/fail`
- `GET  /api/v1/developer-platform/compatibility/:id`

### Extension Lifecycle
- `POST /api/v1/developer-platform/extension` — create extension
- `POST /api/v1/developer-platform/extension/:id/activate`
- `POST /api/v1/developer-platform/extension/:id/suspend`
- `POST /api/v1/developer-platform/extension/:id/deactivate`
- `GET  /api/v1/developer-platform/extension/:id`

### Contract Validation
- `POST /api/v1/developer-platform/contract` — create contract
- `POST /api/v1/developer-platform/contract/:id/validate`
- `POST /api/v1/developer-platform/contract/:id/pass`
- `POST /api/v1/developer-platform/contract/:id/fail`
- `GET  /api/v1/developer-platform/contract/:id`

### Cleanup
- `POST /api/v1/developer-platform/cleanup` — body: `{ "thresholdMs": 300000 }`

---

## FiveM Events

Events registered in `game/atc-core/server/developer_platform.lua`.

| Event | Action |
|---|---|
| `atc:developer:platform:create` | Create platform |
| `atc:developer:platform:activate` | Activate platform |
| `atc:developer:platform:deprecate` | Deprecate platform |
| `atc:developer:sdk:register` | Register SDK (UPSERT) |
| `atc:developer:sdk:deprecate` | Deprecate SDK |
| `atc:developer:sdk:retire` | Retire SDK |
| `atc:developer:compatibility:create` | Create compatibility check |
| `atc:developer:compatibility:validate` | Begin validating |
| `atc:developer:compatibility:pass` | Pass compatibility |
| `atc:developer:compatibility:fail` | Fail compatibility |
| `atc:developer:extension:create` | Create extension |
| `atc:developer:extension:activate` | Activate extension |
| `atc:developer:extension:suspend` | Suspend extension |
| `atc:developer:extension:deactivate` | Deactivate extension |
| `atc:developer:contract:create` | Create contract |
| `atc:developer:contract:validate` | Begin validating |
| `atc:developer:contract:pass` | Pass contract |
| `atc:developer:contract:fail` | Fail contract |

Scheduled cleanup fires automatically every 5 minutes via `CreateThread`.

---

## EventBus Signals

| Signal | Emitted by |
|---|---|
| `sdk_registered` | `registerSdk` |
| `plugin_validated` | `passCompatibility` |
| `extension_activated` | `activateExtension` |
| `contract_validated` | `passContract` |

---

## Operational Checklist

- [ ] Verify migrations 343–348 applied
- [ ] Confirm all 6 context fields non-null at startup
- [ ] Test platform round-trip: create → activate → deprecate
- [ ] Test SDK UPSERT idempotency: register twice with same sdkId
- [ ] Test plugin compatibility: create → validate → pass (`validatedAt` present)
- [ ] Test extension: create → activate (`activatedAt` present) → suspend → deactivate
- [ ] Test contract: create → validate → pass (`validatedAt` present)
- [ ] Verify stale records cleaned up per entity
- [ ] Confirm audit entries on all state transitions
- [ ] Test cleanup with low threshold
- [ ] Verify FiveM bridge events reach the API
