-- atc-combat — Client Init
-- Weapon attachment management UI.
-- The client toggles GTA weapon components locally for instant visual feedback,
-- then reports the change to the server which records it (server never trusts the
-- client for combat math — see server/init.lua).

ATC = ATC or {}
ATC.WeaponClient = ATC.WeaponClient or {}

local _open = false

-- Attachment catalog: component hash names per attachment slot.
-- Component names are GTA native COMPONENT_* identifiers resolved via GetHashKey.
local ATTACHMENTS = {
    suppressor = { label = 'Suppressor',   component = 'COMPONENT_AT_PI_SUPP_02' },
    flashlight = { label = 'Flashlight',    component = 'COMPONENT_AT_PI_FLSH'    },
    scope      = { label = 'Scope',         component = 'COMPONENT_AT_SCOPE_MACRO' },
    extmag     = { label = 'Extended Mag',  component = 'COMPONENT_AT_PI_CLIP_02' },
    grip       = { label = 'Grip',          component = 'COMPONENT_AT_AR_AFGRIP'  },
}

-- Stable ordering for the UI (pairs() order is undefined in Lua).
local ATTACHMENT_ORDER = { 'suppressor', 'flashlight', 'scope', 'extmag', 'grip' }

--- Build the current attachment state for the equipped weapon and open the NUI.
local function openWeaponMenu()
    local ped    = PlayerPedId()
    local weapon = GetSelectedPedWeapon(ped)

    if weapon == GetHashKey('WEAPON_UNARMED') then
        SendNUIMessage({
            type    = 'ATC_NOTIFICATION',
            payload = { message = 'No weapon equipped', level = 'warning', duration = 3000 },
        })
        return
    end

    -- Build current attachment state in stable order.
    local items = {}
    for _, key in ipairs(ATTACHMENT_ORDER) do
        local att  = ATTACHMENTS[key]
        local comp = GetHashKey(att.component)
        items[#items + 1] = {
            key      = key,
            label    = att.label,
            equipped = HasPedGotWeaponComponent(ped, weapon, comp),
        }
    end

    local weaponLabel = GetLabelText(GetWeapontypeLabel(weapon))
    if not weaponLabel or weaponLabel == '' or weaponLabel == 'NULL' then
        weaponLabel = 'Weapon'
    end

    _open = true
    SetNuiFocus(true, true)
    SendNUIMessage({
        type    = 'ATC_WEAPON_OPEN',
        payload = { weaponName = weaponLabel, attachments = items },
    })
end

-- ── Command + Keybind ───────────────────────────────────────────────────────
RegisterCommand('weaponmods', function()
    if not ATC.Core or not ATC.Core.IsReady() then return end
    openWeaponMenu()
end, false)

RegisterKeyMapping('weaponmods', 'Weapon Attachments', 'keyboard', 'F10')

-- ── NUI callbacks ─────────────────────────────────────────────────────────────
RegisterNUICallback('atc:weapon:close', function(_, cb)
    _open = false
    SetNuiFocus(false, false)
    cb('ok')
end)

RegisterNUICallback('atc:weapon:toggle', function(data, cb)
    local key = type(data) == 'table' and data.key or nil
    local att = key and ATTACHMENTS[key] or nil
    if att then
        local ped    = PlayerPedId()
        local weapon = GetSelectedPedWeapon(ped)
        local comp   = GetHashKey(att.component)

        if HasPedGotWeaponComponent(ped, weapon, comp) then
            RemoveWeaponComponentFromPed(ped, weapon, comp)
            -- Persist to server (server validates ownership / records the change).
            TriggerServerEvent('atc:combat:weapon:attachment', { action = 'remove', component = att.component })
        else
            GiveWeaponComponentToPed(ped, weapon, comp)
            TriggerServerEvent('atc:combat:weapon:attachment', { action = 'add', component = att.component })
        end
    end
    cb('ok')
end)
