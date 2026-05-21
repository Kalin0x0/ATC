# ADR-004: Plugin Manifest System for Module Isolation

**Status:** Accepted
**Date:** 2026-05-14
**Deciders:** ATC Core Team

## Context

ATC features are delivered as plugins. The platform needs a way to:
- Declare plugin identity (id, version, author)
- Declare dependencies (both required and optional)
- Declare SDK permissions needed (principle of least privilege)
- Declare events published and consumed (for documentation and validation)
- Support semantic versioning for compatibility checking
- Enable hot-swapping of plugins without Core restart

Without a manifest system, plugins would be opaque — no way to validate compatibility, check permissions, or document contracts.

## Decision

Every ATC plugin (including first-party ones) must include an `atc.manifest.json` file at its root. ATC Core reads this manifest on resource start and:
- Validates API version compatibility
- Resolves dependency load order (topological sort)
- Grants declared permissions
- Registers declared events with the Event Bus
- Rejects plugins requesting permissions not declared in manifest

## Rationale

- **Industry standard**: Every serious plugin platform (VS Code extensions, WordPress, Maven, etc.) uses a manifest/descriptor pattern.
- **Dependency resolution**: Without a manifest, load order is undefined. Manifests enable topological sorting so atc-identity loads before atc-inventory (which depends on it).
- **Permission principle of least privilege**: If a plugin says it needs `economy.read` but tries to call `economy.write`, Core rejects it. This prevents plugins from silently accessing data they shouldn't.
- **Self-documenting API**: The `events.publishes` and `events.subscribes` fields make the plugin's event contract explicit — no code diving required.
- **Version compatibility checking**: `apiVersion` allows Core to reject plugins built for a deprecated API version before they cause runtime errors.

## Alternatives Considered

### Convention-based discovery (no manifest)
Plugins are discovered by resource naming convention. Dependencies inferred from `dependency` lines in fxmanifest.lua.

Rejected because:
- No permission system possible
- No version compatibility checking
- Event contracts are undocumented
- Cannot validate plugin API usage at startup

### Central plugin registry (server-managed)
Plugins registered in a database table rather than a manifest file.

Rejected because:
- Requires DB access before resources can start (bootstrap chicken-and-egg)
- Harder to version control (DB state vs file state)
- Manifest-in-file is atomic with the code — they version together in git

### fxmanifest.lua extension
Extend FiveM's existing `fxmanifest.lua` with ATC-specific fields.

Rejected because:
- `fxmanifest.lua` is a FiveM-controlled format — adding custom fields is fragile
- JSON is significantly easier to parse and validate with TypeScript tooling
- Having a separate `atc.manifest.json` makes ATC's requirements clear and independent of FiveM internals

## Consequences

**Positive:**
- Plugin compatibility is checked at startup, not at runtime crash
- Dependency ordering is automatic and correct
- Permission violations fail at resource start (not mid-session)
- Event contracts are machine-readable (enables future tooling: plugin validator, API docs generator)

**Negative:**
- Every plugin author must write and maintain a manifest
- Manifest must stay in sync with actual code (can drift)
- Adds an additional file to the plugin structure

**Mitigations:**
- `pnpm generate:plugin` scaffold creates a pre-filled manifest
- CI runs manifest validator to catch schema errors
- LSP schema (`$schema` field) provides IDE autocomplete and validation
