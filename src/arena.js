// Glowing neon arena: floor grid, lights, fog, light rings, side pillars.
// Low-poly with mostly unlit materials so it stays fast on Quest.
import * as THREE from 'three';
import { COLORS } from './config.js';

export function createArena(scene) {
  scene.fog = new THREE.Fog(COLORS.bg, 6, 28);

  scene.add(new THREE.HemisphereLight(0x6fa8ff, 0x101020, 1.2));
  const key = new THREE.DirectionalLight(0xffffff, 1.0);
  key.position.set(1, 4, 2);
  scene.add(key);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshBasicMaterial({ color: 0x070915 })
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const grid = new THREE.GridHelper(40, 40, 0x4da3ff, 0x1b2a55);
  grid.position.y = 0.002;
  grid.material.transparent = true;
  grid.material.opacity = 0.6;
  scene.add(grid);

  // Where to stand
  const pad = new THREE.Mesh(
    new THREE.RingGeometry(0.45, 0.5, 48),
    new THREE.MeshBasicMaterial({ color: COLORS.accent, side: THREE.DoubleSide })
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.004;
  scene.add(pad);

  // Tunnel of rings the targets fly through
  const rings = [];
  for (let i = 0; i < 8; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.3, 0.025, 8, 64),
      new THREE.MeshBasicMaterial({ color: COLORS.magenta, transparent: true, opacity: 0.7 })
    );
    ring.position.set(0, 1.4, -3 - i * 2.5);
    scene.add(ring);
    rings.push(ring);
  }

  // Side pillars
  const pillarGeo = new THREE.BoxGeometry(0.15, 4, 0.15);
  const pillarMats = [
    new THREE.MeshBasicMaterial({ color: COLORS.right }),
    new THREE.MeshBasicMaterial({ color: COLORS.left }),
  ];
  for (let i = 0; i < 6; i++) {
    for (const side of [-1, 1]) {
      const p = new THREE.Mesh(pillarGeo, pillarMats[side < 0 ? 0 : 1]);
      p.position.set(side * 3.2, 2, -2 - i * 3.5);
      scene.add(p);
    }
  }

  // pulse: 0..1 beat strength (1 = right on the beat)
  function update(t, pulse = 0.5) {
    rings.forEach((r, i) => {
      const wave = 0.5 + 0.5 * Math.sin(t * 3 - i * 0.6);
      r.material.opacity = 0.2 + 0.35 * wave + 0.4 * pulse;
      r.scale.setScalar(1 + pulse * 0.04);
    });
    grid.material.opacity = 0.35 + 0.45 * pulse;
    pad.material.opacity = 1;
  }

  return { floor, grid, rings, update };
}
