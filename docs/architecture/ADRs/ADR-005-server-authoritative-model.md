# ADR-005: Server-Authoritative Validation Model

**Status:** Accepted
**Date:** 2026-05-14
**Deciders:** ATC Core Team

## Context

FiveM is an open modification platform. Players can — and frequently do — modify their client-side code, use memory editors, or exploit script behavior. Any game value that the client controls and the server trusts is a potential exploit vector.

Common attacks in poorly designed FiveM frameworks:
- Client-side "give money" calls trusted by server
- Client sends fake item IDs or counts that server accepts
- Client sends impossible coordinates (teleport exploits)
- Client triggers events with arbitrary payloads
- Rate limit bypass via rapid event firing
- Item duplication via concurrent requests

## Decision

ATC enforces a **strict server-authoritative model**:

1. The server never trusts client-provided game state (positions, item counts, balances, entity IDs)
2. All game-state decisions are made server-side
3. The client is a **display layer only** — it shows what the server tells it
4. Every client → server event passes through the Event Firewall (whitelist, rate limit, Zod validation)
5. Player risk score accumulates for suspicious behavior patterns
6. Business logic executes in the API server, not in FiveM Lua scripts

## Rationale

- **Adversarial environment**: FiveM servers attract modders and exploiters. Any trust placed in client-side data will be exploited.
- **Real money at stake**: ATC includes economy systems. Economy exploits have direct real-world impact (in-game economies affect player experience, server reputation, and potentially real monetary value if trading exists).
- **Previous frameworks**: QBCore, ESX, and similar frameworks have documented history of exploits caused by trusting client-sent money amounts, item counts, and entity states.
- **MMO precedent**: All serious MMO backends are server-authoritative. Client-authoritative physics/position in an MMO is a known security anti-pattern (speed hacks, teleport hacks).

## Alternatives Considered

### Client-Authoritative with Server Verification
Client calculates results, server spot-checks.

Rejected because:
- "Spot-check" logic is always exploitable by finding the bypass
- Complex to implement correctly — verification logic must be as thorough as full server-side calculation
- Any gap in verification is an exploit vector
- The performance savings don't justify the security risk for ATC's scale

### Trusted Client Calculations for Performance
Allow client to calculate some values (e.g., weight) and trust them to reduce server round-trips.

Rejected because:
- Weight calculation is precisely what item duplication exploits abuse
- 1-3ms additional latency per operation is acceptable
- Server-side calculation ensures correctness; client calculation ensures nothing

### Hybrid: Trust for Low-Stakes, Verify for High-Stakes
Trust client for cosmetic actions, verify for economy/inventory.

Partially accepted — this is the optimistic update policy:
- Cosmetic NUI state changes are client-side (showing a menu open)
- All data mutations (items, money, health) are server-authoritative
- The line is: "does this affect game state that has any exploit value?" If yes, server-authoritative.

## Consequences

**Positive:**
- Eliminates entire classes of exploits (dupe, money hack, item hack)
- Predictable, consistent game state
- Security review is simpler (one validation layer, not many)
- Easier to roll back exploited state (server has the real values)

**Negative:**
- Higher latency for player actions (key press → server round trip → client update ~10-30ms)
- More complex event flow (cannot simply update client-side and be done)
- Developer discipline required — new plugin authors must understand the model

**Mitigations:**
- Client-side animations and UI feedback play immediately (optimistic for visuals only)
- ATC Core enforces the model through the Event Firewall — plugins cannot bypass it even accidentally
- SDK is designed to make the correct pattern easy: `ATC.SDK.Inventory.AddItem()` handles everything
- Risk score system catches anomalous behavior patterns for players who try to circumvent individual checks
