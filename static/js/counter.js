/**
 * counter.js
 *
 * Odometer-style population counter with bidirectional digit scrolling.
 *
 * Each reel has THREE sets of digits (30 cells) so it can roll both
 * forward (birth) and backward (death) without showing blank cells:
 *
 *   set A (cells  0– 9) — reverse-scroll buffer
 *   set B (cells 10–19) — live window  ← slot initialised here
 *   set C (cells 20–29) — forward-scroll buffer
 *
 * Rolling forward  → slot++; snap slot-=10 after anim when slot ≥ 20
 * Rolling backward → slot--; snap slot+=10 after anim when slot < 10
 *
 * snapPending guard: only one transitionend listener registered at a time
 * per reel, preventing double-snap that corrupted slot position.
 *
 * ── Modes ───────────────────────────────────────────────────
 * World mode   — two event timers: +1 birth every 500 ms,
 *                -1 death every 3000 ms. Net ≈ +1.67/s (real: +2.33/s).
 *                Drift corrected silently every 30 s.
 * Country mode — smooth 500 ms poll, forward-only (existing behaviour).
 *
 * setPopSource(fn) — null/getCurrentPop → world mode; fn → country mode.
 */

import { getCurrentPop, BIRTHS_PER_SEC, DEATHS_PER_SEC } from './population.js';

/* ── Constants ─────────────────────────────────────────── */
const REEL_SETS = 3;
const REEL_LEN  = 10 * REEL_SETS;  // 30 cells per reel

const BIRTH_MS  = 500;   // calm single-tick rhythm (~2/s, down from 4.5/s)
const DEATH_MS  = 3000;  // occasional backward flick every 3 s
const SMOOTH_MS = 500;                                  // country mode interval

/* ── State ─────────────────────────────────────────────── */
let _popFn         = getCurrentPop;
let _worldMode     = true;  // true = world event-driven, false = country smooth
let _displayPop    = 0;
let _reelMap       = [];
let _prevFormatted = '';

/* ── DOM ref ────────────────────────────────────────────── */
const counterEl = document.getElementById('counter');

/* ══════════════════════════════════════════════════════════
   setPopSource — swap the population source
   ══════════════════════════════════════════════════════════ */
export function setPopSource(fn) {
  _worldMode     = fn === null || fn === undefined || fn === getCurrentPop;
  _popFn         = _worldMode ? getCurrentPop : fn;
  _displayPop    = _popFn();
  _prevFormatted = '';  // force rebuild on next tick
}

/* ══════════════════════════════════════════════════════════
   createReel — one digit column
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

  // Start in set B — room to scroll either way without hitting blank cells
  let slot        = 10 + initialDigit;
  let snapPending = false;
  reel.style.transform = `translateY(-${slot}em)`;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => reel.classList.remove('no-transition'));
  });

  /* ── Snap back to set B after a wrap ──────────────────── */
  function doSnap() {
    snapPending = false;
    reel.classList.add('no-transition');
    // Normalise to set B [10–19] regardless of over/under-shoot
    slot = ((slot % 10) + 10) % 10 + 10;
    reel.style.transform = `translateY(-${slot}em)`;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => reel.classList.remove('no-transition'))
    );
  }

  function maybeScheduleSnap() {
    if (!snapPending && (slot >= 20 || slot < 10)) {
      snapPending = true;
      reel.addEventListener('transitionend', doSnap, { once: true });
    }
  }

  /* ── Forward roll (birth / increase) ──────────────────── */
  function rollTo(targetDigit) {
    const current = slot % 10;
    if (targetDigit === current) return;
    const steps = targetDigit > current
      ? targetDigit - current
      : 10 - current + targetDigit;
    slot += steps;
    reel.style.transform = `translateY(-${slot}em)`;
    maybeScheduleSnap();
  }

  /* ── Backward roll (death / decrease) ─────────────────── */
  function rollBack(targetDigit) {
    const current = slot % 10;
    if (targetDigit === current) return;
    const steps = targetDigit < current
      ? current - targetDigit
      : current + (10 - targetDigit);
    slot -= steps;
    reel.style.transform = `translateY(-${slot}em)`;
    maybeScheduleSnap();
  }

  return { wrapper, rollTo, rollBack };
}

/* ══════════════════════════════════════════════════════════
   buildCounter — (re)construct DOM
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
   applyPop — diff and animate only changed digits
   ══════════════════════════════════════════════════════════ */
function applyPop(pop, decreasing) {
  const formatted = pop.toLocaleString('en-US');
  if (formatted === _prevFormatted) return;

  if (formatted.length !== _prevFormatted.length) {
    buildCounter(formatted);
    _prevFormatted = formatted;
    return;
  }

  const chars = formatted.split('');
  chars.forEach((char, i) => {
    if (_reelMap[i] && /\d/.test(char) && char !== _prevFormatted[i]) {
      const d = parseInt(char, 10);
      decreasing ? _reelMap[i].rollBack(d) : _reelMap[i].rollTo(d);
    }
  });

  _prevFormatted = formatted;
}

/* ══════════════════════════════════════════════════════════
   initCounter — public entry point
   ══════════════════════════════════════════════════════════ */
export function initCounter() {
  _displayPop = getCurrentPop();
  const initial = _displayPop.toLocaleString('en-US');
  buildCounter(initial);
  _prevFormatted = initial;

  /* Birth event — forward tick every 500 ms (world mode only) */
  setInterval(() => {
    if (!_worldMode) return;
    _displayPop += 1;
    applyPop(_displayPop, false);
  }, BIRTH_MS);

  /* Death event — backward tick every 3000 ms (world mode only) */
  setInterval(() => {
    if (!_worldMode) return;
    _displayPop -= 1;
    applyPop(_displayPop, true);
  }, DEATH_MS);

  /* Country mode — smooth 500 ms poll, forward-only */
  setInterval(() => {
    if (_worldMode) return;
    applyPop(_popFn(), false);
  }, SMOOTH_MS);

  /* Drift correction (world mode) — display runs at ~+1.67/s vs real +2.33/s.
     Drift ≈ 20 people/30 s. Silently snap if > 20 off. */
  setInterval(() => {
    if (!_worldMode) return;
    const real = getCurrentPop();
    if (Math.abs(real - _displayPop) > 20) {
      _displayPop = real;
      const formatted = _displayPop.toLocaleString('en-US');
      buildCounter(formatted);
      _prevFormatted = formatted;
    }
  }, 30_000);
}
