/**
 * countries.js
 *
 * Fetches all countries from the REST Countries API and provides
 * real-time population estimates proportional to the UN world model.
 *
 * API: https://restcountries.com/v3.1/all  (free, no auth, CORS-open)
 */

const API_URL =
  'https://restcountries.com/v3.1/all?fields=name,population,cca2,latlng,flag';

/* Reference: same constants as population.js */
const WORLD_POP      = 8_162_800_000;
const WORLD_REF_TIME = new Date('2024-07-01T00:00:00Z').getTime();
const WORLD_GROWTH_MS = 73_500_000 / (365.25 * 24 * 3600 * 1_000);

let _cache = null;

/**
 * Fetch and cache all countries. Returns a sorted array.
 * Each entry: { code, name, baselinePop, lat, lng, flag }
 */
export async function fetchCountries() {
  if (_cache) return _cache;

  const res = await fetch(API_URL, { signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(`REST Countries HTTP ${res.status}`);

  const raw = await res.json();

  _cache = raw
    .filter(c =>
      c.population > 0 &&
      Array.isArray(c.latlng) &&
      c.latlng.length === 2
    )
    .sort((a, b) => a.name.common.localeCompare(b.name.common))
    .map(c => ({
      code:        c.cca2,
      name:        c.name.common,
      baselinePop: c.population,
      lat:         c.latlng[0],
      lng:         c.latlng[1],
      flag:        c.flag || '🏳',
    }));

  return _cache;
}

/**
 * Returns the estimated current population of a given country.
 * Growth is proportional to the country's share of world population.
 */
export function getCountryCurrentPop(country) {
  const share       = country.baselinePop / WORLD_POP;
  const worldDelta  = (Date.now() - WORLD_REF_TIME) * WORLD_GROWTH_MS;
  return Math.round(country.baselinePop + worldDelta * share);
}
