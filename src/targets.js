// Targets fly toward the player on the beat. Pooled (no allocations mid-game) for steady FPS.
import * as THREE from 'three';
import { CONFIG, COLORS } from './config.js';

const POOL_SIZE = 32;

export class TargetManager {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    const geo = new THREE.IcosahedronGeometry(CONFIG.TARGET_RADIUS, 1);
    const ringGeo = new THREE.TorusGeometry(CONFIG.TARGET_RADIUS * 1.35, 0.008, 6, 32);
    this.mats = {
      left: new THREE.MeshStandardMaterial({ color: COLORS.left, emissive: COLORS.left, emissiveIntensity: 0.55, flatShading: true }),
      right: new THREE.MeshStandardMaterial({ color: COLORS.right, emissive: COLORS.right, emissiveIntensity: 0.55, flatShading: true }),
    };
    this.ringMats = {
      left: new THREE.MeshBasicMaterial({ color: COLORS.left, transparent: true, opacity: 0.8 }),
      right: new THREE.MeshBasicMaterial({ color: COLORS.right, transparent: true, opacity: 0.8 }),
    };

    this.pool = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      const mesh = new THREE.Mesh(geo, this.mats.left);
      const ring = new THREE.Mesh(ringGeo, this.ringMats.left);
      mesh.add(ring);
      mesh.visible = false;
      this.group.add(mesh);
      this.pool.push({ mesh, ring, note: null, alive: false });
    }
    this.reset([]);
  }

  reset(chart) {
    this.chart = chart;
    this.next = 0;
    this.pool.forEach((t) => { t.alive = false; t.mesh.visible = false; });
  }

  get remaining() { return this.chart.length - this.next + this.pool.filter((t) => t.alive).length; }

  _spawn(note) {
    const t = this.pool.find((p) => !p.alive);
    if (!t) return;
    t.alive = true;
    t.note = note;
    t.mesh.material = this.mats[note.hand];
    t.ring.material = this.ringMats[note.hand];
    t.mesh.visible = true;
    t.mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0);
  }

  // Returns { hits: [...], misses: n, wrong: [...] }
  update(songTime, headY, gloves, minSpeed) {
    const res = { hits: [], wrong: [], misses: 0 };
    const travel = CONFIG.SPAWN_DISTANCE / CONFIG.TARGET_SPEED;

    // Spawn every note whose fly-in should have started
    while (this.next < this.chart.length && this.chart[this.next].time - travel <= songTime) {
      this._spawn(this.chart[this.next++]);
    }

    for (const t of this.pool) {
      if (!t.alive) continue;
      const n = t.note;
      const z = CONFIG.HIT_PLANE_Z - (n.time - songTime) * CONFIG.TARGET_SPEED;
      t.mesh.position.set(n.x, headY + n.yOff, z);
      t.mesh.rotation.x += 0.02;
      t.mesh.rotation.y += 0.03;
      // ring always faces the player
      t.ring.quaternion.copy(t.mesh.quaternion).invert();
      // grow slightly as it reaches the hit zone
      const near = THREE.MathUtils.clamp(1 - Math.abs(z - CONFIG.HIT_PLANE_Z) / 2, 0, 1);
      t.mesh.scale.setScalar(1 + near * 0.15);

      if (z > CONFIG.MISS_Z) {
        t.alive = false; t.mesh.visible = false;
        res.misses++;
        continue;
      }

      // Only hittable when close to the player
      if (z < CONFIG.HIT_PLANE_Z - 1.4) continue;
      for (const g of gloves) {
        if (g.isDesktop) {
          // Mouse: compare on-screen position only, with a longer timing window
          const dx = g.pos.x - t.mesh.position.x, dy = g.pos.y - t.mesh.position.y;
          if (Math.hypot(dx, dy) > g.reach) continue;
        } else {
          if (z < CONFIG.HIT_PLANE_Z - 0.7) continue;
          if (g.pos.distanceTo(t.mesh.position) > CONFIG.HIT_RADIUS) continue;
        }
        if (!CONFIG.TEST_MODE && g.speed < minSpeed) continue;
        t.alive = false; t.mesh.visible = false;
        const timing = Math.abs(z - CONFIG.HIT_PLANE_Z); // 0 = perfectly on beat
        const info = { glove: g, hand: n.hand, pos: t.mesh.position.clone(), speed: g.speed, timing };
        if (g.hand === 'any' || g.hand === n.hand) res.hits.push(info);
        else res.wrong.push(info);
        break;
      }
    }
    return res;
  }
}
