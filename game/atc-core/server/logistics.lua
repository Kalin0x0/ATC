-- ATC Phase 43: Transportation, Logistics & Supply Chain Runtime
-- Server-side SDK bridge — all calls go through the ATC API

ATC.Logistics = ATC.Logistics or {}

-- ── Create shipment ────────────────────────────────────────────────────────────

function ATC.Logistics.CreateShipment(params, cb)
  ATC.SDK.Post('/api/v1/logistics/shipments', params, cb)
end

-- ── Get shipment ───────────────────────────────────────────────────────────────

function ATC.Logistics.GetShipment(shipmentId, cb)
  ATC.SDK.Get('/api/v1/logistics/shipments/' .. shipmentId, cb)
end

-- ── List active shipments ──────────────────────────────────────────────────────

function ATC.Logistics.ListActiveShipments(cb)
  ATC.SDK.Get('/api/v1/logistics/shipments', cb)
end

-- ── Depart shipment ────────────────────────────────────────────────────────────

function ATC.Logistics.DepartShipment(shipmentId, cb)
  ATC.SDK.Post('/api/v1/logistics/shipments/' .. shipmentId .. '/depart', {}, cb)
end

-- ── Deliver shipment ───────────────────────────────────────────────────────────

function ATC.Logistics.DeliverShipment(shipmentId, cb)
  ATC.SDK.Post('/api/v1/logistics/shipments/' .. shipmentId .. '/deliver', {}, cb)
end

-- ── Fail shipment ──────────────────────────────────────────────────────────────

function ATC.Logistics.FailShipment(shipmentId, reason, cb)
  ATC.SDK.Post('/api/v1/logistics/shipments/' .. shipmentId .. '/fail', {
    reason = reason or 'unknown',
  }, cb)
end

-- ── Register supply route ──────────────────────────────────────────────────────

function ATC.Logistics.RegisterRoute(params, cb)
  ATC.SDK.Post('/api/v1/logistics/routes', params, cb)
end

-- ── List active routes ─────────────────────────────────────────────────────────

function ATC.Logistics.ListActiveRoutes(cb)
  ATC.SDK.Get('/api/v1/logistics/routes', cb)
end

-- ── Register logistics fleet ───────────────────────────────────────────────────

function ATC.Logistics.RegisterFleet(params, cb)
  ATC.SDK.Post('/api/v1/logistics/fleets', params, cb)
end

-- ── Assign fleet to route ──────────────────────────────────────────────────────

function ATC.Logistics.AssignFleet(fleetId, routeId, cb)
  ATC.SDK.Post('/api/v1/logistics/fleets/' .. fleetId .. '/assign', {
    fleetId = fleetId,
    routeId = routeId,
  }, cb)
end

-- ── Upsert supply chain ────────────────────────────────────────────────────────

function ATC.Logistics.UpsertChain(params, cb)
  ATC.SDK.Post('/api/v1/logistics/chains', params, cb)
end

-- ── Disrupt supply chain ───────────────────────────────────────────────────────

function ATC.Logistics.DisruptChain(chainId, cb)
  ATC.SDK.Post('/api/v1/logistics/chains/' .. chainId .. '/disrupt', {}, cb)
end

-- ── Restore supply chain ───────────────────────────────────────────────────────

function ATC.Logistics.RestoreChain(chainId, cb)
  ATC.SDK.Post('/api/v1/logistics/chains/' .. chainId .. '/restore', {}, cb)
end
