-- ATC Telemetry Bridge
-- Collects server-side performance metrics and exposes them for monitoring.
-- Server-side only. Non-fatal on API failure. Low-frequency updates.

local TELEMETRY_INTERVAL_MS = 60000

local _metrics = {
  player_count       = 0,
  active_characters  = 0,
  inventory_operations = 0,
  vitals_mutations   = 0,
  status_effect_count = 0,
}

-- Increment a named metric counter (server-side only)
local function increment(name, amount)
  amount = amount or 1
  if _metrics[name] ~= nil then
    _metrics[name] = _metrics[name] + amount
  end
end

-- Return a snapshot of current metrics (read-only copy)
local function snapshot()
  return {
    player_count        = _metrics.player_count,
    active_characters   = _metrics.active_characters,
    inventory_operations = _metrics.inventory_operations,
    vitals_mutations    = _metrics.vitals_mutations,
    status_effect_count = _metrics.status_effect_count,
  }
end

-- Refresh gauges that are computed, not accumulated
local function refreshGauges()
  local players = GetPlayers()
  _metrics.player_count = #players

  local activeChars = 0
  for _, playerId in ipairs(players) do
    local src = tonumber(playerId)
    if src then
      local char = ATC and ATC.SDK and ATC.SDK.Player and ATC.SDK.Player.GetCharacter(src) or nil
      if char then
        activeChars = activeChars + 1
      end
    end
  end
  _metrics.active_characters = activeChars
end

-- Periodic telemetry loop
CreateThread(function()
  while true do
    Wait(TELEMETRY_INTERVAL_MS)
    local ok, err = pcall(refreshGauges)
    if not ok then
      -- Non-fatal: telemetry must never crash the resource
    end
  end
end)

-- Hook into ATC event bus to count operations (non-blocking)
if ATC and ATC.Events then
  AddEventHandler('atc:inventory:item:added', function()
    increment('inventory_operations')
  end)

  AddEventHandler('atc:inventory:item:removed', function()
    increment('inventory_operations')
  end)

  AddEventHandler('atc:vitals:changed', function()
    increment('vitals_mutations')
  end)

  AddEventHandler('atc:status:changed', function()
    -- Count active status effects across all characters is expensive; count events instead
    increment('status_effect_count')
  end)
end

-- Expose to ATC SDK
if ATC then
  ATC.Telemetry = ATC.Telemetry or {}
  ATC.Telemetry.GetSnapshot = snapshot
  ATC.Telemetry.Increment   = increment
end
