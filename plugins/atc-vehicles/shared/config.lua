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
}
