/**
 * globe.js
 *
 * Three.js spinning Earth globe.
 *
 * Exports:
 *   initGlobe()              — set up scene, start render loop
 *   zoomToCountry(lat, lng)  — smoothly spin + zoom to a country
 *   zoomOut()                — return to default spinning state
 *
 * ── Rotation model ──────────────────────────────────────────
 *
 * Earth mesh uses Euler order 'YXZ': matrix M = Ry * Rx * Rz.
 * The camera is at (0, 0, camZ) looking at the origin.
 *
 * To center geographic point (lat, lng) with north pointing UP,
 * we build the local surface frame (east, north, forward) and
 * decompose the resulting rotation matrix into YXZ Euler angles:
 *
 *   phi = (lng + 180) × π/180    ← Three.js azimuth
 *
 *   rx  = arcsin( sin(phi) × sin(lat) )
 *   rz  = arctan2( cos(phi)×sin(lat),  cos(lat) )
 *   ry  = arctan2( cos(phi),  sin(phi)×cos(lat) )
 *
 * All three angles are required; skipping rz makes the globe
 * appear sideways for non-Americas countries.
 */

import * as THREE from 'three';

/* ── Constants ──────────────────────────────────────────── */
const EARTH_R    = 2.5;
const AUTO_SPEED = 0.0007;   // radians/frame (~1 rev per 2.5 min at 60 fps)
const LERP_SLOW  = 0.035;
const LERP_CAM   = 0.05;

const CAM_Z_DEFAULT = 6.5;
const CAM_Z_ZOOMED  = 3.8;

const TWO_PI = Math.PI * 2;

/* ── Module state ───────────────────────────────────────── */
let _earth      = null;

let _rotY       = 0;
let _targetRotY = 0;
let _autoRotate = true;

let _rotX       = 0;
let _targetRotX = 0;

let _rotZ       = 0;
let _targetRotZ = 0;

let _camZ       = CAM_Z_DEFAULT;
let _targetCamZ = CAM_Z_DEFAULT;

/* ══════════════════════════════════════════════════════════
   initGlobe
   ══════════════════════════════════════════════════════════ */
export function initGlobe() {
  const canvas = document.getElementById('globe-canvas');
  if (!canvas) return;

  /* ── Renderer ───────────────────────────────────────── */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  /* ── Scene ──────────────────────────────────────────── */
  const scene = new THREE.Scene();

  /* ── Camera ─────────────────────────────────────────── */
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);
  camera.position.set(0, 0, CAM_Z_DEFAULT);
  camera.lookAt(0, 0, 0);

  /* ── Lighting ───────────────────────────────────────── */
  scene.add(new THREE.AmbientLight(0xffffff, 0.14));

  const sun = new THREE.DirectionalLight(0xfff6e8, 2.3);
  sun.position.set(5, 3, 5);
  scene.add(sun);

  const fill = new THREE.PointLight(0x3b82f6, 0.45);
  fill.position.set(-6, -2, -4);
  scene.add(fill);

  /* ── Star field ─────────────────────────────────────── */
  (() => {
    const N = 6000;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N * 3; i++) pos[i] = (Math.random() - 0.5) * 240;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(geo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.16, sizeAttenuation: true })));
  })();

  /* ── Earth sphere ───────────────────────────────────── */
  const earthGeo = new THREE.SphereGeometry(EARTH_R, 64, 64);

  _earth = new THREE.Mesh(earthGeo, new THREE.MeshPhongMaterial({
    color: 0x1a3a6b, emissive: new THREE.Color(0x0a1a3b),
    specular: new THREE.Color(0x3b82f6), shininess: 40,
  }));

  _earth.rotation.order = 'YXZ';
  scene.add(_earth);

  new THREE.TextureLoader().load(
    'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
    tex => {
      _earth.material = new THREE.MeshPhongMaterial({
        map: tex, specular: new THREE.Color(0x1e3a8a), shininess: 16,
      });
    }
  );

  /* ── Atmosphere halos ───────────────────────────────── */
  [{ s: 1.055, o: 0.11 }, { s: 1.115, o: 0.04 }].forEach(({ s, o }) => {
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_R * s, 32, 32),
      new THREE.MeshPhongMaterial({
        color: 0x3b82f6, transparent: true, opacity: o,
        side: THREE.BackSide, depthWrite: false,
      })
    ));
  });

  /* ── Resize handler ─────────────────────────────────── */
  function resize() {
    const hero = canvas.parentElement;
    const w = hero.clientWidth, h = hero.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  /* ── Render loop ────────────────────────────────────── */
  (function loop() {
    requestAnimationFrame(loop);

    if (_autoRotate) _targetRotY += AUTO_SPEED;

    _rotY = _lerp(_rotY, _targetRotY, LERP_SLOW);
    _rotX = _lerp(_rotX, _targetRotX, LERP_SLOW);
    _rotZ = _lerp(_rotZ, _targetRotZ, LERP_SLOW);
    _camZ = _lerp(_camZ, _targetCamZ, LERP_CAM);

    _earth.rotation.y = _rotY;
    _earth.rotation.x = _rotX;
    _earth.rotation.z = _rotZ;

    camera.position.z = _camZ;

    renderer.render(scene, camera);
  })();
}

/* ══════════════════════════════════════════════════════════
   zoomToCountry
   ══════════════════════════════════════════════════════════ */
export function zoomToCountry(lat, lng) {
  _autoRotate = false;

  const latR    = lat * Math.PI / 180;
  const phi     = (lng + 180) * Math.PI / 180;

  const sinPhi  = Math.sin(phi);
  const cosPhi  = Math.cos(phi);
  const sinLat  = Math.sin(latR);
  const cosLat  = Math.cos(latR);

  /* ── Full YXZ Euler decomposition ──
   *
   * Surface frame at (lat, lng):
   *   east    e = ( sinPhi,              0,    cosPhi          )
   *   north   n = ( cosPhi * sinLat,  cosLat, -sinPhi * sinLat )
   *   forward v = (-cosPhi * cosLat,  sinLat,  sinPhi * cosLat )
   *
   * Rotation matrix R = [e; n; v]  maps  e→X, n→Y, v→Z  (det = +1).
   * Decomposed into YXZ (M = Ry·Rx·Rz):
   *
   *   rx = arcsin( sinPhi · sinLat )         ← from  -n.z
   *   rz = arctan2( cosPhi·sinLat, cosLat )  ← from  n.x / n.y
   *   ry = arctan2( cosPhi, sinPhi·cosLat )  ← from  e.z / v.z
   */
  const rawRX = Math.asin(Math.max(-1, Math.min(1, sinPhi * sinLat)));
  const rawRZ = Math.atan2(cosPhi * sinLat, cosLat);
  const rawRY = Math.atan2(cosPhi, sinPhi * cosLat);

  /* Shortest-path delta for each angle */
  _targetRotY = _rotY + _shortDelta(rawRY, _rotY);
  _targetRotX = _rotX + _shortDelta(rawRX, _rotX);
  _targetRotZ = _rotZ + _shortDelta(rawRZ, _rotZ);

  _targetCamZ = CAM_Z_ZOOMED;
}

/* ══════════════════════════════════════════════════════════
   zoomOut
   ══════════════════════════════════════════════════════════ */
export function zoomOut() {
  _autoRotate = true;
  _targetRotX = 0;
  _targetRotZ = 0;
  _targetCamZ = CAM_Z_DEFAULT;
}

/* ── Utilities ──────────────────────────────────────────── */
function _lerp(a, b, t) { return a + (b - a) * t; }

function _shortDelta(target, current) {
  let d = target - current;
  d -= Math.round(d / TWO_PI) * TWO_PI;
  return d;
}
