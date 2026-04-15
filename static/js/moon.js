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
const MOON_SPEED  = 0;         // Moon stands still
const CAM_Z       = 12;
const FOV         = 65;
const BLEED_PX    = 400;
const BLEED_LEFT  = 300;
const LERP_SLOW   = 0.035;

/* ── Orbit constants ────────────────────────────────────── */
const ARTEMIS_ORBIT_R    = MOON_R * 1.22;   // ≈ 7.8 — just outside halo
const ARTEMIS_SPEED_NORM = 0.00375;          // matches ISS_SPEED_NORM in globe.js
const ARTEMIS_SPEED_FAST = 0.035;           // fast-advance while occluded — matches ISS_SPEED_FAST

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

/* ── Surface math (used by rover system) ────────────────── */
// Moon center is at world pos (1.5, 0, 0); camera at (0, 0, CAM_Z=12).
// Spherical parameterisation (theta=longitude, phi=latitude):
//   normal = (cos φ·cos θ,  sin φ,  cos φ·sin θ)
//   surface point = moonCenter + r·normal
const _MOON_CTR = new THREE.Vector3(1.5, 0, 0);
// Direction from moon centre toward camera — used for visibility tests
const _CAM_DIR  = new THREE.Vector3(-1.5, 0, CAM_Z).normalize();

function _sPt(theta, phi, r) {
  // Default offset MOON_R + 0.046 clears the deepest wheel geometry after 1/3 + 20% scale reduction
  // (variant 3: ~0.044 below origin) so rovers rest on, not inside, the surface.
  const rr = r || MOON_R + 0.046;
  return new THREE.Vector3(
    _MOON_CTR.x + rr * Math.cos(phi) * Math.cos(theta),
    _MOON_CTR.y + rr * Math.sin(phi),
    _MOON_CTR.z + rr * Math.cos(phi) * Math.sin(theta)
  );
}
function _sNorm(theta, phi) {
  return new THREE.Vector3(
    Math.cos(phi) * Math.cos(theta),
    Math.sin(phi),
    Math.cos(phi) * Math.sin(theta)
  );
}
// Forward tangent vector for given heading h (0=north / +phi, π/2=east / +theta)
function _sFwd(theta, phi, h) {
  // t_phi  (north): d(norm)/dφ = (−sin φ cos θ,  cos φ,  −sin φ sin θ)
  const tpx = -Math.sin(phi)*Math.cos(theta);
  const tpy =  Math.cos(phi);
  const tpz = -Math.sin(phi)*Math.sin(theta);
  // t_theta (east, unit): (−sin θ, 0, cos θ)
  const ttx = -Math.sin(theta);
  const ttz =  Math.cos(theta);
  return new THREE.Vector3(
    Math.cos(h)*tpx + Math.sin(h)*ttx,
    Math.cos(h)*tpy,
    Math.cos(h)*tpz + Math.sin(h)*ttz
  ).normalize();
}



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
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type    = THREE.PCFSoftShadowMap;

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
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near   = 1;
  sun.shadow.camera.far    = 30;
  sun.shadow.camera.left   = -9;
  sun.shadow.camera.right  =  9;
  sun.shadow.camera.top    =  9;
  sun.shadow.camera.bottom = -9;
  sun.shadow.bias          = -0.002;
  // Target the moon centre so the frustum is correctly positioned
  sun.target.position.set(1.5, 0, 0);
  scene.add(sun);
  scene.add(sun.target);

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
  moon.receiveShadow = true;
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

  /* ── Moon Rovers ────────────────────────────────────── */
  // The moon centre's "camera direction" (from moon toward camera in world space)
  // is the same as the module-level _CAM_DIR constant.
  const ROVER_N     = Math.floor(Math.random() * 4) + 1;   // 1–4 rovers
  const TRAIL_MAX   = 8000;          // safety cap — tracks stay visible indefinitely in practice
  const TRACK_HALF  = 0.044;        // half-gap between tyre tracks (world units)
  // Centre of visible face: theta ≈ 1.70 rad, phi = 0
  const THETA_CTR   = 1.70;

  const _rovers = [];
  for (let ri = 0; ri < ROVER_N; ri++) {
    const roverGroup = createRover(ri % 4);
    scene.add(roverGroup);

    // Two trail lines — left and right tyre track
    const mkLine = () => {
      const geo = new THREE.BufferGeometry();
      const mat = new THREE.LineBasicMaterial({
        color: 0x706050, opacity: 0.68, transparent: true, depthWrite: false,
      });
      const line = new THREE.Line(geo, mat);
      scene.add(line);
      return { line, geo, pts: [] };
    };
    const trackL = mkLine();
    const trackR = mkLine();

    // Camera-flash: bright sprite (always faces camera) + point light added once below
    const flashSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      color: 0xffffff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    flashSprite.scale.setScalar(0.001); // hidden until flash
    scene.add(flashSprite);

    // Random start on the visible hemisphere
    const theta0   = THETA_CTR + (Math.random() - 0.5) * 1.4;
    const phi0     = (Math.random() - 0.5) * 1.0;
    const heading0 = Math.random() * Math.PI * 2;

    _rovers.push({
      group: roverGroup, trackL, trackR, flashSprite,
      flashOrigin: roverGroup.getObjectByName('flashOrigin'),
      theta: theta0, phi: phi0,
      heading: heading0, tgtHeading: heading0,
      // ~1/10 of Orion orbital speed (ARTEMIS_SPEED_NORM=0.00375 at r=7.8 → 0.029 units/frame;
      // 1/10 on moon surface r=6.4 → ~0.0004 rad/frame)
      speed:   0.00028 + Math.random() * 0.00014,
      state:   'driving',        // 'driving' | 'stopping' | 'photo' | 'resuming'
      stTimer: 0, flashTimer: 0,
      avoidingLimb: false,       // true while steering away from far side
      scopeAngle: Math.random() * Math.PI * 2,
      scopeActive: false, scopeTmr: 100 + Math.floor(Math.random() * 200),
    });
  }

  // Shared PointLight that briefly fires during any rover photo flash
  const _flashPL = new THREE.PointLight(0xffffff, 0, 5);
  _flashPL.position.set(0, -200, 0); // parked off-screen
  scene.add(_flashPL);

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
      const pNextAngle = _apolloAngle + ARTEMIS_SPEED_FAST;
      const pnX = mx + Math.sin(pNextAngle) * ARTEMIS_ORBIT_R;
      const pnY = Math.sin(pNextAngle * apolloOrbit.yFreq) * apolloOrbit.yAmp;
      const pnZ = Math.cos(pNextAngle) * ARTEMIS_ORBIT_R;
      const pNextOccluded = _rayHitsSphere(0, 0, CAM_Z, pnX, pnY, pnZ, mx, 0, 0, MOON_R);
      _apolloAngle += pNextOccluded ? ARTEMIS_SPEED_FAST : ARTEMIS_SPEED_NORM;
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

    // Apollo always moves at NORM speed so it can never catch Artemis;
    // the old angular-separation guard is no longer needed.

    // ── Rovers ───────────────────────────────────────────────
    for (const rv of _rovers) {
      const STOP_P = 0.0018, TURN_P = 0.005;

      if (rv.state === 'driving') {
        // Random gentle turn — set new target heading infrequently
        if (Math.random() < TURN_P) {
          rv.tgtHeading = rv.heading + (Math.random() - 0.5) * Math.PI * 0.7;
        }

        // Angle-normalised lerp: always take the short arc, never spin past ±π
        const hdDiff = ((rv.tgtHeading - rv.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        rv.heading += hdDiff * 0.02;

        // Advance along surface
        const cphi = Math.max(0.08, Math.cos(rv.phi));
        rv.phi   += rv.speed * Math.cos(rv.heading);
        rv.theta += rv.speed * Math.sin(rv.heading) / cphi;
        rv.phi    = Math.max(-1.25, Math.min(1.25, rv.phi));
        rv.theta  = ((rv.theta % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

        // Steer away from limb — set new target only ONCE when entering the
        // danger zone; clear the flag when safely back on visible face.
        const lookAheadNorm = _sNorm(
          rv.theta + rv.speed * Math.sin(rv.heading) / cphi * 12,
          rv.phi   + rv.speed * Math.cos(rv.heading) * 12
        );
        const limbDot = lookAheadNorm.dot(_CAM_DIR);
        if (!rv.avoidingLimb && limbDot < 0.15) {
          rv.avoidingLimb = true;
          rv.tgtHeading   = rv.heading + Math.PI * (0.6 + Math.random() * 0.8);
        } else if (rv.avoidingLimb && limbDot > 0.30) {
          rv.avoidingLimb = false;
        }

        // Random stop for photo
        if (Math.random() < STOP_P) {
          rv.state   = 'stopping';
          rv.stTimer = 40 + Math.floor(Math.random() * 60);
        }

      } else if (rv.state === 'stopping') {
        rv.stTimer--;
        if (rv.stTimer <= 0) { rv.state = 'photo'; rv.flashTimer = 22; }

      } else if (rv.state === 'photo') {
        rv.flashTimer--;
        // Two-pulse flash pattern over 22 frames:
        //   frames 22→16  ramp up → peak (pulse 1)
        //   frames 16→12  fade down to 10%
        //   frames 12→ 6  ramp up → peak (pulse 2, slightly dimmer)
        //   frames  6→ 0  fade out
        const f = rv.flashTimer;        // counts 22→0
        let strength;
        if      (f > 16) strength = (22 - f) / 6;           // ramp up
        else if (f > 13) strength = 1.0;                     // peak 1
        else if (f > 10) strength = 0.1 + (f - 10) * 0.3;   // dip
        else if (f >  6) strength = 0.85 * (f - 6) / 4;     // ramp up 2
        else if (f >  3) strength = 0.85;                    // peak 2
        else             strength = f / 3 * 0.85;            // fade out
        strength = Math.max(0, strength);

        // Position flash at the actual lens/camera-head world position
        const fpos = new THREE.Vector3();
        if (rv.flashOrigin) rv.flashOrigin.getWorldPosition(fpos);
        else fpos.copy(_sPt(rv.theta, rv.phi, MOON_R + 0.12));
        rv.flashSprite.position.copy(fpos);
        rv.flashSprite.material.opacity = strength;
        rv.flashSprite.scale.setScalar(strength > 0.01 ? 0.05 + strength * 0.08 : 0.001);
        _flashPL.position.copy(fpos);
        _flashPL.intensity = strength * 1.5;

        if (rv.flashTimer <= 0) {
          rv.flashSprite.material.opacity = 0;
          rv.flashSprite.scale.setScalar(0.001);
          _flashPL.intensity = 0;
          _flashPL.position.set(0, -200, 0);
          rv.state   = 'resuming';
          rv.stTimer = 25 + Math.floor(Math.random() * 50);
        }

      } else if (rv.state === 'resuming') {
        rv.stTimer--;
        if (rv.stTimer <= 0) {
          rv.state      = 'driving';
          rv.tgtHeading = rv.heading + (Math.random() - 0.5) * Math.PI * 0.8;
        }
      }

      // Inter-rover collision avoidance — steer apart if within MIN_ROVER_D
      const MIN_ROVER_D = 0.55;
      for (const other of _rovers) {
        if (other === rv) continue;
        const posRv  = _sPt(rv.theta, rv.phi);
        const posOth = _sPt(other.theta, other.phi);
        if (posRv.distanceTo(posOth) < MIN_ROVER_D) {
          // Direction from rv toward other, projected onto rv's tangent plane
          const nRv   = _sNorm(rv.theta, rv.phi);
          const dirTo = posOth.clone().sub(posRv);
          dirTo.addScaledVector(nRv, -dirTo.dot(nRv)).normalize();
          // Bearing toward other, then steer π away
          const fN = _sFwd(rv.theta, rv.phi, 0);
          const fE = _sFwd(rv.theta, rv.phi, Math.PI / 2);
          rv.tgtHeading   = Math.atan2(dirTo.dot(fE), dirTo.dot(fN)) + Math.PI;
          rv.avoidingLimb = false;
        }
      }

      // Surface geometry
      const pos    = _sPt(rv.theta, rv.phi);
      const norm   = _sNorm(rv.theta, rv.phi);
      const fwd    = _sFwd(rv.theta, rv.phi, rv.heading);
      // Rover models have their nose in local -Z direction.
      // Use negFwd so the nose faces the direction of travel.
      const negFwd = fwd.clone().negate();
      const right  = new THREE.Vector3().crossVectors(norm, negFwd).normalize();

      const visible = norm.dot(_CAM_DIR) > 0.0;
      rv.group.visible = visible;

      if (visible) {
        rv.group.position.copy(pos);
        // Orient: nose faces direction of travel (local -Z = world fwd)
        const mat4 = new THREE.Matrix4().makeBasis(right, norm, negFwd);
        rv.group.setRotationFromMatrix(mat4);

        // Append trail points while driving
        if (rv.state === 'driving') {
          rv.trackL.pts.push(pos.clone().addScaledVector(right, -TRACK_HALF));
          rv.trackR.pts.push(pos.clone().addScaledVector(right,  TRACK_HALF));
          if (rv.trackL.pts.length > TRAIL_MAX) { rv.trackL.pts.shift(); rv.trackR.pts.shift(); }
        }
      }

      // Rebuild trail geometry (only visible-face points)
      const rebuildTrail = (track) => {
        const visPts = track.pts.filter(p =>
          p.clone().sub(_MOON_CTR).normalize().dot(_CAM_DIR) > 0
        );
        if (visPts.length < 2) { track.geo.setDrawRange(0, 0); return; }
        const buf = new Float32Array(visPts.length * 3);
        visPts.forEach((p, i) => { buf[i*3] = p.x; buf[i*3+1] = p.y; buf[i*3+2] = p.z; });
        track.geo.setAttribute('position', new THREE.BufferAttribute(buf, 3));
        track.geo.setDrawRange(0, visPts.length);
      };
      rebuildTrail(rv.trackL);
      rebuildTrail(rv.trackR);

      // Telescope pan (variants 2 and 3 have a 'telescope' named group)
      const scope = rv.group.getObjectByName('telescope');
      if (scope) {
        if (rv.state !== 'driving') {
          // Aim forward for photo. With the flipped rover orientation
          // (local -Z = world fwd), forward = scope.rotation.y = Math.PI.
          const cur  = ((rv.scopeAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
          let   diff = Math.PI - cur;
          if (diff >  Math.PI) diff -= Math.PI * 2;
          if (diff < -Math.PI) diff += Math.PI * 2;
          rv.scopeAngle += diff * 0.1;
          scope.rotation.y = rv.scopeAngle;
        } else {
          rv.scopeTmr--;
          if (rv.scopeTmr <= 0) {
            rv.scopeActive = !rv.scopeActive;
            rv.scopeTmr    = rv.scopeActive
              ? 120 + Math.floor(Math.random() * 160)
              : 250 + Math.floor(Math.random() * 350);
          }
          if (rv.scopeActive) {
            rv.scopeAngle += 0.022;
            scope.rotation.y = rv.scopeAngle;
          }
        }
      } else {
        // Variants without telescope: just tick the timer
        rv.scopeTmr--;
        if (rv.scopeTmr <= 0) {
          rv.scopeActive = !rv.scopeActive;
          rv.scopeTmr    = rv.scopeActive
            ? 120 + Math.floor(Math.random() * 160)
            : 250 + Math.floor(Math.random() * 350);
        }
      }
    }

    renderer.render(scene, camera);
  })();
}

/* ══════════════════════════════════════════════════════════
   Moon Rover models  (4 distinct variants)
   Same material palette as Orion / Apollo spacecraft.
   ══════════════════════════════════════════════════════════ */
function createRover(variant) {
  const g = new THREE.Group();

  // Shared material palette — same as the spacecraft
  const alum   = () => new THREE.MeshPhongMaterial({ color: 0xdce3ea, specular: 0x99aabb, shininess: 90,  transparent: true, opacity: 1 });
  const solar  = () => new THREE.MeshPhongMaterial({ color: 0x0d2a55, emissive: new THREE.Color(0x091830), specular: new THREE.Color(0x4d9ef7), shininess: 55, transparent: true, opacity: 1 });
  const dark   = () => new THREE.MeshPhongMaterial({ color: 0x222228, specular: 0x111111, shininess: 15,  transparent: true, opacity: 1 });
  const gold   = () => new THREE.MeshPhongMaterial({ color: 0xc8a84b, specular: 0xffee88, shininess: 70,  transparent: true, opacity: 1 });
  const accent = () => new THREE.MeshPhongMaterial({ color: 0x3b6ea8, specular: 0x88bbff, shininess: 60,  transparent: true, opacity: 1 });
  const tyre   = () => new THREE.MeshPhongMaterial({ color: 0x3a3830, specular: 0x111100, shininess: 8,   transparent: true, opacity: 1 });

  const addWheel = (mat, rx, ry, rz, r, w, sides = 10) => {
    const wh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, sides), mat);
    wh.rotation.z = Math.PI / 2;
    wh.position.set(rx, ry, rz);
    g.add(wh);
  };
  const addBox = (mat, w, h, d, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  const addCyl = (mat, rt, rb, h, sides, x, y, z, rx = 0, ry = 0) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, sides), mat);
    m.rotation.set(rx, ry, 0);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };

  if (variant === 0) {
    // ── LRV-style: open gold chassis, 4 wire-spoke wheels ──
    addBox(gold(),  0.30, 0.04, 0.68, 0,  0,    0);          // chassis deck
    addBox(alum(),  0.22, 0.11, 0.28, 0,  0.08, -0.16);      // instrument console (front)
    addBox(solar(), 0.20, 0.03, 0.22, 0,  0.16, -0.16);      // equipment panel
    addBox(alum(),  0.18, 0.09, 0.20, 0,  0.07,  0.20);      // aft equipment box
    // fenders
    for (const [fx, fz] of [[0.17,-0.26],[0.17,0.26],[-0.17,-0.26],[-0.17,0.26]]) {
      addBox(alum(), 0.11, 0.03, 0.17, fx, 0.04, fz);
    }
    // 4 wheels
    for (const [wx, wz] of [[0.22,-0.29],[0.22,0.29],[-0.22,-0.29],[-0.22,0.29]]) {
      addWheel(tyre(), wx, -0.04, wz, 0.12, 0.06);
    }
    // axles
    addCyl(alum(), 0.020, 0.020, 0.44, 6,  0, -0.04, -0.29, 0, 0);
    g.children[g.children.length-1].rotation.z = Math.PI/2;
    addCyl(alum(), 0.020, 0.020, 0.44, 6,  0, -0.04,  0.29, 0, 0);
    g.children[g.children.length-1].rotation.z = Math.PI/2;
    // camera mast (front-left)
    addCyl(alum(), 0.018, 0.018, 0.30, 6, -0.06, 0.25, -0.30);
    const camHead0 = addBox(dark(),  0.08, 0.06, 0.07, -0.06, 0.41, -0.30);  // camera head
    camHead0.name = 'flashOrigin';
    // high-gain antenna dish (rear)
    addCyl(alum(), 0.013, 0.013, 0.22, 5,  0.08, 0.20,  0.34);
    const dish0 = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 8, 4, 0, Math.PI*2, 0, Math.PI/2), alum());
    dish0.rotation.x = Math.PI; dish0.position.set(0.08, 0.32, 0.34); g.add(dish0);

    g.scale.setScalar(0.214);

  } else if (variant === 1) {
    // ── VIPER-style: boxy white body, drill arm, 4 wheels ──
    addBox(alum(),  0.36, 0.20, 0.66, 0, 0.08, 0);           // main body
    addBox(solar(), 0.34, 0.05, 0.44, 0, 0.20, 0);           // solar panel top
    addBox(alum(),  0.38, 0.015, 0.46, 0, 0.225, 0);         // panel frame
    // side panel accents
    addBox(accent(), 0.015, 0.14, 0.60, 0.19, 0.08, 0);
    addBox(accent(), 0.015, 0.14, 0.60,-0.19, 0.08, 0);
    // 4 wheels with suspension stubs
    for (const [wx, wz] of [[0.24,-0.26],[0.24,0.26],[-0.24,-0.26],[-0.24,0.26]]) {
      addWheel(tyre(), wx, -0.04, wz, 0.13, 0.07);
      addBox(dark(), 0.10, 0.04, 0.05, wx*0.58, -0.02, wz);  // suspension arm
    }
    // drill arm (front)
    const drillArm = new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.018,0.32,5), accent());
    drillArm.rotation.x = Math.PI/3; drillArm.position.set(0, 0.06, -0.44); g.add(drillArm);
    addBox(dark(), 0.06, 0.06, 0.06, 0, -0.04, -0.58);       // drill bit
    // camera mast
    addCyl(alum(), 0.016, 0.016, 0.22, 5,  0.10, 0.31, -0.15);
    const camHead1 = addBox(dark(),  0.07, 0.07, 0.09,  0.10, 0.43, -0.15);
    camHead1.name = 'flashOrigin';

    g.scale.setScalar(0.202);

  } else if (variant === 2) {
    // ── Yutu/Jade-Rabbit style: 6 wheels, rocker-bogie, rotating telescope ──
    addBox(gold(),  0.28, 0.14, 0.52, 0, 0.09, 0);           // body (gold Kapton)
    addBox(solar(), 0.38, 0.025, 0.50, 0, 0.20, 0);          // solar panel
    addBox(alum(),  0.40, 0.012, 0.52, 0, 0.214, 0);         // panel frame
    // panel solar cells grid lines
    for (let gz = -0.22; gz <= 0.22; gz += 0.11) {
      addBox(dark(), 0.38, 0.008, 0.008, 0, 0.22, gz);
    }
    // 6 wheels (rocker-bogie positions)
    for (const [wx, wz] of [
      [ 0.21,-0.22],[ 0.21, 0.00],[ 0.21, 0.22],
      [-0.21,-0.22],[-0.21, 0.00],[-0.21, 0.22]
    ]) {
      addWheel(tyre(), wx, 0.00, wz, 0.10, 0.065, 10);
    }
    // rocker links
    for (const sx of [0.175, -0.175]) {
      addBox(dark(), 0.06, 0.03, 0.44, sx, 0.01, 0);
    }
    // mast + ROTATING telescope (named 'telescope')
    addCyl(alum(), 0.018, 0.018, 0.38, 6, 0, 0.40, -0.12);
    const tPivot2 = new THREE.Group();
    tPivot2.name = 'telescope';
    tPivot2.position.set(0, 0.60, -0.12);
    // telescope tube
    const tube2 = new THREE.Mesh(new THREE.CylinderGeometry(0.038,0.032,0.20,8), dark());
    tube2.rotation.x = Math.PI/2; tube2.position.set(0, 0, 0.10); tPivot2.add(tube2);
    // lens cap (flash emits from here)
    const lens2 = new THREE.Mesh(new THREE.CircleGeometry(0.038,8), accent());
    lens2.name = 'flashOrigin';
    lens2.rotation.x = -Math.PI/2; lens2.position.set(0, 0, 0.21); tPivot2.add(lens2);
    // small camera beside scope
    addBox(dark(), 0.06, 0.05, 0.07, 0.10, 0, 0); tPivot2.children[tPivot2.children.length-1].position.set(0.10, 0, 0.04);
    g.add(tPivot2);

    g.scale.setScalar(0.208);

  } else {
    // ── variant 3: compact angular rover, big wheels, side telescope ──
    addBox(alum(),  0.26, 0.22, 0.56, 0, 0.08, 0);           // body
    // angled nose wedge
    const nose = new THREE.Mesh(new THREE.CylinderGeometry(0,0.175,0.14,4), alum());
    nose.rotation.set(0, Math.PI/4, Math.PI); nose.position.set(0, 0.09, -0.33); g.add(nose);
    // dark visor bar
    addBox(dark(),  0.22, 0.055, 0.03, 0, 0.15, -0.30);
    // solar strip on top
    addBox(solar(), 0.20, 0.012, 0.46, 0, 0.195, 0.02);
    // 4 large wheels
    for (const [wx, wz] of [[0.21,-0.21],[0.21,0.21],[-0.21,-0.21],[-0.21,0.21]]) {
      addWheel(tyre(), wx, -0.05, wz, 0.15, 0.09, 12);
      // hub cap accent
      addWheel(accent(), wx, -0.05, wz, 0.06, 0.095, 6);
    }
    // mast + ROTATING telescope (named 'telescope')
    addCyl(alum(), 0.022, 0.022, 0.22, 6, -0.08, 0.30, 0.10);
    const tPivot3 = new THREE.Group();
    tPivot3.name = 'telescope';
    tPivot3.position.set(-0.08, 0.42, 0.10);
    const tube3 = new THREE.Mesh(new THREE.CylinderGeometry(0.032,0.028,0.22,8), dark());
    tube3.rotation.x = Math.PI/2.2; tube3.position.set(0, 0.03, 0.09); tPivot3.add(tube3);
    const cap3 = new THREE.Mesh(new THREE.SphereGeometry(0.032,6,4), accent());
    cap3.name = 'flashOrigin';
    cap3.position.set(0, 0.09, 0.19); tPivot3.add(cap3);
    // wide-angle camera
    addBox(dark(), 0.07, 0.06, 0.08, 0.10, 0, 0.02); tPivot3.children[tPivot3.children.length-1].position.set(0.09, 0, 0.02);
    g.add(tPivot3);
    // rear antenna
    addCyl(alum(), 0.012, 0.012, 0.24, 5, 0.10, 0.28, 0.28);

    g.scale.setScalar(0.218);
  }

  // All meshes in every rover variant cast + receive shadows
  g.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });

  return g;
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

  group.scale.setScalar(0.152);   // 0.255 × 0.70 × 0.85
  group.traverse(c => { if (c.isMesh) c.castShadow = true; });
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

  group.scale.setScalar(0.202);   // 0.34 × 0.70 × 0.85, noticeably smaller than Orion
  group.traverse(c => { if (c.isMesh) c.castShadow = true; });
  return group;
}
