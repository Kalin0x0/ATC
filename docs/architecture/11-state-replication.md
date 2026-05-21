# State Replication Architecture

## State Classification

ATC state is divided into four categories based on where it lives and how it flows:

| Category | Where | Lifetime | Example |
|---|---|---|---|
| **Persistent State** | MariaDB | Permanent | Character data, economy balance, vehicle ownership |
| **Runtime State** | Redis | Session/TTL | Online players, spawned vehicles, door states |
| **Client Cache** | Zustand (NUI) / Lua table | Until event | Displayed inventory, HUD data, nearby players |
| **Ephemeral State** | FiveM entity network | While entity exists | Vehicle position, player coords |

---

## Server Authority Model

```
THE SERVER IS THE ONLY SOURCE OF TRUTH.

Client             Server
  │                  │
  │──[input]────────►│  Client sends intent (key press, button click)
  │                  │  Server validates + executes
  │◄──[state]────────│  Server pushes authoritative state back
  │                  │
  │ Client NEVER:    │
  │  - calculates    │
  │  - stores items  │
  │  - tracks money  │
  │  - validates     │
```

---

## State Flow Diagrams

### Player Joins

```
1. Player connects
2. FiveM → API: POST /api/v1/players/session/start
3. API → MariaDB: load character data
4. API → Redis: SET atc:session:{identifier} (TTL: session)
5. API → Redis: SET atc:player:source:{source}
6. API → Redis: SADD atc:player:online
7. API → FiveM: session started response
8. FiveM: spawn player, set position
9. FiveM → Client: send initial state payload
10. Client: populate Zustand store from payload
```

### Item Added

```
1. Plugin logic: ATC.SDK.Inventory.AddItem(charId, 'water', 1)
2. SDK → API: POST /api/v1/inventory/{charId}/add
3. API: validate permissions, check weight
4. API → MariaDB: INSERT inventory_items
5. API → Redis: DEL atc:inventory:player:{charId}  (invalidate cache)
6. API → EventBus: emit atc:inventory:item:added
7. FiveM subscribes → TriggerClientEvent('atc:inventory:item:added', source, payload)
8. Client: Zustand store updated
9. NUI: inventory grid re-renders
```

### Player Disconnects

```
1. FiveM: playerDropped fires
2. FiveM → API: DELETE /api/v1/players/session/end
3. API → Redis: DEL atc:session:{identifier}
4. API → Redis: DEL atc:player:source:{source}
5. API → Redis: SREM atc:player:online
6. API → MariaDB: UPDATE player_sessions SET disconnected_at = NOW()
7. API → EventBus: emit atc:player:disconnected
8. Subscribed services clean up their state
   - Economy: flush balance cache
   - Inventory: flush inventory cache
   - Vehicle: garage-in any spawned vehicle
   - Housing: remove from occupants
```

---

## Client-Side State (Zustand)

### Store Structure

```typescript
// plugins/atc-inventory/ui/store/inventory.store.ts

interface InventoryState {
    items: InventoryItem[]
    weight: number
    maxWeight: number
    hotbar: (InventoryItem | null)[]
    isOpen: boolean

    // Actions
    setItems: (items: InventoryItem[]) => void
    addItem: (item: InventoryItem) => void
    removeItem: (slot: number) => void
    setOpen: (open: boolean) => void
    reset: () => void
}

const useInventoryStore = create<InventoryState>((set) => ({
    items: [],
    weight: 0,
    maxWeight: 30,
    hotbar: Array(5).fill(null),
    isOpen: false,

    setItems: (items) => set({ items }),
    addItem: (item) => set((state) => ({
        items: [...state.items, item],
        weight: state.weight + (item.weight * item.quantity)
    })),
    removeItem: (slot) => set((state) => ({
        items: state.items.filter(i => i.slot !== slot)
    })),
    setOpen: (open) => set({ isOpen: open }),
    reset: () => set({ items: [], weight: 0, hotbar: Array(5).fill(null) })
}))
```

### NUI ↔ Lua Bridge

```lua
-- plugins/atc-inventory/client/nui.lua

-- Send initial state to NUI on open
RegisterNetEvent('atc:inventory:open')
AddEventHandler('atc:inventory:open', function(inventoryData)
    SendNUIMessage({
        type = 'INVENTORY_OPEN',
        payload = inventoryData
    })
    SetNuiFocus(true, true)
end)

-- Receive updates from server, push to NUI
RegisterNetEvent('atc:inventory:item:added')
AddEventHandler('atc:inventory:item:added', function(payload)
    SendNUIMessage({
        type = 'INVENTORY_ITEM_ADDED',
        payload = payload
    })
end)
```

```typescript
// plugins/atc-inventory/ui/index.tsx

window.addEventListener('message', (event) => {
    const { type, payload } = event.data

    switch (type) {
        case 'INVENTORY_OPEN':
            useInventoryStore.getState().setItems(payload.items)
            useInventoryStore.getState().setOpen(true)
            break
        case 'INVENTORY_ITEM_ADDED':
            useInventoryStore.getState().addItem(payload.item)
            break
        case 'INVENTORY_ITEM_REMOVED':
            useInventoryStore.getState().removeItem(payload.slot)
            break
    }
})
```

---

## Optimistic Updates

ATC does **not** use optimistic updates for inventory or economy mutations — these are too exploitable. Instead:

```
PATTERN:
1. User clicks "Use Item"
2. UI shows loading state (item slot dims)
3. Client sends event to server
4. Server validates + executes
5. Server pushes new state to client
6. UI updates from authoritative state
7. Loading state removed

NOT:
1. User clicks "Use Item"
2. UI immediately removes item (optimistic)
3. Server validates...
   - If OK: no UI change needed
   - If FAIL: need to rollback UI (race condition risk)
```

Optimistic updates are allowed for **non-economic, cosmetic** actions only (e.g., opening a UI, playing an animation) where there is no exploitable advantage.

---

## State Synchronization on Reconnect

When a player reconnects after a crash/disconnect:

```
1. Player reconnects with same identifier
2. Server checks for ghost session (previous session not properly closed)
3. If ghost session exists:
   - Force-close the previous session
   - Recover vehicle state (put back in garage if spawned)
   - Recover housing state (remove from occupants)
4. Load fresh state from MariaDB (authoritative)
5. Populate Redis session
6. Send full initial state payload to client
```

This ensures stale state never persists.

---

## HUD State

The HUD is updated via lightweight events — not full inventory syncs:

```lua
-- Only send what changed
TriggerClientEvent('atc:hud:update', source, {
    health = GetEntityHealth(ped),
    armor = GetPedArmour(ped),
    hunger = player.hunger,
    thirst = player.thirst,
    stress = player.stress,
    cash = player.cashBalance,
    onDuty = player.isOnDuty,
    voiceRange = player.voiceRange
})
```

HUD data is **calculated server-side** and pushed to client. The client never pulls HUD data.

---

## Zone / Territory State

Territory state must be visible to all players simultaneously (blips, colors, labels):

```
Territory ownership change:
1. API: ownership updated in MariaDB
2. API: Redis updated: atc:territory:state:{id}
3. EventBus: atc:territory:owner:changed emitted
4. FiveM subscribes → broadcast to ALL online players:
   TriggerClientEvent('atc:territory:owner:changed', -1, payload)
5. All clients update territory blip colors
```

Using `-1` as source broadcasts to all connected players.

---

## State Conflict Resolution

When concurrent writes occur (two players opening the same stash):

```
Inventory write lock (Redis SETNX):
  Player A requests stash access → acquires lock (TTL: 5s)
  Player B requests stash access → lock exists → 409 Conflict returned
  Player B is told "Stash is in use"
  Player A finishes → lock released
  Player B retries automatically (if UI supports it)
```

For economy (concurrent transfer from same account):
```sql
UPDATE economy_accounts
SET balance_amount = balance_amount - 500
WHERE id = ? AND balance_amount >= 500
-- If 0 rows affected → insufficient funds (race-safe)
```
