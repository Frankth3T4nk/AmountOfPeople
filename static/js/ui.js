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

/* ── Navbar: add .glass on scroll ─────────────────────── */
function initNavbar() {
  const nav = document.getElementById('navbar');
  if (!nav) return;

  const onScroll = () => {
    if (window.scrollY > 24) {
      nav.classList.add('scrolled', 'glass');
    } else {
      nav.classList.remove('scrolled', 'glass');
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
  initNavbar();
  initScrollReveal();
  initStats();
  initFooter();
}
