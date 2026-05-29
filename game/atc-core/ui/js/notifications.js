/**
 * ATC — Atlantic Core NUI
 * notifications.js — Toast notification system
 *
 * Levels: success | error | warning | info (default)
 * Max 5 visible at a time — oldest removed if exceeded.
 * Auto-dismiss after `duration` ms. Slide-in from right, fade-out on dismiss.
 */

;(function () {
  'use strict';

  /* ─── Config ─────────────────────────────────────────────────── */
  var MAX_VISIBLE   = 5;
  var DEFAULT_DURATION = 5000; // ms

  var LEVEL_ICONS = {
    success: '✔',
    error:   '✖',
    warning: '⚠',
    info:    'ℹ'
  };

  /* ─── DOM reference ──────────────────────────────────────────── */
  var containerEl = document.getElementById('notifications');

  /* ─── Active toasts queue ────────────────────────────────────── */
  var _active = []; // Array of { el, timerId }

  /* ─── Core API ───────────────────────────────────────────────── */
  /**
   * Show a toast notification.
   * @param {string} message
   * @param {string} level     - 'success' | 'error' | 'warning' | 'info'
   * @param {number} duration  - ms before auto-dismiss (default 5000)
   */
  function showNotification(message, level, duration) {
    if (!containerEl) return;

    var lvl      = validateLevel(level);
    var dur      = typeof duration === 'number' && duration > 0 ? duration : DEFAULT_DURATION;
    var icon     = LEVEL_ICONS[lvl] || LEVEL_ICONS.info;

    // Enforce max visible — remove oldest
    while (_active.length >= MAX_VISIBLE) {
      dismissToast(_active[0], true);
    }

    var toastEl = buildToast(message, lvl, icon, dur);
    containerEl.appendChild(toastEl);

    var entry = { el: toastEl, timerId: null };
    _active.push(entry);

    // Set CSS variable for progress bar animation duration
    toastEl.style.setProperty('--toast-duration', (dur / 1000) + 's');

    // Auto-dismiss
    entry.timerId = setTimeout(function () {
      dismissToast(entry, false);
    }, dur);
  }

  function buildToast(message, level, icon, duration) {
    var el = document.createElement('div');
    el.className = 'toast ' + level;
    el.setAttribute('role', 'alert');
    el.setAttribute('aria-live', 'assertive');

    // Icon
    var iconEl = document.createElement('span');
    iconEl.className   = 'toast-icon';
    iconEl.textContent = icon;

    // Body
    var bodyEl = document.createElement('div');
    bodyEl.className = 'toast-body';

    var msgEl = document.createElement('div');
    msgEl.className   = 'toast-message';
    msgEl.textContent = message;

    bodyEl.appendChild(msgEl);

    el.appendChild(iconEl);
    el.appendChild(bodyEl);

    // Click to dismiss early
    el.addEventListener('click', function () {
      var entry = _active.find(function (e) { return e.el === el; });
      if (entry) dismissToast(entry, false);
    });

    return el;
  }

  function dismissToast(entry, immediate) {
    var idx = _active.indexOf(entry);
    if (idx === -1) return; // Already removed

    // Clear the auto-dismiss timer
    if (entry.timerId) {
      clearTimeout(entry.timerId);
      entry.timerId = null;
    }

    _active.splice(idx, 1);

    if (immediate) {
      if (entry.el && entry.el.parentNode) {
        entry.el.parentNode.removeChild(entry.el);
      }
      return;
    }

    // Slide-out animation
    entry.el.classList.add('dismissing');
    entry.el.addEventListener('animationend', function handler() {
      entry.el.removeEventListener('animationend', handler);
      if (entry.el.parentNode) {
        entry.el.parentNode.removeChild(entry.el);
      }
    });

    // Fallback removal in case animationend doesn't fire
    setTimeout(function () {
      if (entry.el && entry.el.parentNode) {
        entry.el.parentNode.removeChild(entry.el);
      }
    }, 400);
  }

  function validateLevel(level) {
    var valid = ['success', 'error', 'warning', 'info'];
    return valid.indexOf(level) !== -1 ? level : 'info';
  }

  /* ─── Array.find polyfill-safe wrapper ───────────────────────── */
  if (!Array.prototype.find) {
    Array.prototype.find = function (cb) {
      for (var i = 0; i < this.length; i++) {
        if (cb(this[i], i, this)) return this[i];
      }
      return undefined;
    };
  }

  /* ─── ATC event subscriptions ────────────────────────────────── */
  ATC.on('ATC_NOTIFICATION', function (payload) {
    if (!payload || !payload.message) return;
    showNotification(
      payload.message,
      payload.level || 'info',
      payload.duration
    );
  });

  ATC.on('ATC_PLAYER_DEAD', function () {
    showNotification(
      ATC.t('notification.youAreDead', 'You are dead.'),
      'error',
      8000
    );
  });

  ATC.on('ATC_PLAYER_REVIVED', function () {
    showNotification(
      ATC.t('notification.youAreRevived', 'You have been revived!'),
      'success',
      4000
    );
  });

  ATC.on('ATC_RESPAWN_AVAILABLE', function () {
    showNotification(
      ATC.t('notification.respawnAvailable', 'You can now respawn.'),
      'info',
      5000
    );
  });

  ATC.on('ATC_CHARACTER_SELECT_FAILED', function () {
    showNotification(
      ATC.t('notification.charSelectFailed', 'Failed to select character. Please try again.'),
      'error',
      5000
    );
  });

  ATC.on('ATC_ITEM_USED', function (payload) {
    if (payload.itemName) {
      showNotification(
        ATC.t('notification.itemUsed', 'Used: ') + (payload.itemName),
        'info',
        2500
      );
    }
  });

  ATC.on('ATC_ITEM_BROKEN', function (payload) {
    if (payload.itemName) {
      showNotification(
        ATC.t('notification.itemBroken', 'Item broken: ') + payload.itemName,
        'warning',
        4000
      );
    }
  });

  ATC.on('ATC_SEATBELT_TOGGLE', function (payload) {
    if (!payload) return;
    if (payload.seatbelt) {
      showNotification(ATC.t('notification.seatbeltOn',  'Seatbelt fastened.'), 'success', 2000);
    } else {
      showNotification(ATC.t('notification.seatbeltOff', 'Seatbelt removed.'),  'warning', 2000);
    }
  });

  /* ─── Register module ────────────────────────────────────────── */
  ATC.registerModule('notifications', {
    init: function () {
      // Nothing to initialise
    },
    show: showNotification
  });

  // Also expose as a global for convenience
  window.ATCNotify = showNotification;

  console.info('[ATC Notifications] notifications.js loaded.');

}());
