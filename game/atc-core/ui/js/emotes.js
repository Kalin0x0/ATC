/**
 * ATC — Atlantic Core NUI
 * emotes.js — Emote wheel rendering and interaction (Phase 88)
 *
 * Listens for ATC_EMOTE_WHEEL_OPEN from Lua (via core.js message bus).
 * Sends atc:emote:play / atc:emote:stop / atc:emote:wheel:close via nuiCallback.
 */

;(function (window) {
  'use strict';

  /* ─── Helpers ──────────────────────────────────────────────── */
  function getWheel()  { return document.getElementById('emote-wheel'); }
  function getInner()  { return document.getElementById('emote-wheel-inner'); }

  /** Open the wheel and populate emote buttons. */
  function openWheel(emotes) {
    var wheel = getWheel();
    var inner = getInner();
    if (!wheel || !inner) return;

    inner.innerHTML = (emotes || []).map(function (name) {
      return '<button class="emote-btn" onclick="ATC.Emotes.play(\'' + name + '\')">'
        + name + '</button>';
    }).join('');

    wheel.classList.remove('hidden');
  }

  /** Close the wheel and notify Lua to release NUI focus. */
  function closeWheel() {
    var wheel = getWheel();
    if (wheel) wheel.classList.add('hidden');
    ATC.nuiCallback('atc:emote:wheel:close', {});
  }

  /** Play an emote by name. Closes the wheel immediately. */
  function playEmote(name) {
    closeWheel();
    ATC.nuiCallback('atc:emote:play', { name: name });
  }

  /* ─── Keyboard shortcut ────────────────────────────────────── */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var wheel = getWheel();
      if (wheel && !wheel.classList.contains('hidden')) {
        closeWheel();
      }
    }
  });

  /* ─── Message handler wired through core.js bus ─────────────── */
  ATC.on('ATC_EMOTE_WHEEL_OPEN', function (payload) {
    openWheel(payload && payload.emotes ? payload.emotes : []);
  });

  /* ─── Public namespace ──────────────────────────────────────── */
  window.ATC = window.ATC || {};
  window.ATC.Emotes = {
    open:  openWheel,
    close: closeWheel,
    play:  playEmote
  };

  console.info('[ATC Emotes] emotes.js loaded.');

}(window));
