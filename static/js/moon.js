/**
 * moon.js
 *
 * Three.js scene rendered behind the #space section:
 *   - Rotating Moon (large, like the Earth in the hero)
 *   - Simplified ISS orbiting slowly
 *   - 4 floating astronauts tumbling in zero-g
 */

import * as THREE from 'three';

const MOON_R      = 3.2;
const MOON_SPEED  = 0.00025;   // slow rotation
const CAM_Z       = 6.8;

/* ══════════════════════════════════════════════════════════
   initMoon
   ══════════════════════════════════════════════════════════ */
export function initMoon() {
  const canvas = document.getElementById('moon-canvas');
  if (!canvas) return;

  /* ── Renderer ───────────────────────────────────────── */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  /* ── Scene ──────────────────────────────────────────── */
  const scene = new THREE.Scene();

  /* ── Camera ─────────────────────────────────────────── */
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);
  camera.position.set(0, 0, CAM_Z);
  camera.lookAt(0, 0, 0);

  /* ── Lighting ───────────────────────────────────────── */
  scene.add(new THREE.AmbientLight(0xffffff, 0.10));

  // Main directional light (sun)
  const sun = new THREE.DirectionalLight(0xfff6e8, 2.4);
  sun.position.set(-5, 3, 6);
  scene.add(sun);

  // Violet fill light — matches the space section accent colour
  const fill = new THREE.PointLight(0x8b5cf6, 0.55);
  fill.position.set(6, -3, -5);
  scene.add(fill);

  // Soft blue rim light
  const rim = new THREE.PointLight(0x3b82f6, 0.28);
  rim.position.set(-4, 4, 2);
  scene.add(rim);

  /* ── Moon ───────────────────────────────────────────── */
  const moonGeo = new THREE.SphereGeometry(MOON_R, 64, 64);
  const moon = new THREE.Mesh(moonGeo, new THREE.MeshPhongMaterial({
    color:     0x9a9a9a,
    emissive:  new THREE.Color(0x111116),
    specular:  new THREE.Color(0x222222),
    shininess: 4,
  }));
  // Position moon slightly down-right so it bleeds off-edge like the Earth
  moon.position.set(1.2, -0.6, 0);
  scene.add(moon);

  // Load crater texture
  new THREE.TextureLoader().load(
    'https://threejs.org/examples/textures/planets/moon_1024.jpg',
    tex => {
      moon.material = new THREE.MeshPhongMaterial({
        map:       tex,
        specular:  new THREE.Color(0x111111),
        shininess: 3,
      });
    }
  );

  // Atmosphere halos — subtle violet tint
  [{ s: 1.045, o: 0.09 }, { s: 1.10, o: 0.04 }].forEach(({ s, o }) => {
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(MOON_R * s, 32, 32),
      new THREE.MeshPhongMaterial({
        color: 0x8b5cf6, transparent: true, opacity: o,
        side: THREE.BackSide, depthWrite: false,
      })
    ));
  });

  /* ── ISS ────────────────────────────────────────────── */
  const iss = createISS();
  scene.add(iss);

  /* ── Astronauts ─────────────────────────────────────── */
  const astronauts = [];
  const astSeeds = [
    { bx: -4.2, by:  2.0, bz:  0.8, rs: 0.0038, fs: 0.42, fa: 0.18, ph: 0.0 },
    { bx:  3.8, by: -1.8, bz:  1.2, rs: -0.003, fs: 0.55, fa: 0.22, ph: 1.3 },
    { bx: -3.0, by: -2.5, bz: -0.6, rs: 0.0055, fs: 0.35, fa: 0.15, ph: 2.7 },
    { bx:  4.5, by:  1.5, bz: -1.0, rs: -0.004, fs: 0.48, fa: 0.20, ph: 4.2 },
  ];

  for (const s of astSeeds) {
    const g = createAstronaut();
    g.position.set(s.bx, s.by, s.bz);
    // Random initial tumble orientation
    g.rotation.set(s.ph * 1.3, s.ph * 0.9, s.ph * 0.5);
    scene.add(g);
    astronauts.push({ group: g, ...s });
  }

  /* ── Resize ─────────────────────────────────────────── */
  function resize() {
    const parent = canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  /* ── Render loop ────────────────────────────────────── */
  let t = 0;
  const ISS_ORBIT_R = 5.0;
  const ISS_SPEED   = 0.006;

  (function loop() {
    requestAnimationFrame(loop);
    t += 0.01;

    // Moon self-rotation
    moon.rotation.y += MOON_SPEED;

    // ISS orbits in a slightly tilted ellipse
    const issAngle = t * ISS_SPEED * 10;
    iss.position.set(
      moon.position.x + Math.cos(issAngle) * ISS_ORBIT_R,
      moon.position.y + Math.sin(issAngle * 0.4) * 1.8,
      Math.sin(issAngle) * ISS_ORBIT_R * 0.45
    );
    // ISS always faces direction of travel (yaw)
    iss.rotation.y  = -issAngle + Math.PI * 0.5;
    iss.rotation.x  = Math.sin(issAngle * 0.4) * 0.15;
    // Solar panels slowly track sun
    iss.children.forEach((c, i) => {
      if (c.userData.solarPanel) {
        c.rotation.y += 0.003;
      }
    });

    // Astronauts: gentle float + slow tumble
    for (const ast of astronauts) {
      ast.group.position.y =
        ast.by + Math.sin(t * ast.fs + ast.ph) * ast.fa;
      ast.group.position.x =
        ast.bx + Math.cos(t * ast.fs * 0.6 + ast.ph) * ast.fa * 0.5;
      ast.group.rotation.x += ast.rs;
      ast.group.rotation.z += ast.rs * 0.6;
      ast.group.rotation.y += ast.rs * 0.3;
    }

    renderer.render(scene, camera);
  })();
}

/* ══════════════════════════════════════════════════════════
   ISS model  — simplified but recognisable
   ══════════════════════════════════════════════════════════ */
function createISS() {
  const group = new THREE.Group();

  const alum  = new THREE.MeshPhongMaterial({ color: 0xe8eaed, specular: 0x888888, shininess: 80 });
  const solar = new THREE.MeshPhongMaterial({ color: 0x1a3a6b, emissive: new THREE.Color(0x0a1228), specular: new THREE.Color(0x3b82f6), shininess: 40 });
  const gold  = new THREE.MeshPhongMaterial({ color: 0xc8a84b, specular: 0xffd700, shininess: 60 });

  // ─ Core habitat modules ─
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

  // Connecting node (Columbus-style cross node)
  const node = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), alum);
  group.add(node);

  // ─ Integrated Truss Structure (ITS) ─
  const truss = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.035, 0.035), alum);
  group.add(truss);

  // Truss cross-beams
  for (const x of [-0.9, -0.45, 0, 0.45, 0.9]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.22, 0.03), alum);
    beam.position.x = x;
    group.add(beam);
  }

  // ─ Solar Arrays — 4 pairs (8 wings) ─
  const wingXs = [-0.88, -0.44, 0.44, 0.88];
  for (const x of wingXs) {
    for (const sign of [-1, 1]) {
      const wing = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.38, 0.008),
        solar
      );
      wing.position.set(x, sign * 0.22, 0);
      wing.userData.solarPanel = true;
      group.add(wing);

      // Gold thermal foil edge
      const foil = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.012, 0.009),
        gold
      );
      foil.position.set(x, sign * (0.22 + 0.196), 0);
      group.add(foil);
    }
  }

  // ─ Radiator panels ─
  for (const sign of [-1, 1]) {
    const rad = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.12, 0.007),
      new THREE.MeshPhongMaterial({ color: 0xc8d0d8, specular: 0xffffff, shininess: 40 })
    );
    rad.position.set(sign * 0.25, 0, -0.08);
    rad.rotation.x = 0.3 * sign;
    group.add(rad);
  }

  // Scale the whole ISS to a good viewing size
  group.scale.setScalar(0.38);

  return group;
}

/* ══════════════════════════════════════════════════════════
   Astronaut model  — simplified EVA spacesuit
   ══════════════════════════════════════════════════════════ */
function createAstronaut() {
  const group = new THREE.Group();

  const suit   = new THREE.MeshPhongMaterial({ color: 0xf0f0f2, specular: 0xaaaaaa, shininess: 35 });
  const helmet = new THREE.MeshPhongMaterial({ color: 0xeeeeee, specular: 0xdddddd, shininess: 80 });
  const visor  = new THREE.MeshPhongMaterial({
    color: 0x7cb8f5, specular: 0xffffff, shininess: 120,
    transparent: true, opacity: 0.82,
  });
  const detail = new THREE.MeshPhongMaterial({ color: 0xd0d0d0, specular: 0x888888, shininess: 20 });

  // Torso (PLSS backpack housing + front)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.16, 0.10), suit);
  group.add(torso);

  // Helmet sphere
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.072, 14, 14), helmet);
  head.position.y = 0.135;
  group.add(head);

  // Visor (gold-tinted face shield ellipse)
  const visorMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.052, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
    visor
  );
  visorMesh.position.set(0, 0.132, 0.048);
  visorMesh.rotation.x = -0.35;
  group.add(visorMesh);

  // Arms (upper arm + lower arm)
  for (const side of [-1, 1]) {
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, 0.10, 4, 8), suit);
    upper.position.set(side * 0.095, 0.04, 0);
    upper.rotation.z = side * 0.45;
    group.add(upper);

    const lower = new THREE.Mesh(new THREE.CapsuleGeometry(0.024, 0.09, 4, 8), suit);
    lower.position.set(side * 0.13, -0.04, 0.02);
    lower.rotation.z = side * 0.7;
    lower.rotation.x = 0.3;
    group.add(lower);

    // Glove
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 8), detail);
    glove.position.set(side * 0.16, -0.09, 0.03);
    group.add(glove);
  }

  // Legs
  for (const side of [-1, 1]) {
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.030, 0.09, 4, 8), suit);
    thigh.position.set(side * 0.042, -0.135, 0);
    thigh.rotation.z = side * 0.08;
    group.add(thigh);

    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.026, 0.09, 4, 8), suit);
    shin.position.set(side * 0.044, -0.235, 0);
    group.add(shin);

    // Boot
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.030, 0.075), detail);
    boot.position.set(side * 0.044, -0.29, 0.012);
    group.add(boot);
  }

  // PLSS life-support backpack
  const plss = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.13, 0.048), suit);
  plss.position.set(0, 0.02, -0.075);
  group.add(plss);

  // Chest detail (control unit)
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.02), detail);
  chest.position.set(0, 0.02, 0.062);
  group.add(chest);

  // Scale astronaut to look good next to ISS
  group.scale.setScalar(0.30);

  return group;
}
