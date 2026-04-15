/**
 * ui.js
 *
 * Handles all non-counter, non-globe UI interactions:
 *   • Navbar glass effect on scroll
 *   • Scroll-reveal (.fade-up → .visible) via IntersectionObserver
 *   • Stats births/deaths live jitter
 *   • Footer year injection
 */

import { BIRTHS_PER_SEC, DEATHS_PER_SEC } from './population.js';

/* ── Full-page background starfield ────────────────────── */
function initBgStars() {
  const canvas = document.createElement('canvas');
  canvas.id = 'bg-stars';
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;';
  document.body.prepend(canvas);

  const ctx = canvas.getContext('2d');
  let stars = [];

  function build() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const N = Math.round((canvas.width * canvas.height) / 3000); // density ~1 star per 3000px²
    stars = Array.from({ length: N }, () => ({
      x:    Math.random() * canvas.width,
      y:    Math.random() * canvas.height,
      r:    Math.random() * 0.9 + 0.3,      // radius 0.3–1.2px
      a:    Math.random() * 0.55 + 0.2,      // opacity 0.2–0.75
    }));
    draw();
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of stars) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${s.a})`;
      ctx.fill();
    }
  }

  build();
  window.addEventListener('resize', () => build(), { passive: true });
}

/* ── Navbar: add .glass on scroll ─────────────────────── */
function initNavbar() {
  const nav = document.getElementById('navbar');
  if (!nav) return;

  const onScroll = () => {
    if (window.scrollY > 24) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // run once on load in case page is already scrolled
}

/* ── Scroll-reveal ─────────────────────────────────────── */
function initScrollReveal() {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  document.querySelectorAll('.fade-up').forEach((el) => io.observe(el));

  /* Hero content is already visible — trigger immediately */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const hero = document.getElementById('hero-content');
      if (hero) hero.classList.add('visible');
    });
  });
}

/* ── Live stats jitter ─────────────────────────────────── */
function initStats() {
  const birthsEl = document.getElementById('stat-births');
  const deathsEl = document.getElementById('stat-deaths');
  if (!birthsEl || !deathsEl) return;

  const jitter = (base, range) =>
    (base + (Math.random() - 0.5) * range).toFixed(1);

  setInterval(() => {
    birthsEl.textContent = jitter(BIRTHS_PER_SEC, 0.12);
    deathsEl.textContent = jitter(DEATHS_PER_SEC, 0.10);
  }, 1100);
}

/* ── Footer year ───────────────────────────────────────── */
function initFooter() {
  const el = document.getElementById('footer-year');
  if (el) el.textContent = new Date().getFullYear();
}

/* ── Stat → info dashed connectors ────────────────────── */
function initStatConnectors() {
  const wrap    = document.getElementById('stat-info-wrap');
  const svg     = document.getElementById('stat-connectors');
  const births  = document.getElementById('stat-births');
  const deaths  = document.getElementById('stat-deaths');
  const heading = document.querySelector('#info .info-heading');
  if (!wrap || !svg || !births || !deaths || !heading) return;

  const NS  = 'http://www.w3.org/2000/svg';
  const col = 'rgba(148,163,184,0.55)';

  // Create persistent SVG elements once
  const pathB = document.createElementNS(NS, 'path');
  const pathD = document.createElementNS(NS, 'path');
  const dotB  = document.createElementNS(NS, 'circle');
  const dotD  = document.createElementNS(NS, 'circle');
  const dotT  = document.createElementNS(NS, 'circle');

  [pathB, pathD].forEach(p => {
    p.setAttribute('fill',             'none');
    p.setAttribute('stroke',           col);
    p.setAttribute('stroke-width',     '1.5');
    p.setAttribute('stroke-dasharray', '5 11');
    p.setAttribute('stroke-linecap',   'round');
  });
  [dotB, dotD, dotT].forEach(c => {
    c.setAttribute('r',    '2.5');
    c.setAttribute('fill', col);
  });

  svg.append(pathB, pathD, dotB, dotD, dotT);

  // Start points: bottom of the stat labels ("Births per second" / "Deaths per second")
  const labelB = births.closest('.stat-item').querySelector('.stat-label');
  const labelD = deaths.closest('.stat-item').querySelector('.stat-label');

  function updatePositions() {
    const wr  = wrap.getBoundingClientRect();
    const rel = el => {
      const b = el.getBoundingClientRect();
      return { cx: b.left - wr.left + b.width / 2, bot: b.bottom - wr.top,
               x:  b.left - wr.left, y: b.top - wr.top, w: b.width };
    };

    const bR = rel(labelB);
    const dR = rel(labelD);
    const hR = rel(heading);

    const bx = bR.cx,           by = bR.bot - 14;
    const dx = dR.cx,           dy = dR.bot - 14;
    const tx = hR.x + hR.w / 2, ty = hR.y - 30;

    const midY = (Math.max(by, dy) + ty) / 2;

    pathB.setAttribute('d', `M${bx},${by} C${bx},${midY} ${tx},${midY} ${tx},${ty}`);
    pathD.setAttribute('d', `M${dx},${dy} C${dx},${midY} ${tx},${midY} ${tx},${ty}`);

    dotB.setAttribute('cx', bx); dotB.setAttribute('cy', by);
    dotD.setAttribute('cx', dx); dotD.setAttribute('cy', dy);
    dotT.setAttribute('cx', tx); dotT.setAttribute('cy', ty);
  }

  // Animated flowing dash — same speed as earth-moon line (dashFlow -= 0.55, period 16)
  let dashFlow = 0;
  function tick() {
    dashFlow -= 0.55;
    const offset = (dashFlow % 16).toFixed(2);
    pathB.setAttribute('stroke-dashoffset', offset);
    pathD.setAttribute('stroke-dashoffset', offset);
    requestAnimationFrame(tick);
  }

  updatePositions();
  tick();

  window.addEventListener('resize', updatePositions, { passive: true });
}

/* ── Public entry point ────────────────────────────────── */
export function initUI() {
  initBgStars();
  initNavbar();
  initScrollReveal();
  initStats();
  initFooter();
  initStatConnectors();
}
