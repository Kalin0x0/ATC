-- ATC Phase 44: Maritime, Aviation & Airspace Runtime
-- Server-side SDK bridge — all calls go through the ATC API

ATC.Transport = ATC.Transport or {}

-- ── Vessels ────────────────────────────────────────────────────────────────────

function ATC.Transport.RegisterVessel(params, cb)
  ATC.SDK.Post('/api/v1/transport/vessels', params, cb)
end

function ATC.Transport.ListVessels(cb)
  ATC.SDK.Get('/api/v1/transport/vessels', cb)
end

function ATC.Transport.UpdateVesselPosition(params, cb)
  ATC.SDK.Post('/api/v1/transport/vessels/position', params, cb)
end

function ATC.Transport.DockVessel(params, cb)
  ATC.SDK.Post('/api/v1/transport/vessels/dock', params, cb)
end

function ATC.Transport.UndockVessel(dockingId, cb)
  ATC.SDK.Post('/api/v1/transport/vessels/undock', { dockingId = dockingId }, cb)
end

-- ── Aircraft ───────────────────────────────────────────────────────────────────

function ATC.Transport.RegisterAircraft(params, cb)
  ATC.SDK.Post('/api/v1/transport/aircraft', params, cb)
end

function ATC.Transport.CreateFlight(params, cb)
  ATC.SDK.Post('/api/v1/transport/flights', params, cb)
end

function ATC.Transport.ListActiveFlights(cb)
  ATC.SDK.Get('/api/v1/transport/flights', cb)
end

function ATC.Transport.DepartFlight(flightId, cb)
  ATC.SDK.Post('/api/v1/transport/flights/' .. flightId .. '/depart', {}, cb)
end

function ATC.Transport.LandFlight(flightId, cb)
  ATC.SDK.Post('/api/v1/transport/flights/' .. flightId .. '/land', {}, cb)
end

function ATC.Transport.DivertFlight(flightId, cb)
  ATC.SDK.Post('/api/v1/transport/flights/' .. flightId .. '/divert', {}, cb)
end

-- ── Airspace ───────────────────────────────────────────────────────────────────

function ATC.Transport.RegisterAirspaceZone(params, cb)
  ATC.SDK.Post('/api/v1/transport/airspace', params, cb)
end

function ATC.Transport.ListAirspaceZones(cb)
  ATC.SDK.Get('/api/v1/transport/airspace', cb)
end

function ATC.Transport.RestrictAirspace(zoneId, cb)
  ATC.SDK.Post('/api/v1/transport/airspace/' .. zoneId .. '/status', { status = 'restricted' }, cb)
end

function ATC.Transport.OpenAirspace(zoneId, cb)
  ATC.SDK.Post('/api/v1/transport/airspace/' .. zoneId .. '/status', { status = 'open' }, cb)
end
