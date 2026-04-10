/**
 * stars.js — Full-page parallax starfield
 *
 * A single fixed <canvas> sits behind all page content and renders
 * three depth layers of stars. Each layer shifts at a different rate
 * as the user scrolls, producing a parallax / depth-of-field effect.
 * Stars also gently twinkle via a per-star sine oscillation.
 *
 * This replaces the static Three.js starfields that were previously
 * baked into globe.js (hero section) and moon.js (space section).
 */

/* ── Layer configuration ────────────────────────────────────
   Layer 0 = far  → smallest, dimmest, slowest parallax
   Layer 1 = mid  → medium
   Layer 2 = near → largest, brightest, fastest parallax       */
const STARS_PER_LAYER = [320, 200, 80];   // count
const PARALLAX_RATE   = [0.10, 0.24, 0.45]; // fraction of scrollY applied as Y-offset
const BASE_SIZE       = [0.55, 0.90, 1.45]; // base radius in px
const BASE_ALPHA      = [0.40, 0.62, 0.82]; // base opacity

export function initStars() {
  /* ── Canvas ─────────────────────────────────────────────── */
  const canvas = document.createElement('canvas');
  canvas.id = 'star-canvas';
  Object.assign(canvas.style, {
    position:      'fixed',
    top:           '0',
    left:          '0',
    width:         '100%',
    height:        '100%',
    pointerEvents: 'none',
    zIndex:        '0',
  });
  // Insert before everything else so content layers render on top
  document.body.insertBefore(canvas, document.body.firstChild);

  const ctx = canvas.getContext('2d');

  /* ── Star data ──────────────────────────────────────────── */
  const stars = [];

  function buildStars() {
    stars.length = 0;
    for (let layer = 0; layer < 3; layer++) {
      const n = STARS_PER_LAYER[layer];
      for (let i = 0; i < n; i++) {
        stars.push({
          x:     Math.random(),          // normalised 0–1 (relative to viewport width)
          y:     Math.random(),          // normalised 0–1 (relative to viewport height)
          layer,
          phase: Math.random() * Math.PI * 2,
          // Slight per-star size & alpha variation
          size:  BASE_SIZE[layer]  * (0.7 + Math.random() * 0.6),
          alpha: BASE_ALPHA[layer] * (0.6 + Math.random() * 0.4),
        });
      }
    }
  }

  /* ── Resize ─────────────────────────────────────────────── */
  let W = 0, H = 0;
  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  /* ── Render loop ────────────────────────────────────────── */
  function draw(t) {
    ctx.clearRect(0, 0, W, H);

    const scrollY = window.scrollY;

    for (const s of stars) {
      // Parallax: each layer shifts at its own rate relative to scroll
      const rawY = s.y * H - scrollY * PARALLAX_RATE[s.layer];
      // Wrap vertically — stars disappear off one edge and reappear on the other,
      // which is invisible because they are randomly distributed
      const sy   = ((rawY % H) + H) % H;
      const sx   = s.x * W;

      // Twinkle: slow sine oscillation on opacity
      const twinkle = 0.72 + 0.28 * Math.sin(t * 0.00065 + s.phase);
      const alpha   = s.alpha * twinkle;

      // Soft halo for near-layer (brightest) stars
      if (s.layer === 2) {
        const r2  = s.size * 3.0;
        const grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, r2);
        grd.addColorStop(0,   `rgba(255,255,255,${(alpha * 0.35).toFixed(3)})`);
        grd.addColorStop(1,   'rgba(255,255,255,0)');
        ctx.beginPath();
        ctx.arc(sx, sy, r2, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
      }

      // Core dot
      ctx.beginPath();
      ctx.arc(sx, sy, s.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
      ctx.fill();
    }

    requestAnimationFrame(draw);
  }

  buildStars();
  requestAnimationFrame(draw);
}
