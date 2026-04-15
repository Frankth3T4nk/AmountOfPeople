# EarthLive — Project Reference & Changelog

## Definition of Done — Follow these steps for EVERY task

1. **Plan first** — Create a plan before writing any code. Review the plan for correctness and feasibility. Only proceed when the plan is solid.
2. **Implement** — Write the code according to the approved plan.
3. **Test thoroughly** — Verify the code works and is bug-free. Start the dev server, check for console errors, network failures, and rendering issues. Do not skip this.
4. **Update changelog.md** — Document all changes in the Changelog section at the bottom of this file. Write concise entries that form a clear timeline. Each entry must contain enough detail so that reading this file alone — even in a brand new chat — gives full context on what was done, why, and what changed.
4. **be economical with token usage** - Make sure to use as less tokens as possible by working efficiently as possible

---

## Project Overview

This is a real-time world population counter with interactive 3D visualizations. It shows a live population number updating every 500ms, a spinning 3D Earth globe with ISS orbiting it, statistics, and a "People in Space" section with a Moon, floating space shuttles, astronauts, and live crew data.

### Tech Stack
- **Frontend**: Vanilla HTML/CSS/JS (ES modules), no build step
- **3D**: Three.js v0.169.0 (loaded via import map from CDN)
- **Font**: Outfit (Google Fonts, weights 300–900)
- **Data**: UN World Population Prospects 2024 (hardcoded reference + growth rate), The Space Devs API (live crew data)
- **Server**: Node.js static file server (`server.js`) or Python (`serve.sh`)

### How to Run
```bash
# Option 1: Node.js (preferred — used by Claude Code preview)
node server.js
# Serves on http://localhost:3000 (or PORT env var)

# Option 2: Python
./serve.sh
# Serves on http://localhost:3000
```

### Claude Code Preview Setup
The preview server is configured in `.claude/launch.json`:
```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "AmountOfPeople",
      "runtimeExecutable": "/opt/homebrew/bin/node",
      "runtimeArgs": ["server.js"],
      "port": 3001,
      "env": { "PORT": "3001" }
    }
  ]
}
```
Use `preview_start` with name `"AmountOfPeople"` to launch the dev server on port 3001.

## File Structure

```
AmountOfPeople/
├── server.js                    # Node.js static file server (serves static/)
├── serve.sh                     # Alternative: Python http.server
├── .claude/launch.json          # Claude Code preview server config (port 3001)
├── changelog.md                 # This file
└── static/
    ├── index.html               # Single-page app entry point
    ├── img/
    │   └── moon_2k.jpg          # 2K NASA LROC moon texture (447KB)
    ├── js/
    │   ├── main.js              # App boot sequence — imports & initializes all modules
    │   ├── globe.js             # Three.js spinning Earth + ISS orbit with occlusion (hero section)
    │   ├── moon.js              # Three.js spinning Moon + 3 shuttles + 4 astronauts (space section)
    │   ├── counter.js           # Odometer-style digit reel population counter
    │   ├── population.js        # UN data: reference pop + growth rate formula
    │   ├── space.js             # Fetches live crew data from The Space Devs API
    │   ├── selector.js          # Country selector dropdown UI
    │   ├── ui.js                # Navbar glass effect, scroll-reveal, stats jitter, footer
    │   └── countries.js         # Country list with lat/lng/population data
    └── css/
        ├── main.css             # Design tokens (--bg: #020617, --accent: #3b82f6), reset, utilities
        ├── hero.css             # Hero section: globe canvas, glow overlay, bottom fade
        ├── counter.css          # Odometer digit reel styling & animation
        ├── stats.css            # 4-column stats grid (births, deaths, growth, countries)
        ├── info.css             # Methodology info cards
        ├── space.css            # Space section: moon canvas, glow, craft cards
        ├── selector.css         # Country dropdown
        ├── navbar.css           # Top navigation bar
        └── footer.css           # Footer
```

## Page Sections (top to bottom)

1. **Navbar** — Fixed top bar with logo, nav links (Overview, Data, In Space, About), Live Data button
2. **Hero** (`#hero`) — Full-viewport section with:
   - Three.js spinning Earth globe (`globe.js`, canvas `#globe-canvas`)
   - Country selector dropdown (zoom to country or show world)
   - Live population counter (odometer digit reels)
   - Radial blue glow overlay (`#hero-glow`) + bottom fade (`#hero-fade`)
3. **Stats** (`#stats`) — 4-column grid: births/sec, deaths/sec, net growth/yr, countries tracked
4. **Info** (`#info`) — "How is this calculated?" methodology section with 3 info cards
5. **Space** (`#space`) — "Currently in Space" section with:
   - Three.js spinning Moon with starfield (`moon.js`, canvas `#moon-canvas`)
   - 3 space shuttles orbiting moon, 4 floating astronauts
   - Violet radial glow overlay (`#space-glow`)
   - Live crew data cards (ISS, Tiangong) fetched from The Space Devs API every 5 min
7. **Footer** — Credits, data sources, copyright

## Boot Sequence (`main.js`)

```
initGlobe()    → Three.js Earth + ISS orbit starts rendering
initCounter()  → Population counter builds DOM & starts ticking (every 500ms)
initUI()       → Navbar glass, scroll-reveal observers, stats jitter, footer year
initSpace()    → Fetches live space crew data from API
initMoon()     → Three.js Moon scene starts rendering
initSelector() → Loads countries, wires selection → zoomToCountry/zoomOut + counter source switch
```

## Key Design Patterns

- **3D sections** follow the same pattern: `<canvas>` (absolute, full-size) + glow/fade overlays + content wrapper with `position: relative; z-index: 10`
- **Three.js scenes** use: `WebGLRenderer` with `alpha: true`, `MeshPhongMaterial`, pixel ratio capped at 2, `requestAnimationFrame` render loop
- **Smooth rotation** uses lerp interpolation (`_lerp(current, target, 0.035)`) rather than direct angle increments
- **Atmosphere halos** are `BackSide` spheres with transparent `MeshPhongMaterial` (two layers: inner brighter, outer subtle)
- **Scroll-reveal** uses `IntersectionObserver` to add `.visible` class to `.fade-up` elements
- **Design tokens** in `main.css`: `--bg: #020617`, `--accent: #3b82f6`, `--accent-light: #60a5fa`, spring easing `cubic-bezier(0.22, 1, 0.36, 1)`

## External APIs & Assets

| Resource | URL | Used In |
|----------|-----|---------|
| Three.js | `cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js` | import map |
| Earth texture | `unpkg.com/three-globe/example/img/earth-blue-marble.jpg` | `globe.js` |
| Moon texture | `static/img/moon_2k.jpg` (2K NASA LROC, hosted locally) | `moon.js` |
| Space crew API | `ll.thespacedevs.com/2.2.0/astronaut/?in_space=true` | `space.js` |
| Google Fonts | `fonts.googleapis.com` (Inter) | `index.html` |

---

## Changelog

### 2026-04-14 — Space Crew API: Fallback for Static Hosting

**Problem**: On `frankleurs.nl` the site is served as static files (Python `http.server` or equivalent) with no Node.js process running. The browser called `/api/crew` which returned 404, leaving the "Currently in Space" section in the error state.

**Fix** (`space.js`): Added a two-step fetch with automatic fallback:
1. Try `/api/crew` with a 5 s timeout (works when Node.js `server.js` is running).
2. On failure (404, network error, or timeout), fall back to `https://corquaid.github.io/international-space-station-APIs/JSON/people-in-space.json` directly. GitHub Pages serves this with `Access-Control-Allow-Origin: *`, so the browser can fetch it cross-origin.

LocalStorage caching (6 h TTL) is unchanged — both paths populate the same cache, so subsequent page loads are instant regardless of hosting setup.

| File | What changed |
|------|-------------|
| `static/js/space.js` | `CREW_URL` split into `CREW_URL_PROXY = '/api/crew'` and `CREW_URL_DIRECT = 'https://corquaid.github.io/...'`; `refresh()` tries proxy first, falls back to direct on any error |

### 2026-04-14 — Maanrovers: flits vanuit de periscoop

**Wijziging**: De camera-flits van de rovers werd eerder gegenereerd op een vaste positie boven het rover-oppervlakpunt (`MOON_R + 0.12`). Nu wordt de flits exact vanaf de cameralens of periscoopkop van elke rovervariant afgevuurd.

**Aanpak** (`moon.js`):
- Elk van de 4 rovermodellen heeft nu een mesh met `name = 'flashOrigin'` op de positie van de camerakop/lens:
  - V0 (LRV-stijl): de donkere camera-box bovenop de mast (`-0.06, 0.41, -0.30` in lokale ruimte)
  - V1 (VIPER-stijl): de donkere camera-box bovenop de mast (`0.10, 0.43, -0.15`)
  - V2 (Yutu-stijl): de lensdop (`lens2`) van de roterende telescoopgroep (`0, 0, 0.21` relatief aan pivot)
  - V3 (compact): de bolvormige kap (`cap3`) van de roterende telescoopgroep (`0, 0.09, 0.19` relatief aan pivot)
- Bij initialisatie wordt `rv.flashOrigin = roverGroup.getObjectByName('flashOrigin')` opgeslagen per rover.
- Tijdens de flitsanimatie wordt `rv.flashOrigin.getWorldPosition(fpos)` gebruikt om de exacte wereldpositie op te halen — inclusief roveroriëntatie én telescoophoek.
- Flits iets kleiner gemaakt: sprite-schaal van `0.25 + strength * 0.35` → `0.10 + strength * 0.16`; PointLight-intensiteit van `5` → `3`.

| Bestand | Wijziging |
|---------|-----------|
| `static/js/moon.js` | `flashOrigin`-namen toegevoegd aan rovermodellen; referentie opgeslagen in roverstatus; `getWorldPosition()` gebruikt voor flitspositie; flits verkleind |

### 2026-04-14 — Maanrovers: foto vooruit + flits uit periscoop

**Probleem**: Rovers reden visueel achterwaarts (neus van het model wees in de richting tegengesteld aan de rijrichting), waardoor de cameralens/periscoop ook de verkeerde kant op wees. De flits leek daardoor niet uit de periscoop te komen maar naar onderen of achteren te gaan.

**Oplossing** (`moon.js`):

1. **Roveroriëntatie gecorrigeerd**: De rovermodellen hebben hun neus in de lokale `-Z` richting. Door `negFwd = -fwd` te gebruiken in `makeBasis(right, norm, negFwd)` (waarbij `right = cross(norm, negFwd)`) wijst de neus nu correct naar de rijrichting. Hierdoor staat de cameralens/periscoopkop aan de voorkant van de rover.

2. **Periscoop richt zich vooruit bij foto's**: Tijdens `stopping`, `photo` en `resuming` states wordt `scope.rotation.y` geanimeerd naar `Math.PI` (= de voorwaartse richting in de nieuwe oriëntatie, want lokale `−Z = world fwd`). Dit zorgt dat de telescoop kalm naar voren draait als de rover stopt voor een foto. Tijdens `driving` blijft de normale panoramische rotatie actief.

3. **Correcte splitsing scope-timer**: Rovers zonder telescoop (V0, V1) tellen de scope-timer nu ook correct door in een aparte `else`-tak.

| Bestand | Wijziging |
|---------|-----------|
| `static/js/moon.js` | `negFwd = fwd.negate()` in `makeBasis`; scope-animatie naar `Math.PI` bij foto-stop; scope-timer-logica herschreven voor variants met/zonder telescoop |

### 2026-04-14 — Maanrovers: kleinere flits + duidelijkere bandensporen

**Wijzigingen** (`moon.js`):
- **Flits 50% kleiner**: sprite-schaal `0.10 + strength * 0.16` → `0.05 + strength * 0.08`; PointLight-intensiteit `3` → `1.5`.
- **Bandensporen beter zichtbaar**: kleur `0x9a8a68` (zandbeige) → `0x1a1008` (donkerbruin, hoog contrast op maanoppervlak); opaciteit `0.55` → `0.92`; `TRACK_HALF` `0.035` → `0.055` (breder spoor); `TRAIL_MAX` `180` → `300` (langer spoor).

| Bestand | Wijziging |
|---------|-----------|
| `static/js/moon.js` | Flitsschaal en PointLight gehalveerd; bandenspoor donkerder, meer opaque, breder en langer |

### 2026-04-14 — Maanrovers: bandensporen blijven permanent staan

**Wijziging**: `TRAIL_MAX` verhoogd van `300` naar `8000`. De trim-logica (`pts.shift()`) loopt pas na ~133 minuten rijden aan tegen de cap, waardoor sporen in de praktijk de gehele sessie zichtbaar blijven. De `rebuildTrail`-filter toont al alleen punten op de zichtbare maanzijde, dus sporen verdwijnen niet bij normaal gebruik.

| Bestand | Wijziging |
|---------|-----------|
| `static/js/moon.js` | `TRAIL_MAX` 300 → 8000 |

### 2026-04-14 — Maanrovers: realistischere sporen + 20% kleiner

**Wijzigingen** (`moon.js`):
- **Bandensporen realistischer**: kleur `0x1a1008` (bijna-zwart) → `0x706050` (warm donkergrijs, lijkt op samengedrukte regoliet); opaciteit `0.92` → `0.68`. Sporen zien er nu uit als subtiele bodemverstoringen in plaats van geschilderde lijnen.
- **TRACK_HALF** `0.055` → `0.044` (evenredig kleiner met de rovers).
- **Rovers 20% kleiner**: alle 4 varianten geschaald met ×0.8 — V0: 0.267→0.214, V1: 0.253→0.202, V2: 0.260→0.208, V3: 0.273→0.218.
- **Oppervlakoffset** `MOON_R + 0.057` → `MOON_R + 0.046` (wielen rusten op, niet in het maanoppervlak).

| Bestand | Wijziging |
|---------|-----------|
| `static/js/moon.js` | Spoorkleur/opaciteit, TRACK_HALF, roverscales ×0.8, oppervlakoffset |

### 2026-04-14 — Orion & Apollo: schaduwen op de maan

**Wijziging**: Orion en Apollo wierpen nog geen schaduwen op het maanoppervlak omdat `castShadow` niet was ingesteld op hun meshes.

**Fix** (`moon.js`):
- `group.traverse(c => { if (c.isMesh) c.castShadow = true; })` toegevoegd aan het einde van zowel `createOrion()` als `createApollo()`.
- Shadow map vergroot van 1024×1024 → 2048×2048 voor scherpere schaduwen van de dunne zonnepanelen.
- De bestaande schaduw-frustum (±9 om het maancentrum, near=1, far=30) dekt de orbitbaan (r≈7.8) al volledig — geen aanpassing nodig.

| Bestand | Wijziging |
|---------|-----------|
| `static/js/moon.js` | `castShadow` op Orion- en Apollo-meshes; shadow map 2048×2048 |

### 2026-04-14 — Orion & Apollo: 30% kleiner + Apollo altijd gelijke snelheid

**Wijzigingen** (`moon.js`):

- **30% kleiner**: Orion `0.255` → `0.179`; Apollo `0.34` → `0.238`.
- **Apollo snelheidsfix**: Apollo gebruikte `ARTEMIS_SPEED_FAST` wanneer hij achter de maan verborgen was, en de `MIN_ANG_SEP`-afstandsbeveiliging kon Apollo teleporteren zodra Artemis snel vooruit sprong. Beide verwijderd: Apollo rijdt nu altijd op `ARTEMIS_SPEED_NORM` (dezelfde snelheid als Orion), ook tijdens occlusie. Het angular-separation-guard-blok is volledig verwijderd.

| Bestand | Wijziging |
|---------|-----------|
| `static/js/moon.js` | Schalen ×0.70; Apollo altijd NORM-snelheid; sep-guard verwijderd |

### 2026-04-14 — Orion & Apollo: nogmaals 15% kleiner

Orion `0.179` → `0.152`; Apollo `0.238` → `0.202`.

| Bestand | Wijziging |
|---------|-----------|
| `static/js/moon.js` | Orion- en Apollo-schaal ×0.85 |

### 2026-04-15 — Connector lines: animated flowing dash + always visible

**Wijzigingen** (`ui.js`):
- Verwijderd: IntersectionObserver + 650 ms vertraging — lijnen worden nu direct getekend bij `initUI()`, altijd zichtbaar zonder scrollvereiste.
- `requestAnimationFrame` loop toegevoegd: `dashFlow -= 0.55` per frame, `stroke-dashoffset = dashFlow % 16` — zelfde snelheid en ritme als de aarde-maan afstandslijn.
- Startpunten verplaatst van onderkant van de stat-nummers naar onderkant van de `.stat-label` elementen ("Births per second" / "Deaths per second").
- SVG-elementen worden eenmalig aangemaakt als persistente DOM-nodes i.p.v. elke frame `innerHTML` te herschrijven.

| Bestand | Wijziging |
|---------|-----------|
| `static/js/ui.js` | rAF animatielus; directe rendering; startpunt bij label-bottom; persistente SVG-nodes |

### 2026-04-15 — Connector lines: center target + dots + slate grey

**Wijzigingen** (`ui.js`):
- Eindpunt verschoven van de linkerrand naar het **horizontale midden** van de heading (`hR.x + hR.w / 2`).
- **Terminal circles** (r=2.5) toegevoegd op beide startpunten en het gemeenschappelijke eindpunt.
- Kleur gewijzigd van groen/rood tint naar **`rgba(148,163,184,0.55)`** (dezelfde slate-grey `#94a3b8` als de aarde-maan afstandslijn); `stroke-width` 1 → 1.5, `stroke-dasharray` "4 7" → "5 11" (zelfde ritme als de afstandslijn).

| Bestand | Wijziging |
|---------|-----------|
| `static/js/ui.js` | Eindpunt gecentreerd; terminal dots; kleur/breedte/dash gelijkgetrokken met earth-moon line |

### 2026-04-14 — Dashed connector lines: stats → info heading

**Wijziging**: Dunne gestippelde SVG-lijnen toegevoegd die visueel verbinden vanuit de "Births per second" en "Deaths per second" statistieken naar de bovenkant van "How is this calculated?". De groene lijn vertrekt vanuit de geboortestat, de rode vanuit de sterftestat; beide lopen via een cubic bezier naar de linkerrand van de heading.

**Aanpak**:
- `index.html`: `<section id="stats">` en `<section id="info">` gewrapped in `<div id="stat-info-wrap">`. `<svg id="stat-connectors">` toegevoegd binnen de wrapper.
- `stats.css`: `#stat-info-wrap { position: relative }` en absolute-gepositioneerde `#stat-connectors` stijlen (full-size, `pointer-events: none`, `overflow: visible`).
- `ui.js`: `initStatConnectors()` — gebruikt `getBoundingClientRect()` relatief aan de wrapper om paden te berekenen. IntersectionObserver wacht tot de heading zichtbaar is, dan 650 ms vertraging voor de CSS fade-in transitie, waarna `svg.innerHTML` wordt ingesteld met twee `<path>` elementen (`stroke-dasharray="4 7"`, strokebreedte 1px, opacity ±0.28). Resize-listener hertekent de paden.

| Bestand | Wijziging |
|---------|-----------|
| `static/index.html` | Wrapper `#stat-info-wrap` + `<svg id="stat-connectors">` |
| `static/css/stats.css` | Stijlen voor `#stat-info-wrap` en `#stat-connectors` |
| `static/js/ui.js` | `initStatConnectors()` toegevoegd en aangeroepen vanuit `initUI()` |
