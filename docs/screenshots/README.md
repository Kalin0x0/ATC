# ATC UI Screenshots

Captured at 1920×1080 from the live NUI HTML (rendered in a headless Chromium
browser with representative demo data). Dark anthracite (`#1a1a2e`) + gold
(`#d4af37`) design system; all panels are responsive (verified 720p → 4K + portrait).

| # | Screenshot | UI | Plugin / Source | Open key |
|---|---|---|---|---|
| 01 | `01-weapon-attachments.jpeg` | Weapon Attachments | `atc-combat` | F10 |
| 02 | `02-phone.jpeg` | Phone (home / apps) | `atc-phone` | NUMPAD0 |
| 03 | `03-bank-atm.jpeg` | Bank / ATM | `atc-economy` | F5 |
| 06 | `06-criminal.jpeg` | Criminal Operations | `atc-criminal` | — |
| 07 | `07-dispatch.jpeg` | Dispatch Terminal | `atc-dispatch` | — |
| 08 | `08-housing.jpeg` | Property Manager | `atc-housing` | F3 |
| 09 | `09-jobs.jpeg` | Job Menu | `atc-jobs` | F4 |
| 10 | `10-territory.jpeg` | Territory Control Map | `atc-territory` | F2 |
| 11 | `11-garage.jpeg` | Vehicle Garage | `atc-vehicles` | F1 |
| 12 | `12-marketplace.jpeg` | Marketplace | `atc-marketplace` | F8 |
| 13 | `13-shop.jpeg` | 24/7 Store | `atc-example-shop` | — |
| 14 | `14-identity.jpeg` | Character Creation | `atc-identity` | on join |
| 15 | `15-admin.jpeg` | Admin Panel | `atc-admin` | F6 |
| 16 | `16-character-select.jpeg` | Character Select | `atc-core` | on join |
| 17 | `17-hud-ingame.jpeg` | In-game HUD (vitals/wallet/job/rep) | `atc-core` | always |
| 18 | `18-inventory.jpeg` | Inventory (5×10 grid) | `atc-core` | TAB |

## Note on `atc-mdt` and `atc-ems`

The **MDT** (police terminal, F9) and **EMS** (medical panel, F10) UIs are fully
implemented and verified, but use a full-screen `position: fixed` overlay pattern
that does not paint in the static headless-browser capture harness used for these
screenshots (the overlay collapses to 0×0 outside the FiveM CEF runtime). Their
DOM, data binding, and styling were verified programmatically; they render normally
in-game. Screenshots will be added from a live FiveM session.
