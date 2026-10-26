// Neon synthwave arena.
// Sky gradient + stars + striped sun + wireframe mountains + shader floor with a beat wave,
// light beams, music-reactive equalizer bars and floating dust.
// All unlit / cheap shaders so it holds 72+ FPS on Quest 2.
import * as THREE from 'three';
import { COLORS } from './config.js';
import { glowTexture, glowSprite } from './gfx.js';

const EQ_BARS = 14; // per side

export function createArena(scene) {
  scene.background = new THREE.Color(0x05031a);
  scene.fog = new THREE.Fog(0x0b0524, 12, 48);

  scene.add(new THREE.HemisphereLight(0x8fb4ff, 0x1a0a2a, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(1, 4, 3);
  scene.add(key);

  // ---------------------------------------------------------- Sky dome
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(70, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
      uniforms: { uPulse: { value: 0 } },
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform float uPulse; varying vec3 vP;
        void main(){
          float y = vP.y;
          vec3 top = vec3(0.012, 0.008, 0.06);
          vec3 mid = vec3(0.10, 0.02, 0.22);
          vec3 hor = vec3(1.0, 0.17, 0.62);
          vec3 col = mix(mid, top, smoothstep(0.05, 0.6, y));
          float band = exp(-abs(y - 0.02) * 22.0);
          col += hor * band * (0.55 + 0.25 * uPulse);
          col = mix(col, vec3(0.02,0.0,0.05), smoothstep(0.0, -0.15, y));
          gl_FragColor = vec4(col, 1.0);
        }`,
    })
  );
  sky.renderOrder = -10;
  scene.add(sky);

  // ---------------------------------------------------------- Stars
  {
    const n = 700, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const th = Math.random() * Math.PI * 2, y = 0.08 + Math.random() * 0.92;
      const r = Math.sqrt(1 - y * y);
      pos.set([Math.cos(th) * r * 60, y * 60, Math.sin(th) * r * 60], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(g, new THREE.PointsMaterial({
      color: 0xcfd8ff, size: 2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8, depthWrite: false,
    }));
    scene.add(stars);
  }

  // ---------------------------------------------------------- Striped sun
  const sunMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, toneMapped: false,
    uniforms: { uTime: { value: 0 }, uPulse: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform float uTime, uPulse; varying vec2 vUv;
      void main(){
        vec2 p = vUv * 2.0 - 1.0;
        float d = length(p);
        if (d > 1.0) discard;
        vec3 col = mix(vec3(1.0, 0.18, 0.55), vec3(1.0, 0.86, 0.3), smoothstep(-0.6, 0.8, p.y));
        // horizontal cut-out stripes in the lower half, scrolling down
        float yy = p.y + uTime * 0.04;
        float stripeW = smoothstep(0.1, -0.9, p.y) * 0.55;
        float s = fract(yy * 7.0);
        if (p.y < 0.1 && s < stripeW) discard;
        col *= 1.0 + 0.25 * uPulse;
        gl_FragColor = vec4(col, smoothstep(1.0, 0.97, d));
      }`,
  });
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), sunMat);
  sun.position.set(0, 7, -58);
  scene.add(sun);
  const sunGlow = glowSprite(0xff3fa0, 52, 0.55);
  sunGlow.material.fog = false;
  sunGlow.position.set(0, 7, -59);
  scene.add(sunGlow);

  // ---------------------------------------------------------- Wireframe mountains
  function mountains(z, height, color, seed) {
    const geo = new THREE.PlaneGeometry(140, 18, 56, 6);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      const t = (y + 9) / 18; // 0 bottom .. 1 top
      const n = Math.sin(x * 0.11 + seed) * 0.5 + Math.sin(x * 0.23 + seed * 2) * 0.3 + Math.sin(x * 0.47 + seed * 3) * 0.2;
      const centreDip = 1 - Math.exp(-(x * x) / 260); // keep the sun visible
      p.setZ(i, 0);
      p.setY(i, t * height * (0.55 + 0.45 * n) * (0.35 + 0.65 * centreDip));
    }
    geo.computeVertexNormals();
    const fill = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x0a0418, fog: true }));
    const wire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.55, fog: true }));
    const g = new THREE.Group();
    g.add(fill, wire);
    g.position.set(0, -0.05, z);
    scene.add(g);
    return wire;
  }
  const mtnA = mountains(-46, 13, 0xff2bd6, 1.3);
  const mtnB = mountains(-40, 8, 0x00e5ff, 4.1);
  mtnB.parent.position.y = -0.1;

  // ---------------------------------------------------------- Floor with glowing grid + beat wave
  const floorMat = new THREE.ShaderMaterial({
    toneMapped: false,
    uniforms: { uBeat: { value: 0 }, uPulse: { value: 0 }, uTime: { value: 0 } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      uniform float uBeat, uPulse, uTime; varying vec3 vW;
      float gridLine(vec2 p, float w){
        vec2 g = abs(fract(p - 0.5) - 0.5) / fwidth(p);
        return 1.0 - min(min(g.x, g.y) / w, 1.0);
      }
      void main(){
        vec2 p = vW.xz;
        float dist = length(p);
        float fade = exp(-dist * 0.06);
        float line = gridLine(p * 0.8 + vec2(0.0, uTime * 0.6), 1.2);
        vec3 base = vec3(0.02, 0.01, 0.06);
        vec3 lineCol = mix(vec3(0.0, 0.9, 1.0), vec3(1.0, 0.17, 0.84), smoothstep(4.0, 30.0, dist));
        vec3 col = base + lineCol * line * (0.35 + 0.65 * fade) * (0.7 + 0.5 * uPulse);
        // beat shockwave rolling outward from the player
        float r = uBeat * 14.0;
        float wave = exp(-abs(dist - r) * 3.0) * (1.0 - uBeat);
        col += lineCol * wave * 0.8;
        // soft pad glow under the player
        col += vec3(0.0, 0.6, 0.8) * exp(-dist * 2.2) * 0.35;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // Player pad ring
  const pad = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.47, 64),
    new THREE.MeshBasicMaterial({ color: COLORS.accent, side: THREE.DoubleSide, transparent: true, opacity: 0.9, toneMapped: false })
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.006;
  scene.add(pad);

  // ---------------------------------------------------------- Tunnel rings
  const rings = [];
  for (let i = 0; i < 7; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.3, 0.018, 6, 72),
      new THREE.MeshBasicMaterial({ color: i % 2 ? COLORS.accent : COLORS.magenta, transparent: true, opacity: 0.7, toneMapped: false })
    );
    ring.position.set(0, 1.4, -3.5 - i * 3);
    scene.add(ring);
    rings.push(ring);
  }

  // ---------------------------------------------------------- Light beams (vertical gradient columns)
  const beamMat = (color) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
    uniforms: { uColor: { value: new THREE.Color(color) }, uPulse: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uPulse; varying vec2 vUv;
      void main(){ float a = pow(1.0 - vUv.y, 2.0) * (0.35 + 0.4 * uPulse); gl_FragColor = vec4(uColor * a, a); }`,
  });
  const beams = [];
  const beamGeo = new THREE.CylinderGeometry(0.12, 0.35, 12, 12, 1, true);
  beamGeo.translate(0, 6, 0);
  for (let i = 0; i < 4; i++) {
    for (const side of [-1, 1]) {
      const m = new THREE.Mesh(beamGeo, beamMat(side < 0 ? COLORS.right : COLORS.left));
      m.position.set(side * 4.2, 0, -4 - i * 6);
      scene.add(m);
      beams.push(m);
      // glowing base cap
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 0.12, 16),
        new THREE.MeshBasicMaterial({ color: side < 0 ? COLORS.right : COLORS.left, toneMapped: false })
      );
      cap.position.set(side * 4.2, 0.06, -4 - i * 6);
      scene.add(cap);
    }
  }

  // ---------------------------------------------------------- Music-reactive equalizer bars
  const eqGeo = new THREE.BoxGeometry(0.14, 1, 0.14);
  eqGeo.translate(0, 0.5, 0);
  const eq = new THREE.InstancedMesh(eqGeo, new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.85 }), EQ_BARS * 2);
  const eqColor = new THREE.Color();
  const eqM = new THREE.Matrix4();
  for (let i = 0; i < EQ_BARS * 2; i++) {
    const k = i % EQ_BARS;
    eqColor.setHSL(0.83 - (k / EQ_BARS) * 0.33, 1, 0.55); // magenta -> cyan
    eq.setColorAt(i, eqColor);
  }
  scene.add(eq);
  const eqLevels = new Float32Array(EQ_BARS);

  function layoutEq() {
    for (let i = 0; i < EQ_BARS * 2; i++) {
      const side = i < EQ_BARS ? -1 : 1;
      const k = i % EQ_BARS;
      const h = 0.04 + eqLevels[k] * eqLevels[k] * 1.3;
      eqM.makeScale(1, h, 1);
      eqM.setPosition(side * 3.3, 0, -5 - k * 0.9);
      eq.setMatrixAt(i, eqM);
    }
    eq.instanceMatrix.needsUpdate = true;
  }
  layoutEq();

  // ---------------------------------------------------------- Floating dust
  const dustN = 220;
  const dustPos = new Float32Array(dustN * 3);
  const dustSpeed = new Float32Array(dustN);
  for (let i = 0; i < dustN; i++) {
    dustPos.set([(Math.random() - 0.5) * 16, Math.random() * 6, -Math.random() * 30 + 4], i * 3);
    dustSpeed[i] = 0.1 + Math.random() * 0.4;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    map: glowTexture(), color: 0x9fdcff, size: 0.06, transparent: true, opacity: 0.7,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  dust.frustumCulled = false;
  scene.add(dust);

  // ---------------------------------------------------------- Update
  // pulse: 0..1 beat strength, beatPhase: 0..1 since last beat, spectrum: Uint8Array or null
  function update(t, pulse = 0.4, dt = 0.016, beatPhase = 0, spectrum = null) {
    floorMat.uniforms.uTime.value = t;
    floorMat.uniforms.uPulse.value = pulse;
    floorMat.uniforms.uBeat.value = beatPhase;
    sky.material.uniforms.uPulse.value = pulse;
    sunMat.uniforms.uTime.value = t;
    sunMat.uniforms.uPulse.value = pulse;
    sunGlow.material.opacity = 0.4 + 0.25 * pulse;

    rings.forEach((r, i) => {
      const wave = 0.5 + 0.5 * Math.sin(t * 3 - i * 0.7);
      r.material.opacity = 0.25 + 0.3 * wave + 0.45 * pulse;
      r.scale.setScalar(1 + pulse * 0.05);
      r.rotation.z = t * 0.15 * (i % 2 ? 1 : -1);
    });
    beams.forEach((b) => (b.material.uniforms.uPulse.value = pulse));
    pad.material.opacity = 0.6 + 0.4 * pulse;
    mtnA.material.opacity = 0.35 + 0.3 * pulse;
    mtnB.material.opacity = 0.35 + 0.3 * pulse;

    // equalizer: real music spectrum while playing, gentle idle wave otherwise
    for (let k = 0; k < EQ_BARS; k++) {
      let target;
      if (spectrum) {
        const bin = Math.floor(Math.pow(k / EQ_BARS, 1.6) * spectrum.length * 0.7) + 1;
        target = spectrum[bin] / 255;
      } else {
        target = 0.3 + 0.15 * Math.sin(t * 2 + k * 0.6);
      }
      eqLevels[k] += (target - eqLevels[k]) * Math.min(1, dt * 14);
    }
    layoutEq();

    // dust drifts toward the player and loops
    for (let i = 0; i < dustN; i++) {
      dustPos[i * 3 + 2] += dustSpeed[i] * dt * (1 + pulse * 2);
      if (dustPos[i * 3 + 2] > 4) dustPos[i * 3 + 2] -= 34;
    }
    dustGeo.attributes.position.needsUpdate = true;
  }

  return { floor, rings, update };
}
