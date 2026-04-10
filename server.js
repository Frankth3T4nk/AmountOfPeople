// Static file server for the static/ folder + /api/crew proxy
//
// /api/crew  — server-side cached proxy for the Space Devs astronaut API.
//   The server fetches once every 15 minutes and serves the cached result
//   to all browser requests. The browser never hits the external API directly,
//   so external rate limits are completely transparent to end users.
const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const PORT  = process.env.PORT || 3000;
const ROOT  = path.join(__dirname, 'static');

const MIME  = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
};

// ── Crew proxy cache ─────────────────────────────────────────
// corquaid.github.io is a GitHub Pages CDN — no rate limits, includes
// name / agency / spacecraft / iss fields, updated by maintainer on crew changes.
const ASTRO_URL  = 'https://corquaid.github.io/international-space-station-APIs/JSON/people-in-space.json';
const CACHE_TTL  = 15 * 60 * 1000;   // 15 minutes

let _crewCache   = null;   // { data: {...}, ts: Date.now() }
let _fetchPromise = null;  // deduplicate concurrent fetches

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'AmountOfPeople/1.0' } }, res => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let body = '';
      res.on('data', d => { body += d; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function getCrew() {
  // Serve from cache if fresh
  if (_crewCache && Date.now() - _crewCache.ts < CACHE_TTL) {
    return { ok: true, data: _crewCache.data };
  }

  // Deduplicate: if a fetch is already in-flight, wait for it
  if (!_fetchPromise) {
    _fetchPromise = fetchJSON(ASTRO_URL)
      .then(data => {
        _crewCache = { data, ts: Date.now() };
        return { ok: true, data };
      })
      .catch(err => {
        // On 429, keep serving stale cache if available
        if (_crewCache) return { ok: true, data: _crewCache.data, stale: true };
        return { ok: false, error: err.message };
      })
      .finally(() => { _fetchPromise = null; });
  }

  return _fetchPromise;
}

// ── HTTP server ──────────────────────────────────────────────
http.createServer(async (req, res) => {
  const urlPath = req.url.split('?')[0];

  // ── API route ──────────────────────────────────────────────
  if (urlPath === '/api/crew') {
    const result = await getCrew();
    res.writeHead(result.ok ? 200 : 502, {
      'Content-Type':  'application/json',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(result.ok ? result.data : { error: result.error }));
    return;
  }

  // ── Static files ───────────────────────────────────────────
  let filePath_  = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = path.join(ROOT, filePath_);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found: ' + filePath_);
      return;
    }
    const ext  = path.extname(filePath);
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
    res.end(data);
  });

}).listen(PORT, () => {
  console.log(`Serving static/ on http://localhost:${PORT}`);
});
