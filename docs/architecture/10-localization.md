# Localization Architecture

## Supported Languages

| Code | Language | Direction | Status |
|---|---|---|---|
| `en` | English | LTR | Primary / Required |
| `de` | German | LTR | Required |
| `fa` | Farsi (Persian) | RTL | Required |

All three languages must ship together. Missing translations fall back to `en`, never to hardcoded strings.

---

## Core Principle

**Zero hardcoded text.** Every visible string in every UI, notification, or system message must be a translation key. This applies to:

- React NUI components
- Admin panel (apps/web)
- FiveM chat notifications
- Server-side notification messages
- Error messages shown to players
- HUD labels

---

## Translation Key Format

```
{plugin}.{context}.{key}
```

Examples:
```
inventory.notification.item_added
inventory.notification.item_removed
inventory.ui.weight_label
inventory.ui.item_description.water_bottle

economy.notification.transfer_success
economy.notification.insufficient_funds
economy.ui.balance_label
economy.ui.currency.cash
economy.ui.currency.bank

player.ui.character_select.title
player.ui.character_select.create_button

admin.ui.ban_dialog.title
admin.ui.ban_dialog.reason_placeholder

core.error.server_unreachable
core.error.permission_denied
```

---

## Package Structure

```
packages/localization/
├── src/
│   ├── index.ts                  ← Main export
│   ├── loader.ts                 ← Translation file loader
│   ├── rtl.ts                    ← RTL detection utilities
│   └── types.ts                  ← Type definitions
│
├── locales/
│   ├── en/
│   │   ├── core.json
│   │   ├── inventory.json
│   │   ├── economy.json
│   │   ├── player.json
│   │   ├── admin.json
│   │   └── ... (one per plugin)
│   ├── de/
│   │   └── ... (mirrors en structure)
│   └── fa/
│       └── ... (mirrors en structure)
│
└── package.json
```

---

## Translation File Format

```jsonc
// packages/localization/locales/en/inventory.json
{
  "notification": {
    "item_added": "You received {{count}}x {{item}}.",
    "item_removed": "{{count}}x {{item}} removed from your inventory.",
    "item_used": "You used {{item}}.",
    "weight_warning": "Inventory almost full ({{current}}/{{max}} kg)",
    "inventory_full": "Your inventory is full."
  },
  "ui": {
    "title": "Inventory",
    "weight_label": "Weight",
    "hotbar_label": "Hotbar",
    "empty_slot": "Empty",
    "item_count": "{{count}}x",
    "use_button": "Use",
    "drop_button": "Drop",
    "give_button": "Give"
  }
}
```

```jsonc
// packages/localization/locales/de/inventory.json
{
  "notification": {
    "item_added": "Du hast {{count}}x {{item}} erhalten.",
    "item_removed": "{{count}}x {{item}} aus deinem Inventar entfernt.",
    "item_used": "Du hast {{item}} benutzt.",
    "weight_warning": "Inventar fast voll ({{current}}/{{max}} kg)",
    "inventory_full": "Dein Inventar ist voll."
  },
  "ui": {
    "title": "Inventar",
    "weight_label": "Gewicht",
    "hotbar_label": "Schnellzugriff",
    "empty_slot": "Leer",
    "item_count": "{{count}}x",
    "use_button": "Benutzen",
    "drop_button": "Fallenlassen",
    "give_button": "Geben"
  }
}
```

```jsonc
// packages/localization/locales/fa/inventory.json
{
  "notification": {
    "item_added": "{{count}}x {{item}} دریافت کردید.",
    "item_removed": "{{count}}x {{item}} از کوله‌پشتی‌تان حذف شد.",
    "item_used": "{{item}} را استفاده کردید.",
    "weight_warning": "کوله‌پشتی تقریباً پر است ({{current}}/{{max}} کیلوگرم)",
    "inventory_full": "کوله‌پشتی‌تان پر است."
  },
  "ui": {
    "title": "کوله‌پشتی",
    "weight_label": "وزن",
    "hotbar_label": "نوار سریع",
    "empty_slot": "خالی",
    "item_count": "{{count}}x",
    "use_button": "استفاده",
    "drop_button": "انداختن",
    "give_button": "دادن"
  }
}
```

---

## React UI Integration (i18next)

### Setup

```typescript
// apps/web/src/i18n.ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { loadLocales } from '@atc/localization'

i18n.use(initReactI18next).init({
    lng: navigator.language.split('-')[0] ?? 'en',
    fallbackLng: 'en',
    supportedLngs: ['en', 'de', 'fa'],
    resources: await loadLocales(['en', 'de', 'fa']),
    interpolation: {
        escapeValue: false
    },
    react: {
        useSuspense: true
    }
})

export default i18n
```

### Usage in Components

```tsx
// CORRECT
import { useTranslation } from 'react-i18next'

function InventoryUI() {
    const { t } = useTranslation('inventory')
    return (
        <div>
            <h1>{t('ui.title')}</h1>
            <span>{t('ui.weight_label')}: {weight}/{maxWeight} kg</span>
            {items.map(item => (
                <button>{t('ui.use_button')}</button>
            ))}
        </div>
    )
}

// WRONG — hardcoded string
function InventoryUI() {
    return <h1>Inventory</h1>  // ❌ Never
}
```

### Interpolation

```tsx
// With variables
t('notification.item_added', { count: 3, item: 'Water Bottle' })
// → "You received 3x Water Bottle."

// With plurals
t('notification.items_count', { count: 5 })
// en: "5 items" | de: "5 Gegenstände" | fa: "۵ آیتم"
```

---

## Lua Side Localization

```lua
-- ATC locale module (server-side, for chat notifications)
-- packages/sdk/lua/ATC/Locale.lua

ATC.SDK.Locale = {}
local _translations = {}
local _lang = 'en'

function ATC.SDK.Locale.SetLanguage(lang)
    _lang = lang
    -- Load from shared translation files
    _translations = json.decode(LoadResourceFile(
        GetCurrentResourceName(),
        'locales/' .. lang .. '.json'
    ) or '{}')
end

function ATC.SDK.Locale.T(key, vars)
    local parts = {}
    for part in key:gmatch('[^%.]+') do
        table.insert(parts, part)
    end

    local val = _translations
    for _, part in ipairs(parts) do
        if type(val) ~= 'table' then return key end
        val = val[part]
    end

    if type(val) ~= 'string' then return key end

    -- Variable interpolation: {{varName}}
    if vars then
        val = val:gsub('{{(%w+)}}', function(varName)
            return tostring(vars[varName] or '?')
        end)
    end

    return val
end

-- Alias
ATC.T = ATC.SDK.Locale.T
```

Usage in Lua:
```lua
-- Notify player with localized message
TriggerClientEvent('atc:ui:notification', source, {
    message = ATC.T('inventory.notification.item_added', {
        count = 1,
        item = 'Water Bottle'
    }),
    type = 'success'
})
```

---

## RTL Support

Farsi requires Right-to-Left layout. ATC handles this at three levels:

### 1. HTML Direction

```tsx
// Layout root
function App() {
    const { i18n } = useTranslation()
    const isRTL = i18n.language === 'fa'

    return (
        <div
            dir={isRTL ? 'rtl' : 'ltr'}
            className={isRTL ? 'font-farsi' : 'font-sans'}
        >
            {/* content */}
        </div>
    )
}
```

### 2. Tailwind RTL Utilities

```typescript
// tailwind.config.ts
export default {
    plugins: [
        require('@tailwindcss/rtl'),  // Adds rtl: variant
    ]
}
```

```tsx
// Component with RTL support
<div className="flex flex-row rtl:flex-row-reverse">
    <span className="ml-2 rtl:mr-2 rtl:ml-0">{label}</span>
</div>
```

### 3. CSS Variables for RTL

```css
/* packages/ui/src/styles/rtl.css */
[dir="rtl"] {
    --text-align: right;
    --flex-start: flex-end;
    --flex-end: flex-start;
    --margin-start: margin-right;
    --margin-end: margin-left;
}
```

---

## Translation Workflow

### Adding a New Language

1. Create locale directory: `packages/localization/locales/{code}/`
2. Copy all JSON files from `en/` as template
3. Translate all values (keep keys identical)
4. Add language code to `supportedLngs` in i18n config
5. Add RTL flag if needed in `packages/localization/src/rtl.ts`
6. Run translation completeness check: `pnpm locale:check`

### Adding a New Plugin

1. Create `plugins/{name}/locales/en.json` with all keys
2. Create `plugins/{name}/locales/de.json` and `fa.json`
3. Register namespace in i18n: namespace = plugin id
4. Export locale files from plugin package

### Translation Completeness Check

```bash
pnpm locale:check
# Outputs:
# ✅ en: 100% complete (247/247 keys)
# ✅ de: 100% complete (247/247 keys)
# ⚠️  fa: 94% complete (232/247 keys) — 15 keys missing
#        Missing: inventory.ui.craft_button, economy.ui.loan_term, ...
```

---

## Item Name Localization

Item names and descriptions are localized through the item definitions system:

```json
// packages/localization/locales/en/items.json
{
  "water_bottle": {
    "label": "Water Bottle",
    "description": "A bottle of clean water. Restores thirst."
  },
  "first_aid_kit": {
    "label": "First Aid Kit",
    "description": "Basic medical supplies. Heals minor injuries."
  }
}
```

Items are never stored by display name — always by definition key (`water_bottle`). Display name is resolved at UI render time.
