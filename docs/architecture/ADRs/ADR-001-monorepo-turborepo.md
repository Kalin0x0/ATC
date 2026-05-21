# ADR-001: Use TurboRepo + pnpm Workspaces for Monorepo

**Status:** Accepted
**Date:** 2026-05-14
**Deciders:** ATC Core Team

## Context

ATC consists of multiple layers: FiveM Lua resources, a TypeScript API server, a React admin panel, shared type packages, and a plugin ecosystem. These layers have strong interdependencies (shared types, shared schemas, shared SDKs). Managing them as separate repositories would create:

- Version drift between shared packages
- Duplicated build tooling
- Complex cross-repo type sharing
- Difficult coordinated releases

## Decision

Use a **monorepo managed by TurboRepo and pnpm workspaces** to house all ATC packages, apps, plugins, and bridges in a single repository.

## Rationale

- **TurboRepo** provides incremental builds with remote caching — only changed packages rebuild. For a large codebase with many packages, this is critical for CI speed.
- **pnpm workspaces** are significantly faster than npm/yarn workspaces and have better disk usage (symlinks, content-addressable store).
- **Shared types** (`@atc/core`) are easily consumed by all packages without publishing to a registry.
- **Coordinated releases** — all packages version together, eliminating "which version of @atc/core does atc-inventory use?"
- **Consistent tooling** — one ESLint config, one Prettier config, one TypeScript base config.

## Alternatives Considered

### Polyrepo
Multiple separate Git repositories with packages published to a private npm registry.

Rejected because:
- Package publishing overhead slows development velocity
- Version mismatches between packages cause hard-to-debug issues
- Cross-cutting refactors require multiple PRs across repos
- Type errors between repos are only caught at runtime

### Nx
Feature-rich monorepo tool with code generation and affected-graph analysis.

Rejected because:
- Higher complexity and learning curve than TurboRepo
- TurboRepo is sufficient for ATC's needs
- TurboRepo integrates better with Vercel/Cloudflare (future consideration)

## Consequences

**Positive:**
- Fast incremental builds via TurboRepo remote cache
- Atomic commits across packages (no cross-repo coordination)
- Shared types and schemas with zero publishing overhead
- Single CI pipeline with parallel execution

**Negative:**
- Repository size grows over time (mitigated by sparse checkout if needed)
- Initial setup more complex than single package
- External contributors need to understand workspace structure
- Git history is shared across all packages (sometimes noisy)

**Mitigations:**
- `turbo.json` pipeline keeps tasks parallelized
- Per-package `package.json` scripts remain meaningful for local dev
- Clear `pnpm-workspace.yaml` documents what's in scope
