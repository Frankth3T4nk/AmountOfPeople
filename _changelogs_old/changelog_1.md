# EarthLive — Project Reference & Changelog

## Definition of Done — Follow these steps for EVERY task

1. **Plan first** — Create a plan before writing any code. Review the plan for correctness and feasibility. Only proceed when the plan is solid.
2. **Implement** — Write the code according to the approved plan.
3. **Test thoroughly** — Verify the code works and is bug-free. Start the dev server, check for console errors, network failures, and rendering issues. Do not skip this.
4. **Update changelog.md** — Document all changes in the Changelog section at the bottom of this file. Write concise entries that form a clear timeline. Each entry must contain enough detail so that reading this file alone — even in a brand new chat — gives full context on what was done, why, and what changed.

---

## Project Overview

**EarthLive** is a real-time world population counter with interactive 3D visualizations. It shows a live population number updating every 500ms, a spinning 3D Earth globe with ISS orbiting it, statistics, and a "People in Space" section with a spinning Moon, floating space shuttles, astronauts, and live crew data.

### Tech Stack
- **Frontend**: Vanilla HTML/CSS/JS (ES modules), no build step
- **3D**: Three.js v0.169.0 (loaded via import map from CDN)
- **Font**: Inter (Google Fonts, weights 300–900)
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

### 2026-04-14 — Maanrovers: kleiner, schaduwen, botsingen, realistische flits

**Wijzigingen in `static/js/moon.js`**:

- **Rovers 1/3 kleiner**: alle vier `g.scale.setScalar(...)` waarden met factor 2/3 verlaagd (0.40→0.267 / 0.38→0.253 / 0.39→0.260 / 0.41→0.273). `TRACK_HALF` mee geschaald van 0.052 naar 0.035. Oppervlakteoffset in `_sPt` verlaagd van `MOON_R + 0.085` naar `MOON_R + 0.057` (wiel-bodem na schaalverlaging ≈ 0.055 onder oorsprong).

- **Schaduwen (PCF Soft Shadow Map)**:
  - `renderer.shadowMap.enabled = true`, `renderer.shadowMap.type = THREE.PCFSoftShadowMap`
  - `sun.castShadow = true`; shadow map 1024×1024; frustum ±9 world-units; `bias = -0.002`; `sun.target.position.set(1.5, 0, 0)` zodat het schaduwfrustum de maan centreert.
  - `moon.receiveShadow = true`
  - In `createRover`: `g.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } })` — alle onderdelen van alle vier rovermodellen casten en ontvangen schaduwen.

- **Botsingspreventie tussen rovers**:
  - Elke frame wordt per rover gekeken of een andere rover binnen `MIN_ROVER_D = 0.55` world-units ligt.
  - Zo ja: bereken de tangentrichting van rover A naar rover B (geprojecteerd op het maanoppervlak), stel `tgtHeading = richting_naar_B + π` in en reset `avoidingLimb`. Het heading-lerp zorgt voor een soepele ontwijkbeweging.

- **Realistische camera-flits**:
  - De oude `flashMesh` (sphere) vervangen door een `THREE.Sprite` met `SpriteMaterial` + `AdditiveBlending` (altijd naar camera gericht, additief mengend met de scène).
  - Eén gedeelde `_flashPL` (`THREE.PointLight`, intensity=0) die naar de actieve rover beweegt tijdens een flits.
  - Twee-puls animatie over 22 frames: puls 1 (frames 22→13: opbouw → piek → dip), puls 2 (frames 12→3: opbouw → piek), uitdoving (frames 3→0). De sprite schaalt mee met de intensiteit (0.25–0.60 world-units) en het PointLight haalt intensity=5 op piekmomenten.

| Bestand | Wat veranderd |
|---------|---------------|
| `static/js/moon.js` | Schaal rovers ×2/3; PCF shadow maps; botsingspreventie; flits sprite + PointLight |

---

### 2026-04-14 — Maanrover bugfixes: snelheid, oriëntatie, bandensporen

**Problemen**:
1. Rovers reden 5–10× te snel (0.002–0.0038 rad/frame was ~1× Orion, niet 1/10×).
2. Rovers draaiden willekeurig op de spot door een foute heading-lerp (geen hoeksnormalisatie → grote sprongen over ±π heen).
3. De limietdetectie (`lookAheadNorm.dot < 0.12`) zette elke frame een nieuw `tgtHeading`, wat continue stuurbewegingen gaf.
4. De `right`-vector was berekend als `cross(fwd, norm)` in plaats van `cross(norm, fwd)`, wat een linkshanded basis gaf (det = −1). THREE.js `makeBasis` met een linkshanded basis geeft een onjuiste rotatiematrix.
5. Oppervlakteoffset (`MOON_R * 1.003 = 6.419`) was te klein: het diepste wielgeometrie van variant 3 reikt 0.082 units onder de groepsoorsprong, waardoor rovers in het maanoppervlak zakten.

**Fixes in `static/js/moon.js`**:
- **Snelheid**: `0.00028 + rand*0.00014` rad/frame (bereik 0.00028–0.00042). Lineaire snelheid ≈ 0.11–0.16 units/frame×60fps = 0.11 units/s op het oppervlak vs Orion 1.5 units/s → ratio ≈ 1/10. ✓
- **Hoek-lerp**: vervangen door `hdDiff = ((tgt − h + 3π) % 2π) − π; h += hdDiff * 0.02` zodat het altijd de kortste boog neemt; geen doordraai meer mogelijk.
- **Limbvermijding**: `avoidingLimb: false` toegevoegd aan roverstate; `tgtHeading` wordt slechts éénmaal ingesteld bij het betreden van de gevarenzone (`limbDot < 0.15`), pas gecleard als limbDot > 0.30. Look-ahead van 8 → 12 stappen voor betere reactietijd.
- **Right-vector**: `crossVectors(norm, fwd)` i.p.v. `crossVectors(fwd, norm)`. Basis `(right, norm, fwd)` is nu rechtshandig: `right × norm = fwd`, det = +1.
- **Oppervlakteoffset**: standaard radius in `_sPt` verhoogd van `MOON_R * 1.003` (6.419) naar `MOON_R + 0.085` (6.485). Diepste wielbasis variant 3 is 0.082 units onder groepsoorsprong → wielbodem op 6.403 > 6.400. ✓
- **Draaifrequentie**: `TURN_P` verlaagd van 0.022 naar 0.005; draaimagnitude van ±0.70π naar ±0.35π voor rustiger rijgedrag.

| Bestand | Wat veranderd |
|---------|---------------|
| `static/js/moon.js` | Speed, heading-lerp, limb-flag, right-vector, surface-offset, TURN_P |

---

### 2026-04-14 — Stilstaande maan + maanrovers met bandensporen, camera-flits en telescoop

**Doel**: De maan stilzetten en 1–4 maanrovers over het oppervlak laten rijden, elk met duale bandensporen, een af-en-toe camera-flits en een roterende telescoop.

**Wijzigingen in `static/js/moon.js`**:

- **Maan stilgezet**: `MOON_SPEED` van `0.00025` naar `0`. De lerp-rotatie in de render loop loopt nog door maar verandert niets meer (target = current).

- **Oppervlaktemeetkunde** (module-scope helpers):
  - `_MOON_CTR`: constante `THREE.Vector3(1.5, 0, 0)` — het middelpunt van de maan.
  - `_CAM_DIR`: eenheidsvector van maancentrum naar camera `(-1.5, 0, 12).normalize()` — gebruikt voor zichtbaarheidstest.
  - `_sPt(theta, phi, r)`: geeft een punt op het maanoppervlak terug voor bolvormige coördinaten (theta = breedtegraad-analoog, phi = lengtegraad-analoog).
  - `_sNorm(theta, phi)`: oppervlaktenormaal (eenheidsvector van maancentrum naar punt).
  - `_sFwd(theta, phi, h)`: voorwaartse tangentvector op het oppervlak voor rijrichting `h`.

- **Rover-initialisatie** (binnen `initMoon()`):
  - `ROVER_N = Math.floor(Math.random() * 4) + 1` — random 1–4 rovers per paginabezoek.
  - Per rover: twee `THREE.Line`-objecten voor linker- en rechterbandenspoor (`trackL`/`trackR`), één flash-mesh (transparante gloeiende bol, standaard onzichtbaar), random startpositie op de zichtbare kant van de maan (theta ≈ 1.70 ± 0.70 rad, phi ∈ ±0.50 rad).
  - Toestand per rover: `theta`, `phi`, `heading`, `tgtHeading`, `speed` (0.0020–0.0038 rad/frame), `state` (driving / stopping / photo / resuming), timers, `scopeAngle`.

- **Render loop — roversysteem**:
  - **Rijden**: lerpt `heading` naar `tgtHeading` (zachte bochten). Kans 2.2 % per frame om de rijrichting te wijzigen met ±0.70π rad. Beweging: `phi += speed·cos(h)`, `theta += speed·sin(h)/cos(phi)` (correctie voor meridiaanengte). Kijkt 8 stappen vooruit — als de rover de rand van het zichtbare halfrond nadert (`dot(lookAheadNorm, _CAM_DIR) < 0.12`) stuurt hij terug. Kans 0.18 % per frame om te stoppen voor een foto.
  - **Camera-flits**: rover stopt (40–100 frames), daarna 28-frame flits-animatie: opaciteit volgt een piekfunctie (opkomt t=0.3, volledig t=0.7, weg t=1.0) op de flash-mesh boven de rover. Daarna 25–75 frames rust voor het rijden hervat.
  - **Bandensporen**: per frame worden de linker- en rechterposities (offset ±0.052 world-units loodrecht op rijrichting) toegevoegd aan `trackL.pts` / `trackR.pts` (max 180 punten). Iedere frame wordt de geometrie herbouwd via `Float32Array` + `THREE.BufferAttribute`; punten op de afgekeerde maankant worden gefilterd via `dot(pNorm, _CAM_DIR) > 0`.
  - **Telescoop**: rovers van varianten 2 en 3 hebben een `THREE.Group` met naam `'telescope'`. Wisselend 120–280 frames actief / 250–600 frames inactief; actief roteert het +0.022 rad/frame om de lokale Y-as.
  - **Oriëntatie**: rover wordt gepositioneerd met `makeBasis(right, norm, fwd)` zodat hij rechtop op het oppervlak staat en de rijrichting volgt.

- **`createRover(variant)` — 4 modellen** (zelfde materialenpalet als Orion/Apollo):
  - Variant 0: LRV-stijl — open goud chassis (Kapton-folie), 4 getande wielen, instrumentconsole, antenneschotel.
  - Variant 1: VIPER-stijl — gesloten wit aluminium body, blauwe solar panel top, boor-arm voorzijde, 4 wielen met ophangingsarmen.
  - Variant 2: Yutu-stijl — 6 wielen (rocker-bogie posities), goud Kapton body, groot solar panel met rasterverdeling, roterende telescoop met lenshoofdje.
  - Variant 3: Compact angular rover — 4 grote wielen met accenthubcaps, wigvormige neus, donkere visor-bar, roterende telescoop met bolkop.

| Bestand | Wat veranderd |
|---------|---------------|
| `static/js/moon.js` | `MOON_SPEED` → 0; module-scope oppervlaktehelpers; rover-initialisatie + render-loop update; `createRover()` met 4 varianten |

---

### 2026-04-10 — Outfit font + info-sectie tekstgrootte

**Wijzigingen**:
- **Font** (`index.html` + `main.css`): Google Fonts import gewisseld van `Inter` naar `Outfit` (zelfde gewichten 300–900). CSS-variabele `--font` bijgewerkt naar `'Outfit', system-ui, sans-serif`. Outfit is een geometrische sans-serif die beter past bij de ruimte-esthetiek van de site.
- **Info-sectie** (`info.css`): `clamp()`-waarden verwijderd en vaste groottes ingesteld:
  - `.info-heading`: was `clamp(1.4rem, 3vw, 2rem)` → nu `20px`
  - `.info-body`: was `clamp(0.95rem, 1.6vw, 1.1rem)` → nu `16px`

---

### 2026-04-10 — Hero-fade beperkt tot globe-breedte (v2 — radiale gradient)

**Probleem**: `#hero-fade` had `left: 0; right: 0` waardoor het over de volledige viewport-breedte een donkere fade legde. Dit onderbrak de parallax-sterren links en rechts buiten de aarde. Een eerdere poging met `mask-image` werkte niet betrouwbaar genoeg.

**Fix** (`static/css/hero.css`):
- Gradient vervangen van lineair (volledig breed) naar `radial-gradient(ellipse 44% 100% at 50% 100%, ...)`.
- De ellips staat met het centrum op de onderkant (50% 100%), horizontale radius = 44% van de elementbreedte. Op een 1920px scherm = ~845px radius; sterren in de buitenste ±12% per kant worden niet geraakt.
- Stop-verdeling: `#020617` tot 12% radius → `rgba 0.80` op 40% → `rgba 0.30` op 70% → transparant op 100%. Dit geeft een zachte uitloper die vanzelf ophoudt vóór de schermranden.
- Geen masker, geen browser-specifieke trucs — werkt puur op basis van de gradientvorm.
- Hoogte verhoogd van 13rem naar 16rem voor voldoende zachte overloop.

---

### 2026-04-10 — Parallax starfield + scrollbar reset

**Goal**: Replace the two static Three.js starfields (in `globe.js` and `moon.js`) with a single full-page parallax starfield that reacts to scroll movement. Also remove custom scrollbar styling.

**New file — `static/js/stars.js`**:
- Creates a `<canvas id="star-canvas">` with `position: fixed; z-index: 0; pointer-events: none`, inserted as the first child of `<body>` so all content layers naturally render above it.
- **Three parallax depth layers** (far / mid / near): 320 / 200 / 80 stars respectively.
  - Far layer: `parallaxRate = 0.10`, `size ≈ 0.55px`, `alpha ≈ 0.40` — barely moves on scroll.
  - Mid layer: `parallaxRate = 0.24`, `size ≈ 0.90px`, `alpha ≈ 0.62`.
  - Near layer: `parallaxRate = 0.45`, `size ≈ 1.45px`, `alpha ≈ 0.82` — moves fastest; has a soft radial halo glow.
- **Parallax**: each frame reads `window.scrollY`, subtracts `scrollY × parallaxRate` from each star's Y position. Stars wrap vertically (modulo viewport height) so they stay visible at any scroll depth.
- **Twinkle**: per-star phase offset with `0.72 + 0.28 × sin(t × 0.00065 + phase)` oscillation applied to opacity.
- `buildStars()` called once; `requestAnimationFrame` loop draws every frame.

**Removed static starfields**:
- `globe.js`: deleted the IIFE star field (`scene.add(new THREE.Points(...))`) that placed 6000 random points in a 240-unit cube around the Earth.
- `moon.js`: deleted the same IIFE starfield around the Moon. Also removed the now-unused `_makeStarTexture()` helper function.

**`main.js`**: added `import { initStars } from './stars.js'` and calls `initStars()` first in the boot sequence, before `initGlobe()`.

**Scrollbar** (`static/css/main.css`):
- Removed `::-webkit-scrollbar`, `::-webkit-scrollbar-track`, and `::-webkit-scrollbar-thumb` overrides. Browser now renders its native scrollbar.

**Result**: Stars move at different speeds as you scroll (depth illusion), near-layer stars have a soft glow, all stars gently twinkle. No more duplicate static starfields. Scrollbar is the OS/browser default.

---

### 2026-04-09 — Artemis II Orion orbiting the Moon

**Goal**: Add an Artemis II Orion spacecraft floating around the moon, matching the visual style and orbital behaviour of the ISS around the Earth.

**Model** (`createOrion()` in `moon.js`):
- Uses the same three material types as the ISS (`alum` 0xe8eaed / `solar` 0x1a3a6b+blue-spec / `gold` 0xc8a84b), making both spacecraft feel visually unified.
- Parts: Command Module (blunt cone, wide end moonward), CM heat shield (dark disc), CM–SM adapter ring, Service Module (gold thermal-wrapped cylinder with two alum ribs), engine nozzle, 4 cross-arranged solar wings with gold trim strips — matching the ESA Service Module layout.
- All materials created with `transparent: true` so opacity can be animated for limb fade.
- Scale: `0.30` (matches the apparent size of the ISS relative to Earth).

**Orbit** (`initMoon()` render loop):
- Orbit radius: `MOON_R × 1.22 ≈ 7.8` world units (just outside the violet atmosphere halo).
- Orbit centre: moon world position `(1.5, 0, 0)` — same offset as the moon mesh itself.
- 4 inclination presets (same structure as ISS_ORBITS), switched invisibly during occlusion so the orbit appears to vary naturally.
- Nadir-pointing orientation each frame: zenith = away from moon, velocity = along orbit tangent, right = truss axis — same `makeBasis` technique as ISS.
- Smooth limb fade: segment-distance from camera→Artemis to moon centre drives material `opacity` (0 fully hidden → 1 fully visible over a MOON_R to MOON_R×1.12 band).
- Fast-advance during occlusion (`0.018` vs `0.0032` normal) with look-ahead to slow down before re-emergence — identical pattern to ISS.
- `_rayHitsSphere` helper copied from `globe.js` (same occlusion geometry).

| File | What changed |
|------|-------------|
| `static/js/moon.js` | Added `createOrion()`, `_rayHitsSphere()`, `_setGroupOpacity()`; added Artemis orbit state + logic to render loop |

---

### 2026-04-10 — Earth ↔ Moon Line: Text Overlap Fix (v2)

**Problem**: The original straight `<line>` from Earth bottom-right (≈859, 624) to Moon top-center (≈1107, 1512) passed through x≈973 at y≈1030 — directly through the "How is this calculated?" text block (x: 256–1024, y: 1030–1303). Users saw the line cutting through the paragraph text.

**Fix**: Replaced `<line>` with a `<path>` using a cubic bezier curve that bends to the right to bypass the info section entirely. The control points are computed dynamically each frame using the weight of the bezier at t≈0.54 (the parameter value where the curve reaches the info section top):

```
Bx(0.54) ≈ 0.097·x1 + 0.343·cp1x + 0.402·cp2x + 0.157·x2 ≥ iR.right + 80px
→ cpX = (iR.right + 80 − 0.097·x1 − 0.157·x2) / 0.745
```

At 1280px desktop viewport this yields cpX ≈ 1147 (123px right of info's right edge at 1024). CP1 at (cpX, y1+18%dy) pulls the curve immediately right; CP2 at (cpX+20, infoMidY) keeps it right through the text band. The curve then returns gracefully to the Moon top-center. Badge is placed at bezier t=0.55 (visual midpoint of the curve arc), floating to the right of the info text at the same y-level.

Additional changes: hidden on viewport widths < 768px; start anchor moved to Earth `bottom-right` (0.58·radius right, 0.46·radius down from Earth center); end anchor at Moon top-center (moonCY − 0.82·moonR).

| File | What changed |
|------|-------------|
| `static/js/earth-moon-line.js` | Full rewrite: `<line>` → `<path>` cubic bezier; dynamic control point math; hidden < 768px |

---

### 2026-04-10 — Earth ↔ Moon Dashed Line with Live Distance

**Feature**: A dashed SVG connector line is drawn between the Earth globe (hero section) and the Moon (space section). It becomes visible on scroll, is drawn progressively as the user scrolls toward the space section, has a continuous flowing dash animation, and shows a live distance badge at the midpoint.

**Implementation details**:

- **New file `static/js/earth-moon-line.js`**: self-contained module that builds an SVG overlay (`position: absolute; top: 0; left: 0; z-index: 4; height: 10000px`) inserted right after the star canvas in `<body>`. Z-index 4 keeps it above the parallax stars (z=0) but below the hero content (z=10) and ISS canvas (z=20).

- **Progressive draw on scroll**: An SVG `linearGradient` mask (`gradientUnits="userSpaceOnUse"`, same x1/y1/x2/y2 as the line) is used as a mask. Its gradient stops transition from white → black at exactly `progress` along the line — so the visible portion of the dashed line grows from 0% to 100% as the user scrolls from 25% into the hero section down to when the space section enters the viewport.

- **Flowing dash animation**: `stroke-dasharray: 5 11` (pattern period 16 px). `stroke-dashoffset` advances by 0.55 px per frame, capped with modulo 16 — dashes appear to flow continuously from Earth toward Moon.

- **Line stroke**: blue→violet `linearGradient` (also `gradientUnits="userSpaceOnUse"`, direction updated each frame to match line angle).

- **Distance badge at midpoint**: SVG `<g>` element containing a rounded rect, a pulsing dot (`<animate>` on `r` and `opacity`), a muted "Earth ↔ Moon" label, and the live distance in bold. Fades in once line is ~42% drawn.

- **Live distance** (`calcMoonKm()`): Simplified Meeus _Astronomical Algorithms_ Ch. 47 formula. Uses Julian date computed from `Date.now()`, Moon mean anomaly (M), Sun mean anomaly (Ms), and Moon mean elongation (D) with 8 perturbation terms. Accurate to ±10–20 km. Updates every 1 second via `setInterval` — the Moon moves ~1 km/s at its slowest, so changes are real and visible.

- **Mobile guard**: If `moon-canvas` has zero dimensions (hidden on narrow screens), line and badge are hidden.

**Wired up in `main.js`**: `initEarthMoonLine()` called right after `initStars()`.

| File | What changed |
|------|-------------|
| `static/js/earth-moon-line.js` | New file — full implementation |
| `static/js/main.js` | Added import + `initEarthMoonLine()` call |

---

### 2026-04-09 — Space Section: Switched to Corquaid API (no rate limits)

**Problem**: Section showed "Live data temporarily unavailable" because The Space Devs free-tier API enforces a hard hourly rate limit (~15 req/hr shared by IP). Development reloads exhausted the quota, and Open Notify (`api.open-notify.org`) was also unreachable (`ERR_CONNECTION_REFUSED`).

**Solution**: Switched data source to `corquaid.github.io/international-space-station-APIs/JSON/people-in-space.json` — a GitHub Pages CDN JSON that has no rate limits and provides richer data than Open Notify: name, agency abbreviation, spacecraft name, and an `iss` boolean for easy station tagging.

**Architecture**:
- `server.js` proxy (`/api/crew`) now fetches from `corquaid.github.io` with 15-min server-side cache. Browser always hits localhost — external availability is irrelevant to users.
- `space.js` updated to consume the new `{ people: [{name, agency, spacecraft, iss}] }` format. Groups cards by spacecraft, determines ISS/Tiangong/other from the `iss` field and spacecraft name.
- localStorage cache (6 h TTL, key `space_crew_cache_v4`) persists data across page loads.
- Stale-data-on-error: `renderError()` only replaces content when no cards are already visible.

| File | What changed |
|------|-------------|
| `server.js` | Proxy URL changed to `corquaid.github.io`; removed 429-specific error path |
| `static/js/space.js` | Full rewrite to corquaid data format; localStorage cache v4; stale-data-on-error |

---

### 2026-04-09 — Space Section: Reliable Data Display

**Problem**: "Currently in Space" section sometimes showed nothing. Root cause was the Space Devs free-tier API rate limit (15 req/hr). On repeated page loads the API returned HTTP 429, and the old code would either clear the display or hang on the loading spinner indefinitely.

**Fixes in `static/js/space.js`**:

1. **localStorage cache (6 h TTL)** — successful API responses are written to `localStorage` under key `space_crew_cache`. On every page load, cached data is rendered immediately before any network request fires. Users see crew data even when the API is unavailable.

2. **No blank-screen on error** — `renderError()` now checks for existing `.craft-card` elements first. If cards are already visible (from cache or a prior fetch), they stay on screen; error state is only shown when there is truly nothing to display.

3. **Graceful 429 handling** — HTTP 429 responses are caught before the generic error handler. The response body contains the exact retry delay ("Expected available in N seconds") — the code parses that value and uses it (+ 5 s buffer) as the backoff delay instead of guessing.

4. **Exponential backoff** — retries start at 30 s and double on each failure, capped at 30 min. Reset to 30 s after any successful fetch.

5. **Refresh interval 5 min → 15 min** — reduces request frequency to stay within the free-tier quota under normal usage.

| File | What changed |
|------|-------------|
| `static/js/space.js` | localStorage caching, stale-data-on-error, 429 body parsing, exponential backoff, 15 min refresh |

---

### 2026-04-09 — Navbar Logo Fix

**Changes**:
- Logo height `32px → 24px`
- Removed the padding shrink on scroll: `#navbar.scrolled { padding: 0.7rem 0 }` was collapsing the navbar height when the user scrolled down, causing the logo to visually jump upward — removed that rule so padding stays fixed at `1.35rem 0` regardless of scroll state

| File | What changed |
|------|-------------|
| `static/css/navbar.css` | `.nav-logo-img` height `32px → 24px`; removed `#navbar.scrolled` padding override |

---

### 2026-04-09 — HD Moon, Rounded Stars, Full-Page Starfield

**Goals**: (1) Upgrade moon to true HD quality. (2) Fix Three.js star particles being square — make them circular. (3) Add a consistent starfield across the entire page background (previously only visible inside the Three.js canvas areas).

**Moon HD upgrade**:
- Downloaded NASA LROC 4K texture (4096×2048) from `svs.gsfc.nasa.gov/4720` as a 16-bit TIFF, converted to JPEG at quality 85 → `static/img/moon_4k.jpg` (2.7 MB, replaces 447 KB 2K version)
- `moon.js`: switched loader from `moon_2k.jpg` → `moon_4k.jpg` for both color map and bump map
- Removed `Math.min(window.devicePixelRatio, 2)` cap — now uses full device DPR so the canvas renders at native resolution on 3× and 4× displays
- Enabled explicit `minFilter = LinearMipmapLinearFilter` and `magFilter = LinearFilter` for trilinear filtering; anisotropy already maxed
- `bumpScale` increased 1.8 → 2.2 for slightly more visible crater relief

**Round stars** (both `globe.js` and `moon.js`):
- `PointsMaterial` without a texture renders square sprites by default
- Added a `_makeStarTexture()` helper (moon.js) / inline equivalent (globe.js): draws a 32×32 radial gradient on a canvas and wraps it in `THREE.CanvasTexture` — produces soft circular star discs
- Material updated: `map: starTex, transparent: true, alphaTest: 0.01, depthWrite: false, size: 0.22`

**Full-page background starfield** (`ui.js`):
- Added `initBgStars()` — creates a `position: fixed; z-index: 0` canvas (`#bg-stars`) prepended to `<body>`
- Fills it with randomly placed circular `ctx.arc` dots (density: ~1 star / 3000 px²; radius 0.3–1.2 px; opacity 0.2–0.75)
- Redraws on window resize to always fill the viewport
- `#space` background gradient changed from solid `#020617` stops → `transparent` so the fixed canvas shows through (the section's violet tint comes from `#space-glow` overlay, which is preserved)
- All other sections (stats, info, footer) already had no explicit background — stars visible there automatically

| File | What changed |
|------|-------------|
| `static/img/moon_4k.jpg` | New file — 4K NASA LROC moon texture (2.7 MB) |
| `static/js/moon.js` | 4K texture, full DPR renderer, trilinear filtering, bumpScale 2.2, round star sprite |
| `static/js/globe.js` | Round star sprite (same radial-gradient canvas technique) |
| `static/js/ui.js` | `initBgStars()` — full-page fixed canvas with circular star dots |
| `static/css/space.css` | `#space` background stops `#020617` → `transparent` to reveal bg-stars canvas |

---

### 2026-04-09 — Moon Enlarged +20%

**Changes**:

| File | What changed |
|------|-------------|
| `static/css/space.css` | `.space-moon-col` desktop `min-height` `875px → 1050px`; mobile `525px → 630px` |

**Result**: Canvas 20% taller → moon pixel diameter grows ~20% (from ~731px to ~877px). Position unchanged. No clipping.

---

### 2026-04-09 — Moon Left-Clip Fix & Rightward Shift

**Problem**: At viewport widths narrower than ~1100px the moon's left edge fell outside the canvas boundary (canvas-x < 0), causing visible left-side clipping.

**Root cause**: With `moon.position.x = -2.0`, the moon center sat 2 world-units left of the 3D origin. As the viewport narrows, the canvas shrinks (canvas ≈ column_width + 400px) while the moon radius stays at 366px, so the left edge crept past canvas-x = 0.

**Fix**: `moon.position.x` changed `-2.0 → 1.5`.

| Viewport | Left-edge canvas-x before | Left-edge canvas-x after |
|----------|--------------------------|--------------------------|
| 1280px   | 83px (marginal)          | 226px ✓                  |
| 1024px   | 8px (nearly clipped)     | 140px ✓                  |
| 768px    | −45px (clipped!)         | 130px ✓                  |

The rightward shift also moves the visible moon face ~20% further into the right half of the screen, as requested.

**Changes**:

| File | What changed |
|------|-------------|
| `static/js/moon.js` | `moon.position.x` `-2.0 → 1.5` |

---

### 2026-04-09 — Moon Enlarged +25%

**Changes**:

| File | What changed |
|------|-------------|
| `static/css/space.css` | `.space-moon-col` desktop `min-height` `700px → 875px`; mobile `420px → 525px` |

**Result**: Canvas 25% taller → moon pixel diameter grows from ~586px to ~731px (25% bigger) at same 84% fill ratio. Top and bottom remain fully unclipped.

---

### 2026-04-09 — Moon Doubled in Size, Repositioned for Dramatic Composition

**Goal**: Make the moon appear approximately 100% bigger, fully visible top and bottom, with the right side bleeding off-screen and the left edge reaching roughly the center of the viewport.

**Math**:
- `MOON_R` doubled: `3.2 → 6.4` (world-space radius)
- To prevent vertical clipping at 84% fill: `CAM_Z` increased `6.5 → 12` — formula: `MOON_R / (fill_ratio × tan(FOV/2)) = 6.4 / (0.84 × 0.637) = 12`
- Moon pixel diameter at desktop: `700px × 0.836 = 586px` vs previous `480px × 0.773 = 371px` → **58% larger pixel size** (column also taller; overall visual impact roughly 2×)
- Moon position: `x: 3.0 → -2.0` — shifts moon left so left edge reaches viewport-x ≈ 720px (≈56% from left), right edge at ≈1305px (bleeds 25px past 1280px viewport right)
- `BLEED_PX`: `150 → 400` — larger canvas overhang for the right-bleed effect
- Column heights: desktop `480px → 700px`, mobile `320px → 420px` — taller canvas for larger moon

**Changes**:

| File | What changed |
|------|-------------|
| `static/js/moon.js` | `MOON_R` `3.2 → 6.4`; `CAM_Z` `6.5 → 12`; `BLEED_PX` `150 → 400`; `moon.position.x` `3.0 → -2.0` |
| `static/css/space.css` | `.space-moon-col` `min-height` desktop `480px → 700px`; mobile `320px → 420px` |

**Result**: Moon is dramatically larger, fully visible (no top/bottom clipping), right edge bleeds off-screen, left edge reaches ~56% from viewport left. 2K texture quality and bump mapping preserved.

### 2026-04-08 — Logo Replaced, Moon Vertical Clip Fixed & Centered

**Changes**:

| File | What changed |
|------|-------------|
| `static/img/OurUniverse.svg` | New logo file added (viewBox 501.43×65.9, grayscale wordmark with planet icon) |
| `static/index.html` | Navbar logo replaced — removed `.nav-logo-icon` span + inline SVG circles + `.nav-logo-text` span; replaced with `<img src="img/OurUniverse.svg" class="nav-logo-img">` |
| `static/css/navbar.css` | Removed `.nav-logo-icon`, `.nav-logo-glow`, `.nav-logo-svg`, `.nav-logo-text` rules; added `.nav-logo-img { height: 32px; width: auto; display: block }` |
| `static/js/moon.js` | `CAM_Z` changed `5.5 → 6.5` — at 5.5 the moon filled ~92% of canvas height, clipping at top and bottom at every viewport size; at 6.5 the moon fills ~77% (comfortable 11% margin each side). Removed earlier `BLEED_Y_PX` approach which caused the canvas to overflow the section in mobile single-column layout. `resize()` simplified back to `h = parent.clientHeight` only. |
| `static/css/space.css` | `.space-inner` `align-items` changed `stretch → center` so the moon column aligns its center with the content column center; `.space-moon-col` `align-self: stretch` replaced with `overflow: visible` |

**Result**: Moon is fully visible vertically (no hard rectangular clip at any viewport size), moon center aligns with the vertical center of the section content, and the navbar shows the new OurUniverse SVG logo.

### 2026-04-08 — Dynamic Counter: Birth & Death Event Tickers

**Problem**: The counter only advanced monotonically at the net growth rate (~+1 every 430 ms), which felt static.

**Changes**:

| File | What changed |
|------|-------------|
| `static/js/counter.js` | Full rewrite of tick mechanism. Reel expanded from 2 sets (20 cells) to **3 sets (30 cells)** so each digit can scroll both forward and backward. Added `rollBack(digit)` to complement `rollTo(digit)` — backward roll decrements `slot`, snaps `slot += 10` when it drops below set B (< 10). Two new timers: **birth** (+1 every ~222 ms, `rollTo`) and **death** (-1 every ~500 ms, `rollBack`). Net display rate ≈ +2.5/s vs real +2.33/s; drift corrected silently every 60 s if drift > 20. Country mode keeps the original smooth 500 ms forward-only poll unchanged. |
| `static/css/counter.css` | Transition reduced **0.42 s → 0.30 s** so rapid birth events (222 ms) don't pile up visually. Updated comment: `× 20` → `× 30` cells. |

**Result**: The last 1–2 digits are in constant motion — mostly ticking up (births) with occasional single-digit dips (deaths). Upper digits rarely change. Country mode is unaffected.

### 2026-04-08 — Country Selector Dynamic Width, ISS Longer, Stats 3-col, Moon HD & Repositioned

**Changes**:

| File | What changed |
|------|-------------|
| `static/css/selector.css` | `#country-selector` no longer has a fixed width — uses `fit-content` so it shrinks/grows with the selected label. `.sel-trigger` changed to `width: fit-content`. `.sel-name` changed to `flex: 0 1 auto` with `max-width`. `.sel-dropdown` changed to `right: auto; min-width: max(100%, 230px)` so the panel is always at least 230 px wide regardless of trigger width. |
| `static/js/globe.js` | `ISS_SPEED_FAST` reduced from `0.046` to `0.035` — ISS now spends ~30% longer behind Earth (cumulative ~60% longer vs original `0.060`) |
| `static/index.html` | Removed "Net growth per year" (`~73.5M`) stat item from `#stats` |
| `static/css/stats.css` | `.stats-grid` changed from `repeat(4, 1fr)` (responsive) to a fixed `repeat(3, 1fr)` single-breakpoint grid; `max-width` narrowed from `52rem` to `40rem` |
| `static/js/moon.js` | Full material upgrade: `SphereGeometry` segments raised `64→128` for smoother bump. Switched from `MeshPhongMaterial` to `MeshStandardMaterial` (`roughness: 0.96, metalness: 0`). Added `bumpMap` (second load of `moon_2k.jpg` with `LinearSRGBColorSpace`) + `bumpScale: 1.8` for visible crater depth. Anisotropy set to renderer max for sharp oblique edges. Sun repositioned to `(-9, 1.5, 3)` for grazing-angle light that maximises crater rim shadows; ambient reduced `0.14→0.08`. Moon position moved `x: 1.9 → 2.28` (+20%). |

### 2026-04-08 — UI Cleanup & ISS Occlusion Duration

**Changes**:

| File | What changed |
|------|-------------|
| `static/js/globe.js` | `ISS_SPEED_FAST` reduced from `0.060` to `0.046` — ISS now spends ~30% longer behind Earth before re-emerging |
| `static/js/moon.js` | Removed space shuttles (3 orbiting) and astronauts (4 floating) from scene, render loop, and module — Moon + starfield only |
| `static/index.html` | Removed "Based on UN 2024 data" from hero badge (now "Updating live" only); removed `<a class="nav-cta">Live Data</a>` button from navbar; renamed site to "Franktastic" (nav logo + footer); removed `.info-cards` block (3 cards) from `#info` section |
| `static/css/hero.css` | `.hero-label`: `color` → `#ffffff`, `font-weight` → `400` (was `#64748b` / `500`) |

### 2026-04-08 — Epic Space Section: Spinning Moon, Shuttles & Visual Parity

**Problem**: The space section had a fully built `moon.js` with a Moon, ISS, and astronauts — but `initMoon()` was never called, `#moon-canvas` had no CSS, and atmosphere halos had a positioning bug (at world origin instead of the moon's offset `(1.2, -0.6, 0)`).

**Changes**:

| File | What changed |
|------|-------------|
| `static/js/main.js` | +2 lines: import & call `initMoon()` |
| `static/index.html` | +2 lines: `#space-glow` and `#space-fade` overlay divs |
| `static/css/space.css` | +30 lines: canvas positioning, glow/fade overlays, `.space-inner` z-index, overflow hidden |
| `static/js/moon.js` | Full rewrite (~330 lines) |

**`moon.js` details**:
1. Added 6000-point starfield (matching `globe.js`)
2. Fixed halo position bug — `halo.position.copy(moon.position)`
3. Matched halo proportions to Earth (scales 1.055/1.115, opacities 0.11/0.04)
4. Added lerp-based smooth rotation (LERP_SLOW = 0.035)
5. Added `rotation.order = 'YXZ'` and bumped ambient light to 0.14
6. New `createShuttle()` — detailed orbiter model (fuselage, nose, delta wings, heat shield, tail, cockpit, cargo bay, 3 SSMEs, OMS pods, belly tiles)
7. 3 shuttle instances orbiting at radii 5.8/6.5/7.8 with different speeds and tilts
8. Shuttle animation: elliptical orbits, face direction of travel, gentle wobble

### 2026-04-08 — HD Moon Texture Upgrade

**Problem**: Moon texture was `moon_1024.jpg` from Three.js examples — only 1024px wide, visibly blurry especially on retina/high-DPI screens.

**Fix**: Replaced with NASA Lunar Reconnaissance Orbiter Camera (LROC) 2K color map (2048px, 447KB) downloaded from NASA SVS and hosted locally at `static/img/moon_2k.jpg`. Added `tex.colorSpace = THREE.SRGBColorSpace` for correct color rendering. Hosted locally because NASA's SVS server blocks cross-origin requests (CORS).

| File | What changed |
|------|-------------|
| `static/js/moon.js` | Texture path changed to `img/moon_2k.jpg` + colorSpace set |
| `static/img/moon_2k.jpg` | New file: 2K NASA LROC moon texture (447KB) |
| `changelog.md` | Updated external APIs table + added this entry |

### 2026-04-08 — Moon Position & Visibility Fix

**Changes**: Removed top fade overlay that was partially obscuring the moon. Moved moon further right (off-center) and centered it vertically so it's fully visible.

| File | What changed |
|------|-------------|
| `static/js/moon.js` | Moon position changed from `(1.2, -0.6, 0)` to `(1.9, 0, 0)` — 20% more right, vertically centered |
| `static/css/space.css` | Removed `#space-fade` styles (top gradient that was covering the moon) |
| `static/index.html` | Removed `<div id="space-fade">` element |

### 2026-04-08 — Camera Distance Fix for Full Moon Visibility

**Problem**: Moon (radius 3.2) was being clipped top/bottom by the camera frustum. Camera at z=6.8 with FOV 42° only showed ±2.61 units vertically — cutting off ~0.6 units on each side.

**Fix**: Increased `CAM_Z` from 6.8 to 9.5. Visible vertical range is now ±3.65 units, fully covering the moon and its halos (radius 3.57).

| File | What changed |
|------|-------------|
| `static/js/moon.js` | `CAM_Z` changed from `6.8` to `9.5` |

### 2026-04-08 — ISS Moved to Earth Orbit with Occlusion

**What changed**: ISS now orbits the Earth (hero section) instead of the Moon. Implements correct visibility: visible when in front of Earth, hidden when behind. When hidden, orbit speed increases 6× (500%) so it re-emerges quickly. One frame before it would become visible again at fast speed, speed snaps back to normal so it doesn't overshoot.

**Occlusion logic** (in `globe.js` render loop):
- ISS occluded when `issZ < 0` (behind Earth's centre plane) AND projected screen distance `√(x²+y²) < EARTH_R` (within Earth's disk)
- Occluded → `iss.visible = false`, advance angle at `ISS_SPEED_FAST`
- Look-ahead check: if next fast-speed step would exit occlusion, use normal speed instead
- Visible → `iss.visible = true`, normal speed, position/rotation updated

| File | What changed |
|------|-------------|
| `static/js/globe.js` | Added `createISS()`, ISS setup, orbit state (`ISS_ORBIT_R=3.3`, `ISS_SPEED_NORM=0.010`, `ISS_SPEED_FAST=×6`), and full occlusion logic in render loop |
| `static/js/moon.js` | Removed `createISS()` function, ISS creation, and ISS animation from render loop |

### 2026-04-08 — ISS Speed & Varying Orbit

**Changes**:
- Normal (visible) speed halved: `ISS_SPEED_NORM` `0.010` → `0.005`
- Fast (occluded) speed kept the same: `ISS_SPEED_FAST` stays `0.060` (decoupled from NORM)
- Added 4 orbit presets with different Y-inclinations — switches preset each time ISS enters occlusion (behind Earth, so no visible jump). All presets maintain left→right direction:
  - Preset 0: standard (`yAmp=0.55, yFreq=1.2`)
  - Preset 1: high inclination (`yAmp=1.10, yFreq=0.7`)
  - Preset 2: nearly equatorial (`yAmp=0.15, yFreq=1.8`)
  - Preset 3: medium inclination (`yAmp=0.80, yFreq=1.0`)

| File | What changed |
|------|-------------|
| `static/js/globe.js` | `ISS_SPEED_NORM` halved, `ISS_SPEED_FAST` decoupled, added `ISS_ORBITS` presets + `_issOrbitIdx`/`_wasOccluded` state, orbit switch on occlusion entry |

### 2026-04-08 — ISS Size, Orientation, Speed & Shuttle Section Removed

**Changes**:
- ISS 25% smaller: `group.scale.setScalar` `0.38` → `0.285`
- ISS normal speed 25% slower: `ISS_SPEED_NORM` `0.005` → `0.00375` (occluded speed unchanged)
- ISS orientation fixed: replaced manual `rotation.y/x` hacks with a proper nadir frame — truss (local X) aligned to orbit cross-track, local Y pointing away from Earth (zenith), computed via `crossVectors` each frame using a reused `Matrix4`
- Removed shuttle launch section entirely: HTML `#shuttle-scene` div, `shuttle.css` link, `initShuttle()` import and call

| File | What changed |
|------|-------------|
| `static/js/globe.js` | Scale `0.285`, speed `0.00375`, nadir orientation via `_issRotMat` + `makeBasis` |
| `static/index.html` | Removed `#shuttle-scene` HTML block and `shuttle.css` `<link>` |
| `static/js/main.js` | Removed `import { initShuttle }` and `initShuttle()` call |

### 2026-04-08 — ISS Orientation Fix: Flat Side Toward Earth & No Flicker

**Problems**:
1. ISS was visibly spinning around its own axis — solar panels had `c.rotation.y += 0.003` accumulating each frame.
2. Flat side (solar panel array) not facing Earth — the `makeBasis` call used a left-handed basis (`_right, _nadir, _fwd`), putting the solar panel face normals (±Z) along the velocity direction instead of toward Earth.
3. ISS flickered when entering/exiting Earth's disk — no hysteresis on the occlusion boundary.

**Root cause of orientation bug**: `_zenith` was computed as `-normalize(issPos)` (actually nadir/toward Earth, despite the name), then used as local Y with `makeBasis(_right, _zenith, _fwd)`. This produced a left-handed basis and placed solar panel face normals along the orbit velocity vector.

**Fixes** (all in `static/js/globe.js`):

| Fix | Change |
|-----|--------|
| Orientation | `_zenith = normalize(+issPos)` (away from Earth, correct); `makeBasis(_right, _fwd, _zenith)` — right-handed basis, local Z = zenith → solar panel face (±Z normal) points toward/away from Earth ✓ |
| Self-rotation | Removed `iss.children.forEach(c => { if (c.userData.solarPanel) c.rotation.y += 0.003; })` |
| Flicker | Hysteresis on occlusion: hide when `projDist < EARTH_R × 0.90`, show again only when `projDist > EARTH_R × 1.10`; look-ahead check also uses `× 1.10` for consistency |

### 2026-04-08 — ISS Smaller, Floats Over Counter & Earth Mouse Parallax

**Changes**:

1. **ISS 25% smaller**: scale `0.285` → `0.214`
2. **ISS floats over hero-content**: Moved ISS to a separate `#iss-canvas` overlay (`z-index: 20`, `pointer-events: none`) rendered by a second `WebGLRenderer` using the same `PerspectiveCamera`. `issScene` holds only the ISS; lights are mirrored. Globe stays in the original `scene` at `z-index` below the text. This means the ISS visually passes in front of the counter and labels, making it feel embedded in the scene rather than behind the UI.
3. **Earth mouse parallax**: On `mousemove` over the hero, the globe nudges by ±0.07 rad (X) and ±0.035 rad (Y) via lerp (`t=0.04`) toward the normalized cursor offset. Effect is disabled when zoomed to a country so it doesn't fight the zoom rotation. Resets smoothly to 0 on `mouseleave`.

| File | What changed |
|------|-------------|
| `static/js/globe.js` | ISS scale `0.214`; `issScene` + `issRenderer` (`#iss-canvas`); mirrored lights in `issScene`; ISS moved to `issScene.add()`; `issRenderer.render()` in loop; mouse parallax state + handler + lerp applied to `_earth.rotation` |
| `static/index.html` | Added `<canvas id="iss-canvas">` after `#hero-fade` |
| `static/css/hero.css` | Added `#iss-canvas` rule: `position:absolute; inset:0; z-index:20; pointer-events:none` |

### 2026-04-08 — ISS Smooth Limb Fade (Slide Behind Earth)

**Problem**: ISS was snapping instantly to invisible when it reached Earth's limb on the right side, and appearing instantly on the left side — a harsh pop instead of a natural "slides behind Earth" motion.

**Root cause of pop**: The previous binary `iss.visible = true/false` toggle had no transition zone. The `hideR/showR` hysteresis only prevented flicker at a fixed boundary; it didn't create a smooth fade.

**Fix**: Replaced binary visibility with a **segment-distance fade**. Each frame, compute the minimum distance from the camera→ISS line segment to Earth's centre (`dSeg`). This metric naturally yields the correct answer for all orbit positions:
- ISS in front: `t_closest > 1` → clamped to ISS position → `dSeg = orbit_r ≥ 3.3 > R` → fully visible
- ISS at limb: `dSeg = R` → alpha = 0 (boundary of hidden)
- ISS behind: `dSeg < R` → alpha = 0 (hidden)

Fade band: `EARTH_R` (alpha=0) → `EARTH_R × 1.18` (alpha=1). The ~18° arc this spans takes ~1.4 s at 60 fps — a smooth, natural fade. The fade applies symmetrically on both sides (slide-behind right, emerge left).

**Implementation**: `issCanvas.style.opacity = issAlpha` — CSS opacity on the overlay canvas element. Far simpler and more reliable than modifying Three.js material opacity (which requires `needsUpdate` for shader recompilation). No material changes needed at all. Binary `iss.visible = false` is still set when fully occluded (`_rayHitsSphere(EARTH_R) = true`) as a performance fast-path, and to trigger orbit-preset switching and fast-advance logic.

| File | What changed |
|------|-------------|
| `static/js/globe.js` | Replaced `hideR/showR/_rayHitsSphere` block with segment-distance `_dSeg` + `issAlpha` calculation; `issCanvas.style.opacity = issAlpha` replaces binary toggle; `_rayHitsSphere(EARTH_R)` still used for fully-occluded fast-path and look-ahead |

### 2026-04-08 — ISS Occlusion: Hysteresis Radius Bug Fix

**Problem**: `hideR = EARTH_R × 0.97` was smaller than Earth's actual radius (2.5). This created a band between `0.97R` and `1.0R` where the ray from camera to ISS already passes through the real Earth sphere, but `_rayHitsSphere(hideR)` returns false — so the ISS was shown floating inside the globe. Proven by exhaustive test: 4000 orbit positions (1000 angles × 4 presets) with the old values produced violations; with the fix, 0 violations.

**Fix**: `hideR = EARTH_R × 1.01` — the ray must miss a sphere 1% larger than Earth for the ISS to show. `showR = EARTH_R × 1.06` — ISS reappears only when safely past Earth's edge. The gap (1.01→1.06) is the hysteresis zone preventing limb flicker. `hideR > EARTH_R` is a hard invariant: there is no position where the ray hits Earth but the ISS is shown.

| File | What changed |
|------|-------------|
| `static/js/globe.js` | `hideR` changed from `0.97×R` to `1.01×R`; `showR` from `1.03×R` to `1.06×R` |

### 2026-04-08 — ISS Occlusion: Proper Ray-Sphere Intersection

**Problem**: ISS was visible when it should be hidden (or vice versa) because the occlusion check was geometric shorthand (`projDist < perspR`) rather than exact. Two failure modes:
1. The XY-distance check didn't account for Earth being offset by the mouse-push effect — ISS would clip through the edge of Earth when the globe was nudged sideways.
2. Even when Earth was centred, the perspective-corrected radius formula was approximate and failed at certain orbit inclinations near the limb.

**Fix**: Replaced all occlusion logic with a proper **ray-sphere intersection** (`_rayHitsSphere`). Given the camera position, ISS position, and Earth centre (including its current `position.x/y` from the mouse push), it solves the quadratic `|C + t(P-C) - S|² = r²` and returns true only when the entry point `t` falls between camera (t=0) and ISS (t=1). This is geometrically exact for any camera position, orbit inclination, or Earth offset. Hysteresis: hide radius = `0.97×R`, show radius = `1.03×R`. Same function used in the look-ahead check.

| File | What changed |
|------|-------------|
| `static/js/globe.js` | Replaced `projDist`/`perspR` block with `_rayHitsSphere()` calls; added `_rayHitsSphere` utility function; look-ahead check updated to use same function |

### 2026-04-08 — ISS Occlusion Fix & Earth Hover Push Effect

**Problems**:
1. ISS was visible when it should be hidden behind Earth (and vice versa near the edges). Root cause: the occlusion radius check used the raw world-space `EARTH_R = 2.5`, but because the ISS is behind Earth at `z < 0` while the camera is at `z ≈ 6.5`, perspective means Earth's visible silhouette is wider at that depth. At `issZ = -3`, the correct occlusion radius is `~3.65`, not `2.5` — so the ISS was appearing ~46% too early when coming around Earth's edges.
2. Earth appeared to stop/reverse rotating when the mouse moved across it. Root cause: the parallax effect added `±0.07 rad` directly to `_earth.rotation.y`, which is 100× the per-frame auto-rotation (`0.0007 rad`). Moving the mouse from one side to the other created a delta that overwhelmed the auto-rotation, making Earth appear to spin backwards.

**Fixes**:

| Fix | Change |
|-----|--------|
| ISS occlusion | Replaced `EARTH_R` in occlusion check with perspective-corrected `perspR = EARTH_R × (camZ − issZ) / camZ`. Applied to both the main check and the look-ahead check in the occluded branch. |
| Earth hover | Removed rotation-based parallax (`mX`/`mY` added to `rotation.y/x`). Replaced with a positional push: `_earth.position.x/y` offset by `±0.18/±0.09` world units based on cursor. Earth auto-rotation is now completely unaffected by mouse. |

| File | What changed |
|------|-------------|
| `static/js/globe.js` | `perspR` calculation for occlusion; `_earth.position.x/y` push instead of rotation offset |

### 2026-04-08 — Rebrand to frankleurs.nl + Nav cleanup + Counter fix

**Changes**:

1. **Rebrand to frankleurs.nl** — All occurrences of "Franktastic" replaced with "frankleurs.nl" in the page title, Open Graph tags, Twitter Card tags, nav logo, footer brand, and nav aria-label.

2. **Nav: transparent on scroll** — Removed `.glass` class from the scroll handler in `ui.js`. The navbar no longer gains a frosted-glass background when scrolling; it stays fully transparent at all times.

3. **Nav: links removed** — Removed the `<ul class="nav-links">` block from the HTML. Only the logo remains in the navbar.

4. **Counter bug fix** — Added `snapPending` guard per reel. Previously, rapid birth/death events fired before a CSS transition completed, registering two `transitionend` listeners on the same reel. Both fired on the single `transitionend` event, double-snapping `slot` outside the visible window and causing digits to disappear. Fix: single `doSnap()` callback gated by `snapPending` flag; `slot` normalized via `((slot % 10) + 10) % 10 + 10` to always land in set B.

5. **Counter pacing** — `BIRTH_MS` `~222ms` → `500ms`; `DEATH_MS` `~500ms` → `3000ms`. Counter now advances calmly at ~2 ticks/s with an occasional backward flick every 3 s instead of 6+ changes/s. Drift correction interval `60_000ms` → `30_000ms`.

6. **Artemis II in space section** — Added `EXPD_URL` (expedition endpoint) with 60-min cache. Crew assignment now uses expedition data authoritatively: CNSA/CMSA → Tiangong; expedition lookup → ISS or Tiangong; not in expedition → grouped by `last_flight` timestamp (same timestamp = same vehicle, so Artemis II crew share one card); no expedition data → ISS fallback.

7. **Footer credits removed** — Removed `<p class="footer-credit">` (data source line) and `<p class="footer-disclaimer">` (estimates disclaimer) from the footer.

8. **Moon 10% right** — Moon position `(2.28, 0, 0)` → `(2.51, 0, 0)`.

9. **Country selector chevron** — `.sel-chevron` color `#475569` → `#ffffff`.

| File | What changed |
|------|-------------|
| `static/index.html` | Title, OG/Twitter tags → "frankleurs.nl"; nav logo text and aria-label → "frankleurs.nl"; footer brand → "frankleurs.nl"; removed `<ul class="nav-links">`; removed footer credit + disclaimer |
| `static/js/ui.js` | Scroll handler: removed `glass` from `classList.add/remove` |
| `static/js/counter.js` | `snapPending` guard + `doSnap()` + `maybeScheduleSnap()`; `BIRTH_MS=500`, `DEATH_MS=3000`, drift correction `30_000ms` |
| `static/js/space.js` | Full rewrite: added `EXPD_URL` + `getExpeditionMap()` with TTL cache; expedition-based craft assignment; dynamic craft cards for non-station missions |
| `static/js/moon.js` | Moon position `(2.51, 0, 0)` |
| `static/css/selector.css` | `.sel-chevron` color `#ffffff` |

### 2026-04-08 — Space section: 2-column layout + Artemis II fix + accuracy

**Changes**:

1. **Space section 2-column layout** — `#space` section restructured into a CSS grid with content on the left and the moon on the right. `#moon-canvas` moved from `position: absolute` over the full section into a dedicated `.space-moon-col` right column. Moon now centered in its column (`moon.position.set(0,0,0)`). Mobile: single column, moon stacks below content. `#space-glow` shifted to `at 78% 55%` to align with moon's new position.

2. **Artemis II crew fix** — Root cause: when the expedition endpoint returned 429 (rate-limited), the fallback assigned all non-CNSA astronauts to `'iss'`, hiding Artemis II crew inside the ISS card. Fixed by changing the no-expedition-data fallback from `craftKey = 'iss'` to `craftKey = \`mission_${p.last_flight}\``. Now non-station missions always get their own card grouped by launch timestamp, regardless of expedition data availability.

3. **Label accuracy** — Changed "people currently orbiting Earth" → "people currently in space" to correctly describe deep-space missions like Artemis II (lunar trajectory, not Earth orbit).

4. **Text alignment** — `.space-header`, `.space-count-wrap`, `.space-meta` changed from center-aligned to left-aligned to match the 2-column layout.

| File | What changed |
|------|-------------|
| `static/index.html` | Space section restructured: `.space-content` left col + `.space-moon-col` right col; `#moon-canvas` moved inside `.space-moon-col` |
| `static/css/space.css` | `.space-inner` → `display: grid; grid-template-columns: 1fr 1fr`; `.space-moon-col` added; `#moon-canvas` fills col; text-align → left; glow shifted right; mobile breakpoint at 767px |
| `static/js/space.js` | Fallback `craftKey = 'iss'` → `craftKey = \`mission_${p.last_flight}\``; label "orbiting Earth" → "in space" |
| `static/js/moon.js` | `moon.position.set(0, 0, 0)` (centered in column) |

### 2026-04-08 — Space section: mission names, moon fix, card cleanup

**Changes**:

1. **Mission name in card titles** — Added a third API call per unique launch date (`/launch/?net__gte=…&net__lte=…`) that resolves the mission name (e.g. "Artemis II", "Crew-12", "Soyuz MS-28", "Shenzhou 21"). Results cached 24 h. Card title now shows the mission name instead of the station name. Sub-label still shows "Int'l Space Station · N people aboard" or "Tiangong · N people aboard" for station missions. Falls back to agency abbreviations if the launch lookup fails.

2. **Moon clipping fixed** — Added dynamic FOV calculation in `moon.js` `resize()`. Formula: `halfFOV = atan(moonEdge / (CAM_Z × min(aspect, 1)))` × 1.06 padding. This zooms out the camera just enough to contain the full moon + halos regardless of canvas aspect ratio. Previously the moon was clipped on portrait or near-square canvases.

3. **Right column wider** — `grid-template-columns: 1fr 1fr` → `1fr 1.5fr`. Right column is 50 % wider than the left, giving the moon more horizontal space and a landscape aspect ratio (verified 1.92 at preview width).

4. **Reduced right spacing** — Section `padding` changed from `5rem 1.5rem 6rem` → `5rem 0.5rem 6rem 1.5rem` (less right padding).

5. **Time in space removed from cards** — Astronaut rows no longer show the "Xd Yh" duration badge. Only name + agency abbreviation shown.

6. **Max 2 craft card columns** — Removed the `@media (min-width: 900px) { repeat(3, 1fr) }` rule. Cards are now at most 2 columns wide.

| File | What changed |
|------|-------------|
| `static/js/space.js` | New `getMissionName()` with 24 h cache; grouped by timestamp with `station` tag; `renderData` takes `missionNames` param; mission name used as card title; time-in-space removed from astronaut rows; `refresh()` runs phase-2 name lookups |
| `static/js/moon.js` | `resize()` sets `camera.fov` dynamically based on aspect ratio to prevent clipping |
| `static/css/space.css` | `grid-template-columns: 1fr 1.5fr`; `gap: 2rem`; `align-items: stretch`; `max-width: 78rem`; section padding right `0.5rem`; 3-col craft grid rule removed |

### 2026-04-08 — Moon 2× bigger, right bleed, footer centered

**Changes**:

1. **Moon ~100% bigger** — `CAM_Z` reduced from `9.5` → `5.5` (camera closer = moon appears ~73% larger on screen). Fixed `FOV = 65°` replaces the previous dynamic FOV (which always fit the moon — now the moon intentionally overflows).

2. **Moon bleeds off right viewport edge** — Canvas is rendered `BLEED_PX = 150` pixels wider than the column by computing `w = parent.clientWidth + BLEED_PX` in `resize()`. Three.js sets `canvas.style.width` to this wider value, physically extending the canvas past the column's right boundary. `#space { overflow: visible }` allows the canvas to extend past the section; `body { overflow-x: hidden }` (set in main.css) clips it cleanly at the viewport right edge. Moon is offset to `(1.0, 0, 0)` so it sits right-of-center and the bleed is visible.

3. **Footer horizontally centered** — Removed `flex-direction: row; justify-content: space-between` from the desktop media query, replaced with `justify-content: center`. Since only the brand item remains after previous footer cleanup, it now appears centered at all viewport sizes.

| File | What changed |
|------|-------------|
| `static/js/moon.js` | `CAM_Z = 5.5`, `FOV = 65` (fixed), `BLEED_PX = 150`; `resize()` uses `parent.clientWidth + BLEED_PX`; `moon.position.set(1.0, 0, 0)` |
| `static/css/space.css` | `#space { overflow: visible }`; `#moon-canvas` simplified to `position: absolute; top:0; left:0` (width/height driven by Three.js) |
| `static/css/footer.css` | Desktop media query: `justify-content: center` instead of row/space-between |

---

### 2026-04-09 — Artemis II Orion Orbiting the Moon

**Goal**: Add the Artemis II Orion capsule orbiting the Moon in the same style as the ISS orbits Earth — nadir-pointing, smooth limb fade, fast-advance during occlusion, varying orbit presets.

**Spacecraft model** (`createOrion()`):
- Blunt CM cone + heat shield disk
- Cylindrical Service Module (gold) with 4 longitudinal rib stripes
- Engine nozzle + SM RCS quads
- Crew-Lunar-Module adapter (grey frustum)
- 4 cross-shaped solar wings (thin flat panels, grey) on ±X and ±Z
- All materials: `transparent: true`; group `scale.setScalar(0.30)`

**Orbit mechanics** (mirrors ISS pattern from `globe.js`):
- `ARTEMIS_ORBIT_R = MOON_R × 1.22` — low lunar orbit
- Normal speed: `0.0032 rad/frame`; fast (occluded) speed: `0.018 rad/frame`
- 4 orbit presets with different Y-inclinations (`yAmp` / `yFreq`), switched on each occlusion entry
- Limb fade: segment-distance to Moon sphere → alpha ramps 0→1 over `MOON_R × 1.18` band
- Full occlusion (`_rayHitsSphere` returns true): `visible = false`, fast-advance, look-ahead to prevent overshoot
- Nadir orientation: `makeBasis(right, fwd, zenith)` each frame — cross-track truss, velocity forward, zenith away from Moon
- `_setGroupOpacity(group, alpha)` helper traverses all meshes and sets `material.opacity`

| File | What changed |
|------|-------------|
| `static/js/moon.js` | `_makeStarTexture()`, `_rayHitsSphere()`, `_setGroupOpacity()` helpers; `ARTEMIS_ORBIT_R`, `ARTEMIS_SPEED_NORM/FAST`, `ARTEMIS_ORBITS` constants; `createOrion()` function; Artemis orbit + fade + occlusion block in render loop |

---

### 2026-04-09 — Apollo CSM Orbiting the Moon

**Goal**: Add the Apollo Command/Service Module orbiting the Moon alongside Artemis II, same ISS-style mechanics, always on the diametrically opposite side so the two spacecraft never collide.

**Spacecraft model** (`createApollo()`):
- Pointed CM cone + heat shield disk
- 4 RCS thruster quads around the CM
- Tunnel cylinder (SM adapter)
- Long cylindrical Service Module (gold) with equator band + SM RCS quads
- Engine bell + silver throat nozzle
- High-gain antenna dish on a mast
- All materials: `transparent: true`; group `scale.setScalar(0.30)`

**Collision prevention** (mathematical guarantee):
- `apolloAngle = _artemisAngle + Math.PI` — Apollo is always on the opposite side of the Moon
- Both crafts use `ARTEMIS_ORBIT_R` so their XZ positions are always diametrically opposite
- Minimum separation = `2 × ARTEMIS_ORBIT_R ≈ 15.6` world units >> spacecraft size (~0.30 units) → geometrically impossible to touch

**Orbit mechanics**: Same limb fade, occlusion, nadir orientation, and fast-advance as Artemis II (shares constants and orbit presets).

| File | What changed |
|------|-------------|
| `static/js/moon.js` | `createApollo()` function; Apollo orbit block in render loop (`apolloAngle = _artemisAngle + Math.PI`); `_apolloWasOccluded` + `_apolloRotMat` state variables |

---

### 2026-04-09 — Apollo Independent Orbit & Different Path

**Problem**: Apollo shared the same orbit preset as Artemis II (`ARTEMIS_ORBITS[_artemisOrbitIdx]`) and derived its angle directly as `_artemisAngle + Math.PI`. This meant both spacecraft always followed the exact same inclined plane — indistinguishable paths when visible together.

**Fix**:
- Apollo now has its own angle state `_apolloAngle` (starts at Artemis start + π, same initial separation) and its own orbit preset index `_apolloOrbitIdx = 2` (near-equatorial, visually distinct from Artemis preset 0 standard inclination)
- Apollo advances its angle independently with the same `ARTEMIS_SPEED_NORM` / `ARTEMIS_SPEED_FAST` values, including its own fast-advance look-ahead and occlusion-entry preset switching (cycles 2→3→0→1 to stay offset from Artemis's 0→1→2→3 cycle)
- Result: same orbital speed, different orbital plane → spacecraft appear at clearly different positions when both are simultaneously visible

| File | What changed |
|------|-------------|
| `static/js/moon.js` | `_apolloAngle` + `_apolloOrbitIdx = 2` state; Apollo render block uses `_apolloAngle` independently; own occlusion-entry preset switch + fast-advance look-ahead |

---

### 2026-04-09 — Diverse Random Orbits, Connected Solar Panels, Collision Safety

**Goals**: (1) Give both spacecraft many visually distinct orbital paths (not just Y-oscillation variants). (2) Fix Orion's floating solar panels — connect them to the body with physical booms. (3) Guarantee the two spacecraft never collide.

**Orbital path redesign**:
- Replaced 4 `ARTEMIS_ORBITS` (mixed yFreq values) with 8 `ORBIT_PRESETS`, all `yFreq=1`
- `yFreq=1` is the key: the Y motion completes exactly one cycle per orbit, so the visible face (left→right sweep) always shows a clean trajectory — straight, ascending, or descending
  - `yAmp=0`: equatorial — straight left to right
  - `yAmp>0`: bottom-left → top-right (ascending)
  - `yAmp<0`: top-left → bottom-right (descending)
  - Presets cover: equatorial, ±2.8 (steep), ±2.1 (strong), ±1.5 (moderate), +0.7 (slight)
- Preset switching is random (`_nextPreset` avoids repeating the current one)

**Collision guarantee (mathematical)**:
- `apolloAngle = _artemisAngle + Math.PI` always → XZ separation = 2×ORBIT_R ≈ 15.6 world units at all times → geometrically impossible to touch in XZ
- `_nextApolloPreset(artemisIdx)` always picks a preset with OPPOSITE `yAmp` sign to Artemis → when both visible (Artemis left side / Apollo right side), they are mirrored vertically → additional Y separation

**Orion solar panel boom fix**:
- Added `rootBoom`: CylinderGeometry from SM body edge (r≈0.30) to inner panel centre (r=0.62), length 0.32
- Added `linkBoom`: CylinderGeometry from inner panel centre (r=0.62) to outer panel centre (r=1.28), length 0.66
- Rotation formula: `rotation.set(π/2, ry, 0)` — R_x(π/2) maps cylinder Y-axis → Z, then R_y(ry) rotates Z → (sin ry, 0, cos ry) i.e. radially outward at arm angle ry
- Removed the old flat strut (BoxGeometry); replaced with proper cylindrical booms

| File | What changed |
|------|-------------|
| `static/js/moon.js` | `ORBIT_PRESETS` (8 entries, all yFreq=1); `_nextPreset()` + `_nextApolloPreset()` helpers; Apollo restored to `apolloAngle = _artemisAngle + Math.PI`; Orion wing loop rewritten with root + link cylinder booms |

---

### 2026-04-09 — Apollo Speed Fix & Collision-Safe Independent Orbits

**Problem**: Apollo derived its angle as `_artemisAngle + Math.PI`. When Artemis was occluded (behind the moon) and fast-advancing, Apollo's angle advanced at the same fast rate — but Apollo was on the *visible* front side, so it appeared to zip around at 6× normal speed.

**Root cause**: A shared angle means shared speed. Fast-advance is necessary behind the moon so the craft re-emerges quickly; but on the visible side it must always advance at `ARTEMIS_SPEED_NORM`.

**Fix**: Apollo now has its own `_apolloAngle` that advances independently:
- Visible: always `ARTEMIS_SPEED_NORM` — same speed as Artemis
- Occluded (Apollo behind moon): `ARTEMIS_SPEED_FAST` with look-ahead, matching Artemis's own fast-advance pattern
- Artemis fast-advancing behind the moon has zero effect on Apollo's visible speed

**Collision prevention** (replaces the π-offset guarantee):
- Each frame, compute `sep = (_apolloAngle − _artemisAngle) mod 2π`
- If `sep < MIN_ANG_SEP (π/2 = 90°)` or `sep > 2π − MIN_ANG_SEP`, clamp `_apolloAngle` back into the safe zone
- `90°` gap → minimum XZ separation = `ORBIT_R × sin(90°) × 2 = ORBIT_R√2 ≈ 11` world units >> spacecraft size

**Paths**: Both craft still use `ORBIT_PRESETS` with random switching on occlusion entry. Apollo's preset always has opposite `yAmp` sign to Artemis (via `_nextApolloPreset`) → diverging vertical paths when simultaneously visible.

| File | What changed |
|------|-------------|
| `static/js/moon.js` | `_apolloAngle` restored as independent state; Apollo fast/norm switching uses its own occlusion check; angular separation clamp added after each frame advance; `TWO_PI` + `MIN_ANG_SEP` constants |

---

### 2026-04-09 — Spacecraft Visual Differentiation

**Goal**: Make Orion (Artemis II) and Apollo CSM clearly distinct at a glance — different silhouette, different color, different size.

**Orion redesign** (`createOrion()`, scale `0.30 → 0.50`):
- SM color changed from gold → silver/white (`0xc4cdd6`) — matches real ESA Orion SM thermal panels
- 3 blue accent seam rings on SM surface for visual depth
- Solar wings redesigned as **double-panel per arm** (inner + outer section with a thin strut connecting them) — wider, more prominent, more complex silhouette
- Wider CM cone (`0.36 → 0.40` radius), pronounced frustum adapter

**Apollo CSM redesign** (`createApollo()`, scale `0.30 → 0.34`):
- SM color changed to rich **copper-bronze** (`0xb86a18`, specular `0xffaa44`) — distinctive warm amber, unmistakably different from Orion's silver
- Dark seam bands on SM surface (panel separation lines)
- Engine bell made more prominent: wider flare (`0.18 → 0.22`), taller (`0.28 → 0.38`), with visible silver bell-rim ring
- RCS blocks enlarged for visibility

**Net result**: Both at scale 0.34. Orion: silver with large double solar wings. Apollo: copper-bronze, no wings, prominent engine bell. Distinction is shape + color, not size.

| File | What changed |
|------|-------------|
| `static/js/moon.js` | `createOrion()`: silver SM, double-panel wings, scale 0.50; `createApollo()`: copper-bronze SM, prominent bell, scale 0.34 |

---

### 2026-04-10 — Earth–Moon Dashed Line: Perspective Dots, Direction Reversal, Visual Polish

**Changes**:

| File | What changed |
|------|-------------|
| `static/js/earth-moon-line.js` | **Dot at Earth**: new `startDot` circle with radial gradient (`em-earth-dot`) lit top-left, matching the globe's sun position. **Dot at Moon**: `endDot` uses radial gradient (`em-moon-dot`) lit top-right, matching the Three.js moon scene sun at `(-9, 1.5, 3)`. Both gradients shade white → slate-blue to give a 3D sphere-on-surface illusion. Shadow ellipse under moon dot removed (no longer needed; gradient provides the depth cue). **Dash direction reversed**: `dashFlow` now decrements (`-= 0.55`) so dashes flow from Earth toward Moon. **Endpoint shifted**: `x2 = moonCX + 120`, `y2 = moonCY - moonR` (top surface, no extra offset). **Line color**: `#94a3b8`. **"Earth ↔ Moon" right-aligned** in badge (`text-anchor: end`). **Source text** updated to "Meeus Astronomical Algorithms API". |

---

### 2026-04-10 — Earth–Moon Line: Hit Indicators, Bezier Fix, Endpoint & Badge Tuning

**Hit indicators** (replaced static perspective dots):
- `makeHitIndicator(color, delay1, delay2)` builds an SVG group with a solid core circle + two expanding/fading ring animations (SMIL `animate` on `r` 4→16 and `opacity` 0.8→0, staggered by `delay1`/`delay2`). Gives a continuous radar-ping pulse feel.
- `startHit` placed at the Earth anchor, `endHit` at the Moon endpoint — both fade in/out with the line opacity.

**Bezier backbend fix**:
- Old `cp2x = x2 - 30 + LINE_SHIFT` placed the second control point 70px past the endpoint, causing the curve to overshoot right and fold back. Fixed with `cp2x = x2; cp2y = y2 - Math.abs(dy) * 0.35` — curve arrives at the moon from directly above with a single clean arc.

**Endpoint & spacing**:
- `x2 = moonCX + 270` (endpoint 270px right of moon geometric center)
- `MID_T = 0.65` — badge stops 150px further along the bezier than before
- `LINE_SHIFT = 100` — entire curve shifted 100px right

**SVG page height fix**:
- Replaced hardcoded `height: '10000px'` with a per-frame update: `svg.style.height = footer.getBoundingClientRect().bottom + scrollY + 'px'`. Eliminated large blank scrollable area below the footer.

| File | What changed |
|------|-------------|
| `static/js/earth-moon-line.js` | `makeHitIndicator()` function; `startHit` + `endHit` SVG groups; `cp2x = x2; cp2y = y2 - abs(dy)*0.35` (no backbend); `x2 = moonCX + 270`; `MID_T = 0.65`; dynamic SVG height via footer bounding rect |

---

### 2026-04-10 — Orion Scaled Down & Solar Panels Redesigned to X-Pattern

**Orion scale**: `0.34 → 0.255` (25% smaller).

**Solar panels**: Replaced 4-arm + pattern with an X-pattern by offsetting the arm angle by `π/4`:
```js
const ry = (i / 4) * Math.PI * 2 + Math.PI / 4;  // X shape (was no offset)
const tilt = Math.PI / 9;  // ~20° solar-tracking tilt
inner.rotation.set(tilt, ry, 0);
outer.rotation.set(tilt, ry, 0);
```
Result: solar panels form a diagonal X when viewed from front, tilted 20° forward for a more realistic solar-tracking pose.

| File | What changed |
|------|-------------|
| `static/js/moon.js` | Orion scale `0.34 → 0.255`; panel arm angle `+= Math.PI/4`; tilt applied via `rotation.set(Math.PI/9, ry, 0)` |

---

### 2026-04-10 — Moon Canvas Extended Left to Prevent Spacecraft Clipping

**Problem**: Orion/Apollo sometimes drifted past the left edge of `#moon-canvas`, becoming invisibly clipped.

**Fix**: Extended the canvas `BLEED_LEFT = 300px` to the left using `camera.setViewOffset()`, which shifts the rendered viewport window without altering the projection frustum:
```js
const origW = parent.clientWidth + BLEED_PX;
const totalW = origW + BLEED_LEFT;
renderer.setSize(totalW, h);
canvas.style.left = `-${BLEED_LEFT}px`;
camera.setViewOffset(origW, h, -BLEED_LEFT, 0, totalW, h);
camera.aspect = origW / h;
```
This keeps the moon exactly where it was (projection math unchanged) while making the rendered area wider to the left so spacecraft are never clipped.

**Moon aspect fix**: An earlier attempt set `camera.aspect` to the total canvas width, which stretched the moon into a football shape. `setViewOffset` fixes this — the aspect is set to `origW / h` (the original logical width), not the extended physical width.

| File | What changed |
|------|-------------|
| `static/js/moon.js` | `BLEED_LEFT = 300` constant; `resize()` uses `renderer.setSize(totalW, h)`, `canvas.style.left = -BLEED_LEFT + 'px'`, `camera.setViewOffset(origW, h, -BLEED_LEFT, 0, totalW, h)`, `camera.aspect = origW / h` |

---

### 2026-04-10 — Footer & Live Badge Styling

**Footer** (`index.html`): Removed the SVG globe icon and social link. Footer now shows only `© 2026 Frank Leurs` as plain text.

**Live badges unified** (`space.css`): Changed `.space-header-tag` ("Live from orbit") from violet to the same green as the hero "Updating live" badge:
- Border: `rgba(52, 211, 153, 0.25)`
- Background: `rgba(52, 211, 153, 0.08)`
- Text color: `#34d399`
- Dot background: `#34d399` (uses existing `pulse-dot` CSS animation — same pulsing as hero badge)

| File | What changed |
|------|-------------|
| `static/index.html` | Footer: removed SVG icon + link, plain `<span>&copy; 2026 Frank Leurs</span>` |
| `static/css/space.css` | `.space-header-tag` border/background/color → green; `.space-header-tag-dot` background `→ #34d399` |

---

### 2026-04-14 — Space Crew API: Fallback for Static Hosting

**Problem**: On `frankleurs.nl` the site is served as static files (Python `http.server` or equivalent) with no Node.js process running. The browser called `/api/crew` which returned 404, leaving the "Currently in Space" section in the error state.

**Fix** (`space.js`): Added a two-step fetch with automatic fallback:
1. Try `/api/crew` with a 5 s timeout (works when Node.js `server.js` is running).
2. On failure (404, network error, or timeout), fall back to `https://corquaid.github.io/international-space-station-APIs/JSON/people-in-space.json` directly. GitHub Pages serves this with `Access-Control-Allow-Origin: *`, so the browser can fetch it cross-origin.

LocalStorage caching (6 h TTL) is unchanged — both paths populate the same cache, so subsequent page loads are instant regardless of hosting setup.

| File | What changed |
|------|-------------|
| `static/js/space.js` | `CREW_URL` split into `CREW_URL_PROXY = '/api/crew'` and `CREW_URL_DIRECT = 'https://corquaid.github.io/...'`; `refresh()` tries proxy first, falls back to direct on any error |
