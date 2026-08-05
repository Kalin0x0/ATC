-- ATC Jobs Plugin — Shared Configuration

ATC = ATC or {}
ATC.JobsPlugin = ATC.JobsPlugin or {}

ATC.JobsPlugin.Config = {
    -- Payroll tick interval in milliseconds (default: 30 minutes).
    PayrollIntervalMs = 1800000,

    -- Minimum ms between duty toggles (enforced by firewall rateLimit as well).
    DutyToggleCooldownMs = 10000,

    -- ── Features without an API counterpart ───────────────────────────────────
    -- Both default to false because the ATC API does not serve them today. They
    -- are switches, not TODOs: flip one to true once the matching route exists
    -- and the plugin resumes calling it, no other change needed.

    -- Duty toggling. There is no duty endpoint, and no duty column in the
    -- schema either — atc_employment_contracts tracks employment status, not
    -- whether someone is clocked in. The plugin used to POST
    -- /api/v1/jobs/duty/toggle, which 404s.
    DutyApiEnabled = false,

    -- Per-character payroll ticks. The API models payroll per organisation and
    -- per period (POST /api/v1/payroll/preview then /commit), not as a tick per
    -- player, so the old POST /api/v1/jobs/payroll/tick has no counterpart.
    -- Left on, it fired one doomed request per player every interval.
    PayrollApiEnabled = false,
}
