# Admin System Architecture

## Overview

The ATC Admin System is a permission-gated, fully audited moderation platform. Every action is logged, every ban has evidence, and admins cannot modify their own records.

---

## Admin Rank Hierarchy

```
SUPERADMIN (Level 5)
  ├── All permissions
  ├── Manage admin ranks
  ├── View all audit logs
  └── Delete evidence bundles

SENIOR ADMIN (Level 4)
  ├── All Level 3 permissions
  ├── Permanent bans
  ├── Rollback economy transactions
  └── Force character wipe

ADMIN (Level 3)
  ├── All Level 2 permissions
  ├── Temporary bans (up to 30 days)
  ├── Create evidence bundles
  └── Access audit logs (own target only)

MODERATOR (Level 2)
  ├── All Level 1 permissions
  ├── Kick players
  ├── Temporary bans (up to 7 days)
  ├── Issue warnings
  └── Freeze players

HELPER (Level 1)
  ├── Spectate players
  ├── Teleport to player (not bring player)
  ├── Read player info
  └── Create support tickets
```

---

## Permission Matrix

| Action | Helper | Mod | Admin | Sr. Admin | Superadmin |
|---|---|---|---|---|---|
| spectate | ✅ | ✅ | ✅ | ✅ | ✅ |
| read_player | ✅ | ✅ | ✅ | ✅ | ✅ |
| teleport_to | ✅ | ✅ | ✅ | ✅ | ✅ |
| kick | ❌ | ✅ | ✅ | ✅ | ✅ |
| warn | ❌ | ✅ | ✅ | ✅ | ✅ |
| freeze | ❌ | ✅ | ✅ | ✅ | ✅ |
| ban_7d | ❌ | ✅ | ✅ | ✅ | ✅ |
| teleport_bring | ❌ | ✅ | ✅ | ✅ | ✅ |
| god_mode | ❌ | ❌ | ✅ | ✅ | ✅ |
| noclip | ❌ | ❌ | ✅ | ✅ | ✅ |
| ban_30d | ❌ | ❌ | ✅ | ✅ | ✅ |
| give_item | ❌ | ❌ | ✅ | ✅ | ✅ |
| give_money | ❌ | ❌ | ✅ | ✅ | ✅ |
| evidence_bundle | ❌ | ❌ | ✅ | ✅ | ✅ |
| audit_log_read | ❌ | ❌ | ✅ | ✅ | ✅ |
| ban_permanent | ❌ | ❌ | ❌ | ✅ | ✅ |
| economy_rollback | ❌ | ❌ | ❌ | ✅ | ✅ |
| char_wipe | ❌ | ❌ | ❌ | ✅ | ✅ |
| admin_manage | ❌ | ❌ | ❌ | ❌ | ✅ |
| audit_log_all | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Database Tables

```sql
-- Admin identities
CREATE TABLE `admins` (
    `id`          CHAR(26)     NOT NULL,
    `player_id`   CHAR(26)     NOT NULL,
    `rank`        TINYINT      NOT NULL DEFAULT 1,
    `granted_by`  CHAR(26)     NULL,
    `is_active`   TINYINT(1)   NOT NULL DEFAULT 1,
    `created_at`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                  ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_admins_player` (`player_id`)
);

-- Ban records
CREATE TABLE `bans` (
    `id`               CHAR(26)     NOT NULL,
    `target_identifier` VARCHAR(128) NOT NULL,
    `target_name`      VARCHAR(128) NOT NULL,
    `reason`           TEXT         NOT NULL,
    `duration_hours`   INT          NULL COMMENT 'NULL = permanent',
    `expires_at`       DATETIME(3)  NULL,
    `issued_by`        CHAR(26)     NOT NULL,
    `evidence_id`      CHAR(26)     NULL,
    `is_active`        TINYINT(1)   NOT NULL DEFAULT 1,
    `lifted_by`        CHAR(26)     NULL,
    `lifted_at`        DATETIME(3)  NULL,
    `created_at`       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    INDEX `idx_bans_identifier` (`target_identifier`),
    INDEX `idx_bans_active` (`is_active`, `expires_at`)
);

-- Warning records
CREATE TABLE `warnings` (
    `id`               CHAR(26)     NOT NULL,
    `target_identifier` VARCHAR(128) NOT NULL,
    `target_name`      VARCHAR(128) NOT NULL,
    `reason`           TEXT         NOT NULL,
    `issued_by`        CHAR(26)     NOT NULL,
    `acknowledged`     TINYINT(1)   NOT NULL DEFAULT 0,
    `created_at`       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    INDEX `idx_warnings_identifier` (`target_identifier`)
);

-- Audit log (append-only)
CREATE TABLE `audit_log` (
    `id`          CHAR(26)     NOT NULL,
    `actor_id`    CHAR(26)     NOT NULL COMMENT 'Admin or system ID',
    `actor_source` INT         NOT NULL COMMENT 'FiveM source, 0 for system',
    `action_type` VARCHAR(128) NOT NULL,
    `target_id`   CHAR(26)     NULL,
    `metadata_json` JSON       NOT NULL,
    `ip_address`  VARCHAR(45)  NULL,
    `created_at`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    INDEX `idx_audit_actor` (`actor_id`),
    INDEX `idx_audit_target` (`target_id`),
    INDEX `idx_audit_action` (`action_type`),
    INDEX `idx_audit_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- Note: No UPDATE or DELETE privileges for API DB user on this table

-- Evidence bundles
CREATE TABLE `evidence_bundles` (
    `id`               CHAR(26)     NOT NULL,
    `target_identifier` VARCHAR(128) NOT NULL,
    `description`      TEXT         NOT NULL,
    `created_by`       CHAR(26)     NOT NULL,
    `storage_url`      VARCHAR(512) NOT NULL COMMENT 'Object storage bundle URL',
    `event_log_json`   JSON         NOT NULL,
    `metadata_json`    JSON         NULL,
    `created_at`       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`)
);
```

---

## In-Game Admin Menu

### Access
```lua
-- Only via command — no keybind (prevents accidental activation)
RegisterCommand('atcadmin', function(source, args)
    local admin = ATC.SDK.Admin.GetAdmin(source)
    if not admin then
        -- No notification to non-admins (silent fail)
        return
    end

    -- Open admin NUI
    TriggerClientEvent('atc:admin:menu:open', source, {
        rank = admin.rank,
        permissions = admin.permissions
    })
end, true)  -- true = restrict command
```

### Menu Sections

```
ATC Admin Menu
├── Players
│   ├── Online players list (name, source, identifier, location)
│   ├── Player Profile
│   │   ├── Basic info (identifiers, playtime, warnings, bans)
│   │   ├── Last 10 economy transactions
│   │   ├── Current inventory
│   │   └── Risk score history
│   └── Actions
│       ├── Teleport To / Bring
│       ├── Spectate
│       ├── Freeze / Unfreeze
│       ├── Kick (reason required)
│       ├── Warn (reason required)
│       ├── Ban (reason + duration required)
│       └── Create Evidence Bundle
│
├── Economy
│   ├── Search player balances
│   ├── Give / Remove money (with reason — logged)
│   ├── View transactions (search by player/amount/date)
│   └── Fraud flags review
│
├── Server
│   ├── Online player count + TPS
│   ├── Resource usage
│   └── Announcements
│
└── Audit Log (Level 3+ only)
    ├── Recent admin actions
    ├── Search by admin / target / action type
    └── Export evidence bundle
```

---

## Admin Action API Flows

### Ban Flow

```
1. Admin opens ban dialog, fills: reason, duration
2. System auto-collects evidence:
   - Last 500 audit events for target
   - Last 50 transactions
   - Last 100 chat messages
   - Risk score history
   - Current inventory
3. API call: POST /api/v1/admin/bans
4. Validation: admin rank ≥ required for duration
5. Evidence bundle created and stored
6. Ban record inserted (is_active = 1)
7. Redis: SET atc:ban:{identifier} with TTL
8. If player online: force disconnect with ban message
9. Audit log entry written (immutable)
10. All online admins notified: "{AdminName} banned {TargetName} for: {reason}"
```

### Economy Rollback Flow (Level 4+)

```
1. Admin selects transaction to rollback
2. System validates: transaction < 24h old, not already rolled back
3. Reverse transaction created (negative of original)
4. Both accounts updated
5. Audit log entry: rollback + original transaction ID
6. Target player notified in-game if online
```

---

## Admin Abuse Prevention

### What Is Logged

Every admin action, including:
- Opening admin menu (timestamp, who)
- Viewing player profile (who viewed who, when)
- Spectating (start time, end time, target)
- Teleports (from coords, to coords)
- Freeze/unfreeze
- Give item / remove item (what, how much, target)
- Give money / remove money (amount, currency, target, reason)
- Ban / unban / warn
- Evidence bundle creation

### Separation Rules

1. Admins cannot read their own audit log entries
2. Admins cannot ban players with equal or higher rank
3. Admins cannot modify admin ranks (Superadmin only)
4. All moderation actions require a written reason
5. Economy give/take actions have daily limits per admin rank:
   - Helper/Mod: 0 (cannot)
   - Admin: max $50,000/day
   - Senior Admin: max $500,000/day
   - Superadmin: unlimited (still logged)

### Alerting

```
Auto-alerts sent to Superadmins when:
- Any admin gives >$10,000 in a single action
- Admin spectates same player for >30 minutes
- Admin bans 3+ players in 10 minutes (potential abuse)
- Admin accesses their own history
- Economy rollback performed
```

---

## Admin Web Panel

`apps/web` provides a full admin dashboard:

```
Web Panel Features:
├── Dashboard: online count, active alerts, recent bans
├── Player Management: search, profile, history
├── Ban Management: active bans, expired bans, pending reviews
├── Economy Monitor: transaction feed, fraud flags, leaderboard
├── Audit Log: searchable, filterable, exportable
├── Evidence Library: browse, search, download bundles
├── Admin Management: grant/revoke admin (Superadmin only)
└── Server Metrics: TPS, memory, player count over time
```
