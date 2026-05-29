-- ATC Core — Client SDK
-- Read-only facade over all client subsystems.
-- Plugins import from here; they never import ATC.Vitals/ATC.Economy etc. directly.

ATC       = ATC       or {}
ATC.SDK   = ATC.SDK   or {}

-- ── Player ────────────────────────────────────────────────────────────────────

ATC.SDK.Player = {
    --- Returns true once the server handshake is complete.
    IsReady = function()
        return ATC.Core.IsReady()
    end,

    --- Returns the current session UUID.
    GetSessionId = function()
        return ATC.Core.GetSessionId()
    end,

    --- Returns the full character table or nil if no character is selected.
    GetCharacter = function()
        return (ATC.Characters and ATC.Characters.GetCurrent()) or nil
    end,

    --- Returns only the characterId string, or nil.
    GetCharacterId = function()
        local c = ATC.SDK.Player.GetCharacter()
        return c and c.characterId or nil
    end,
}

-- ── Vitals ────────────────────────────────────────────────────────────────────

ATC.SDK.Vitals = {
    --- Returns the full vitals snapshot.
    Get = function()
        return (ATC.Vitals and ATC.Vitals.Get())
            or { health = 100, armor = 0, hunger = 100, thirst = 100, stamina = 100 }
    end,

    GetHealth  = function() return ATC.SDK.Vitals.Get().health  end,
    GetHunger  = function() return ATC.SDK.Vitals.Get().hunger  end,
    GetThirst  = function() return ATC.SDK.Vitals.Get().thirst  end,

    --- Returns false when health is 0 (dead state).
    IsAlive = function() return ATC.SDK.Vitals.GetHealth() > 0 end,
}

-- ── Inventory ─────────────────────────────────────────────────────────────────

ATC.SDK.Inventory = {
    --- Returns the current inventory slot array (may be empty).
    Get = function()
        return (ATC.Inventory and ATC.Inventory.Get()) or {}
    end,

    --- Returns (true, slot) if an item with quantity > 0 exists, else (false, nil).
    HasItem = function(itemName)
        for _, slot in ipairs(ATC.SDK.Inventory.Get()) do
            if slot.itemName == itemName and (slot.quantity or 0) > 0 then
                return true, slot
            end
        end
        return false, nil
    end,
}

-- ── Economy ───────────────────────────────────────────────────────────────────

ATC.SDK.Economy = {
    --- Returns { cash, bank, dirty } wallet snapshot.
    GetWallet = function()
        return (ATC.Economy and ATC.Economy.GetWallet())
            or { cash = 0, bank = 0, dirty = 0 }
    end,

    GetCash = function() return ATC.SDK.Economy.GetWallet().cash end,
    GetBank = function() return ATC.SDK.Economy.GetWallet().bank end,
}

-- ── Jobs ──────────────────────────────────────────────────────────────────────

ATC.SDK.Jobs = {
    --- Returns the active job table or nil.
    GetActive = function()
        return (ATC.Jobs and ATC.Jobs.GetActive()) or nil
    end,

    --- Returns true if the player is currently on duty.
    IsOnDuty = function()
        return (ATC.Jobs and ATC.Jobs.IsOnDuty()) or false
    end,

    --- Returns the job name string; 'unemployed' if none.
    GetJobName = function()
        local j = ATC.SDK.Jobs.GetActive()
        return j and j.jobName or 'unemployed'
    end,
}

-- ── Combat ────────────────────────────────────────────────────────────────────

ATC.SDK.Combat = {
    --- Returns true when the local player is in the dead state.
    IsDead = function()
        return (ATC.CombatClient and ATC.CombatClient.IsDead()) or false
    end,
}

-- ── Vehicles ──────────────────────────────────────────────────────────────────

ATC.SDK.Vehicles = {
    --- Returns true when the local ped is inside a vehicle.
    IsInVehicle = function()
        return (ATC.Vehicles and ATC.Vehicles.IsInVehicle()) or false
    end,

    --- Returns the current vehicle state snapshot or nil.
    GetState = function()
        return (ATC.Vehicles and ATC.Vehicles.GetState()) or nil
    end,
}
