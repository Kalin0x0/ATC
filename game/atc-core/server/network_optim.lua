-- ATC Network Optimization — delta compression hints and rate limiting
ATC = ATC or {}
ATC.NetworkOptim = ATC.NetworkOptim or {}

local _lastSent   = {}  -- source+key → last sent value

-- Send only if value changed by more than threshold
function ATC.NetworkOptim.SendIfChanged(source, key, value, threshold, event, payload)
    threshold = threshold or 0
    local lastKey = tostring(source)..':'..key
    local last    = _lastSent[lastKey]
    local changed = last == nil or type(value) ~= type(last) or math.abs((tonumber(value) or 0) - (tonumber(last) or 0)) > threshold
    if changed then
        _lastSent[lastKey] = value
        TriggerClientEvent(event, source, payload)
    end
end

-- Batch vitals updates — send max once every 2s per player
local _vitalsQueue = {}
function ATC.NetworkOptim.QueueVitals(source, data)
    _vitalsQueue[source] = data
end

CreateThread(function()
    while true do
        Wait(2000)
        for src, data in pairs(_vitalsQueue) do
            TriggerClientEvent(ATC.Events.VITALS.UPDATE, src, data)
        end
        _vitalsQueue = {}
    end
end)

-- Cleanup on disconnect
AddEventHandler('playerDropped', function()
    local src = source
    for key in pairs(_lastSent) do
        if key:match('^'..tostring(src)..':') then _lastSent[key] = nil end
    end
    _vitalsQueue[src] = nil
end)
