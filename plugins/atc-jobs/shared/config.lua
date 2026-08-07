-- ATC Jobs Plugin — Shared Configuration

ATC = ATC or {}
ATC.JobsPlugin = ATC.JobsPlugin or {}

ATC.JobsPlugin.Config = {
    -- Payroll period length in milliseconds (default: 30 minutes). Also the
    -- interval between runs — each run covers exactly the period that closed.
    PayrollIntervalMs = 1800000,

    -- Minimum ms between duty toggles (enforced by firewall rateLimit as well).
    DutyToggleCooldownMs = 10000,

    -- How long the jobId → name map is reused before it is refetched, in
    -- seconds. Job definitions change through admin action, not during play.
    JobCatalogueTtlSeconds = 900,

    -- ── Payroll ───────────────────────────────────────────────────────────────
    -- Payroll runs per organisation and period: POST /api/v1/payroll/preview
    -- builds a run from that organisation's active contracts, POST
    -- /api/v1/payroll/commit posts it to the ledger. Each entry below is one
    -- organisation that gets paid on this server.
    --
    -- Empty by default. An empty list means this server does not run payroll,
    -- which is a valid setup — pay by hand, or from an external scheduler.
    -- Nothing is called while it is empty.
    --
    -- Every field is required by the API and there is no sensible default for
    -- any of them, which is why there is no placeholder entry to uncomment:
    --   organizationId       the organisation whose contracts are paid
    --   currency             must match the salary currency on every active
    --                        contract of that organisation, or the run is
    --                        rejected as a mixed-currency payroll
    --   orgAccountId         ledger account the money comes from
    --   payrollAccountId     ledger account it is booked to
    --   createdByPrincipalId principal recorded as having run payroll
    --
    -- Example:
    --   PayrollOrganisations = {
    --       {
    --           organizationId       = '01J8ZQK9F2XQ4V7T3M5N6P8R0S',
    --           currency             = 'USD',
    --           orgAccountId         = '01J8ZQK9F2XQ4V7T3M5N6P8R0T',
    --           payrollAccountId     = '01J8ZQK9F2XQ4V7T3M5N6P8R0U',
    --           createdByPrincipalId = '01J8ZQK9F2XQ4V7T3M5N6P8R0V',
    --       },
    --   }
    PayrollOrganisations = {},
}
