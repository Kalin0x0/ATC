# ADR-002: REST API for FiveM-to-Backend Communication

**Status:** Accepted
**Date:** 2026-05-14
**Deciders:** ATC Core Team

## Context

FiveM servers need to communicate with the ATC backend for data persistence, business logic execution, and cross-service coordination. The question is: what protocol and pattern should govern this communication?

Options considered:
1. REST API (HTTP)
2. Direct database access from Lua
3. Custom TCP socket protocol
4. GraphQL
5. gRPC

## Decision

Use **HTTP REST API** as the primary communication mechanism between FiveM Lua and the TypeScript backend. Use **Redis pub/sub** for backend-to-FiveM event push.

## Rationale

- **Ecosystem support**: FiveM's `PerformHttpRequest` is a well-supported, stable API. HTTP is universally understood.
- **Simplicity over TCP**: A custom TCP protocol would require a custom FiveM server-side socket implementation, adding complexity with no compelling benefit at Phase 1 scale.
- **No direct DB from Lua**: Direct MariaDB access from Lua (via oxmysql) is fast but bypasses the entire security, validation, and business logic layer. A player could potentially exploit any script that writes directly to DB.
- **REST is debuggable**: HTTP calls are visible in logs, traceable with headers, and testable with curl/Postman. Custom TCP is not.
- **GraphQL rejected**: Too complex for machine-to-machine communication. GraphQL shines for client-driven API queries, not server-to-server.
- **gRPC considered**: Would give binary efficiency but FiveM Lua has no gRPC client. Would require a proxy layer, adding complexity for marginal gain.

## Alternatives Considered

### Direct oxmysql from Lua
Each FiveM resource queries MariaDB directly via oxmysql.

Rejected because:
- No centralized validation or business logic layer
- Race conditions between concurrent Lua scripts
- DB credentials must be in server config (accessible to all resources)
- Impossible to add cross-cutting concerns (rate limiting, fraud detection)
- Does not support future service extraction

### Custom TCP WebSocket
FiveM connects to backend via WebSocket for bidirectional streaming.

Rejected (for Phase 1) because:
- FiveM's native WebSocket client support is limited
- HTTP polling is simpler and sufficient for Phase 1 load
- WebSocket/SSE upgrade is planned for Phase 2 for event push (backend → FiveM)

## Consequences

**Positive:**
- Clean separation of game logic (Lua) from business logic (TypeScript)
- All security validation happens in one place (API server)
- API can be scaled independently of FiveM server
- Easy to mock in tests
- Standard HTTP debugging tools work

**Negative:**
- HTTP overhead vs direct DB (typically 1-5ms — acceptable)
- FiveM → API calls are asynchronous; Lua must use callbacks or coroutines
- Network failure handling required (retry logic in SDK `_http.lua`)

**Planned Evolution:**
- Phase 2: Replace polling-based event subscription with Server-Sent Events (SSE)
- Phase 3: Consider gRPC for high-frequency internal service calls if performance demands it
