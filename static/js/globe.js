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

  /* ── ISS overlay renderer (separate canvas, above hero-content) */
  const issCanvas = document.getElementById('iss-canvas');
  const issRenderer = new THREE.WebGLRenderer({ canvas: issCanvas, antialias: true, alpha: true });
  issRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  issRenderer.setClearColor(0x000000, 0);

  /* ── Scenes ─────────────────────────────────────────── */
  const scene    = new THREE.Scene();
  const issScene = new THREE.Scene(); // ISS only — renders on overlay canvas above text

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

  // Mirror the same lights in issScene so the ISS is lit identically
  issScene.add(new THREE.AmbientLight(0xffffff, 0.14));
  const issSun  = new THREE.DirectionalLight(0xfff6e8, 2.3);
  issSun.position.set(5, 3, 5);
  issScene.add(issSun);
  const issFill = new THREE.PointLight(0x3b82f6, 0.45);
  issFill.position.set(-6, -2, -4);
  issScene.add(issFill);

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

  /* ── ISS ────────────────────────────────────────────── */
  const iss = createISS();
  issScene.add(iss); // overlay canvas — ISS floats above hero-content

  /* ── Mouse parallax state ───────────────────────────── */
  let _mouseX = 0, _mouseY = 0;
  let _mouseLerpX = 0, _mouseLerpY = 0;

  const heroEl = canvas.parentElement;
  heroEl.addEventListener('mousemove', e => {
    const r = heroEl.getBoundingClientRect();
    _mouseX = ((e.clientX - r.left) / r.width  - 0.5) * 2;
    _mouseY = ((e.clientY - r.top)  / r.height - 0.5) * 2;
  }, { passive: true });
  heroEl.addEventListener('mouseleave', () => { _mouseX = 0; _mouseY = 0; }, { passive: true });

  /* ── Resize handler ─────────────────────────────────── */
  function resize() {
    const hero = canvas.parentElement;
    const w = hero.clientWidth, h = hero.clientHeight;
    renderer.setSize(w, h);
    issRenderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  /* ── ISS orbit state ────────────────────────────────── */
  const ISS_ORBIT_R    = 3.3;   // just outside atmosphere halos
  const ISS_SPEED_NORM = 0.00375; // 25% slower than previous 0.005
  const ISS_SPEED_FAST = 0.035; // reduced again ~30% so ISS stays behind Earth ~30% longer

  // Different orbital inclinations — all left→right direction, varying Y tilt.
  // Switched each time the ISS enters occlusion (hidden, so no visible jump).
  const ISS_ORBITS = [
    { yAmp: 0.55, yFreq: 1.2 },  // standard
    { yAmp: 1.10, yFreq: 0.7 },  // high inclination, slow rise
    { yAmp: 0.15, yFreq: 1.8 },  // nearly equatorial
    { yAmp: 0.80, yFreq: 1.0 },  // medium inclination
  ];
  let _issAngle      = 0;
  let _issOrbitIdx   = 0;
  let _wasOccluded   = false;
  const _issRotMat   = new THREE.Matrix4(); // reused each frame

  /* ── Render loop ────────────────────────────────────── */
  (function loop() {
    requestAnimationFrame(loop);

    if (_autoRotate) _targetRotY += AUTO_SPEED;

    _rotY = _lerp(_rotY, _targetRotY, LERP_SLOW);
    _rotX = _lerp(_rotX, _targetRotX, LERP_SLOW);
    _rotZ = _lerp(_rotZ, _targetRotZ, LERP_SLOW);
    _camZ = _lerp(_camZ, _targetCamZ, LERP_CAM);

    // Mouse hover — positional push only, rotation is untouched so auto-spin never stops.
    // Moving the mesh position avoids the "fighting rotation" artefact that made Earth
    // appear to freeze/reverse when the cursor crossed the centre.
    _mouseLerpX = _lerp(_mouseLerpX, _mouseX, 0.04);
    _mouseLerpY = _lerp(_mouseLerpY, _mouseY, 0.04);
    const pushX = _autoRotate ? _mouseLerpX *  0.18 : 0;
    const pushY = _autoRotate ? _mouseLerpY * -0.09 : 0;
    _earth.position.x = pushX;
    _earth.position.y = pushY;

    _earth.rotation.y = _rotY;
    _earth.rotation.x = _rotX;
    _earth.rotation.z = _rotZ;

    camera.position.z = _camZ;

    // ── ISS orbit + smooth limb fade ──────────────────
    const orbit = ISS_ORBITS[_issOrbitIdx];
    const issX  = Math.sin(_issAngle) * ISS_ORBIT_R;
    const issZ  = Math.cos(_issAngle) * ISS_ORBIT_R;
    const issY  = Math.sin(_issAngle * orbit.yFreq) * orbit.yAmp;

    // Earth's current world position (offset by mouse push)
    const eX = _earth.position.x, eY = _earth.position.y;
    const camZ = camera.position.z;

    // ── Smooth fade via segment-distance ──────────────
    // Compute the minimum distance from the camera→ISS line SEGMENT to Earth centre.
    // This naturally gives the right answer for all cases:
    //   ISS in front  → closest pt on segment is ISS itself (t_closest > 1, clamps to 1)
    //                    → dSeg = dist(ISS, Earth) ≥ orbit_r > EARTH_R → fully visible
    //   ISS at limb   → dSeg = EARTH_R → begin to fade
    //   ISS behind    → dSeg < EARTH_R → fully hidden
    //
    // Fade band: EARTH_R (fully hidden) → EARTH_R × 1.18 (fully visible).
    // The ISS fades out as it slides behind Earth and fades in as it re-emerges.
    // No hysteresis needed — the segment distance is a smooth, continuous signal.
    const _vx = issX, _vy = issY, _vz = issZ - camZ;
    const _vLen2 = _vx*_vx + _vy*_vy + _vz*_vz;
    const _tNum  = issX*eX + issY*eY - _vz*camZ; // = -dot(v, C−S) with S=(eX,eY,0)
    const _tc    = Math.max(0, Math.min(1, _tNum / _vLen2));
    const _cpx   = _tc*_vx - eX;                  // closest-pt relative to Earth centre
    const _cpy   = _tc*_vy - eY;
    const _cpz   = camZ + _tc*_vz;                // closest-pt Z (Earth at z=0)
    const _dSeg  = Math.sqrt(_cpx*_cpx + _cpy*_cpy + _cpz*_cpz);

    const ISS_FADE_MIN = EARTH_R;          // fully hidden at or below
    const ISS_FADE_MAX = EARTH_R * 1.18;   // fully visible at or above
    const issAlpha = Math.max(0, Math.min(1,
      (_dSeg - ISS_FADE_MIN) / (ISS_FADE_MAX - ISS_FADE_MIN)
    ));

    // "Fully occluded" = ray actually passes through Earth (dSeg < EARTH_R, alpha=0).
    // Used to trigger orbit-preset switch and fast-advance — both invisible, so no jump.
    const isOccluded = _rayHitsSphere(0, 0, camZ, issX, issY, issZ, eX, eY, 0, EARTH_R);

    if (isOccluded && !_wasOccluded) {
      _issOrbitIdx = (_issOrbitIdx + 1) % ISS_ORBITS.length;
    }
    _wasOccluded = isOccluded;

    // Apply smooth fade via CSS opacity on the iss-canvas element.
    // This is simpler and more reliable than modifying Three.js materials
    // (no needsUpdate / shader-recompile concerns).
    issCanvas.style.opacity = issAlpha;

    if (isOccluded) {
      iss.visible = false;
      // Look-ahead: if next fast step would leave the fully-hidden zone (enter fade band),
      // slow down to NORM speed so the fade-in starts gently rather than with a jump.
      const nextAngle = _issAngle + ISS_SPEED_FAST;
      const nX = Math.sin(nextAngle) * ISS_ORBIT_R;
      const nZ = Math.cos(nextAngle) * ISS_ORBIT_R;
      const nY = Math.sin(nextAngle * orbit.yFreq) * orbit.yAmp;
      const nextOccluded = _rayHitsSphere(0, 0, camZ, nX, nY, nZ, eX, eY, 0, EARTH_R);
      _issAngle += nextOccluded ? ISS_SPEED_FAST : ISS_SPEED_NORM;
    } else {
      iss.visible = true;
      iss.position.set(issX, issY, issZ);

      // Nadir-pointing orientation:
      //   local X = truss (cross-track, ⊥ to both velocity and zenith)
      //   local Y = along-track (velocity direction)
      //   local Z = zenith (away from Earth)
      // Solar panel large face has normal = ±Z → one face toward Earth, one away ✓
      // Right-hand basis: X × Y = Z confirmed.
      const _zenith = new THREE.Vector3(issX, issY, issZ).normalize();  // away from Earth
      const _vel    = new THREE.Vector3(
        Math.cos(_issAngle) * ISS_ORBIT_R,
        Math.cos(_issAngle * orbit.yFreq) * orbit.yFreq * orbit.yAmp,
        -Math.sin(_issAngle) * ISS_ORBIT_R
      ).normalize();
      const _right  = new THREE.Vector3().crossVectors(_vel, _zenith).normalize(); // truss axis
      const _fwd    = new THREE.Vector3().crossVectors(_zenith, _right).normalize(); // along-track
      _issRotMat.makeBasis(_right, _fwd, _zenith);
      iss.setRotationFromMatrix(_issRotMat);

      _issAngle += ISS_SPEED_NORM;
    }

    renderer.render(scene, camera);
    issRenderer.render(issScene, camera);
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

/**
 * _rayHitsSphere — true if the line segment from C=(cx,cy,cz) to P=(px,py,pz)
 * intersects the sphere centred at S=(sx,sy,sz) with radius r.
 *
 * Solves |C + t*(P-C) - S|² = r² for t ∈ [0, 1]:
 *   a·t² + b·t + c = 0
 * where v = P-C, w = C-S.
 * Entry (smaller t) must be ≥ 0 and ≤ 1 for the ray segment to be blocked.
 */
function _rayHitsSphere(cx, cy, cz, px, py, pz, sx, sy, sz, r) {
  const vx = px - cx, vy = py - cy, vz = pz - cz; // ray direction
  const wx = cx - sx, wy = cy - sy, wz = cz - sz; // camera relative to sphere centre
  const a = vx*vx + vy*vy + vz*vz;
  const b = 2*(vx*wx + vy*wy + vz*wz);
  const c = wx*wx + wy*wy + wz*wz - r*r;
  const D = b*b - 4*a*c;
  if (D < 0) return false;           // ray misses sphere entirely
  const t = (-b - Math.sqrt(D)) / (2*a); // entry point (smaller root)
  return t >= 0 && t <= 1;           // entry is between camera and ISS
}

/* ══════════════════════════════════════════════════════════
   ISS model  — simplified but recognisable
   ══════════════════════════════════════════════════════════ */
function createISS() {
  const group = new THREE.Group();

  const alum  = new THREE.MeshPhongMaterial({ color: 0xe8eaed, specular: 0x888888, shininess: 80 });
  const solar = new THREE.MeshPhongMaterial({ color: 0x1a3a6b, emissive: new THREE.Color(0x0a1228), specular: new THREE.Color(0x3b82f6), shininess: 40 });
  const gold  = new THREE.MeshPhongMaterial({ color: 0xc8a84b, specular: 0xffd700, shininess: 60 });

  // Core habitat modules
  const habGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.55, 16);
  const hab1   = new THREE.Mesh(habGeo, alum);
  hab1.rotation.z = Math.PI / 2;
  group.add(hab1);

  const hab2 = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.45, 16), alum);
  hab2.rotation.z = Math.PI / 2;
  hab2.position.x = 0.38;
  group.add(hab2);

  const hab3 = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.45, 16), alum);
  hab3.rotation.z = Math.PI / 2;
  hab3.position.x = -0.38;
  group.add(hab3);

  // Connecting node
  const node = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), alum);
  group.add(node);

  // Integrated Truss Structure
  const truss = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.035, 0.035), alum);
  group.add(truss);

  // Truss cross-beams
  for (const x of [-0.9, -0.45, 0, 0.45, 0.9]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.22, 0.03), alum);
    beam.position.x = x;
    group.add(beam);
  }

  // Solar Arrays — 4 pairs (8 wings)
  const wingXs = [-0.88, -0.44, 0.44, 0.88];
  for (const x of wingXs) {
    for (const sign of [-1, 1]) {
      const wing = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.38, 0.008), solar
      );
      wing.position.set(x, sign * 0.22, 0);
      wing.userData.solarPanel = true;
      group.add(wing);

      const foil = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.012, 0.009), gold
      );
      foil.position.set(x, sign * (0.22 + 0.196), 0);
      group.add(foil);
    }
  }

  // Radiator panels
  for (const sign of [-1, 1]) {
    const rad = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.12, 0.007),
      new THREE.MeshPhongMaterial({ color: 0xc8d0d8, specular: 0xffffff, shininess: 40 })
    );
    rad.position.set(sign * 0.25, 0, -0.08);
    rad.rotation.x = 0.3 * sign;
    group.add(rad);
  }

  group.scale.setScalar(0.214); // 25% smaller than previous 0.285
  return group;
}
