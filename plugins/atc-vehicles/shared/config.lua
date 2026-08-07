-- ATC Vehicles Plugin — Shared Configuration

ATC = ATC or {}
ATC.VehiclesPlugin = ATC.VehiclesPlugin or {}

ATC.VehiclesPlugin.Config = {
    -- Maximum vehicle model string length.
    ModelMaxLength = 64,

    -- Maximum vehicle ID string length (UUID v7 = 36 chars).
    VehicleIdMaxLength = 36,

    -- Maximum allowed vehicle net ID value (FiveM limit is ~65535).
    VehicleNetIdMax = 65535,

    -- ── Garages ───────────────────────────────────────────────────────────────
    -- The API treats garageId as an opaque VARCHAR(64) label: atc_vehicle_garages
    -- stores it per record and GET /api/v1/garages derives the list by
    -- aggregating labels that have been used. There is no garage master table and
    -- no coordinates anywhere in the schema, so the map side lives here.
    --
    -- These coordinates are starting values for the stock map — adjust them to
    -- wherever your server actually puts its garages. Storing a vehicle picks the
    -- nearest entry within GarageRadius of the player.
    Garages = {
        { id = 'garage_downtown',   label = 'Downtown',        x = 215.9,   y = -810.0,  z = 30.7 },
        { id = 'garage_legion',     label = 'Legion Square',   x = 216.0,   y = -790.0,  z = 30.9 },
        { id = 'garage_airport',    label = 'LS Airport',      x = -1037.0, y = -2737.0, z = 20.2 },
        { id = 'garage_sandy',      label = 'Sandy Shores',    x = 1737.0,  y = 3710.0,  z = 34.1 },
        { id = 'garage_paleto',     label = 'Paleto Bay',      x = -184.0,  y = 6417.0,  z = 31.5 },
    },

    -- How close the player must be to a garage to park there, in metres.
    GarageRadius = 40.0,

    -- Fallback used when a player parks outside every garage radius. Set to nil
    -- to refuse the request instead of storing to a default.
    DefaultGarageId = 'garage_downtown',

    -- How long a spawned vehicle's network id stays resolvable, in seconds.
    -- Entries are dropped after this so the registry cannot grow without bound
    -- across a long uptime.
    NetIdTtlSeconds = 21600,  -- 6 hours
}
