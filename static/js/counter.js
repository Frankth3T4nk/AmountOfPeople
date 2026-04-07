/**
 * counter.js
 *
 * Odometer-style population counter.
 *
 * Each digit position owns a "reel" — a vertical strip of
 * digits 0-9 that scrolls upward via CSS transform, exactly
 * like a physical clock or car odometer.
 *
 * Reel layout (top → bottom):
 *   0  1  2  3  4  5  6  7  8  9  | 0  1  2  3  4  5  6  7  8  9
 *   ←────────── set A ────────────┘ ←──────── set B (wrap buffer)
 *
 * Showing digit N  → translateY( -N × 1em )
 * When slot index ≥ 10 the reel has rolled into set B; after the
 * CSS transition finishes we silently snap back to set A so the
 * slot index stays small forever.
 *
 * setPopSource(fn) — swap the population function at any time.
 *   Passing null reverts to the world counter.
 *   The counter rebuilds itself on the next tick when the digit
 *   count changes (e.g. switching from 10-digit world to 3-digit
 *   country figure).
 */

import { getCurrentPop } from './population.js';

/* ── Constants ─────────────────────────────────────────── */
const REEL_SETS = 2;
const REEL_LEN  = 10 * REEL_SETS;  // 20 cells per reel
const UPDATE_MS = 500;

/* ── State ─────────────────────────────────────────────── */
let _popFn        = getCurrentPop;  // swappable via setPopSource()
let _reelMap      = [];
let _prevFormatted = '';

/* ── DOM ref ────────────────────────────────────────────── */
const counterEl = document.getElementById('counter');

/* ══════════════════════════════════════════════════════════
   setPopSource — swap the population source function
   ══════════════════════════════════════════════════════════ */
export function setPopSource(fn) {
  _popFn = fn ?? getCurrentPop;
  /* Force a full rebuild on the next tick */
  _prevFormatted = '';
}

/* ══════════════════════════════════════════════════════════
   createReel — creates and manages a single digit column
   ══════════════════════════════════════════════════════════ */
function createReel(initialDigit) {
  const wrapper = document.createElement('span');
  wrapper.className = 'digit-wrapper';

  const reel = document.createElement('span');
  reel.className = 'digit-reel no-transition';
  wrapper.appendChild(reel);

  for (let i = 0; i < REEL_LEN; i++) {
    const cell = document.createElement('span');
    cell.className = 'digit-item';
    cell.textContent = i % 10;
    reel.appendChild(cell);
  }

  let slot = initialDigit;
  reel.style.transform = `translateY(-${slot}em)`;

  /* Enable transitions after the initial placement paint */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => reel.classList.remove('no-transition'));
  });

  function rollTo(targetDigit) {
    const currentDigit = slot % 10;
    if (targetDigit === currentDigit) return;

    const steps =
      targetDigit > currentDigit
        ? targetDigit - currentDigit
        : 10 - currentDigit + targetDigit;

    slot += steps;
    reel.style.transform = `translateY(-${slot}em)`;

    if (slot >= 10) {
      reel.addEventListener(
        'transitionend',
        () => {
          reel.classList.add('no-transition');
          slot = slot % 10;
          reel.style.transform = `translateY(-${slot}em)`;
          requestAnimationFrame(() => {
            requestAnimationFrame(() => reel.classList.remove('no-transition'));
          });
        },
        { once: true }
      );
    }
  }

  return { wrapper, rollTo };
}

/* ══════════════════════════════════════════════════════════
   buildCounter — (re)construct DOM from a formatted string
   ══════════════════════════════════════════════════════════ */
function buildCounter(formatted) {
  counterEl.innerHTML = '';
  _reelMap = [];

  for (const char of formatted) {
    if (/\d/.test(char)) {
      const r = createReel(parseInt(char, 10));
      counterEl.appendChild(r.wrapper);
      _reelMap.push(r);
    } else {
      const sep = document.createElement('span');
      sep.className = 'digit-sep';
      sep.textContent = char;
      counterEl.appendChild(sep);
      _reelMap.push(null);
    }
  }
}

/* ══════════════════════════════════════════════════════════
   tick — called every UPDATE_MS
   ══════════════════════════════════════════════════════════ */
function tick() {
  const formatted = _popFn().toLocaleString('en-US');
  if (formatted === _prevFormatted) return;

  /* Rebuild entirely when digit count changes */
  if (formatted.length !== _prevFormatted.length) {
    buildCounter(formatted);
    _prevFormatted = formatted;
    return;
  }

  /* Otherwise only roll the changed digits */
  const chars = formatted.split('');
  chars.forEach((char, i) => {
    if (_reelMap[i] && /\d/.test(char) && char !== _prevFormatted[i]) {
      _reelMap[i].rollTo(parseInt(char, 10));
    }
  });

  _prevFormatted = formatted;
}

/* ══════════════════════════════════════════════════════════
   initCounter — public entry point
   ══════════════════════════════════════════════════════════ */
export function initCounter() {
  const initial = _popFn().toLocaleString('en-US');
  buildCounter(initial);
  _prevFormatted = initial;

  setInterval(tick, UPDATE_MS);
}
