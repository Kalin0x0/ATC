-- ATC Core — HTTP client wrappers
-- Thin async wrappers around FiveM's PerformHttpRequest.
-- All callbacks receive: ok (bool), status (int|0), data (table|nil), err (string|nil)

ATC.HTTP = ATC.HTTP or {}

local _BASE_URL = ATC.Config.ApiUrl
local _TOKEN    = ATC.Config.ApiToken

local function _headers()
    return {
        ['Content-Type']  = 'application/json',
        ['Authorization'] = 'Bearer ' .. _TOKEN,
    }
end

-- FiveM may call the callback with statusCode=0 and body='' on connection failure.
-- Guard all arithmetic and string concatenation against nil.
local function _parseResponse(statusCode, body)
    local data = nil
    if body and #body > 0 then
        local ok, parsed = pcall(json.decode, body)
        if ok and type(parsed) == 'table' then data = parsed end
    end
    local code    = tonumber(statusCode) or 0
    local success = code >= 200 and code < 300
    return success, code, data
end

function ATC.HTTP.Get(path, callback)
    PerformHttpRequest(
        _BASE_URL .. path,
        function(statusCode, body, _responseHeaders)
            local ok, status, data = _parseResponse(statusCode, body)
            callback(ok, status, data, ok and nil or ('HTTP ' .. tostring(status)))
        end,
        'GET',
        '',
        _headers()
    )
end

function ATC.HTTP.Post(path, payload, callback)
    local encodeOk, encoded = pcall(json.encode, payload)
    local body = (encodeOk and encoded) or '{}'
    PerformHttpRequest(
        _BASE_URL .. path,
        function(statusCode, responseBody, _responseHeaders)
            local ok, status, data = _parseResponse(statusCode, responseBody)
            callback(ok, status, data, ok and nil or ('HTTP ' .. tostring(status)))
        end,
        'POST',
        body,
        _headers()
    )
end

function ATC.HTTP.Delete(path, callback)
    PerformHttpRequest(
        _BASE_URL .. path,
        function(statusCode, body, _responseHeaders)
            local ok, status, data = _parseResponse(statusCode, body)
            callback(ok, status, data, ok and nil or ('HTTP ' .. tostring(status)))
        end,
        'DELETE',
        '',
        _headers()
    )
end

function ATC.HTTP.Patch(path, payload, callback)
    local encodeOk, encoded = pcall(json.encode, payload)
    local body = (encodeOk and encoded) or '{}'
    PerformHttpRequest(
        _BASE_URL .. path,
        function(statusCode, responseBody, _responseHeaders)
            local ok, status, data = _parseResponse(statusCode, responseBody)
            callback(ok, status, data, ok and nil or ('HTTP ' .. tostring(status)))
        end,
        'PATCH',
        body,
        _headers()
    )
end
