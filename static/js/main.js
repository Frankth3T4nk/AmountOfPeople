/**
 * main.js  —  application entry point
 *
 * Boot order:
 *   1. Globe (Three.js, independent)
 *   2. Counter (starts on world pop immediately)
 *   3. UI     (navbar, scroll-reveal, stats, footer)
 *   4. Selector (loads countries async — fires callback when user picks one)
 *   5. Space  (async API fetch)
 */

import { initGlobe, zoomToCountry, zoomOut } from './globe.js';
import { initCounter, setPopSource           } from './counter.js';
import { initUI                              } from './ui.js';
import { initSpace                           } from './space.js';
import { initSelector                        } from './selector.js';
import { getCountryCurrentPop                } from './countries.js';
import { getCurrentPop as getWorldPop        } from './population.js';
import { initShuttle                         } from './shuttle.js';

/* ── Boot ───────────────────────────────────────────────── */
initGlobe();
initCounter();
initUI();
initSpace();
initShuttle();

/* ── Selector wires into globe + counter ────────────────── */
initSelector(onCountryChange);

/* ── Selector callback ──────────────────────────────────── */
function onCountryChange(country) {
  const sublabel = document.getElementById('hero-sublabel');

  if (country === null) {
    /* ── "This Planet" selected ───────────────────────── */
    setPopSource(getWorldPop);
    zoomOut();
    if (sublabel) sublabel.textContent = 'people on this planet';
  } else {
    /* ── Country selected ─────────────────────────────── */
    setPopSource(() => getCountryCurrentPop(country));
    zoomToCountry(country.lat, country.lng);
    if (sublabel) sublabel.textContent = `people in ${country.name}`;
  }
}
