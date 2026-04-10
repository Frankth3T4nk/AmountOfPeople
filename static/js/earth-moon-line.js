/* ═══════════════════════════════════════════════════════════
   EARTH-MOON LINE  v6
   Cubic-bezier dashed path from Earth bottom-right to Moon
   top-center.  Line appears fully after 300 px of scroll.
   Badge rides the viewport-center intersection of the bezier
   from MIN_T to MID_T (halfway), then stays fixed.
   White line, endpoint dot on moon surface.
   Distance updated every second via Meeus Ch.47 formula.
   ═══════════════════════════════════════════════════════════ */

const NS = 'http://www.w3.org/2000/svg';

/* ── Moon distance — Meeus "Astronomical Algorithms" Ch.47 ── */
function calcMoonKm () {
  const jd = Date.now() / 86_400_000 + 2_440_587.5;
  const T  = (jd - 2_451_545.0) / 36_525;
  const d  = deg => (deg % 360) * (Math.PI / 180);
  const M  = d(134.9634 + 477_198.8676 * T);
  const Ms = d(357.5291 +  35_999.0503 * T);
  const D  = d(297.8502 + 445_267.1115 * T);
  return Math.round(
    385_001
    - 20_905 * Math.cos(M)
    -  3_699 * Math.cos(2 * D - M)
    -  2_956 * Math.cos(2 * D)
    -    570 * Math.cos(2 * M)
    +    246 * Math.cos(2 * M - 2 * D)
    -    205 * Math.cos(Ms - 2 * D)
    -    171 * Math.cos(M + 2 * D)
    -    152 * Math.cos(M + Ms - 2 * D)
  );
}

function fmtKm (km) {
  return km.toLocaleString('en-GB') + '\u202fkm';
}

/* ── SVG element helper ─────────────────────────────────────── */
function el (tag, attrs = {}) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

/* ── Bezier point at parameter t ────────────────────────────── */
function bezier (t, p0, cp1, cp2, p3) {
  const u = 1 - t;
  return u*u*u*p0 + 3*u*u*t*cp1 + 3*u*t*t*cp2 + t*t*t*p3;
}

/**
 * Binary-search for t on the bezier where the y-coordinate equals
 * targetY.  Assumes the bezier is monotonically increasing in y.
 */
function findBezierTForY (targetY, y1, cp1y, cp2y, y2) {
  if (targetY <= y1) return 0;
  if (targetY >= y2) return 1;
  let lo = 0, hi = 1;
  for (let i = 0; i < 26; i++) {
    const mid = (lo + hi) / 2;
    if (bezier(mid, y1, cp1y, cp2y, y2) < targetY) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/* ═══════════════════════════════════════════════════════════ */
export function initEarthMoonLine () {

  let distKm   = calcMoonKm();
  let dashFlow = 0;
  const BADGE_W = 184;
  const BADGE_H =  68;
  const MIN_T   = 0.02;   // keep clear of Earth
  const MID_T   = 0.65;   // badge stops here

  /* ── Build SVG overlay ───────────────────────────────────── */
  const svg = document.createElementNS(NS, 'svg');
  svg.id = 'em-svg';
  Object.assign(svg.style, {
    position:      'absolute',
    top:           '0',
    left:          '0',
    width:         '100%',
    overflow:      'visible',
    pointerEvents: 'none',
    zIndex:        '20',
    height:        '100px',   // updated dynamically in frame() to match real content
  });

  /* ── Curved dashed path ─────────────────────────────────── */
  const path = el('path', {
    fill:              'none',
    stroke:            '#94a3b8',
    'stroke-width':    '1.5',
    'stroke-dasharray':'5 11',
    opacity:           '0',
  });
  svg.appendChild(path);

  /* ── Hit-indicator helper ─────────────────────────────────
     Creates a target-ping: a small solid core dot + two
     expanding/fading rings, offset in time so they pulse
     continuously like a radar hit.                          */
  function makeHitIndicator (color, delay1, delay2) {
    const g = el('g', { opacity: '0' });

    // Core dot — stays visible, very slight pulse
    const core = el('circle', { r: '3', fill: color });
    core.innerHTML = `
      <animate attributeName="r"       values="2.5;3.5;2.5" dur="1.6s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1"/>
      <animate attributeName="opacity" values="0.9;1;0.9"   dur="1.6s" repeatCount="indefinite"/>`;

    // Ring 1
    const ring1 = el('circle', { r: '3', fill: 'none', stroke: color, 'stroke-width': '1.2' });
    ring1.innerHTML = `
      <animate attributeName="r"             values="4;16;16"   dur="1.6s" begin="${delay1}" repeatCount="indefinite" calcMode="spline" keySplines="0.2 0 0.6 1;0.6 0 1 1"/>
      <animate attributeName="opacity"       values="0.8;0;0"   dur="1.6s" begin="${delay1}" repeatCount="indefinite" calcMode="spline" keySplines="0.2 0 0.8 1;0 0 1 1"/>
      <animate attributeName="stroke-width" values="1.5;0.4;0.4" dur="1.6s" begin="${delay1}" repeatCount="indefinite"/>`;

    // Ring 2 — delayed clone for continuous feel
    const ring2 = el('circle', { r: '3', fill: 'none', stroke: color, 'stroke-width': '1.2' });
    ring2.innerHTML = `
      <animate attributeName="r"             values="4;16;16"   dur="1.6s" begin="${delay2}" repeatCount="indefinite" calcMode="spline" keySplines="0.2 0 0.6 1;0.6 0 1 1"/>
      <animate attributeName="opacity"       values="0.8;0;0"   dur="1.6s" begin="${delay2}" repeatCount="indefinite" calcMode="spline" keySplines="0.2 0 0.8 1;0 0 1 1"/>
      <animate attributeName="stroke-width" values="1.5;0.4;0.4" dur="1.6s" begin="${delay2}" repeatCount="indefinite"/>`;

    g.append(ring1, ring2, core);
    return g;
  }

  // Earth indicator — cool blue-white, rings offset by 0.8s
  const startHit = makeHitIndicator('rgba(148,163,184,0.9)', '0s', '0.8s');
  svg.appendChild(startHit);

  // Moon indicator — same palette, slightly offset so they feel independent
  const endHit = makeHitIndicator('rgba(148,163,184,0.9)', '0.3s', '1.1s');
  svg.appendChild(endHit);

  /* ── Distance badge ──────────────────────────────────────── */
  const badge = el('g', { id: 'em-badge', opacity: '0' });

  const bgRect = el('rect', {
    rx: '11', ry: '11',
    fill:          'rgba(8,18,36,0.93)',
    stroke:        'rgba(52,211,153,0.28)',
    'stroke-width':'1',
  });

  /* LIVE pill */
  const livePill = el('rect', {
    rx: '5', ry: '5',
    fill:          'rgba(52,211,153,0.10)',
    stroke:        'rgba(52,211,153,0.35)',
    'stroke-width':'0.8',
    width: '40', height: '15',
  });

  /* Pulsing dot */
  const liveDot = el('circle', { r: '2.8', fill: '#34d399' });
  const liveDotA1 = el('animate', { attributeName: 'r',       values: '2.2;3.8;2.2', dur: '1.8s', repeatCount: 'indefinite' });
  const liveDotA2 = el('animate', { attributeName: 'opacity', values: '1;0.2;1',     dur: '1.8s', repeatCount: 'indefinite' });
  liveDot.append(liveDotA1, liveDotA2);

  const liveLabel = el('text', {
    fill: '#34d399',
    'font-family': 'Outfit,system-ui,sans-serif',
    'font-size': '8.5', 'font-weight': '700',
    'letter-spacing': '0.10em',
  });
  liveLabel.textContent = 'LIVE';

  const topText = el('text', {
    fill: '#94a3b8',
    'font-family': 'Outfit,system-ui,sans-serif',
    'font-size': '9.5', 'text-anchor': 'end',
  });
  topText.textContent = 'Earth  ↔  Moon';

  const distText = el('text', {
    id: 'em-dist-label',
    fill: '#f1f5f9',
    'font-family': 'Outfit,system-ui,sans-serif',
    'font-size': '15.5', 'font-weight': '700', 'text-anchor': 'middle',
  });
  distText.textContent = fmtKm(distKm);

  const srcText = el('text', {
    fill: '#ffffff',
    'font-family': 'Outfit,system-ui,sans-serif',
    'font-size': '7.8', 'text-anchor': 'middle',
  });
  srcText.textContent = 'Meeus Astronomical Algorithms API';

  badge.append(bgRect, livePill, liveDot, liveLabel, topText, distText, srcText);
  svg.appendChild(badge);

  /* ── Insert SVG after star canvas ────────────────────────── */
  const starCanvas = document.getElementById('star-canvas');
  if (starCanvas?.nextSibling) {
    document.body.insertBefore(svg, starCanvas.nextSibling);
  } else {
    document.body.appendChild(svg);
  }

  /* ── Live distance update every second ──────────────────── */
  setInterval(() => {
    distKm = calcMoonKm();
    distText.textContent = fmtKm(distKm);
    distText.setAttribute('fill', '#ffffff');
    setTimeout(() => distText.setAttribute('fill', '#f1f5f9'), 200);
  }, 1_000);

  /* ── Per-frame render ────────────────────────────────────── */
  function frame () {
    requestAnimationFrame(frame);

    if (window.innerWidth < 768) {
      path.setAttribute('opacity', '0');
      startHit.setAttribute('opacity', '0');
      endHit.setAttribute('opacity', '0');
      badge.setAttribute('opacity', '0');
      return;
    }

    const globeEl = document.getElementById('globe-canvas');
    const moonEl  = document.getElementById('moon-canvas');
    const infoEl  = document.getElementById('info');
    if (!globeEl || !moonEl || !infoEl) return;

    const sy  = window.scrollY;
    const gR  = globeEl.getBoundingClientRect();
    const mR  = moonEl.getBoundingClientRect();
    const iR  = infoEl.getBoundingClientRect();

    if (mR.width < 4 || mR.height < 4) {
      path.setAttribute('opacity', '0');
      startHit.setAttribute('opacity', '0');
      endHit.setAttribute('opacity', '0');
      badge.setAttribute('opacity', '0');
      return;
    }

    /* ── Anchor points ───────────────────────────────────── */
    const LINE_SHIFT = 100;   // shift entire curve right
    const earthR  = Math.min(gR.width, gR.height) * 0.42;
    const globeCX = gR.left + gR.width  * 0.5;
    const globeCY = gR.top  + gR.height * 0.5 + sy;
    const x1 = globeCX + earthR * 0.58 + LINE_SHIFT;
    const y1 = globeCY + earthR * 0.46;

    const moonR  = mR.height * 0.46;
    const moonCX = mR.left + mR.width  * 0.5;       // geometric centre of sphere
    const moonCY = mR.top  + mR.height * 0.5 + sy;  // document y

    // Endpoint: geometric centre-top of sphere, offset +120 right, -50 up
    const x2 = moonCX + 270;
    const y2 = moonCY - moonR + 50 - 50;

    const dy = y2 - y1;

    /* ── Control points ──────────────────────────────────── */
    // cp1: curve rightward past the info panel, stay near top
    const CLEAR = 80;
    const cp1x  = Math.max(iR.right + CLEAR, x1 + (x2 - x1) * 0.45);
    const cp1y  = y1 + dy * 0.10;
    // cp2: arrive at moon from directly above — no rightward overshoot
    const cp2x  = x2;
    const cp2y  = y2 - Math.abs(dy) * 0.35;

    /* ── Keep SVG height = actual document height ───────── */
    const footer = document.querySelector('footer');
    if (footer) {
      const docH = footer.getBoundingClientRect().bottom + sy;
      svg.style.height = Math.ceil(docH) + 'px';
    }

    /* ── Path string ─────────────────────────────────────── */
    const d = `M ${x1.toFixed(1)} ${y1.toFixed(1)} ` +
              `C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ` +
              `  ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ` +
              `  ${x2.toFixed(1)} ${y2.toFixed(1)}`;
    path.setAttribute('d', d);

    /* ── Line opacity: appears after 300 px of scroll ───── */
    const lineOp = Math.min(1, Math.max(0, (sy - 300) / 50));
    path.setAttribute('opacity', lineOp.toFixed(3));

    /* ── Hit indicators ──────────────────────────────────── */
    startHit.setAttribute('transform', `translate(${x1.toFixed(1)},${y1.toFixed(1)})`);
    startHit.setAttribute('opacity', lineOp.toFixed(3));
    endHit.setAttribute('transform', `translate(${x2.toFixed(1)},${y2.toFixed(1)})`);
    endHit.setAttribute('opacity', lineOp.toFixed(3));

    /* ── Flowing dash — runs from Earth toward Moon ──────── */
    dashFlow -= 0.55;
    path.setAttribute('stroke-dashoffset', (dashFlow % 16).toFixed(2));

    /* ── Badge: rides viewport center from MIN_T to MID_T ──
       Find t where bezier_y = viewport-center in doc coords.
       Stops at the halfway point (MID_T = 0.5).             */
    const vcDocY  = sy + window.innerHeight * 0.5;
    const tCenter = findBezierTForY(vcDocY, y1, cp1y, cp2y, y2);
    const bt = Math.max(MIN_T, Math.min(MID_T, tCenter));

    const mx  = bezier(bt, x1, cp1x, cp2x, x2);
    const my  = bezier(bt, y1, cp1y, cp2y, y2);

    const bLeft = mx - BADGE_W / 2;
    const bTop  = my - BADGE_H / 2;

    bgRect.setAttribute('x', bLeft.toFixed(1));
    bgRect.setAttribute('y', bTop.toFixed(1));
    bgRect.setAttribute('width',  BADGE_W);
    bgRect.setAttribute('height', BADGE_H);

    livePill.setAttribute('x', (bLeft + 9).toFixed(1));
    livePill.setAttribute('y', (bTop + 9).toFixed(1));

    liveDot.setAttribute('cx', (bLeft + 18).toFixed(1));
    liveDot.setAttribute('cy', (bTop + 16.5).toFixed(1));

    liveLabel.setAttribute('x', (bLeft + 24).toFixed(1));
    liveLabel.setAttribute('y', (bTop + 20).toFixed(1));

    topText.setAttribute('x', (bLeft + BADGE_W - 9).toFixed(1));
    topText.setAttribute('y', (bTop + 20).toFixed(1));

    distText.setAttribute('x', mx.toFixed(1));
    distText.setAttribute('y', (my + 7).toFixed(1));

    srcText.setAttribute('x', mx.toFixed(1));
    srcText.setAttribute('y', (bTop + BADGE_H - 10).toFixed(1));

    /* Badge appears at the same time as the line (after 300 px scroll) */
    badge.setAttribute('opacity', lineOp.toFixed(3));
  }

  requestAnimationFrame(frame);
}
