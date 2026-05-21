-- ATC Housing Economy Runtime Bridge
-- Rental contracts, property taxes, foreclosures, asset valuations.
-- All state mutations are server-authoritative via the API.

local API_BASE  = ATC.Config.ApiBase  or 'http://localhost:3000'
local API_TOKEN = ATC.Config.ApiToken or ''

local function apiPost(path, body, cb)
  PerformHttpRequest(API_BASE .. path, function(status, text)
    if cb then cb(status, text and json.decode(text)) end
  end, 'POST', json.encode(body), {
    ['Content-Type']  = 'application/json',
    ['Authorization'] = 'Bearer ' .. API_TOKEN,
  })
end

local function apiGet(path, cb)
  PerformHttpRequest(API_BASE .. path, function(status, text)
    if cb then cb(status, text and json.decode(text)) end
  end, 'GET', '', {
    ['Authorization'] = 'Bearer ' .. API_TOKEN,
  })
end

-- ── Public SDK ────────────────────────────────────────────────────────────────

ATC.Housing = {}

--- Create a rental contract between landlord and tenant.
--- @param propertyId          string
--- @param tenantPrincipalId   string
--- @param landlordPrincipalId string
--- @param monthlyRent         string  integer string (bigint safe)
--- @param depositAmount       string  integer string
--- @param contractNonce       string  idempotency key
--- @param cb                  function callback(status, contract)
function ATC.Housing.CreateContract(propertyId, tenantPrincipalId, landlordPrincipalId, monthlyRent, depositAmount, contractNonce, cb)
  apiPost('/api/v1/housing/contracts', {
    propertyId          = propertyId,
    tenantPrincipalId   = tenantPrincipalId,
    landlordPrincipalId = landlordPrincipalId,
    monthlyRent         = monthlyRent,
    depositAmount       = depositAmount,
    contractNonce       = contractNonce,
    startDate           = os.date('!%Y-%m-%dT%H:%M:%SZ'),
  }, cb)
end

--- Collect rent for an active contract.
--- @param contractId     string
--- @param idempotencyKey string
--- @param cb             function callback(status, payment)
function ATC.Housing.CollectRent(contractId, idempotencyKey, cb)
  apiPost('/api/v1/housing/contracts/' .. contractId .. '/collect-rent', {
    idempotencyKey = idempotencyKey,
  }, cb)
end

--- Terminate an active rental contract.
--- @param contractId   string
--- @param terminatedBy string  principalId of party terminating
--- @param reason       string|nil
--- @param cb           function callback(status, contract)
function ATC.Housing.TerminateContract(contractId, terminatedBy, reason, cb)
  apiPost('/api/v1/housing/contracts/' .. contractId .. '/terminate', {
    terminatedBy = terminatedBy,
    reason       = reason,
  }, cb)
end

--- Assess a property tax.
--- @param propertyId       string
--- @param ownerPrincipalId string
--- @param periodLabel      string  e.g. '2026-Q1'
--- @param taxAmount        string  integer string
--- @param dueAt            string  ISO 8601
--- @param cb               function callback(status, tax)
function ATC.Housing.AssessTax(propertyId, ownerPrincipalId, periodLabel, taxAmount, dueAt, cb)
  apiPost('/api/v1/housing/taxes', {
    propertyId       = propertyId,
    ownerPrincipalId = ownerPrincipalId,
    periodLabel      = periodLabel,
    taxAmount        = taxAmount,
    dueAt            = dueAt,
  }, cb)
end

--- Start a foreclosure on a property.
--- @param propertyId       string
--- @param ownerPrincipalId string
--- @param foreclosureNonce string  idempotency key
--- @param reason           string|nil
--- @param cb               function callback(status, foreclosure)
function ATC.Housing.StartForeclosure(propertyId, ownerPrincipalId, foreclosureNonce, reason, cb)
  apiPost('/api/v1/housing/foreclosures', {
    propertyId       = propertyId,
    ownerPrincipalId = ownerPrincipalId,
    foreclosureNonce = foreclosureNonce,
    reason           = reason,
  }, cb)
end

--- Get the latest asset valuation for a property.
--- @param propertyId string
--- @param cb         function callback(status, valuation)
function ATC.Housing.GetLatestValuation(propertyId, cb)
  apiGet('/api/v1/housing/valuations/' .. propertyId .. '/latest', cb)
end

--- Get a rental contract by id.
--- @param contractId string
--- @param cb         function callback(status, contract)
function ATC.Housing.GetContract(contractId, cb)
  apiGet('/api/v1/housing/contracts/' .. contractId, cb)
end

-- ── Server events (internal) ──────────────────────────────────────────────────

RegisterNetEvent('atc:housing:request:collect_rent', function(contractId, idempotencyKey)
  local source = source
  ATC.Housing.CollectRent(contractId, idempotencyKey, function(status, data)
    TriggerClientEvent('atc:housing:rent:result', source, status, data)
  end)
end)
