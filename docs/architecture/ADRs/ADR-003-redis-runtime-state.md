# ADR-003: Redis for Runtime State and Event Distribution

**Status:** Accepted
**Date:** 2026-05-14
**Deciders:** ATC Core Team

## Context

ATC needs to manage two categories of non-persistent state:

1. **Runtime state** — data that exists only while the server is running: player sessions, spawned vehicle locations, door lock states, active bans (cached for fast lookup).
2. **Hot-path cache** — frequently read data that would overload MariaDB if queried every request: player inventories, economy balances.
3. **Cross-process communication** — the API server needs to push events to the FiveM process (they are separate processes, possibly on different machines).

## Decision

Use **Redis 7.x** for:
- Runtime state storage (sessions, locks, ephemeral state)
- Cache layer (inventory, balance, territory state)
- Pub/Sub for API → FiveM event distribution
- Rate limiting counters

MariaDB remains the source of truth for all persistent data.

## Rationale

- **Redis is the standard** for this use case. It is battle-tested in MMO and live-service contexts.
- **Sub-millisecond latency** for in-memory operations vs MariaDB disk reads.
- **TTL support** — Redis natively handles session expiry, rate limit windows, and lock timeouts.
- **Pub/Sub** — a natural fit for the EventBus pattern. Redis pub/sub allows the API server to push events to multiple FiveM processes (future multi-server scaling).
- **Atomic operations** — `INCR`, `SETNX`, `EXPIRE` atomics make rate limiting and mutex locks correct without application-level locking.

## Alternatives Considered

### In-memory state in Node.js process
Store runtime state in Node.js Maps/Objects.

Rejected because:
- State is lost on API server restart
- Cannot be shared across multiple API instances (Phase 2 scaling)
- No pub/sub capability
- No TTL — manual cleanup required

### Memcached for caching only
Use Memcached instead of Redis.

Rejected because:
- No pub/sub capability (would need a separate solution for event distribution)
- No Lua scripting (used for atomic operations)
- Less ecosystem support
- Redis is a strict superset of what Memcached offers

### Direct MariaDB polling for events
FiveM polls a `pending_events` table.

Rejected because:
- High DB load (polling creates constant reads even when no events)
- Latency: polling interval (e.g., 100ms) introduces event lag
- Complexity: managing event acknowledgment, deletion, and ordering in SQL

## Consequences

**Positive:**
- < 1ms state reads for hot-path data
- Correct distributed rate limiting and locking
- Decoupled event distribution (API doesn't know about FiveM directly)
- Easy to add a second API instance behind a load balancer

**Negative:**
- Redis is a required infrastructure dependency
- Redis failure means loss of all session state (players must reconnect after Redis restart)
- Data in Redis is not durable by default (configure AOF or RDB for critical data)
- Redis keys require careful ownership discipline (documented in `12-redis-strategy.md`)

**Mitigation:**
- Redis persistence configured with AOF for ban records and territory state (no TTL keys)
- Warm-up script on API restart restores critical state from MariaDB
- Redis Sentinel or Cluster for high availability (Phase 2)
