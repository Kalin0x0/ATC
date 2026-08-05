# Atlantic Core — Publishing & Self-Hosting

How to publish your server on **FiveM** or **VMP**, and how to run it under
**your own name**. Atlantic Core stays the framework (by Naiemi Group); the
name, logo and colours your players see are yours to set.

<div align="center">

### 🌐 Choose your language — click a code to jump to that section

**[🇬🇧 EN](#english)**  ·  **[🇮🇷 FA — فارسی](#فارسی-farsi)**  ·  **[🇹🇷 TR — Türkçe](#türkçe-turkish)**  ·  **[🇪🇸 ES — Español](#español-spanish)**  ·  **[🇩🇪 DE — Deutsch](#deutsch-german)**

</div>

> **Related:** [`.github/FUNDING.yml`](../../.github/FUNDING.yml) · [`infra/server.cfg.example`](../../infra/server.cfg.example) (FiveM) · [`infra/server.cfg.vmp.example`](../../infra/server.cfg.vmp.example) (VMP) · [database setup guide](../../database/README.md)

---


## English

This section takes you from "ATC runs on my machine" to "players can find and join my
server, under my community's name". It covers both **FiveM** and **VMP** — the same ATC
resources run on either, unmodified.

Read it top to bottom the first time. Every command and every convar below exists in this
repository; nothing here is aspirational.

---

### 1. Prerequisites

Do not start on the publishing steps until all of this is true. Almost every "my server is
broken in production" report traces back to one of these being skipped.

**1.1 — The backend is up and healthy.**

ATC's game resources are a thin layer over the ATC API. The API needs MariaDB and Redis.

```bash
cp infra/.env.example infra/.env      # then edit it — see below
docker compose -f infra/docker-compose.yml up -d
```

`infra/.env` must have real values, not the placeholders:

```dotenv
DB_ROOT_PASSWORD=<a real password>
DB_PASSWORD=<a real password>
REDIS_PASSWORD=<a real password>
ATC_API_TOKEN=<at least 32 characters>
ATC_SERVER_TOKEN=<a real secret>
ATC_SERVER_ID=atc-main-01
PORT=3000
```

**1.2 — The database schema is loaded.** Either run the migration runner
(`pnpm db:migrate`) or import `database/atc.sql` into a fresh `atc` database. Step-by-step
Windows instructions in five languages are in `database/README.md`.

**1.3 — The monorepo is built.**

```bash
pnpm install
pnpm build
pnpm test
```

**1.4 — The API answers on its health endpoint.** Run this **from the machine that will run
the game server**, not just from your laptop:

```bash
curl -i http://<api-host>:3000/health
```

A healthy API returns HTTP 200 and:

```json
{"status":"ok","components":{"db":"ok","redis":"ok"},"timestamp":"..."}
```

If it returns **503** with `"status":"degraded"`, one of `db` or `redis` is down — fix that
before going further. The API also exposes `/api/v1/ops/live` and `/api/v1/ops/ready` for
uptime monitors. All three are exempt from bearer-token auth; every other route is not.

**1.5 — The ATC resources are in place, with their folder names intact.** Copy `game/atc-core`,
`game/atc-sdk` and the plugins you want from `plugins/` into your server's `resources`
directory.

> A CitizenFX server identifies a resource by its **folder name**. The `name` field inside
> `fxmanifest.lua` is metadata and does not rename anything. ATC's NUI pages address
> themselves as `https://<folder-name>/`, so renaming a shipped folder silently breaks that
> resource's user interface. Leave the folder names exactly as they ship.

**1.6 — The API is reachable from the game server.** `atc_api_url` defaults to
`http://localhost:3000`, which is only correct when the API and the game server run on the
same host. If they are on different machines, set the real address and make sure your
firewall allows it. Port 3000 should reach your game server and your admin panel — it should
**not** be open to the public internet.

---

### 2. Naming your server

ATC separates two things that are easy to confuse:

- **Framework identity** — *Atlantic Core*, *ATC*, *Naiemi Group*. This is attribution. It
  stays in `fxmanifest.lua`, in `LICENSE`, in the docs and in the server startup log. It is
  not a setting, and the licence reserves those names.
- **Server branding** — what *your players* see: the logo on the character screen, the tag on
  connect and ban messages, the tutorial welcome text. The admin panel's title is yours to
  change too, but it is a build-time setting rather than a convar — see 2.5. This section is
  how you configure all of it.

So: the framework remains **Atlantic Core by Naiemi Group**, and the server the players join
is **yours**, with your name on it.

#### 2.1 — The branding convars

All of these are read by `game/atc-core/shared/branding.lua`. **Every one is optional.** Leave
one unset and ATC uses the default shown — which is exactly the string the framework shipped
before these convars existed, so an existing deployment that sets nothing behaves identically
to before.

| Convar | Default | Max | What it changes |
|---|---|---|---|
| `atc_brand_name` | `Atlantic Core` | 64 chars | Server/community name: tutorial copy, character screens, the NUI window title |
| `atc_brand_short` | `ATC` | 16 chars | The bracketed tag on atc-core's connect, kick and ban messages — `[ATC]`, `[ATC Security]` |
| `atc_brand_logo_primary` | `ATLANTIC` | 16 chars | First word of the NUI logo, drawn in the accent colour |
| `atc_brand_logo_secondary` | `CORE` | 16 chars | Second word of the NUI logo, drawn in light weight |
| `atc_brand_community` | *(empty)* | 64 chars | Community line. Sanitised and delivered to the NUI, but atc-core draws no element for it |
| `atc_brand_website` | *(empty)* | 256 chars | Website URL. Delivered to the NUI, not drawn by atc-core |
| `atc_brand_discord` | *(empty)* | 256 chars | Discord invite. Delivered to the NUI, not drawn by atc-core |
| `atc_brand_color` | `#d4af37` | — | NUI accent colour, `#rrggbb` (`#abc` shorthand is expanded) |

Notes that save time later:

- Values are **sanitised**: control characters and angle brackets are stripped, whitespace is
  collapsed, and over-length values are truncated without splitting a UTF-8 character — so
  Persian and German names are safe.
- An empty value always falls back to the default. You cannot blank out `atc_brand_name` by
  setting it to `""`.
- `atc_brand_community`, `atc_brand_website` and `atc_brand_discord` are read, sanitised and
  sent to the NUI along with the rest of the branding payload, but **atc-core's own interface
  renders no element for any of them today**. They are there for plugins and custom UI to
  consume — setting them changes nothing you can see in the stock NUI.
- An invalid `atc_brand_color` is ignored, the default is kept, and the server prints a
  `^3[ATC:WARN]` line at startup naming the convar.
- Branding is read when `atc-core` starts. Change a convar, then restart the server (or
  `restart atc-core`) for it to take effect.
- Use `setr`, not `set`. Branding is read by client-side script — the tutorial and the
  NUI — as well as by the server, and a plain `set` convar never leaves the server. With
  `set` you get a half-rename: the startup log and the kick messages show your name while
  the character screen and the tutorial keep the shipped defaults. Every *other* ATC convar
  stays `set`: those are server-only, and `atc_api_token` / `atc_server_token` must never be
  made replicated.

#### 2.2 — `sv_hostname` is a separate thing

`sv_hostname` is your entry in the **server browser**. `atc_brand_name` is the same name
rendered **inside the game**. They are set in two different places and neither one derives
from the other. Setting one and forgetting the other is the single most common way a
rebranded server ends up half-renamed. Set both, to the same name.

#### 2.3 — `atc_platform`

```
set atc_platform "auto"     # auto | fivem | vmp | redm
```

`auto` detects the platform at runtime and is correct for almost everyone. Pin a value if the
platform ATC logs at startup is wrong for your host. ATC **never branches gameplay** on this —
it decides only what the logs, telemetry and ops records call the platform, so a wrong value
is a reporting bug, not a gameplay one.

Do **not** set `atc_platform_resolved`. The server writes that one itself from the detection
result and replicates it to clients.

#### 2.4 — Copy-pasteable: renaming a server end to end

Drop this into your `server.cfg`, replacing the example values. This is the complete in-game
rename — no source file to touch. The web admin panel is renamed separately, at build time; see
2.5.

```cfg
# ── Server identity ───────────────────────────────────────────────────────────
sv_hostname "Nova City RP — [NOVA]"
sv_maxclients 64
sets tags "roleplay,mmo,nova"

# ── Platform ──────────────────────────────────────────────────────────────────
set atc_platform "auto"

# ── Server branding ───────────────────────────────────────────────────────────
setr atc_brand_name           "Nova City RP"
setr atc_brand_short          "NOVA"
setr atc_brand_logo_primary   "NOVA"
setr atc_brand_logo_secondary "CITY"
setr atc_brand_community      "Nova Community"
setr atc_brand_website        "https://novacityrp.example"
setr atc_brand_discord        "https://discord.gg/your-invite"
setr atc_brand_color          "#3ea6ff"
```

With that in place, players see `Nova City RP` in the tutorial, `NOVA CITY` on the character
screen, `[NOVA] You are banned from this server.` on a ban from atc-core, and `Nova City RP` in
the server browser. The framework's own attribution — `Atlantic Core`, `Naiemi Group` — stays in
the manifests, the licence and the startup log, where it belongs.

#### 2.5 — Renaming the web admin panel

The admin panel under `apps/web` is a separate React application, and its visible product name
is **not** a convar — the game server's convars are not readable by a browser app that is built
ahead of time. It comes from the Vite environment variable `VITE_BRAND_NAME`, which is baked in
when the panel is compiled:

```bash
VITE_BRAND_NAME="Nova RP" pnpm --filter @atc/web build
```

You can also put `VITE_BRAND_NAME=Nova RP` in an `.env` file next to `apps/web/package.json`.
Unset, it resolves to `Atlantic Core`, so an existing build is unchanged. The value drives the
login screen heading and footer, the sidebar name and the browser tab title. Changing it
requires a rebuild — there is no runtime toggle.

One more thing that is *not* configurable today: the in-game admin plugin's NUI window title
(`plugins/atc-admin/ui/index.html`) is hardcoded to `ATC Admin Panel`. If you need that renamed,
edit that file in your own deployment.

---

### 3. Publishing on FiveM

#### 3.1 — Get a licence key

FiveM servers require a licence key issued by Cfx.re, from **https://keymaster.fivem.net**.
Create a key for your server and put it in `server.cfg`:

```cfg
sv_licenseKey "YOUR_FIVEM_LICENSE_KEY"
```

A key issued by one platform is not valid on another. A keymaster.fivem.net key works on
FiveM only.

#### 3.2 — Get server artifacts

The game server binary is **FXServer**, published by Cfx.re as per-OS builds ("artifacts").
Download the current recommended build for your operating system from the Cfx.re artifacts
server linked from the official FiveM server-hosting documentation — do not use a build from
a random mirror, and do not use another platform's build.

The on-disk shape is the same everywhere:

```bash
# Linux
./run.sh +exec server.cfg

# Windows
FXServer.exe +exec server.cfg
```

#### 3.3 — Build your server.cfg

Start from `infra/server.cfg.example`, which is the FiveM variant and already contains every
ATC convar, the correct start order, and the admin ACE line:

```bash
cp infra/server.cfg.example server.cfg
```

Then **merge in the networking lines from the stock `server.cfg` that shipped with your
artifact**. `infra/server.cfg.example` is an ATC overlay — it deliberately does not carry
platform boilerplate. In particular you need the endpoint lines and an RCON password:

```cfg
endpoint_add_tcp "0.0.0.0:30120"
endpoint_add_udp "0.0.0.0:30120"

rcon_password "a-long-random-value"
```

The ATC-specific parts you must fill in:

```cfg
set atc_api_url      "http://<api-host>:3000"
set atc_api_token    "<same value as ATC_API_TOKEN in infra/.env>"
set atc_server_token "<same value as ATC_SERVER_TOKEN in infra/.env>"
set atc_server_id    "atc-main-01"
set atc_locale       "en"
set atc_fail_open    "false"
```

And the admin grant. ATC keys every player record on the `license` identifier, so granting
admin by license is the path that always works — find your own identifier in the server
console when you connect:

```cfg
add_ace identifier.license:XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX atc.admin allow
```

Resources are started by folder name, core first:

```cfg
start atc-core
start atc-sdk
start atc-identity
# ... the rest of your plugins
```

Two traps `infra/server.cfg.example` already warns about, repeated here because they cost
people evenings:

- **`plugins/atc-plugin-healthcheck` is not a game resource.** It has no `fxmanifest.lua` — it
  is a server-side Node plugin for the ATC API. Adding a `start` line for it produces a
  "resource not found" error.
- **The bridge folders are not named after their manifests.** See the troubleshooting table
  in section 6.

#### 3.4 — Port forwarding

The game server listens on **30120 by default, on both TCP and UDP**. Forward both:

| Port | Protocol | Why |
|---|---|---|
| 30120 | TCP | HTTP endpoint, server info, resource file downloads |
| 30120 | UDP | Actual game traffic — without this players connect and then time out |

Forwarding TCP but not UDP is the classic half-configured firewall: the server appears in the
list, shows the right name and player count, and nobody can actually join.

Do **not** forward the ATC API port (3000) or the database port to the public internet.

#### 3.5 — Getting onto the server list

Listing is automatic once the licence key registers. There is no submission form.

- Leave **`sv_master1` alone**. Overriding it marks the server as private and it stops being
  listed.
- Set a real `sv_hostname`. A server still called `default FXServer` is functionally invisible.
- If your server sits behind NAT, a proxy or a load balancer and lists with the wrong address,
  use the standard overrides:

```cfg
set sv_listingIpOverride   "your.public.ip"
set sv_listingHostOverride "play.yourserver.example"
set sv_forceIndirectListing "true"
```

#### 3.6 — Common failure modes on FiveM

| Symptom | Cause |
|---|---|
| Server refuses to start, complains about the licence | `sv_licenseKey` missing, mistyped, or issued for a different platform |
| Server runs, never appears in the list | `sv_master1` overridden, or the licence key never registered |
| Appears in the list, players time out on join | UDP 30120 not forwarded |
| Appears with the wrong IP | Behind NAT — set the listing overrides above |
| Listed as `default FXServer` | `sv_hostname` not set, or set after the `exec` that matters |

---

### 4. Publishing on VMP

#### 4.1 — What VMP is, and why ATC needs no porting

VMP (vmp.ir) is a **CitizenFX-compatible platform** — it is an explicit fork of the FiveM
server. The resource contract is the same one FiveM uses: `fxmanifest.lua`,
`fx_version 'cerulean'`, `game 'gta5'`, resources identified by folder name, the same
`start` / `ensure` / `restart` commands, the same `sv_*` convars, and the same natives,
exports and events.

**ATC therefore runs on VMP unmodified.** No resource in this repository needs porting, no
manifest needs editing, and no Lua needs changing. Everything that differs is deployment
plumbing, and all of it lives in your `server.cfg`.

#### 4.2 — Where these VMP facts come from

VMP's own sites — website, community forum and server list — return HTTP 403 to anything that
is not an ordinary browser and are effectively unreachable from outside Iran. Everything this
document states about VMP therefore comes from **reading VMP's published server source**
(`github.com/v-mp/vmp`), which is authoritative for how the server actually behaves. Each claim
below is cited by file and line so you can check it yourself.

The endpoints VMP's server is hard-coded to use:

| What | Value | Source |
|---|---|---|
| Licensing base | `https://api.vmp.ir/` | `citizen-server-impl/include/ServerLicensingComponent.h:36` |
| Key registration | `POST https://api.vmp.ir/server/register.php?work=register` | `citizen-server-impl/src/ServerAuth.cpp:44` |
| Server-list heartbeat | `https://api.vmp.ir/server/heartbeat.php?work=heartbeat` — the built-in default of `sv_master1` | `citizen-server-impl/src/GameServer.cpp:54,120` |
| Client updates | `https://cdn.vmp.ir/updates` | `client/launcher/Bootstrap.cpp:100` |
| Game cache mirrors | `https://cdn.vmp.ir/mirrors/patches_fivem/3570/…` (game build **3570**) | `client/launcher/GameCache.cpp:1402ff` |

Two things are **not** answerable from the source, because they live only on VMP's website: how
you obtain a licence key, and where server artifacts are downloaded. Both are marked as open
below rather than guessed at.

One useful negative result: VMP's Cfx.re "nucleus" registration is **commented out** in the
source (`citizen-server-impl/src/ServerNucleus.cpp:60-100`), so a VMP server does not register
itself with `cfx.re`. Your VMP server does not phone home to FiveM infrastructure.

#### 4.3 — Start from the VMP config

```bash
cp infra/server.cfg.vmp.example server.cfg
```

The ATC convar block in that file is **identical** to the FiveM variant — same names, same
defaults, same branding block. Only the licence, platform and server-list notes differ.

Pin the platform so your logs and telemetry name the right one:

```cfg
set atc_platform "vmp"
```

Everything in section 2 applies unchanged: `sv_hostname` plus the `atc_brand_*` convars, set
in exactly the same way.

#### 4.4 — Licence key

A VMP licence key is **mandatory** — this is verified, not assumed. On startup VMP runs a
licence check and calls `FatalError` on every failure path, which stops the server
(`ServerAuth.cpp:30-80`).

The key is validated against **VMP's own** licensing service at `https://api.vmp.ir/`, **not**
against keymaster.fivem.net. A FiveM key will never authenticate on VMP, and vice versa.

```cfg
sv_licenseKey "YOUR_VMP_LICENSE_KEY"
```

**What happens at startup.** The server posts `{"license":"<your key>"}` to
`https://api.vmp.ir/server/register.php?work=register`. On success it prints:

```
Server Auth: Checking license...
Server Auth: Server license key authentication succeeded!
Server Auth: Session Id : <id>
```

…and writes `sv_sessionId` and `sv_secret` from the response itself, then forces an immediate
server-list heartbeat.

**The three failure messages**, so you can tell them apart:

| Console message | Meaning |
|---|---|
| `Please set sv_licenseKey in server.cfg!` | The convar is empty or missing |
| `A connection with the VMP server could not be established!` | `api.vmp.ir` was unreachable — network, DNS or firewall |
| *(a message from VMP's API, verbatim)* | The key itself was rejected — expired, revoked, or bound to a different server |

**IPv4 is required.** The licence request is made with `opts.ipv4 = true`
(`ServerAuth.cpp:43`), and so is the list heartbeat (`GameServer.cpp:1001`). A host with only
IPv6 connectivity to the internet cannot license or list, and will fail with the connection
error above.

Do **not** set `sv_sessionId` or `sv_secret` by hand. The handshake writes both, and the
heartbeat explicitly refuses to send while either is empty (`GameServer.cpp:971-973`) — setting
them manually will not make an unlicensed server appear.

> **Open point:** how a key is issued is published only on VMP's website and community forum,
> which we cannot read from outside Iran. Get the current procedure from VMP directly. What is
> certain from the source is the endpoint it will be checked against.

#### 4.5 — Artifacts and the player client

- **Server artifacts** come from VMP, not from FiveM's artifacts server, and a FiveM artifact
  will not accept a VMP licence key — it would check against keymaster.fivem.net. They are
  **not published as GitHub releases** (VMP's public repository has none), and the source does
  not contain a server-artifact download URL, so we cannot name one here. The on-disk shape is
  FXServer's, because the server *is* FXServer: `FXServer.exe +exec server.cfg` on Windows,
  `./run.sh +exec server.cfg` on Linux.
  **Open point — get the current build and its download location from VMP directly.**
- **Players use the VMP launcher**, not the FiveM client. The launcher updates itself from
  `https://cdn.vmp.ir/updates` (`client/launcher/Bootstrap.cpp:100`) and pulls its GTA V game
  cache from `https://cdn.vmp.ir/mirrors/patches_fivem/3570/…` (`GameCache.cpp:1402ff`) — so
  VMP currently targets **game build 3570**. Joining is done through the launcher, from VMP's
  server list or its direct-connect field.

#### 4.6 — Server list

Listing uses the standard FXServer heartbeat. `sv_master1` already defaults to
`https://api.vmp.ir/server/heartbeat.php?work=heartbeat`, so **you do not configure it**
(`GameServer.cpp:54,120`). The heartbeat repeats every **3 minutes**
(`GameServer.cpp:1074`), and each one posts your player count, server info and port to that
endpoint.

**A valid licence is what gets you listed.** The heartbeat checks `sv_sessionId` and `sv_secret`
and returns immediately if either is empty (`GameServer.cpp:971-973`). Those are written only by
a successful licence handshake — so an unlicensed server never appears, no matter how correct the
rest of the config is. There is a public web front end at **list.vmp.ir**; it is a website, not
something your server talks to.

**Leave `sv_master1` alone.** The mechanism is worth understanding, because the failure is
silent: the heartbeat carries a `private` flag that starts as `true`, and it is set to `false`
only when one of `sv_master1`…`sv_master3` is *exactly* the default VMP URL
(`GameServer.cpp:1039-1070`). Point `sv_master1` somewhere else and the heartbeat still fires —
your server just stays flagged private and never shows up publicly. Never point it at a FiveM
master; that master does not know about your server.

- Set a real `sv_hostname` — its built-in default is literally `default FXServer`
  (`GameServer.cpp:119`).
- Behind NAT or a proxy, the same three overrides apply, with the same names and meanings as on
  FiveM: `sv_listingIpOverride`, `sv_listingHostOverride`, `sv_forceIndirectListing`. All three
  are read straight into the heartbeat payload (`GameServer.cpp:985-998`).
- If the list query returns an error, the server prints it verbatim as
  `^1Server list query returned an error: …` — read that line before guessing.

If your server still does not appear with a valid key, a running heartbeat and a correct
hostname, ask on VMP's community forum — that is where operators raise listing problems.

#### 4.7 — Two compatibility notes

- **Escrowed assets: assume nothing.** Encrypted Cfx.re "escrow" assets are decrypted against
  Cfx.re's own service, so it would be unwise to count on them working on a non-Cfx.re platform
  — but we did not verify what VMP actually does with them. Plan for open-source or unencrypted
  resources alongside ATC, and test before you rely on anything escrowed. ATC itself ships no
  escrowed assets, so this never affects ATC's own resources.
- **Third-party resources.** Every ATC resource uses only stock CitizenFX natives, exports and
  events, which VMP provides unchanged. If a *third-party* resource misbehaves on VMP, that is
  between you and that resource — ask on the VMP community forum, where operators discuss which
  scripts need adjusting.

---

### 5. Verification checklist

Work through these in order. Each one isolates a different layer, so the first failure tells
you where the problem is.

**Backend**

- [ ] `curl -i http://<api-host>:3000/health` returns **200** with `"status":"ok"` and both
      `db` and `redis` reporting `ok`.
- [ ] The same `curl` succeeds **from the game server host**, not only from your workstation.

**Startup**

- [ ] The game server console shows the ATC banner:
      `Server: <your brand name>  |  Platform: <FiveM|VMP|...>`.
      If the name is still `Atlantic Core`, `atc_brand_name` is not being read — check for a
      typo or a `set` line placed after the resources start.
- [ ] The platform on that line matches reality. If not, pin `atc_platform`.
- [ ] There are **no** `^3[ATC:WARN]` lines. Every one of them names the exact convar to fix.
- [ ] Every `start` line resolved. No "resource not found" errors, and no started resource
      whose folder you renamed.

**Locally joinable**

- [ ] You can connect from the same machine — `localhost:30120` in the direct-connect box of
      whichever client your platform uses (the FiveM client, or the VMP launcher on VMP).
- [ ] The character screen shows **your** logo words, in **your** accent colour.
- [ ] The tutorial welcome text names **your** server.
- [ ] A test kick or ban through atc-core shows **your** tag, e.g. `[NOVA] ...`, not `[ATC] ...`.
- [ ] Your admin commands work (`/atcban`, `/atckick`, `/atcbring`). If "no permission", the
      `add_ace` line does not match your actual identifier.

**Publicly joinable**

- [ ] A connection from **outside your network** succeeds — test from a phone on mobile data,
      not from the LAN. This is the step that catches a missing UDP forward.
- [ ] The server appears in the platform's server list under your `sv_hostname`, with the
      correct player count and the correct public address.
- [ ] `sv_hostname` and `atc_brand_name` say the same thing.

---

### 6. Troubleshooting

| Symptom | What it means | Fix |
|---|---|---|
| Console: `^3[ATC:WARN] atc_server_token is not set. Set it in server.cfg.^7` | `atc_server_token` is empty | Set it in `server.cfg` to the same value as `ATC_SERVER_TOKEN` in `infra/.env` |
| Console: `^3[ATC:WARN] atc_api_token is not set. API calls will fail. Set it in server.cfg.^7` | `atc_api_token` is empty — **nothing that touches the API will work** | Set it to the same value as `ATC_API_TOKEN` in `infra/.env` (minimum 32 characters) |
| Console: `^3[ATC:WARN] atc_brand_color is not a valid hex colour (expected #rrggbb). Falling back to #d4af37.^7` | Colour value is not a hex triplet | Use `#rrggbb`, e.g. `#3ea6ff`. `#abc` shorthand is accepted and expanded; names like `blue` are not |
| Players are rejected at the connect card with a "server configuration error" message | `atc_api_token` is empty and `atc_fail_open` is `false` | Set `atc_api_token`. This is the previous warning, one step later |
| Players are rejected with a "could not verify your account" message | The account API call failed: API down, wrong `atc_api_url`, wrong token, or firewalled | `curl http://<api-host>:3000/health` **from the game server**; check `atc_api_url`; check the token matches `infra/.env` |
| Everyone is blocked whenever the API hiccups | Working as designed — `atc_fail_open` defaults to `false`, which blocks joins when the API is unreachable | Fix the API. `set atc_fail_open "true"` lets players in during an outage, but they join without a verified account and without ban checks — treat it as a temporary measure, not a setting to leave on |
| Connect card rejects a player for a missing licence identifier | ATC keys every player on the `license` identifier and cannot proceed without it | This is normally a client-side problem. Note that `add_ace identifier.license:...` is also why admin grants should use `license`, not `steam` |
| Console: resource `atc-plugin-healthcheck` not found | It has no `fxmanifest.lua` — it is a server-side Node plugin for the ATC API, not a game resource | Remove the `start` line. It is deliberately absent from both shipped cfg examples |
| Bridge does not start: `start atc-bridge-esx` / `start atc-bridge-qb` fails | The **folder** names in this repo are `bridges/esx` and `bridges/qb-core`, but their manifests say `name 'atc-bridge-esx'` / `name 'atc-bridge-qb'`. Resources are started by folder name; the manifest `name` renames nothing | Rename each folder as you copy it — `bridges/esx` → `atc-bridge-esx`, `bridges/qb-core` → `atc-bridge-qb` — so folder, manifest and `start` line agree. If you already copied them unrenamed, use `start esx` / `start qb-core` instead |
| QBCore server breaks after adding the QB bridge | You copied `bridges/qb-core` unrenamed into a server that already has a `qb-core` resource — the bridge collides with the framework it exists to talk to | Rename the folder to `atc-bridge-qb`. Do not run two resources named `qb-core` |
| A resource's UI is blank / NUI callbacks do nothing after you renamed its folder | ATC's NUI pages address themselves as `https://<folder-name>/`. Renaming a shipped folder breaks that | Restore the original folder name. Only the two bridge folders are safe to rename — they have no NUI |
| Branding changes do not appear in game | Branding convars are read when `atc-core` starts | Restart the server, or `restart atc-core`. Also check the `set` lines come **before** the `start` lines |
| Server browser shows one name, in-game UI shows another | `sv_hostname` and `atc_brand_name` are independent | Set both, to the same value |
| In-game name is still `Atlantic Core` | `atc_brand_name` unset, misspelled, declared with `set` instead of `setr` (so it never reaches the client), or set to an empty string (empty always falls back to the default) | Use `setr atc_brand_name "Your Name"`, non-empty |
| Web admin panel still says `Atlantic Core` after setting `atc_brand_name` | The panel's name is not a convar — it is the build-time `VITE_BRAND_NAME` (see 2.5) | Rebuild the panel: `VITE_BRAND_NAME="Nova RP" pnpm --filter @atc/web build` |
| `atc_brand_community` / `_website` / `_discord` are set but nothing shows | Expected — they are delivered to the NUI but atc-core renders no element for them | Nothing to fix. Consume them from a plugin or a custom UI |
| A long or non-Latin brand name is cut short | Values are truncated to their documented limits (64 chars for the name, 16 for the tag and logo words), on character boundaries so UTF-8 stays valid | Use a shorter name |
| Startup banner names the wrong platform | Auto-detection could not tell this build apart from upstream | Pin it: `set atc_platform "vmp"` (or `fivem` / `redm`). Never set `atc_platform_resolved` yourself |
| Server runs but never appears in any list | No valid licence key, or `sv_master1` was overridden | Check the licence key registered at startup; remove any `sv_master1` line |
| Listed correctly, players connect then time out | UDP 30120 is not forwarded | Forward **both** TCP and UDP on 30120 |
| Listed with the wrong IP or hostname | Behind NAT, a proxy or a load balancer | Set `sv_listingIpOverride` / `sv_listingHostOverride` / `sv_forceIndirectListing` |
| VMP server exits at startup with a licence error | No usable `sv_licenseKey` — on FXServer, which VMP is forked from, a missing or rejected key stops startup | Set a key issued by VMP. A keymaster.fivem.net key can never work here |
| A third-party (non-ATC) resource misbehaves on VMP | Not an ATC issue — ATC uses only stock CitizenFX natives | Ask about that resource on the VMP community forum. If it is an escrowed Cfx.re asset, do not assume escrow works off Cfx.re — test it before relying on it |
| `/health` returns 503 `"status":"degraded"` | MariaDB or Redis is unreachable from the API | Read the `components` object in the response — it names which one. Check `docker compose ps` and the passwords in `infra/.env` |


---


## فارسی (Farsi)

این بخش شما را از «ATC روی سیستم من اجرا می‌شود» به «بازیکن‌ها می‌توانند سرور من را پیدا کنند
و با نام کامیونیتی خودم به آن وصل شوند» می‌رساند. هم **FiveM** و هم **VMP** را پوشش می‌دهد —
همان ریسورس‌های ATC بدون هیچ تغییری روی هر دو اجرا می‌شوند.

بار اول آن را از ابتدا تا انتها بخوانید. هر دستور و هر convar که در ادامه می‌آید واقعاً در همین
ریپازیتوری وجود دارد؛ هیچ‌چیز اینجا وعدهٔ آینده نیست.

---

### 1. پیش‌نیازها

تا وقتی همهٔ موارد زیر برقرار نشده، سراغ مراحل انتشار نروید. تقریباً هر گزارشِ «سرورم در محیط
پروداکشن خراب است» به رد شدن از یکی از همین مراحل برمی‌گردد.

**1.1 — بک‌اند بالا و سالم است.**

ریسورس‌های گیمِ ATC یک لایهٔ نازک روی ATC API هستند. این API به MariaDB و Redis نیاز دارد.

```bash
cp infra/.env.example infra/.env      # then edit it — see below
docker compose -f infra/docker-compose.yml up -d
```

فایل `infra/.env` باید مقادیر واقعی داشته باشد، نه مقادیر نمونه:

```dotenv
DB_ROOT_PASSWORD=<a real password>
DB_PASSWORD=<a real password>
REDIS_PASSWORD=<a real password>
ATC_API_TOKEN=<at least 32 characters>
ATC_SERVER_TOKEN=<a real secret>
ATC_SERVER_ID=atc-main-01
PORT=3000
```

**1.2 — اسکیمای دیتابیس بارگذاری شده است.** یا اجراکنندهٔ مایگریشن را اجرا کنید
(`pnpm db:migrate`) یا فایل `database/atc.sql` را در یک دیتابیس تازهٔ `atc` ایمپورت کنید.
راهنمای گام‌به‌گام ویندوز به پنج زبان در `database/README.md` موجود است.

**1.3 — مونوریپو بیلد شده است.**

```bash
pnpm install
pnpm build
pnpm test
```

**1.4 — API روی اندپوینت سلامت پاسخ می‌دهد.** این را **از همان ماشینی که سرور گیم روی آن اجرا
می‌شود** بزنید، نه فقط از لپ‌تاپ خودتان:

```bash
curl -i http://<api-host>:3000/health
```

یک API سالم HTTP 200 و این پاسخ را برمی‌گرداند:

```json
{"status":"ok","components":{"db":"ok","redis":"ok"},"timestamp":"..."}
```

اگر **503** با `"status":"degraded"` برگرداند، یکی از `db` یا `redis` پایین است — قبل از ادامه
آن را درست کنید. این API دو مسیر `/api/v1/ops/live` و `/api/v1/ops/ready` را هم برای
مانیتورهای آپ‌تایم ارائه می‌دهد. هر سه از احراز هویت با bearer token معاف‌اند؛ بقیهٔ مسیرها نه.

**1.5 — ریسورس‌های ATC سر جایشان هستند و نام پوشه‌هایشان دست‌نخورده است.** پوشه‌های
`game/atc-core`، `game/atc-sdk` و هر پلاگینی از `plugins/` که می‌خواهید را در دایرکتوری
`resources` سرورتان کپی کنید.

> یک سرور CitizenFX هر ریسورس را با **نام پوشه‌اش** می‌شناسد. فیلد `name` داخل `fxmanifest.lua`
> فقط متادیتا است و چیزی را تغییر نام نمی‌دهد. صفحه‌های NUI در ATC خودشان را با آدرس
> `https://<folder-name>/` صدا می‌زنند، بنابراین تغییر نام یک پوشهٔ اصلی، رابط کاربری آن ریسورس
> را بی‌سروصدا خراب می‌کند. نام پوشه‌ها را دقیقاً همان‌طور که ارائه شده‌اند رها کنید.

**1.6 — API از سرور گیم قابل دسترسی است.** مقدار پیش‌فرض `atc_api_url` برابر
`http://localhost:3000` است و فقط وقتی درست است که API و سرور گیم روی یک هاست باشند. اگر روی دو
ماشین جدا هستند، آدرس واقعی را ست کنید و مطمئن شوید فایروال اجازه می‌دهد. پورت 3000 باید برای
سرور گیم و پنل ادمین شما در دسترس باشد — اما **نباید** روی اینترنت عمومی باز باشد.

---

### 2. نام‌گذاری سرور

ATC دو چیز را که به‌راحتی با هم اشتباه گرفته می‌شوند از هم جدا می‌کند:

- **هویت فریم‌ورک** — *Atlantic Core*، *ATC*، *Naiemi Group*. این‌ها اعتبار و انتساب هستند. در
  `fxmanifest.lua`، در `LICENSE`، در مستندات و در لاگ راه‌اندازی سرور باقی می‌مانند. تنظیم‌شدنی
  نیستند و لایسنس این نام‌ها را برای خود محفوظ نگه داشته است.
- **برندینگ سرور** — چیزی که *بازیکن‌های شما* می‌بینند: لوگو روی صفحهٔ کاراکتر، تگ روی پیام‌های
  اتصال و بن، متن خوش‌آمدگویی آموزش. عنوان پنل ادمین هم مال خودتان است و می‌توانید تغییرش دهید،
  اما آن یک تنظیم زمانِ بیلد است نه یک convar — بخش 2.5 را ببینید. همین بخش به شما می‌گوید چطور
  همهٔ این‌ها را تنظیم کنید.

پس: فریم‌ورک همچنان **Atlantic Core by Naiemi Group** باقی می‌ماند و سروری که بازیکن‌ها به آن
وصل می‌شوند **مال شماست**، با نام شما.

#### 2.1 — convarهای برندینگ

همهٔ این‌ها توسط `game/atc-core/shared/branding.lua` خوانده می‌شوند. **همگی اختیاری هستند.** اگر
یکی را ست نکنید، ATC از مقدار پیش‌فرضی که نشان داده شده استفاده می‌کند — و آن دقیقاً همان رشته‌ای
است که فریم‌ورک پیش از وجود این convarها ارائه می‌داد؛ بنابراین یک نصب موجود که هیچ‌چیز ست
نمی‌کند، دقیقاً مثل قبل رفتار می‌کند.

| Convar | پیش‌فرض | حداکثر | چه چیزی را عوض می‌کند |
|---|---|---|---|
| `atc_brand_name` | `Atlantic Core` | 64 کاراکتر | نام سرور/کامیونیتی: متن آموزش، صفحه‌های کاراکتر، عنوان پنجرهٔ NUI |
| `atc_brand_short` | `ATC` | 16 کاراکتر | تگ داخل کروشه روی پیام‌های connect، kick و ban در atc-core — `[ATC]`، `[ATC Security]` |
| `atc_brand_logo_primary` | `ATLANTIC` | 16 کاراکتر | کلمهٔ اول لوگوی NUI، با رنگ اکسنت رسم می‌شود |
| `atc_brand_logo_secondary` | `CORE` | 16 کاراکتر | کلمهٔ دوم لوگوی NUI، با وزن سبک رسم می‌شود |
| `atc_brand_community` | *(خالی)* | 64 کاراکتر | خط کامیونیتی. پاک‌سازی و به NUI تحویل داده می‌شود، اما atc-core هیچ المانی برای آن رسم نمی‌کند |
| `atc_brand_website` | *(خالی)* | 256 کاراکتر | آدرس وب‌سایت. به NUI تحویل داده می‌شود، اما atc-core آن را رسم نمی‌کند |
| `atc_brand_discord` | *(خالی)* | 256 کاراکتر | لینک دعوت دیسکورد. به NUI تحویل داده می‌شود، اما atc-core آن را رسم نمی‌کند |
| `atc_brand_color` | `#d4af37` | — | رنگ اکسنت NUI، به شکل `#rrggbb` (شکل کوتاه `#abc` بسط داده می‌شود) |

نکاتی که بعداً وقت شما را نجات می‌دهند:

- مقادیر **پاک‌سازی می‌شوند**: کاراکترهای کنترلی و علامت‌های کوچک‌تر/بزرگ‌تر حذف می‌شوند،
  فاصله‌های اضافی جمع می‌شوند و مقادیر بلندتر از حد مجاز بدون شکستن یک کاراکتر UTF-8 کوتاه
  می‌شوند — بنابراین نام‌های فارسی و آلمانی امن هستند.
- مقدار خالی همیشه به پیش‌فرض برمی‌گردد. نمی‌توانید با ست کردن `atc_brand_name` به `""` آن را
  خالی کنید.
- مقادیر `atc_brand_community`، `atc_brand_website` و `atc_brand_discord` خوانده، پاک‌سازی و
  همراه با بقیهٔ پیلود برندینگ به NUI فرستاده می‌شوند، اما **رابط کاربری خودِ atc-core امروز
  هیچ المانی برای هیچ‌کدام از آن‌ها رسم نمی‌کند**. این‌ها آنجا هستند تا پلاگین‌ها و رابط کاربری
  سفارشی از آن‌ها استفاده کنند — ست کردنشان چیزی را که در NUI استاندارد می‌بینید تغییر نمی‌دهد.
- یک `atc_brand_color` نامعتبر نادیده گرفته می‌شود، پیش‌فرض حفظ می‌شود و سرور هنگام راه‌اندازی
  یک خط `^3[ATC:WARN]` چاپ می‌کند که نام همان convar را می‌آورد.
- برندینگ هنگام استارت `atc-core` خوانده می‌شود. بعد از تغییر یک convar، سرور را ری‌استارت کنید
  (یا `restart atc-core`) تا اعمال شود.
- از `setr` استفاده کنید، نه `set`. برندینگ علاوه بر سرور، توسط اسکریپت سمت کلاینت — آموزش
  و NUI — هم خوانده می‌شود و یک convar ساده با `set` هرگز از سرور خارج نمی‌شود. با `set` یک
  تغییرنام نیمه‌کاره می‌گیرید: لاگ استارتاپ و پیام‌های کیک نام شما را نشان می‌دهند، در حالی که
  صفحهٔ شخصیت و آموزش روی مقادیر پیش‌فرض باقی می‌مانند. هر convar *دیگرِ* ATC روی `set` می‌ماند:
  آن‌ها فقط سمت سرور هستند و `atc_api_token` / `atc_server_token` هرگز نباید replicate شوند.

#### 2.2 — `sv_hostname` چیز جداگانه‌ای است

مقدار `sv_hostname` همان چیزی است که در **لیست سرورها** ثبت می‌شود. مقدار `atc_brand_name` همان
نام است اما **داخل بازی** نمایش داده می‌شود. این دو در دو جای متفاوت ست می‌شوند و هیچ‌کدام از
دیگری مشتق نمی‌شود. ست کردن یکی و فراموش کردن دیگری رایج‌ترین دلیلی است که یک سرور ری‌برند شده
نیمه‌تغییرنام باقی می‌ماند. هر دو را ست کنید، با یک نام یکسان.

#### 2.3 — `atc_platform`

```
set atc_platform "auto"     # auto | fivem | vmp | redm
```

مقدار `auto` پلتفرم را در زمان اجرا تشخیص می‌دهد و برای تقریباً همه درست است. فقط وقتی مقدار را
ثابت (pin) کنید که پلتفرمی که ATC هنگام راه‌اندازی لاگ می‌کند برای هاست شما اشتباه باشد. ATC
**هرگز گیم‌پلی را بر اساس این مقدار شاخه‌بندی نمی‌کند** — این مقدار فقط تعیین می‌کند لاگ‌ها،
تله‌متری و رکوردهای ops پلتفرم را چه بنامند؛ پس یک مقدار اشتباه یک باگ گزارش‌دهی است، نه یک باگ
گیم‌پلی.

مقدار `atc_platform_resolved` را **ست نکنید**. سرور خودش آن را از نتیجهٔ تشخیص می‌نویسد و برای
کلاینت‌ها رپلیکیت می‌کند.

#### 2.4 — آمادهٔ کپی/پیست: تغییر نام کامل یک سرور

این را در `server.cfg` خود قرار دهید و مقادیر نمونه را جایگزین کنید. این کل کارِ تغییر نام داخل
بازی است — هیچ فایل سورسی نباید دست بخورد. پنل ادمین وب جداگانه و در زمان بیلد تغییر نام داده
می‌شود؛ بخش 2.5 را ببینید.

```cfg
# ── Server identity ───────────────────────────────────────────────────────────
sv_hostname "Nova City RP — [NOVA]"
sv_maxclients 64
sets tags "roleplay,mmo,nova"

# ── Platform ──────────────────────────────────────────────────────────────────
set atc_platform "auto"

# ── Server branding ───────────────────────────────────────────────────────────
setr atc_brand_name           "Nova City RP"
setr atc_brand_short          "NOVA"
setr atc_brand_logo_primary   "NOVA"
setr atc_brand_logo_secondary "CITY"
setr atc_brand_community      "Nova Community"
setr atc_brand_website        "https://novacityrp.example"
setr atc_brand_discord        "https://discord.gg/your-invite"
setr atc_brand_color          "#3ea6ff"
```

با این تنظیمات، بازیکن‌ها در آموزش `Nova City RP` را می‌بینند، روی صفحهٔ کاراکتر `NOVA CITY`،
هنگام بنی که از سمت atc-core می‌آید پیام `[NOVA] You are banned from this server.` و در لیست
سرورها `Nova City RP`. انتساب خودِ فریم‌ورک — `Atlantic Core`، `Naiemi Group` — در منیفست‌ها،
لایسنس و لاگ راه‌اندازی باقی می‌ماند، جایی که به آن تعلق دارد.

#### 2.5 — تغییر نام پنل ادمین وب

پنل ادمین زیر `apps/web` یک اپلیکیشن React جداگانه است و نام محصولی که نمایش می‌دهد یک convar
**نیست** — convarهای سرور گیم برای یک اپ مرورگری که از پیش بیلد شده قابل خواندن نیستند. این نام
از متغیر محیطی Vite با نام `VITE_BRAND_NAME` می‌آید که هنگام کامپایل شدن پنل داخل آن پخته می‌شود:

```bash
VITE_BRAND_NAME="Nova RP" pnpm --filter @atc/web build
```

می‌توانید `VITE_BRAND_NAME=Nova RP` را در یک فایل `.env` کنار `apps/web/package.json` هم قرار
دهید. اگر ست نشود، به `Atlantic Core` می‌رسد؛ بنابراین یک بیلد موجود بدون تغییر می‌ماند. این
مقدار عنوان و فوتر صفحهٔ ورود، نام روی سایدبار و عنوان تب مرورگر را تعیین می‌کند. تغییر آن نیاز
به بیلد مجدد دارد — هیچ کلید تغییر در زمان اجرا وجود ندارد.

یک چیز دیگر که امروز قابل تنظیم *نیست*: عنوان پنجرهٔ NUI پلاگین ادمین داخل بازی
(`plugins/atc-admin/ui/index.html`) به‌صورت ثابت روی `ATC Admin Panel` کدنویسی شده است. اگر لازم
دارید آن هم تغییر نام بدهد، آن فایل را در استقرار خودتان ویرایش کنید.

---

### 3. انتشار روی FiveM

#### 3.1 — گرفتن کلید لایسنس

سرورهای FiveM به یک کلید لایسنس صادرشده توسط Cfx.re نیاز دارند، از
**https://keymaster.fivem.net**. برای سرورتان یک کلید بسازید و در `server.cfg` قرار دهید:

```cfg
sv_licenseKey "YOUR_FIVEM_LICENSE_KEY"
```

کلیدی که یک پلتفرم صادر کرده روی پلتفرم دیگر معتبر نیست. کلید keymaster.fivem.net فقط روی FiveM
کار می‌کند.

#### 3.2 — گرفتن آرتیفکت‌های سرور

باینری سرور گیم **FXServer** است که Cfx.re آن را به‌صورت بیلدهای مخصوص هر سیستم‌عامل
(«آرتیفکت») منتشر می‌کند. بیلد recommended فعلی برای سیستم‌عامل خودتان را از سرور آرتیفکت‌های
Cfx.re دانلود کنید — همان که در مستندات رسمی میزبانی سرور FiveM لینک شده است. از بیلدِ یک میرور
تصادفی استفاده نکنید و از بیلد پلتفرم دیگری هم استفاده نکنید.

ساختار روی دیسک همه‌جا یکسان است:

```bash
# Linux
./run.sh +exec server.cfg

# Windows
FXServer.exe +exec server.cfg
```

#### 3.3 — ساختن server.cfg

از `infra/server.cfg.example` شروع کنید که نسخهٔ FiveM است و همین حالا هم تمام convarهای ATC،
ترتیب درست استارت و خط ACE ادمین را دارد:

```bash
cp infra/server.cfg.example server.cfg
```

سپس **خطوط شبکه را از `server.cfg` استانداردی که همراه آرتیفکت شما آمده در آن ادغام کنید**.
فایل `infra/server.cfg.example` یک لایهٔ روی‌هم‌گذاشتهٔ ATC است — عمداً بویلرپلیت پلتفرم را
همراه ندارد. به‌طور خاص به خطوط endpoint و یک رمز RCON نیاز دارید:

```cfg
endpoint_add_tcp "0.0.0.0:30120"
endpoint_add_udp "0.0.0.0:30120"

rcon_password "a-long-random-value"
```

بخش‌های مخصوص ATC که باید پر کنید:

```cfg
set atc_api_url      "http://<api-host>:3000"
set atc_api_token    "<same value as ATC_API_TOKEN in infra/.env>"
set atc_server_token "<same value as ATC_SERVER_TOKEN in infra/.env>"
set atc_server_id    "atc-main-01"
set atc_locale       "en"
set atc_fail_open    "false"
```

و اعطای دسترسی ادمین. ATC هر رکورد بازیکن را با شناسهٔ `license` کلید می‌زند، بنابراین دادن
دسترسی ادمین بر اساس license مسیری است که همیشه جواب می‌دهد — شناسهٔ خودتان را هنگام اتصال در
کنسول سرور پیدا کنید:

```cfg
add_ace identifier.license:XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX atc.admin allow
```

ریسورس‌ها با نام پوشه استارت می‌شوند، اول از همه هسته:

```cfg
start atc-core
start atc-sdk
start atc-identity
# ... the rest of your plugins
```

دو تلهٔ رایج که `infra/server.cfg.example` هم دربارهٔ آن‌ها هشدار داده و اینجا تکرار می‌شوند،
چون شب‌های زیادی را از آدم‌ها گرفته‌اند:

- **`plugins/atc-plugin-healthcheck` یک ریسورس گیم نیست.** فایل `fxmanifest.lua` ندارد — یک
  پلاگین سمت سرور Node برای ATC API است. اضافه کردن خط `start` برای آن خطای
  "resource not found" می‌دهد.
- **نام پوشه‌های bridge با نام منیفست‌شان یکی نیست.** جدول عیب‌یابی در بخش 6 را ببینید.

#### 3.4 — فوروارد کردن پورت

سرور گیم به‌صورت پیش‌فرض روی **30120 گوش می‌دهد، هم TCP و هم UDP**. هر دو را فوروارد کنید:

| پورت | پروتکل | چرا |
|---|---|---|
| 30120 | TCP | اندپوینت HTTP، اطلاعات سرور، دانلود فایل ریسورس‌ها |
| 30120 | UDP | ترافیک واقعی بازی — بدون آن بازیکن‌ها وصل می‌شوند و بعد تایم‌اوت می‌خورند |

فوروارد کردن TCP بدون UDP همان فایروال نیمه‌کارهٔ کلاسیک است: سرور در لیست ظاهر می‌شود، نام و
تعداد بازیکن درست را نشان می‌دهد، و هیچ‌کس عملاً نمی‌تواند وارد شود.

پورت ATC API (یعنی 3000) و پورت دیتابیس را به اینترنت عمومی فوروارد **نکنید**.

#### 3.5 — قرار گرفتن در لیست سرورها

به‌محض ثبت شدن کلید لایسنس، لیست شدن خودکار انجام می‌شود. هیچ فرم ثبت‌نامی وجود ندارد.

- به **`sv_master1` دست نزنید**. بازنویسی آن سرور را خصوصی علامت می‌زند و دیگر لیست نمی‌شود.
- یک `sv_hostname` واقعی ست کنید. سروری که هنوز `default FXServer` نام دارد عملاً نامرئی است.
- اگر سرور شما پشت NAT، پروکسی یا لود بالانسر است و با آدرس اشتباه لیست می‌شود، از بازنویسی‌های
  استاندارد استفاده کنید:

```cfg
set sv_listingIpOverride   "your.public.ip"
set sv_listingHostOverride "play.yourserver.example"
set sv_forceIndirectListing "true"
```

#### 3.6 — خطاهای رایج روی FiveM

| نشانه | علت |
|---|---|
| سرور استارت نمی‌شود و از لایسنس ایراد می‌گیرد | `sv_licenseKey` وجود ندارد، اشتباه تایپ شده، یا برای پلتفرم دیگری صادر شده |
| سرور اجرا می‌شود ولی هیچ‌وقت در لیست ظاهر نمی‌شود | `sv_master1` بازنویسی شده، یا کلید لایسنس هرگز ثبت نشده |
| در لیست هست ولی بازیکن‌ها هنگام اتصال تایم‌اوت می‌خورند | UDP 30120 فوروارد نشده |
| با IP اشتباه ظاهر می‌شود | پشت NAT است — بازنویسی‌های لیست شدن بالا را ست کنید |
| با نام `default FXServer` لیست شده | `sv_hostname` ست نشده، یا بعد از `exec` مهم ست شده |

---

### 4. انتشار روی VMP

#### 4.1 — VMP چیست و چرا ATC نیازی به پورت شدن ندارد

VMP (vmp.ir) یک **پلتفرم سازگار با CitizenFX** است — یک فورک صریح از سرور FiveM. قرارداد
ریسورس‌ها همان قراردادی است که FiveM استفاده می‌کند: `fxmanifest.lua`،
`fx_version 'cerulean'`، `game 'gta5'`، شناسایی ریسورس‌ها با نام پوشه، همان دستورهای
`start` / `ensure` / `restart`، همان convarهای `sv_*`، و همان nativeها، exportها و eventها.

**بنابراین ATC بدون هیچ تغییری روی VMP اجرا می‌شود.** هیچ ریسورسی در این ریپازیتوری نیاز به پورت
شدن ندارد، هیچ منیفستی نیاز به ویرایش ندارد و هیچ کد Lua‌یی لازم نیست تغییر کند. هر چیزی که فرق
می‌کند مربوط به زیرساخت استقرار است و همه‌اش در `server.cfg` شما جای می‌گیرد.

#### 4.2 — این اطلاعات دربارهٔ VMP از کجا می‌آید

سایت‌های خود VMP — وب‌سایت، انجمن کامیونیتی و لیست سرورها — به هر چیزی که یک مرورگر معمولی نباشد
HTTP 403 برمی‌گردانند و عملاً از بیرون ایران قابل دسترسی نیستند. به همین دلیل هر چیزی که این سند
دربارهٔ VMP می‌گوید از خواندن **سورس منتشرشدهٔ سرور VMP** (`github.com/v-mp/vmp`) می‌آید، که
مرجع معتبر رفتار واقعی سرور است. هر ادعای زیر با نام فایل و شمارهٔ خط مستند شده تا خودتان
بتوانید راستی‌آزمایی کنید.

اندپوینت‌هایی که در سرور VMP به‌صورت ثابت در کد نوشته شده‌اند:

| چه چیزی | مقدار | منبع |
|---|---|---|
| پایهٔ لایسنس | `https://api.vmp.ir/` | `citizen-server-impl/include/ServerLicensingComponent.h:36` |
| ثبت کلید | `POST https://api.vmp.ir/server/register.php?work=register` | `citizen-server-impl/src/ServerAuth.cpp:44` |
| هارت‌بیت لیست سرورها | `https://api.vmp.ir/server/heartbeat.php?work=heartbeat` — مقدار پیش‌فرض داخلی `sv_master1` | `citizen-server-impl/src/GameServer.cpp:54,120` |
| به‌روزرسانی کلاینت | `https://cdn.vmp.ir/updates` | `client/launcher/Bootstrap.cpp:100` |
| میرورهای کش بازی | `https://cdn.vmp.ir/mirrors/patches_fivem/3570/…` (بیلد بازی **3570**) | `client/launcher/GameCache.cpp:1402ff` |

دو چیز را **نمی‌توان** از روی سورس پاسخ داد، چون فقط روی وب‌سایت VMP وجود دارند: اینکه چطور کلید
لایسنس بگیرید، و اینکه آرتیفکت‌های سرور از کجا دانلود می‌شوند. هر دو در ادامه به‌جای حدس زدن،
به‌عنوان مورد باز علامت‌گذاری شده‌اند.

یک یافتهٔ منفیِ مفید: ثبت‌نام «nucleus» مربوط به Cfx.re در سورس **کامنت شده است**
(`citizen-server-impl/src/ServerNucleus.cpp:60-100`)؛ بنابراین یک سرور VMP خودش را روی `cfx.re`
ثبت نمی‌کند و با زیرساخت FiveM ارتباط نمی‌گیرد.

#### 4.3 — از کانفیگ VMP شروع کنید

```bash
cp infra/server.cfg.vmp.example server.cfg
```

بلوک convarهای ATC در آن فایل **دقیقاً یکسان** با نسخهٔ FiveM است — همان نام‌ها، همان
پیش‌فرض‌ها، همان بلوک برندینگ. فقط یادداشت‌های مربوط به لایسنس، پلتفرم و لیست سرورها فرق دارند.

پلتفرم را ثابت کنید تا لاگ‌ها و تله‌متری نام درست را بیاورند:

```cfg
set atc_platform "vmp"
```

هر چیزی که در بخش 2 آمد بدون تغییر اینجا هم صدق می‌کند: `sv_hostname` به‌علاوهٔ convarهای
`atc_brand_*`، دقیقاً به همان روش ست می‌شوند.

#### 4.4 — کلید لایسنس

کلید لایسنس VMP **اجباری** است — این یک واقعیت راستی‌آزمایی‌شده است، نه یک فرض. سرور هنگام
راه‌اندازی یک بررسی لایسنس اجرا می‌کند و در هر مسیر شکست `FatalError` صدا می‌زند که سرور را متوقف
می‌کند (`ServerAuth.cpp:30-80`).

کلید در برابر سرویس لایسنس **خودِ** VMP روی `https://api.vmp.ir/` اعتبارسنجی می‌شود، **نه** در
برابر keymaster.fivem.net. یک کلید FiveM هرگز روی VMP احراز نمی‌شود و برعکس.

```cfg
sv_licenseKey "YOUR_VMP_LICENSE_KEY"
```

**هنگام راه‌اندازی چه اتفاقی می‌افتد.** سرور مقدار `{"license":"<کلید شما>"}` را با POST به
`https://api.vmp.ir/server/register.php?work=register` می‌فرستد. در صورت موفقیت این خطوط را چاپ
می‌کند:

```
Server Auth: Checking license...
Server Auth: Server license key authentication succeeded!
Server Auth: Session Id : <id>
```

… و مقادیر `sv_sessionId` و `sv_secret` را از خودِ پاسخ می‌نویسد، سپس بلافاصله یک هارت‌بیت به
لیست سرورها می‌فرستد.

**سه پیام خطا**، تا بتوانید آن‌ها را از هم تشخیص دهید:

| پیام کنسول | معنی |
|---|---|
| `Please set sv_licenseKey in server.cfg!` | این convar خالی است یا وجود ندارد |
| `A connection with the VMP server could not be established!` | دسترسی به `api.vmp.ir` ممکن نبود — شبکه، DNS یا فایروال |
| *(پیامی از API خود VMP، عیناً)* | خودِ کلید رد شد — منقضی، باطل‌شده یا متعلق به سرور دیگری |

**IPv4 الزامی است.** درخواست لایسنس با `opts.ipv4 = true` انجام می‌شود (`ServerAuth.cpp:43`) و
هارت‌بیت لیست هم همین‌طور (`GameServer.cpp:1001`). هاستی که فقط با IPv6 به اینترنت وصل است نه
می‌تواند لایسنس بگیرد و نه لیست شود، و با همان خطای اتصال بالا شکست می‌خورد.

مقادیر `sv_sessionId` یا `sv_secret` را دستی ست **نکنید**. هند‌شیک هر دو را می‌نویسد و هارت‌بیت
تا وقتی یکی از آن‌ها خالی باشد صریحاً از ارسال خودداری می‌کند (`GameServer.cpp:971-973`) — ست
کردن دستی آن‌ها یک سرور بدون لایسنس را در لیست ظاهر نمی‌کند.

> **مورد باز:** روال صدور کلید فقط روی وب‌سایت و انجمن کامیونیتی VMP منتشر می‌شود که از بیرون
> ایران قابل خواندن نیست. روال جاری را مستقیماً از خود VMP بگیرید. آنچه از روی سورس قطعی است،
> همان اندپوینتی است که کلید در برابر آن بررسی خواهد شد.

#### 4.5 — آرتیفکت‌ها و کلاینت بازیکن

- **آرتیفکت‌های سرور** از VMP می‌آیند، نه از سرور آرتیفکت‌های FiveM؛ و یک آرتیفکت FiveM کلید
  لایسنس VMP را نمی‌پذیرد، چون در برابر keymaster.fivem.net بررسی می‌کند. این‌ها **به‌صورت
  GitHub release منتشر نمی‌شوند** (ریپازیتوری عمومی VMP هیچ ریلیزی ندارد) و سورس هیچ آدرس دانلودی
  برای آرتیفکت سرور ندارد، بنابراین نمی‌توانیم اینجا آدرسی نام ببریم. ساختار روی دیسک همان ساختار
  FXServer است، چون خود سرور *همان* FXServer است: روی ویندوز
  `FXServer.exe +exec server.cfg` و روی لینوکس `./run.sh +exec server.cfg`.
  **مورد باز — بیلد جاری و محل دانلود آن را مستقیماً از VMP بگیرید.**
- **بازیکن‌ها از لانچر VMP استفاده می‌کنند**، نه کلاینت FiveM. لانچر خودش را از
  `https://cdn.vmp.ir/updates` به‌روزرسانی می‌کند (`client/launcher/Bootstrap.cpp:100`) و کش بازی
  GTA V را از `https://cdn.vmp.ir/mirrors/patches_fivem/3570/…` می‌گیرد (`GameCache.cpp:1402ff`) —
  یعنی VMP در حال حاضر **بیلد ۳۵۷۰ بازی** را هدف گرفته است. اتصال از طریق همان لانچر انجام
  می‌شود، از لیست سرورهای VMP یا فیلد اتصال مستقیم آن.

#### 4.6 — لیست سرورها

لیست شدن از هارت‌بیت استاندارد FXServer استفاده می‌کند. مقدار `sv_master1` از پیش روی
`https://api.vmp.ir/server/heartbeat.php?work=heartbeat` تنظیم شده است، پس شما آن را پیکربندی
**نمی‌کنید** (`GameServer.cpp:54,120`). هارت‌بیت هر **۳ دقیقه** تکرار می‌شود
(`GameServer.cpp:1074`) و هر بار تعداد بازیکنان، اطلاعات سرور و پورت شما را به همان اندپوینت
می‌فرستد.

**آنچه شما را لیست می‌کند یک لایسنس معتبر است.** هارت‌بیت مقادیر `sv_sessionId` و `sv_secret` را
بررسی می‌کند و اگر یکی از آن‌ها خالی باشد بلافاصله برمی‌گردد (`GameServer.cpp:971-973`). این دو
فقط با یک هند‌شیک موفق لایسنس نوشته می‌شوند — بنابراین یک سرور بدون لایسنس هرگز ظاهر نمی‌شود، هر
قدر هم بقیهٔ کانفیگ درست باشد. لیست یک فرانت‌اند وب عمومی روی **list.vmp.ir** دارد؛ آن یک وب‌سایت
است، نه چیزی که سرور شما با آن حرف بزند.

**به `sv_master1` دست نزنید.** ارزش دارد که مکانیزم را بفهمید، چون خطا بی‌صدا است: هارت‌بیت یک
فلگ `private` حمل می‌کند که با `true` شروع می‌شود و فقط وقتی `false` می‌شود که یکی از
`sv_master1` تا `sv_master3` *دقیقاً* همان آدرس پیش‌فرض VMP باشد (`GameServer.cpp:1039-1070`).
اگر `sv_master1` را به جای دیگری اشاره دهید، هارت‌بیت باز هم فرستاده می‌شود — سرور شما فقط
به‌عنوان خصوصی علامت می‌خورد و هرگز به‌صورت عمومی دیده نمی‌شود. هرگز آن را به یک مستر FiveM
اشاره ندهید؛ آن مستر چیزی دربارهٔ سرور شما نمی‌داند.

- یک `sv_hostname` واقعی ست کنید — مقدار پیش‌فرض داخلی آن عیناً `default FXServer` است
  (`GameServer.cpp:119`).
- پشت NAT یا پروکسی، همان سه بازنویسی با همان نام‌ها و همان معانی FiveM اعمال می‌شوند:
  `sv_listingIpOverride`، `sv_listingHostOverride`، `sv_forceIndirectListing`. هر سه مستقیماً در
  محتوای هارت‌بیت خوانده می‌شوند (`GameServer.cpp:985-998`).
- اگر کوئری لیست خطا برگرداند، سرور آن را عیناً به‌صورت
  `^1Server list query returned an error: …` چاپ می‌کند — پیش از حدس زدن، همان خط را بخوانید.

اگر با یک کلید معتبر، هارت‌بیتِ در حال اجرا و هاست‌نیم درست باز هم سرورتان ظاهر نشد، در انجمن
کامیونیتی VMP بپرسید — همان‌جا است که اپراتورها مشکلات لیست شدن را مطرح می‌کنند.

#### 4.7 — دو نکتهٔ سازگاری

- **دارایی‌های escrow: هیچ فرضی نکنید.** دارایی‌های رمزنگاری‌شدهٔ «escrow» متعلق به Cfx.re در
  برابر سرویس خودِ Cfx.re رمزگشایی می‌شوند، پس عاقلانه نیست که روی کار کردنشان روی یک پلتفرم
  غیر Cfx.re حساب کنید — اما ما تأیید نکردیم که VMP واقعاً با آن‌ها چه می‌کند. برنامه‌تان را روی
  ریسورس‌های متن‌باز یا رمزنگاری‌نشده در کنار ATC بگذارید، و پیش از تکیه کردن به هر چیز escrow
  آن را تست کنید. خودِ ATC هیچ دارایی escrow ارائه نمی‌دهد، بنابراین این موضوع هرگز ریسورس‌های
  خودِ ATC را تحت تأثیر قرار نمی‌دهد.
- **ریسورس‌های شخص ثالث.** هر ریسورس ATC فقط از nativeها، exportها و eventهای استاندارد
  CitizenFX استفاده می‌کند که VMP آن‌ها را بدون تغییر فراهم می‌کند. اگر یک ریسورس *شخص ثالث* روی
  VMP بدرفتاری کرد، این موضوع بین شما و آن ریسورس است — در انجمن کامیونیتی VMP بپرسید، جایی که
  اپراتورها دربارهٔ اینکه کدام اسکریپت‌ها به تنظیم نیاز دارند گفتگو می‌کنند.

---

### 5. چک‌لیست تأیید

این‌ها را به ترتیب انجام دهید. هرکدام یک لایهٔ متفاوت را جدا می‌کند، پس اولین شکست به شما
می‌گوید مشکل کجاست.

**بک‌اند**

- [ ] دستور `curl -i http://<api-host>:3000/health` کد **200** با `"status":"ok"` برمی‌گرداند و
      هر دوی `db` و `redis` مقدار `ok` گزارش می‌کنند.
- [ ] همان `curl` **از روی هاست سرور گیم** هم موفق است، نه فقط از روی سیستم خودتان.

**راه‌اندازی**

- [ ] کنسول سرور گیم بنر ATC را نشان می‌دهد:
      `Server: <your brand name>  |  Platform: <FiveM|VMP|...>`.
      اگر نام هنوز `Atlantic Core` است، `atc_brand_name` خوانده نمی‌شود — دنبال غلط تایپی بگردید
      یا خط `set` که بعد از استارت ریسورس‌ها قرار گرفته است.
- [ ] پلتفرم روی همان خط با واقعیت می‌خواند. اگر نه، `atc_platform` را ثابت کنید.
- [ ] **هیچ** خط `^3[ATC:WARN]` وجود ندارد. هر کدام از آن‌ها دقیقاً نام convarی که باید درست شود
      را می‌آورد.
- [ ] هر خط `start` پیدا شده است. هیچ خطای "resource not found" نیست و هیچ ریسورس استارت‌شده‌ای
      نیست که پوشه‌اش را تغییر نام داده باشید.

**قابل اتصال به‌صورت محلی**

- [ ] می‌توانید از همان ماشین وصل شوید — `localhost:30120` در کادر اتصال مستقیمِ همان کلاینتی که
      پلتفرم شما استفاده می‌کند (کلاینت FiveM، یا لانچر VMP روی VMP).
- [ ] صفحهٔ کاراکتر کلمات لوگوی **شما** را با رنگ اکسنت **شما** نشان می‌دهد.
- [ ] متن خوش‌آمدگویی آموزش نام سرور **شما** را می‌آورد.
- [ ] یک کیک یا بن آزمایشی از طریق atc-core تگ **شما** را نشان می‌دهد، برای مثال `[NOVA] ...`،
      نه `[ATC] ...`.
- [ ] دستورهای ادمین شما کار می‌کنند (`/atcban`، `/atckick`، `/atcbring`). اگر پیام
      "no permission" آمد، خط `add_ace` با شناسهٔ واقعی شما مطابقت ندارد.

**قابل اتصال به‌صورت عمومی**

- [ ] یک اتصال از **بیرون شبکهٔ شما** موفق است — با یک گوشی روی دیتای موبایل تست کنید، نه از
      داخل LAN. این همان مرحله‌ای است که نبودن فوروارد UDP را می‌گیرد.
- [ ] سرور در لیست سرورهای پلتفرم با `sv_hostname` شما، با تعداد بازیکن درست و آدرس عمومی درست
      ظاهر می‌شود.
- [ ] مقدار `sv_hostname` و `atc_brand_name` یک چیز را می‌گویند.

---

### 6. عیب‌یابی

| نشانه | یعنی چه | راه‌حل |
|---|---|---|
| کنسول: `^3[ATC:WARN] atc_server_token is not set. Set it in server.cfg.^7` | مقدار `atc_server_token` خالی است | آن را در `server.cfg` روی همان مقدار `ATC_SERVER_TOKEN` در `infra/.env` ست کنید |
| کنسول: `^3[ATC:WARN] atc_api_token is not set. API calls will fail. Set it in server.cfg.^7` | مقدار `atc_api_token` خالی است — **هیچ‌چیزی که با API سروکار دارد کار نمی‌کند** | آن را روی همان مقدار `ATC_API_TOKEN` در `infra/.env` ست کنید (حداقل 32 کاراکتر) |
| کنسول: `^3[ATC:WARN] atc_brand_color is not a valid hex colour (expected #rrggbb). Falling back to #d4af37.^7` | مقدار رنگ یک سه‌تایی hex نیست | از `#rrggbb` استفاده کنید، برای مثال `#3ea6ff`. شکل کوتاه `#abc` پذیرفته و بسط داده می‌شود؛ نام‌هایی مثل `blue` پذیرفته نمی‌شوند |
| بازیکن‌ها روی کارت اتصال با پیام "server configuration error" رد می‌شوند | مقدار `atc_api_token` خالی است و `atc_fail_open` روی `false` است | مقدار `atc_api_token` را ست کنید. این همان هشدار قبلی است، یک قدم دیرتر |
| بازیکن‌ها با پیام "could not verify your account" رد می‌شوند | فراخوانی API حساب کاربری شکست خورده: API پایین است، `atc_api_url` اشتباه است، توکن اشتباه است، یا فایروال جلویش را گرفته | دستور `curl http://<api-host>:3000/health` را **از روی سرور گیم** بزنید؛ `atc_api_url` را بررسی کنید؛ مطابقت توکن با `infra/.env` را چک کنید |
| هر بار API سکسکه می‌کند همه بلاک می‌شوند | طبق طراحی است — `atc_fail_open` به‌صورت پیش‌فرض `false` است و وقتی API در دسترس نباشد اتصال‌ها را بلاک می‌کند | API را درست کنید. `set atc_fail_open "true"` در زمان قطعی بازیکن‌ها را راه می‌دهد، اما آن‌ها بدون حساب تأییدشده و بدون بررسی بن وارد می‌شوند — آن را یک اقدام موقت بدانید، نه تنظیمی که همیشه روشن بماند |
| کارت اتصال یک بازیکن را به‌خاطر نبودن شناسهٔ license رد می‌کند | ATC هر بازیکن را با شناسهٔ `license` کلید می‌زند و بدون آن نمی‌تواند ادامه دهد | این معمولاً یک مشکل سمت کلاینت است. توجه کنید که `add_ace identifier.license:...` هم دلیل دیگری است که اعطای دسترسی ادمین باید با `license` باشد، نه `steam` |
| کنسول: ریسورس `atc-plugin-healthcheck` پیدا نشد | فایل `fxmanifest.lua` ندارد — یک پلاگین سمت سرور Node برای ATC API است، نه یک ریسورس گیم | خط `start` را حذف کنید. این ریسورس عمداً در هیچ‌کدام از دو فایل نمونهٔ cfg نیامده است |
| bridge استارت نمی‌شود: `start atc-bridge-esx` / `start atc-bridge-qb` شکست می‌خورد | نام **پوشه‌ها** در این ریپو `bridges/esx` و `bridges/qb-core` است، اما منیفست‌هایشان می‌گویند `name 'atc-bridge-esx'` / `name 'atc-bridge-qb'`. ریسورس‌ها با نام پوشه استارت می‌شوند؛ فیلد `name` در منیفست چیزی را تغییر نام نمی‌دهد | هنگام کپی کردن، هر پوشه را تغییر نام دهید — `bridges/esx` → `atc-bridge-esx`، `bridges/qb-core` → `atc-bridge-qb` — تا پوشه، منیفست و خط `start` با هم بخوانند. اگر قبلاً بدون تغییر نام کپی کرده‌اید، به‌جایش از `start esx` / `start qb-core` استفاده کنید |
| سرور QBCore بعد از اضافه کردن bridge مربوط به QB خراب می‌شود | شما `bridges/qb-core` را بدون تغییر نام در سروری کپی کرده‌اید که از قبل یک ریسورس `qb-core` دارد — bridge با همان فریم‌ورکی که قرار بوده با آن حرف بزند تداخل پیدا کرده | نام پوشه را به `atc-bridge-qb` تغییر دهید. دو ریسورس با نام `qb-core` را همزمان اجرا نکنید |
| رابط کاربری یک ریسورس بعد از تغییر نام پوشه‌اش خالی است / کال‌بک‌های NUI کار نمی‌کنند | صفحه‌های NUI در ATC خودشان را با آدرس `https://<folder-name>/` صدا می‌زنند. تغییر نام یک پوشهٔ اصلی این را خراب می‌کند | نام اصلی پوشه را برگردانید. فقط همان دو پوشهٔ bridge برای تغییر نام امن هستند — آن‌ها NUI ندارند |
| تغییرات برندینگ در بازی ظاهر نمی‌شوند | convarهای برندینگ هنگام استارت `atc-core` خوانده می‌شوند | سرور را ری‌استارت کنید، یا `restart atc-core`. همچنین بررسی کنید که خطوط `set` **قبل از** خطوط `start` باشند |
| مرورگر سرورها یک نام نشان می‌دهد و رابط داخل بازی نامی دیگر | `sv_hostname` و `atc_brand_name` مستقل از هم هستند | هر دو را روی یک مقدار ست کنید |
| نام داخل بازی هنوز `Atlantic Core` است | `atc_brand_name` ست نشده، غلط نوشته شده، با `set` به‌جای `setr` تعریف شده (پس هرگز به کلاینت نمی‌رسد)، یا روی رشتهٔ خالی ست شده (خالی همیشه به پیش‌فرض برمی‌گردد) | از `setr atc_brand_name "نام شما"` با مقدار غیرخالی استفاده کنید |
| پنل ادمین وب بعد از ست کردن `atc_brand_name` هنوز `Atlantic Core` را نشان می‌دهد | نام پنل یک convar نیست — همان `VITE_BRAND_NAME` در زمان بیلد است (بخش 2.5 را ببینید) | پنل را دوباره بیلد کنید: `VITE_BRAND_NAME="Nova RP" pnpm --filter @atc/web build` |
| مقادیر `atc_brand_community` / `_website` / `_discord` ست شده‌اند اما چیزی نمایش داده نمی‌شود | انتظار همین است — این‌ها به NUI تحویل داده می‌شوند اما atc-core هیچ المانی برای آن‌ها رسم نمی‌کند | چیزی برای درست کردن نیست. آن‌ها را از یک پلاگین یا یک رابط کاربری سفارشی مصرف کنید |
| یک نام برند بلند یا غیرلاتین کوتاه شده | مقادیر تا حدهای مستندشده کوتاه می‌شوند (64 کاراکتر برای نام، 16 برای تگ و کلمات لوگو)، آن هم روی مرز کاراکترها تا UTF-8 معتبر بماند | از یک نام کوتاه‌تر استفاده کنید |
| بنر راه‌اندازی نام پلتفرم اشتباه را می‌آورد | تشخیص خودکار نتوانست این بیلد را از نسخهٔ بالادستی تشخیص دهد | آن را ثابت کنید: `set atc_platform "vmp"` (یا `fivem` / `redm`). هرگز `atc_platform_resolved` را خودتان ست نکنید |
| سرور اجرا می‌شود اما در هیچ لیستی ظاهر نمی‌شود | کلید لایسنس معتبر وجود ندارد، یا `sv_master1` بازنویسی شده | بررسی کنید کلید لایسنس هنگام راه‌اندازی ثبت شده باشد؛ هر خط `sv_master1` را حذف کنید |
| درست لیست شده، اما بازیکن‌ها وصل می‌شوند و بعد تایم‌اوت می‌خورند | UDP 30120 فوروارد نشده است | **هر دوی** TCP و UDP را روی 30120 فوروارد کنید |
| با IP یا هاست‌نیم اشتباه لیست شده | پشت NAT، پروکسی یا لود بالانسر است | مقادیر `sv_listingIpOverride` / `sv_listingHostOverride` / `sv_forceIndirectListing` را ست کنید |
| سرور VMP هنگام راه‌اندازی با خطای لایسنس خارج می‌شود | `sv_licenseKey` قابل استفاده‌ای وجود ندارد — روی FXServer که VMP از آن فورک شده، کلید نبود یا ردشده جلوی راه‌اندازی را می‌گیرد | یک کلید صادرشده توسط VMP ست کنید. کلید keymaster.fivem.net هرگز اینجا کار نمی‌کند |
| یک ریسورس شخص ثالث (غیر ATC) روی VMP بدرفتاری می‌کند | مشکل از ATC نیست — ATC فقط از nativeهای استاندارد CitizenFX استفاده می‌کند | دربارهٔ آن ریسورس در انجمن کامیونیتی VMP بپرسید. اگر یک دارایی escrow متعلق به Cfx.re است، فرض نکنید escrow خارج از Cfx.re کار می‌کند — پیش از تکیه کردن به آن تستش کنید |
| مسیر `/health` کد 503 با `"status":"degraded"` برمی‌گرداند | MariaDB یا Redis از سمت API در دسترس نیست | آبجکت `components` در پاسخ را بخوانید — نام همان یکی را می‌آورد. `docker compose ps` و رمزهای داخل `infra/.env` را بررسی کنید |


---


## Türkçe (Turkish)

Bu bölüm sizi "ATC benim makinemde çalışıyor" noktasından "oyuncular sunucumu bulup
topluluğumun adı altında katılabiliyor" noktasına taşır. Hem **FiveM** hem de **VMP** kapsanır —
aynı ATC kaynakları her ikisinde de değiştirilmeden çalışır.

İlk seferinde baştan sona okuyun. Aşağıdaki her komut ve her convar bu depoda gerçekten
mevcuttur; burada hiçbir şey temenni düzeyinde değildir.

---

### 1. Ön koşullar

Bunların hepsi sağlanmadan yayına alma adımlarına başlamayın. "Sunucum canlıda bozuldu"
şeklindeki neredeyse her bildirimin kökeninde bunlardan birinin atlanmış olması vardır.

**1.1 — Arka uç ayakta ve sağlıklı.**

ATC'nin oyun kaynakları, ATC API'sinin üzerindeki ince bir katmandır. API'nin MariaDB ve
Redis'e ihtiyacı vardır.

```bash
cp infra/.env.example infra/.env      # then edit it — see below
docker compose -f infra/docker-compose.yml up -d
```

`infra/.env` dosyası yer tutucuları değil, gerçek değerleri içermelidir:

```dotenv
DB_ROOT_PASSWORD=<a real password>
DB_PASSWORD=<a real password>
REDIS_PASSWORD=<a real password>
ATC_API_TOKEN=<at least 32 characters>
ATC_SERVER_TOKEN=<a real secret>
ATC_SERVER_ID=atc-main-01
PORT=3000
```

**1.2 — Veritabanı şeması yüklendi.** Ya migration çalıştırıcısını kullanın
(`pnpm db:migrate`) ya da `database/atc.sql` dosyasını yeni bir `atc` veritabanına içe aktarın.
Beş dilde adım adım Windows talimatları `database/README.md` içindedir.

**1.3 — Monorepo derlendi.**

```bash
pnpm install
pnpm build
pnpm test
```

**1.4 — API sağlık uç noktasında yanıt veriyor.** Bunu yalnızca dizüstünüzden değil,
**oyun sunucusunu çalıştıracak makineden** çalıştırın:

```bash
curl -i http://<api-host>:3000/health
```

Sağlıklı bir API, HTTP 200 ve şunu döndürür:

```json
{"status":"ok","components":{"db":"ok","redis":"ok"},"timestamp":"..."}
```

Eğer `"status":"degraded"` ile birlikte **503** dönüyorsa, `db` veya `redis` bileşenlerinden
biri çalışmıyordur — devam etmeden önce bunu düzeltin. API ayrıca çalışma süresi izleyicileri
için `/api/v1/ops/live` ve `/api/v1/ops/ready` uç noktalarını sunar. Bu üçü bearer token
kimlik doğrulamasından muaftır; diğer tüm rotalar değildir.

**1.5 — ATC kaynakları, klasör adları bozulmadan yerinde.** `game/atc-core`, `game/atc-sdk`
ve `plugins/` altından istediğiniz eklentileri sunucunuzun `resources` dizinine kopyalayın.

> Bir CitizenFX sunucusu bir kaynağı **klasör adıyla** tanımlar. `fxmanifest.lua` içindeki
> `name` alanı üst veridir ve hiçbir şeyi yeniden adlandırmaz. ATC'nin NUI sayfaları kendilerini
> `https://<folder-name>/` olarak adresler; bu nedenle dağıtılan bir klasörü yeniden
> adlandırmak, o kaynağın kullanıcı arayüzünü sessizce bozar. Klasör adlarını geldiği gibi
> bırakın.

**1.6 — API oyun sunucusundan erişilebilir.** `atc_api_url` varsayılan olarak
`http://localhost:3000` değerindedir; bu yalnızca API ile oyun sunucusu aynı makinede
çalıştığında doğrudur. Farklı makinelerdeyseler gerçek adresi ayarlayın ve güvenlik duvarınızın
buna izin verdiğinden emin olun. 3000 numaralı port oyun sunucunuza ve yönetici panelinize
erişebilmelidir — ancak halka açık internete **açık olmamalıdır**.

---

### 2. Sunucunuza ad verme

ATC, birbirine karıştırılması kolay iki şeyi ayırır:

- **Çatı (framework) kimliği** — *Atlantic Core*, *ATC*, *Naiemi Group*. Bu bir atıftır.
  `fxmanifest.lua` içinde, `LICENSE` içinde, dokümanlarda ve sunucu başlangıç günlüğünde kalır.
  Bir ayar değildir ve lisans bu adları saklı tutar.
- **Sunucu markası** — *oyuncularınızın* gördüğü şey: karakter ekranındaki logo, bağlanma ve
  yasaklama mesajlarındaki etiket, eğitim (tutorial) karşılama metni. Yönetici panelinin başlığı
  da sizin değiştirebileceğiniz bir şeydir, ancak bu bir convar değil, derleme zamanına ait bir
  ayardır — bkz. 2.5. Bu bölüm, bunların hepsini nasıl yapılandıracağınızı anlatır.

Yani: çatı **Naiemi Group tarafından geliştirilen Atlantic Core** olarak kalır ve oyuncuların
katıldığı sunucu, üzerinde sizin adınız yazan **sizin** sunucunuzdur.

#### 2.1 — Marka convar'ları

Bunların tümü `game/atc-core/shared/branding.lua` tarafından okunur. **Her biri isteğe
bağlıdır.** Birini ayarlamadan bırakırsanız ATC gösterilen varsayılanı kullanır — bu, bu
convar'lar var olmadan önce çatının dağıttığı dizgenin tam olarak aynısıdır; dolayısıyla hiçbir
şey ayarlamayan mevcut bir kurulum eskisiyle birebir aynı şekilde davranır.

| Convar | Varsayılan | Azami | Neyi değiştirir |
|---|---|---|---|
| `atc_brand_name` | `Atlantic Core` | 64 karakter | Sunucu/topluluk adı: eğitim metni, karakter ekranları, NUI pencere başlığı |
| `atc_brand_short` | `ATC` | 16 karakter | atc-core'un bağlanma, atma ve yasaklama mesajlarındaki köşeli parantezli etiket — `[ATC]`, `[ATC Security]` |
| `atc_brand_logo_primary` | `ATLANTIC` | 16 karakter | NUI logosunun ilk kelimesi, vurgu renginde çizilir |
| `atc_brand_logo_secondary` | `CORE` | 16 karakter | NUI logosunun ikinci kelimesi, ince yazı ağırlığıyla çizilir |
| `atc_brand_community` | *(boş)* | 64 karakter | Topluluk satırı. Temizlenip NUI'ye iletilir, ancak atc-core bunun için hiçbir öğe çizmez |
| `atc_brand_website` | *(boş)* | 256 karakter | Web sitesi URL'si. NUI'ye iletilir, atc-core tarafından çizilmez |
| `atc_brand_discord` | *(boş)* | 256 karakter | Discord daveti. NUI'ye iletilir, atc-core tarafından çizilmez |
| `atc_brand_color` | `#d4af37` | — | NUI vurgu rengi, `#rrggbb` (`#abc` kısa gösterimi genişletilir) |

Sonradan zaman kazandıracak notlar:

- Değerler **temizlenir**: kontrol karakterleri ve açılı parantezler kaldırılır, boşluklar
  sadeleştirilir ve fazla uzun değerler bir UTF-8 karakteri bölünmeden kırpılır — böylece
  Farsça ve Almanca adlar güvendedir.
- Boş bir değer her zaman varsayılana geri döner. `atc_brand_name` değerini `""` yaparak
  boşaltamazsınız.
- `atc_brand_community`, `atc_brand_website` ve `atc_brand_discord` okunur, temizlenir ve
  markalama yükünün geri kalanıyla birlikte NUI'ye gönderilir, ancak **atc-core'un kendi arayüzü
  bugün bunların hiçbiri için bir öğe çizmez**. Bunlar, eklentilerin ve özel arayüzlerin
  tüketmesi içindir — bunları ayarlamak, hazır gelen NUI'de görebileceğiniz hiçbir şeyi
  değiştirmez.
- Geçersiz bir `atc_brand_color` yok sayılır, varsayılan korunur ve sunucu başlangıçta ilgili
  convar'ı adıyla belirten bir `^3[ATC:WARN]` satırı yazdırır.
- Marka bilgileri `atc-core` başlarken okunur. Bir convar'ı değiştirdikten sonra etkili olması
  için sunucuyu yeniden başlatın (veya `restart atc-core` çalıştırın).
- `set` değil `setr` kullanın. Markalama, sunucunun yanı sıra istemci tarafı betikler —
  öğretici ve NUI — tarafından da okunur ve düz bir `set` convar'ı sunucudan hiç çıkmaz.
  `set` ile yarım bir yeniden adlandırma elde edersiniz: başlangıç günlüğü ve atma mesajları
  adınızı gösterirken karakter ekranı ve öğretici dağıtılan varsayılanlarda kalır. *Diğer* tüm
  ATC convar'ları `set` olarak kalır: onlar yalnızca sunucu tarafıdır ve `atc_api_token` /
  `atc_server_token` asla replike edilmemelidir.

#### 2.2 — `sv_hostname` ayrı bir şeydir

`sv_hostname`, **sunucu tarayıcısındaki** kaydınızdır. `atc_brand_name` ise aynı adın
**oyunun içinde** görüntülenen halidir. İkisi iki farklı yerde ayarlanır ve hiçbiri diğerinden
türetilmez. Birini ayarlayıp diğerini unutmak, yeniden markalanmış bir sunucunun yarı yarıya
adlandırılmış kalmasının en yaygın nedenidir. İkisini de, aynı ada ayarlayın.

#### 2.3 — `atc_platform`

```
set atc_platform "auto"     # auto | fivem | vmp | redm
```

`auto`, platformu çalışma zamanında algılar ve neredeyse herkes için doğrudur. ATC'nin
başlangıçta günlüğe yazdığı platform sizin sunucunuz için yanlışsa bir değere sabitleyin. ATC
buna göre **asla oynanışı dallandırmaz** — yalnızca günlüklerin, telemetrinin ve operasyon
kayıtlarının platformu nasıl adlandıracağını belirler; dolayısıyla yanlış bir değer bir
raporlama hatasıdır, oynanış hatası değil.

`atc_platform_resolved` değerini **ayarlamayın**. Sunucu onu algılama sonucundan kendisi yazar
ve istemcilere çoğaltır.

#### 2.4 — Kopyalayıp yapıştırılabilir: bir sunucuyu baştan sona yeniden adlandırma

Örnek değerleri değiştirerek bunu `server.cfg` dosyanıza bırakın. Oyun içi yeniden adlandırmanın
tamamı budur — dokunulacak bir kaynak dosya yoktur. Web yönetici paneli ayrıca, derleme
zamanında yeniden adlandırılır; bkz. 2.5.

```cfg
# ── Server identity ───────────────────────────────────────────────────────────
sv_hostname "Nova City RP — [NOVA]"
sv_maxclients 64
sets tags "roleplay,mmo,nova"

# ── Platform ──────────────────────────────────────────────────────────────────
set atc_platform "auto"

# ── Server branding ───────────────────────────────────────────────────────────
setr atc_brand_name           "Nova City RP"
setr atc_brand_short          "NOVA"
setr atc_brand_logo_primary   "NOVA"
setr atc_brand_logo_secondary "CITY"
setr atc_brand_community      "Nova Community"
setr atc_brand_website        "https://novacityrp.example"
setr atc_brand_discord        "https://discord.gg/your-invite"
setr atc_brand_color          "#3ea6ff"
```

Bu ayarlarla oyuncular eğitimde `Nova City RP`, karakter ekranında `NOVA CITY`, atc-core
kaynaklı bir yasaklamada `[NOVA] You are banned from this server.` ve sunucu tarayıcısında
`Nova City RP` görür. Çatının kendi atfı — `Atlantic Core`, `Naiemi Group` — ait olduğu yerde,
manifestolarda, lisansta ve başlangıç günlüğünde kalır.

#### 2.5 — Web yönetici panelini yeniden adlandırma

`apps/web` altındaki yönetici paneli ayrı bir React uygulamasıdır ve görünen ürün adı bir convar
**değildir** — önceden derlenen bir tarayıcı uygulaması oyun sunucusunun convar'larını okuyamaz.
Bu ad, panel derlenirken içine gömülen `VITE_BRAND_NAME` Vite ortam değişkeninden gelir:

```bash
VITE_BRAND_NAME="Nova RP" pnpm --filter @atc/web build
```

`VITE_BRAND_NAME=Nova RP` satırını `apps/web/package.json` yanındaki bir `.env` dosyasına da
koyabilirsiniz. Ayarlanmadığında `Atlantic Core` olarak çözümlenir; dolayısıyla mevcut bir
derleme değişmeden kalır. Bu değer, giriş ekranının başlığını ve alt bilgisini, kenar çubuğundaki
adı ve tarayıcı sekmesi başlığını belirler. Değiştirmek yeniden derleme gerektirir — çalışma
zamanında bir anahtarı yoktur.

Bugün yapılandırılabilir *olmayan* bir şey daha: oyun içi yönetici eklentisinin NUI pencere
başlığı (`plugins/atc-admin/ui/index.html`) sabit olarak `ATC Admin Panel` yazılıdır. Bunun
yeniden adlandırılması gerekiyorsa kendi kurulumunuzda o dosyayı düzenleyin.

---

### 3. FiveM üzerinde yayına alma

#### 3.1 — Lisans anahtarı edinme

FiveM sunucuları, Cfx.re tarafından **https://keymaster.fivem.net** adresinden verilen bir
lisans anahtarı gerektirir. Sunucunuz için bir anahtar oluşturun ve `server.cfg` içine koyun:

```cfg
sv_licenseKey "YOUR_FIVEM_LICENSE_KEY"
```

Bir platform tarafından verilen anahtar başka bir platformda geçerli değildir. Bir
keymaster.fivem.net anahtarı yalnızca FiveM'de çalışır.

#### 3.2 — Sunucu artifact'lerini edinme

Oyun sunucusu ikili dosyası **FXServer**'dır; Cfx.re tarafından işletim sistemine göre
derlemeler ("artifact"ler) hâlinde yayımlanır. İşletim sisteminiz için güncel önerilen derlemeyi,
resmî FiveM sunucu barındırma belgelerinde bağlantısı verilen Cfx.re artifact sunucusundan
indirin — rastgele bir aynadan derleme kullanmayın ve başka bir platformun derlemesini
kullanmayın.

Diskteki yapı her yerde aynıdır:

```bash
# Linux
./run.sh +exec server.cfg

# Windows
FXServer.exe +exec server.cfg
```

#### 3.3 — server.cfg dosyanızı oluşturma

FiveM varyantı olan ve halihazırda her ATC convar'ını, doğru başlatma sırasını ve yönetici ACE
satırını içeren `infra/server.cfg.example` dosyasından başlayın:

```bash
cp infra/server.cfg.example server.cfg
```

Ardından **artifact'inizle birlikte gelen standart `server.cfg` dosyasındaki ağ satırlarını
birleştirin**. `infra/server.cfg.example` bir ATC katmanıdır — platform şablon kodunu bilinçli
olarak taşımaz. Özellikle uç nokta satırlarına ve bir RCON parolasına ihtiyacınız var:

```cfg
endpoint_add_tcp "0.0.0.0:30120"
endpoint_add_udp "0.0.0.0:30120"

rcon_password "a-long-random-value"
```

Doldurmanız gereken ATC'ye özgü kısımlar:

```cfg
set atc_api_url      "http://<api-host>:3000"
set atc_api_token    "<same value as ATC_API_TOKEN in infra/.env>"
set atc_server_token "<same value as ATC_SERVER_TOKEN in infra/.env>"
set atc_server_id    "atc-main-01"
set atc_locale       "en"
set atc_fail_open    "false"
```

Ve yönetici yetkisi. ATC her oyuncu kaydını `license` tanımlayıcısı üzerinden anahtarlar; bu
yüzden yöneticiliği license ile vermek her zaman işe yarayan yoldur — kendi tanımlayıcınızı
bağlandığınızda sunucu konsolunda bulun:

```cfg
add_ace identifier.license:XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX atc.admin allow
```

Kaynaklar klasör adıyla, önce çekirdek olacak şekilde başlatılır:

```cfg
start atc-core
start atc-sdk
start atc-identity
# ... the rest of your plugins
```

`infra/server.cfg.example` dosyasının halihazırda uyardığı iki tuzak; insanlara akşamlarına mal
oldukları için burada tekrarlanıyor:

- **`plugins/atc-plugin-healthcheck` bir oyun kaynağı değildir.** `fxmanifest.lua` dosyası
  yoktur — ATC API'si için sunucu tarafında çalışan bir Node eklentisidir. Onun için bir `start`
  satırı eklemek "resource not found" hatası üretir.
- **Köprü klasörleri manifestolarına göre adlandırılmamıştır.** 6. bölümdeki sorun giderme
  tablosuna bakın.

#### 3.4 — Port yönlendirme

Oyun sunucusu **varsayılan olarak 30120 portunu, hem TCP hem UDP üzerinde** dinler. İkisini de
yönlendirin:

| Port | Protokol | Neden |
|---|---|---|
| 30120 | TCP | HTTP uç noktası, sunucu bilgisi, kaynak dosyası indirmeleri |
| 30120 | UDP | Asıl oyun trafiği — bu olmadan oyuncular bağlanır ve sonra zaman aşımına uğrar |

TCP'yi yönlendirip UDP'yi yönlendirmemek, klasik yarım yapılandırılmış güvenlik duvarıdır:
sunucu listede görünür, doğru adı ve oyuncu sayısını gösterir ve kimse gerçekten katılamaz.

ATC API portunu (3000) veya veritabanı portunu halka açık internete **yönlendirmeyin**.

#### 3.5 — Sunucu listesine girme

Lisans anahtarı kaydolduğunda listeleme otomatiktir. Başvuru formu yoktur.

- **`sv_master1` ayarına dokunmayın.** Onu geçersiz kılmak sunucuyu özel olarak işaretler ve
  sunucu listelenmeyi bırakır.
- Gerçek bir `sv_hostname` ayarlayın. Hâlâ `default FXServer` adını taşıyan bir sunucu fiilen
  görünmezdir.
- Sunucunuz NAT, bir vekil sunucu veya bir yük dengeleyici arkasındaysa ve yanlış adresle
  listeleniyorsa standart geçersiz kılmaları kullanın:

```cfg
set sv_listingIpOverride   "your.public.ip"
set sv_listingHostOverride "play.yourserver.example"
set sv_forceIndirectListing "true"
```

#### 3.6 — FiveM'de sık görülen hata biçimleri

| Belirti | Sebep |
|---|---|
| Sunucu başlamayı reddediyor, lisanstan şikâyet ediyor | `sv_licenseKey` eksik, yanlış yazılmış veya başka bir platform için verilmiş |
| Sunucu çalışıyor, listede hiç görünmüyor | `sv_master1` geçersiz kılınmış veya lisans anahtarı hiç kaydolmamış |
| Listede görünüyor, oyuncular katılırken zaman aşımına uğruyor | UDP 30120 yönlendirilmemiş |
| Yanlış IP ile görünüyor | NAT arkasında — yukarıdaki listeleme geçersiz kılmalarını ayarlayın |
| `default FXServer` olarak listeleniyor | `sv_hostname` ayarlanmamış veya önemli olan `exec` sonrasında ayarlanmış |

---

### 4. VMP üzerinde yayına alma

#### 4.1 — VMP nedir ve ATC neden port edilmeye ihtiyaç duymaz

VMP (vmp.ir) **CitizenFX uyumlu bir platformdur** — FiveM sunucusunun açıkça belirtilmiş bir
çatallamasıdır (fork). Kaynak sözleşmesi FiveM'in kullandığının aynısıdır: `fxmanifest.lua`,
`fx_version 'cerulean'`, `game 'gta5'`, klasör adıyla tanımlanan kaynaklar, aynı
`start` / `ensure` / `restart` komutları, aynı `sv_*` convar'ları ve aynı native'ler, export'lar
ve event'ler.

**Bu nedenle ATC, VMP üzerinde değiştirilmeden çalışır.** Bu depodaki hiçbir kaynağın port
edilmesi, hiçbir manifestonun düzenlenmesi ve hiçbir Lua kodunun değiştirilmesi gerekmez.
Farklı olan her şey dağıtım tesisatıdır ve tamamı sizin `server.cfg` dosyanızda yer alır.

#### 4.2 — Bu VMP bilgileri nereden geliyor

VMP'nin kendi siteleri — web sitesi, topluluk forumu ve sunucu listesi — sıradan bir tarayıcı
olmayan her şeye HTTP 403 döndürür ve İran dışından fiilen erişilebilir değildir. Bu nedenle bu
belgenin VMP hakkında söylediği her şey, **VMP'nin yayımlanmış sunucu kaynak kodunun**
(`github.com/v-mp/vmp`) okunmasından gelir; sunucunun gerçekte nasıl davrandığı konusunda asıl
kaynak budur. Aşağıdaki her iddia, kendiniz doğrulayabilesiniz diye dosya ve satır olarak
kaynağıyla verilmiştir.

VMP sunucusunun kodunda sabit olarak bulunan uç noktalar:

| Ne | Değer | Kaynak |
|---|---|---|
| Lisanslama tabanı | `https://api.vmp.ir/` | `citizen-server-impl/include/ServerLicensingComponent.h:36` |
| Anahtar kaydı | `POST https://api.vmp.ir/server/register.php?work=register` | `citizen-server-impl/src/ServerAuth.cpp:44` |
| Sunucu listesi heartbeat'i | `https://api.vmp.ir/server/heartbeat.php?work=heartbeat` — `sv_master1` değişkeninin yerleşik varsayılanı | `citizen-server-impl/src/GameServer.cpp:54,120` |
| İstemci güncellemeleri | `https://cdn.vmp.ir/updates` | `client/launcher/Bootstrap.cpp:100` |
| Oyun önbelleği aynaları | `https://cdn.vmp.ir/mirrors/patches_fivem/3570/…` (oyun derlemesi **3570**) | `client/launcher/GameCache.cpp:1402ff` |

Kaynak koddan **yanıtlanamayan** iki şey vardır, çünkü bunlar yalnızca VMP'nin web sitesinde
bulunur: lisans anahtarını nasıl edineceğiniz ve sunucu artifact'lerinin nereden indirileceği.
Her ikisi de aşağıda tahmin edilmek yerine açık uç olarak işaretlenmiştir.

Yararlı bir olumsuz bulgu: Cfx.re "nucleus" kaydı kaynak kodda **yorum satırına alınmıştır**
(`citizen-server-impl/src/ServerNucleus.cpp:60-100`); dolayısıyla bir VMP sunucusu `cfx.re`
adresine kaydolmaz ve FiveM altyapısıyla iletişim kurmaz.

#### 4.3 — VMP yapılandırmasından başlayın

```bash
cp infra/server.cfg.vmp.example server.cfg
```

O dosyadaki ATC convar bloğu FiveM varyantıyla **birebir aynıdır** — aynı adlar, aynı
varsayılanlar, aynı marka bloğu. Yalnızca lisans, platform ve sunucu listesi notları farklıdır.

Günlükleriniz ve telemetriniz doğru platformu adlandırsın diye platformu sabitleyin:

```cfg
set atc_platform "vmp"
```

2. bölümdeki her şey aynen geçerlidir: `sv_hostname` ile birlikte `atc_brand_*` convar'ları,
tamamen aynı şekilde ayarlanır.

#### 4.4 — Lisans anahtarı

Bir VMP lisans anahtarı **zorunludur** — bu varsayım değil, doğrulanmış bir bilgidir. Başlangıçta
VMP bir lisans denetimi çalıştırır ve her hata yolunda `FatalError` çağırır; bu da sunucuyu
durdurur (`ServerAuth.cpp:30-80`).

Anahtar, keymaster.fivem.net'e **değil**, VMP'nin `https://api.vmp.ir/` adresindeki **kendi**
lisanslama servisine karşı doğrulanır. Bir FiveM anahtarı VMP'de asla kimlik doğrulamasından
geçmez; tersi de geçerlidir.

```cfg
sv_licenseKey "YOUR_VMP_LICENSE_KEY"
```

**Başlangıçta ne olur.** Sunucu, `https://api.vmp.ir/server/register.php?work=register` adresine
POST ile `{"license":"<anahtarınız>"}` gönderir. Başarılı olursa şunu yazdırır:

```
Server Auth: Checking license...
Server Auth: Server license key authentication succeeded!
Server Auth: Session Id : <id>
```

… ve `sv_sessionId` ile `sv_secret` değerlerini doğrudan yanıttan yazar, ardından hemen bir sunucu
listesi heartbeat'i tetikler.

**Üç hata mesajı**, birbirinden ayırt edebilmeniz için:

| Konsol mesajı | Anlamı |
|---|---|
| `Please set sv_licenseKey in server.cfg!` | Convar boş veya eksik |
| `A connection with the VMP server could not be established!` | `api.vmp.ir` erişilemezdi — ağ, DNS veya güvenlik duvarı |
| *(VMP'nin API'sinden gelen mesaj, birebir)* | Anahtarın kendisi reddedildi — süresi dolmuş, iptal edilmiş veya başka bir sunucuya bağlı |

**IPv4 gereklidir.** Lisans isteği `opts.ipv4 = true` ile yapılır (`ServerAuth.cpp:43`); liste
heartbeat'i de öyle (`GameServer.cpp:1001`). İnternete yalnızca IPv6 ile bağlı bir ana bilgisayar
ne lisans alabilir ne de listelenebilir; yukarıdaki bağlantı hatasıyla başarısız olur.

`sv_sessionId` veya `sv_secret` değerlerini elle **ayarlamayın**. El sıkışma ikisini de yazar ve
heartbeat, bunlardan herhangi biri boşken göndermeyi açıkça reddeder (`GameServer.cpp:971-973`) —
bunları elle ayarlamak lisanssız bir sunucuyu listede görünür yapmaz.

> **Açık uç:** Bir anahtarın nasıl verildiği yalnızca VMP'nin web sitesinde ve topluluk forumunda
> yayımlanır; bunları İran dışından okuyamıyoruz. Güncel prosedürü doğrudan VMP'den edinin. Kaynak
> koddan kesin olan şey, anahtarın hangi uç noktaya karşı denetleneceğidir.

#### 4.5 — Artifact'ler ve oyuncu istemcisi

- **Sunucu artifact'leri** VMP'den gelir, FiveM'in artifact sunucusundan değil; ayrıca bir FiveM
  artifact'i VMP lisans anahtarını kabul etmez — o, keymaster.fivem.net'e karşı denetleme yapardı.
  Bunlar **GitHub sürümü (release) olarak yayımlanmaz** (VMP'nin herkese açık deposunda hiç sürüm
  yoktur) ve kaynak kod bir sunucu artifact'i indirme URL'si içermez; bu yüzden burada bir adres
  veremeyiz. Diskteki yapı FXServer'ınkiyle aynıdır, çünkü sunucu zaten FXServer'ın *kendisidir*:
  Windows'ta `FXServer.exe +exec server.cfg`, Linux'ta `./run.sh +exec server.cfg`.
  **Açık uç — güncel derlemeyi ve indirme konumunu doğrudan VMP'den edinin.**
- **Oyuncular VMP başlatıcısını kullanır**, FiveM istemcisini değil. Başlatıcı kendini
  `https://cdn.vmp.ir/updates` üzerinden günceller (`client/launcher/Bootstrap.cpp:100`) ve GTA V
  oyun önbelleğini `https://cdn.vmp.ir/mirrors/patches_fivem/3570/…` adresinden çeker
  (`GameCache.cpp:1402ff`) — yani VMP şu anda **3570 oyun derlemesini** hedefliyor. Katılma işlemi
  başlatıcı üzerinden, VMP'nin sunucu listesinden veya başlatıcının doğrudan bağlantı alanından
  yapılır.

#### 4.6 — Sunucu listesi

Listeleme standart FXServer heartbeat'ini kullanır. `sv_master1` zaten varsayılan olarak
`https://api.vmp.ir/server/heartbeat.php?work=heartbeat` adresine işaret eder, dolayısıyla onu
**yapılandırmazsınız** (`GameServer.cpp:54,120`). Heartbeat her **3 dakikada** bir tekrarlanır
(`GameServer.cpp:1074`) ve her seferinde oyuncu sayınızı, sunucu bilgilerinizi ve portunuzu bu uç
noktaya gönderir.

**Sizi listeye sokan şey geçerli bir lisanstır.** Heartbeat, `sv_sessionId` ve `sv_secret`
değerlerini denetler ve bunlardan herhangi biri boşsa hemen geri döner (`GameServer.cpp:971-973`).
Bu değerleri yalnızca başarılı bir lisans el sıkışması yazar — yani lisanssız bir sunucu,
yapılandırmanın geri kalanı ne kadar doğru olursa olsun asla görünmez. Listenin **list.vmp.ir**
adresinde herkese açık bir web ön yüzü vardır; bu bir web sitesidir, sunucunuzun konuştuğu bir şey
değil.

**`sv_master1` ayarına dokunmayın.** Mekanizmayı anlamakta fayda var, çünkü hata sessizdir:
heartbeat, `true` olarak başlayan bir `private` bayrağı taşır ve bu bayrak yalnızca
`sv_master1`…`sv_master3` değerlerinden biri *tam olarak* VMP'nin varsayılan URL'si olduğunda
`false` yapılır (`GameServer.cpp:1039-1070`). `sv_master1` değerini başka bir yere yönlendirirseniz
heartbeat yine gönderilir — sunucunuz sadece özel olarak işaretli kalır ve herkese açık olarak hiç
görünmez. Onu asla bir FiveM master'ına yönlendirmeyin; o master sizin sunucunuzdan haberdar
değildir.

- Gerçek bir `sv_hostname` ayarlayın — yerleşik varsayılanı harfi harfine `default FXServer`'dır
  (`GameServer.cpp:119`).
- NAT veya vekil sunucu arkasında, aynı üç geçersiz kılma, FiveM'dekiyle aynı adlar ve anlamlarla
  geçerlidir: `sv_listingIpOverride`, `sv_listingHostOverride`, `sv_forceIndirectListing`. Üçü de
  doğrudan heartbeat yüküne okunur (`GameServer.cpp:985-998`).
- Liste sorgusu bir hata döndürürse sunucu bunu birebir `^1Server list query returned an error: …`
  olarak yazdırır — tahmin yürütmeden önce o satırı okuyun.

Geçerli bir anahtar, çalışan bir heartbeat ve doğru bir ana bilgisayar adına rağmen sunucunuz
hâlâ görünmüyorsa VMP'nin topluluk forumunda sorun — operatörler listeleme sorunlarını orada dile
getirir.

#### 4.7 — İki uyumluluk notu

- **Escrow'lu varlıklar: hiçbir şeyi peşinen varsaymayın.** Şifreli Cfx.re "escrow" varlıkları
  Cfx.re'nin kendi servisine karşı çözülür; dolayısıyla bunların Cfx.re dışı bir platformda
  çalışacağına bel bağlamak akıllıca olmaz — ancak VMP'nin bunlarla gerçekte ne yaptığını
  doğrulamadık. ATC'nin yanında açık kaynaklı veya şifrelenmemiş kaynaklar kullanmayı planlayın
  ve escrow'lu hiçbir şeye güvenmeden önce test edin. ATC'nin kendisi hiçbir escrow'lu varlık
  dağıtmaz; bu yüzden bu durum ATC'nin kendi kaynaklarını hiçbir zaman etkilemez.
- **Üçüncü taraf kaynaklar.** Her ATC kaynağı yalnızca standart CitizenFX native'lerini,
  export'larını ve event'lerini kullanır; VMP bunları değiştirmeden sağlar. *Üçüncü taraf* bir
  kaynak VMP'de hatalı davranırsa bu, sizinle o kaynak arasındadır — operatörlerin hangi
  betiklerin ayarlanması gerektiğini tartıştığı VMP topluluk forumunda sorun.

---

### 5. Doğrulama kontrol listesi

Bunları sırasıyla uygulayın. Her biri farklı bir katmanı yalıtır; böylece ilk başarısızlık size
sorunun nerede olduğunu söyler.

**Arka uç**

- [ ] `curl -i http://<api-host>:3000/health` çağrısı `"status":"ok"` ile **200** döndürüyor ve
      hem `db` hem `redis` `ok` bildiriyor.
- [ ] Aynı `curl` yalnızca iş istasyonunuzdan değil, **oyun sunucusu makinesinden** de başarılı
      oluyor.

**Başlangıç**

- [ ] Oyun sunucusu konsolu ATC afişini gösteriyor:
      `Server: <your brand name>  |  Platform: <FiveM|VMP|...>`.
      Ad hâlâ `Atlantic Core` ise `atc_brand_name` okunmuyordur — bir yazım hatası veya
      kaynaklar başladıktan sonra yerleştirilmiş bir `set` satırı olup olmadığına bakın.
- [ ] O satırdaki platform gerçekle örtüşüyor. Örtüşmüyorsa `atc_platform` değerini sabitleyin.
- [ ] Hiç `^3[ATC:WARN]` satırı **yok**. Bunların her biri düzeltilecek convar'ı tam olarak
      adıyla belirtir.
- [ ] Her `start` satırı çözümlendi. "resource not found" hatası yok ve klasörünü yeniden
      adlandırdığınız hiçbir kaynak başlatılmıyor.

**Yerel olarak katılınabilir**

- [ ] Aynı makineden bağlanabiliyorsunuz — platformunuzun kullandığı istemcinin (FiveM
      istemcisi ya da VMP'de VMP başlatıcısı) doğrudan bağlantı kutusunda `localhost:30120`.
- [ ] Karakter ekranı **sizin** logo kelimelerinizi, **sizin** vurgu renginizde gösteriyor.
- [ ] Eğitim karşılama metni **sizin** sunucunuzu adlandırıyor.
- [ ] atc-core üzerinden yapılan bir test atma veya yasaklama işlemi `[ATC] ...` değil, **sizin**
      etiketinizi gösteriyor, örneğin `[NOVA] ...`.
- [ ] Yönetici komutlarınız çalışıyor (`/atcban`, `/atckick`, `/atcbring`). "no permission"
      diyorsa `add_ace` satırı gerçek tanımlayıcınızla eşleşmiyordur.

**Herkese açık şekilde katılınabilir**

- [ ] **Ağınızın dışından** bir bağlantı başarılı oluyor — LAN'dan değil, mobil veri kullanan bir
      telefondan test edin. Eksik bir UDP yönlendirmesini yakalayan adım budur.
- [ ] Sunucu, platformun sunucu listesinde `sv_hostname` değerinizle, doğru oyuncu sayısı ve
      doğru genel adresle görünüyor.
- [ ] `sv_hostname` ve `atc_brand_name` aynı şeyi söylüyor.

---

### 6. Sorun giderme

| Belirti | Ne anlama gelir | Çözüm |
|---|---|---|
| Konsol: `^3[ATC:WARN] atc_server_token is not set. Set it in server.cfg.^7` | `atc_server_token` boş | `server.cfg` içinde `infra/.env` dosyasındaki `ATC_SERVER_TOKEN` ile aynı değere ayarlayın |
| Konsol: `^3[ATC:WARN] atc_api_token is not set. API calls will fail. Set it in server.cfg.^7` | `atc_api_token` boş — **API'ye dokunan hiçbir şey çalışmaz** | `infra/.env` dosyasındaki `ATC_API_TOKEN` ile aynı değere ayarlayın (en az 32 karakter) |
| Konsol: `^3[ATC:WARN] atc_brand_color is not a valid hex colour (expected #rrggbb). Falling back to #d4af37.^7` | Renk değeri bir onaltılık üçlü değil | `#rrggbb` kullanın, örneğin `#3ea6ff`. `#abc` kısa gösterimi kabul edilir ve genişletilir; `blue` gibi adlar kabul edilmez |
| Oyuncular bağlantı kartında "server configuration error" mesajıyla reddediliyor | `atc_api_token` boş ve `atc_fail_open` `false` | `atc_api_token` değerini ayarlayın. Bu, bir önceki uyarının bir adım sonrasıdır |
| Oyuncular "could not verify your account" mesajıyla reddediliyor | Hesap API çağrısı başarısız oldu: API kapalı, yanlış `atc_api_url`, yanlış token veya güvenlik duvarı engeli | **Oyun sunucusundan** `curl http://<api-host>:3000/health` çalıştırın; `atc_api_url` değerini kontrol edin; token'ın `infra/.env` ile eşleştiğini kontrol edin |
| API her aksadığında herkes engelleniyor | Tasarım gereği çalışıyor — `atc_fail_open` varsayılan olarak `false`'tur ve API'ye erişilemediğinde katılımları engeller | API'yi düzeltin. `set atc_fail_open "true"` bir kesinti sırasında oyuncuların girmesine izin verir, ancak doğrulanmış bir hesap olmadan ve yasak denetimleri olmadan girerler — bunu açık bırakılacak bir ayar olarak değil, geçici bir önlem olarak görün |
| Bağlantı kartı, eksik license tanımlayıcısı nedeniyle bir oyuncuyu reddediyor | ATC her oyuncuyu `license` tanımlayıcısı üzerinden anahtarlar ve onsuz devam edemez | Bu normalde istemci tarafı bir sorundur. `add_ace identifier.license:...` biçiminin, yönetici yetkilerinin neden `steam` değil `license` kullanması gerektiğinin de sebebi olduğunu unutmayın |
| Konsol: `atc-plugin-healthcheck` kaynağı bulunamadı | `fxmanifest.lua` dosyası yoktur — bir oyun kaynağı değil, ATC API'si için sunucu tarafı bir Node eklentisidir | `start` satırını kaldırın. Dağıtılan her iki cfg örneğinde de bilinçli olarak yer almaz |
| Köprü başlamıyor: `start atc-bridge-esx` / `start atc-bridge-qb` başarısız oluyor | Bu depodaki **klasör** adları `bridges/esx` ve `bridges/qb-core`'dur, ancak manifestoları `name 'atc-bridge-esx'` / `name 'atc-bridge-qb'` der. Kaynaklar klasör adıyla başlatılır; manifestodaki `name` hiçbir şeyi yeniden adlandırmaz | Her klasörü kopyalarken yeniden adlandırın — `bridges/esx` → `atc-bridge-esx`, `bridges/qb-core` → `atc-bridge-qb` — böylece klasör, manifesto ve `start` satırı uyuşur. Onları zaten yeniden adlandırmadan kopyaladıysanız bunun yerine `start esx` / `start qb-core` kullanın |
| QB köprüsü eklendikten sonra QBCore sunucusu bozuluyor | `bridges/qb-core` klasörünü, zaten bir `qb-core` kaynağı olan bir sunucuya yeniden adlandırmadan kopyaladınız — köprü, konuşmak için var olduğu çatı ile çakışıyor | Klasörü `atc-bridge-qb` olarak yeniden adlandırın. `qb-core` adında iki kaynak çalıştırmayın |
| Bir kaynağın klasörünü yeniden adlandırdıktan sonra arayüzü boş / NUI geri çağrıları çalışmıyor | ATC'nin NUI sayfaları kendilerini `https://<folder-name>/` olarak adresler. Dağıtılan bir klasörü yeniden adlandırmak bunu bozar | Özgün klasör adını geri getirin. Yalnızca iki köprü klasörünü yeniden adlandırmak güvenlidir — onların NUI'si yoktur |
| Marka değişiklikleri oyunda görünmüyor | Marka convar'ları `atc-core` başlarken okunur | Sunucuyu yeniden başlatın veya `restart atc-core` çalıştırın. Ayrıca `set` satırlarının `start` satırlarından **önce** geldiğini kontrol edin |
| Sunucu tarayıcısı bir ad, oyun içi arayüz başka bir ad gösteriyor | `sv_hostname` ve `atc_brand_name` birbirinden bağımsızdır | İkisini de aynı değere ayarlayın |
| Oyun içi ad hâlâ `Atlantic Core` | `atc_brand_name` ayarlanmamış, yanlış yazılmış, `setr` yerine `set` ile tanımlanmış (bu yüzden istemciye hiç ulaşmıyor) veya boş bir dizgeye ayarlanmış (boş değer her zaman varsayılana döner) | Boş olmayan bir `atc_brand_name` ayarlayın |
| `atc_brand_name` ayarlandıktan sonra web yönetici paneli hâlâ `Atlantic Core` diyor | Panelin adı bir convar değildir — derleme zamanına ait `VITE_BRAND_NAME` değeridir (bkz. 2.5) | Paneli yeniden derleyin: `VITE_BRAND_NAME="Nova RP" pnpm --filter @atc/web build` |
| `atc_brand_community` / `_website` / `_discord` ayarlı ama hiçbir şey görünmüyor | Beklenen davranış — bunlar NUI'ye iletilir, ancak atc-core onlar için hiçbir öğe çizmez | Düzeltilecek bir şey yok. Bunları bir eklentiden veya özel bir arayüzden tüketin |
| Uzun veya Latin olmayan bir marka adı kısaltılıyor | Değerler belgelenen sınırlarına kırpılır (ad için 64 karakter, etiket ve logo kelimeleri için 16), UTF-8'in geçerli kalması için karakter sınırlarında | Daha kısa bir ad kullanın |
| Başlangıç afişi yanlış platformu adlandırıyor | Otomatik algılama bu derlemeyi üst kaynaktan (upstream) ayırt edemedi | Sabitleyin: `set atc_platform "vmp"` (veya `fivem` / `redm`). `atc_platform_resolved` değerini asla kendiniz ayarlamayın |
| Sunucu çalışıyor ama hiçbir listede görünmüyor | Geçerli bir lisans anahtarı yok veya `sv_master1` geçersiz kılınmış | Lisans anahtarının başlangıçta kaydolduğunu kontrol edin; varsa `sv_master1` satırını kaldırın |
| Doğru listeleniyor, oyuncular bağlanıyor sonra zaman aşımına uğruyor | UDP 30120 yönlendirilmemiş | 30120 üzerinde **hem** TCP hem UDP'yi yönlendirin |
| Yanlış IP veya ana bilgisayar adıyla listeleniyor | NAT, bir vekil sunucu veya bir yük dengeleyici arkasında | `sv_listingIpOverride` / `sv_listingHostOverride` / `sv_forceIndirectListing` ayarlayın |
| VMP sunucusu başlangıçta bir lisans hatasıyla çıkıyor | Kullanılabilir bir `sv_licenseKey` yok — VMP'nin çatallandığı FXServer'da eksik veya reddedilen bir anahtar başlatmayı durdurur | VMP tarafından verilmiş bir anahtar ayarlayın. Bir keymaster.fivem.net anahtarı burada asla çalışamaz |
| Üçüncü taraf (ATC olmayan) bir kaynak VMP'de hatalı davranıyor | ATC ile ilgili bir sorun değil — ATC yalnızca standart CitizenFX native'lerini kullanır | O kaynağı VMP topluluk forumunda sorun. Escrow'lu bir Cfx.re varlığıysa, escrow'un Cfx.re dışında çalıştığını varsaymayın — güvenmeden önce test edin |
| `/health` 503 `"status":"degraded"` döndürüyor | MariaDB veya Redis API'den erişilebilir değil | Yanıttaki `components` nesnesini okuyun — hangisi olduğunu adıyla belirtir. `docker compose ps` çıktısını ve `infra/.env` içindeki parolaları kontrol edin |


---


## Español (Spanish)

Esta sección te lleva de "ATC funciona en mi máquina" a "los jugadores pueden encontrar mi
servidor y unirse a él, con el nombre de mi comunidad". Cubre tanto **FiveM** como **VMP**: los
mismos recursos de ATC funcionan en cualquiera de los dos, sin modificaciones.

Léela de principio a fin la primera vez. Cada comando y cada convar que aparece abajo existe en
este repositorio; nada de lo que hay aquí es una aspiración.

---

### 1. Requisitos previos

No empieces con los pasos de publicación hasta que todo esto sea cierto. Casi todos los reportes
de "mi servidor está roto en producción" se remontan a que alguno de estos puntos se omitió.

**1.1 — El backend está levantado y en buen estado.**

Los recursos de juego de ATC son una capa delgada sobre la API de ATC. La API necesita MariaDB y Redis.

```bash
cp infra/.env.example infra/.env      # then edit it — see below
docker compose -f infra/docker-compose.yml up -d
```

`infra/.env` debe tener valores reales, no los marcadores de posición:

```dotenv
DB_ROOT_PASSWORD=<a real password>
DB_PASSWORD=<a real password>
REDIS_PASSWORD=<a real password>
ATC_API_TOKEN=<at least 32 characters>
ATC_SERVER_TOKEN=<a real secret>
ATC_SERVER_ID=atc-main-01
PORT=3000
```

**1.2 — El esquema de la base de datos está cargado.** Ejecuta el corredor de migraciones
(`pnpm db:migrate`) o importa `database/atc.sql` en una base de datos `atc` nueva. En
`database/README.md` hay instrucciones paso a paso para Windows en cinco idiomas.

**1.3 — El monorepo está compilado.**

```bash
pnpm install
pnpm build
pnpm test
```

**1.4 — La API responde en su endpoint de salud.** Ejecuta esto **desde la máquina que va a
ejecutar el servidor de juego**, no solo desde tu laptop:

```bash
curl -i http://<api-host>:3000/health
```

Una API sana devuelve HTTP 200 y:

```json
{"status":"ok","components":{"db":"ok","redis":"ok"},"timestamp":"..."}
```

Si devuelve **503** con `"status":"degraded"`, `db` o `redis` está caído: arregla eso antes de
seguir. La API también expone `/api/v1/ops/live` y `/api/v1/ops/ready` para monitores de
disponibilidad. Los tres están exentos de la autenticación por bearer token; ninguna otra ruta lo está.

**1.5 — Los recursos de ATC están en su lugar, con los nombres de carpeta intactos.** Copia
`game/atc-core`, `game/atc-sdk` y los plugins que quieras de `plugins/` dentro del directorio
`resources` de tu servidor.

> Un servidor CitizenFX identifica un recurso por su **nombre de carpeta**. El campo `name` dentro
> de `fxmanifest.lua` es metadato y no renombra nada. Las páginas NUI de ATC se direccionan a sí
> mismas como `https://<folder-name>/`, así que renombrar una carpeta tal como se distribuye rompe
> silenciosamente la interfaz de usuario de ese recurso. Deja los nombres de carpeta exactamente
> como vienen.

**1.6 — La API es alcanzable desde el servidor de juego.** `atc_api_url` tiene como valor
predeterminado `http://localhost:3000`, lo cual solo es correcto cuando la API y el servidor de
juego corren en el mismo host. Si están en máquinas distintas, configura la dirección real y
asegúrate de que tu firewall la permita. El puerto 3000 debe ser alcanzable por tu servidor de
juego y tu panel de administración, pero **no** debe estar abierto a la internet pública.

---

### 2. Nombrar tu servidor

ATC separa dos cosas que es fácil confundir:

- **Identidad del framework** — *Atlantic Core*, *ATC*, *Naiemi Group*. Esto es atribución.
  Permanece en `fxmanifest.lua`, en `LICENSE`, en la documentación y en el log de arranque del
  servidor. No es una configuración, y la licencia reserva esos nombres.
- **Branding del servidor** — lo que ven *tus jugadores*: el logo en la pantalla de personaje, la
  etiqueta en los mensajes de conexión y baneo, el texto de bienvenida del tutorial. El título del
  panel de administración también es tuyo para cambiarlo, pero es un ajuste de tiempo de compilación
  y no una convar; consulta 2.5. Esta sección explica cómo configurarlo todo.

Es decir: el framework sigue siendo **Atlantic Core by Naiemi Group**, y el servidor al que se unen
los jugadores es **tuyo**, con tu nombre.

#### 2.1 — Las convars de branding

Todas estas las lee `game/atc-core/shared/branding.lua`. **Todas son opcionales.** Si dejas alguna
sin definir, ATC usa el valor predeterminado que se muestra, que es exactamente la cadena que el
framework traía antes de que existieran estas convars, de modo que un despliegue existente que no
configure nada se comporta igual que antes.

| Convar | Predeterminado | Máx. | Qué cambia |
|---|---|---|---|
| `atc_brand_name` | `Atlantic Core` | 64 caracteres | Nombre del servidor/comunidad: texto del tutorial, pantallas de personaje, el título de la ventana NUI |
| `atc_brand_short` | `ATC` | 16 caracteres | La etiqueta entre corchetes en los mensajes de conexión, expulsión y baneo de atc-core — `[ATC]`, `[ATC Security]` |
| `atc_brand_logo_primary` | `ATLANTIC` | 16 caracteres | Primera palabra del logo NUI, dibujada en el color de acento |
| `atc_brand_logo_secondary` | `CORE` | 16 caracteres | Segunda palabra del logo NUI, dibujada en trazo ligero |
| `atc_brand_community` | *(vacío)* | 64 caracteres | Línea de comunidad. Se sanea y se entrega al NUI, pero atc-core no dibuja ningún elemento para ella |
| `atc_brand_website` | *(vacío)* | 256 caracteres | URL del sitio web. Se entrega al NUI, atc-core no la dibuja |
| `atc_brand_discord` | *(vacío)* | 256 caracteres | Invitación de Discord. Se entrega al NUI, atc-core no la dibuja |
| `atc_brand_color` | `#d4af37` | — | Color de acento del NUI, `#rrggbb` (la forma corta `#abc` se expande) |

Notas que ahorran tiempo más adelante:

- Los valores se **sanean**: se eliminan los caracteres de control y los signos de mayor/menor, los
  espacios en blanco se colapsan y los valores demasiado largos se truncan sin partir un carácter
  UTF-8, así que los nombres en persa y alemán son seguros.
- Un valor vacío siempre cae de vuelta al predeterminado. No puedes dejar `atc_brand_name` en blanco
  poniéndolo en `""`.
- `atc_brand_community`, `atc_brand_website` y `atc_brand_discord` se leen, se sanean y se envían al
  NUI junto con el resto de la carga útil de branding, pero **hoy la interfaz propia de atc-core no
  renderiza ningún elemento para ninguna de ellas**. Están ahí para que las consuman los plugins y
  las interfaces personalizadas: configurarlas no cambia nada que puedas ver en el NUI de fábrica.
- Un `atc_brand_color` inválido se ignora, se conserva el predeterminado y el servidor imprime una
  línea `^3[ATC:WARN]` al arrancar nombrando la convar.
- El branding se lee cuando `atc-core` inicia. Cambia una convar y luego reinicia el servidor (o
  `restart atc-core`) para que surta efecto.
- Usa `setr`, no `set`. El branding lo leen tanto el servidor como los scripts del lado del
  cliente —el tutorial y la NUI—, y una convar `set` normal nunca sale del servidor. Con `set`
  obtienes un renombrado a medias: el log de arranque y los mensajes de expulsión muestran tu
  nombre mientras que la pantalla de personaje y el tutorial conservan los valores por defecto.
  Todas las *demás* convars de ATC siguen siendo `set`: son solo de servidor, y `atc_api_token` /
  `atc_server_token` nunca deben replicarse.

#### 2.2 — `sv_hostname` es otra cosa

`sv_hostname` es tu entrada en el **navegador de servidores**. `atc_brand_name` es ese mismo nombre
renderizado **dentro del juego**. Se configuran en dos lugares distintos y ninguno se deriva del
otro. Configurar uno y olvidar el otro es la forma más común de que un servidor rebrandeado quede a
medio renombrar. Configura ambos, con el mismo nombre.

#### 2.3 — `atc_platform`

```
set atc_platform "auto"     # auto | fivem | vmp | redm
```

`auto` detecta la plataforma en tiempo de ejecución y es lo correcto para casi todo el mundo. Fija
un valor si la plataforma que ATC registra al arrancar es incorrecta para tu host. ATC **nunca
bifurca la jugabilidad** en función de esto: solo decide cómo llaman a la plataforma los logs, la
telemetría y los registros de operaciones, así que un valor equivocado es un error de reporte, no de
jugabilidad.

**No** configures `atc_platform_resolved`. El servidor escribe esa por sí mismo a partir del
resultado de la detección y la replica a los clientes.

#### 2.4 — Listo para copiar y pegar: renombrar un servidor de principio a fin

Pega esto en tu `server.cfg`, reemplazando los valores de ejemplo. Este es el renombrado completo
dentro del juego: ningún archivo fuente que tocar. El panel web de administración se renombra por
separado, en tiempo de compilación; consulta 2.5.

```cfg
# ── Server identity ───────────────────────────────────────────────────────────
sv_hostname "Nova City RP — [NOVA]"
sv_maxclients 64
sets tags "roleplay,mmo,nova"

# ── Platform ──────────────────────────────────────────────────────────────────
set atc_platform "auto"

# ── Server branding ───────────────────────────────────────────────────────────
setr atc_brand_name           "Nova City RP"
setr atc_brand_short          "NOVA"
setr atc_brand_logo_primary   "NOVA"
setr atc_brand_logo_secondary "CITY"
setr atc_brand_community      "Nova Community"
setr atc_brand_website        "https://novacityrp.example"
setr atc_brand_discord        "https://discord.gg/your-invite"
setr atc_brand_color          "#3ea6ff"
```

Con eso en su lugar, los jugadores ven `Nova City RP` en el tutorial, `NOVA CITY` en la pantalla de
personaje, `[NOVA] You are banned from this server.` en un baneo emitido por atc-core, y
`Nova City RP` en el navegador de servidores. La atribución propia del framework — `Atlantic Core`,
`Naiemi Group` — permanece en los manifiestos, la licencia y el log de arranque, que es donde
corresponde.

#### 2.5 — Renombrar el panel web de administración

El panel de administración bajo `apps/web` es una aplicación React aparte, y su nombre de producto
visible **no** es una convar: las convars del servidor de juego no son legibles por una aplicación de
navegador que se compila con antelación. Proviene de la variable de entorno de Vite
`VITE_BRAND_NAME`, que se incrusta cuando el panel se compila:

```bash
VITE_BRAND_NAME="Nova RP" pnpm --filter @atc/web build
```

También puedes poner `VITE_BRAND_NAME=Nova RP` en un archivo `.env` junto a `apps/web/package.json`.
Si no se define, se resuelve a `Atlantic Core`, así que una compilación existente no cambia. El valor
alimenta el encabezado y el pie de la pantalla de inicio de sesión, el nombre en la barra lateral y el
título de la pestaña del navegador. Cambiarlo requiere recompilar: no hay interruptor en tiempo de
ejecución.

Algo más que *no* es configurable hoy: el título de la ventana NUI del plugin de administración dentro
del juego (`plugins/atc-admin/ui/index.html`) está fijo en `ATC Admin Panel`. Si necesitas renombrar
eso, edita ese archivo en tu propio despliegue.

---

### 3. Publicar en FiveM

#### 3.1 — Obtener una clave de licencia

Los servidores de FiveM requieren una clave de licencia emitida por Cfx.re, desde
**https://keymaster.fivem.net**. Crea una clave para tu servidor y ponla en `server.cfg`:

```cfg
sv_licenseKey "YOUR_FIVEM_LICENSE_KEY"
```

Una clave emitida por una plataforma no es válida en otra. Una clave de keymaster.fivem.net funciona
solo en FiveM.

#### 3.2 — Obtener los artifacts del servidor

El binario del servidor de juego es **FXServer**, publicado por Cfx.re como compilaciones por
sistema operativo ("artifacts"). Descarga la compilación recomendada actual para tu sistema
operativo desde el servidor de artifacts de Cfx.re enlazado en la documentación oficial de hosting
de servidores de FiveM; no uses una compilación de un mirror cualquiera ni la compilación de otra
plataforma.

La forma en disco es la misma en todas partes:

```bash
# Linux
./run.sh +exec server.cfg

# Windows
FXServer.exe +exec server.cfg
```

#### 3.3 — Construir tu server.cfg

Parte de `infra/server.cfg.example`, que es la variante para FiveM y ya contiene todas las convars
de ATC, el orden de inicio correcto y la línea ACE de administración:

```bash
cp infra/server.cfg.example server.cfg
```

Luego **incorpora las líneas de red del `server.cfg` original que venía con tu artifact**.
`infra/server.cfg.example` es una capa de ATC: deliberadamente no incluye el texto base de la
plataforma. En particular necesitas las líneas de endpoint y una contraseña de RCON:

```cfg
endpoint_add_tcp "0.0.0.0:30120"
endpoint_add_udp "0.0.0.0:30120"

rcon_password "a-long-random-value"
```

Las partes específicas de ATC que debes completar:

```cfg
set atc_api_url      "http://<api-host>:3000"
set atc_api_token    "<same value as ATC_API_TOKEN in infra/.env>"
set atc_server_token "<same value as ATC_SERVER_TOKEN in infra/.env>"
set atc_server_id    "atc-main-01"
set atc_locale       "en"
set atc_fail_open    "false"
```

Y la concesión de administrador. ATC indexa cada registro de jugador por el identificador `license`,
así que conceder administrador por license es el camino que siempre funciona: encuentra tu propio
identificador en la consola del servidor cuando te conectes:

```cfg
add_ace identifier.license:XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX atc.admin allow
```

Los recursos se inician por nombre de carpeta, el core primero:

```cfg
start atc-core
start atc-sdk
start atc-identity
# ... the rest of your plugins
```

Dos trampas sobre las que `infra/server.cfg.example` ya advierte, repetidas aquí porque le cuestan
noches enteras a la gente:

- **`plugins/atc-plugin-healthcheck` no es un recurso de juego.** No tiene `fxmanifest.lua`: es un
  plugin de Node del lado del servidor para la API de ATC. Agregar una línea `start` para él produce
  un error de "resource not found".
- **Las carpetas de los bridges no se llaman como sus manifiestos.** Consulta la tabla de
  resolución de problemas en la sección 6.

#### 3.4 — Redirección de puertos

El servidor de juego escucha en el **30120 por defecto, tanto en TCP como en UDP**. Redirige ambos:

| Puerto | Protocolo | Por qué |
|---|---|---|
| 30120 | TCP | Endpoint HTTP, información del servidor, descarga de archivos de recursos |
| 30120 | UDP | Tráfico real del juego — sin esto los jugadores conectan y luego se les agota el tiempo |

Redirigir TCP pero no UDP es el clásico firewall a medio configurar: el servidor aparece en la
lista, muestra el nombre y el conteo de jugadores correctos, y nadie puede entrar realmente.

**No** redirijas el puerto de la API de ATC (3000) ni el puerto de la base de datos hacia la
internet pública.

#### 3.5 — Entrar en la lista de servidores

El listado es automático una vez que la clave de licencia se registra. No hay formulario de envío.

- **Deja `sv_master1` en paz.** Sobrescribirlo marca el servidor como privado y deja de aparecer en
  la lista.
- Configura un `sv_hostname` real. Un servidor que todavía se llama `default FXServer` es
  funcionalmente invisible.
- Si tu servidor está detrás de NAT, un proxy o un balanceador de carga y aparece con la dirección
  equivocada, usa las sobrescrituras estándar:

```cfg
set sv_listingIpOverride   "your.public.ip"
set sv_listingHostOverride "play.yourserver.example"
set sv_forceIndirectListing "true"
```

#### 3.6 — Fallas comunes en FiveM

| Síntoma | Causa |
|---|---|
| El servidor se niega a arrancar y se queja de la licencia | `sv_licenseKey` falta, está mal escrita o fue emitida para otra plataforma |
| El servidor corre pero nunca aparece en la lista | `sv_master1` sobrescrito, o la clave de licencia nunca se registró |
| Aparece en la lista, a los jugadores se les agota el tiempo al entrar | UDP 30120 no redirigido |
| Aparece con la IP equivocada | Detrás de NAT — configura las sobrescrituras de listado de arriba |
| Aparece como `default FXServer` | `sv_hostname` sin configurar, o configurado después del `exec` que importa |

---

### 4. Publicar en VMP

#### 4.1 — Qué es VMP, y por qué ATC no necesita portarse

VMP (vmp.ir) es una **plataforma compatible con CitizenFX**: es un fork explícito del servidor de
FiveM. El contrato de recursos es el mismo que usa FiveM: `fxmanifest.lua`,
`fx_version 'cerulean'`, `game 'gta5'`, recursos identificados por nombre de carpeta, los mismos
comandos `start` / `ensure` / `restart`, las mismas convars `sv_*`, y los mismos natives, exports y
eventos.

**Por lo tanto, ATC funciona en VMP sin modificaciones.** Ningún recurso de este repositorio
necesita portarse, ningún manifiesto necesita editarse y ningún Lua necesita cambiarse. Todo lo que
difiere es plomería de despliegue, y todo ello vive en tu `server.cfg`.

#### 4.2 — De dónde salen estos datos sobre VMP

Los sitios propios de VMP —su sitio web, el foro de la comunidad y la lista de servidores— devuelven
HTTP 403 a cualquier cosa que no sea un navegador común, y en la práctica no son alcanzables desde
fuera de Irán. Por eso todo lo que este documento afirma sobre VMP proviene de leer el **código
fuente publicado del servidor de VMP** (`github.com/v-mp/vmp`), que es la fuente autorizada sobre
cómo se comporta realmente el servidor. Cada afirmación de abajo está citada por archivo y línea
para que puedas comprobarla tú mismo.

Los endpoints que el servidor de VMP tiene fijados en el código:

| Qué | Valor | Fuente |
|---|---|---|
| Base de licenciamiento | `https://api.vmp.ir/` | `citizen-server-impl/include/ServerLicensingComponent.h:36` |
| Registro de clave | `POST https://api.vmp.ir/server/register.php?work=register` | `citizen-server-impl/src/ServerAuth.cpp:44` |
| Heartbeat de la lista | `https://api.vmp.ir/server/heartbeat.php?work=heartbeat` — el valor por defecto integrado de `sv_master1` | `citizen-server-impl/src/GameServer.cpp:54,120` |
| Actualizaciones del cliente | `https://cdn.vmp.ir/updates` | `client/launcher/Bootstrap.cpp:100` |
| Mirrors de caché del juego | `https://cdn.vmp.ir/mirrors/patches_fivem/3570/…` (build del juego **3570**) | `client/launcher/GameCache.cpp:1402ff` |

Hay dos cosas que el código fuente **no** puede responder, porque solo viven en el sitio web de VMP:
cómo obtienes una clave de licencia y de dónde se descargan los artifacts del servidor. Ambas quedan
marcadas abajo como pendientes en lugar de adivinadas.

Un resultado negativo útil: el registro «nucleus» de Cfx.re está **comentado** en el código fuente
(`citizen-server-impl/src/ServerNucleus.cpp:60-100`), así que un servidor de VMP no se registra en
`cfx.re` ni se comunica con la infraestructura de FiveM.

#### 4.3 — Parte de la configuración de VMP

```bash
cp infra/server.cfg.vmp.example server.cfg
```

El bloque de convars de ATC en ese archivo es **idéntico** al de la variante para FiveM: mismos
nombres, mismos valores predeterminados, mismo bloque de branding. Solo difieren las notas sobre
licencia, plataforma y lista de servidores.

Fija la plataforma para que tus logs y tu telemetría nombren la correcta:

```cfg
set atc_platform "vmp"
```

Todo lo de la sección 2 aplica sin cambios: `sv_hostname` más las convars `atc_brand_*`,
configuradas exactamente de la misma manera.

#### 4.4 — Clave de licencia

Una clave de licencia de VMP es **obligatoria**: esto está verificado, no supuesto. Al arrancar, VMP
ejecuta una comprobación de licencia y llama a `FatalError` en cada ruta de fallo, lo que detiene el
servidor (`ServerAuth.cpp:30-80`).

La clave se valida contra el servicio de licencias **propio** de VMP en `https://api.vmp.ir/`, **no**
contra keymaster.fivem.net. Una clave de FiveM nunca se autenticará en VMP, y viceversa.

```cfg
sv_licenseKey "YOUR_VMP_LICENSE_KEY"
```

**Qué ocurre al arrancar.** El servidor envía por POST `{"license":"<tu clave>"}` a
`https://api.vmp.ir/server/register.php?work=register`. Si tiene éxito imprime:

```
Server Auth: Checking license...
Server Auth: Server license key authentication succeeded!
Server Auth: Session Id : <id>
```

…y escribe `sv_sessionId` y `sv_secret` a partir de la propia respuesta, para luego forzar de
inmediato un heartbeat a la lista de servidores.

**Los tres mensajes de error**, para que puedas distinguirlos:

| Mensaje en consola | Significado |
|---|---|
| `Please set sv_licenseKey in server.cfg!` | La convar está vacía o falta |
| `A connection with the VMP server could not be established!` | `api.vmp.ir` no era alcanzable: red, DNS o firewall |
| *(un mensaje de la API de VMP, literal)* | La clave fue rechazada: expirada, revocada o vinculada a otro servidor |

**Se requiere IPv4.** La solicitud de licencia se hace con `opts.ipv4 = true`
(`ServerAuth.cpp:43`), y el heartbeat de la lista también (`GameServer.cpp:1001`). Un host con
conectividad a internet solo por IPv6 no puede licenciarse ni aparecer listado, y fallará con el
error de conexión de arriba.

**No** configures `sv_sessionId` ni `sv_secret` a mano. El handshake escribe ambos, y el heartbeat se
niega explícitamente a enviar mientras cualquiera de los dos esté vacío (`GameServer.cpp:971-973`):
configurarlos manualmente no hará que un servidor sin licencia aparezca.

> **Punto pendiente:** cómo se emite una clave se publica únicamente en el sitio web y el foro de la
> comunidad de VMP, que no podemos leer desde fuera de Irán. Consigue el procedimiento vigente
> directamente de VMP. Lo que sí es seguro, por el código fuente, es el endpoint contra el que se
> comprobará.

#### 4.5 — Artifacts y el cliente del jugador

- Los **artifacts del servidor** vienen de VMP, no del servidor de artifacts de FiveM, y un artifact
  de FiveM no aceptará una clave de licencia de VMP: comprobaría contra keymaster.fivem.net. **No se
  publican como releases de GitHub** (el repositorio público de VMP no tiene ninguno), y el código
  fuente no contiene ninguna URL de descarga de artifacts del servidor, así que no podemos nombrar
  una aquí. La forma en disco es la de FXServer, porque el servidor *es* FXServer:
  `FXServer.exe +exec server.cfg` en Windows, `./run.sh +exec server.cfg` en Linux.
  **Punto pendiente: consigue la compilación actual y su ubicación de descarga directamente de VMP.**
- **Los jugadores usan el launcher de VMP**, no el cliente de FiveM. El launcher se actualiza solo
  desde `https://cdn.vmp.ir/updates` (`client/launcher/Bootstrap.cpp:100`) y obtiene su caché del
  juego GTA V desde `https://cdn.vmp.ir/mirrors/patches_fivem/3570/…` (`GameCache.cpp:1402ff`), así
  que VMP apunta actualmente al **build 3570 del juego**. Unirse se hace a través del launcher, desde
  la lista de servidores de VMP o desde su campo de conexión directa.

#### 4.6 — Lista de servidores

El listado usa el heartbeat estándar de FXServer. `sv_master1` ya apunta por defecto a
`https://api.vmp.ir/server/heartbeat.php?work=heartbeat`, así que **no lo configuras**
(`GameServer.cpp:54,120`). El heartbeat se repite cada **3 minutos** (`GameServer.cpp:1074`), y cada
uno envía a ese endpoint tu número de jugadores, la información del servidor y el puerto.

**Una licencia válida es lo que consigue que aparezcas listado.** El heartbeat comprueba
`sv_sessionId` y `sv_secret` y retorna de inmediato si cualquiera de los dos está vacío
(`GameServer.cpp:971-973`). Esos solo los escribe un handshake de licencia exitoso, de modo que un
servidor sin licencia nunca aparece, por muy correcta que sea el resto de la configuración. Hay un
front end web público en **list.vmp.ir**; es un sitio web, no algo con lo que tu servidor se
comunique.

**Deja `sv_master1` en paz.** Vale la pena entender el mecanismo, porque el fallo es silencioso: el
heartbeat lleva un flag `private` que empieza en `true` y solo se pone en `false` cuando uno de
`sv_master1`…`sv_master3` es *exactamente* la URL por defecto de VMP (`GameServer.cpp:1039-1070`).
Apunta `sv_master1` a otro sitio y el heartbeat se sigue enviando: tu servidor simplemente queda
marcado como privado y nunca aparece públicamente. Nunca lo apuntes a un master de FiveM; ese master
no sabe nada de tu servidor.

- Configura un `sv_hostname` real: su valor por defecto integrado es literalmente
  `default FXServer` (`GameServer.cpp:119`).
- Detrás de NAT o un proxy, aplican las mismas tres sobrescrituras, con los mismos nombres y
  significados que en FiveM: `sv_listingIpOverride`, `sv_listingHostOverride`,
  `sv_forceIndirectListing`. Las tres se leen directamente en la carga útil del heartbeat
  (`GameServer.cpp:985-998`).
- Si la consulta a la lista devuelve un error, el servidor lo imprime literalmente como
  `^1Server list query returned an error: …`: lee esa línea antes de adivinar.

Si tu servidor sigue sin aparecer con una clave válida, un heartbeat en ejecución y un hostname
correcto, pregunta en el foro de la comunidad de VMP: ahí es donde los operadores plantean los
problemas de listado.

#### 4.7 — Dos notas de compatibilidad

- **Assets con escrow: no des nada por sentado.** Los assets cifrados de "escrow" de Cfx.re se
  descifran contra el servicio propio de Cfx.re, así que sería imprudente contar con que funcionen en
  una plataforma que no es de Cfx.re, pero no verificamos qué hace VMP realmente con ellos. Planifica
  con recursos de código abierto o sin cifrar junto a ATC, y prueba antes de depender de cualquier
  cosa con escrow. ATC en sí no distribuye ningún asset con escrow, así que esto nunca afecta a los
  recursos propios de ATC.
- **Recursos de terceros.** Todos los recursos de ATC usan únicamente natives, exports y eventos
  estándar de CitizenFX, que VMP provee sin cambios. Si un recurso *de terceros* se comporta mal en
  VMP, eso es un asunto entre tú y ese recurso: pregunta en el foro de la comunidad de VMP, donde los
  operadores discuten qué scripts hay que ajustar.

---

### 5. Lista de verificación

Recórrela en orden. Cada punto aísla una capa distinta, así que la primera falla te dice dónde está
el problema.

**Backend**

- [ ] `curl -i http://<api-host>:3000/health` devuelve **200** con `"status":"ok"` y tanto `db`
      como `redis` reportando `ok`.
- [ ] El mismo `curl` funciona **desde el host del servidor de juego**, no solo desde tu estación de
      trabajo.

**Arranque**

- [ ] La consola del servidor de juego muestra el banner de ATC:
      `Server: <your brand name>  |  Platform: <FiveM|VMP|...>`.
      Si el nombre sigue siendo `Atlantic Core`, `atc_brand_name` no se está leyendo: busca un error
      de escritura o una línea `set` colocada después de que inicien los recursos.
- [ ] La plataforma en esa línea coincide con la realidad. Si no, fija `atc_platform`.
- [ ] **No** hay líneas `^3[ATC:WARN]`. Cada una de ellas nombra la convar exacta que hay que
      corregir.
- [ ] Todas las líneas `start` se resolvieron. Sin errores de "resource not found", y sin ningún
      recurso iniciado cuya carpeta hayas renombrado.

**Se puede entrar localmente**

- [ ] Puedes conectarte desde la misma máquina: `localhost:30120` en el cuadro de conexión directa
      del cliente que use tu plataforma (el cliente de FiveM, o el launcher de VMP en VMP).
- [ ] La pantalla de personaje muestra **tus** palabras de logo, en **tu** color de acento.
- [ ] El texto de bienvenida del tutorial nombra **tu** servidor.
- [ ] Una expulsión o baneo de prueba a través de atc-core muestra **tu** etiqueta, por ejemplo
      `[NOVA] ...`, no `[ATC] ...`.
- [ ] Tus comandos de administración funcionan (`/atcban`, `/atckick`, `/atcbring`). Si dice "sin
      permiso", la línea `add_ace` no coincide con tu identificador real.

**Se puede entrar públicamente**

- [ ] Una conexión desde **fuera de tu red** funciona: pruébala desde un teléfono con datos
      móviles, no desde la LAN. Este es el paso que detecta una redirección UDP faltante.
- [ ] El servidor aparece en la lista de servidores de la plataforma bajo tu `sv_hostname`, con el
      conteo de jugadores correcto y la dirección pública correcta.
- [ ] `sv_hostname` y `atc_brand_name` dicen lo mismo.

---

### 6. Resolución de problemas

| Síntoma | Qué significa | Solución |
|---|---|---|
| Consola: `^3[ATC:WARN] atc_server_token is not set. Set it in server.cfg.^7` | `atc_server_token` está vacía | Configúrala en `server.cfg` con el mismo valor que `ATC_SERVER_TOKEN` en `infra/.env` |
| Consola: `^3[ATC:WARN] atc_api_token is not set. API calls will fail. Set it in server.cfg.^7` | `atc_api_token` está vacía — **nada que toque la API funcionará** | Configúrala con el mismo valor que `ATC_API_TOKEN` en `infra/.env` (mínimo 32 caracteres) |
| Consola: `^3[ATC:WARN] atc_brand_color is not a valid hex colour (expected #rrggbb). Falling back to #d4af37.^7` | El valor de color no es un triplete hexadecimal | Usa `#rrggbb`, por ejemplo `#3ea6ff`. La forma corta `#abc` se acepta y se expande; nombres como `blue` no |
| Los jugadores son rechazados en la tarjeta de conexión con un mensaje de "server configuration error" | `atc_api_token` está vacía y `atc_fail_open` es `false` | Configura `atc_api_token`. Es la advertencia anterior, un paso después |
| Los jugadores son rechazados con un mensaje de "could not verify your account" | La llamada a la API de cuentas falló: API caída, `atc_api_url` incorrecta, token incorrecto o bloqueo de firewall | `curl http://<api-host>:3000/health` **desde el servidor de juego**; revisa `atc_api_url`; revisa que el token coincida con `infra/.env` |
| Todo el mundo queda bloqueado cada vez que la API tiene un tropiezo | Funciona según lo diseñado — `atc_fail_open` es `false` por defecto, lo que bloquea las entradas cuando la API no es alcanzable | Arregla la API. `set atc_fail_open "true"` deja entrar a los jugadores durante una caída, pero entran sin una cuenta verificada y sin verificación de baneos: trátalo como una medida temporal, no como un ajuste para dejar encendido |
| La tarjeta de conexión rechaza a un jugador por un identificador de licencia faltante | ATC indexa a cada jugador por el identificador `license` y no puede continuar sin él | Normalmente es un problema del lado del cliente. Nota que `add_ace identifier.license:...` es también la razón por la que las concesiones de administrador deben usar `license`, no `steam` |
| Consola: recurso `atc-plugin-healthcheck` no encontrado | No tiene `fxmanifest.lua` — es un plugin de Node del lado del servidor para la API de ATC, no un recurso de juego | Elimina la línea `start`. Está deliberadamente ausente de ambos ejemplos de cfg distribuidos |
| El bridge no inicia: `start atc-bridge-esx` / `start atc-bridge-qb` falla | Los nombres de **carpeta** en este repositorio son `bridges/esx` y `bridges/qb-core`, pero sus manifiestos dicen `name 'atc-bridge-esx'` / `name 'atc-bridge-qb'`. Los recursos se inician por nombre de carpeta; el `name` del manifiesto no renombra nada | Renombra cada carpeta al copiarla — `bridges/esx` → `atc-bridge-esx`, `bridges/qb-core` → `atc-bridge-qb` — para que carpeta, manifiesto y línea `start` coincidan. Si ya las copiaste sin renombrar, usa `start esx` / `start qb-core` en su lugar |
| El servidor QBCore se rompe después de agregar el bridge de QB | Copiaste `bridges/qb-core` sin renombrar en un servidor que ya tiene un recurso `qb-core`: el bridge choca con el framework con el que existe para comunicarse | Renombra la carpeta a `atc-bridge-qb`. No ejecutes dos recursos llamados `qb-core` |
| La interfaz de un recurso queda en blanco / los callbacks NUI no hacen nada después de que renombraste su carpeta | Las páginas NUI de ATC se direccionan a sí mismas como `https://<folder-name>/`. Renombrar una carpeta distribuida rompe eso | Restaura el nombre original de la carpeta. Solo las dos carpetas de bridge son seguras de renombrar: no tienen NUI |
| Los cambios de branding no aparecen en el juego | Las convars de branding se leen cuando `atc-core` inicia | Reinicia el servidor, o `restart atc-core`. Revisa también que las líneas `set` vengan **antes** de las líneas `start` |
| El navegador de servidores muestra un nombre y la interfaz dentro del juego muestra otro | `sv_hostname` y `atc_brand_name` son independientes | Configura ambos con el mismo valor |
| El nombre dentro del juego sigue siendo `Atlantic Core` | `atc_brand_name` sin configurar, mal escrita, declarada con `set` en lugar de `setr` (por lo que nunca llega al cliente), o configurada como cadena vacía (lo vacío siempre cae de vuelta al predeterminado) | Usa `setr atc_brand_name "Tu Nombre"`, no vacío |
| El panel web de administración sigue diciendo `Atlantic Core` después de configurar `atc_brand_name` | El nombre del panel no es una convar: es `VITE_BRAND_NAME`, de tiempo de compilación (consulta 2.5) | Recompila el panel: `VITE_BRAND_NAME="Nova RP" pnpm --filter @atc/web build` |
| `atc_brand_community` / `_website` / `_discord` están configuradas pero no se muestra nada | Es lo esperado: se entregan al NUI, pero atc-core no renderiza ningún elemento para ellas | Nada que arreglar. Consúmelas desde un plugin o una interfaz personalizada |
| Un nombre de marca largo o no latino aparece cortado | Los valores se truncan a sus límites documentados (64 caracteres para el nombre, 16 para la etiqueta y las palabras del logo), en límites de carácter para que el UTF-8 siga siendo válido | Usa un nombre más corto |
| El banner de arranque nombra la plataforma equivocada | La detección automática no pudo distinguir esta compilación de la de upstream | Fíjala: `set atc_platform "vmp"` (o `fivem` / `redm`). Nunca configures `atc_platform_resolved` tú mismo |
| El servidor corre pero nunca aparece en ninguna lista | No hay clave de licencia válida, o se sobrescribió `sv_master1` | Verifica que la clave de licencia se haya registrado al arrancar; elimina cualquier línea `sv_master1` |
| Aparece correctamente en la lista, los jugadores conectan y luego se les agota el tiempo | UDP 30120 no está redirigido | Redirige **ambos**, TCP y UDP, en el 30120 |
| Aparece en la lista con la IP o el hostname equivocados | Detrás de NAT, un proxy o un balanceador de carga | Configura `sv_listingIpOverride` / `sv_listingHostOverride` / `sv_forceIndirectListing` |
| El servidor de VMP se cierra al arrancar con un error de licencia | No hay una `sv_licenseKey` utilizable — en FXServer, del cual VMP es un fork, una clave ausente o rechazada impide el arranque | Configura una clave emitida por VMP. Una clave de keymaster.fivem.net nunca puede funcionar aquí |
| Un recurso de terceros (no de ATC) se comporta mal en VMP | No es un problema de ATC — ATC usa únicamente natives estándar de CitizenFX | Pregunta por ese recurso en el foro de la comunidad de VMP. Si es un asset con escrow de Cfx.re, no des por sentado que el escrow funciona fuera de Cfx.re: pruébalo antes de depender de él |
| `/health` devuelve 503 `"status":"degraded"` | MariaDB o Redis no es alcanzable desde la API | Lee el objeto `components` en la respuesta: indica cuál. Revisa `docker compose ps` y las contraseñas en `infra/.env` |


---


## Deutsch (German)

Dieser Abschnitt führt Sie von "ATC läuft auf meinem Rechner" zu "Spieler finden meinen Server
und können ihm unter dem Namen meiner Community beitreten". Er behandelt sowohl **FiveM** als
auch **VMP** — dieselben ATC-Resources laufen unverändert auf beiden.

Lesen Sie ihn beim ersten Mal vollständig von oben nach unten. Jeder Befehl und jede Convar
weiter unten existiert in diesem Repository; nichts davon ist Zukunftsmusik.

---

### 1. Voraussetzungen

Beginnen Sie nicht mit den Veröffentlichungsschritten, bevor all dies zutrifft. Nahezu jede
Meldung der Art "mein Server ist im Produktivbetrieb kaputt" lässt sich darauf zurückführen,
dass einer dieser Punkte übersprungen wurde.

**1.1 — Das Backend läuft und ist gesund.**

Die Game-Resources von ATC sind eine dünne Schicht über der ATC-API. Die API benötigt MariaDB
und Redis.

```bash
cp infra/.env.example infra/.env      # then edit it — see below
docker compose -f infra/docker-compose.yml up -d
```

`infra/.env` muss echte Werte enthalten, keine Platzhalter:

```dotenv
DB_ROOT_PASSWORD=<a real password>
DB_PASSWORD=<a real password>
REDIS_PASSWORD=<a real password>
ATC_API_TOKEN=<at least 32 characters>
ATC_SERVER_TOKEN=<a real secret>
ATC_SERVER_ID=atc-main-01
PORT=3000
```

**1.2 — Das Datenbankschema ist eingespielt.** Führen Sie entweder den Migrations-Runner aus
(`pnpm db:migrate`) oder importieren Sie `database/atc.sql` in eine frische Datenbank `atc`.
Eine Schritt-für-Schritt-Anleitung für Windows in fünf Sprachen finden Sie in
`database/README.md`.

**1.3 — Das Monorepo ist gebaut.**

```bash
pnpm install
pnpm build
pnpm test
```

**1.4 — Die API antwortet auf ihrem Health-Endpunkt.** Führen Sie dies **von dem Rechner aus,
auf dem der Game-Server laufen wird**, nicht nur von Ihrem Laptop:

```bash
curl -i http://<api-host>:3000/health
```

Eine gesunde API liefert HTTP 200 und:

```json
{"status":"ok","components":{"db":"ok","redis":"ok"},"timestamp":"..."}
```

Liefert sie **503** mit `"status":"degraded"`, ist entweder `db` oder `redis` nicht verfügbar —
beheben Sie das, bevor Sie weitermachen. Die API stellt außerdem `/api/v1/ops/live` und
`/api/v1/ops/ready` für Uptime-Monitore bereit. Alle drei sind von der Bearer-Token-Auth
ausgenommen; jede andere Route ist es nicht.

**1.5 — Die ATC-Resources liegen an ihrem Platz, mit unveränderten Ordnernamen.** Kopieren Sie
`game/atc-core`, `game/atc-sdk` und die gewünschten Plugins aus `plugins/` in das Verzeichnis
`resources` Ihres Servers.

> Ein CitizenFX-Server identifiziert eine Resource über ihren **Ordnernamen**. Das Feld `name`
> in `fxmanifest.lua` ist Metadatum und benennt nichts um. Die NUI-Seiten von ATC adressieren
> sich selbst als `https://<folder-name>/`, weshalb das Umbenennen eines ausgelieferten Ordners
> die Benutzeroberfläche dieser Resource stillschweigend zerstört. Lassen Sie die Ordnernamen
> exakt so, wie sie ausgeliefert werden.

**1.6 — Die API ist vom Game-Server aus erreichbar.** `atc_api_url` verwendet standardmäßig
`http://localhost:3000`, was nur dann korrekt ist, wenn API und Game-Server auf demselben Host
laufen. Liegen sie auf verschiedenen Maschinen, tragen Sie die tatsächliche Adresse ein und
stellen Sie sicher, dass Ihre Firewall sie zulässt. Port 3000 sollte Ihren Game-Server und Ihr
Admin-Panel erreichen — er sollte **nicht** zum öffentlichen Internet offen sein.

---

### 2. Ihren Server benennen

ATC trennt zwei Dinge, die leicht zu verwechseln sind:

- **Framework-Identität** — *Atlantic Core*, *ATC*, *Naiemi Group*. Das ist die Namensnennung.
  Sie bleibt in `fxmanifest.lua`, in `LICENSE`, in der Dokumentation und im Startlog des
  Servers. Sie ist keine Einstellung, und die Lizenz behält sich diese Namen vor.
- **Server-Branding** — das, was *Ihre Spieler* sehen: das Logo im Charakterbildschirm, das
  Kürzel in Connect- und Ban-Nachrichten, den Willkommenstext des Tutorials. Auch der Titel des
  Admin-Panels lässt sich ändern, allerdings ist das eine Build-Zeit-Einstellung und keine
  Convar — siehe 2.5. Dieser Abschnitt zeigt, wie Sie all das konfigurieren.

Also: Das Framework bleibt **Atlantic Core by Naiemi Group**, und der Server, dem die Spieler
beitreten, ist **Ihrer**, mit Ihrem Namen darauf.

#### 2.1 — Die Branding-Convars

Alle diese Werte werden von `game/atc-core/shared/branding.lua` gelesen. **Jeder einzelne ist
optional.** Lassen Sie einen davon ungesetzt, verwendet ATC den angegebenen Standardwert — und
zwar exakt die Zeichenkette, die das Framework schon vor Einführung dieser Convars ausgeliefert
hat. Eine bestehende Installation, die nichts setzt, verhält sich damit genau wie zuvor.

| Convar | Standard | Max | Was sie ändert |
|---|---|---|---|
| `atc_brand_name` | `Atlantic Core` | 64 Zeichen | Server-/Community-Name: Tutorial-Texte, Charakterbildschirme, der Fenstertitel der NUI |
| `atc_brand_short` | `ATC` | 16 Zeichen | Das Kürzel in eckigen Klammern in den Connect-, Kick- und Ban-Nachrichten von atc-core — `[ATC]`, `[ATC Security]` |
| `atc_brand_logo_primary` | `ATLANTIC` | 16 Zeichen | Erstes Wort des NUI-Logos, in der Akzentfarbe dargestellt |
| `atc_brand_logo_secondary` | `CORE` | 16 Zeichen | Zweites Wort des NUI-Logos, in leichter Schriftstärke dargestellt |
| `atc_brand_community` | *(leer)* | 64 Zeichen | Community-Zeile. Wird bereinigt und an die NUI übergeben, atc-core zeichnet dafür jedoch kein Element |
| `atc_brand_website` | *(leer)* | 256 Zeichen | Website-URL. Wird an die NUI übergeben, von atc-core aber nicht dargestellt |
| `atc_brand_discord` | *(leer)* | 256 Zeichen | Discord-Einladung. Wird an die NUI übergeben, von atc-core aber nicht dargestellt |
| `atc_brand_color` | `#d4af37` | — | NUI-Akzentfarbe, `#rrggbb` (die Kurzform `#abc` wird expandiert) |

Hinweise, die Ihnen später Zeit sparen:

- Werte werden **bereinigt**: Steuerzeichen und spitze Klammern werden entfernt, Leerraum wird
  zusammengefasst, und zu lange Werte werden gekürzt, ohne ein UTF-8-Zeichen zu zerteilen —
  persische und deutsche Namen sind also sicher.
- Ein leerer Wert fällt immer auf den Standard zurück. Sie können `atc_brand_name` nicht durch
  Setzen auf `""` leeren.
- `atc_brand_community`, `atc_brand_website` und `atc_brand_discord` werden gelesen, bereinigt
  und zusammen mit dem übrigen Branding-Payload an die NUI gesendet, aber **die eigene
  Oberfläche von atc-core stellt heute für keinen dieser Werte ein Element dar**. Sie sind für
  Plugins und eigene UIs gedacht — sie zu setzen ändert in der ausgelieferten NUI nichts
  Sichtbares.
- Ein ungültiges `atc_brand_color` wird ignoriert, der Standard bleibt erhalten, und der Server
  gibt beim Start eine `^3[ATC:WARN]`-Zeile aus, die die betreffende Convar benennt.
- Das Branding wird beim Start von `atc-core` gelesen. Ändern Sie eine Convar, starten Sie
  danach den Server neu (oder `restart atc-core`), damit sie wirksam wird.
- Verwenden Sie `setr`, nicht `set`. Das Branding wird nicht nur vom Server, sondern auch von
  clientseitigen Skripten — dem Tutorial und der NUI — gelesen, und eine einfache `set`-Convar
  verlässt den Server nie. Mit `set` erhalten Sie eine halbe Umbenennung: Startprotokoll und
  Kick-Nachrichten zeigen Ihren Namen, während Charakterbildschirm und Tutorial bei den
  ausgelieferten Standardwerten bleiben. Alle *anderen* ATC-Convars bleiben `set`: Sie gelten nur
  serverseitig, und `atc_api_token` / `atc_server_token` dürfen nie repliziert werden.

#### 2.2 — `sv_hostname` ist etwas anderes

`sv_hostname` ist Ihr Eintrag im **Serverbrowser**. `atc_brand_name` ist derselbe Name, aber
**im Spiel** dargestellt. Beide werden an zwei verschiedenen Stellen gesetzt, und keiner der
beiden leitet sich aus dem anderen ab. Einen zu setzen und den anderen zu vergessen ist der mit
Abstand häufigste Weg, wie ein umbenannter Server halb umbenannt endet. Setzen Sie beide, auf
denselben Namen.

#### 2.3 — `atc_platform`

```
set atc_platform "auto"     # auto | fivem | vmp | redm
```

`auto` erkennt die Plattform zur Laufzeit und ist für nahezu alle die richtige Wahl. Setzen Sie
einen festen Wert, falls die von ATC beim Start protokollierte Plattform für Ihren Host falsch
ist. ATC **verzweigt niemals das Gameplay** anhand dieses Werts — er bestimmt nur, wie Logs,
Telemetrie und Ops-Datensätze die Plattform benennen. Ein falscher Wert ist also ein Fehler in
der Berichterstattung, kein Gameplay-Fehler.

Setzen Sie `atc_platform_resolved` **nicht** selbst. Der Server schreibt diesen Wert aus dem
Erkennungsergebnis selbst und repliziert ihn an die Clients.

#### 2.4 — Zum Kopieren: einen Server vollständig umbenennen

Fügen Sie dies in Ihre `server.cfg` ein und ersetzen Sie die Beispielwerte. Das ist die
vollständige Umbenennung im Spiel — keine Quelldatei ist anzufassen. Das Web-Admin-Panel wird
separat umbenannt, zur Build-Zeit; siehe 2.5.

```cfg
# ── Server identity ───────────────────────────────────────────────────────────
sv_hostname "Nova City RP — [NOVA]"
sv_maxclients 64
sets tags "roleplay,mmo,nova"

# ── Platform ──────────────────────────────────────────────────────────────────
set atc_platform "auto"

# ── Server branding ───────────────────────────────────────────────────────────
setr atc_brand_name           "Nova City RP"
setr atc_brand_short          "NOVA"
setr atc_brand_logo_primary   "NOVA"
setr atc_brand_logo_secondary "CITY"
setr atc_brand_community      "Nova Community"
setr atc_brand_website        "https://novacityrp.example"
setr atc_brand_discord        "https://discord.gg/your-invite"
setr atc_brand_color          "#3ea6ff"
```

Damit sehen Spieler `Nova City RP` im Tutorial, `NOVA CITY` im Charakterbildschirm,
`[NOVA] You are banned from this server.` bei einem Ban durch atc-core und `Nova City RP` im
Serverbrowser. Die Namensnennung des Frameworks selbst — `Atlantic Core`, `Naiemi Group` —
bleibt in den Manifesten, der Lizenz und im Startlog, wo sie hingehört.

#### 2.5 — Das Web-Admin-Panel umbenennen

Das Admin-Panel unter `apps/web` ist eine eigenständige React-Anwendung, und sein sichtbarer
Produktname ist **keine** Convar — die Convars des Game-Servers sind für eine Browser-Anwendung,
die im Voraus gebaut wird, nicht lesbar. Der Name stammt aus der Vite-Umgebungsvariablen
`VITE_BRAND_NAME`, die beim Kompilieren des Panels fest eingebacken wird:

```bash
VITE_BRAND_NAME="Nova RP" pnpm --filter @atc/web build
```

Alternativ können Sie `VITE_BRAND_NAME=Nova RP` in eine `.env`-Datei neben
`apps/web/package.json` schreiben. Ungesetzt löst der Wert zu `Atlantic Core` auf, ein
bestehender Build bleibt also unverändert. Der Wert steuert die Überschrift und die Fußzeile des
Login-Bildschirms, den Namen in der Seitenleiste und den Titel des Browser-Tabs. Eine Änderung
erfordert einen erneuten Build — es gibt keinen Schalter zur Laufzeit.

Noch etwas, das heute *nicht* konfigurierbar ist: Der NUI-Fenstertitel des Ingame-Admin-Plugins
(`plugins/atc-admin/ui/index.html`) ist fest auf `ATC Admin Panel` verdrahtet. Wenn Sie den
umbenennen müssen, bearbeiten Sie diese Datei in Ihrem eigenen Deployment.

---

### 3. Veröffentlichen auf FiveM

#### 3.1 — Einen Lizenzschlüssel besorgen

FiveM-Server benötigen einen von Cfx.re ausgestellten Lizenzschlüssel, erhältlich unter
**https://keymaster.fivem.net**. Erstellen Sie einen Schlüssel für Ihren Server und tragen Sie
ihn in die `server.cfg` ein:

```cfg
sv_licenseKey "YOUR_FIVEM_LICENSE_KEY"
```

Ein von einer Plattform ausgestellter Schlüssel ist auf einer anderen nicht gültig. Ein
Schlüssel von keymaster.fivem.net funktioniert ausschließlich auf FiveM.

#### 3.2 — Server-Artifacts besorgen

Die Server-Binärdatei ist **FXServer**, von Cfx.re als betriebssystemspezifische Builds
("Artifacts") veröffentlicht. Laden Sie den aktuell empfohlenen Build für Ihr Betriebssystem
vom Artifacts-Server von Cfx.re herunter, der aus der offiziellen FiveM-Dokumentation zum
Server-Hosting verlinkt ist — verwenden Sie keinen Build von einem beliebigen Mirror und keinen
Build einer anderen Plattform.

Die Struktur auf der Festplatte ist überall dieselbe:

```bash
# Linux
./run.sh +exec server.cfg

# Windows
FXServer.exe +exec server.cfg
```

#### 3.3 — Ihre server.cfg aufbauen

Gehen Sie von `infra/server.cfg.example` aus. Das ist die FiveM-Variante und enthält bereits
jede ATC-Convar, die korrekte Startreihenfolge und die ACE-Zeile für Admins:

```bash
cp infra/server.cfg.example server.cfg
```

Führen Sie anschließend **die Netzwerkzeilen aus der mitgelieferten Standard-`server.cfg` Ihres
Artifacts zusammen**. `infra/server.cfg.example` ist ein ATC-Overlay — es enthält bewusst kein
Plattform-Boilerplate. Insbesondere benötigen Sie die Endpoint-Zeilen und ein RCON-Passwort:

```cfg
endpoint_add_tcp "0.0.0.0:30120"
endpoint_add_udp "0.0.0.0:30120"

rcon_password "a-long-random-value"
```

Die ATC-spezifischen Teile, die Sie ausfüllen müssen:

```cfg
set atc_api_url      "http://<api-host>:3000"
set atc_api_token    "<same value as ATC_API_TOKEN in infra/.env>"
set atc_server_token "<same value as ATC_SERVER_TOKEN in infra/.env>"
set atc_server_id    "atc-main-01"
set atc_locale       "en"
set atc_fail_open    "false"
```

Und die Admin-Berechtigung. ATC schlüsselt jeden Spielerdatensatz über den Identifier `license`,
weshalb die Vergabe von Adminrechten per License der Weg ist, der immer funktioniert — Ihren
eigenen Identifier finden Sie in der Serverkonsole, wenn Sie sich verbinden:

```cfg
add_ace identifier.license:XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX atc.admin allow
```

Resources werden über den Ordnernamen gestartet, der Core zuerst:

```cfg
start atc-core
start atc-sdk
start atc-identity
# ... the rest of your plugins
```

Zwei Fallstricke, vor denen `infra/server.cfg.example` bereits warnt, hier wiederholt, weil sie
Leute ganze Abende kosten:

- **`plugins/atc-plugin-healthcheck` ist keine Game-Resource.** Es besitzt keine
  `fxmanifest.lua` — es ist ein serverseitiges Node-Plugin für die ATC-API. Eine `start`-Zeile
  dafür erzeugt einen "resource not found"-Fehler.
- **Die Bridge-Ordner sind nicht nach ihren Manifesten benannt.** Siehe die
  Troubleshooting-Tabelle in Abschnitt 6.

#### 3.4 — Portweiterleitung

Der Game-Server lauscht **standardmäßig auf 30120, sowohl TCP als auch UDP**. Leiten Sie beide
weiter:

| Port | Protokoll | Wofür |
|---|---|---|
| 30120 | TCP | HTTP-Endpunkt, Serverinformationen, Download von Resource-Dateien |
| 30120 | UDP | Der eigentliche Spieldatenverkehr — ohne ihn verbinden sich Spieler und laufen dann in einen Timeout |

TCP weiterzuleiten, UDP aber nicht, ist die klassische halb konfigurierte Firewall: Der Server
erscheint in der Liste, zeigt den richtigen Namen und die richtige Spielerzahl an — und niemand
kann tatsächlich beitreten.

Leiten Sie den ATC-API-Port (3000) und den Datenbank-Port **nicht** ins öffentliche Internet
weiter.

#### 3.5 — In die Serverliste kommen

Die Listung erfolgt automatisch, sobald sich der Lizenzschlüssel registriert. Es gibt kein
Anmeldeformular.

- Lassen Sie **`sv_master1` unangetastet**. Ein Überschreiben markiert den Server als privat und
  er wird nicht mehr gelistet.
- Setzen Sie einen echten `sv_hostname`. Ein Server, der noch `default FXServer` heißt, ist
  faktisch unsichtbar.
- Sitzt Ihr Server hinter NAT, einem Proxy oder einem Load Balancer und wird mit der falschen
  Adresse gelistet, verwenden Sie die Standard-Overrides:

```cfg
set sv_listingIpOverride   "your.public.ip"
set sv_listingHostOverride "play.yourserver.example"
set sv_forceIndirectListing "true"
```

#### 3.6 — Häufige Fehlerbilder auf FiveM

| Symptom | Ursache |
|---|---|
| Der Server verweigert den Start und beanstandet die Lizenz | `sv_licenseKey` fehlt, ist vertippt oder wurde für eine andere Plattform ausgestellt |
| Der Server läuft, erscheint aber nie in der Liste | `sv_master1` überschrieben, oder der Lizenzschlüssel hat sich nie registriert |
| Erscheint in der Liste, Spieler laufen beim Beitritt in einen Timeout | UDP 30120 nicht weitergeleitet |
| Erscheint mit der falschen IP | Hinter NAT — setzen Sie die obigen Listing-Overrides |
| Wird als `default FXServer` gelistet | `sv_hostname` nicht gesetzt oder erst nach dem maßgeblichen `exec` gesetzt |

---

### 4. Veröffentlichen auf VMP

#### 4.1 — Was VMP ist und warum ATC keine Portierung braucht

VMP (vmp.ir) ist eine **CitizenFX-kompatible Plattform** — ein expliziter Fork des
FiveM-Servers. Der Resource-Vertrag ist derselbe wie bei FiveM: `fxmanifest.lua`,
`fx_version 'cerulean'`, `game 'gta5'`, Resources werden über den Ordnernamen identifiziert,
dieselben Befehle `start` / `ensure` / `restart`, dieselben `sv_*`-Convars sowie dieselben
Natives, Exports und Events.

**ATC läuft daher unverändert auf VMP.** Keine Resource in diesem Repository muss portiert
werden, kein Manifest muss bearbeitet werden, und kein Lua muss geändert werden. Alles, was sich
unterscheidet, ist Deployment-Infrastruktur, und all das steht in Ihrer `server.cfg`.

#### 4.2 — Woher diese VMP-Angaben stammen

Die eigenen Seiten von VMP — Website, Community-Forum und Serverliste — liefern allem, was kein
gewöhnlicher Browser ist, HTTP 403 zurück und sind von außerhalb des Iran praktisch nicht
erreichbar. Alles, was dieses Dokument über VMP aussagt, stammt daher aus der Lektüre des
**veröffentlichten Server-Quellcodes von VMP** (`github.com/v-mp/vmp`), der maßgeblich dafür
ist, wie sich der Server tatsächlich verhält. Jede Angabe unten ist mit Datei und Zeile belegt,
sodass Sie sie selbst nachprüfen können.

Die Endpunkte, die im VMP-Server fest hinterlegt sind:

| Was | Wert | Quelle |
|---|---|---|
| Lizenz-Basis | `https://api.vmp.ir/` | `citizen-server-impl/include/ServerLicensingComponent.h:36` |
| Schlüssel-Registrierung | `POST https://api.vmp.ir/server/register.php?work=register` | `citizen-server-impl/src/ServerAuth.cpp:44` |
| Serverlisten-Heartbeat | `https://api.vmp.ir/server/heartbeat.php?work=heartbeat` — der eingebaute Standardwert von `sv_master1` | `citizen-server-impl/src/GameServer.cpp:54,120` |
| Client-Updates | `https://cdn.vmp.ir/updates` | `client/launcher/Bootstrap.cpp:100` |
| Game-Cache-Mirror | `https://cdn.vmp.ir/mirrors/patches_fivem/3570/…` (Game-Build **3570**) | `client/launcher/GameCache.cpp:1402ff` |

Zwei Dinge lassen sich aus dem Quellcode **nicht** beantworten, weil sie ausschließlich auf der
Website von VMP stehen: wie Sie einen Lizenzschlüssel erhalten und wo Server-Artifacts
heruntergeladen werden. Beide sind unten als offen gekennzeichnet statt geraten.

Ein nützliches Negativergebnis: Die Cfx.re-„Nucleus"-Registrierung ist im Quellcode
**auskommentiert** (`citizen-server-impl/src/ServerNucleus.cpp:60-100`). Ein VMP-Server
registriert sich also nicht bei `cfx.re` und funkt nicht an die FiveM-Infrastruktur.

#### 4.3 — Mit der VMP-Konfiguration beginnen

```bash
cp infra/server.cfg.vmp.example server.cfg
```

Der ATC-Convar-Block in dieser Datei ist **identisch** mit dem der FiveM-Variante — gleiche
Namen, gleiche Standardwerte, gleicher Branding-Block. Nur die Hinweise zu Lizenz, Plattform und
Serverliste unterscheiden sich.

Legen Sie die Plattform fest, damit Logs und Telemetrie die richtige benennen:

```cfg
set atc_platform "vmp"
```

Alles aus Abschnitt 2 gilt unverändert: `sv_hostname` sowie die `atc_brand_*`-Convars, exakt auf
dieselbe Weise gesetzt.

#### 4.4 — Lizenzschlüssel

Ein VMP-Lizenzschlüssel ist **zwingend erforderlich** — das ist belegt, nicht vermutet. Beim
Start führt VMP eine Lizenzprüfung durch und ruft auf jedem Fehlerpfad `FatalError` auf, was den
Server stoppt (`ServerAuth.cpp:30-80`).

Der Schlüssel wird gegen den **eigenen** Lizenzdienst von VMP unter `https://api.vmp.ir/`
geprüft, **nicht** gegen keymaster.fivem.net. Ein FiveM-Schlüssel authentifiziert sich auf VMP
niemals — und umgekehrt.

```cfg
sv_licenseKey "YOUR_VMP_LICENSE_KEY"
```

**Was beim Start passiert.** Der Server sendet `{"license":"<Ihr Schlüssel>"}` per POST an
`https://api.vmp.ir/server/register.php?work=register`. Bei Erfolg gibt er aus:

```
Server Auth: Checking license...
Server Auth: Server license key authentication succeeded!
Server Auth: Session Id : <id>
```

… und schreibt `sv_sessionId` und `sv_secret` aus der Antwort selbst, dann erzwingt er sofort
einen Serverlisten-Heartbeat.

**Die drei Fehlermeldungen**, damit Sie sie unterscheiden können:

| Konsolenmeldung | Bedeutung |
|---|---|
| `Please set sv_licenseKey in server.cfg!` | Die Convar ist leer oder fehlt |
| `A connection with the VMP server could not be established!` | `api.vmp.ir` war nicht erreichbar — Netzwerk, DNS oder Firewall |
| *(eine Meldung von VMPs API, wörtlich)* | Der Schlüssel selbst wurde abgelehnt — abgelaufen, widerrufen oder an einen anderen Server gebunden |

**IPv4 ist erforderlich.** Die Lizenzanfrage erfolgt mit `opts.ipv4 = true`
(`ServerAuth.cpp:43`), ebenso der Listen-Heartbeat (`GameServer.cpp:1001`). Ein Host mit
ausschließlich IPv6-Anbindung ans Internet kann sich weder lizenzieren noch listen lassen und
scheitert mit dem obigen Verbindungsfehler.

Setzen Sie `sv_sessionId` oder `sv_secret` **nicht** von Hand. Der Handshake schreibt beides,
und der Heartbeat verweigert das Senden ausdrücklich, solange eines davon leer ist
(`GameServer.cpp:971-973`) — manuelles Setzen bringt einen unlizenzierten Server nicht in die
Liste.

> **Offener Punkt:** Wie ein Schlüssel ausgestellt wird, steht nur auf der Website und im
> Community-Forum von VMP, die wir von außerhalb des Iran nicht lesen können. Holen Sie sich das
> aktuelle Verfahren direkt bei VMP. Sicher ist aus dem Quellcode der Endpunkt, gegen den geprüft
> wird.

#### 4.5 — Artifacts und der Spieler-Client

- **Server-Artifacts** stammen von VMP, nicht vom Artifacts-Server von FiveM, und ein
  FiveM-Artifact akzeptiert keinen VMP-Lizenzschlüssel — es würde gegen keymaster.fivem.net
  prüfen. Sie werden **nicht als GitHub-Releases veröffentlicht** (das öffentliche Repository
  von VMP hat keine), und der Quellcode enthält keine Download-URL für Server-Artifacts, daher
  können wir hier keine nennen. Die Struktur auf der Festplatte ist die von FXServer, denn der
  Server *ist* FXServer: `FXServer.exe +exec server.cfg` unter Windows,
  `./run.sh +exec server.cfg` unter Linux.
  **Offener Punkt — beziehen Sie den aktuellen Build und dessen Download-Ort direkt von VMP.**
- **Spieler verwenden den VMP-Launcher**, nicht den FiveM-Client. Der Launcher aktualisiert sich
  selbst über `https://cdn.vmp.ir/updates` (`client/launcher/Bootstrap.cpp:100`) und bezieht
  seinen GTA-V-Game-Cache von `https://cdn.vmp.ir/mirrors/patches_fivem/3570/…`
  (`GameCache.cpp:1402ff`) — VMP zielt derzeit also auf **Game-Build 3570**. Der Beitritt
  erfolgt über den Launcher, aus der Serverliste von VMP oder über dessen Direct-Connect-Feld.

#### 4.6 — Serverliste

Die Listung nutzt den standardmäßigen FXServer-Heartbeat. `sv_master1` ist bereits auf
`https://api.vmp.ir/server/heartbeat.php?work=heartbeat` voreingestellt, Sie konfigurieren ihn
also **nicht** (`GameServer.cpp:54,120`). Der Heartbeat wiederholt sich alle **3 Minuten**
(`GameServer.cpp:1074`) und überträgt dabei jeweils Spielerzahl, Serverinfos und Port an diesen
Endpunkt.

**Eine gültige Lizenz ist das, was Sie in die Liste bringt.** Der Heartbeat prüft
`sv_sessionId` und `sv_secret` und kehrt sofort zurück, wenn eines davon leer ist
(`GameServer.cpp:971-973`). Beide werden ausschließlich durch einen erfolgreichen
Lizenz-Handshake geschrieben — ein unlizenzierter Server erscheint also nie, ganz gleich wie
korrekt der Rest der Konfiguration ist. Es gibt ein öffentliches Web-Frontend unter
**list.vmp.ir**; das ist eine Website und nichts, womit Ihr Server spricht.

**Lassen Sie `sv_master1` unangetastet.** Der Mechanismus ist es wert, verstanden zu werden,
denn der Fehler ist lautlos: Der Heartbeat trägt ein `private`-Flag, das mit `true` startet und
nur dann auf `false` gesetzt wird, wenn einer von `sv_master1`…`sv_master3` *exakt* die
Standard-URL von VMP ist (`GameServer.cpp:1039-1070`). Richten Sie `sv_master1` woandershin, wird
der Heartbeat weiterhin gesendet — Ihr Server bleibt lediglich als privat markiert und taucht nie
öffentlich auf. Richten Sie ihn niemals auf einen FiveM-Master; dieser Master kennt Ihren Server
nicht.

- Setzen Sie einen echten `sv_hostname` — sein eingebauter Standardwert lautet wörtlich
  `default FXServer` (`GameServer.cpp:119`).
- Hinter NAT oder einem Proxy gelten dieselben drei Overrides, mit denselben Namen und
  Bedeutungen wie auf FiveM: `sv_listingIpOverride`, `sv_listingHostOverride`,
  `sv_forceIndirectListing`. Alle drei fließen direkt in die Heartbeat-Nutzlast ein
  (`GameServer.cpp:985-998`).
- Gibt die Listenabfrage einen Fehler zurück, gibt der Server ihn wörtlich als
  `^1Server list query returned an error: …` aus — lesen Sie diese Zeile, bevor Sie raten.

Erscheint Ihr Server trotz gültigem Schlüssel, laufendem Heartbeat und korrektem Hostnamen
weiterhin nicht, fragen Sie im Community-Forum von VMP nach — dort bringen Betreiber
Listungsprobleme zur Sprache.

#### 4.7 — Zwei Kompatibilitätshinweise

- **Escrow-Assets: setzen Sie nichts voraus.** Verschlüsselte "Escrow"-Assets von Cfx.re werden
  gegen den eigenen Dienst von Cfx.re entschlüsselt; es wäre daher unklug, darauf zu bauen, dass
  sie auf einer Plattform außerhalb von Cfx.re funktionieren — wir haben allerdings nicht
  überprüft, wie VMP tatsächlich mit ihnen umgeht. Planen Sie neben ATC mit quelloffenen oder
  unverschlüsselten Resources, und testen Sie, bevor Sie sich auf irgendetwas Escrow-Geschütztes
  verlassen. ATC selbst liefert keine Escrow-Assets aus, die eigenen Resources von ATC sind
  davon also nie betroffen.
- **Drittanbieter-Resources.** Jede ATC-Resource verwendet ausschließlich Standard-Natives,
  -Exports und -Events von CitizenFX, die VMP unverändert bereitstellt. Verhält sich eine
  *Drittanbieter*-Resource auf VMP fehlerhaft, ist das eine Sache zwischen Ihnen und dieser
  Resource — fragen Sie im VMP-Community-Forum nach, wo Betreiber besprechen, welche Skripte
  angepasst werden müssen.

---

### 5. Prüfliste zur Verifikation

Arbeiten Sie diese Punkte der Reihe nach ab. Jeder isoliert eine andere Schicht, sodass der
erste Fehlschlag Ihnen sagt, wo das Problem liegt.

**Backend**

- [ ] `curl -i http://<api-host>:3000/health` liefert **200** mit `"status":"ok"`, und sowohl
      `db` als auch `redis` melden `ok`.
- [ ] Dasselbe `curl` gelingt **vom Host des Game-Servers aus**, nicht nur von Ihrer
      Arbeitsstation.

**Start**

- [ ] Die Konsole des Game-Servers zeigt das ATC-Banner:
      `Server: <your brand name>  |  Platform: <FiveM|VMP|...>`.
      Steht dort noch `Atlantic Core`, wird `atc_brand_name` nicht gelesen — prüfen Sie auf
      einen Tippfehler oder eine `set`-Zeile, die nach dem Start der Resources steht.
- [ ] Die Plattform in dieser Zeile entspricht der Realität. Falls nicht, legen Sie
      `atc_platform` fest.
- [ ] Es gibt **keine** `^3[ATC:WARN]`-Zeilen. Jede einzelne davon benennt genau die Convar, die
      zu korrigieren ist.
- [ ] Jede `start`-Zeile wurde aufgelöst. Keine "resource not found"-Fehler und keine gestartete
      Resource, deren Ordner Sie umbenannt haben.

**Lokaler Beitritt**

- [ ] Sie können sich vom selben Rechner aus verbinden — `localhost:30120` im
      Direct-Connect-Feld desjenigen Clients, den Ihre Plattform verwendet (der FiveM-Client
      bzw. der VMP-Launcher auf VMP).
- [ ] Der Charakterbildschirm zeigt **Ihre** Logo-Wörter in **Ihrer** Akzentfarbe.
- [ ] Der Willkommenstext des Tutorials nennt **Ihren** Server.
- [ ] Ein Test-Kick oder -Ban über atc-core zeigt **Ihr** Kürzel, z. B. `[NOVA] ...`, nicht
      `[ATC] ...`.
- [ ] Ihre Admin-Befehle funktionieren (`/atcban`, `/atckick`, `/atcbring`). Kommt "no
      permission", passt die `add_ace`-Zeile nicht zu Ihrem tatsächlichen Identifier.

**Öffentlicher Beitritt**

- [ ] Eine Verbindung von **außerhalb Ihres Netzwerks** gelingt — testen Sie vom Handy über
      Mobilfunk, nicht aus dem LAN. Dieser Schritt deckt eine fehlende UDP-Weiterleitung auf.
- [ ] Der Server erscheint in der Serverliste der Plattform unter Ihrem `sv_hostname`, mit der
      korrekten Spielerzahl und der korrekten öffentlichen Adresse.
- [ ] `sv_hostname` und `atc_brand_name` sagen dasselbe aus.

---

### 6. Troubleshooting

| Symptom | Was es bedeutet | Lösung |
|---|---|---|
| Konsole: `^3[ATC:WARN] atc_server_token is not set. Set it in server.cfg.^7` | `atc_server_token` ist leer | Setzen Sie es in `server.cfg` auf denselben Wert wie `ATC_SERVER_TOKEN` in `infra/.env` |
| Konsole: `^3[ATC:WARN] atc_api_token is not set. API calls will fail. Set it in server.cfg.^7` | `atc_api_token` ist leer — **nichts, was die API berührt, wird funktionieren** | Setzen Sie es auf denselben Wert wie `ATC_API_TOKEN` in `infra/.env` (mindestens 32 Zeichen) |
| Konsole: `^3[ATC:WARN] atc_brand_color is not a valid hex colour (expected #rrggbb). Falling back to #d4af37.^7` | Der Farbwert ist kein Hex-Triplet | Verwenden Sie `#rrggbb`, z. B. `#3ea6ff`. Die Kurzform `#abc` wird akzeptiert und expandiert; Namen wie `blue` nicht |
| Spieler werden an der Connect-Karte mit der Meldung "server configuration error" abgewiesen | `atc_api_token` ist leer und `atc_fail_open` steht auf `false` | Setzen Sie `atc_api_token`. Das ist die vorige Warnung, einen Schritt später |
| Spieler werden mit der Meldung "could not verify your account" abgewiesen | Der Account-API-Aufruf ist fehlgeschlagen: API nicht erreichbar, falsche `atc_api_url`, falsches Token oder von der Firewall blockiert | `curl http://<api-host>:3000/health` **vom Game-Server aus**; `atc_api_url` prüfen; prüfen, ob das Token mit `infra/.env` übereinstimmt |
| Alle werden blockiert, sobald die API einen Aussetzer hat | Verhält sich wie vorgesehen — `atc_fail_open` steht standardmäßig auf `false`, was Beitritte blockiert, wenn die API nicht erreichbar ist | Reparieren Sie die API. `set atc_fail_open "true"` lässt Spieler während einer Störung herein, aber sie treten ohne verifizierten Account und ohne Ban-Prüfung bei — behandeln Sie das als vorübergehende Maßnahme, nicht als Dauereinstellung |
| Die Connect-Karte weist einen Spieler wegen eines fehlenden License-Identifiers ab | ATC schlüsselt jeden Spieler über den Identifier `license` und kann ohne ihn nicht fortfahren | Das ist normalerweise ein clientseitiges Problem. Beachten Sie, dass `add_ace identifier.license:...` auch der Grund ist, warum Admin-Rechte über `license` und nicht über `steam` vergeben werden sollten |
| Konsole: Resource `atc-plugin-healthcheck` nicht gefunden | Sie hat keine `fxmanifest.lua` — sie ist ein serverseitiges Node-Plugin für die ATC-API, keine Game-Resource | Entfernen Sie die `start`-Zeile. Sie fehlt in beiden ausgelieferten cfg-Beispielen absichtlich |
| Die Bridge startet nicht: `start atc-bridge-esx` / `start atc-bridge-qb` schlägt fehl | Die **Ordner**namen in diesem Repository lauten `bridges/esx` und `bridges/qb-core`, ihre Manifeste sagen aber `name 'atc-bridge-esx'` / `name 'atc-bridge-qb'`. Resources werden über den Ordnernamen gestartet; das `name` im Manifest benennt nichts um | Benennen Sie jeden Ordner beim Kopieren um — `bridges/esx` → `atc-bridge-esx`, `bridges/qb-core` → `atc-bridge-qb` — damit Ordner, Manifest und `start`-Zeile übereinstimmen. Haben Sie sie bereits unbenannt kopiert, verwenden Sie stattdessen `start esx` / `start qb-core` |
| Der QBCore-Server geht nach dem Hinzufügen der QB-Bridge kaputt | Sie haben `bridges/qb-core` unbenannt in einen Server kopiert, der bereits eine Resource `qb-core` besitzt — die Bridge kollidiert mit genau dem Framework, mit dem sie sprechen soll | Benennen Sie den Ordner in `atc-bridge-qb` um. Betreiben Sie nicht zwei Resources namens `qb-core` |
| Die UI einer Resource bleibt leer / NUI-Callbacks tun nichts, nachdem Sie ihren Ordner umbenannt haben | Die NUI-Seiten von ATC adressieren sich selbst als `https://<folder-name>/`. Das Umbenennen eines ausgelieferten Ordners zerstört das | Stellen Sie den ursprünglichen Ordnernamen wieder her. Nur die beiden Bridge-Ordner dürfen gefahrlos umbenannt werden — sie haben keine NUI |
| Branding-Änderungen erscheinen nicht im Spiel | Branding-Convars werden beim Start von `atc-core` gelesen | Starten Sie den Server neu oder `restart atc-core`. Prüfen Sie außerdem, ob die `set`-Zeilen **vor** den `start`-Zeilen stehen |
| Der Serverbrowser zeigt einen Namen, die Ingame-UI einen anderen | `sv_hostname` und `atc_brand_name` sind voneinander unabhängig | Setzen Sie beide auf denselben Wert |
| Der Ingame-Name lautet weiterhin `Atlantic Core` | `atc_brand_name` ist nicht gesetzt, falsch geschrieben, mit `set` statt `setr` deklariert (erreicht dadurch nie den Client) oder auf eine leere Zeichenkette gesetzt (leer fällt immer auf den Standard zurück) | Verwenden Sie `setr atc_brand_name "Ihr Name"`, nicht leer |
| Das Web-Admin-Panel zeigt nach dem Setzen von `atc_brand_name` weiterhin `Atlantic Core` | Der Name des Panels ist keine Convar — er stammt aus dem Build-Zeit-Wert `VITE_BRAND_NAME` (siehe 2.5) | Bauen Sie das Panel neu: `VITE_BRAND_NAME="Nova RP" pnpm --filter @atc/web build` |
| `atc_brand_community` / `_website` / `_discord` sind gesetzt, es erscheint aber nichts | Erwartetes Verhalten — sie werden an die NUI übergeben, atc-core stellt dafür aber kein Element dar | Nichts zu beheben. Verwerten Sie sie aus einem Plugin oder einer eigenen UI |
| Ein langer oder nicht-lateinischer Markenname wird abgeschnitten | Werte werden auf ihre dokumentierten Grenzen gekürzt (64 Zeichen für den Namen, 16 für Kürzel und Logo-Wörter), und zwar an Zeichengrenzen, damit UTF-8 gültig bleibt | Verwenden Sie einen kürzeren Namen |
| Das Start-Banner nennt die falsche Plattform | Die automatische Erkennung konnte diesen Build nicht vom Upstream unterscheiden | Legen Sie ihn fest: `set atc_platform "vmp"` (oder `fivem` / `redm`). Setzen Sie `atc_platform_resolved` niemals selbst |
| Der Server läuft, erscheint aber in keiner Liste | Kein gültiger Lizenzschlüssel, oder `sv_master1` wurde überschrieben | Prüfen Sie, ob sich der Lizenzschlüssel beim Start registriert hat; entfernen Sie jede `sv_master1`-Zeile |
| Korrekt gelistet, Spieler verbinden sich und laufen dann in einen Timeout | UDP 30120 ist nicht weitergeleitet | Leiten Sie **beides** weiter, TCP und UDP auf 30120 |
| Mit falscher IP oder falschem Hostnamen gelistet | Hinter NAT, einem Proxy oder einem Load Balancer | Setzen Sie `sv_listingIpOverride` / `sv_listingHostOverride` / `sv_forceIndirectListing` |
| Der VMP-Server beendet sich beim Start mit einem Lizenzfehler | Kein brauchbarer `sv_licenseKey` — auf FXServer, von dem VMP geforkt ist, verhindert ein fehlender oder abgelehnter Schlüssel den Start | Setzen Sie einen von VMP ausgestellten Schlüssel. Ein Schlüssel von keymaster.fivem.net kann hier niemals funktionieren |
| Eine Drittanbieter-Resource (nicht von ATC) verhält sich auf VMP fehlerhaft | Kein ATC-Problem — ATC verwendet ausschließlich Standard-Natives von CitizenFX | Fragen Sie zu dieser Resource im VMP-Community-Forum nach. Handelt es sich um ein Escrow-Asset von Cfx.re, setzen Sie nicht voraus, dass Escrow außerhalb von Cfx.re funktioniert — testen Sie es, bevor Sie sich darauf verlassen |
| `/health` liefert 503 `"status":"degraded"` | MariaDB oder Redis ist von der API aus nicht erreichbar | Lesen Sie das `components`-Objekt in der Antwort — es benennt, welches davon. Prüfen Sie `docker compose ps` und die Passwörter in `infra/.env` |


---
