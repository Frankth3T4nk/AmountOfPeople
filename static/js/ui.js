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

/* ── Public entry point ────────────────────────────────── */
export function initUI() {
  initBgStars();
  initNavbar();
  initScrollReveal();
  initStats();
  initFooter();
}
