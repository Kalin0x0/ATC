/**
 * ATC — Atlantic Core NUI
 * character-select.js — Character selection screen module
 *
 * Shows when: ATC_CHARACTER_SELECT_SHOW arrives, or ATC_CORE_READY fires
 * and no characterId is set in state.
 *
 * Hides when: ATC_CHARACTER_SELECTED arrives successfully.
 */

;(function () {
  'use strict';

  /* ─── DOM references ─────────────────────────────────────────── */
  var screenEl       = document.getElementById('character-select');
  var characterList  = document.getElementById('character-list');
  var emptyState     = document.getElementById('character-list-empty');
  var errorEl        = document.getElementById('character-select-error');
  var createBtn      = document.getElementById('btn-create-character');

  /* ─── Module state ───────────────────────────────────────────── */
  var _characters   = [];
  var _selectedId   = null;
  var _buttonsLocked = false;

  /* ─── Helpers ────────────────────────────────────────────────── */
  function showScreen() {
    if (!screenEl) return;
    screenEl.classList.remove('hidden');
    // NUI focus is managed by Lua; just show the overlay
  }

  function hideScreen() {
    if (!screenEl) return;
    screenEl.classList.add('hidden');
  }

  function showError(msg) {
    if (!errorEl) return;
    errorEl.textContent = msg || ATC.t('charselect.error', 'Failed to select character. Please try again.');
    errorEl.classList.remove('hidden');
    // Auto-hide after 4 s
    setTimeout(function () {
      errorEl.classList.add('hidden');
    }, 4000);
  }

  function hideError() {
    if (errorEl) errorEl.classList.add('hidden');
  }

  function lockButtons(lock) {
    _buttonsLocked = lock;
    if (!characterList) return;
    var buttons = characterList.querySelectorAll('.btn');
    buttons.forEach(function (btn) {
      btn.disabled = lock;
    });
    if (createBtn) createBtn.disabled = lock;
  }

  /* ─── Render character list ──────────────────────────────────── */
  /**
   * @param {Array} characters  Array of { characterId, firstName, lastName, level, job, lastPlayed }
   */
  function renderCharacterList(characters) {
    if (!characterList) return;

    _characters = Array.isArray(characters) ? characters : [];
    _selectedId = null;

    // Clear existing cards (but not the empty-state placeholder)
    var existing = characterList.querySelectorAll('.character-card');
    existing.forEach(function (el) { el.remove(); });

    if (_characters.length === 0) {
      if (emptyState) emptyState.style.display = '';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    _characters.forEach(function (char) {
      var card = buildCharacterCard(char);
      characterList.appendChild(card);
    });
  }

  function buildCharacterCard(char) {
    var card = document.createElement('div');
    card.className = 'character-card';
    card.dataset.id = char.characterId;

    // Avatar
    var avatarEl = document.createElement('div');
    avatarEl.className = 'char-avatar';
    avatarEl.textContent = getAvatarEmoji(char);

    // Info
    var infoEl = document.createElement('div');
    infoEl.className = 'char-info';

    var nameEl = document.createElement('div');
    nameEl.className = 'char-name';
    nameEl.textContent = (char.firstName || '') + ' ' + (char.lastName || '');

    var metaEl = document.createElement('div');
    metaEl.className = 'char-meta';

    var levelEl = document.createElement('span');
    levelEl.className = 'char-level';
    levelEl.textContent = 'Lv ' + (char.level || 1);

    metaEl.appendChild(levelEl);

    if (char.job) {
      var jobEl = document.createElement('span');
      jobEl.textContent = char.job;
      metaEl.appendChild(jobEl);
    }

    if (char.lastPlayed) {
      var lastEl = document.createElement('span');
      lastEl.textContent = formatLastPlayed(char.lastPlayed);
      metaEl.appendChild(lastEl);
    }

    infoEl.appendChild(nameEl);
    infoEl.appendChild(metaEl);

    // Actions
    var actionsEl = document.createElement('div');
    actionsEl.className = 'char-actions';

    var selectBtn = document.createElement('button');
    selectBtn.className = 'btn btn-primary';
    selectBtn.textContent = ATC.t('charselect.selectButton', 'Play');
    selectBtn.setAttribute('data-char-id', char.characterId);
    selectBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      onSelectCharacter(char.characterId);
    });

    actionsEl.appendChild(selectBtn);

    card.appendChild(avatarEl);
    card.appendChild(infoEl);
    card.appendChild(actionsEl);

    // Click card to highlight selection
    card.addEventListener('click', function () {
      selectCardHighlight(char.characterId);
    });

    return card;
  }

  function selectCardHighlight(characterId) {
    if (!characterList) return;
    _selectedId = characterId;
    var cards = characterList.querySelectorAll('.character-card');
    cards.forEach(function (c) {
      if (c.dataset.id === String(characterId)) {
        c.classList.add('selected');
      } else {
        c.classList.remove('selected');
      }
    });
  }

  /* ─── Character selection logic ──────────────────────────────── */
  function onSelectCharacter(characterId) {
    if (_buttonsLocked) return;
    hideError();
    lockButtons(true);
    selectCardHighlight(characterId);

    // Show loading state on the button
    var btn = characterList
      ? characterList.querySelector('[data-char-id="' + characterId + '"]')
      : null;
    if (btn) {
      btn.textContent = ATC.t('charselect.loading', '...');
    }

    ATC.nuiCallback('atc:character:select', { characterId: characterId });
  }

  /* ─── Event handlers ─────────────────────────────────────────── */
  ATC.on('ATC_CORE_READY', function () {
    // If no character is active, show the selection screen
    // (Lua may send ATC_CHARACTER_SELECT_SHOW separately; this is a fallback)
    if (!ATC.state.characterId) {
      showScreen();
    }
  });

  ATC.on('ATC_CHARACTER_SELECT_SHOW', function (payload) {
    // Payload may contain characters array
    if (payload && Array.isArray(payload.characters)) {
      renderCharacterList(payload.characters);
    } else if (payload && Array.isArray(payload.slots)) {
      renderCharacterList(payload.slots);
    }
    showScreen();
    lockButtons(false);
    hideError();
  });

  ATC.on('ATC_CHARACTER_SELECTED', function (payload) {
    hideScreen();
    hideError();
    lockButtons(false);
    ATC.state.characterId = payload.characterId || null;
  });

  ATC.on('ATC_CHARACTER_SELECT_FAILED', function () {
    lockButtons(false);
    showError();

    // Restore button labels
    if (characterList) {
      var buttons = characterList.querySelectorAll('.btn-primary');
      buttons.forEach(function (btn) {
        btn.textContent = ATC.t('charselect.selectButton', 'Play');
        btn.disabled = false;
      });
    }
  });

  /* ─── Create character button ────────────────────────────────── */
  if (createBtn) {
    createBtn.addEventListener('click', function () {
      if (_buttonsLocked) return;
      ATC.nuiCallback('atc:character:create', {});
    });
  }

  /* ─── Utility ────────────────────────────────────────────────── */
  function getAvatarEmoji(char) {
    // Simple deterministic avatar based on characterId hash
    var emojis = ['👤', '🧑', '👩', '🧔', '👨', '🧕', '👱', '🧓'];
    var id = char.characterId || 0;
    var idx = typeof id === 'number' ? id % emojis.length
      : (String(id).charCodeAt(0) || 0) % emojis.length;
    return emojis[Math.abs(idx)];
  }

  function formatLastPlayed(ts) {
    if (!ts) return '';
    try {
      var d = new Date(ts);
      if (isNaN(d.getTime())) return '';
      var now  = Date.now();
      var diff = now - d.getTime();
      var mins = Math.floor(diff / 60000);
      if (mins < 1)   return 'Just now';
      if (mins < 60)  return mins + 'm ago';
      var hrs = Math.floor(mins / 60);
      if (hrs < 24)   return hrs + 'h ago';
      var days = Math.floor(hrs / 24);
      return days + 'd ago';
    } catch (e) {
      return '';
    }
  }

  /* ─── Register module ────────────────────────────────────────── */
  ATC.registerModule('characterSelect', {
    init: function () {
      // Start hidden; Lua will send the show event when appropriate
      hideScreen();
    },
    show:                showScreen,
    hide:                hideScreen,
    renderCharacterList: renderCharacterList
  });

  console.info('[ATC CharacterSelect] character-select.js loaded.');

}());
