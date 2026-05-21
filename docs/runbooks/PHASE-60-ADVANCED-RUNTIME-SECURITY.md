# PHASE-60 — Advanced Runtime Security, Intrusion Response & Autonomous Protection

## Overview

Phase 60 adds the runtime security layer: real-time intrusion detection, autonomous threat classification, entity isolation, security escalation, and threat containment. All classifications are server-authoritative. Client-reported events are sanitised and rate-limited before ingestion.

## Package

`packages/security-runtime` — `@atc/security-runtime`

## Services

| Service | Responsibility |
|---|---|
| `RuntimeIntrusionDetectionService` | Detect and resolve intrusions |
| `AutonomousProtectionService` | Detect and mitigate threats |
| `RuntimeIsolationService` | Isolate / release entities |
| `SecurityEscalationService` | Create and resolve escalations |
| `ThreatContainmentService` | Contain / complete / fail containments |
| `RuntimeSecurityRecoveryService` | Cleanup stale intrusions, threats, containments |

## Database Tables

| Table | Key Columns |
|---|---|
| `atc_runtime_intrusions` | `intrusion_id`, `status`, `intrusion_nonce` (UNIQUE) |
| `atc_runtime_threats` | `threat_id`, `status`, `threat_nonce` (UNIQUE) |
| `atc_runtime_isolation` | `entity_id` (UNIQUE KEY for upsert) |
| `atc_security_escalations` | `escalation_id`, `status`, `escalation_nonce` (UNIQUE) |
| `atc_threat_containment` | `containment_id`, `status`, `containment_nonce` (UNIQUE) |
| `atc_security_audit` | append-only event log |

## API Routes

```
POST /api/v1/security-runtime/intrusions/detect
POST /api/v1/security-runtime/intrusions/:id/resolve
GET  /api/v1/security-runtime/intrusions/:id
GET  /api/v1/security-runtime/intrusions/active

POST /api/v1/security-runtime/threats/detect
POST /api/v1/security-runtime/threats/:id/mitigate
GET  /api/v1/security-runtime/threats/:id

POST /api/v1/security-runtime/isolate
POST /api/v1/security-runtime/isolation/:entityId/release
GET  /api/v1/security-runtime/isolation/:entityId

POST /api/v1/security-runtime/escalations/create
POST /api/v1/security-runtime/escalations/:id/resolve
GET  /api/v1/security-runtime/escalations/:id

POST /api/v1/security-runtime/contain
POST /api/v1/security-runtime/containments/:id/complete
POST /api/v1/security-runtime/containments/:id/fail
GET  /api/v1/security-runtime/containments/:id

POST /api/v1/security-runtime/cleanup
```

## FiveM Bridge Events

| Event | Direction | Description |
|---|---|---|
| `atc:security:intrusion:detect` | Server-only | Record a detected intrusion |
| `atc:security:intrusion:resolve` | Server-only | Mark intrusion resolved |
| `atc:security:threat:detect` | Server-only | Record a detected threat |
| `atc:security:threat:mitigate` | Server-only | Mitigate active threat |
| `atc:security:isolate` | Server-only | Isolate an entity |
| `atc:security:isolation:release` | Server-only | Release isolation |
| `atc:security:escalation:create` | Server-only | Create escalation |
| `atc:security:escalation:resolve` | Server-only | Resolve escalation |
| `atc:security:contain` | Server-only | Start containment |
| `atc:security:containment:complete` | Server-only | Complete containment |
| `atc:security:containment:fail` | Server-only | Fail containment |
| `atc:security:report` | Client→Server (rate-limited) | Player reports suspicious activity |
| `atc:security:runtime:cleanup` | Scheduler | Purge stale records |

## Migrations

- `0241_create_atc_runtime_intrusions.sql`
- `0242_create_atc_runtime_threats.sql`
- `0243_create_atc_runtime_isolation.sql`
- `0244_create_atc_security_escalations.sql`
- `0245_create_atc_threat_containment.sql`
- `0246_create_atc_security_audit.sql`

## Severity Levels

`critical` → `high` → `medium` → `low`

Autonomous escalation policy (recommended): any `critical` intrusion should automatically trigger an isolation + escalation within 1 system tick.

## Client Event Security

The `atc:security:report` event is the only client-permitted entry point. It is:
- Rate-limited to 20 calls per 60 seconds per source
- All client-supplied values validated server-side (type, length)
- Submitted as an `intrusion_type = 'player_report'` with severity `low`
- Never trusted to carry severity or entity ownership claims

## Isolation Semantics

Isolation is upserted by `entity_id` — re-isolating an already-isolated entity is safe and updates the record. `releaseIsolation` uses `FOR UPDATE` to prevent concurrent release + re-isolate races.

## Cleanup

`POST /api/v1/security-runtime/cleanup` with `{ thresholdMs: 300000 }` purges:
- Resolved/false-positive intrusions older than threshold
- Mitigated threats older than threshold
- Completed/failed containments older than threshold

Recommended scheduler interval: every 5 minutes.

## Deployment Checklist

- [ ] Run migrations 0241–0246
- [ ] Deploy `@atc/security-runtime` package
- [ ] Verify intrusion detect → resolve lifecycle via API
- [ ] Verify entity isolation → release lifecycle
- [ ] Verify client `atc:security:report` is rate-limited (test with >20 rapid calls)
- [ ] Schedule cleanup job at 5-minute interval
- [ ] Review audit log ingestion pipeline for `atc_security_audit`
