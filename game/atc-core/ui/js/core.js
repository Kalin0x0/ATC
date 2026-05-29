/**
 * ATC — Atlantic Core NUI
 * core.js — NUI message router, global state store, event bus
 *
 * All modules communicate through ATC.on() / ATC.emit().
 * Lua → NUI:  window message events (e.data.type + e.data payload)
 * NUI → Lua:  nuiCallback(name, data) via fetch POST
 */

;(function (window) {
  'use strict';

  /* ─── NUI → Lua ─────────────────────────────────────────────── */
  /**
   * Send a callback to the Lua resource.
   * @param {string} name  - callback route, e.g. 'atc:character:select'
   * @param {object} data  - payload (will be JSON-serialised)
   * @returns {Promise<Response>}
   */
  function nuiCallback(name, data) {
    return fetch('https://atc-core/' + name, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data || {})
    }).catch(function (err) {
      console.warn('[ATC Core] nuiCallback error:', name, err);
    });
  }

  /* ─── Event Bus ─────────────────────────────────────────────── */
  var _listeners = {};

  /**
   * Subscribe to an internal ATC event.
   * @param {string}   type
   * @param {function} handler
   */
  function on(type, handler) {
    if (!_listeners[type]) _listeners[type] = [];
    _listeners[type].push(handler);
  }

  /**
   * Unsubscribe from an internal ATC event.
   * @param {string}   type
   * @param {function} handler
   */
  function off(type, handler) {
    if (!_listeners[type]) return;
    _listeners[type] = _listeners[type].filter(function (h) { return h !== handler; });
  }

  /**
   * Emit an internal ATC event to all registered handlers.
   * @param {string} type
   * @param {*}      data
   */
  function emit(type, data) {
    var handlers = _listeners[type];
    if (!handlers || !handlers.length) return;
    handlers.forEach(function (h) {
      try { h(data); }
      catch (e) { console.error('[ATC Core] Event handler error for ' + type + ':', e); }
    });
  }

  /* ─── Global State ───────────────────────────────────────────── */
  var state = {
    ready:         false,
    version:       null,
    sessionId:     null,
    language:      'en',
    direction:     'ltr',
    vitals:        { health: 100, armor: 0, hunger: 100, thirst: 100, stamina: 100 },
    wallet:        { cash: 0, bank: 0, dirty: 0 },
    job:           null,
    inventory:     [],
    statusEffects: [],
    isDead:        false,
    inVehicle:     false,
    vehicle:       null,
    characterId:   null,
    hudVisible:    true
  };

  /* ─── Message Handlers ───────────────────────────────────────── */
  var handlers = {};

  handlers['ATC_CORE_READY'] = function (payload) {
    state.ready     = true;
    state.version   = payload.version  || null;
    state.sessionId = payload.sessionId || null;
    state.language  = payload.language || 'en';
    state.direction = payload.direction || 'ltr';

    // Apply document direction for RTL locales (e.g. Farsi)
    document.documentElement.setAttribute('dir', state.direction);
    document.documentElement.setAttribute('lang', state.language);

    emit('ATC_CORE_READY', payload);
    console.info('[ATC Core] Ready. version=' + state.version + ' lang=' + state.language);
  };

  handlers['ATC_LOCALE_UPDATE'] = function (payload) {
    state.language  = payload.code      || state.language;
    state.direction = payload.direction || 'ltr';
    document.documentElement.setAttribute('dir', state.direction);
    document.documentElement.setAttribute('lang', state.language);

    // Merge translations into i18n table if present
    if (payload.translations && typeof payload.translations === 'object') {
      var keys = Object.keys(payload.translations);
      keys.forEach(function (k) {
        ATC.i18n[k] = payload.translations[k];
      });
      applyI18n();
    }
    emit('ATC_LOCALE_UPDATE', payload);
  };

  handlers['ATC_VITALS_UPDATE'] = function (payload) {
    Object.assign(state.vitals, payload);
    emit('ATC_VITALS_UPDATE', state.vitals);
  };

  handlers['ATC_WALLET_UPDATE'] = function (payload) {
    Object.assign(state.wallet, payload);
    emit('ATC_WALLET_UPDATE', state.wallet);
  };

  handlers['ATC_INVENTORY_UPDATE'] = function (payload) {
    // Lua client/inventory.lua sends the slots array as the payload directly.
    // Server-pushed updates (via atc:inventory:update) wrap it as { slots: [...] }.
    // Handle both shapes.
    if (Array.isArray(payload)) {
      state.inventory = payload;
    } else if (payload && Array.isArray(payload.slots)) {
      state.inventory = payload.slots;
    } else {
      state.inventory = [];
    }
    emit('ATC_INVENTORY_UPDATE', state.inventory);
  };

  handlers['ATC_INVENTORY_OPEN'] = function () {
    emit('ATC_INVENTORY_OPEN', null);
  };

  handlers['ATC_INVENTORY_CLOSE'] = function () {
    emit('ATC_INVENTORY_CLOSE', null);
  };

  handlers['ATC_ITEM_USED'] = function (payload) {
    emit('ATC_ITEM_USED', payload);
  };

  handlers['ATC_ITEM_COOLDOWN'] = function (payload) {
    emit('ATC_ITEM_COOLDOWN', payload);
  };

  handlers['ATC_ITEM_BROKEN'] = function (payload) {
    emit('ATC_ITEM_BROKEN', payload);
  };

  handlers['ATC_STATUS_UPDATE'] = function (payload) {
    // payload is expected to be the effects array directly or { effects: [] }
    state.statusEffects = Array.isArray(payload) ? payload
      : (Array.isArray(payload.effects) ? payload.effects : []);
    emit('ATC_STATUS_UPDATE', state.statusEffects);
  };

  handlers['ATC_JOB_UPDATE'] = function (payload) {
    state.job = payload;
    emit('ATC_JOB_UPDATE', payload);
  };

  handlers['ATC_CHARACTER_SELECTED'] = function (payload) {
    state.characterId = payload.characterId || null;
    emit('ATC_CHARACTER_SELECTED', payload);
  };

  handlers['ATC_CHARACTER_SELECT_FAILED'] = function (payload) {
    emit('ATC_CHARACTER_SELECT_FAILED', payload || {});
  };

  handlers['ATC_CHARACTER_SELECT_SHOW'] = function (payload) {
    emit('ATC_CHARACTER_SELECT_SHOW', payload || {});
  };

  handlers['ATC_PLAYER_DEAD'] = function (payload) {
    state.isDead = true;
    emit('ATC_PLAYER_DEAD', payload);
  };

  handlers['ATC_PLAYER_REVIVED'] = function (payload) {
    state.isDead = false;
    emit('ATC_PLAYER_REVIVED', payload || {});
  };

  handlers['ATC_RESPAWN_AVAILABLE'] = function (payload) {
    emit('ATC_RESPAWN_AVAILABLE', payload || {});
  };

  handlers['ATC_VEHICLE_ENTERED'] = function (payload) {
    state.inVehicle = true;
    emit('ATC_VEHICLE_ENTERED', payload || {});
  };

  handlers['ATC_VEHICLE_EXITED'] = function (payload) {
    state.inVehicle = false;
    state.vehicle   = null;
    emit('ATC_VEHICLE_EXITED', payload || {});
  };

  handlers['ATC_VEHICLE_UPDATE'] = function (payload) {
    state.vehicle = payload;
    emit('ATC_VEHICLE_UPDATE', payload);
  };

  handlers['ATC_SEATBELT_TOGGLE'] = function (payload) {
    if (payload && state.vehicle) state.vehicle.seatbelt = payload.seatbelt;
    emit('ATC_SEATBELT_TOGGLE', payload);
  };

  handlers['ATC_HUD_TOGGLE'] = function () {
    state.hudVisible = !state.hudVisible;
    emit('ATC_HUD_TOGGLE', { visible: state.hudVisible });
  };

  handlers['ATC_HUD_TICK'] = function (payload) {
    // Batch state update from a single tick frame
    if (payload.vitals)        Object.assign(state.vitals, payload.vitals);
    if (payload.wallet)        Object.assign(state.wallet, payload.wallet);
    if (payload.job)           state.job = payload.job;
    if (payload.statusEffects) state.statusEffects = payload.statusEffects;
    if (typeof payload.isDead    === 'boolean') state.isDead    = payload.isDead;
    if (typeof payload.inVehicle === 'boolean') state.inVehicle = payload.inVehicle;
    if (payload.vehicle)       state.vehicle = payload.vehicle;
    emit('ATC_HUD_TICK', payload);
  };

  handlers['ATC_NOTIFICATION'] = function (payload) {
    emit('ATC_NOTIFICATION', payload);
  };

  /* ─── Dispatcher ─────────────────────────────────────────────── */
  function dispatch(msg) {
    if (!msg || typeof msg.type !== 'string') return;
    var handler = handlers[msg.type];
    if (handler) {
      try {
        // Lua SendNUIMessage always uses { type = '...', payload = ... }
        // Extract msg.payload when present; fall back to the whole message so
        // that handlers which expect a plain object still work.
        var payload = (msg.payload !== undefined) ? msg.payload : msg;
        handler(payload);
      } catch (e) {
        console.error('[ATC Core] Dispatch error for ' + msg.type + ':', e);
      }
    } else {
      // Unknown message — forward via emit so modules can handle custom types
      emit(msg.type, msg);
    }
  }

  /* ─── Lua message listener ───────────────────────────────────── */
  window.addEventListener('message', function (event) {
    dispatch(event.data);
  });

  /* ─── i18n helpers ───────────────────────────────────────────── */
  var _i18nTable = {};

  function t(key, fallback) {
    return _i18nTable[key] !== undefined ? _i18nTable[key] : (fallback || key);
  }

  /** Apply data-i18n keys to the DOM. */
  function applyI18n() {
    var els = document.querySelectorAll('[data-i18n]');
    els.forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      var val = _i18nTable[key];
      if (val !== undefined) el.textContent = val;
    });
    var titleEls = document.querySelectorAll('[data-i18n-title]');
    titleEls.forEach(function (el) {
      var key = el.getAttribute('data-i18n-title');
      var val = _i18nTable[key];
      if (val !== undefined) el.title = val;
    });
  }

  /* ─── Module registry ────────────────────────────────────────── */
  var modules = {};

  function registerModule(name, mod) {
    modules[name] = mod;
    if (typeof mod.init === 'function') {
      try { mod.init(); }
      catch (e) { console.error('[ATC Core] Module init error (' + name + '):', e); }
    }
  }

  /* ─── Public API ─────────────────────────────────────────────── */
  window.ATC = {
    state:          state,
    modules:        modules,
    on:             on,
    off:            off,
    emit:           emit,
    nuiCallback:    nuiCallback,
    dispatch:       dispatch,
    registerModule: registerModule,
    i18n:           _i18nTable,
    t:              t,
    applyI18n:      applyI18n
  };

  // Also expose nuiCallback as a standalone global for convenience
  window.nuiCallback = nuiCallback;

  console.info('[ATC Core] core.js loaded — awaiting ATC_CORE_READY.');

}(window));
