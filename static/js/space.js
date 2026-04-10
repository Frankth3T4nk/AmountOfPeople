/**
 * space.js
 *
 * Fetches and displays the people currently in space.
 *
 * Data source: /api/crew  (server-side proxy → corquaid.github.io)
 *   corquaid.github.io is a GitHub Pages CDN — no rate limits.
 *   Payload: { number, people: [{name, agency, spacecraft, iss, ...}] }
 *
 * Reliability:
 *   - Server caches the upstream response for 15 min (see server.js).
 *   - Successful results are persisted to localStorage (6 h TTL) so the
 *     section renders immediately on every page load, even offline.
 *   - On fetch error the last known data stays on screen (no blank state).
 */

const CREW_URL   = '/api/crew';
const REFRESH_MS = 15 * 60 * 1000;
const CACHE_KEY  = 'space_crew_cache_v4';
const CACHE_TTL  = 6 * 60 * 60 * 1000;

const SKIP_NAMES = new Set(['starman']);

/* ── localStorage cache ─────────────────────────────────── */
function _saveCache(people) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ people, ts: Date.now() })); }
  catch { /* storage full / private mode */ }
}
function _loadCache() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    return c && (Date.now() - c.ts < CACHE_TTL) ? c : null;
  } catch { return null; }
}

/* ── DOM refs ────────────────────────────────────────────── */
const countEl    = document.getElementById('space-number');
const labelEl    = document.getElementById('space-count-label');
const craftsEl   = document.getElementById('space-crafts');
const updatedEl  = document.getElementById('space-updated');
const refreshBtn = document.getElementById('space-refresh-btn');

/* ── Render helpers ─────────────────────────────────────── */
function renderLoading() {
  if (craftsEl) craftsEl.innerHTML = `
    <div class="space-loading">
      <div class="space-spinner"></div>
      Fetching live data…
    </div>`;
}
function renderError(msg) {
  if (craftsEl && !craftsEl.querySelector('.craft-card')) {
    craftsEl.innerHTML = `
      <div class="space-error">
        <div class="space-error-icon">📡</div>
        ${msg || 'Could not reach the API. Will retry automatically.'}
      </div>`;
    if (countEl) countEl.textContent = '—';
  }
}

/**
 * Render crew cards.
 * @param {Array<{name,agency,spacecraft,iss}>} people
 */
function renderData(people) {
  const total = people.length;
  if (countEl) countEl.textContent = total;
  if (labelEl) labelEl.textContent = total === 1 ? 'person currently in space' : 'people currently in space';

  // Group by spacecraft
  const groups = {};
  for (const p of people) {
    const key = p.spacecraft || 'Unknown';
    if (!groups[key]) groups[key] = { members: [], isISS: !!p.iss };
    groups[key].members.push(p);
  }

  // Sort: ISS first, then alphabetically (puts Tiangong / Shenzhou together)
  const sortedKeys = Object.keys(groups).sort((a, b) => {
    if (groups[a].isISS && !groups[b].isISS) return -1;
    if (!groups[a].isISS && groups[b].isISS) return 1;
    return a.localeCompare(b);
  });

  const cards = sortedKeys.map(spacecraft => {
    const { members, isISS } = groups[spacecraft];
    const noun = members.length === 1 ? 'person' : 'people';

    const isTiangong = spacecraft.toLowerCase().includes('shenzhou') ||
                       spacecraft.toLowerCase().includes('tiangong');
    const mod   = isISS ? 'iss' : isTiangong ? 'tiangong' : 'other';
    const emoji = isISS ? '🛸' : isTiangong ? '🚀' : '🌙';
    const stationLabel = isISS ? "Int'l Space Station" : isTiangong ? 'Tiangong' : spacecraft;

    const rows = members.map(p => {
      const agencySpan = p.agency
        ? `<span style="opacity:.45;font-size:.78em">${p.agency}</span>` : '';
      return `<li class="astronaut-item">${p.name}${agencySpan ? ' ' + agencySpan : ''}</li>`;
    }).join('');

    return `
      <div class="craft-card craft-card--${mod}">
        <div class="craft-card-header">
          <div class="craft-icon">${emoji}</div>
          <div>
            <div class="craft-name craft-accent">${spacecraft}</div>
            <div class="craft-count">${stationLabel} · ${members.length}&nbsp;${noun} aboard</div>
          </div>
        </div>
        <ul class="astronaut-list">${rows}</ul>
      </div>`;
  }).join('');

  if (craftsEl) craftsEl.innerHTML = cards || '<div class="space-error">No crew data available.</div>';
  if (updatedEl) updatedEl.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/* ── Main refresh ───────────────────────────────────────── */
async function refresh(showSpinner = false) {
  const hasContent = () => !!(craftsEl && craftsEl.querySelector('.craft-card'));
  if (showSpinner && !hasContent()) renderLoading();
  if (refreshBtn) refreshBtn.classList.add('spinning');

  try {
    const r = await fetch(CREW_URL, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    if (data.error) throw new Error(data.error);

    const people = (data.people || []).filter(
      p => !SKIP_NAMES.has((p.name || '').toLowerCase().trim())
    );

    _saveCache(people);
    renderData(people);
  } catch {
    if (!hasContent()) renderError('Could not reach the API. Will retry automatically.');
  } finally {
    if (refreshBtn) refreshBtn.classList.remove('spinning');
  }
}

/* ── Init ───────────────────────────────────────────────── */
export function initSpace() {
  if (!craftsEl) return;

  const cached = _loadCache();
  if (cached?.people) renderData(cached.people);

  refresh(/* showSpinner */ !cached);
  setInterval(() => refresh(false), REFRESH_MS);
  refreshBtn?.addEventListener('click', () => refresh(true));
}
