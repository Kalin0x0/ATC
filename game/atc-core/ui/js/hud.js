/**
 * ATC — Atlantic Core NUI
 * hud.js — HUD updater module
 *
 * Handles: vitals bar, wallet, job, vehicle HUD, status effects, HUD toggle.
 * Uses requestAnimationFrame batching with dirty-flag pattern to avoid
 * redundant DOM writes on every tick.
 */

;(function () {
  'use strict';

  /* ─── DOM references ─────────────────────────────────────────── */
  var hudEl           = document.getElementById('atc-hud');

  // Vitals
  var vitalDefs = [
    { key: 'health',  fillId: 'vital-health-fill',  valId: 'vital-health-val',  rowId: 'vital-health' },
    { key: 'armor',   fillId: 'vital-armor-fill',   valId: 'vital-armor-val',   rowId: 'vital-armor' },
    { key: 'hunger',  fillId: 'vital-hunger-fill',  valId: 'vital-hunger-val',  rowId: 'vital-hunger' },
    { key: 'thirst',  fillId: 'vital-thirst-fill',  valId: 'vital-thirst-val',  rowId: 'vital-thirst' },
    { key: 'stamina', fillId: 'vital-stamina-fill', valId: 'vital-stamina-val', rowId: 'vital-stamina' }
  ];

  var vitalEls = {};
  vitalDefs.forEach(function (def) {
    vitalEls[def.key] = {
      fill: document.getElementById(def.fillId),
      val:  document.getElementById(def.valId),
      row:  document.getElementById(def.rowId)
    };
  });

  // Wallet
  var walletCashEl  = document.getElementById('wallet-cash');
  var walletBankEl  = document.getElementById('wallet-bank');
  var walletDirtyEl = document.getElementById('wallet-dirty');
  var walletDirtyRow = document.getElementById('wallet-dirty-row');

  // Job
  var jobNameEl = document.getElementById('job-name');
  var jobRankEl = document.getElementById('job-rank');
  var dutyDotEl = document.getElementById('duty-dot');

  // Vehicle
  var vehicleHudEl     = document.getElementById('vehicle-hud');
  var speedNumberEl    = document.getElementById('vehicle-speed');
  var vehicleGearEl    = document.getElementById('vehicle-gear');
  var vehicleFuelValEl = document.getElementById('vehicle-fuel-val');
  var vehicleFuelFill  = document.getElementById('vehicle-fuel-fill');
  var seatbeltIconEl   = document.getElementById('seatbelt-icon');

  // Status effects
  var statusEffectsEl = document.getElementById('status-effects');

  /* ─── Cached last values (dirty-flag throttle) ───────────────── */
  var lastVitals  = {};
  var lastWallet  = {};
  var lastJob     = null;
  var lastVehicle = null;
  var rafPending  = false;

  // Pending updates queued for the next rAF
  var pending = {
    vitals:  null,
    wallet:  null,
    job:     null,
    vehicle: null,
    effects: null,
    toggleHud: false
  };

  /* ─── rAF flush ──────────────────────────────────────────────── */
  function scheduleDOMUpdate() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(flushUpdates);
  }

  function flushUpdates() {
    rafPending = false;

    if (pending.toggleHud) {
      pending.toggleHud = false;
      if (hudEl) {
        var visible = ATC.state.hudVisible;
        hudEl.style.opacity  = visible ? '1' : '0';
        hudEl.style.pointerEvents = visible ? '' : 'none';
      }
    }

    if (pending.vitals) {
      renderVitals(pending.vitals);
      pending.vitals = null;
    }

    if (pending.wallet) {
      renderWallet(pending.wallet);
      pending.wallet = null;
    }

    if (pending.job !== undefined) {
      renderJob(pending.job);
      pending.job = undefined;
    }

    if (pending.vehicle !== undefined) {
      renderVehicleHud(pending.vehicle);
      pending.vehicle = undefined;
    }

    if (pending.effects) {
      renderStatusEffects(pending.effects);
      pending.effects = null;
    }
  }

  /* ─── Vitals renderer ────────────────────────────────────────── */
  function updateVitalsBar(vitals) {
    // Throttle: only schedule a DOM update if any value changed by > 0.5%
    var changed = false;
    vitalDefs.forEach(function (def) {
      var newVal = typeof vitals[def.key] === 'number' ? vitals[def.key] : 100;
      if (Math.abs((lastVitals[def.key] || 0) - newVal) > 0.5) {
        changed = true;
      }
    });
    if (!changed) return;
    Object.assign(lastVitals, vitals);
    pending.vitals = vitals;
    scheduleDOMUpdate();
  }

  function renderVitals(vitals) {
    vitalDefs.forEach(function (def) {
      var rawVal = typeof vitals[def.key] === 'number' ? vitals[def.key] : 100;
      var pct    = Math.max(0, Math.min(100, rawVal));
      var els    = vitalEls[def.key];
      if (!els) return;

      els.fill.style.width = pct + '%';
      els.val.textContent  = Math.round(pct);

      // Critical pulse at < 20%
      if (pct < 20) {
        els.fill.classList.add('critical');
      } else {
        els.fill.classList.remove('critical');
      }

      // Active border highlight for non-zero values
      if (pct > 0) {
        els.row.classList.add('active');
      } else {
        els.row.classList.remove('active');
      }
    });
  }

  /* ─── Wallet renderer ────────────────────────────────────────── */
  function updateWallet(wallet) {
    if (lastWallet.cash  === wallet.cash  &&
        lastWallet.bank  === wallet.bank  &&
        lastWallet.dirty === wallet.dirty) return;
    Object.assign(lastWallet, wallet);
    pending.wallet = wallet;
    scheduleDOMUpdate();
  }

  function renderWallet(wallet) {
    var fmt = function (n) { return '$' + (n || 0).toLocaleString(); };
    if (walletCashEl)  walletCashEl.textContent  = fmt(wallet.cash);
    if (walletBankEl)  walletBankEl.textContent  = fmt(wallet.bank);
    if (walletDirtyEl) walletDirtyEl.textContent = fmt(wallet.dirty);

    // Show dirty row only if there's dirty money
    if (walletDirtyRow) {
      if (wallet.dirty && wallet.dirty > 0) {
        walletDirtyRow.classList.add('visible');
      } else {
        walletDirtyRow.classList.remove('visible');
      }
    }
  }

  /* ─── Job renderer ───────────────────────────────────────────── */
  function updateJob(job) {
    pending.job = job;
    scheduleDOMUpdate();
  }

  function renderJob(job) {
    if (!job) {
      if (jobNameEl) jobNameEl.textContent = ATC.t('hud.unemployed', 'Unemployed');
      if (jobRankEl) jobRankEl.textContent = '';
      if (dutyDotEl) dutyDotEl.classList.remove('on-duty');
      return;
    }
    if (jobNameEl) jobNameEl.textContent = job.jobLabel || job.jobName || '';
    if (jobRankEl) jobRankEl.textContent  = job.rankLabel || job.rank || '';
    if (dutyDotEl) {
      if (job.onDuty) {
        dutyDotEl.classList.add('on-duty');
      } else {
        dutyDotEl.classList.remove('on-duty');
      }
    }
  }

  /* ─── Vehicle HUD renderer ───────────────────────────────────── */
  function updateVehicleHud(data) {
    pending.vehicle = data;
    scheduleDOMUpdate();
  }

  function renderVehicleHud(data) {
    if (!data) {
      // Hide vehicle HUD
      if (vehicleHudEl) vehicleHudEl.classList.add('hidden');
      return;
    }

    if (vehicleHudEl) vehicleHudEl.classList.remove('hidden');

    // Speed
    if (speedNumberEl) {
      var spd = Math.round(data.speed || 0);
      speedNumberEl.textContent = spd;
      if (spd > 130) {
        speedNumberEl.classList.add('overspeed');
      } else {
        speedNumberEl.classList.remove('overspeed');
      }
    }

    // Gear
    if (vehicleGearEl) {
      var gear = data.gear;
      if (gear === 0)       vehicleGearEl.textContent = 'R';
      else if (!gear)       vehicleGearEl.textContent = 'N';
      else                  vehicleGearEl.textContent = gear;
    }

    // Fuel
    if (vehicleFuelValEl) {
      vehicleFuelValEl.textContent = Math.round(data.fuel || 0);
    }
    if (vehicleFuelFill) {
      var fuelPct = Math.max(0, Math.min(100, data.fuel || 0));
      vehicleFuelFill.style.width = fuelPct + '%';
      vehicleFuelFill.classList.remove('low', 'empty');
      if (fuelPct < 10)     vehicleFuelFill.classList.add('empty');
      else if (fuelPct < 25) vehicleFuelFill.classList.add('low');
    }

    // Seatbelt
    if (seatbeltIconEl) {
      seatbeltIconEl.classList.remove('on', 'off');
      if (data.seatbelt) {
        seatbeltIconEl.classList.add('on');
        seatbeltIconEl.textContent = '🔒';
      } else {
        seatbeltIconEl.classList.add('off');
        seatbeltIconEl.textContent = '⚠';
      }
    }
  }

  /* ─── Status effects renderer ────────────────────────────────── */
  function updateStatusEffects(effects) {
    pending.effects = effects;
    scheduleDOMUpdate();
  }

  function renderStatusEffects(effects) {
    if (!statusEffectsEl) return;
    statusEffectsEl.innerHTML = '';

    if (!Array.isArray(effects)) return;

    effects.forEach(function (effect) {
      var el = document.createElement('div');
      el.className = 'status-effect';

      var iconEl = document.createElement('span');
      iconEl.className = 'status-effect-icon';
      iconEl.textContent = effect.icon || '✦';

      var labelEl = document.createElement('span');
      labelEl.className = 'status-effect-label';
      labelEl.textContent = effect.label || effect.id || '';

      el.appendChild(iconEl);
      el.appendChild(labelEl);

      if (effect.color) {
        el.style.borderColor = effect.color;
        iconEl.style.color   = effect.color;
      }

      statusEffectsEl.appendChild(el);
    });
  }

  /* ─── Vehicle enter / exit ───────────────────────────────────── */
  function onVehicleEntered() {
    if (!vehicleHudEl) return;
    vehicleHudEl.classList.remove('hidden');
    vehicleHudEl.classList.add('slide-enter');
    // Remove animation class after it completes
    vehicleHudEl.addEventListener('animationend', function cleanup() {
      vehicleHudEl.classList.remove('slide-enter');
      vehicleHudEl.removeEventListener('animationend', cleanup);
    });
  }

  function onVehicleExited() {
    if (vehicleHudEl) vehicleHudEl.classList.add('hidden');
    // Reset vehicle data display
    if (speedNumberEl)    speedNumberEl.textContent    = '0';
    if (vehicleGearEl)    vehicleGearEl.textContent    = 'N';
    if (vehicleFuelValEl) vehicleFuelValEl.textContent = '0';
    if (vehicleFuelFill)  vehicleFuelFill.style.width  = '0%';
    if (seatbeltIconEl) {
      seatbeltIconEl.classList.remove('on', 'off');
      seatbeltIconEl.textContent = '🔒';
    }
  }

  /* ─── ATC event subscriptions ────────────────────────────────── */
  ATC.on('ATC_HUD_TICK', function (payload) {
    if (payload.vitals)        updateVitalsBar(payload.vitals);
    if (payload.wallet)        updateWallet(payload.wallet);
    if (payload.job)           updateJob(payload.job);
    if (payload.statusEffects) updateStatusEffects(payload.statusEffects);
    if (typeof payload.inVehicle === 'boolean' && !payload.inVehicle) {
      onVehicleExited();
    } else if (payload.vehicle) {
      updateVehicleHud(payload.vehicle);
    }
    // Stress indicator (injected below armor bar)
    updateStressBar(typeof payload.stress === 'number' ? payload.stress : 0);
    // Reputation display
    if (payload.reputation !== undefined) updateReputation(payload.reputation);
  });

  ATC.on('ATC_VITALS_UPDATE', function (vitals) {
    updateVitalsBar(vitals);
  });

  ATC.on('ATC_WALLET_UPDATE', function (wallet) {
    updateWallet(wallet);
  });

  ATC.on('ATC_JOB_UPDATE', function (job) {
    updateJob(job);
  });

  ATC.on('ATC_VEHICLE_UPDATE', function (vehicle) {
    updateVehicleHud(vehicle);
  });

  ATC.on('ATC_VEHICLE_ENTERED', function () {
    onVehicleEntered();
  });

  ATC.on('ATC_VEHICLE_EXITED', function () {
    onVehicleExited();
  });

  ATC.on('ATC_SEATBELT_TOGGLE', function (payload) {
    if (!payload) return;
    if (seatbeltIconEl) {
      seatbeltIconEl.classList.remove('on', 'off');
      if (payload.seatbelt) {
        seatbeltIconEl.classList.add('on');
        seatbeltIconEl.textContent = '🔒';
      } else {
        seatbeltIconEl.classList.add('off');
        seatbeltIconEl.textContent = '⚠';
      }
    }
  });

  ATC.on('ATC_STATUS_UPDATE', function (effects) {
    updateStatusEffects(effects);
  });

  ATC.on('ATC_HUD_TOGGLE', function (data) {
    if (hudEl) {
      var visible = data.visible !== undefined ? data.visible : ATC.state.hudVisible;
      hudEl.style.opacity       = visible ? '1' : '0';
      hudEl.style.pointerEvents = visible ? '' : 'none';
    }
  });

  /* ═══════════════════════════════════════════════════════════════
     DEATH SCREEN — wired here as it is HUD-adjacent state
  ═══════════════════════════════════════════════════════════════ */
  var deathScreenEl  = document.getElementById('death-screen');
  var deathTimerEl   = document.getElementById('death-timer');
  var respawnBtn     = document.getElementById('btn-respawn');
  var _respawnTimer  = null;

  function showDeathScreen(respawnTimeout) {
    if (deathScreenEl) deathScreenEl.classList.remove('hidden');
    // Hide HUD behind the death overlay
    if (hudEl) hudEl.style.opacity = '0';

    if (respawnBtn) {
      respawnBtn.disabled = true;
      respawnBtn.style.opacity = '0.4';
    }

    if (typeof respawnTimeout === 'number' && respawnTimeout > 0) {
      startRespawnCountdown(respawnTimeout);
    } else {
      // No timeout — enable immediately
      enableRespawnButton();
    }
  }

  function hideDeathScreen() {
    if (deathScreenEl) deathScreenEl.classList.add('hidden');
    if (hudEl) hudEl.style.opacity = ATC.state.hudVisible ? '1' : '0';
    stopRespawnCountdown();
    if (respawnBtn) {
      respawnBtn.disabled = true;
      respawnBtn.style.opacity = '0.4';
    }
    if (deathTimerEl) deathTimerEl.textContent = '--';
  }

  function startRespawnCountdown(durationMs) {
    stopRespawnCountdown();
    var endTime = Date.now() + durationMs;

    function tick() {
      var remaining = endTime - Date.now();
      if (remaining <= 0) {
        if (deathTimerEl) deathTimerEl.textContent = '0s';
        enableRespawnButton();
        return;
      }
      if (deathTimerEl) {
        var secs = Math.ceil(remaining / 1000);
        deathTimerEl.textContent = secs + 's';
      }
      _respawnTimer = setTimeout(tick, 250);
    }
    tick();
  }

  function stopRespawnCountdown() {
    if (_respawnTimer) {
      clearTimeout(_respawnTimer);
      _respawnTimer = null;
    }
  }

  function enableRespawnButton() {
    if (respawnBtn) {
      respawnBtn.disabled = false;
      respawnBtn.style.opacity = '1';
    }
    if (deathTimerEl) deathTimerEl.textContent = '0s';
  }

  // Respawn button click
  if (respawnBtn) {
    respawnBtn.addEventListener('click', function () {
      if (respawnBtn.disabled) return;
      ATC.nuiCallback('atc:combat:respawn', {});
      respawnBtn.disabled = true;
      respawnBtn.style.opacity = '0.4';
      respawnBtn.textContent = ATC.t('death.respawning', 'Respawning...');
    });
  }

  ATC.on('ATC_PLAYER_DEAD', function (payload) {
    showDeathScreen(payload && payload.respawnTimeout ? payload.respawnTimeout : 0);
  });

  ATC.on('ATC_PLAYER_REVIVED', function () {
    hideDeathScreen();
  });

  ATC.on('ATC_RESPAWN_AVAILABLE', function () {
    enableRespawnButton();
  });

  /* ─── Stress bar ────────────────────────────────────────────── */
  // Lazy-create a stress bar element appended after the armor vital-track
  var stressBarEl = null;

  function ensureStressBar() {
    if (stressBarEl) return stressBarEl;
    var armorRow = document.getElementById('vital-armor');
    if (!armorRow) return null;
    var bar = document.createElement('div');
    bar.id = 'stress-bar';
    bar.className = 'stress-bar';
    bar.style.width = '0%';
    armorRow.appendChild(bar);
    stressBarEl = bar;
    return stressBarEl;
  }

  function updateStressBar(stress) {
    var pct = Math.max(0, Math.min(100, stress || 0));
    if (pct === 0) {
      if (stressBarEl) {
        stressBarEl.style.width = '0%';
        stressBarEl.classList.remove('high');
      }
      return;
    }
    var bar = ensureStressBar();
    if (!bar) return;
    bar.style.width = pct + '%';
    if (pct > 70) {
      bar.classList.add('high');
    } else {
      bar.classList.remove('high');
    }
  }

  /* ─── Voice indicator ────────────────────────────────────────── */
  ATC.on('ATC_VOICE_STATE', function (payload) {
    var el = document.getElementById('voice-indicator');
    if (!el || !payload) return;
    var active = payload.talking || payload.radioTalking;
    el.classList.toggle('hidden', !active);
    el.classList.toggle('talking', !!payload.talking && !payload.radioTalking);
    el.classList.toggle('radio',   !!payload.radioTalking);
    var lbl = document.getElementById('voice-label');
    if (lbl) lbl.textContent = payload.radioTalking ? (payload.channel || 'Radio') : 'Voice';
  });

  /* ─── Dispatch badge ─────────────────────────────────────────── */
  var _dispatchCount = 0;

  ATC.on('ATC_DISPATCH_CALL', function () {
    _dispatchCount++;
    var el = document.getElementById('dispatch-badge');
    if (!el) return;
    el.textContent = _dispatchCount;
    el.classList.remove('hidden');
    setTimeout(function () {
      _dispatchCount = Math.max(0, _dispatchCount - 1);
      el.textContent = _dispatchCount;
      if (_dispatchCount === 0) el.classList.add('hidden');
    }, 30000);
  });

  /* ─── Cinematic toggle ───────────────────────────────────────── */
  ATC.on('ATC_CINEMATIC_TOGGLE', function () {
    document.body.classList.toggle('cinematic');
  });

  /* ─── Reputation display ─────────────────────────────────────── */
  function updateReputation(payload) {
    var el = document.getElementById('reputation-display');
    if (!el) return;
    if (!payload || !payload.factionName) {
      el.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden');
    var name = document.getElementById('rep-faction-name');
    var bar  = document.getElementById('rep-bar');
    var lbl  = document.getElementById('rep-label');
    if (name) name.textContent = payload.factionName || '';
    if (bar)  bar.style.width  = Math.max(0, Math.min(100, payload.percent || 0)) + '%';
    if (lbl)  lbl.textContent  = payload.rankLabel || '';
  }

  ATC.on('ATC_REPUTATION_UPDATE', function (payload) {
    updateReputation(payload);
    // Keep level badge in sync with every reputation push
    if (payload) updateLevelBadge(payload);
  });

  /* ─── Level badge ────────────────────────────────────────── */
  var levelBadgeEl = document.getElementById('level-badge');
  var levelNumEl   = document.getElementById('level-num');
  var levelLblEl   = document.getElementById('level-label');

  function updateLevelBadge(p) {
    if (!levelBadgeEl) return;
    var hasLevel = p && p.level;
    levelBadgeEl.classList.toggle('hidden', !hasLevel);
    if (levelNumEl) levelNumEl.textContent = (p && p.level)     || 1;
    if (levelLblEl) levelLblEl.textContent = (p && p.rankLabel) || '';
  }

  /* ─── Level-up toast ─────────────────────────────────────── */
  var levelupToastEl  = document.getElementById('levelup-toast');
  var levelupNumEl    = document.getElementById('levelup-num');
  var _levelupTimeout = null;

  ATC.on('ATC_LEVELUP', function (payload) {
    if (!payload || !levelupToastEl) return;
    if (levelupNumEl) levelupNumEl.textContent = payload.level || '';
    levelupToastEl.classList.remove('hidden');
    clearTimeout(_levelupTimeout);
    _levelupTimeout = setTimeout(function () {
      levelupToastEl.classList.add('hidden');
    }, 4000);
  });

  /* ─── Register module ────────────────────────────────────────── */
  ATC.registerModule('hud', {
    init: function () {
      // Render initial state if available
      if (ATC.state.vitals) renderVitals(ATC.state.vitals);
      if (ATC.state.wallet) renderWallet(ATC.state.wallet);
      if (ATC.state.job)    renderJob(ATC.state.job);
      // Vehicle HUD starts hidden
      if (vehicleHudEl) vehicleHudEl.classList.add('hidden');
      // Death screen starts hidden
      if (deathScreenEl) deathScreenEl.classList.add('hidden');
      // New indicators start hidden
      var voiceEl = document.getElementById('voice-indicator');
      if (voiceEl) voiceEl.classList.add('hidden');
      var dispatchEl = document.getElementById('dispatch-badge');
      if (dispatchEl) dispatchEl.classList.add('hidden');
      var repEl = document.getElementById('reputation-display');
      if (repEl) repEl.classList.add('hidden');
    },
    updateVitalsBar:    updateVitalsBar,
    updateWallet:       updateWallet,
    updateJob:          updateJob,
    updateVehicleHud:   updateVehicleHud,
    updateStatusEffects:updateStatusEffects,
    updateStressBar:    updateStressBar,
    updateReputation:   updateReputation,
    showDeathScreen:    showDeathScreen,
    hideDeathScreen:    hideDeathScreen
  });

  console.info('[ATC HUD] hud.js loaded.');

}());
