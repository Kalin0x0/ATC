# Contributing to Atlantic Core

Thanks for your interest in improving ATC. Atlantic Core is an open project by
Naiemi Group, and contributions are genuinely welcome — bug fixes, new plugins,
docs, and gameplay ideas all help.

Before you start, please read the [LICENSE](LICENSE). The short version: you can
use and modify ATC freely on your own server, and you can send improvements back
here, but you can't redistribute ATC as its own product. When you contribute,
you agree your changes can be included in the project under that same license.

## Ground rules (the same ones we hold ourselves to)

These keep the platform consistent and safe:

- **Never trust the client.** Anything that affects money, items, health, or
  state must be validated on the server. Treat every client event as hostile
  until proven otherwise.
- **Go through the SDK.** Use `ATC.SDK.*` for game interactions and the
  repository layer for data — no raw SQL in gameplay code, no direct database
  access outside `packages/db`.
- **Keep plugins decoupled.** Plugins talk to the core through the SDK and the
  event bus, never by reaching into another plugin's internals.
- **No legacy framework coupling in the core.** QBCore/ESX support lives in
  `bridges/` only.
- **Use translation keys for player-facing text.** No hardcoded strings in UI.
- **Rate-limit and validate every server event.** Validation uses the shared
  schemas; sensitive actions get logged.

The full conventions (event naming, database standards, security checklist) are
in [docs/architecture/](docs/architecture/).

## Setup

```bash
pnpm install
pnpm turbo build
pnpm turbo test
```

You'll want Node.js 22+, pnpm 9+, and Docker for the database and cache
(`infra/docker-compose.dev.yml` is the lightweight dev setup).

## Adding a plugin

The plugin guide walks through the whole thing:
[docs/sdk/PLUGIN_GUIDE.md](docs/sdk/PLUGIN_GUIDE.md). In short — copy the shape
of `plugins/atc-example-shop`, add your `atc.manifest.json` and `fxmanifest.lua`,
build the server/client logic against the SDK, and add a UI under `ui/` if it
needs one.

## Submitting changes

1. Fork the repository (forking to prepare a contribution is allowed under the
   license).
2. Create a branch for your change.
3. Make sure `pnpm turbo typecheck`, `pnpm turbo build`, and `pnpm turbo test`
   all pass.
4. Open a pull request that explains what changed and why. Keep the description
   plain and to the point.

## Reporting bugs

Open an issue with steps to reproduce, what you expected, and what actually
happened. Server logs and the relevant resource name help a lot.

— Naiemi Group
