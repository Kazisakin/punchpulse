// Targets fly toward the player on the beat.
// Look: glowing energy orb (fresnel rim) + hot core + halo + speed trail + timing ring
// that shrinks onto the orb exactly on the beat. Pooled for steady FPS.
import * as THREE from 'three';
import { CONFIG, COLORS } from './config.js';
import { fresnelMaterial, glowSprite } from './gfx.js';

const POOL_SIZE = 32;

function trailMaterial(color) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uColor; varying vec2 vUv;
      void main(){ float a = pow(1.0 - vUv.y, 1.6) * 0.55; gl_FragColor = vec4(uColor * a, a); }`,
  });
}

export class TargetManager {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    const R = CONFIG.TARGET_RADIUS;
    const orbGeo = new THREE.IcosahedronGeometry(R, 3);
    const coreGeo = new THREE.IcosahedronGeometry(R * 0.45, 1);
    const ringGeo = new THREE.TorusGeometry(R * 1.3, 0.007, 6, 48);
    const trailGeo = new THREE.ConeGeometry(R * 0.85, 1.1, 16, 1, true);
    trailGeo.rotateX(-Math.PI / 2);        // tip points away from the player (-z)
    trailGeo.translate(0, 0, -0.55 - R * 0.3);

    this.mats = {};
    for (const hand of ['left', 'right']) {
      const c = COLORS[hand];
      this.mats[hand] = {
        orb: fresnelMaterial(c, { core: 0.35, rim: 1.8, power: 2.0 }),
        core: new THREE.MeshBasicMaterial({ color: new THREE.Color(c).lerp(new THREE.Color(0xffffff), 0.7), toneMapped: false }),
        ring: new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9, toneMapped: false }),
        trail: trailMaterial(c),
      };
    }

    this.pool = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      const root = new THREE.Group();
      const orb = new THREE.Mesh(orbGeo, this.mats.left.orb);
      const core = new THREE.Mesh(coreGeo, this.mats.left.core);
      const ring = new THREE.Mesh(ringGeo, this.mats.left.ring);
      const trail = new THREE.Mesh(trailGeo, this.mats.left.trail);
      const halo = glowSprite(COLORS.left, R * 5, 0.5);
      root.add(trail, orb, core, halo, ring);
      root.visible = false;
      this.group.add(root);
      this.pool.push({ root, orb, core, ring, trail, halo, note: null, alive: false });
    }
    this.reset([]);
  }

  reset(chart) {
    this.chart = chart;
    this.next = 0;
    this.pool.forEach((t) => { t.alive = false; t.root.visible = false; });
  }

  _spawn(note) {
    const t = this.pool.find((p) => !p.alive);
    if (!t) return;
    const m = this.mats[note.hand];
    t.alive = true;
    t.note = note;
    t.orb.material = m.orb;
    t.core.material = m.core;
    t.ring.material = m.ring;
    t.trail.material = m.trail;
    t.halo.material.color.set(COLORS[note.hand]);
    t.root.visible = true;
    t.spin = Math.random() * 6;
  }

  // Returns { hits: [...], misses: n, wrong: [...] }
  update(songTime, headY, gloves, minSpeed) {
    const res = { hits: [], wrong: [], misses: 0 };
    const travel = CONFIG.SPAWN_DISTANCE / CONFIG.TARGET_SPEED;

    while (this.next < this.chart.length && this.chart[this.next].time - travel <= songTime) {
      this._spawn(this.chart[this.next++]);
    }

    for (const t of this.pool) {
      if (!t.alive) continue;
      const n = t.note;
      const z = CONFIG.HIT_PLANE_Z - (n.time - songTime) * CONFIG.TARGET_SPEED;
      t.root.position.set(n.x, headY + n.yOff, z);

      // core wobble + spin
      t.spin += 0.05;
      t.orb.rotation.set(t.spin * 0.7, t.spin, 0);
      const toBeat = (n.time - songTime);                 // seconds until the beat
      const near = THREE.MathUtils.clamp(1 - Math.abs(toBeat) / 0.6, 0, 1);
      t.core.scale.setScalar(1 + 0.25 * Math.sin(t.spin * 3) + near * 0.4);

      // timing ring: big while far, closes onto the orb exactly on the beat
      const ringS = toBeat > 0 ? 1 + Math.min(toBeat, 0.8) * 2.2 : 1;
      t.ring.scale.setScalar(ringS);
      t.ring.material.opacity = 0.35 + 0.65 * near;

      // fade in from the distance, halo swells near the hit zone
      t.halo.material.opacity = 0.25 + 0.5 * near;
      t.root.scale.setScalar(z < -10 ? THREE.MathUtils.mapLinear(z, -14.5, -10, 0.2, 1) : 1 + near * 0.12);
      // once it has flown past the punch zone, shrink away instead of sweeping past your face
      const past = z - (CONFIG.HIT_PLANE_Z + 0.15);
      t.trail.visible = past < 0;
      if (past > 0) t.root.scale.setScalar(Math.max(0.01, 1 - past * 3));

      if (z > CONFIG.MISS_Z) {
        t.alive = false; t.root.visible = false;
        res.misses++;
        continue;
      }

      if (z < CONFIG.HIT_PLANE_Z - 1.4) continue;
      const pos = t.root.position;
      for (const g of gloves) {
        if (g.isDesktop) {
          const dx = g.pos.x - pos.x, dy = g.pos.y - pos.y;
          if (Math.hypot(dx, dy) > g.reach) continue;
        } else {
          if (z < CONFIG.HIT_PLANE_Z - 0.7) continue;
          if (g.pos.distanceTo(pos) > CONFIG.HIT_RADIUS) continue;
        }
        if (!CONFIG.TEST_MODE && g.speed < minSpeed) continue;
        t.alive = false; t.root.visible = false;
        const timing = Math.abs(z - CONFIG.HIT_PLANE_Z);
        const info = { glove: g, hand: n.hand, pos: pos.clone(), speed: g.speed, timing };
        if (g.hand === 'any' || g.hand === n.hand) res.hits.push(info);
        else res.wrong.push(info);
        break;
      }
    }
    return res;
  }
}
