# Phase 75 — Distributed Runtime Hardening, Final Security Closure & Immutable Production Guarantees

## Overview

Phase 75 applies the final security hardening layer to ATC's runtime infrastructure. It provides immutable security policy enforcement, distributed security validation, runtime seal verification, and autonomous threat mitigation. Records in this phase represent security-critical operations that must be audited and are fail-soft toward distributed consensus.

**Package:** `@atc/runtime-hardening`
**API prefix:** `/api/v1/runtime-hardening`
**Migrations:** 331–336

---

## Architecture

### Services

| Service | Context field | Purpose |
|---|---|---|
| `RuntimeHardeningService` | `runtimeHardeningService` | Orchestrate runtime hardening lifecycle |
| `ImmutableSecurityCoordinator` | `immutableSecurityCoordinator` | Apply and enforce immutable security policies |
| `DistributedSecurityValidationService` | `distributedSecurityValidationService` | Run distributed security validations |
| `RuntimeSealVerificationService` | `runtimeSealVerificationService` | Verify production runtime seals |
| `AutonomousThreatMitigationService` | `autonomousThreatMitigationService` | Detect and mitigate threats autonomously |
| `HardeningRecoveryService` | `hardeningRecoveryService` | Stale-record cleanup across all repos |

### Tables

| Table | Key column | Cleanup states |
|---|---|---|
| `atc_runtime_hardening` | `hardening_id` | `violated`, `failed` |
| `atc_immutable_security` | `security_id` | `violated`, `expired`, `failed` |
| `atc_security_validation` | `validation_id` | `passed`, `failed`, `expired` |
| `atc_runtime_seal_validation` | `seal_validation_id` | `verified`, `broken`, `failed` |
| `atc_threat_mitigation` | `mitigation_id` | `mitigated`, `failed`, `expired` |
| `atc_hardening_audit` | — (append-only) | never |

---

## State Machines

### RuntimeHardening
```
pending → hardening → hardened
                    → violated
                    → failed
```

### ImmutableSecurity
```
pending → active → violated
               → expired
               → failed
```

### SecurityValidation
```
pending → validating → passed
                     → failed
                     → expired
```

### SealValidation
```
pending → verifying → verified
                    → broken
                    → failed
```

### ThreatMitigation
```
pending → mitigating → mitigated
                     → failed
                     → expired
```

---

## API Endpoints

### Runtime Hardening
- `POST /api/v1/runtime-hardening` — initiate hardening
- `POST /api/v1/runtime-hardening/:id/begin`
- `POST /api/v1/runtime-hardening/:id/harden`
- `POST /api/v1/runtime-hardening/:id/violate`
- `POST /api/v1/runtime-hardening/:id/fail`
- `GET  /api/v1/runtime-hardening/:id`

### Immutable Security
- `POST /api/v1/runtime-hardening/security` — create security policy
- `POST /api/v1/runtime-hardening/security/:id/enforce`
- `POST /api/v1/runtime-hardening/security/:id/violate`
- `GET  /api/v1/runtime-hardening/security/:id`

### Security Validation
- `POST /api/v1/runtime-hardening/validation` — create validation
- `POST /api/v1/runtime-hardening/validation/:id/begin`
- `POST /api/v1/runtime-hardening/validation/:id/pass`
- `POST /api/v1/runtime-hardening/validation/:id/fail`
- `GET  /api/v1/runtime-hardening/validation/:id`

### Seal Validation
- `POST /api/v1/runtime-hardening/seal-validation` — body must include `resourceId`
- `POST /api/v1/runtime-hardening/seal-validation/:id/begin`
- `POST /api/v1/runtime-hardening/seal-validation/:id/verify`
- `POST /api/v1/runtime-hardening/seal-validation/:id/break`
- `GET  /api/v1/runtime-hardening/seal-validation/:id`

### Threat Mitigation
- `POST /api/v1/runtime-hardening/mitigation` — create mitigation
- `POST /api/v1/runtime-hardening/mitigation/:id/begin`
- `POST /api/v1/runtime-hardening/mitigation/:id/complete`
- `POST /api/v1/runtime-hardening/mitigation/:id/fail`
- `GET  /api/v1/runtime-hardening/mitigation/:id`

### Cleanup
- `POST /api/v1/runtime-hardening/cleanup` — body: `{ "thresholdMs": 300000 }`

---

## FiveM Events

Events registered in `game/atc-core/server/runtime_hardening.lua`.

| Event | Action |
|---|---|
| `atc:hardening:initiate` | Initiate hardening |
| `atc:hardening:begin` | Begin hardening |
| `atc:hardening:harden` | Apply hardened state |
| `atc:hardening:violate` | Mark violated |
| `atc:hardening:fail` | Mark failed |
| `atc:hardening:security:create` | Create security policy |
| `atc:hardening:security:enforce` | Enforce policy |
| `atc:hardening:security:violate` | Violate security |
| `atc:hardening:validation:create` | Create validation |
| `atc:hardening:validation:begin` | Begin validating |
| `atc:hardening:validation:pass` | Pass validation |
| `atc:hardening:validation:fail` | Fail validation |
| `atc:hardening:seal_validation:create` | Create seal validation |
| `atc:hardening:seal_validation:begin` | Begin verification |
| `atc:hardening:seal_validation:verify` | Verify seal |
| `atc:hardening:seal_validation:break` | Break seal |
| `atc:hardening:mitigation:create` | Create mitigation |
| `atc:hardening:mitigation:begin` | Begin mitigation |
| `atc:hardening:mitigation:complete` | Complete mitigation |
| `atc:hardening:mitigation:fail` | Fail mitigation |
| `atc:hardening:cleanup` | Manual cleanup trigger |

Scheduled cleanup fires automatically every 5 minutes via `CreateThread`.

---

## EventBus Signals

| Signal | Emitted by |
|---|---|
| `immutable_hardening_verified` | `hardenRuntime`, `enforcePolicy`, `passValidation` |
| `runtime_seal_verified` | `verifyRuntimeSeal` |
| `autonomous_threat_mitigated` | `completeMitigation` |

---

## Seal Validation Safety

The `atc_runtime_seal_validation` table requires `resource_id NOT NULL` on creation. This links each seal validation to the resource being verified (epoch ID, production seal ID, etc.). A `verified` seal validation confirms the associated resource's integrity.

---

## Operational Checklist

- [ ] Verify migrations 331–336 applied
- [ ] Confirm all 6 context fields non-null at startup
- [ ] Test hardening round-trip: initiate → begin → harden → GET (`hardenedAt` present)
- [ ] Test security policy: create → enforce → GET (`enforcedAt` present)
- [ ] Test validation: create → begin → pass → GET (`validatedAt` present)
- [ ] Test seal validation: create (with resourceId) → begin → verify → GET (`verifiedAt` present)
- [ ] Test mitigation: create → begin → complete → GET (`mitigatedAt` present)
- [ ] Verify `violated` and `failed` hardenings are cleaned up
- [ ] Confirm audit entries on all state transitions
- [ ] Test cleanup with low threshold
