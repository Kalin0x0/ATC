/**
 * ATC Marketplace NUI — marketplace.js
 * Handles all ATC_MARKETPLACE_* messages and user interactions.
 * XSS-safe: all dynamic content uses textContent or _esc().
 */

;(function (window) {
  'use strict';

  /* ── XSS-safe helper ───────────────────────────────────────── */
  function _esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── NUI → Lua callback ────────────────────────────────────── */
  function nuiCallback(name, data) {
    return fetch('https://atc-marketplace/' + name, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data || {}),
    }).catch(function (err) {
      console.warn('[Marketplace] nuiCallback error:', name, err);
    });
  }

  /* ── State ──────────────────────────────────────────────────── */
  var _allListings   = [];
  var _activeCategory = 'all';
  var _searchQuery    = '';
  var _balance        = 0;

  var CATEGORIES = ['All', 'Weapons', 'Food', 'Medical', 'Misc'];

  /* ── DOM refs ───────────────────────────────────────────────── */
  var _overlay        = document.getElementById('mp-overlay');
  var _grid           = document.getElementById('mp-grid');
  var _empty          = document.getElementById('mp-empty');
  var _searchInput    = document.getElementById('mp-search');
  var _balanceEl      = document.getElementById('mp-balance-amount');
  var _countEl        = document.getElementById('mp-listing-count');
  var _modalOverlay   = document.getElementById('mp-modal-overlay');
  var _modalError     = document.getElementById('mp-modal-error');
  var _inItemName     = document.getElementById('mp-in-name');
  var _inQty          = document.getElementById('mp-in-qty');
  var _inPrice        = document.getElementById('mp-in-price');

  /* ── Category tabs ──────────────────────────────────────────── */
  function _buildCategoryTabs() {
    var container = document.getElementById('mp-categories');
    if (!container) return;
    container.innerHTML = '';
    CATEGORIES.forEach(function (cat) {
      var btn = document.createElement('button');
      btn.className = 'mp-cat-tab' + (cat.toLowerCase() === _activeCategory ? ' active' : '');
      btn.textContent = cat;
      btn.addEventListener('click', function () {
        _activeCategory = cat.toLowerCase();
        container.querySelectorAll('.mp-cat-tab').forEach(function (b) {
          b.classList.toggle('active', b.textContent.toLowerCase() === _activeCategory);
        });
        _renderListings();
      });
      container.appendChild(btn);
    });
  }

  /* ── Filter logic ───────────────────────────────────────────── */
  function _filtered() {
    return _allListings.filter(function (l) {
      var matchCat = _activeCategory === 'all' ||
        (l.category || 'misc').toLowerCase() === _activeCategory;
      var matchQ   = !_searchQuery ||
        (l.itemName || '').toLowerCase().includes(_searchQuery);
      return matchCat && matchQ;
    });
  }

  /* ── Render listing grid ────────────────────────────────────── */
  function _renderListings() {
    var list = _filtered();
    _grid.innerHTML = '';

    if (list.length === 0) {
      _empty.classList.add('visible');
      _grid.style.display = 'none';
    } else {
      _empty.classList.remove('visible');
      _grid.style.display = '';

      list.forEach(function (listing) {
        var card = document.createElement('div');
        card.className = 'mp-card';

        var nameEl = document.createElement('div');
        nameEl.className = 'mp-card-name';
        nameEl.textContent = listing.itemName || 'Unknown Item';

        var metaEl = document.createElement('div');
        metaEl.className = 'mp-card-meta';

        var qtyEl = document.createElement('span');
        qtyEl.className = 'mp-card-qty';
        qtyEl.textContent = 'x' + (listing.quantity || 1);

        var catEl = document.createElement('span');
        catEl.textContent = listing.category || 'Misc';

        metaEl.appendChild(qtyEl);
        metaEl.appendChild(catEl);

        var sellerEl = document.createElement('div');
        sellerEl.className = 'mp-card-seller';
        sellerEl.textContent = 'Seller: ' + (listing.sellerName || listing.sellerPrincipalId || 'Unknown');

        var footer = document.createElement('div');
        footer.className = 'mp-card-footer';

        var priceEl = document.createElement('span');
        priceEl.className = 'mp-card-price';
        priceEl.textContent = '$' + Number(listing.price || 0).toLocaleString();

        var buyBtn = document.createElement('button');
        buyBtn.className = 'mp-btn-buy';
        buyBtn.textContent = 'Buy';
        buyBtn.dataset.listingId = listing.id || listing.listingId || '';
        buyBtn.addEventListener('click', function () {
          _onBuy(listing.id || listing.listingId || '');
        });

        footer.appendChild(priceEl);
        footer.appendChild(buyBtn);

        card.appendChild(nameEl);
        card.appendChild(metaEl);
        card.appendChild(sellerEl);
        card.appendChild(footer);

        _grid.appendChild(card);
      });
    }

    if (_countEl) {
      _countEl.textContent = list.length + ' listing' + (list.length !== 1 ? 's' : '');
    }
  }

  /* ── Buy handler ────────────────────────────────────────────── */
  function _onBuy(listingId) {
    if (!listingId) return;
    nuiCallback('atc:marketplace:buy', { listingId: listingId });
  }

  /* ── List-item modal ────────────────────────────────────────── */
  function _openModal() {
    if (_inItemName) _inItemName.value = '';
    if (_inQty)      _inQty.value      = '1';
    if (_inPrice)    _inPrice.value    = '';
    if (_modalError) _modalError.textContent = '';
    if (_modalOverlay) _modalOverlay.classList.add('open');
  }

  function _closeModal() {
    if (_modalOverlay) _modalOverlay.classList.remove('open');
  }

  function _submitListing() {
    var itemName = (_inItemName && _inItemName.value.trim()) || '';
    var qty      = parseInt(_inQty  && _inQty.value)   || 0;
    var price    = parseFloat(_inPrice && _inPrice.value) || 0;

    if (!itemName) {
      if (_modalError) _modalError.textContent = 'Item name is required.';
      return;
    }
    if (qty < 1 || qty > 99) {
      if (_modalError) _modalError.textContent = 'Quantity must be 1–99.';
      return;
    }
    if (price <= 0 || price > 1000000) {
      if (_modalError) _modalError.textContent = 'Price must be 1–1,000,000.';
      return;
    }

    nuiCallback('atc:marketplace:listing:create', {
      itemName: itemName,
      quantity: qty,
      price:    price,
    });
    _closeModal();
  }

  /* ── NUI message router ─────────────────────────────────────── */
  window.addEventListener('message', function (event) {
    var msg     = event.data;
    var type    = msg && msg.type;
    var payload = (msg && msg.payload !== undefined) ? msg.payload : msg;

    if (type === 'ATC_MARKETPLACE_OPEN') {
      _overlay && _overlay.classList.add('open');
    }

    else if (type === 'ATC_MARKETPLACE_CLOSE') {
      _overlay && _overlay.classList.remove('open');
      _closeModal();
    }

    else if (type === 'ATC_MARKETPLACE_DATA') {
      _allListings = (payload && Array.isArray(payload.listings)) ? payload.listings : [];
      _renderListings();
    }

    else if (type === 'ATC_MARKETPLACE_LISTED') {
      if (payload && payload.success) {
        // Listings will be refreshed by server-triggered re-fetch
      } else {
        if (_modalError) _modalError.textContent = 'Failed to create listing.';
        _openModal();
      }
    }

    else if (type === 'ATC_WALLET_UPDATE' || type === 'ATC_HUD_TICK') {
      var wallet = (type === 'ATC_HUD_TICK') ? (payload && payload.wallet) : payload;
      if (wallet && wallet.cash !== undefined) {
        _balance = wallet.cash;
        if (_balanceEl) _balanceEl.textContent = '$' + Number(_balance).toLocaleString();
      }
    }
  });

  /* ── Wire up static controls ────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    _buildCategoryTabs();

    var btnClose = document.getElementById('mp-btn-close');
    if (btnClose) {
      btnClose.addEventListener('click', function () {
        nuiCallback('atc:marketplace:close', {});
      });
    }

    var btnList = document.getElementById('mp-btn-list');
    if (btnList) {
      btnList.addEventListener('click', _openModal);
    }

    var btnConfirm = document.getElementById('mp-btn-confirm');
    if (btnConfirm) {
      btnConfirm.addEventListener('click', _submitListing);
    }

    var btnCancel = document.getElementById('mp-btn-cancel');
    if (btnCancel) {
      btnCancel.addEventListener('click', _closeModal);
    }

    if (_searchInput) {
      _searchInput.addEventListener('input', function () {
        _searchQuery = _searchInput.value.trim().toLowerCase();
        _renderListings();
      });
    }

    // ESC closes marketplace
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (_modalOverlay && _modalOverlay.classList.contains('open')) {
          _closeModal();
        } else if (_overlay && _overlay.classList.contains('open')) {
          nuiCallback('atc:marketplace:close', {});
        }
      }
    });

    _renderListings();
  });

  console.info('[ATC Marketplace] marketplace.js loaded.');

}(window));
