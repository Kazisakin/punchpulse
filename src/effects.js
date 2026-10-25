// Hit effects: particle burst + shockwave ring. Pooled for performance.
import * as THREE from 'three';

const BURSTS = 10;
const PARTICLES = 28;

export class Effects {
  constructor(scene) {
    this.bursts = [];
    const ringGeo = new THREE.RingGeometry(0.1, 0.13, 32);
    for (let i = 0; i < BURSTS; i++) {
      const positions = new Float32Array(PARTICLES * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({
        size: 0.035, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      const points = new THREE.Points(geo, mat);
      points.frustumCulled = false;
      points.visible = false;

      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
        transparent: true, opacity: 1, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      ring.visible = false;

      scene.add(points, ring);
      this.bursts.push({ points, ring, vel: new Float32Array(PARTICLES * 3), life: 0 });
    }
    this.i = 0;
  }

  burst(pos, color, strength = 1) {
    const b = this.bursts[this.i++ % BURSTS];
    const p = b.points.geometry.attributes.position.array;
    for (let k = 0; k < PARTICLES; k++) {
      p[k * 3] = pos.x; p[k * 3 + 1] = pos.y; p[k * 3 + 2] = pos.z;
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.8)
        .normalize().multiplyScalar((1.5 + Math.random() * 2.5) * strength);
      b.vel[k * 3] = v.x; b.vel[k * 3 + 1] = v.y; b.vel[k * 3 + 2] = v.z;
    }
    b.points.geometry.attributes.position.needsUpdate = true;
    b.points.material.color.set(color);
    b.ring.material.color.set(color);
    b.ring.position.copy(pos);
    b.ring.scale.setScalar(1);
    b.points.visible = b.ring.visible = true;
    b.life = 1;
  }

  update(dt) {
    for (const b of this.bursts) {
      if (b.life <= 0) continue;
      b.life -= dt * 2.2;
      if (b.life <= 0) { b.points.visible = b.ring.visible = false; continue; }
      const p = b.points.geometry.attributes.position.array;
      for (let k = 0; k < PARTICLES * 3; k++) {
        p[k] += b.vel[k] * dt;
        if (k % 3 === 1) b.vel[k] -= 4 * dt; // gravity
      }
      b.points.geometry.attributes.position.needsUpdate = true;
      b.points.material.opacity = b.life;
      b.ring.scale.setScalar(1 + (1 - b.life) * 4);
      b.ring.material.opacity = b.life * 0.8;
    }
  }
}
