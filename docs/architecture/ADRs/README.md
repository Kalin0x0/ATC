# Architecture Decision Records (ADRs)

ADRs document significant architectural decisions: what was decided, why, and what alternatives were considered and rejected.

## Format

Each ADR is a Markdown file with:
- **Status:** Proposed | Accepted | Deprecated | Superseded
- **Context:** The problem or situation requiring a decision
- **Decision:** What was decided
- **Rationale:** Why this option was chosen
- **Alternatives Considered:** What else was evaluated and why rejected
- **Consequences:** Trade-offs and implications

## Index

| ADR | Title | Status |
|---|---|---|
| [ADR-001](ADR-001-monorepo-turborepo.md) | Use TurboRepo for Monorepo | Accepted |
| [ADR-002](ADR-002-rest-api-over-tcp.md) | REST API for FiveM-to-Backend Communication | Accepted |
| [ADR-003](ADR-003-redis-runtime-state.md) | Redis for Runtime State and Pub/Sub | Accepted |
| [ADR-004](ADR-004-plugin-manifest-system.md) | Plugin Manifest System for Module Isolation | Accepted |
| [ADR-005](ADR-005-server-authoritative-model.md) | Server-Authoritative Validation Model | Accepted |

## Creating a New ADR

1. Copy the template below
2. Number sequentially: `ADR-006-short-title.md`
3. Fill in all sections
4. Set status to `Proposed`
5. After team review, change to `Accepted`

## Template

```markdown
# ADR-XXX: Title

**Status:** Proposed
**Date:** YYYY-MM-DD
**Deciders:** ATC Core Team

## Context
...

## Decision
...

## Rationale
...

## Alternatives Considered
...

## Consequences
...
```
