// Targets fly toward the player on the beat. Pooled (no allocations mid-game) for steady FPS.
//   punch / upper — glowing orbs (uppercuts carry an up-arrow and need an upward punch)
//   block         — violet guard bar: both fists up in front of your face as it arrives
//   duck / leanL / leanR — dodge walls, judged by your real head position as they pass you
import * as THREE from 'three';
import { CONFIG, COLORS } from './config.js';
import { fresnelMaterial, glowSprite } from './gfx.js';
import { isWall, travelTime } from './chart.js';

const ORB_POOL = 32;
const BLOCK_POOL = 6;
const WALL_POOL = 6;

function trailMaterial(color) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uColor; varying vec2 vUv;
      void main(){ float a = pow(1.0 - vUv.y, 1.6) * 0.55; gl_FragColor = vec4(uColor * a, a); }`,
  });
}

function labelTexture(text, color) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 160;
  const g = c.getContext('2d');
  g.font = '900 104px system-ui, Segoe UI, Roboto, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = color; g.shadowBlur = 24; g.fillStyle = '#ffffff';
  g.fillText(text, 256, 84);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class TargetManager {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.speed = 7;
    this.hitRadius = CONFIG.HIT_RADIUS;

    const R = CONFIG.TARGET_RADIUS;
    // ---------------- orbs (punch + uppercut) ----------------
    const orbGeo = new THREE.IcosahedronGeometry(R, 3);
    const coreGeo = new THREE.IcosahedronGeometry(R * 0.45, 1);
    const ringGeo = new THREE.TorusGeometry(R * 1.3, 0.007, 6, 48);
    const trailGeo = new THREE.ConeGeometry(R * 0.85, 1.1, 16, 1, true);
    trailGeo.rotateX(-Math.PI / 2);
    trailGeo.translate(0, 0, -0.55 - R * 0.3);
    // up-arrow for uppercuts: a chevron made of a cone
    const arrowGeo = new THREE.ConeGeometry(0.07, 0.11, 3);
    arrowGeo.translate(0, R + 0.09, 0);

    this.mats = {};
    for (const hand of ['left', 'right']) {
      const c = COLORS[hand];
      this.mats[hand] = {
        orb: fresnelMaterial(c, { core: 0.35, rim: 1.8, power: 2.0 }),
        core: new THREE.MeshBasicMaterial({ color: new THREE.Color(c).lerp(new THREE.Color(0xffffff), 0.7), toneMapped: false }),
        ring: new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9, toneMapped: false }),
        trail: trailMaterial(c),
        arrow: new THREE.MeshBasicMaterial({ color: new THREE.Color(c).lerp(new THREE.Color(0xffffff), 0.5), toneMapped: false }),
      };
    }

    this.orbs = [];
    for (let i = 0; i < ORB_POOL; i++) {
      const root = new THREE.Group();
      const orb = new THREE.Mesh(orbGeo, this.mats.left.orb);
      const core = new THREE.Mesh(coreGeo, this.mats.left.core);
      const ring = new THREE.Mesh(ringGeo, this.mats.left.ring);
      const trail = new THREE.Mesh(trailGeo, this.mats.left.trail);
      const arrow = new THREE.Mesh(arrowGeo, this.mats.left.arrow);
      const halo = glowSprite(COLORS.left, R * 5, 0.5);
      root.add(trail, orb, core, halo, ring, arrow);
      root.visible = false;
      this.group.add(root);
      this.orbs.push({ root, orb, core, ring, trail, halo, arrow, note: null, alive: false });
    }

    // ---------------- block guard bars ----------------
    const barGeo = new THREE.CapsuleGeometry(0.06, 0.34, 8, 20);
    barGeo.rotateZ(Math.PI / 2);
    const fistRingGeo = new THREE.TorusGeometry(0.075, 0.008, 6, 36);
    const blockMat = fresnelMaterial(COLORS.block, { core: 0.3, rim: 1.7, power: 2.0 });
    const blockRingMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, toneMapped: false });
    this.blocks = [];
    for (let i = 0; i < BLOCK_POOL; i++) {
      const root = new THREE.Group();
      const bar = new THREE.Mesh(barGeo, blockMat);
      const ringL = new THREE.Mesh(fistRingGeo, blockRingMat);
      const ringR = new THREE.Mesh(fistRingGeo, blockRingMat);
      ringL.position.set(-0.14, 0, 0.05);
      ringR.position.set(0.14, 0, 0.05);
      const timing = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.006, 6, 48), blockRingMat.clone());
      timing.scale.set(1, 0.45, 1);
      const halo = glowSprite(COLORS.block, 0.9, 0.35);
      root.add(halo, bar, ringL, ringR, timing);
      root.visible = false;
      this.group.add(root);
      this.blocks.push({ root, timing, halo, note: null, alive: false, done: false });
    }

    // ---------------- dodge walls ----------------
    this.wallTex = {
      duck: labelTexture('DUCK', '#ffa52b'),
      leanL: labelTexture('◀ LEAN', '#ffa52b'),
      leanR: labelTexture('LEAN ▶', '#ffa52b'),
    };
    this.walls = [];
    for (let i = 0; i < WALL_POOL; i++) {
      const root = new THREE.Group();
      const panelMat = new THREE.MeshBasicMaterial({
        color: COLORS.wall, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, toneMapped: false,
      });
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), panelMat);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.PlaneGeometry(1, 1)),
        new THREE.LineBasicMaterial({ color: COLORS.wall, transparent: true, opacity: 0.95, toneMapped: false })
      );
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, toneMapped: false }));
      label.scale.set(0.6, 0.19, 1);
      root.add(panel, edges, label);
      root.visible = false;
      this.group.add(root);
      this.walls.push({ root, panel, edges, label, note: null, alive: false, judged: false });
    }

    this.reset([], { speed: 7, hitBonus: 0 });
  }

  reset(chart, difficulty) {
    this.chart = chart;
    this.next = 0;
    if (difficulty) {
      this.speed = difficulty.speed;
      this.hitRadius = CONFIG.HIT_RADIUS + (difficulty.hitBonus || 0);
    }
    for (const t of [...this.orbs, ...this.blocks, ...this.walls]) { t.alive = false; t.root.visible = false; }
  }

  // Seconds until the next dodge wall reaches the player (Infinity if none soon)
  timeToNextWall(songTime) {
    let best = Infinity;
    for (const w of this.walls) if (w.alive && !w.judged) best = Math.min(best, w.note.time - songTime);
    for (let i = this.next; i < this.chart.length && i < this.next + 8; i++) {
      if (isWall(this.chart[i].type)) best = Math.min(best, this.chart[i].time - songTime);
    }
    return best;
  }

  _spawn(note) {
    if (note.type === 'block') {
      const t = this.blocks.find((p) => !p.alive);
      if (!t) return;
      Object.assign(t, { alive: true, done: false, note });
      t.root.visible = true;
      return;
    }
    if (isWall(note.type)) {
      const t = this.walls.find((p) => !p.alive);
      if (!t) return;
      Object.assign(t, { alive: true, judged: false, note });
      t.label.material.map = this.wallTex[note.type];
      t.label.material.needsUpdate = true;
      t.root.visible = true;
      t.layoutDone = false;
      return;
    }
    const t = this.orbs.find((p) => !p.alive);
    if (!t) return;
    const m = this.mats[note.hand];
    t.alive = true;
    t.note = note;
    t.orb.material = m.orb;
    t.core.material = m.core;
    t.ring.material = m.ring;
    t.trail.material = m.trail;
    t.arrow.material = m.arrow;
    t.arrow.visible = note.type === 'upper';
    t.halo.material.color.set(COLORS[note.hand]);
    t.root.visible = true;
    t.spin = Math.random() * 6;
  }

  /**
   * ctx: { songTime, headY (target height reference), headPos (live head, world),
   *        headRef ({x,y} standing reference), gloves, minSpeed(glove), autoDodge }
   * Returns { hits, wrong, misses, blocks, blockMisses, dodges, ouches }
   */
  update(ctx) {
    const { songTime, headY, gloves, minSpeed } = ctx;
    const res = { hits: [], wrong: [], misses: 0, blocks: [], blockMisses: 0, dodges: [], ouches: [] };

    while (this.next < this.chart.length) {
      const n = this.chart[this.next];
      if (n.time - travelTime(n, this.speed) > songTime) break;
      this._spawn(n);
      this.next++;
    }

    this._updateOrbs(songTime, headY, gloves, minSpeed, res);
    this._updateBlocks(songTime, headY, gloves, res);
    this._updateWalls(ctx, res);
    return res;
  }

  _z(note, songTime, judgeZ = CONFIG.HIT_PLANE_Z) {
    return judgeZ - (note.time - songTime) * this.speed;
  }

  _updateOrbs(songTime, headY, gloves, minSpeed, res) {
    for (const t of this.orbs) {
      if (!t.alive) continue;
      const n = t.note;
      const z = this._z(n, songTime);
      t.root.position.set(n.x, headY + n.yOff, z);

      t.spin += 0.05;
      t.orb.rotation.set(t.spin * 0.7, t.spin, 0);
      const toBeat = n.time - songTime;
      const near = THREE.MathUtils.clamp(1 - Math.abs(toBeat) / 0.6, 0, 1);
      t.core.scale.setScalar(1 + 0.25 * Math.sin(t.spin * 3) + near * 0.4);
      t.ring.scale.setScalar(toBeat > 0 ? 1 + Math.min(toBeat, 0.8) * 2.2 : 1);
      t.ring.material.opacity = 0.35 + 0.65 * near;
      t.halo.material.opacity = 0.25 + 0.5 * near;
      if (t.arrow.visible) t.arrow.position.y = Math.sin(t.spin * 4) * 0.015;
      t.root.scale.setScalar(z < -10 ? THREE.MathUtils.mapLinear(z, -14.5, -10, 0.2, 1) : 1 + near * 0.12);
      const past = z - (CONFIG.HIT_PLANE_Z + 0.15);
      t.trail.visible = past < 0;
      if (past > 0) t.root.scale.setScalar(Math.max(0.01, 1 - past * 3));

      if (z > CONFIG.MISS_Z) { t.alive = false; t.root.visible = false; res.misses++; continue; }
      if (z < CONFIG.HIT_PLANE_Z - 1.4) continue;

      const pos = t.root.position;
      for (const g of gloves) {
        if (g.isDesktop) {
          if (Math.hypot(g.pos.x - pos.x, g.pos.y - pos.y) > g.reach) continue;
        } else {
          if (z < CONFIG.HIT_PLANE_Z - 0.7) continue;
          if (g.pos.distanceTo(pos) > this.hitRadius) continue;
        }
        if (!CONFIG.TEST_MODE) {
          if (g.speed < minSpeed(g)) continue;
          // uppercuts must be thrown upward
          if (n.type === 'upper' && !g.isDesktop && g.velocity.y < CONFIG.UPPERCUT_MIN_UP_SPEED) continue;
        }
        t.alive = false; t.root.visible = false;
        const info = { glove: g, hand: n.hand, type: n.type, pos: pos.clone(), speed: g.speed, timing: Math.abs(z - CONFIG.HIT_PLANE_Z) };
        if (g.hand === 'any' || g.hand === n.hand) res.hits.push(info);
        else res.wrong.push(info);
        break;
      }
    }
  }

  _updateBlocks(songTime, headY, gloves, res) {
    for (const t of this.blocks) {
      if (!t.alive) continue;
      const n = t.note;
      const z = this._z(n, songTime);
      t.root.position.set(0, headY + n.yOff, z);
      const toBeat = n.time - songTime;
      t.timing.scale.set(1 + Math.max(0, Math.min(toBeat, 0.8)) * 1.5, 0.45 * (1 + Math.max(0, Math.min(toBeat, 0.8)) * 1.5), 1);
      t.timing.material.opacity = 0.3 + 0.6 * THREE.MathUtils.clamp(1 - Math.abs(toBeat) / 0.6, 0, 1);
      const past = z - (CONFIG.HIT_PLANE_Z + 0.2);
      if (past > 0) t.root.scale.setScalar(Math.max(0.01, 1 - past * 3));
      else t.root.scale.setScalar(z < -10 ? THREE.MathUtils.mapLinear(z, -14.5, -10, 0.2, 1) : 1);

      if (z > CONFIG.MISS_Z) { t.alive = false; t.root.visible = false; res.blockMisses++; continue; }
      // judged in a window around arm's length: both fists near the bar
      if (z < CONFIG.HIT_PLANE_Z - 0.4 || z > CONFIG.HIT_PLANE_Z + 0.25) continue;
      const pos = t.root.position;
      const sides = new Set();
      let desktopHit = false;
      for (const g of gloves) {
        if (g.isDesktop) {
          if (Math.hypot(g.pos.x - pos.x, g.pos.y - pos.y) < 0.3) desktopHit = true;
          continue;
        }
        const dx = Math.abs(g.pos.x - pos.x), dy = Math.abs(g.pos.y - pos.y), dz = Math.abs(g.pos.z - pos.z);
        if (dx < 0.34 && dy < 0.2 && dz < 0.35) sides.add(g.hand);
      }
      if (desktopHit || (sides.has('left') && sides.has('right')) || (CONFIG.TEST_MODE && sides.size)) {
        t.alive = false; t.root.visible = false;
        res.blocks.push({ pos: pos.clone(), timing: Math.abs(z - CONFIG.HIT_PLANE_Z) });
      }
    }
  }

  _updateWalls(ctx, res) {
    const { songTime, headRef, headPos, autoDodge } = ctx;
    for (const t of this.walls) {
      if (!t.alive) continue;
      const n = t.note;
      const z = this._z(n, songTime, CONFIG.WALL_JUDGE_Z);
      if (!t.layoutDone) {
        // size & place the wall relative to the player's standing head position
        const p = t.panel, e = t.edges, l = t.label;
        if (n.type === 'duck') {
          const bottom = headRef.y - 0.13, top = headRef.y + 0.55;
          p.scale.set(2.6, top - bottom, 1); p.position.set(0, (top + bottom) / 2, 0);
          l.position.set(0, (top + bottom) / 2, 0.01);
        } else {
          const dir = n.type === 'leanL' ? 1 : -1; // wall sits on the side you lean away from
          const inner = headRef.x - dir * 0.1, outer = headRef.x + dir * 1.3;
          const cx = (inner + outer) / 2;
          p.scale.set(Math.abs(outer - inner), 2.6, 1); p.position.set(cx, 1.3, 0);
          l.position.set(headRef.x + dir * 0.45, headRef.y, 0.01);
        }
        e.scale.copy(p.scale); e.position.copy(p.position);
        t.layoutDone = true;
      }
      t.root.position.z = z;
      // fade as it reaches the player so it never blinds them
      const fade = THREE.MathUtils.clamp(-z / 1.2, 0.15, 1);
      t.panel.material.opacity = 0.22 * fade;
      t.edges.material.opacity = 0.95 * fade;
      t.label.material.opacity = fade;

      if (!t.judged && z >= CONFIG.WALL_JUDGE_Z) {
        t.judged = true;
        let ok = !!autoDodge;
        if (!ok && headPos) {
          if (n.type === 'duck') ok = headPos.y < headRef.y - CONFIG.DUCK_DEPTH;
          else if (n.type === 'leanL') ok = headPos.x < headRef.x - CONFIG.LEAN_DISTANCE;
          else ok = headPos.x > headRef.x + CONFIG.LEAN_DISTANCE;
        }
        (ok ? res.dodges : res.ouches).push({ type: n.type, pos: new THREE.Vector3(headRef.x, headRef.y - 0.1, -0.6) });
      }
      if (z > 1.2) { t.alive = false; t.root.visible = false; }
    }
  }
}
