-- game/atc-sdk/client/exports.lua
-- Register client-side exports so external plugins can call ATC SDK methods
-- using the standard FiveM exports API:
--   exports['atc-sdk']:Notify('Hello!', 'success')

exports('IsReady',      function()
    return ATC_SDK.Client.IsReady()
end)

exports('GetCharacter', function()
    return ATC_SDK.Client.GetCharacter()
end)

exports('GetVitals',    function()
    return ATC_SDK.Client.GetVitals()
end)

exports('GetWallet',    function()
    return ATC_SDK.Client.GetWallet()
end)

exports('Notify',       function(msg, lvl, dur)
    return ATC_SDK.Client.Notify(msg, lvl, dur)
end)
