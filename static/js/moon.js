/**
 * moon.js
 *
 * Three.js scene rendered behind the #space section:
 *   - Rotating Moon (HD 4K texture)
 *   - 6000-point starfield
 *   - Artemis II Orion spacecraft orbiting the moon
 *     (same visual style as the ISS in globe.js — matched materials,
 *      nadir-pointing orientation, smooth limb-fade, fast-advance
 *      through occlusion)
 */

import * as THREE from 'three';

const MOON_R      = 6.4;
const MOON_SPEED  = 0.00025;
const CAM_Z       = 12;
const FOV         = 65;
const BLEED_PX    = 400;
const BLEED_LEFT  = 300;
const LERP_SLOW   = 0.035;

/* ── Orbit constants ────────────────────────────────────── */
const ARTEMIS_ORBIT_R    = MOON_R * 1.22;   // ≈ 7.8 — just outside halo
const ARTEMIS_SPEED_NORM = 0.0032;
const ARTEMIS_SPEED_FAST = 0.018;           // fast-advance while occluded

// 8 diverse paths. yFreq=1 means exactly one ascending/descending sweep
// per orbit. On the visible face (angle 3π/2 → π/2, i.e. left → right):
//   yAmp > 0  →  bottom-left to top-right
//   yAmp < 0  →  top-left to bottom-right
//   yAmp = 0  →  straight equatorial
const ORBIT_PRESETS = [
  { yAmp:  0.0,  yFreq: 1.0 },  // equatorial — straight across
  { yAmp:  2.8,  yFreq: 1.0 },  // steep ascending
  { yAmp: -2.8,  yFreq: 1.0 },  // steep descending
  { yAmp:  1.5,  yFreq: 1.0 },  // moderate ascending
  { yAmp: -1.5,  yFreq: 1.0 },  // moderate descending
  { yAmp:  2.1,  yFreq: 1.0 },  // strong ascending
  { yAmp: -2.1,  yFreq: 1.0 },  // strong descending
  { yAmp:  0.7,  yFreq: 1.0 },  // slight ascending
];

// Pick a random preset index, avoiding the current one.
// Apollo always picks from presets with OPPOSITE yAmp sign to Artemis so
// the two paths diverge vertically — collision impossible even if they
// drift to similar angles.
function _nextPreset(avoidIdx) {
  let i;
  do { i = Math.floor(Math.random() * ORBIT_PRESETS.length); } while (i === avoidIdx);
  return i;
}
function _nextApolloPreset(artemisIdx) {
  const aSign = Math.sign(ORBIT_PRESETS[artemisIdx].yAmp); // +1, -1, or 0
  // Filter to opposite sign (or 0 if Artemis is 0)
  const pool = ORBIT_PRESETS
    .map((p, i) => i)
    .filter(i => Math.sign(ORBIT_PRESETS[i].yAmp) !== aSign);
  return pool[Math.floor(Math.random() * pool.length)];
}

/* ── Module state ───────────────────────────────────────── */
let _moonRotY       = 0;
let _targetMoonRotY = 0;

function _lerp(a, b, t) { return a + (b - a) * t; }



/**
 * _rayHitsSphere — true if the segment from C=(cx,cy,cz) to P=(px,py,pz)
 * intersects the sphere at S=(sx,sy,sz) with radius r.
 * (copied from globe.js — same occlusion logic)
 */
function _rayHitsSphere(cx, cy, cz, px, py, pz, sx, sy, sz, r) {
  const vx = px - cx, vy = py - cy, vz = pz - cz;
  const wx = cx - sx, wy = cy - sy, wz = cz - sz;
  const a  = vx*vx + vy*vy + vz*vz;
  const b  = 2*(vx*wx + vy*wy + vz*wz);
  const c  = wx*wx + wy*wy + wz*wz - r*r;
  const D  = b*b - 4*a*c;
  if (D < 0) return false;
  const t = (-b - Math.sqrt(D)) / (2*a);
  return t >= 0 && t <= 1;
}

/* ── Set opacity on every mesh inside a group ───────────── */
function _setGroupOpacity(group, opacity) {
  group.traverse(child => {
    if (child.isMesh) child.material.opacity = opacity;
  });
}

/* ══════════════════════════════════════════════════════════
   initMoon
   ══════════════════════════════════════════════════════════ */
export function initMoon() {
  const canvas = document.getElementById('moon-canvas');
  if (!canvas) return;

  /* ── Renderer ───────────────────────────────────────── */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x000000, 0);

  /* ── Scene ──────────────────────────────────────────── */
  const scene = new THREE.Scene();

  /* ── Camera ─────────────────────────────────────────── */
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 500);
  camera.position.set(0, 0, CAM_Z);
  camera.lookAt(0, 0, 0);

  /* ── Lighting ───────────────────────────────────────── */
  scene.add(new THREE.AmbientLight(0xffffff, 0.08));

  const sun = new THREE.DirectionalLight(0xfff6e8, 2.8);
  sun.position.set(-9, 1.5, 3);
  scene.add(sun);

  const fill = new THREE.PointLight(0x8b5cf6, 0.35);
  fill.position.set(6, -3, -5);
  scene.add(fill);

  const rim = new THREE.PointLight(0x3b82f6, 0.18);
  rim.position.set(-4, 4, 2);
  scene.add(rim);

  /* ── Moon ───────────────────────────────────────────── */
  const moonGeo = new THREE.SphereGeometry(MOON_R, 128, 128);
  const moon = new THREE.Mesh(moonGeo, new THREE.MeshStandardMaterial({
    color: 0x888888, roughness: 0.96, metalness: 0.0,
  }));
  moon.rotation.order = 'YXZ';
  moon.position.set(1.5, 0, 0);
  scene.add(moon);

  const loader = new THREE.TextureLoader();
  loader.load('img/moon_4k.jpg', tex => {
    tex.colorSpace  = THREE.SRGBColorSpace;
    tex.anisotropy  = renderer.capabilities.getMaxAnisotropy();
    tex.minFilter   = THREE.LinearMipmapLinearFilter;
    tex.magFilter   = THREE.LinearFilter;
    tex.generateMipmaps = true;
    loader.load('img/moon_4k.jpg', bumpTex => {
      bumpTex.colorSpace  = THREE.LinearSRGBColorSpace;
      bumpTex.minFilter   = THREE.LinearMipmapLinearFilter;
      bumpTex.magFilter   = THREE.LinearFilter;
      bumpTex.generateMipmaps = true;
      moon.material = new THREE.MeshStandardMaterial({
        map: tex, bumpMap: bumpTex, bumpScale: 2.2, roughness: 0.96, metalness: 0.0,
      });
    });
  });

  /* ── Atmosphere halos ───────────────────────────────── */
  [{ s: 1.055, o: 0.11 }, { s: 1.115, o: 0.04 }].forEach(({ s, o }) => {
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(MOON_R * s, 32, 32),
      new THREE.MeshPhongMaterial({
        color: 0x8b5cf6, transparent: true, opacity: o,
        side: THREE.BackSide, depthWrite: false,
      })
    );
    halo.position.copy(moon.position);
    scene.add(halo);
  });

  /* ── Artemis II Orion ───────────────────────────────── */
  const artemis = createOrion();
  scene.add(artemis);

  let _artemisAngle    = Math.PI * 0.6;  // start on visible side
  let _artemisOrbitIdx = 0;              // equatorial first pass
  let _wasOccluded     = false;
  const _artemisRotMat = new THREE.Matrix4();

  /* ── Apollo CSM ─────────────────────────────────────── */
  // Apollo has its OWN angle so it advances at NORM when visible and FAST
  // only when Apollo itself is occluded. This prevents the previous bug
  // where Apollo fast-advanced (appeared to zip) while visible because
  // Artemis was fast-advancing behind the moon.
  //
  // Collision prevention: enforce a minimum angular separation MIN_ANG_SEP
  // each frame — if Apollo drifts within MIN_ANG_SEP of Artemis, clamp it
  // back. MIN_ANG_SEP = π/2 (90°) → XZ distance ≥ ORBIT_R√2 ≈ 11 units.
  const apollo = createApollo();
  scene.add(apollo);

  const TWO_PI = Math.PI * 2;
  const MIN_ANG_SEP = Math.PI / 2;     // 90° minimum angular gap

  let _apolloAngle       = _artemisAngle + Math.PI;  // start opposite
  let _apolloOrbitIdx    = 2;   // moderate descending (Artemis starts equatorial)
  let _apolloWasOccluded = false;
  const _apolloRotMat    = new THREE.Matrix4();

  /* ── Resize ─────────────────────────────────────────── */
  function resize() {
    const parent = canvas.parentElement;
    if (!parent) return;
    const origW = parent.clientWidth + BLEED_PX;   // original canvas width (no left bleed)
    const totalW = origW + BLEED_LEFT;              // extended canvas width
    const h = parent.clientHeight;
    renderer.setSize(totalW, h);
    canvas.style.left = `-${BLEED_LEFT}px`;
    // setViewOffset: project the scene as if the canvas were origW wide,
    // but render starting BLEED_LEFT pixels to the LEFT of that.
    // This gives the same moon position/shape while revealing extra space on the left.
    camera.setViewOffset(origW, h, -BLEED_LEFT, 0, totalW, h);
    camera.aspect = origW / h;
    camera.fov    = FOV;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  /* ── Render loop ────────────────────────────────────── */
  (function loop() {
    requestAnimationFrame(loop);

    // Moon rotation
    _targetMoonRotY += MOON_SPEED;
    _moonRotY = _lerp(_moonRotY, _targetMoonRotY, LERP_SLOW);
    moon.rotation.y = _moonRotY;

    // ── Artemis orbit ─────────────────────────────────────
    const orbit = ORBIT_PRESETS[_artemisOrbitIdx];
    const mx    = moon.position.x;  // 1.5

    const aX = mx + Math.sin(_artemisAngle) * ARTEMIS_ORBIT_R;
    const aY = Math.sin(_artemisAngle * orbit.yFreq) * orbit.yAmp;
    const aZ = Math.cos(_artemisAngle) * ARTEMIS_ORBIT_R;

    // Smooth limb fade: segment-distance from camera→Artemis to moon centre
    const vx = aX, vy = aY, vz = aZ - CAM_Z;
    const vLen2 = vx*vx + vy*vy + vz*vz;
    const tNum  = aX*mx - vz*CAM_Z;
    const tc    = Math.max(0, Math.min(1, tNum / vLen2));
    const cpx   = tc*vx - mx, cpy = tc*vy, cpz = CAM_Z + tc*vz;
    const dSeg  = Math.sqrt(cpx*cpx + cpy*cpy + cpz*cpz);

    const FADE_MIN = MOON_R, FADE_MAX = MOON_R * 1.12;
    const alpha = Math.max(0, Math.min(1, (dSeg - FADE_MIN) / (FADE_MAX - FADE_MIN)));
    _setGroupOpacity(artemis, alpha);

    const isOccluded = _rayHitsSphere(0, 0, CAM_Z, aX, aY, aZ, mx, 0, 0, MOON_R);

    if (isOccluded && !_wasOccluded) {
      // Random new path; Apollo will get opposite-polarity preset
      _artemisOrbitIdx = _nextPreset(_artemisOrbitIdx);
    }
    _wasOccluded = isOccluded;

    if (isOccluded) {
      artemis.visible = false;
      const nextAngle = _artemisAngle + ARTEMIS_SPEED_FAST;
      const nX = mx + Math.sin(nextAngle) * ARTEMIS_ORBIT_R;
      const nY = Math.sin(nextAngle * orbit.yFreq) * orbit.yAmp;
      const nZ = Math.cos(nextAngle) * ARTEMIS_ORBIT_R;
      const nextOccluded = _rayHitsSphere(0, 0, CAM_Z, nX, nY, nZ, mx, 0, 0, MOON_R);
      _artemisAngle += nextOccluded ? ARTEMIS_SPEED_FAST : ARTEMIS_SPEED_NORM;
    } else {
      artemis.visible = true;
      artemis.position.set(aX, aY, aZ);

      const _zenith = new THREE.Vector3(aX - mx, aY, aZ).normalize();
      const _vel    = new THREE.Vector3(
        Math.cos(_artemisAngle) * ARTEMIS_ORBIT_R,
        Math.cos(_artemisAngle * orbit.yFreq) * orbit.yFreq * orbit.yAmp,
        -Math.sin(_artemisAngle) * ARTEMIS_ORBIT_R
      ).normalize();
      const _right = new THREE.Vector3().crossVectors(_vel, _zenith).normalize();
      const _fwd   = new THREE.Vector3().crossVectors(_zenith, _right).normalize();
      _artemisRotMat.makeBasis(_right, _fwd, _zenith);
      artemis.setRotationFromMatrix(_artemisRotMat);

      _artemisAngle += ARTEMIS_SPEED_NORM;
    }

    // ── Apollo orbit — independent angle, own fast/norm switching ────
    // Advances at NORM when Apollo is visible, FAST only when Apollo is
    // occluded. Artemis fast-advancing no longer affects Apollo's speed.
    const apolloOrbit = ORBIT_PRESETS[_apolloOrbitIdx];

    const pX = mx + Math.sin(_apolloAngle) * ARTEMIS_ORBIT_R;
    const pY = Math.sin(_apolloAngle * apolloOrbit.yFreq) * apolloOrbit.yAmp;
    const pZ = Math.cos(_apolloAngle) * ARTEMIS_ORBIT_R;

    const pvx = pX, pvy = pY, pvz = pZ - CAM_Z;
    const pvLen2 = pvx*pvx + pvy*pvy + pvz*pvz;
    const ptNum  = pX*mx - pvz*CAM_Z;
    const ptc    = Math.max(0, Math.min(1, ptNum / pvLen2));
    const pcpx   = ptc*pvx - mx, pcpy = ptc*pvy, pcpz = CAM_Z + ptc*pvz;
    const pdSeg  = Math.sqrt(pcpx*pcpx + pcpy*pcpy + pcpz*pcpz);
    const apolloAlpha = Math.max(0, Math.min(1, (pdSeg - FADE_MIN) / (FADE_MAX - FADE_MIN)));
    _setGroupOpacity(apollo, apolloAlpha);

    const apolloOccluded = _rayHitsSphere(0, 0, CAM_Z, pX, pY, pZ, mx, 0, 0, MOON_R);

    if (apolloOccluded && !_apolloWasOccluded) {
      _apolloOrbitIdx = _nextApolloPreset(_artemisOrbitIdx);
    }
    _apolloWasOccluded = apolloOccluded;

    if (apolloOccluded) {
      apollo.visible = false;
      const nextApolloAngle = _apolloAngle + ARTEMIS_SPEED_FAST;
      const nX2 = mx + Math.sin(nextApolloAngle) * ARTEMIS_ORBIT_R;
      const nY2 = Math.sin(nextApolloAngle * apolloOrbit.yFreq) * apolloOrbit.yAmp;
      const nZ2 = Math.cos(nextApolloAngle) * ARTEMIS_ORBIT_R;
      const nextOcc2 = _rayHitsSphere(0, 0, CAM_Z, nX2, nY2, nZ2, mx, 0, 0, MOON_R);
      _apolloAngle += nextOcc2 ? ARTEMIS_SPEED_FAST : ARTEMIS_SPEED_NORM;
    } else {
      apollo.visible = true;
      apollo.position.set(pX, pY, pZ);

      const _aZenith = new THREE.Vector3(pX - mx, pY, pZ).normalize();
      const _aVel    = new THREE.Vector3(
        Math.cos(_apolloAngle) * ARTEMIS_ORBIT_R,
        Math.cos(_apolloAngle * apolloOrbit.yFreq) * apolloOrbit.yFreq * apolloOrbit.yAmp,
        -Math.sin(_apolloAngle) * ARTEMIS_ORBIT_R
      ).normalize();
      const _aRight  = new THREE.Vector3().crossVectors(_aVel, _aZenith).normalize();
      const _aFwd    = new THREE.Vector3().crossVectors(_aZenith, _aRight).normalize();
      _apolloRotMat.makeBasis(_aRight, _aFwd, _aZenith);
      apollo.setRotationFromMatrix(_apolloRotMat);

      _apolloAngle += ARTEMIS_SPEED_NORM;
    }

    // ── Enforce minimum angular separation (collision prevention) ────
    // Normalise Apollo's angle relative to Artemis into [0, 2π).
    // If it's within MIN_ANG_SEP of either end (i.e. near 0 or near 2π),
    // push it back to the safe zone.
    const sep = ((_apolloAngle - _artemisAngle) % TWO_PI + TWO_PI) % TWO_PI;
    if (sep < MIN_ANG_SEP) {
      _apolloAngle = _artemisAngle + MIN_ANG_SEP;
    } else if (sep > TWO_PI - MIN_ANG_SEP) {
      _apolloAngle = _artemisAngle + TWO_PI - MIN_ANG_SEP;
    }

    renderer.render(scene, camera);
  })();
}

/* ══════════════════════════════════════════════════════════
   Orion spacecraft model  (Artemis II)
   Visually: large + silver/white SM + 4 wide blue solar wings.
   Real Orion ESA SM has silver thermal panels + blue arrays.
   ══════════════════════════════════════════════════════════ */
function createOrion() {
  const group = new THREE.Group();

  const alum   = new THREE.MeshPhongMaterial({ color: 0xdce3ea, specular: 0x99aabb, shininess: 90, transparent: true, opacity: 1 });
  const silver = new THREE.MeshPhongMaterial({ color: 0xc4cdd6, specular: 0xffffff, shininess: 110, transparent: true, opacity: 1 });
  const solar  = new THREE.MeshPhongMaterial({ color: 0x0d2a55, emissive: new THREE.Color(0x091830), specular: new THREE.Color(0x4d9ef7), shininess: 55, transparent: true, opacity: 1 });
  const dark   = new THREE.MeshPhongMaterial({ color: 0x222228, specular: 0x111111, shininess: 15, transparent: true, opacity: 1 });
  const accent = new THREE.MeshPhongMaterial({ color: 0x3b6ea8, specular: 0x88bbff, shininess: 60, transparent: true, opacity: 1 });

  // ── Command Module (CM) — wide blunt cone, white ──────────
  const cm = new THREE.Mesh(new THREE.ConeGeometry(0.40, 0.32, 16), alum);
  cm.rotation.z = Math.PI;
  cm.position.y = 0.58;
  group.add(cm);

  // CM heat shield
  const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.40, 0.40, 0.045, 16), dark);
  shield.position.y = 0.40;
  group.add(shield);

  // ── CM–SM adapter frustum ─────────────────────────────────
  const adapter = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.40, 0.14, 16), silver);
  adapter.position.y = 0.27;
  group.add(adapter);

  // ── Service Module — silver/white, wide and squat ─────────
  const sm = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.60, 16), silver);
  sm.position.y = -0.04;
  group.add(sm);

  // Silver panel seam rings (3 rings to break up the SM surface)
  for (const y of [0.16, -0.04, -0.24]) {
    const seam = new THREE.Mesh(new THREE.CylinderGeometry(0.305, 0.305, 0.030, 16), accent);
    seam.position.y = y;
    group.add(seam);
  }

  // ── Propulsion module cap (bottom of SM) ──────────────────
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.12, 14), dark);
  cap.position.y = -0.40;
  group.add(cap);

  // ── Solar wings — 4 arms in X pattern (45° offset), panels tilted 20° ──
  // X pattern (π/4 offset) looks far better than + pattern from any viewing angle.
  // Each panel tilts 20° around its arm axis (solar-tracking tilt) so it catches light.
  for (let i = 0; i < 4; i++) {
    const ry   = (i / 4) * Math.PI * 2 + Math.PI / 4;  // X shape: 45°, 135°, 225°, 315°
    const dx   = Math.sin(ry), dz = Math.cos(ry);
    const tilt = Math.PI / 9;   // ~20° solar-tracking tilt around the arm

    // Root boom
    const rootBoom = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.32, 6), alum);
    rootBoom.rotation.set(Math.PI / 2, ry, 0);
    rootBoom.position.set(dx * 0.46, -0.04, dz * 0.46);
    group.add(rootBoom);

    // Inner solar panel — tilted around arm axis
    const inner = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.26, 0.012), solar);
    inner.position.set(dx * 0.62, -0.04, dz * 0.62);
    inner.rotation.set(tilt, ry, 0);
    group.add(inner);

    // Link boom
    const linkBoom = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 0.66, 6), alum);
    linkBoom.rotation.set(Math.PI / 2, ry, 0);
    linkBoom.position.set(dx * 0.95, -0.04, dz * 0.95);
    group.add(linkBoom);

    // Outer solar panel — same tilt
    const outer = new THREE.Mesh(new THREE.BoxGeometry(0.60, 0.24, 0.012), solar);
    outer.position.set(dx * 1.28, -0.04, dz * 1.28);
    outer.rotation.set(tilt, ry, 0);
    group.add(outer);
  }

  group.scale.setScalar(0.255);
  return group;
}

/* ══════════════════════════════════════════════════════════
   Apollo CSM model
   Visually: small + rich copper-gold SM + prominent engine
   bell + NO solar wings (Apollo used fuel cells).
   Unmistakably different from the large silver Orion.
   ══════════════════════════════════════════════════════════ */
function createApollo() {
  const group = new THREE.Group();

  const alum   = new THREE.MeshPhongMaterial({ color: 0xe0e4e8, specular: 0x777777, shininess: 70, transparent: true, opacity: 1 });
  // Rich copper-bronze gold — very different from Orion's silver SM
  const copper = new THREE.MeshPhongMaterial({ color: 0xb86a18, specular: 0xffaa44, shininess: 80, transparent: true, opacity: 1 });
  const dark   = new THREE.MeshPhongMaterial({ color: 0x282830, specular: 0x111111, shininess: 15, transparent: true, opacity: 1 });
  const silver = new THREE.MeshPhongMaterial({ color: 0xa8b4bc, specular: 0xffffff, shininess: 120, transparent: true, opacity: 1 });

  // ── Command Module — narrow pointed cone ──────────────────
  const cm = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.46, 12), alum);
  cm.rotation.z = Math.PI;
  cm.position.y = 0.64;
  group.add(cm);

  // CM heat shield (wide, very visible dark disc)
  const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.05, 12), dark);
  shield.position.y = 0.40;
  group.add(shield);

  // RCS thruster packages — 4 visible dark blocks around CM base
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const rcs = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.09), dark);
    rcs.position.set(Math.cos(a) * 0.27, 0.41, Math.sin(a) * 0.27);
    group.add(rcs);
  }

  // ── SM adapter ────────────────────────────────────────────
  const tunnel = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.26, 0.13, 12), alum);
  tunnel.position.y = 0.27;
  group.add(tunnel);

  // ── Service Module — long copper-bronze cylinder ──────────
  // Kapton thermal foil = distinctive warm copper/amber color
  const sm = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.78, 12), copper);
  sm.position.y = -0.10;
  group.add(sm);

  // SM panel separation lines (dark seam bands)
  for (const y of [0.20, -0.10, -0.40]) {
    const seam = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.245, 0.025, 12), dark);
    seam.position.y = y;
    group.add(seam);
  }

  // SM RCS quads — 4 protruding blocks near top of SM
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const quad = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.09, 0.10), dark);
    quad.position.set(Math.cos(a) * 0.26, 0.22, Math.sin(a) * 0.26);
    group.add(quad);
  }

  // ── Engine bell — very prominent, highly flared ───────────
  // SPS engine is the most recognizable Apollo feature after the CM
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.08, 0.38, 14), dark);
  bell.rotation.z = Math.PI;
  bell.position.y = -0.68;
  group.add(bell);

  const bellRim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.030, 14), silver);
  bellRim.position.y = -0.55;
  group.add(bellRim);

  const throat = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.14, 10), silver);
  throat.rotation.z = Math.PI;
  throat.position.y = -0.55;
  group.add(throat);

  // ── High-gain antenna ─────────────────────────────────────
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.38, 6), alum);
  mast.rotation.z = Math.PI / 3;
  mast.position.set(0.24, 0.08, 0);
  group.add(mast);

  const dish = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    silver
  );
  dish.rotation.z = -Math.PI / 3;
  dish.position.set(0.41, 0.20, 0);
  group.add(dish);

  group.scale.setScalar(0.34);   // noticeably smaller than Orion
  return group;
}
