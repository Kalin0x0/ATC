# Logging & Telemetry Architecture

## Objectives

1. **Structured logging** — every log entry is parseable JSON
2. **Trace correlation** — every request has a trace ID from FiveM → API → DB
3. **Error tracking** — all exceptions captured with context
4. **Performance metrics** — API latency, DB query times, cache hit rates
5. **Security alerting** — risk events trigger immediate notifications
6. **Player behavior analytics** — aggregate, anonymized game telemetry

---

## Log Levels

| Level | When to Use | Example |
|---|---|---|
| `error` | Unrecoverable failure, requires immediate attention | DB connection failed, API crashed |
| `warn` | Something unexpected but recoverable | Redis cache miss storm, high rate limit hits |
| `info` | Normal important events | Player connected, transaction completed |
| `debug` | Developer diagnostics (disabled in production) | SQL query text, Redis key operations |
| `trace` | Very verbose (disabled unless troubleshooting) | Every SDK call, every cache check |

---

## Log Format

All logs are structured JSON in production:

```json
{
  "level": "info",
  "timestamp": "2026-05-14T12:34:56.789Z",
  "traceId": "01HXZ3M8P4KQRST2WVY60E7FBN",
  "service": "api",
  "domain": "economy",
  "event": "transaction.completed",
  "playerId": "01HXZ...",
  "data": {
    "transactionId": "01HXZ...",
    "amount": 500,
    "currency": "cash",
    "fromId": "01HXZ...",
    "toId": "01HXZ...",
    "durationMs": 23
  }
}
```

In development: pretty-printed with colors (pino-pretty).

---

## Logger Implementation

```typescript
// packages/core/src/logger.ts

import pino from 'pino'

export const logger = pino({
    level: process.env.LOG_LEVEL ?? 'info',
    transport: process.env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    base: {
        service: process.env.SERVICE_NAME ?? 'api',
        version: process.env.npm_package_version
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    serializers: {
        err: pino.stdSerializers.err,
        req: pino.stdSerializers.req,
        res: pino.stdSerializers.res
    }
})

// Scoped logger for a domain
export function createLogger(domain: string) {
    return logger.child({ domain })
}
```

### Usage in Services

```typescript
// packages/security/src/economy-guard.ts
const log = createLogger('economy-guard')

export async function checkTransaction(tx: Transaction) {
    log.debug({ transactionId: tx.id }, 'checking transaction')

    const fraudDetected = await detectFraud(tx)
    if (fraudDetected) {
        log.warn({
            transactionId: tx.id,
            characterId: tx.fromId,
            flagType: fraudDetected.type,
            severity: fraudDetected.severity
        }, 'economy fraud detected')
    }
}
```

---

## Lua Side Logging

```lua
-- packages/sdk/lua/ATC/Core.lua (logging module)

ATC.Core.Log = {}

local _levels = { trace = 0, debug = 1, info = 2, warn = 3, error = 4 }
local _minLevel = _levels[GetConvar('atc_log_level', 'info')] or _levels.info

function ATC.Core.Log._Write(level, event, data)
    if _levels[level] < _minLevel then return end

    local entry = {
        level = level,
        timestamp = os.time(),
        resource = GetCurrentResourceName(),
        event = event,
        data = data or {}
    }

    -- In production: send to API for structured logging
    -- In dev: print to console
    if GetConvar('atc_log_target', 'console') == 'api' then
        PerformHttpRequest(
            ATC.Config.ApiUrl .. '/api/v1/telemetry/log',
            nil, 'POST',
            json.encode(entry),
            { ['Content-Type'] = 'application/json', Authorization = 'Bearer ' .. ATC.Config.ServerToken }
        )
    else
        print(string.format('[%s][%s] %s %s',
            level:upper(), GetCurrentResourceName(), event, json.encode(data or {})))
    end
end

function ATC.Core.Log.Info(event, data)  ATC.Core.Log._Write('info', event, data) end
function ATC.Core.Log.Warn(event, data)  ATC.Core.Log._Write('warn', event, data) end
function ATC.Core.Log.Error(event, data) ATC.Core.Log._Write('error', event, data) end
function ATC.Core.Log.Debug(event, data) ATC.Core.Log._Write('debug', event, data) end
```

---

## Metrics

### Key Metrics to Track

```
API Performance:
  atc.api.request.duration_ms      (histogram, by route)
  atc.api.request.count            (counter, by route + status)
  atc.api.error.count              (counter, by route + error_code)

Database:
  atc.db.query.duration_ms         (histogram, by query_name)
  atc.db.connection.pool.active    (gauge)
  atc.db.connection.pool.idle      (gauge)

Redis:
  atc.cache.hit_rate               (gauge, by key_prefix)
  atc.cache.miss_count             (counter, by key_prefix)
  atc.redis.latency_ms             (histogram)

Game:
  atc.game.players.online          (gauge)
  atc.game.players.connected_total (counter)
  atc.game.economy.transactions    (counter, by type)
  atc.game.inventory.operations    (counter, by operation)

Security:
  atc.security.violations          (counter, by type + severity)
  atc.security.rate_limit_hits     (counter, by event)
  atc.security.risk_score.high     (gauge — count of high-risk players)
  atc.security.bans_issued         (counter)
```

### Metrics Collection

```typescript
// packages/core/src/metrics.ts
// Using prom-client for Prometheus-compatible metrics

import { Counter, Histogram, Gauge, Registry } from 'prom-client'

export const metrics = {
    apiRequestDuration: new Histogram({
        name: 'atc_api_request_duration_ms',
        help: 'API request duration in milliseconds',
        labelNames: ['method', 'route', 'status_code'],
        buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500]
    }),

    playersOnline: new Gauge({
        name: 'atc_game_players_online',
        help: 'Number of players currently online'
    }),

    securityViolations: new Counter({
        name: 'atc_security_violations_total',
        help: 'Total security violations detected',
        labelNames: ['type', 'severity']
    }),

    economyTransactions: new Counter({
        name: 'atc_economy_transactions_total',
        help: 'Total economy transactions',
        labelNames: ['type', 'currency']
    })
}

// Expose /metrics endpoint for Prometheus scrape
```

---

## Telemetry Endpoint

```typescript
// apps/api/src/routes/telemetry.routes.ts

router.get('/metrics', async (req, res) => {
    // Only accessible from localhost or monitoring network
    if (!isMonitoringNetwork(req.ip)) {
        return res.status(403).end()
    }
    res.set('Content-Type', register.contentType)
    res.end(await register.metrics())
})

router.post('/log', async (req, res) => {
    // Receives Lua-side logs for structured ingestion
    const { level, event, data, resource, timestamp } = req.body
    log[level]({ resource, ...data }, `fivem.${event}`)
    res.status(204).end()
})
```

---

## Error Tracking

### Unhandled Errors

```typescript
// apps/api/src/index.ts

process.on('uncaughtException', (err) => {
    logger.error({ err }, 'Uncaught exception — process will exit')
    process.exit(1)
})

process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection')
    // Do not exit — log and continue (with alerting)
})
```

### Request Error Handler

```typescript
// Fastify global error handler
app.setErrorHandler((error, request, reply) => {
    if (error instanceof ATCError) {
        // Known application error — structured response, log as warn
        logger.warn({ traceId: request.id, code: error.code }, error.message)
        return reply.status(error.statusCode ?? 422).send({
            success: false,
            error: { code: error.code, message: error.message, details: error.details },
            requestId: request.id
        })
    }

    // Unknown error — log as error, generic response
    logger.error({ traceId: request.id, err: error }, 'Unexpected error')
    return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
        requestId: request.id
    })
})
```

---

## Alerting Rules

| Condition | Threshold | Action |
|---|---|---|
| Error rate spike | >5% of requests in 60s | PagerDuty / Discord alert |
| API response time | p95 >500ms | Warning alert |
| API response time | p95 >2000ms | Critical alert |
| DB pool exhausted | 0 idle connections | Critical alert |
| Redis unreachable | 3+ consecutive failures | Critical alert |
| High-risk players | >5 players at risk ≥60 | Discord admin alert |
| Economy fraud | severity 3 detection | Immediate admin DM |
| Player count drop | >20% in 5min | Warning (possible crash) |

---

## Observability Stack (Recommended)

| Layer | Tool | Purpose |
|---|---|---|
| Logs | Loki + Grafana | Log aggregation and search |
| Metrics | Prometheus + Grafana | Dashboards and alerting |
| Traces | Jaeger (Phase 2+) | Distributed tracing |
| Alerting | Grafana Alerting + Discord webhook | On-call notifications |

Local dev: logs to console. Production: logs shipped to Loki via alloy/promtail.
