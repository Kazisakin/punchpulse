// Arena: sky, sun, mountains, grid floor, beams and EQ bars.
// MR mode hides the world so passthrough shows. Unlit shaders only (Quest 2 budget).
import * as THREE from 'three';
import { COLORS } from './config.js';
import { glowTexture, glowSprite } from './gfx.js';

const EQ_BARS = 14; // per side
const C = (hex) => new THREE.Color(hex);
// desaturate + dim theme colours a bit
const SAT = 0.7, BRIGHT = 0.85;
function tone(hex) {
  const c = new THREE.Color(hex);
  const l = c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
  return c.setRGB((l + (c.r - l) * SAT) * BRIGHT, (l + (c.g - l) * SAT) * BRIGHT, (l + (c.b - l) * SAT) * BRIGHT);
}

const THEME_PARAMS = {
  synthwave: {
    bg: 0x05031a, fog: 0x0b0524,
    skyTop: 0x030214, skyMid: 0x1a0538, skyHor: 0xff2b9e,
    sunA: 0xff2e8c, sunB: 0xffdc4d, sunGlow: 0xff3fa0, sunStripes: 1,
    mtnA: 0xff2bd6, mtnB: 0x00e5ff, mountains: true,
    lineNear: 0x00e5ff, lineFar: 0xff2bd6,
    beamL: COLORS.right, beamR: COLORS.left, ringA: COLORS.accent, ringB: COLORS.magenta,
    eqFrom: 0.83, eqTo: 0.5, dust: 0x9fdcff, stars: 0.8,
  },
  ocean: {
    bg: 0x011522, fog: 0x022a3a,
    skyTop: 0x00101c, skyMid: 0x013247, skyHor: 0x2bf0ff,
    sunA: 0x9ff7ff, sunB: 0xffffff, sunGlow: 0x37d6ff, sunStripes: 0,
    mtnA: 0x1fd2c8, mtnB: 0x5ab8ff, mountains: true,
    lineNear: 0x45fff0, lineFar: 0x2b7bff,
    beamL: 0x2bd9ff, beamR: 0x3dff9a, ringA: 0x45fff0, ringB: 0x2b7bff,
    eqFrom: 0.55, eqTo: 0.42, dust: 0xbffcff, stars: 0.45,
  },
  space: {
    bg: 0x02010a, fog: 0x07041a,
    skyTop: 0x000000, skyMid: 0x0b0626, skyHor: 0x8c4dff,
    sunA: 0xff8a3d, sunB: 0xb04dff, sunGlow: 0x8c4dff, sunStripes: 0,
    mtnA: 0x8c4dff, mtnB: 0x4dd2ff, mountains: false,
    lineNear: 0xb98cff, lineFar: 0x4dd2ff,
    beamL: 0x8c4dff, beamR: 0xff8a3d, ringA: 0xb98cff, ringB: 0xff8a3d,
    eqFrom: 0.75, eqTo: 0.08, dust: 0xffffff, stars: 1.0,
  },
};

export function createArena(scene) {
  scene.background = new THREE.Color(0x05031a);
  scene.fog = new THREE.Fog(0x0b0524, 12, 48);
  const world = new THREE.Group(); // everything hidden in Mixed Reality
  scene.add(world);

  scene.add(new THREE.HemisphereLight(0x8fb4ff, 0x1a0a2a, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(1, 4, 3);
  scene.add(key);

  // Sky dome
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
    uniforms: { uPulse: { value: 0 }, uTop: { value: C(0) }, uMid: { value: C(0) }, uHor: { value: C(0) } },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform float uPulse; uniform vec3 uTop, uMid, uHor; varying vec3 vP;
      void main(){
        float y = vP.y;
        vec3 col = mix(uMid, uTop, smoothstep(0.05, 0.6, y));
        float band = exp(-abs(y - 0.02) * 22.0);
        col += uHor * band * (0.38 + 0.12 * uPulse);
        col = mix(col, uTop * 0.6, smoothstep(0.0, -0.15, y));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(70, 32, 16), skyMat);
  sky.renderOrder = -10;
  world.add(sky);

  // Stars
  const starMat = new THREE.PointsMaterial({ color: 0xcfd8ff, size: 2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8, depthWrite: false });
  {
    const n = 900, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const th = Math.random() * Math.PI * 2, y = 0.04 + Math.random() * 0.96;
      const r = Math.sqrt(1 - y * y);
      pos.set([Math.cos(th) * r * 60, y * 60, Math.sin(th) * r * 60], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    world.add(new THREE.Points(g, starMat));
  }

  // Sun / planet
  const sunMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, toneMapped: false,
    uniforms: { uTime: { value: 0 }, uPulse: { value: 0 }, uA: { value: C(0) }, uB: { value: C(0) }, uStripes: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform float uTime, uPulse, uStripes; uniform vec3 uA, uB; varying vec2 vUv;
      void main(){
        vec2 p = vUv * 2.0 - 1.0;
        float d = length(p);
        if (d > 1.0) discard;
        vec3 col = mix(uA, uB, smoothstep(-0.6, 0.8, p.y));
        if (uStripes > 0.5) {
          float yy = p.y + uTime * 0.04;
          float stripeW = smoothstep(0.1, -0.9, p.y) * 0.55;
          if (p.y < 0.1 && fract(yy * 7.0) < stripeW) discard;
        } else {
          // planet shading + soft bands
          col *= 0.55 + 0.45 * smoothstep(1.0, -0.4, p.x + p.y * 0.3);
          col *= 0.9 + 0.1 * sin(p.y * 18.0 + uTime * 0.2);
        }
        col *= 0.85 + 0.12 * uPulse;
        gl_FragColor = vec4(col, smoothstep(1.0, 0.97, d));
      }`,
  });
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), sunMat);
  sun.position.set(0, 7, -58);
  world.add(sun);
  const sunGlow = glowSprite(0xff3fa0, 46, 0.35);
  sunGlow.material.fog = false;
  sunGlow.position.set(0, 7, -59);
  world.add(sunGlow);

  // Wireframe mountains
  function mountains(z, height, seed) {
    const geo = new THREE.PlaneGeometry(140, 18, 56, 6);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      const t = (y + 9) / 18;
      const n = Math.sin(x * 0.11 + seed) * 0.5 + Math.sin(x * 0.23 + seed * 2) * 0.3 + Math.sin(x * 0.47 + seed * 3) * 0.2;
      const centreDip = 1 - Math.exp(-(x * x) / 260);
      p.setZ(i, 0);
      p.setY(i, t * height * (0.55 + 0.45 * n) * (0.35 + 0.65 * centreDip));
    }
    geo.computeVertexNormals();
    const fill = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x0a0418 }));
    const wire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, opacity: 0.55 }));
    const g = new THREE.Group();
    g.add(fill, wire);
    g.position.set(0, -0.05, z);
    world.add(g);
    return { group: g, wire, fill };
  }
  const mtnA = mountains(-46, 13, 1.3);
  const mtnB = mountains(-40, 8, 4.1);
  mtnB.group.position.y = -0.1;

  // Floor with glowing grid + beat wave
  const floorMat = new THREE.ShaderMaterial({
    toneMapped: false,
    uniforms: { uBeat: { value: 0 }, uPulse: { value: 0 }, uTime: { value: 0 }, uNear: { value: C(0) }, uFar: { value: C(0) }, uBase: { value: C(0x05020f) } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      uniform float uBeat, uPulse, uTime; uniform vec3 uNear, uFar, uBase; varying vec3 vW;
      float gridLine(vec2 p, float w){
        vec2 g = abs(fract(p - 0.5) - 0.5) / fwidth(p);
        return 1.0 - min(min(g.x, g.y) / w, 1.0);
      }
      void main(){
        vec2 p = vW.xz;
        float dist = length(p);
        float fade = exp(-dist * 0.06);
        float line = gridLine(p * 0.8 + vec2(0.0, uTime * 0.6), 1.2);
        vec3 lineCol = mix(uNear, uFar, smoothstep(4.0, 30.0, dist));
        vec3 col = uBase + lineCol * line * (0.3 + 0.5 * fade) * (0.55 + 0.25 * uPulse);
        float r = uBeat * 14.0;
        col += lineCol * exp(-abs(dist - r) * 3.0) * (1.0 - uBeat) * 0.4;
        col += uNear * exp(-dist * 2.2) * 0.3;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), floorMat);
  floor.rotation.x = -Math.PI / 2;
  world.add(floor);

  // Player pad ring (kept in MR too, so you can see where to stand)
  const pad = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.47, 64),
    new THREE.MeshBasicMaterial({ color: COLORS.accent, side: THREE.DoubleSide, transparent: true, opacity: 0.9, toneMapped: false })
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.006;
  scene.add(pad);

  // Tunnel rings (kept in MR: they frame the lane)
  const rings = [];
  for (let i = 0; i < 7; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.3, 0.018, 6, 72),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.7, toneMapped: false })
    );
    ring.position.set(0, 1.4, -3.5 - i * 3);
    scene.add(ring);
    rings.push(ring);
  }

  // Light beams
  const beamMats = [];
  const beamMat = () => {
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
      uniforms: { uColor: { value: C(0) }, uPulse: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 uColor; uniform float uPulse; varying vec2 vUv;
        void main(){ float a = pow(1.0 - vUv.y, 2.0) * (0.16 + 0.16 * uPulse); gl_FragColor = vec4(uColor * a, a); }`,
    });
    beamMats.push(m);
    return m;
  };
  const beamGeo = new THREE.CylinderGeometry(0.12, 0.35, 12, 12, 1, true);
  beamGeo.translate(0, 6, 0);
  const capGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.12, 16);
  const beams = [];
  const caps = [];
  for (let i = 0; i < 4; i++) {
    for (const side of [-1, 1]) {
      const m = new THREE.Mesh(beamGeo, beamMat());
      m.position.set(side * 4.2, 0, -4 - i * 6);
      m.userData.side = side;
      world.add(m);
      beams.push(m);
      const cap = new THREE.Mesh(capGeo, new THREE.MeshBasicMaterial({ toneMapped: false }));
      cap.position.set(side * 4.2, 0.06, -4 - i * 6);
      cap.userData.side = side;
      world.add(cap);
      caps.push(cap);
    }
  }

  // Music-reactive equalizer bars
  const eqGeo = new THREE.BoxGeometry(0.14, 1, 0.14);
  eqGeo.translate(0, 0.5, 0);
  const eq = new THREE.InstancedMesh(eqGeo, new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.6 }), EQ_BARS * 2);
  const eqM = new THREE.Matrix4();
  scene.add(eq);
  const eqLevels = new Float32Array(EQ_BARS);
  function layoutEq() {
    for (let i = 0; i < EQ_BARS * 2; i++) {
      const side = i < EQ_BARS ? -1 : 1;
      const k = i % EQ_BARS;
      eqM.makeScale(1, 0.04 + eqLevels[k] * eqLevels[k] * 1.3, 1);
      eqM.setPosition(side * 3.3, 0, -5 - k * 0.9);
      eq.setMatrixAt(i, eqM);
    }
    eq.instanceMatrix.needsUpdate = true;
  }

  // Floating dust
  const dustN = 220;
  const dustPos = new Float32Array(dustN * 3);
  const dustSpeed = new Float32Array(dustN);
  for (let i = 0; i < dustN; i++) {
    dustPos.set([(Math.random() - 0.5) * 16, Math.random() * 6, -Math.random() * 30 + 4], i * 3);
    dustSpeed[i] = 0.1 + Math.random() * 0.4;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({ map: glowTexture(), size: 0.05, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  scene.add(dust);

  // Themes & MR
  let theme = THEME_PARAMS.synthwave;
  let mr = false;
  function setTheme(id) {
    theme = THEME_PARAMS[id] || THEME_PARAMS.synthwave;
    const t = theme;
    skyMat.uniforms.uTop.value.copy(tone(t.skyTop));
    skyMat.uniforms.uMid.value.copy(tone(t.skyMid));
    skyMat.uniforms.uHor.value.copy(tone(t.skyHor));
    sunMat.uniforms.uA.value.copy(tone(t.sunA));
    sunMat.uniforms.uB.value.copy(tone(t.sunB));
    sunMat.uniforms.uStripes.value = t.sunStripes;
    sunGlow.material.color.copy(tone(t.sunGlow));
    mtnA.wire.material.color.copy(tone(t.mtnA));
    mtnB.wire.material.color.copy(tone(t.mtnB));
    mtnA.group.visible = mtnB.group.visible = t.mountains;
    floorMat.uniforms.uNear.value.copy(tone(t.lineNear));
    floorMat.uniforms.uFar.value.copy(tone(t.lineFar));
    beams.forEach((b) => b.material.uniforms.uColor.value.copy(tone(b.userData.side < 0 ? t.beamL : t.beamR)));
    caps.forEach((c) => c.material.color.copy(tone(c.userData.side < 0 ? t.beamL : t.beamR)));
    rings.forEach((r, i) => r.material.color.copy(tone(i % 2 ? t.ringA : t.ringB)));
    pad.material.color.copy(tone(t.lineNear));
    const col = new THREE.Color();
    for (let i = 0; i < EQ_BARS * 2; i++) {
      const k = i % EQ_BARS;
      col.setHSL(t.eqFrom + (t.eqTo - t.eqFrom) * (k / EQ_BARS), 0.6, 0.5);
      eq.setColorAt(i, col);
    }
    eq.instanceColor.needsUpdate = true;
    dustMat.color.copy(tone(t.dust));
    starMat.opacity = t.stars;
    applyBackground();
  }
  function applyBackground() {
    scene.background = mr ? null : tone(theme.bg);
    scene.fog = mr ? null : new THREE.Fog(tone(theme.fog), 12, 48);
  }
  // Mixed Reality: hide sky, floor, mountains and beams; keep lane rings, EQ bars and dust
  function setMixedReality(on) {
    mr = on;
    world.visible = !on;
    applyBackground();
  }
  setTheme('synthwave');
  layoutEq();

  // Update
  function update(t, pulse = 0.4, dt = 0.016, beatPhase = 0, spectrum = null) {
    floorMat.uniforms.uTime.value = t;
    floorMat.uniforms.uPulse.value = pulse;
    floorMat.uniforms.uBeat.value = beatPhase;
    skyMat.uniforms.uPulse.value = pulse;
    sunMat.uniforms.uTime.value = t;
    sunMat.uniforms.uPulse.value = pulse;
    sunGlow.material.opacity = 0.25 + 0.12 * pulse;

    rings.forEach((r, i) => {
      const wave = 0.5 + 0.5 * Math.sin(t * 3 - i * 0.7);
      r.material.opacity = (0.15 + 0.15 * wave + 0.25 * pulse) * (mr ? 0.6 : 1);
      r.scale.setScalar(1 + pulse * 0.05);
      r.rotation.z = t * 0.15 * (i % 2 ? 1 : -1);
    });
    beamMats.forEach((m) => (m.uniforms.uPulse.value = pulse));
    pad.material.opacity = 0.5 + 0.25 * pulse;
    mtnA.wire.material.opacity = 0.25 + 0.15 * pulse;
    mtnB.wire.material.opacity = 0.25 + 0.15 * pulse;

    for (let k = 0; k < EQ_BARS; k++) {
      let target;
      if (spectrum) {
        const bin = Math.floor(Math.pow(k / EQ_BARS, 1.6) * spectrum.length * 0.7) + 1;
        target = spectrum[bin] / 255;
      } else target = 0.3 + 0.15 * Math.sin(t * 2 + k * 0.6);
      eqLevels[k] += (target - eqLevels[k]) * Math.min(1, dt * 14);
    }
    layoutEq();

    for (let i = 0; i < dustN; i++) {
      dustPos[i * 3 + 2] += dustSpeed[i] * dt * (1 + pulse * 2);
      if (dustPos[i * 3 + 2] > 4) dustPos[i * 3 + 2] -= 34;
    }
    dustGeo.attributes.position.needsUpdate = true;
  }

  return { floor, rings, update, setTheme, setMixedReality, get isMR() { return mr; } };
}
