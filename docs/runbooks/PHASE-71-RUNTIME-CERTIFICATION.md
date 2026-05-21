# Phase 71 — Runtime Certification, Validation & Deterministic Compliance Enforcement

## Overview

Phase 71 introduces server-authoritative certification and compliance enforcement for the ATC runtime. It manages the full lifecycle of runtime certifications, deterministic state validations, compliance policies, and runtime verifications, coordinated across distributed server instances.

**Package:** `@atc/runtime-certification`
**API prefix:** `/api/v1/runtime-certification`
**Migrations:** 307–312

---

## Architecture

### Services

| Service | Context field | Purpose |
|---|---|---|
| `RuntimeCertificationService` | `runtimeCertificationService` | Certify/revoke/expire runtime certifications |
| `DeterministicValidationService` | `deterministicValidationService` | Run deterministic state/transition validations |
| `ComplianceEnforcementService` | `complianceEnforcementService` | Enforce runtime compliance policies |
| `RuntimeVerificationService` | `runtimeVerificationService` | Verify runtime state integrity |
| `DistributedComplianceCoordinator` | `distributedComplianceCoordinator` | Coordinate compliance across server cluster |
| `CertificationRecoveryService` | `certificationRecoveryService` | Stale-record cleanup across all repos |

### Tables

| Table | Key column | Cleanup states |
|---|---|---|
| `atc_runtime_certification` | `certification_id` | `expired`, `revoked`, `failed` |
| `atc_deterministic_validation` | `validation_id` | `passed`, `failed`, `skipped` |
| `atc_runtime_compliance` | `compliance_id` | `violated`, `expired`, `bypassed` |
| `atc_verification_runtime` | `verification_id` | `verified`, `failed` |
| `atc_compliance_coordination` | `coordination_id` (VARCHAR, UPSERT) | `suspended`, `completed` |
| `atc_certification_audit` | — (append-only) | never |

---

## State Machines

### RuntimeCertification
```
pending → certified | revoked | failed | expired
```

### DeterministicValidation
```
pending → running → passed | failed | skipped
```

### RuntimeCompliance
```
active → enforced | violated | expired
```

### RuntimeVerification
```
pending → verifying → verified | failed
```

---

## API Endpoints

### Certifications
- `POST /api/v1/runtime-certification` — create
- `POST /api/v1/runtime-certification/:id/certify`
- `POST /api/v1/runtime-certification/:id/revoke`
- `POST /api/v1/runtime-certification/:id/expire`
- `POST /api/v1/runtime-certification/:id/fail`
- `GET  /api/v1/runtime-certification/:id`

### Validations
- `POST /api/v1/runtime-certification/validation`
- `POST /api/v1/runtime-certification/validation/:id/begin`
- `POST /api/v1/runtime-certification/validation/:id/pass`
- `POST /api/v1/runtime-certification/validation/:id/fail`
- `POST /api/v1/runtime-certification/validation/:id/skip`
- `GET  /api/v1/runtime-certification/validation/:id`

### Compliance
- `POST /api/v1/runtime-certification/compliance`
- `POST /api/v1/runtime-certification/compliance/:id/enforce`
- `POST /api/v1/runtime-certification/compliance/:id/violate`
- `POST /api/v1/runtime-certification/compliance/:id/expire`
- `GET  /api/v1/runtime-certification/compliance/:id`

### Verification
- `POST /api/v1/runtime-certification/verification`
- `POST /api/v1/runtime-certification/verification/:id/begin`
- `POST /api/v1/runtime-certification/verification/:id/pass`
- `POST /api/v1/runtime-certification/verification/:id/fail`
- `GET  /api/v1/runtime-certification/verification/:id`

### Coordination
- `POST /api/v1/runtime-certification/coordination`
- `POST /api/v1/runtime-certification/coordination/:id/suspend`
- `POST /api/v1/runtime-certification/coordination/:id/complete`
- `GET  /api/v1/runtime-certification/coordination/:coordinationId`

### Cleanup
- `POST /api/v1/runtime-certification/cleanup` — body: `{ "thresholdMs": 300000 }`

---

## FiveM Events

Events are registered in `game/atc-core/server/runtime_certification.lua`.

| Event | Action |
|---|---|
| `atc:certification:create` | Create certification |
| `atc:certification:certify` | Certify |
| `atc:certification:revoke` | Revoke |
| `atc:certification:validation:create` | Create validation |
| `atc:certification:validation:begin` | Begin validating |
| `atc:certification:validation:pass` | Pass validation |
| `atc:certification:compliance:create` | Create compliance |
| `atc:certification:compliance:enforce` | Enforce compliance |
| `atc:certification:verification:create` | Create verification |
| `atc:certification:verification:begin` | Begin verifying |
| `atc:certification:verification:pass` | Pass verification |
| `atc:certification:coordination:upsert` | Upsert coordination |
| `atc:certification:cleanup` | Manual cleanup trigger |

Scheduled cleanup fires automatically every 5 minutes via `CreateThread`.

---

## Idempotency

All certification, validation, compliance, and verification records use `(nonce, owner_server_id)` UNIQUE constraints. Duplicate nonce submissions return `ER_DUP_ENTRY` which maps to `DuplicateRuntimeCertificationError` (and domain equivalents). Callers should treat this as a no-op and fetch the existing record by ID.

Coordination records use `ON DUPLICATE KEY UPDATE` on `coordination_id` — safe to call repeatedly.

---

## Cleanup

The `CertificationRecoveryService.cleanupStale(thresholdMs)` method fans out cleanup across all five repos and returns counts per domain:

```typescript
{ certifications, validations, compliances, verifications, coordinations }
```

Stale thresholds are relative to `updated_at`. Records stuck in terminal-adjacent states older than the threshold are eligible for deletion.

---

## Operational Checklist

- [ ] Verify migrations 307–312 applied cleanly: `SHOW TABLES LIKE 'atc_%'`
- [ ] Confirm all 6 context fields are non-null at startup (check for 503 responses)
- [ ] Test certification round-trip: create → certify → GET
- [ ] Test compliance round-trip: create → enforce → GET
- [ ] Verify cleanup fires automatically (check logs every 5 min)
- [ ] Confirm audit table receives entries on state transitions
- [ ] Verify duplicate nonce returns 400/409, not 500
