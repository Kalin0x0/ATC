-- ATC Banking & Market Runtime Bridge
-- Bank transfers, marketplace listings, auctions, account freezes.
-- All balance mutations are server-authoritative with FOR UPDATE locking and idempotency keys.

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

ATC.Market = {}

--- Transfer funds between two bank accounts. Deadlock-safe (lower-id first).
--- @param fromSource     number   FiveM server id of sender
--- @param toSource       number   FiveM server id of recipient
--- @param amount         string   amount as integer string (bigint-safe)
--- @param idempotencyKey string   unique key for this transfer
--- @param description    string|nil
--- @param cb             function callback(status, transaction)
function ATC.Market.BankTransfer(fromSource, toSource, amount, idempotencyKey, description, cb)
  local fromId = ATC.Accounts.GetPrincipalId(fromSource)
  local toId   = ATC.Accounts.GetPrincipalId(toSource)
  if not fromId or not toId then
    if cb then cb(403, nil) end
    return
  end
  apiPost('/api/v1/market/bank/transfer', {
    fromPrincipalId = fromId,
    toPrincipalId   = toId,
    amount          = amount,
    idempotencyKey  = idempotencyKey,
    description     = description,
  }, cb)
end

--- Get a player's bank account.
--- @param source number   FiveM server id
--- @param cb     function callback(status, account)
function ATC.Market.GetBankAccount(source, cb)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then
    if cb then cb(403, nil) end
    return
  end
  apiGet('/api/v1/market/bank/accounts/' .. principalId, cb)
end

--- Freeze a player's bank account.
--- @param targetSource   number   player to freeze
--- @param adminSource    number   admin performing the freeze
--- @param reason         string
--- @param cb             function callback(status, nil)
function ATC.Market.FreezeAccount(targetSource, adminSource, reason, cb)
  local targetId = ATC.Accounts.GetPrincipalId(targetSource)
  local adminId  = ATC.Accounts.GetPrincipalId(adminSource)
  if not targetId or not adminId then
    if cb then cb(403, nil) end
    return
  end
  apiPost('/api/v1/market/bank/accounts/freeze', {
    principalId         = targetId,
    frozenByPrincipalId = adminId,
    reason              = reason,
  }, cb)
end

--- Create a marketplace listing.
--- @param source      number   seller's server id
--- @param params      table    { itemName, quantity, pricePerUnit (string), listingNonce, description?, expiresInHours? }
--- @param cb          function callback(status, listing)
function ATC.Market.CreateListing(source, params, cb)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then
    if cb then cb(403, nil) end
    return
  end
  params.sellerPrincipalId = principalId
  apiPost('/api/v1/market/listings', params, cb)
end

--- Purchase a marketplace listing (transfers funds server-side).
--- @param source       number   buyer's server id
--- @param listingId    string
--- @param idemKey      string   idempotency key
--- @param cb           function callback(status, listing)
function ATC.Market.PurchaseListing(source, listingId, idemKey, cb)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then
    if cb then cb(403, nil) end
    return
  end
  apiPost('/api/v1/market/listings/' .. listingId .. '/purchase', {
    listingId         = listingId,
    buyerPrincipalId  = principalId,
    idempotencyKey    = idemKey,
  }, cb)
end

--- Create an auction.
--- @param source   number   seller's server id
--- @param params   table    { itemName, startingBid (string), minimumBidIncrement (string), auctionNonce, durationHours? }
--- @param cb       function callback(status, auction)
function ATC.Market.CreateAuction(source, params, cb)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then
    if cb then cb(403, nil) end
    return
  end
  params.sellerPrincipalId = principalId
  apiPost('/api/v1/market/auctions', params, cb)
end

--- Place a bid on an auction (FOR UPDATE locked).
--- @param source     number   bidder's server id
--- @param auctionId  string
--- @param bidAmount  string   bid as integer string
--- @param cb         function callback(status, auction)
function ATC.Market.PlaceBid(source, auctionId, bidAmount, cb)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then
    if cb then cb(403, nil) end
    return
  end
  apiPost('/api/v1/market/auctions/' .. auctionId .. '/bid', {
    auctionId          = auctionId,
    bidderPrincipalId  = principalId,
    bidAmount          = bidAmount,
  }, cb)
end

--- Settle an auction (transfers proceeds, emits auction:completed).
--- @param auctionId    string
--- @param idemKey      string
--- @param cb           function callback(status, auction)
function ATC.Market.SettleAuction(auctionId, idemKey, cb)
  apiPost('/api/v1/market/auctions/' .. auctionId .. '/settle', {
    auctionId      = auctionId,
    idempotencyKey = idemKey,
  }, cb)
end

-- ── Server Events ─────────────────────────────────────────────────────────────

AddEventHandler('atc:market:bank:transfer:completed', function(payload)
  ATC.Log.Info('[Market] Transfer completed: ' .. (payload.id or '?') .. ' amount=' .. (payload.amount or '?'))
end)

AddEventHandler('atc:market:listing:sold', function(payload)
  ATC.Log.Info('[Market] Listing sold: ' .. (payload.id or '?') .. ' item=' .. (payload.itemName or '?'))
end)

AddEventHandler('atc:market:auction:completed', function(payload)
  ATC.Log.Info('[Market] Auction completed: ' .. (payload.id or '?'))
end)

AddEventHandler('atc:market:bank:account:frozen', function(payload)
  ATC.Log.Warn('[Market] Account frozen: principalId=' .. (payload.principalId or '?'))
end)

AddEventHandler('atc:market:fraud:flag:raised', function(payload)
  ATC.Log.Warn('[Market] Financial flag raised: type=' .. (payload.flagType or '?') .. ' severity=' .. (payload.severity or '?'))
end)
