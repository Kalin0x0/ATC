# Phase 29 — Medical Intelligence & Investigation Analytics

**Owner:** Agent 2 (read/analytics side)
**Scope:** Read-only analytics over medical, dispatch, and law data
**Surface:** read-only HTTP routes + SDK + analytics services

## Goals

Transform ATC medical, law, and dispatch data into correlated investigative
intelligence: longitudinal patient history, responder analytics, trauma
analytics, case reconstruction, and incident–medical correlation.

This is a **read/analytics-only** layer. No mutation of source systems, no
gameplay outcomes derived from analytics, no automatic punishments.

## Package `@atc/medical-intelligence`

```
packages/medical-intelligence/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── limits.ts
    ├── cursor.ts
    ├── types.ts                  — MedicalReadRepositories interface + result DTOs
    ├── timeline.service.ts       — MedicalTimelineService
    ├── analytics.service.ts      — TraumaAnalyticsService (clinical + trauma + responder)
    ├── correlation.service.ts    — InvestigationCorrelationService
    ├── risk.service.ts           — MedicalRiskService
    └── sdk.ts                    — AtcMedicalIntelligenceSDK facade
```

### Dependency-light design

The package depends on lightweight repository **interfaces** rather than
the concrete `@atc/medical` package. This isolates the analytics layer from
the source-system writer code path and lets the SDK be wired against any
backing store that exposes the read methods listed in `MedicalReadRepositories`.

## Services

| Service | Methods |
|---|---|
| `MedicalTimelineService`         | `getTimeline(characterId, { limit, cursor, since, until })` |
| `TraumaAnalyticsService`         | `getClinicalHistory`, `getTraumaAnalytics`, `getResponderHistory` |
| `InvestigationCorrelationService` | `getIncidentCorrelation` |
| `MedicalRiskService`              | `computeRisk` (soft analytics, bounded [0,1]) |

The SDK `AtcMedicalIntelligenceSDK` exposes:
`getHistory`, `getTimeline`, `getRisk`, `getAnalytics`, `getResponderHistory`,
`getIncidentCorrelation`.

### Timeline kinds

`injury_recorded`, `trauma_changed`, `treatment_applied`, `hospital_admitted`,
`hospital_status_changed`, `hospital_discharged`, `medical_report_created`,
`patient_revived`, `patient_deceased`.

### Risk factors (bounded [0,1])

| Factor | Source | Weight |
|---|---|---|
| chronicTrauma                | rolling trauma transitions      | 0.20 |
| selfHarmIndicators           | minor injuries w/ no incident   | 0.15 |
| repeatViolence               | severity-weighted injury totals | 0.20 |
| highRiskResponderExposure    | max treatments by one responder | 0.10 |
| incidentClustering           | distinct incidents in window    | 0.15 |
| emergencyEscalationFrequency | hospitalizations + critical evt | 0.20 |

Score clamped to `[0,1]` and **explicitly soft** — consumers must not
derive automatic enforcement from this signal.

## API Routes

All routes require `Authorization: Bearer <apiToken>` plus `dispatch.read`:

| Route | Returns |
|---|---|
| `GET /api/v1/medical-intel/character/:id/history`     | `ClinicalHistorySummary` |
| `GET /api/v1/medical-intel/character/:id/timeline`    | `MedicalTimelinePage` |
| `GET /api/v1/medical-intel/character/:id/risk`        | `MedicalRiskScore` |
| `GET /api/v1/medical-intel/character/:id/analytics`   | `TraumaAnalyticsResult` |
| `GET /api/v1/medical-intel/responders/:id/history`    | `ResponderHistorySummary` |
| `GET /api/v1/medical-intel/incidents/:id/correlation` | `IncidentMedicalCorrelation` |

Validation via Zod schemas in `@atc/schemas`:
`medicalIntelCharacterParamSchema`, `medicalIntelIncidentParamSchema`,
`medicalIntelResponderParamSchema`, `medicalIntelTimelineQuerySchema`,
`medicalIntelWindowQuerySchema`. Timeline limit caps at 100; analytics
window caps at 365 days.

## Performance Protections (`MEDICAL_INTEL_LIMITS`)

| Limit | Value |
|---|---|
| MAX_LIMIT                 | 100 |
| DEFAULT_LIMIT             | 20  |
| MAX_TIMELINE_WINDOW_DAYS  | 365 |
| MAX_ANALYTICS_WINDOW_DAYS | 365 |
| MAX_BATCH                 | 200 |

- All source repo lookups happen via `Promise.all` (no N+1).
- Window inputs are clamped at the service boundary regardless of caller input.
- Per-source `MAX_BATCH` (200) keeps memory bounded even on heavy patients.
- Pagination uses an opaque base64url cursor with defensive decoding.

## Security

- Every route guarded by `requireCapability('dispatch.read')`.
- IDs validated by Zod (trim + 1–64 chars).
- Repository read methods wrapped in `.catch(() => [])` so a single
  repo outage degrades gracefully instead of failing the whole timeline.
- Sensitive notes/diagnosis text is currently passed through; redaction
  of free-text PII is deferred to Phase 30 (an explicit `redactor`
  injection point in the SDK is planned).

## Wiring

```typescript
import { AtcMedicalIntelligenceSDK } from '@atc/medical-intelligence'

const medicalIntelSdk = new AtcMedicalIntelligenceSDK({
  repos: {
    injuries:   { listByCharacter: (id, n) => injuryRepo.listByCharacter(id, n) },
    trauma:     { listByCharacter: (id, n) => traumaRepo.listByCharacter(id, n) },
    treatments: {
      listByCharacter: (id, n) => treatmentRepo.listByCharacter(id, n),
      listByResponder: (id, n) => treatmentRepo.listByResponder(id, n),
      listByIncident:  (id, n) => treatmentRepo.listByIncident(id, n),
    },
    reports:    {
      listByCharacter: (id, n) => reportRepo.listByCharacter(id, n),
      listByIncident:  (id, n) => reportRepo.listByIncident(id, n),
    },
    hospital:   { listByCharacter: (id, n) => hospitalRepo.listByCharacter(id, n) },
  },
})

ctx.medicalIntelSdk = medicalIntelSdk
```

## Testing

```
pnpm --filter @atc/tests run test -- medical-intelligence
```

Covers: cursor round-trip + garbage rejection, timeline aggregation +
ordering + pagination + since/until filter, revive/deceased detection,
fail-soft on repo errors, clinical history counts, trauma analytics
repeated-region detection, window clamping at 365 days, severity weight
table, correlation aggregation, risk score bounds, self-harm pattern
detection, SDK read-only surface, schema cap enforcement.

## Risks & Follow-ups

- Risk score weights are heuristic. A calibration pass against historical
  operational data is recommended before basing reports on these scores.
- Free-text fields (`notes`, `diagnosis`) are passed through. A redaction
  layer for PII should be added before exposing the timeline to lower-trust
  read clients.
- Responder workload only reflects treatment events; on-scene presence
  via dispatch responder assignments is correlated via Phase 28's
  entity-graph instead.
- The package depends on injected read interfaces — if Agent 1's
  `@atc/medical` repository signatures change, the wiring shim above must
  be updated, but the analytics surface remains stable.
