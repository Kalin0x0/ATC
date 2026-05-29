-- game/atc-sdk/server/exports.lua
-- Register server-side exports so external plugins can call ATC SDK methods
-- using the standard FiveM exports API:
--   exports['atc-sdk']:AddMoney(source, 500, 'shop_purchase')

exports('GetPlayer',      function(src)
    return ATC_SDK.Server.GetPlayer(src)
end)

exports('GetCharacterId', function(src)
    return ATC_SDK.Server.GetCharacterId(src)
end)

exports('GetPrincipalId', function(src)
    return ATC_SDK.Server.GetPrincipalId(src)
end)

exports('AddMoney',       function(src, amt, reason, cb)
    return ATC_SDK.Server.AddMoney(src, amt, reason, cb)
end)

exports('RemoveMoney',    function(src, amt, reason, cb)
    return ATC_SDK.Server.RemoveMoney(src, amt, reason, cb)
end)

exports('AddItem',        function(src, item, qty, meta, cb)
    return ATC_SDK.Server.AddItem(src, item, qty, meta, cb)
end)

exports('RemoveItem',     function(src, item, qty, cb)
    return ATC_SDK.Server.RemoveItem(src, item, qty, cb)
end)

exports('Notify',         function(src, msg, lvl, dur)
    return ATC_SDK.Server.Notify(src, msg, lvl, dur)
end)
