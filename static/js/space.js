/**
 * space.js
 *
 * Fetches and displays the people currently in space.
 *
 * API: Launch Library 2 (The Space Devs)
 *   https://ll.thespacedevs.com/2.2.0/astronaut/?in_space=true
 *   - Free, no API key, CORS-open
 *   - Returns all astronauts currently in space with name + agency
 *
 * Craft assignment (inferred from agency):
 *   CNSA                       → Tiangong space station
 *   NASA / ESA / JAXA / CSA / RFSA / others → International Space Station
 *
 * Refresh: every 5 minutes (crew rotations are infrequent)
 */

const API_URL    = 'https://ll.thespacedevs.com/2.2.0/astronaut/?in_space=true&limit=50&format=json';
const REFRESH_MS = 5 * 60 * 1000;

/* Known non-human entries in the dataset — skip these */
const SKIP_NAMES = new Set(['starman']);

/* Craft config keyed by CSS modifier */
const CRAFTS = {
  iss: {
    label:   'Int\'l Space Station',
    emoji:   '🛸',
    mod:     'iss',
    agencies: null, // catch-all
  },
  tiangong: {
    label:   'Tiangong',
    emoji:   '🚀',
    mod:     'tiangong',
    agencies: new Set(['cnsa', 'cmsa']),
  },
};

function getCraft(agencyAbbrev) {
  const key = (agencyAbbrev || '').toLowerCase();
  if (CRAFTS.tiangong.agencies.has(key)) return 'tiangong';
  return 'iss';
}

/* ── Duration parser ISO 8601 → human readable ──────────── */
function parseTimeInSpace(iso) {
  if (!iso) return null;
  const m = iso.match(/P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return null;
  const days  = parseInt(m[1] || '0', 10);
  const hours = parseInt(m[2] || '0', 10);
  if (days >= 1) return `${days}d ${hours}h`;
  return `${hours}h`;
}

/* ── DOM refs ───────────────────────────────────────────── */
const countEl      = document.getElementById('space-number');
const labelEl      = document.getElementById('space-count-label');
const craftsEl     = document.getElementById('space-crafts');
const updatedEl    = document.getElementById('space-updated');
const refreshBtn   = document.getElementById('space-refresh-btn');

/* ── Fetch ──────────────────────────────────────────────── */
async function fetchAstros() {
  const res = await fetch(API_URL, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ── Render helpers ─────────────────────────────────────── */
function renderLoading() {
  if (craftsEl) craftsEl.innerHTML = `
    <div class="space-loading">
      <div class="space-spinner"></div>
      Fetching live data…
    </div>`;
}

function renderError(msg) {
  if (craftsEl) craftsEl.innerHTML = `
    <div class="space-error">
      <div class="space-error-icon">📡</div>
      ${msg || 'Could not reach the API. Will retry automatically.'}
    </div>`;
  if (countEl) countEl.textContent = '—';
}

function renderData(data) {
  /* Filter out known non-human joke entries */
  const people = (data.results || []).filter(
    a => !SKIP_NAMES.has(a.name.toLowerCase().trim())
  );

  const total = people.length;

  /* Big count */
  if (countEl) countEl.textContent = total;
  if (labelEl) {
    labelEl.textContent =
      total === 1
        ? 'person currently orbiting Earth'
        : 'people currently orbiting Earth';
  }

  /* Group by craft */
  const groups = { iss: [], tiangong: [] };
  for (const p of people) {
    const craft = getCraft(p.agency?.abbrev);
    groups[craft].push(p);
  }

  /* Render craft cards — skip empty groups */
  const cards = Object.entries(groups)
    .filter(([, members]) => members.length > 0)
    .map(([craftKey, members]) => {
      const cfg  = CRAFTS[craftKey];
      const noun = members.length === 1 ? 'person' : 'people';

      const astronautRows = members.map(p => {
        const duration = parseTimeInSpace(p.time_in_space);
        const agency   = p.agency?.abbrev ? `<span style="opacity:.45;font-size:.78em">${p.agency.abbrev}</span>` : '';
        const time     = duration ? `<span style="opacity:.38;font-size:.78em;margin-left:auto">${duration}</span>` : '';
        return `<li class="astronaut-item">
                  ${p.name}${agency ? ' ' + agency : ''}${time}
                </li>`;
      }).join('');

      return `
        <div class="craft-card craft-card--${cfg.mod}">
          <div class="craft-card-header">
            <div class="craft-icon">${cfg.emoji}</div>
            <div>
              <div class="craft-name craft-accent">${cfg.label}</div>
              <div class="craft-count">${members.length}&nbsp;${noun} aboard</div>
            </div>
          </div>
          <ul class="astronaut-list">${astronautRows}</ul>
        </div>`;
    }).join('');

  if (craftsEl) craftsEl.innerHTML = cards || '<div class="space-error">No crew data available.</div>';

  /* Timestamp */
  if (updatedEl) {
    updatedEl.textContent = new Date().toLocaleTimeString([], {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }
}

/* ── Main refresh ───────────────────────────────────────── */
async function refresh(showSpinner = false) {
  if (showSpinner) renderLoading();
  if (refreshBtn) refreshBtn.classList.add('spinning');

  try {
    const data = await fetchAstros();
    renderData(data);
  } catch (err) {
    renderError('Could not reach the API. Will retry automatically.');
  } finally {
    if (refreshBtn) refreshBtn.classList.remove('spinning');
  }
}

/* ── Init ───────────────────────────────────────────────── */
export function initSpace() {
  if (!craftsEl) return;

  refresh(true);
  setInterval(() => refresh(false), REFRESH_MS);
  refreshBtn?.addEventListener('click', () => refresh(true));
}
