/**
 * shuttle.js
 *
 * Scroll-linked Space Shuttle launch animation.
 * Animates through the #shuttle-scene section (between #info and #space).
 *
 * Progress 0 → 1 as the user scrolls through the scene:
 *   0  – shuttle sits near the bottom of the viewport (on Earth)
 *   1  – shuttle has cleared the top of the viewport (in space)
 */

export function initShuttle() {
  const scene   = document.getElementById('shuttle-scene');
  const wrapper = document.getElementById('shuttle-wrapper');
  const flame   = document.getElementById('shuttle-flame');
  const trail   = document.getElementById('shuttle-trail');
  const stars   = document.getElementById('shuttle-stars');
  const atmo    = document.getElementById('shuttle-atmo');
  const earthGl = document.getElementById('shuttle-earth-glow');

  if (!scene || !wrapper) return;

  let rafId = null;

  /* Ease in-out cubic — natural acceleration/deceleration */
  const ease = (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  function update() {
    const rect   = scene.getBoundingClientRect();
    const sceneH = scene.offsetHeight;
    const viewH  = window.innerHeight;
    const travel = sceneH - viewH; // total scrollable distance inside scene

    /* progress: 0 when sticky begins (rect.top === 0),
                 1 when scene has fully scrolled past */
    const raw      = travel > 0 ? -rect.top / travel : 0;
    const progress = Math.max(0, Math.min(1, raw));
    const eased    = ease(progress);

    /* ── Shuttle position ───────────────────────────────── */
    const wrapH  = wrapper.offsetHeight || 245;
    /* Start: bottom of shuttle near viewport bottom */
    const yStart = viewH * 0.82 - wrapH * 0.5;
    /* End: shuttle fully above viewport */
    const yEnd   = -(wrapH + 80);
    const y      = yStart + eased * (yEnd - yStart);

    /* Gentle horizontal wobble that damps out as it ascends */
    const wobble = Math.sin(progress * Math.PI * 4) * 7 * (1 - eased);
    /* Tilt follows wobble direction */
    const tilt   = Math.sin(progress * Math.PI * 4) * 2.5 * (1 - eased);

    wrapper.style.transform =
      `translate(calc(-50% + ${wobble.toFixed(2)}px), ${y.toFixed(2)}px) rotate(${tilt.toFixed(2)}deg)`;

    /* ── Flame ──────────────────────────────────────────── */
    if (flame) {
      /* Scale grows as progress increases (more throttle) */
      const fScale = 0.55 + progress * 0.75;
      flame.style.transform     = `scaleY(${fScale.toFixed(3)})`;
      /* Fade in quickly, stay solid, then fade out at the very end */
      const fOpacity =
        progress < 0.04  ? progress / 0.04 :
        progress > 0.96  ? (1 - progress) / 0.04 :
        1;
      flame.style.opacity = fOpacity.toFixed(3);
    }

    /* ── Exhaust trail ──────────────────────────────────── */
    if (trail) {
      /* Trail top = just below the engine nozzles */
      const nozzleY = y + wrapH * 0.84;
      const trailH  = Math.max(0, viewH - nozzleY);
      trail.style.top    = `${nozzleY.toFixed(1)}px`;
      trail.style.height = `${trailH.toFixed(1)}px`;
      /* Fade in/out at edges of animation window */
      const tOpacity =
        progress < 0.04 ? progress / 0.04 :
        progress > 0.94 ? (1 - progress) / 0.06 :
        1;
      trail.style.opacity = tOpacity.toFixed(3);
    }

    /* ── Stars: fade in over the first half of the journey */
    if (stars) {
      const sOpacity = Math.max(0, Math.min(1, (progress - 0.08) / 0.45));
      stars.style.opacity = sOpacity.toFixed(3);
    }

    /* ── Earth glow: fades out as shuttle leaves ─────────── */
    if (earthGl) {
      earthGl.style.opacity = Math.max(0, 1 - eased * 1.4).toFixed(3);
    }

    /* ── Atmospheric halo: follows shuttle ──────────────── */
    if (atmo) {
      /* Centre the halo roughly on the engine bells */
      atmo.style.top = `${(y + wrapH * 0.72).toFixed(1)}px`;
      atmo.style.opacity = (progress < 0.9 ? 1 : (1 - progress) / 0.1).toFixed(3);
    }
  }

  /* Throttle scroll events to one rAF per frame */
  window.addEventListener('scroll', () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(update);
  }, { passive: true });

  window.addEventListener('resize', update);

  /* Run once immediately so the shuttle is positioned before first scroll */
  update();
}
