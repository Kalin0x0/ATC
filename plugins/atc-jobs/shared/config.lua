-- ATC Jobs Plugin — Shared Configuration

ATC = ATC or {}
ATC.JobsPlugin = ATC.JobsPlugin or {}

ATC.JobsPlugin.Config = {
    -- Payroll tick interval in milliseconds (default: 30 minutes).
    PayrollIntervalMs = 1800000,

    -- Minimum ms between duty toggles (enforced by firewall rateLimit as well).
    DutyToggleCooldownMs = 10000,
}
