// Hit effects: spark burst, flying shards, shockwave ring, flash, and judgement popups
// (PERFECT / GREAT / GOOD / MISS). Everything pooled — no allocations during play.
import * as THREE from 'three';
import { glowTexture, glowSprite } from './gfx.js';

const BURSTS = 12;
const SPARKS = 36;
const SHARDS_PER = 8;
const POPUPS = 8;

function popupTexture(text, color) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 160;
  const g = c.getContext('2d');
  g.font = '900 96px system-ui, Segoe UI, Roboto, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = color; g.shadowBlur = 28;
  g.fillStyle = color;
  g.fillText(text, 256, 84);
  g.shadowBlur = 0;
  g.fillStyle = '#ffffff';
  g.globalAlpha = 0.85;
  g.fillText(text, 256, 84);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Effects {
  constructor(scene) {
    this.scene = scene;

    // ---------- spark bursts + shockwave + flash ----------
    this.bursts = [];
    const ringGeo = new THREE.RingGeometry(0.12, 0.13, 48);
    for (let i = 0; i < BURSTS; i++) {
      const positions = new Float32Array(SPARKS * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const points = new THREE.Points(geo, new THREE.PointsMaterial({
        map: glowTexture(), size: 0.07, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, toneMapped: false,
      }));
      points.frustumCulled = false;
      points.visible = false;

      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
        transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      }));
      ring.visible = false;

      const flash = glowSprite(0xffffff, 0.7, 1);
      flash.visible = false;

      scene.add(points, ring, flash);
      this.bursts.push({ points, ring, flash, vel: new Float32Array(SPARKS * 3), life: 0 });
    }
    this.bi = 0;

    // ---------- shards (one instanced mesh for all) ----------
    const shardGeo = new THREE.TetrahedronGeometry(0.035);
    this.shards = new THREE.InstancedMesh(shardGeo, new THREE.MeshBasicMaterial({ toneMapped: false }), BURSTS * SHARDS_PER);
    this.shards.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.shardState = Array.from({ length: BURSTS * SHARDS_PER }, () => ({
      pos: new THREE.Vector3(), vel: new THREE.Vector3(), rot: new THREE.Euler(), spin: new THREE.Vector3(), life: 0,
    }));
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    const white = new THREE.Color(1, 1, 1);
    for (let i = 0; i < BURSTS * SHARDS_PER; i++) { this.shards.setMatrixAt(i, hidden); this.shards.setColorAt(i, white); }
    this.shards.frustumCulled = false;
    scene.add(this.shards);
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();

    // ---------- judgement popups ----------
    this.popupTex = {
      PERFECT: popupTexture('PERFECT', '#ffd23d'),
      GREAT: popupTexture('GREAT', '#3dff9a'),
      GOOD: popupTexture('GOOD', '#4da3ff'),
      MISS: popupTexture('MISS', '#ff3b5c'),
      WRONG: popupTexture('WRONG HAND', '#ff8a3d'),
    };
    this.popups = [];
    for (let i = 0; i < POPUPS; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, toneMapped: false }));
      s.scale.set(0.32, 0.1, 1);
      s.visible = false;
      s.renderOrder = 20;
      scene.add(s);
      this.popups.push({ sprite: s, life: 0 });
    }
    this.pi = 0;
  }

  burst(pos, color, strength = 1) {
    const b = this.bursts[this.bi % BURSTS];
    const base = (this.bi % BURSTS) * SHARDS_PER;
    this.bi++;

    const p = b.points.geometry.attributes.position.array;
    for (let k = 0; k < SPARKS; k++) {
      p[k * 3] = pos.x; p[k * 3 + 1] = pos.y; p[k * 3 + 2] = pos.z;
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.4, Math.random() - 0.9)
        .normalize().multiplyScalar((1.2 + Math.random() * 3) * strength);
      b.vel[k * 3] = v.x; b.vel[k * 3 + 1] = v.y; b.vel[k * 3 + 2] = v.z;
    }
    b.points.geometry.attributes.position.needsUpdate = true;
    b.points.material.color.set(color);
    b.ring.material.color.set(color);
    b.ring.position.copy(pos);
    b.ring.scale.setScalar(1);
    b.flash.position.copy(pos);
    b.flash.material.color.set(color).lerp(new THREE.Color(0xffffff), 0.5);
    b.points.visible = b.ring.visible = b.flash.visible = true;
    b.life = 1;

    const c = new THREE.Color(color);
    for (let k = 0; k < SHARDS_PER; k++) {
      const s = this.shardState[base + k];
      s.pos.copy(pos);
      s.vel.set(Math.random() - 0.5, Math.random() * 0.6, Math.random() - 1).normalize().multiplyScalar(1.5 + Math.random() * 2 * strength);
      s.rot.set(Math.random() * 6, Math.random() * 6, 0);
      s.spin.set(Math.random() * 12, Math.random() * 12, Math.random() * 12);
      s.life = 1;
      this.shards.setColorAt(base + k, c);
    }
    this.shards.instanceColor.needsUpdate = true;
  }

  popup(kind, pos) {
    const p = this.popups[this.pi++ % POPUPS];
    p.sprite.material.map = this.popupTex[kind];
    p.sprite.material.needsUpdate = true;
    p.sprite.position.set(pos.x, pos.y + 0.12, pos.z - 0.05);
    p.sprite.visible = true;
    p.life = 1;
  }

  update(dt) {
    for (const b of this.bursts) {
      if (b.life <= 0) continue;
      b.life -= dt * 2.0;
      if (b.life <= 0) { b.points.visible = b.ring.visible = b.flash.visible = false; continue; }
      const p = b.points.geometry.attributes.position.array;
      for (let k = 0; k < SPARKS * 3; k++) {
        p[k] += b.vel[k] * dt;
        if (k % 3 === 1) b.vel[k] -= 5 * dt;
        b.vel[k] *= 0.985;
      }
      b.points.geometry.attributes.position.needsUpdate = true;
      b.points.material.opacity = b.life;
      b.points.material.size = 0.035 + 0.04 * b.life;
      b.ring.scale.setScalar(1 + (1 - b.life) * 2.2);
      b.ring.material.opacity = b.life * b.life * 0.9;
      b.flash.material.opacity = Math.max(0, b.life * 2 - 1);
      b.flash.scale.setScalar(0.4 + (1 - b.life) * 0.8);
    }

    let dirty = false;
    for (let i = 0; i < this.shardState.length; i++) {
      const s = this.shardState[i];
      if (s.life <= 0) continue;
      dirty = true;
      s.life -= dt * 1.6;
      s.vel.y -= 6 * dt;
      s.pos.addScaledVector(s.vel, dt);
      s.rot.x += s.spin.x * dt; s.rot.y += s.spin.y * dt;
      const sc = Math.max(0, s.life);
      this._q.setFromEuler(s.rot);
      this._s.setScalar(sc);
      this._m.compose(s.pos, this._q, this._s);
      this.shards.setMatrixAt(i, this._m);
    }
    if (dirty) this.shards.instanceMatrix.needsUpdate = true;

    for (const p of this.popups) {
      if (p.life <= 0) continue;
      p.life -= dt * 1.4;
      if (p.life <= 0) { p.sprite.visible = false; continue; }
      p.sprite.position.y += dt * 0.25;
      p.sprite.material.opacity = Math.min(1, p.life * 2);
      const pop = 1 + Math.max(0, p.life - 0.8) * 2;
      p.sprite.scale.set(0.32 * pop, 0.1 * pop, 1);
    }
  }
}
