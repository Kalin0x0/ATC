-- ATC Core — Client Voice & Radio Runtime (Phase 87)
-- Wires mumble/pma-voice proximity detection to NUI state.
-- Radio PTT uses INPUT_TALK (243); proximity is restored on leave.

ATC       = ATC       or {}
ATC.Voice = ATC.Voice or {}

local _talking      = false
local _radioTalking = false
local _channel      = nil
local _channels     = {}   -- all channels this player has joined

-- ── Proximity voice detection ────────────────────────────────────────────────
-- NetworkIsPlayerTalking returns true when mumble detects speech from the
-- local player.  We diff on every tick and push state to the NUI when it
-- changes rather than on every frame.

local function _detectVoice()
    local isTalking = NetworkIsPlayerTalking(PlayerId())
    if isTalking ~= _talking then
        _talking = isTalking
        SendNUIMessage({
            type    = 'ATC_VOICE_STATE',
            payload = { talking = _talking, radioTalking = _radioTalking, channel = _channel }
        })
    end
end

-- ── Public API ───────────────────────────────────────────────────────────────

---Join a radio channel.  Disables proximity audio while active.
---@param channel  string|number  Channel identifier
---@param encrypted boolean|nil  Reserved for encrypted channel flag
function ATC.Voice.JoinChannel(channel, encrypted)
    _channel = tostring(channel)
    table.insert(_channels, _channel)
    NetworkSetTalkerProximity(0.0)   -- suppress proximity while on radio
    SendNUIMessage({
        type    = 'ATC_VOICE_STATE',
        payload = { talking = _talking, radioTalking = false, channel = _channel }
    })
end

---Leave all radio channels and restore proximity audio.
function ATC.Voice.LeaveChannel()
    _channel      = nil
    _channels     = {}
    _radioTalking = false
    NetworkSetTalkerProximity(31.5)  -- standard FiveM proximity distance
    SendNUIMessage({
        type    = 'ATC_VOICE_STATE',
        payload = { talking = false, radioTalking = false, channel = nil }
    })
end

---@return string|nil  Active channel, or nil if not on radio
function ATC.Voice.GetChannel() return _channel end

---@return boolean  Whether the local player is currently talking (proximity)
function ATC.Voice.IsTalking()  return _talking end

---@return boolean  Whether PTT radio transmission is active
function ATC.Voice.IsRadioTalking() return _radioTalking end

-- ── Main tick: voice detection + PTT ─────────────────────────────────────────

local _pttHeld = false

CreateThread(function()
    while true do
        if ATC.Core.IsReady() then
            _detectVoice()

            -- Radio PTT — only active while on a channel
            if _channel then
                local held = IsControlPressed(0, 243)  -- INPUT_TALK
                if held ~= _pttHeld then
                    _pttHeld      = held
                    _radioTalking = held
                    if held then
                        MumbleSetAudioInputDistance(10000.0)  -- broadcast globally
                    else
                        MumbleSetAudioInputDistance(31.5)     -- restore local range
                    end
                    SendNUIMessage({
                        type    = 'ATC_VOICE_STATE',
                        payload = { talking = _talking, radioTalking = _radioTalking, channel = _channel }
                    })
                end
            end
        end
        Wait(50)
    end
end)

-- ── Server events ─────────────────────────────────────────────────────────────

---Server assigns (or removes) a radio channel for this player.
---Payload: { channel = "1" }  — omit or nil channel to remove.
RegisterNetEvent(ATC.Events.VOICE.CHANNEL_ASSIGN)
AddEventHandler(ATC.Events.VOICE.CHANNEL_ASSIGN, function(data)
    if data and data.channel then
        ATC.Voice.JoinChannel(data.channel, data.encrypted)
        SendNUIMessage({
            type    = 'ATC_NOTIFICATION',
            payload = {
                message  = 'Radio: Channel ' .. tostring(data.channel),
                level    = 'info',
                duration = 3000
            }
        })
    else
        ATC.Voice.LeaveChannel()
        SendNUIMessage({
            type    = 'ATC_NOTIFICATION',
            payload = { message = 'Radio: Disconnected', level = 'info', duration = 2000 }
        })
    end
end)
