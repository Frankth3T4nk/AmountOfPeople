/**
 * shuttle.js
 *
 * SVG-overlay iconic Space Shuttle Orbiter that flies from behind the
 * Earth (lower-left) in a counterclockwise arc to behind the left limb
 * of the Moon as the user scrolls.
 *
 * Mechanics:
 *   • Position driven by scroll (t: 0 → 1 over the Earth→Moon scroll range)
 *   • Bezier arc swings leftward first, then curves back right to Moon
 *   • Scale pulses (sin curve) to simulate the shuttle coming closer then
 *     going farther — peaks at t ≈ 0.5 (mid-arc)
 *   • Rotates to face the direction of travel (bezier tangent angle)
 *   • Fades in as it emerges from behind Earth, fades out behind Moon
 *   • Hidden on mobile (< 768 px)
 */

const NS = 'http://www.w3.org/2000/svg';

/* ── Cubic bezier helpers ───────────────────────────────── */
function bez(t, p0, p1, p2, p3) {
  const u = 1 - t;
  return u*u*u*p0 + 3*u*u*t*p1 + 3*u*t*t*p2 + t*t*t*p3;
}
function bezD(t, p0, p1, p2, p3) {
  const u = 1 - t;
  return 3*u*u*(p1-p0) + 6*u*t*(p2-p1) + 3*t*t*(p3-p2);
}

/* ── SVG element helper ─────────────────────────────────── */
function elNS(tag, attrs = {}) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

/* ══════════════════════════════════════════════════════════
   initShuttle
   ══════════════════════════════════════════════════════════ */
export function initShuttle() {

  /* ── SVG container (full-page, same as earth-moon-line) ── */
  const svg = elNS('svg');
  svg.id = 'shuttle-svg';
  Object.assign(svg.style, {
    position:      'absolute',
    top:           '0',
    left:          '0',
    width:         '100%',
    overflow:      'visible',
    pointerEvents: 'none',
    zIndex:        '18',        // just below earth-moon-line (z=20)
    height:        '100px',    // updated each frame to full doc height
  });

  /* ── Shuttle orbiter group ──────────────────────────────
     Local coordinates: nose at (+32, 0) pointing RIGHT (+x),
     tail engines at (−35, ~0), vertical extent ≈ −22 to +22.
     This means rotate(angle) aligns nose with travel direction.  */
  const g = elNS('g', { id: 'shuttle-orbiter', opacity: '0' });

  const WHITE  = 'rgba(252,253,255,0.96)';
  const STROKE = 'rgba(155,168,185,0.45)';
  const NOZZLE = '#141c2e';
  const GLASS  = '#08111e';

  /* Delta wing — large triangle, render first (behind fuselage) */
  const wing = elNS('path', {
    d: 'M 10,4 L -28,5 L -14,21 Z',
    fill: 'rgba(248,250,255,0.92)',
    stroke: STROKE, 'stroke-width': '0.5',
  });

  /* Vertical tail fin */
  const tail = elNS('path', {
    d: 'M -14,-5 L -28,-5 L -22,-21 Z',
    fill: WHITE, stroke: STROKE, 'stroke-width': '0.5',
  });

  /* Main fuselage: rounded nose, raised cockpit section, long payload bay */
  const body = elNS('path', {
    d: [
      'M 32,0',
      'C 30,-3 26,-5 20,-5',   // nose top curve
      'L 6,-6',                 // cockpit top (slightly higher)
      'C 0,-7 -4,-6 -22,-5',   // cockpit-to-payload-bay transition
      'L -28,-4',               // engine pod upper edge
      'C -30,-3 -31,-1 -31,1', // engine pod rear top
      'C -30,3 -28,4 -26,4',   // engine pod rear bottom
      'L 24,4',                 // fuselage belly
      'C 28,3 31,2 32,0 Z',    // nose belly curve back to tip
    ].join(' '),
    fill: WHITE, stroke: STROKE, 'stroke-width': '0.6',
  });

  /* OMS pods — characteristic raised bumps on the shoulder near tail */
  const oms = elNS('ellipse', {
    cx: '-18', cy: '-6.5', rx: '8', ry: '2.6',
    fill: 'rgba(244,246,252,0.9)', stroke: STROKE, 'stroke-width': '0.4',
  });

  /* Cockpit windows — dark glassy row near nose */
  const windows = elNS('path', {
    d: 'M 20,-5 L 8,-5 L 8,-8 L 16,-8 C 19,-8 21,-7 20,-5 Z',
    fill: GLASS, opacity: '0.88',
  });

  /* SSME engine nozzles — three at the tail (top, bottom, centre) */
  const n1 = elNS('circle', { cx: '-31', cy: '-2',  r: '2.5',
    fill: NOZZLE, stroke: 'rgba(75,90,118,0.65)', 'stroke-width': '0.6' });
  const n2 = elNS('circle', { cx: '-31', cy:  '3',  r: '2.5',
    fill: NOZZLE, stroke: 'rgba(75,90,118,0.65)', 'stroke-width': '0.6' });
  const n3 = elNS('circle', { cx: '-35', cy:  '0.5', r: '3',
    fill: NOZZLE, stroke: 'rgba(75,90,118,0.65)', 'stroke-width': '0.6' });

  /* Render order: wing → tail → body → oms → windows → nozzles */
  g.append(wing, tail, body, oms, windows, n1, n2, n3);
  svg.appendChild(g);

  /* ── Insert into DOM before the earth-moon-line SVG ─────── */
  const emSvg = document.getElementById('em-svg');
  if (emSvg) {
    document.body.insertBefore(svg, emSvg);
  } else {
    document.body.appendChild(svg);
  }

  /* ── Per-frame render ────────────────────────────────────── */
  function frame() {
    requestAnimationFrame(frame);

    /* Hide on narrow screens */
    if (window.innerWidth < 768) {
      g.setAttribute('opacity', '0');
      return;
    }

    const globeEl = document.getElementById('globe-canvas');
    const moonEl  = document.getElementById('moon-canvas');
    const footer  = document.querySelector('footer');
    if (!globeEl || !moonEl) return;

    const sy = window.scrollY;

    /* Keep SVG height = document height (same pattern as earth-moon-line) */
    if (footer) {
      const docH = footer.getBoundingClientRect().bottom + sy;
      svg.style.height = Math.ceil(docH) + 'px';
    }

    const gR = globeEl.getBoundingClientRect();
    const mR = moonEl.getBoundingClientRect();

    /* ── Anchor points (document-space: add scrollY to viewport-Y) ── */
    const earthR  = Math.min(gR.width, gR.height) * 0.42;
    const globeCX = gR.left + gR.width  * 0.5;
    const globeCY = gR.top  + gR.height * 0.5 + sy;

    const moonHR  = mR.height * 0.46;   // visual moon radius in pixels
    const moonCX  = mR.left + mR.width  * 0.5;
    const moonCY  = mR.top  + mR.height * 0.5 + sy;

    /* Start: lower-left of Earth globe (behind its left limb) */
    const x1 = globeCX - earthR * 0.55;
    const y1 = globeCY + earthR * 0.80;

    /* End: just inside the left limb of the Moon (shuttle disappears here) */
    const x2 = moonCX - moonHR * 1.05;
    const y2 = moonCY + moonHR * 0.10;

    /* Control points — counterclockwise C-arc bowing LEFT
       cp1: pull to the LEFT (stays within viewport) and slightly down
       cp2: arrive at Moon's left edge from the left                  */
    const cp1x = globeCX - earthR * 1.25;
    const cp1y = y1 + (y2 - y1) * 0.20;
    const cp2x = x2 - moonHR * 0.45;
    const cp2y = y2 + moonHR * 0.40;

    /* ── Scroll-driven t ──────────────────────────────────────
       0  when Earth section is about to leave viewport (30% before bottom)
       1  when Moon centre is near the upper portion of the viewport      */
    const gDocBottom = gR.bottom + sy;           // Earth section bottom (document)
    const scrollStart = gDocBottom - window.innerHeight * 0.35;
    const scrollEnd   = moonCY   - window.innerHeight * 0.45;
    const t = Math.max(0, Math.min(1, (sy - scrollStart) / (scrollEnd - scrollStart)));

    /* ── Position along bezier ─────────────────────────────── */
    const bx = bez(t, x1, cp1x, cp2x, x2);
    const by = bez(t, y1, cp1y, cp2y, y2);

    /* ── Rotation: nose faces direction of travel ──────────── */
    const tdx   = bezD(t, x1, cp1x, cp2x, x2);
    const tdy   = bezD(t, y1, cp1y, cp2y, y2);
    const angle = Math.atan2(tdy, tdx) * (180 / Math.PI);

    /* ── Scale: peaks at mid-arc to simulate depth ─────────── */
    const BASE  = 0.85;
    const scale = BASE * (0.86 + 0.28 * Math.sin(t * Math.PI));

    /* ── Opacity: fade in (emerging from Earth), fade out (into Moon) ── */
    let opacity;
    if      (t < 0.07) opacity = t / 0.07;
    else if (t > 0.84) opacity = (1 - t) / 0.16;
    else               opacity = 1;

    g.setAttribute('opacity', opacity.toFixed(3));
    g.setAttribute('transform',
      `translate(${bx.toFixed(1)},${by.toFixed(1)}) ` +
      `rotate(${angle.toFixed(1)}) ` +
      `scale(${scale.toFixed(3)})`
    );
  }

  requestAnimationFrame(frame);
}
