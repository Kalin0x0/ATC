-- ============================================================
-- ATC Core — Client Dialogue System
-- Tree-based NPC dialogue with server-side action dispatch.
-- ============================================================

ATC = ATC or {}
ATC.Dialogue = ATC.Dialogue or {}

local _active = false
local _tree   = nil

--- Open a dialogue tree and hand focus to the NUI.
--- @param tree table  Root dialogue node: { speaker, text, npcId, options = [{label, next|action}] }
function ATC.Dialogue.Start(tree)
    if not tree then return end
    _active = true
    _tree   = tree
    SetNuiFocus(true, true)
    SendNUIMessage({ type = 'ATC_DIALOGUE_OPEN', payload = { node = _tree } })
end

--- Close the dialogue UI and return input to the game.
function ATC.Dialogue.Close()
    _active = false
    _tree   = nil
    SetNuiFocus(false, false)
    SendNUIMessage({ type = 'ATC_DIALOGUE_CLOSE' })
end

-- ── NUI Callbacks ────────────────────────────────────────────────────────────

RegisterNUICallback('atc:dialogue:choose', function(data, cb)
    if not _active or not _tree then cb('ok'); return end

    local choice  = data and tonumber(data.index)
    local options = _tree.options or {}
    local opt     = options[choice]

    if opt then
        if opt.next then
            -- Navigate deeper in the tree
            _tree = opt.next
            SendNUIMessage({ type = 'ATC_DIALOGUE_OPEN', payload = { node = _tree } })
        elseif opt.action then
            -- Trigger a server-side action and close
            TriggerServerEvent('atc:dialogue:action', {
                action = opt.action,
                npcId  = _tree.npcId
            })
            ATC.Dialogue.Close()
        else
            ATC.Dialogue.Close()
        end
    end

    cb('ok')
end)

RegisterNUICallback('atc:dialogue:close', function(_, cb)
    ATC.Dialogue.Close()
    cb('ok')
end)

-- ── Server-initiated dialogue ────────────────────────────────────────────────

RegisterNetEvent('atc:dialogue:start')
AddEventHandler('atc:dialogue:start', function(tree)
    ATC.Dialogue.Start(tree)
end)
