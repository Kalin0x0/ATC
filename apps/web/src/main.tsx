import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { App } from './App'
import './app.css'

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
        'login.title':    'Atlantic Core Admin',
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
