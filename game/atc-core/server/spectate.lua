ATC = ATC or {}
ATC.Spectate = ATC.Spectate or {}

local _spectating = {}  -- source → target source

function ATC.Spectate.Start(adminSource, targetSource)
    if not IsPlayerAceAllowed(tostring(adminSource), 'atc.admin') then return end
    _spectating[adminSource] = targetSource
    TriggerClientEvent('atc:spectate:start', adminSource, { targetSource=targetSource, targetName=GetPlayerName(targetSource) or '?' })
end

function ATC.Spectate.Stop(adminSource)
    _spectating[adminSource] = nil
    TriggerClientEvent('atc:spectate:stop', adminSource)
end

AddEventHandler('playerDropped', function()
    local src = source
    -- Clean up if spectated target drops
    for admin, target in pairs(_spectating) do
        if target == src then ATC.Spectate.Stop(admin) end
    end
end)

RegisterCommand('atcspectate', function(source, args)
    if not IsPlayerAceAllowed(tostring(source), 'atc.admin') then return end
    local targetId = tonumber(args[1])
    if not targetId then ATC.Spectate.Stop(source); return end
    ATC.Spectate.Start(source, targetId)
end, true)

RegisterCommand('atcunspectate', function(source, args)
    ATC.Spectate.Stop(source)
end, true)
