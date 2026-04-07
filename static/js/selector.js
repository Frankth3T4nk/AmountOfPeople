/**
 * selector.js
 *
 * Custom searchable country selector with glass UI.
 * Calls onSelect(countryObject | null) when selection changes.
 * null = "This Planet" (world total).
 */

import { fetchCountries } from './countries.js';

/* ── Sentinel for "This Planet" ─────────────────────────── */
const PLANET = {
  code: null,
  name: 'This Planet',
  flag: '🌍',
  lat:   0,
  lng:   0,
};

/* ── Module state ───────────────────────────────────────── */
let _countries = [];
let _active    = null;   // null → This Planet, otherwise a country object
let _isOpen    = false;
let _onSelect  = null;

/* ── DOM refs (populated after build) ───────────────────── */
let _wrapper, _trigger, _dropdown, _searchInput, _list;

/* ══════════════════════════════════════════════════════════
   initSelector — public entry point
   ══════════════════════════════════════════════════════════ */
export async function initSelector(onSelect) {
  _wrapper  = document.getElementById('country-selector');
  _onSelect = onSelect;
  if (!_wrapper) return;

  /* Render a skeleton trigger immediately while countries load */
  _wrapper.innerHTML = _triggerHTML(PLANET);

  try {
    _countries = await fetchCountries();
  } catch (err) {
    console.warn('[selector] fetchCountries failed:', err);
    _countries = [];
  }

  _build();
}

/* ══════════════════════════════════════════════════════════
   _build — construct full component HTML + wire events
   ══════════════════════════════════════════════════════════ */
function _build() {
  _wrapper.innerHTML = `
    ${_triggerHTML(PLANET)}

    <div class="sel-dropdown" id="sel-dropdown" hidden role="listbox"
         aria-label="Select a country or This Planet">

      <!-- Search row -->
      <div class="sel-search-row">
        <svg class="sel-search-icon" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="11" cy="11" r="8"/>
          <path stroke-linecap="round" d="m21 21-4.35-4.35"/>
        </svg>
        <input class="sel-search" id="sel-search" type="text"
               placeholder="Search country…"
               autocomplete="off" autocorrect="off" autocapitalize="off"
               spellcheck="false" aria-label="Search countries" />
      </div>

      <!-- Options list -->
      <ul class="sel-list" id="sel-list"></ul>
    </div>`;

  _trigger     = _wrapper.querySelector('.sel-trigger');
  _dropdown    = _wrapper.querySelector('#sel-dropdown');
  _searchInput = _wrapper.querySelector('#sel-search');
  _list        = _wrapper.querySelector('#sel-list');

  /* Render initial list (full, no filter) */
  _renderList('');

  /* ── Event wiring ─────────────────────────────────────── */
  _trigger.addEventListener('click', e => {
    e.stopPropagation();
    _isOpen ? _close() : _open();
  });

  _searchInput.addEventListener('input', () => {
    _renderList(_searchInput.value);
  });

  _list.addEventListener('click', e => {
    const item = e.target.closest('.sel-item');
    if (item) _select(item.dataset.code);
  });

  /* Close on outside click */
  document.addEventListener('click', e => {
    if (!_wrapper.contains(e.target)) _close();
  });

  /* Escape to close */
  _searchInput.addEventListener('keydown', e => {
    if (e.key === 'Escape') _close();
  });
}

/* ── Render helpers ─────────────────────────────────────── */
function _triggerHTML(opt) {
  return `
    <button class="sel-trigger" type="button"
            aria-haspopup="listbox" aria-expanded="false">
      <span class="sel-flag" aria-hidden="true">${opt.flag}</span>
      <span class="sel-name">${_esc(opt.name)}</span>
      <svg class="sel-chevron" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2.5" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6"/>
      </svg>
    </button>`;
}

function _renderList(query) {
  const q = query.trim().toLowerCase();

  let html = '';

  /* "This Planet" — always first */
  if (!q || 'this planet'.includes(q)) {
    const isActive = _active === null;
    html += `
      <li class="sel-item${isActive ? ' sel-item--active' : ''}"
          data-code="__planet__" role="option" aria-selected="${isActive}">
        <span class="sel-item-flag" aria-hidden="true">${PLANET.flag}</span>
        <span class="sel-item-name">${PLANET.name}</span>
        ${isActive ? '<span class="sel-check" aria-hidden="true">✓</span>' : ''}
      </li>`;
  }

  /* Country rows */
  const list = q
    ? _countries.filter(c => c.name.toLowerCase().includes(q))
    : _countries;

  if (list.length === 0 && q) {
    html += `<li class="sel-empty">No results for "<em>${_esc(query)}</em>"</li>`;
  } else {
    html += list.map(c => {
      const isActive = _active?.code === c.code;
      return `
        <li class="sel-item${isActive ? ' sel-item--active' : ''}"
            data-code="${c.code}" role="option" aria-selected="${isActive}">
          <span class="sel-item-flag" aria-hidden="true">${c.flag}</span>
          <span class="sel-item-name">${_esc(c.name)}</span>
          ${isActive ? '<span class="sel-check" aria-hidden="true">✓</span>' : ''}
        </li>`;
    }).join('');
  }

  _list.innerHTML = html;
}

/* ── State transitions ───────────────────────────────────── */
function _select(code) {
  if (code === '__planet__') {
    _active = null;
    _setTrigger(PLANET);
    _onSelect?.(null);
  } else {
    const country = _countries.find(c => c.code === code);
    if (!country) return;
    _active = country;
    _setTrigger(country);
    _onSelect?.(country);
  }
  _close();
  /* Re-render list to update checkmarks */
  _renderList(_searchInput?.value || '');
}

function _setTrigger(opt) {
  if (!_trigger) return;
  _trigger.querySelector('.sel-flag').textContent = opt.flag;
  _trigger.querySelector('.sel-name').textContent = opt.name;
}

function _open() {
  _isOpen = true;
  _dropdown.hidden = false;
  _trigger.setAttribute('aria-expanded', 'true');
  _wrapper.classList.add('sel--open');

  /* Reset search + re-render on each open */
  _searchInput.value = '';
  _renderList('');

  /* Scroll active item into view after paint */
  setTimeout(() => {
    _searchInput.focus();
    _list.querySelector('.sel-item--active')?.scrollIntoView({ block: 'nearest' });
  }, 60);
}

function _close() {
  _isOpen = false;
  _dropdown.hidden = true;
  _trigger.setAttribute('aria-expanded', 'false');
  _wrapper.classList.remove('sel--open');
}

/* ── Utility ────────────────────────────────────────────── */
function _esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
