/**
 * population.js
 *
 * Real-time world population estimate based on
 * UN World Population Prospects 2024 (UNDESA).
 *
 * Reference point : 8,162,800,000 on 2024-07-01T00:00:00Z  (midyear)
 * Annual net gain : 73,500,000 people / year  (~2.329 / second)
 * Source          : https://population.un.org/wpp/
 */

const REF_POPULATION  = 8_162_800_000;
const REF_TIMESTAMP   = new Date('2024-07-01T00:00:00Z').getTime(); // ms
const GROWTH_PER_MS   = 73_500_000 / (365.25 * 24 * 3600 * 1_000);

/**
 * Returns the estimated current world population as an integer.
 * Uses elapsed wall-clock time from the UN reference point.
 */
export function getCurrentPop() {
  const elapsed = Date.now() - REF_TIMESTAMP;
  return Math.round(REF_POPULATION + elapsed * GROWTH_PER_MS);
}

/** Approximate births per second (global average) */
export const BIRTHS_PER_SEC = 4.5;

/** Approximate deaths per second (global average) */
export const DEATHS_PER_SEC = 2.0;
