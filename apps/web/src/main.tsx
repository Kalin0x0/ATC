import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { App } from './App'
import './app.css'

// ── Build-time branding ─────────────────────────────────────────────────────
// The admin panel's visible product name is configurable so a self-hosted
// community can show its own name. Set it at build time:
//
//     VITE_BRAND_NAME="Nova RP" pnpm --filter @atc/web build
//
// or put VITE_BRAND_NAME in an .env file next to apps/web/package.json. Unset
// resolves to 'Atlantic Core', so existing builds are byte-for-byte unchanged.
// Framework attribution (the 'ATC' logo mark, LICENSE, README) is not affected.
declare global {
  interface ImportMetaEnv {
    readonly VITE_BRAND_NAME?: string
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
}

const BRAND_NAME = import.meta.env.VITE_BRAND_NAME || 'Atlantic Core'

// index.html cannot read import.meta.env, so its <title> is the static
// pre-hydration fallback and this line applies the configured brand.
document.title = `ATC — ${BRAND_NAME} Admin`

// i18next minimal init — extend with actual namespaces as needed
i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  resources: {
    en: {
      translation: {
        'nav.dashboard':  'Dashboard',
        'nav.players':    'Players',
        'nav.economy':    'Economy',
        'nav.jobs':       'Jobs',
        'nav.server':     'Server Ops',
        'common.loading': 'Loading…',
        'common.error':   'An error occurred.',
        'common.empty':   'No data available.',
        'common.logout':  'Logout',
        'login.title':    `${BRAND_NAME} Admin`,
        'login.subtitle': 'Sign in to manage your server',
        'login.apiUrl':   'API URL',
        'login.token':    'API Token',
        'login.submit':   'Sign In',
      },
    },
  },
})

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element not found')

createRoot(rootEl).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
