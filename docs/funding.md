# Funding & Sponsorship

This document explains how the **Sponsor** button on the Atlantic Core
repository works, which platforms are supported, and how to add or change a
donation platform later.

The configuration itself lives in **[`.github/FUNDING.yml`](../.github/FUNDING.yml)**.

---

## How GitHub shows the Sponsor button

GitHub renders the **Sponsor** button (top of the repository page and in the
sidebar) automatically when it finds a `FUNDING.yml` file. Three things must be
true for it to appear:

1. **The file exists in a location GitHub checks.** GitHub looks for
   `FUNDING.yml` in the repository root, in `.github/`, or in `docs/`. We keep
   ours at **`.github/FUNDING.yml`**, which is the conventional location.
2. **It is on the default branch.** GitHub only reads `FUNDING.yml` from the
   repository's **default branch** (for this repo, `main`). Edits on a feature
   branch have no effect until they are merged.
3. **The repository has "Sponsorships" enabled.** In
   **Settings → General → Features**, the *Sponsorships* checkbox must be on
   (it is on by default for most repositories).

After the file is committed to the default branch, the button appears within a
few minutes. Each entry in `FUNDING.yml` becomes one option in the sponsor
drop-down.

> **GitHub Sponsors specifically:** the `github:` entry only produces a working
> one-click checkout once GitHub Sponsors is enabled for that account. Set it up
> once at <https://github.com/sponsors>. Until then, the other links (custom /
> Ko-fi / etc.) still work — the button simply shows whichever options resolve.

---

## Supported platforms

`FUNDING.yml` uses one key per platform. Provide the **handle/username only**
(no URL, no `@`), except for `custom`, which takes full URLs.

| Platform | YAML key | Value | Accepts a list? |
|---|---|---|---|
| GitHub Sponsors | `github` | GitHub username or org | ✅ up to 4 |
| Ko-fi | `ko_fi` | Ko-fi handle | — |
| Buy Me a Coffee | `buy_me_a_coffee` | handle | — |
| Patreon | `patreon` | Patreon handle | — |
| Open Collective | `open_collective` | collective slug | — |
| PayPal | `custom` | PayPal.me **URL** | ✅ (part of `custom`, up to 4) |
| Custom links | `custom` | any full URL(s) | ✅ up to 4 |
| Liberapay | `liberapay` | handle | — |
| Polar | `polar` | handle | — |
| Tidelift | `tidelift` | `platform/package` | — |
| thanks.dev | `thanks_dev` | handle | — |
| IssueHunt | `issuehunt` | handle | — |
| LFX / Community Bridge | `community_bridge` | project | — |
| LFX Crowdfunding | `lfx_crowdfunding` | project | — |

> **PayPal has no dedicated key.** Add it as a `custom` URL using a PayPal.me
> link, e.g. `https://www.paypal.me/your-handle`.

### What is active today

| Option | Value | Status |
|---|---|---|
| GitHub Sponsors | `Kalin0x0` | Configured — enable GitHub Sponsors on the account to activate checkout |
| Ko-fi | `kalin0x` | Active — <https://ko-fi.com/kalin0x> |
| Custom link | `https://naiemi.com` | Active |

Everything else ships as a commented template in `FUNDING.yml`, ready to switch
on when you have a handle.

---

## Add or change a platform

1. **Get your handle** on the platform (for Ko-fi/BMC/Patreon this is the name
   in your profile URL; for PayPal, your PayPal.me link).
2. **Edit [`.github/FUNDING.yml`](../.github/FUNDING.yml).** Uncomment the
   matching line and replace the `<placeholder>` with your handle. Examples:

   ```yaml
   # Turn one line on…
   ko_fi: naiemigroup
   buy_me_a_coffee: naiemigroup
   patreon: naiemigroup
   open_collective: atlantic-core

   # …and add PayPal / any other URL under custom:
   custom:
     - "https://naiemi.com"
     - "https://www.paypal.me/naiemigroup"
   ```

3. **Commit to the default branch** (`main`). The Sponsor button updates within
   a few minutes.
4. **(Optional) Add a README badge.** The "Support this Project" section of the
   [README](../README.md) already contains ready-to-use, commented Shields.io
   badge snippets — uncomment the matching one and drop in the same handle.
5. **Verify.** Reload the repo home page, click **Sponsor**, and confirm each
   link resolves.

---

## Removing a platform

Delete or re-comment its line in `FUNDING.yml` (and the matching README badge),
then commit to the default branch. The option disappears from the Sponsor
button on the next refresh.

---

## Files involved

| File | Purpose |
|---|---|
| [`.github/FUNDING.yml`](../.github/FUNDING.yml) | Drives the GitHub Sponsor button |
| [`README.md`](../README.md) → *Support this Project* | Public-facing badges & links |
| `docs/funding.md` *(this file)* | How the setup works and how to extend it |
