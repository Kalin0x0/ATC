/**
 * ATC — Atlantic Core NUI
 * inventory.js — Inventory grid panel module
 *
 * Grid: 5 columns × 10 rows = 50 slots (indices 0–49)
 * Slot slot schema: { slotIndex, itemName, label, description, quantity, category, icon, metadata, onCooldown, cooldownRemainingMs }
 */

;(function () {
  'use strict';

  /* ─── Constants ──────────────────────────────────────────────── */
  var GRID_COLUMNS = 5;
  var GRID_ROWS    = 10;
  var TOTAL_SLOTS  = GRID_COLUMNS * GRID_ROWS; // 50

  var CATEGORY_COLORS = {
    weapon:  '#e05252',
    food:    '#52c052',
    medical: '#5288e0',
    misc:    '#8888aa'
  };

  var CATEGORY_BG = {
    weapon:  'rgba(224, 82,  82,  0.2)',
    food:    'rgba(82,  192, 82,  0.2)',
    medical: 'rgba(82,  136, 224, 0.2)',
    misc:    'rgba(136, 136, 170, 0.2)'
  };

  var CATEGORY_ICONS = {
    weapon:  '🔫',
    food:    '🍖',
    medical: '💊',
    misc:    '📦'
  };

  /* ─── DOM references ─────────────────────────────────────────── */
  var panelEl       = document.getElementById('inventory-panel');
  var gridEl        = document.getElementById('inventory-grid');
  var closeBtn      = document.getElementById('inventory-close');
  var detailPanel   = document.getElementById('item-detail-panel');
  var detailIcon    = document.getElementById('item-detail-icon');
  var detailName    = document.getElementById('item-detail-name');
  var detailDesc    = document.getElementById('item-detail-description');
  var detailMeta    = document.getElementById('item-detail-meta');
  var useBtn        = document.getElementById('item-use-btn');

  /* ─── Module state ───────────────────────────────────────────── */
  var _slots           = [];      // sparse array, index = slotIndex
  var _selectedSlot    = null;    // currently selected slotIndex
  var _cooldownTimers  = {};      // slotIndex → intervalId
  var _slotElements    = [];      // DOM element per slot (length = TOTAL_SLOTS)

  /* ─── Show / Hide ────────────────────────────────────────────── */
  function showPanel() {
    if (!panelEl) return;
    panelEl.classList.remove('hidden');
    // Ensure NUI focus — Lua handles the actual focus lock; we just display
  }

  function hidePanel() {
    if (!panelEl) return;
    panelEl.classList.add('hidden');
    clearDetailPanel();
    _selectedSlot = null;
    // Deselect all slots
    _slotElements.forEach(function (el) {
      if (el) el.classList.remove('selected');
    });
  }

  /* ─── Grid initialisation ────────────────────────────────────── */
  function initGrid() {
    if (!gridEl) return;
    gridEl.innerHTML = '';
    _slotElements = [];

    for (var i = 0; i < TOTAL_SLOTS; i++) {
      var slot = buildEmptySlotEl(i);
      gridEl.appendChild(slot);
      _slotElements.push(slot);
    }
  }

  function buildEmptySlotEl(index) {
    var el = document.createElement('div');
    el.className = 'inventory-slot empty-slot';
    el.dataset.slotIndex = index;
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', 'Empty slot ' + (index + 1));

    // ── Drag source ──────────────────────────────────────────
    el.setAttribute('draggable', 'true');
    el.addEventListener('dragstart', function (e) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
      el.classList.add('dragging');
    });
    el.addEventListener('dragend', function () {
      el.classList.remove('dragging');
    });

    // ── Drop target ───────────────────────────────────────────
    el.addEventListener('dragover', function (e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      el.classList.add('drag-over');
    });
    el.addEventListener('dragleave', function () {
      el.classList.remove('drag-over');
    });
    el.addEventListener('drop', function (e) {
      e.preventDefault();
      el.classList.remove('drag-over');
      var fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
      if (isNaN(fromIndex) || fromIndex === index) return;
      ATC.nuiCallback('atc:inventory:move', { from: fromIndex, to: index });
    });

    // Single click — select & show detail
    el.addEventListener('click', function () {
      onSlotClick(index);
    });

    // Double click — use item
    el.addEventListener('dblclick', function (e) {
      e.preventDefault();
      onSlotDoubleClick(index);
    });

    // Keyboard: Enter = select, Space = use
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') onSlotClick(index);
      if (e.key === ' ')     { e.preventDefault(); onSlotDoubleClick(index); }
    });

    return el;
  }

  /* ─── Inventory render ───────────────────────────────────────── */
  /**
   * @param {Array} slots  Array of slot objects (may be sparse)
   */
  function renderInventory(slots) {
    // Build a sparse lookup by slotIndex
    var lookup = {};
    if (Array.isArray(slots)) {
      slots.forEach(function (slot) {
        if (slot && typeof slot.slotIndex === 'number') {
          lookup[slot.slotIndex] = slot;
        }
      });
    }
    _slots = lookup;

    for (var i = 0; i < TOTAL_SLOTS; i++) {
      var item = lookup[i];
      var el   = _slotElements[i];
      if (!el) continue;

      if (item) {
        populateSlot(el, item, i);
      } else {
        clearSlot(el, i);
      }
    }

    // Refresh detail panel if the selected slot changed
    if (_selectedSlot !== null) {
      var selected = _slots[_selectedSlot];
      if (selected) {
        showDetailPanel(selected);
      } else {
        clearDetailPanel();
        _selectedSlot = null;
      }
    }
  }

  function populateSlot(el, item, index) {
    el.classList.remove('empty-slot');
    el.innerHTML = '';

    var category = (item.category || 'misc').toLowerCase();
    var color    = CATEGORY_COLORS[category] || CATEGORY_COLORS.misc;
    var bg       = CATEGORY_BG[category]     || CATEGORY_BG.misc;
    var emoji    = item.icon || CATEGORY_ICONS[category] || '📦';

    // Icon container
    var iconEl = document.createElement('div');
    iconEl.className = 'slot-item-icon category-' + category;
    iconEl.style.background = bg;
    iconEl.style.color      = color;
    iconEl.textContent      = emoji;

    // Quantity badge
    var qty = item.quantity || 1;
    if (qty > 1) {
      var qtyEl = document.createElement('span');
      qtyEl.className   = 'slot-quantity';
      qtyEl.textContent = qty > 999 ? '999+' : qty;
      el.appendChild(qtyEl);
    }

    el.appendChild(iconEl);
    el.setAttribute('aria-label', (item.label || item.itemName || 'Item') + ', quantity ' + qty);

    // Cooldown overlay
    if (item.onCooldown && item.cooldownRemainingMs > 0) {
      startCooldownTimer(el, index, item.cooldownRemainingMs);
    } else {
      clearCooldownOverlay(el, index);
    }
  }

  function clearSlot(el, index) {
    el.classList.add('empty-slot');
    el.innerHTML = '';
    el.setAttribute('aria-label', 'Empty slot ' + (index + 1));
    clearCooldownOverlay(el, index);
  }

  /* ─── Cooldown timers ────────────────────────────────────────── */
  function startCooldownTimer(el, index, remainingMs) {
    // Clear existing timer
    clearCooldownOverlay(el, index);

    var endTime = Date.now() + remainingMs;
    el.classList.add('on-cooldown');

    var overlayEl = document.createElement('div');
    overlayEl.className = 'slot-cooldown-overlay';

    function tick() {
      var left = endTime - Date.now();
      if (left <= 0) {
        clearCooldownOverlay(el, index);
        return;
      }
      overlayEl.textContent = (left / 1000).toFixed(1) + 's';
      _cooldownTimers[index] = setTimeout(tick, 100);
    }

    el.appendChild(overlayEl);
    tick();
  }

  function clearCooldownOverlay(el, index) {
    el.classList.remove('on-cooldown');
    var overlay = el.querySelector('.slot-cooldown-overlay');
    if (overlay) overlay.remove();
    if (_cooldownTimers[index]) {
      clearTimeout(_cooldownTimers[index]);
      delete _cooldownTimers[index];
    }
  }

  /* ─── Slot interaction ───────────────────────────────────────── */
  function onSlotClick(index) {
    var item = _slots[index];

    // Deselect previous
    if (_selectedSlot !== null && _slotElements[_selectedSlot]) {
      _slotElements[_selectedSlot].classList.remove('selected');
    }

    if (_selectedSlot === index) {
      // Clicking same slot deselects
      _selectedSlot = null;
      clearDetailPanel();
      return;
    }

    _selectedSlot = index;
    if (_slotElements[index]) {
      _slotElements[index].classList.add('selected');
    }

    if (item) {
      showDetailPanel(item);
    } else {
      clearDetailPanel();
    }
  }

  function onSlotDoubleClick(index) {
    var item = _slots[index];
    if (!item) return;
    if (item.onCooldown) return; // Cannot use during cooldown

    ATC.nuiCallback('atc:inventory:use', { slotIndex: index });
  }

  /* ─── Item detail panel ──────────────────────────────────────── */
  function showDetailPanel(item) {
    if (!detailPanel) return;
    detailPanel.classList.remove('hidden');

    var category = (item.category || 'misc').toLowerCase();
    var color    = CATEGORY_COLORS[category] || CATEGORY_COLORS.misc;
    var bg       = CATEGORY_BG[category]     || CATEGORY_BG.misc;
    var emoji    = item.icon || CATEGORY_ICONS[category] || '📦';

    if (detailIcon) {
      detailIcon.textContent = emoji;
      detailIcon.style.background = bg;
      detailIcon.style.color      = color;
    }

    if (detailName) {
      detailName.textContent = item.label || item.itemName || '';
    }

    if (detailDesc) {
      detailDesc.textContent = item.description || ATC.t('inventory.noDescription', 'No description available.');
    }

    if (detailMeta) {
      detailMeta.innerHTML = '';
      var tags = [];
      if (item.quantity)  tags.push('x' + item.quantity);
      if (item.category)  tags.push(item.category);
      if (item.weight !== undefined) tags.push(item.weight + 'kg');

      // Extra metadata key-value pairs
      if (item.metadata && typeof item.metadata === 'object') {
        Object.keys(item.metadata).forEach(function (k) {
          var v = item.metadata[k];
          if (v !== null && v !== undefined) {
            tags.push(k + ': ' + v);
          }
        });
      }

      tags.forEach(function (tag) {
        var span = document.createElement('span');
        span.className = 'meta-tag';
        span.textContent = tag;
        detailMeta.appendChild(span);
      });
    }

    if (useBtn) {
      useBtn.disabled = !!(item.onCooldown);
      useBtn.onclick = function () {
        if (item.onCooldown) return;
        ATC.nuiCallback('atc:inventory:use', { slotIndex: item.slotIndex });
      };
    }
  }

  function clearDetailPanel() {
    if (!detailPanel) return;
    detailPanel.classList.add('hidden');
    if (detailIcon) { detailIcon.textContent = ''; detailIcon.style.background = ''; }
    if (detailName) detailName.textContent = '';
    if (detailDesc) detailDesc.textContent = '';
    if (detailMeta) detailMeta.innerHTML   = '';
    if (useBtn)     useBtn.onclick = null;
  }

  /* ─── Close button ───────────────────────────────────────────── */
  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      ATC.nuiCallback('atc:inventory:close', {});
      hidePanel();
    });
  }

  /* ─── ATC event subscriptions ────────────────────────────────── */
  ATC.on('ATC_INVENTORY_OPEN', function () {
    renderInventory(_slots);  // Re-render with current state
    showPanel();
  });

  ATC.on('ATC_INVENTORY_CLOSE', function () {
    hidePanel();
  });

  ATC.on('ATC_INVENTORY_UPDATE', function (slots) {
    renderInventory(slots);
  });

  ATC.on('ATC_ITEM_USED', function (payload) {
    // Visual feedback for item usage (brief highlight)
    var idx = payload.slotIndex;
    var el  = _slotElements[idx];
    if (!el) return;
    el.style.borderColor = 'var(--gold)';
    setTimeout(function () { el.style.borderColor = ''; }, 400);
  });

  ATC.on('ATC_ITEM_COOLDOWN', function (payload) {
    var idx = payload.slotIndex;
    var el  = _slotElements[idx];
    if (!el) return;

    // Mark the slot item as on-cooldown
    var item = _slots[idx];
    if (item) {
      item.onCooldown = true;
      item.cooldownRemainingMs = payload.remainingMs;
    }

    startCooldownTimer(el, idx, payload.remainingMs);

    // Update detail panel if this slot is selected
    if (_selectedSlot === idx && item) {
      if (useBtn) useBtn.disabled = true;
    }
  });

  ATC.on('ATC_ITEM_BROKEN', function (payload) {
    var idx = payload.slotIndex;
    var el  = _slotElements[idx];
    if (!el) return;
    // Brief red flash
    el.style.borderColor = 'var(--danger)';
    el.style.boxShadow   = '0 0 12px rgba(224, 82, 82, 0.7)';
    setTimeout(function () {
      el.style.borderColor = '';
      el.style.boxShadow   = '';
    }, 800);
  });

  /* ─── Register module ────────────────────────────────────────── */
  ATC.registerModule('inventory', {
    init: function () {
      initGrid();
      hidePanel();
    },
    show:             showPanel,
    hide:             hidePanel,
    renderInventory:  renderInventory
  });

  console.info('[ATC Inventory] inventory.js loaded.');

}());

/* ============================================================
   HOTBAR MODULE
   ============================================================ */
;(function () {
  'use strict';

  function renderHotbar(slots, selected) {
    var container = document.getElementById('hotbar-slots');
    if (!container) return;
    container.innerHTML = '';
    for (var i = 1; i <= 5; i++) {
      var slot = slots[i];
      var el = document.createElement('div');
      el.className = 'hotbar-slot' + (i === selected ? ' selected' : '');
      el.innerHTML =
        '<span class="slot-key">' + i + '</span>' +
        (slot
          ? '<span class="slot-name">' + (slot.itemName || '') + '</span>' +
            '<span class="slot-qty">' + (slot.quantity || '') + '</span>'
          : '');
      container.appendChild(el);
    }
    var hotbarEl = document.getElementById('hotbar');
    if (hotbarEl) {
      var hasItems = slots && Object.keys(slots).some(function (k) { return slots[k]; });
      hotbarEl.classList.toggle('hidden', !hasItems);
    }
  }

  ATC.on('ATC_HOTBAR_UPDATE', function (p) {
    if (p) renderHotbar(p.slots || {}, p.selected || 1);
  });

  ATC.on('ATC_HOTBAR_SELECT', function (p) {
    if (!p) return;
    document.querySelectorAll('.hotbar-slot').forEach(function (el, i) {
      el.classList.toggle('selected', i + 1 === p.selected);
    });
  });

  // Show hotbar when a character is selected / spawned
  ATC.on('ATC_CHARACTER_SELECTED', function () {
    var hotbarEl = document.getElementById('hotbar');
    if (hotbarEl) hotbarEl.classList.remove('hidden');
  });

  console.info('[ATC Hotbar] hotbar module loaded.');
}());

/* ============================================================
   CRAFTING MODULE
   ============================================================ */
;(function () {
  'use strict';

  function _escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  ATC.on('ATC_CRAFTING_OPEN', function (p) {
    var panel = document.getElementById('crafting-panel');
    var list  = document.getElementById('crafting-recipes');
    if (!panel || !list) return;
    var recipes = (p && p.recipes) ? p.recipes : [];
    list.innerHTML = recipes.map(function (r) {
      var ingredients = (r.ingredients || []).map(function (i) {
        return i.qty + 'x ' + _escHtml(i.name);
      }).join(', ');
      return (
        '<div class="recipe-card">' +
          '<h4>' + _escHtml(r.name) + '</h4>' +
          '<div class="recipe-ingredients">' + ingredients + '</div>' +
          '<button class="recipe-craft-btn" onclick="ATC.nuiCallback(\'atc:crafting:craft\',{recipeId:\'' + _escHtml(r.id) + '\'})">Craft</button>' +
        '</div>'
      );
    }).join('');
    ATC.Windows.open('crafting-panel');
  });

  ATC.on('ATC_CRAFTING_RESULT', function (p) {
    var r = document.getElementById('crafting-result');
    if (!r) return;
    r.textContent = (p && p.success) ? 'Crafted: ' + ((p.resultItem) || '') : 'Not enough materials';
    r.className   = (p && p.success) ? 'crafting-success' : 'crafting-fail';
    r.classList.remove('hidden');
    setTimeout(function () { r.classList.add('hidden'); }, 3000);
  });

  console.info('[ATC Crafting] crafting module loaded.');
}());
