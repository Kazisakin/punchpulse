// Gloves for controllers and tracked hands, plus a mouse glove for desktop testing.
// Tracks position/velocity per frame for punch detection.
import * as THREE from 'three';
import { COLORS } from './config.js';
import { addRimGlow, glowSprite } from './gfx.js';

// Glove space: -Z = knuckles, +Y = back of hand, origin = wrist.
// Thumb is on -X for the right glove, +X for the left.
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// deformed sphere: padded front, flatter back, tapers to the wrist
function gloveShellGeometry() {
  const g = new THREE.SphereGeometry(1, 48, 32);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    let z = v.z < 0 ? v.z * 0.098 : v.z * 0.07;
    const front = smooth(0.3, -0.9, v.z);          // 0 at back, 1 at front
    const taper = 1 - 0.16 * smooth(0.1, 1.0, v.z); // narrows toward the wrist
    let x = v.x * 0.07 * taper * (0.94 + 0.08 * front);
    let y = v.y * (v.y > 0 ? 0.064 : 0.06) * taper;
    // knuckle ridge
    const ridge = Math.exp(-Math.pow((v.z + 0.55) / 0.22, 2)) * smooth(0.2, 0.8, v.y);
    y += ridge * 0.012;
    // flatten the palm side
    if (v.y < 0) y *= 1 - 0.18 * smooth(-0.2, -0.9, v.z) * smooth(0, -0.7, v.y);
    p.setXYZ(i, x, y, z - 0.082);
  }
  g.computeVertexNormals();
  return g;
}
let SHELL = null;

function makeGlove(color, hand = 'right') {
  SHELL = SHELL || gloveShellGeometry();
  const group = new THREE.Group();
  const body = new THREE.Group();          // squashed on impact
  group.add(body);
  const thumbSide = hand === 'left' ? 1 : -1;

  const mat = addRimGlow(
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.06, roughness: 0.38, metalness: 0.0, envMapIntensity: 0.7 }),
    color, 0.45, 3.0
  );
  const white = new THREE.MeshStandardMaterial({ color: 0xf1f3fa, roughness: 0.45, envMapIntensity: 0.5 });
  const black = new THREE.MeshStandardMaterial({ color: 0x15161d, roughness: 0.55, envMapIntensity: 0.4, side: THREE.DoubleSide });

  const shell = new THREE.Mesh(SHELL, mat);
  body.add(shell);

  // thumb
  const thumbCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(thumbSide * 0.05, -0.022, -0.035),
    new THREE.Vector3(thumbSide * 0.068, -0.02, -0.075),
    new THREE.Vector3(thumbSide * 0.062, -0.012, -0.115),
    new THREE.Vector3(thumbSide * 0.045, -0.006, -0.138),
  ]);
  const thumb = new THREE.Mesh(new THREE.TubeGeometry(thumbCurve, 16, 0.019, 12, false), mat);
  body.add(thumb);
  const thumbTip = new THREE.Mesh(new THREE.SphereGeometry(0.019, 14, 10), mat);
  thumbTip.position.copy(thumbCurve.points[3]);
  body.add(thumbTip);
  const thumbBase = new THREE.Mesh(new THREE.SphereGeometry(0.021, 14, 10), mat);
  thumbBase.position.copy(thumbCurve.points[0]);
  body.add(thumbBase);

  // seam
  const seam = new THREE.Mesh(new THREE.TorusGeometry(0.066, 0.0028, 6, 48, Math.PI * 1.15), white);
  seam.position.set(0, 0.002, -0.118);
  seam.rotation.z = Math.PI * -0.075; // centre arc on top
  seam.scale.set(1.0, 0.95, 1);
  body.add(seam);

  // cuff
  const cuffProfile = [
    [0.042, 0.05], [0.048, 0.046], [0.051, 0.03], [0.052, 0.0], [0.054, -0.025], [0.057, -0.045],
  ].map(([r, z]) => new THREE.Vector2(r, z));
  const cuff = new THREE.Mesh(new THREE.LatheGeometry(cuffProfile, 36), mat);
  cuff.rotation.x = Math.PI / 2; // lathe Y -> glove +Z
  body.add(cuff);
  // short wrap sleeve so the cuff isn't an empty hole
  const sleeveGeo = new THREE.CylinderGeometry(0.037, 0.04, 0.085, 24, 1, true);
  sleeveGeo.rotateX(Math.PI / 2);
  sleeveGeo.translate(0, 0, 0.085);
  const sleeve = new THREE.Mesh(sleeveGeo, new THREE.MeshStandardMaterial({ color: 0x23252f, roughness: 0.8, envMapIntensity: 0.3 }));
  body.add(sleeve);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.0045, 8, 36), white);
  rim.position.z = 0.049;
  body.add(rim);

  // strap + velcro tab
  const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.0535, 0.0545, 0.03, 36, 1, true), black);
  strap.rotation.x = Math.PI / 2;
  strap.position.z = 0.008;
  body.add(strap);
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.0548, 0.0548, 0.006, 36, 1, true), white);
  stripe.rotation.x = Math.PI / 2;
  stripe.position.z = 0.008;
  body.add(stripe);
  const tab = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.008, 0.034), black);
  tab.position.set(0, 0.055, 0.004);
  tab.rotation.x = -0.12;
  body.add(tab);

  const mark = new THREE.Mesh(new THREE.CapsuleGeometry(0.005, 0.03, 4, 8), white);
  mark.rotation.z = Math.PI / 2;
  mark.position.set(0, 0.066, -0.062);
  mark.rotation.x = -0.25;
  body.add(mark);

  const halo = glowSprite(color, 0.28, 0.18);
  halo.position.z = -0.09;
  group.add(halo);

  group.userData.mat = mat;
  group.userData.body = body;
  group.userData.halo = halo;
  group.userData.haloBase = 0.28;
  group.userData.haloOpacity = 0.18;
  group.userData.emissiveBase = 0.06;
  return group;
}

function makeRay() {
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: COLORS.accent, transparent: true, opacity: 0.6 }));
  line.scale.z = 3;
  line.visible = false;
  return line;
}

// Joints whose average is the striking surface of a tracked hand (the knuckles)
const KNUCKLE_JOINTS = ['index-finger-phalanx-proximal', 'middle-finger-phalanx-proximal', 'ring-finger-phalanx-proximal'];
const MAX_PLAUSIBLE_SPEED = 14; // m/s, anything faster is a tracking glitch

/**
 * One state object per input slot (0 and 1). Each slot can be a controller or a tracked
 * hand, and can switch between the two at any time (put controllers down -> hands).
 *   kind: 'controller' | 'hand' | null
 *   hand: 'left' | 'right'   pos/velocity/speed: fist centre in world space
 */
export function createGloves(renderer, scene) {
  const hands = {};          // 'left' / 'right' -> the active input state for that side
  const inputs = [];         // both input slots
  const listeners = { select: [] };

  function newState(extra) {
    return Object.assign({
      kind: null, hand: null, glove: null, gamepad: null,
      pos: new THREE.Vector3(), prevPos: new THREE.Vector3(), velocity: new THREE.Vector3(),
      speed: 0, active: false, tracked: false, settle: 0, flash: 0,
    }, extra);
  }

  function connect(state, source) {
    disconnect(state);
    state.kind = source.hand ? 'hand' : 'controller';
    state.hand = source.handedness === 'left' ? 'left' : 'right';
    state.gamepad = state.kind === 'controller' ? source.gamepad || null : null;
    state.glove = makeGlove(COLORS[state.hand], state.hand);
    state.glove.visible = false;
    scene.add(state.glove);
    state.active = true;
    state.settle = 3;
    hands[state.hand] = state;
  }

  function disconnect(state) {
    if (state.glove) state.glove.removeFromParent();
    state.glove = null;
    if (state.hand && hands[state.hand] === state) delete hands[state.hand];
    state.active = false;
    state.tracked = false;
    state.kind = null;
  }

  for (let i = 0; i < 2; i++) {
    const controller = renderer.xr.getController(i);
    const grip = renderer.xr.getControllerGrip(i);
    const handObj = renderer.xr.getHand(i);
    scene.add(controller, grip, handObj);
    const ray = makeRay();
    controller.add(ray);

    const state = newState({ index: i, controller, grip, handObj, ray });
    inputs.push(state);

    controller.addEventListener('connected', (e) => connect(state, e.data));
    controller.addEventListener('disconnected', () => disconnect(state));
    // 'select' = trigger on controllers, pinch on hands
    controller.addEventListener('select', () => listeners.select.forEach((fn) => fn(state)));
  }

  // Desktop glove (mouse)
  const desktop = newState({
    kind: 'mouse', hand: 'any', glove: makeGlove(COLORS.accent), isDesktop: true,
    reach: 0.27,  // mouse aiming is harder
    boost: 0,     // seconds left of a click/space "punch"
  });
  desktop.glove.visible = false;
  desktop.glove.scale.setScalar(0.45);
  scene.add(desktop.glove);

  const tmp = new THREE.Vector3();
  const wristPos = new THREE.Vector3();
  const v = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const gripPos = new THREE.Vector3();
  // Orient controller gloves from the target ray, not the grip: grip -Z runs along the handle
  // (toward the thumb), the ray roughly follows the forearm.
  const ROT_RIGHT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2);
  const ROT_LEFT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);

  function trackController(h) {
    h.tracked = h.grip.visible !== false && h.controller.visible !== false;
    if (!h.tracked) { h.glove.visible = false; return false; }
    h.grip.getWorldPosition(gripPos);
    h.controller.getWorldQuaternion(quat);
    fwd.set(0, 0, -1).applyQuaternion(quat);
    h.glove.position.copy(gripPos).addScaledVector(fwd, -0.05);
    h.glove.quaternion.copy(quat).multiply(h.hand === 'left' ? ROT_LEFT : ROT_RIGHT);
    h.glove.visible = true;
    tmp.copy(gripPos).addScaledVector(fwd, 0.06);
    return true;
  }

  function trackHand(h) {
    const joints = h.handObj.joints || {};
    const wrist = joints.wrist;
    if (!wrist || !wrist.visible) { h.tracked = false; h.glove.visible = false; return false; }
    wrist.getWorldPosition(wristPos);
    let n = 0;
    tmp.set(0, 0, 0);
    for (const name of KNUCKLE_JOINTS) {
      const j = joints[name];
      if (j && j.visible) { j.getWorldPosition(v); tmp.add(v); n++; }
    }
    if (n === 0) { h.tracked = false; h.glove.visible = false; return false; }
    tmp.divideScalar(n);
    // push slightly past the knuckles, onto the glove's striking surface
    tmp.add(v.copy(tmp).sub(wristPos).multiplyScalar(0.15));
    // glove follows the wrist pose (WebXR joints: -Z toward the fingers, +Y back of hand)
    wrist.getWorldQuaternion(quat);
    if (!h.glove.visible) { h.glove.position.copy(wristPos); h.glove.quaternion.copy(quat); }
    else { h.glove.position.lerp(wristPos, 0.7); h.glove.quaternion.slerp(quat, 0.6); }
    h.glove.visible = true;
    h.tracked = true;
    return true;
  }

  function updateMotion(h, dt, smoothing) {
    if (h.settle > 0) {
      // just (re)acquired: don't turn the jump into a fake punch
      h.settle--;
      h.prevPos.copy(tmp);
      h.velocity.set(0, 0, 0);
      h.speed = 0;
    } else {
      v.copy(tmp).sub(h.prevPos).divideScalar(Math.max(dt, 1e-3));
      if (v.length() > MAX_PLAUSIBLE_SPEED) { h.velocity.set(0, 0, 0); h.settle = 2; }
      else h.velocity.lerp(v, smoothing);
      h.speed = h.velocity.length();
      h.prevPos.copy(tmp);
    }
    h.pos.copy(tmp);
  }

  function update(dt, xrActive) {
    for (const h of inputs) {
      if (!h.active) continue;
      const wasTracked = h.tracked;
      const ok = h.kind === 'hand' ? trackHand(h) : trackController(h);
      if (!ok) continue;
      if (!wasTracked) h.settle = 3;
      updateMotion(h, dt, h.kind === 'hand' ? 0.6 : 1.0);
      flashFade(h, dt);
    }
    for (const m of mocks) {
      if (!trackHand(m)) continue;
      updateMotion(m, dt, 0.6);
    }
    desktop.active = !xrActive && desktop.glove.visible;
    if (desktop.active) {
      desktop.velocity.copy(desktop.pos).sub(desktop.prevPos).divideScalar(Math.max(dt, 1e-3));
      desktop.speed = desktop.speed * 0.5 + desktop.velocity.length() * 0.5;
      if (desktop.boost > 0) { desktop.boost -= dt; desktop.speed = Math.max(desktop.speed, 4); }
      desktop.prevPos.copy(desktop.pos);
      desktop.glove.position.copy(desktop.pos);
      flashFade(desktop, dt);
    }
  }

  function flashFade(h, dt) {
    if (!h.glove || h.flash <= 0) return;
    h.flash = Math.max(0, h.flash - dt * 4);
    h.glove.userData.mat.emissiveIntensity = h.glove.userData.emissiveBase + h.flash * 1.2;
    // impact squash: the glove flattens a little on contact and springs back
    const k = Math.sin(h.flash * Math.PI) * 0.5 * h.flash;
    h.glove.userData.body.scale.set(1 + k * 0.18, 1 + k * 0.18, 1 - k * 0.25);
    h.glove.userData.halo.scale.setScalar(h.glove.userData.haloBase * (1 + h.flash * 1.2));
    h.glove.userData.halo.material.opacity = h.glove.userData.haloOpacity + h.flash * 0.5;
  }

  // All gloves that can currently punch (tracked controllers + tracked hands + mouse)
  function active() {
    const list = inputs.filter((h) => h.active && h.tracked);
    for (const m of mocks) if (m.tracked) list.push(m);
    if (desktop.active) list.push(desktop);
    return list;
  }

  const usingHands = () => inputs.some((h) => h.active && h.kind === 'hand') || mocks.length > 0;

  function buzz(h, intensity = 0.6, ms = 60) {
    h.flash = 1;
    const actuator = h?.gamepad?.hapticActuators?.[0];
    if (actuator?.pulse) actuator.pulse(intensity, ms);
  }

  function tick(h) {
    const actuator = h?.gamepad?.hapticActuators?.[0];
    if (actuator?.pulse) actuator.pulse(0.15, 12);
  }

  function showRays(visible) {
    inputs.forEach((c) => (c.ray.visible = visible && c.active));
  }

  function onSelect(fn) { listeners.select.push(fn); }

  // Fake tracked hand for automated tests
  const mocks = [];
  function injectMockHand(handedness) {
    const root = new THREE.Group();
    const joints = {};
    for (const name of ['wrist', ...KNUCKLE_JOINTS]) { joints[name] = new THREE.Object3D(); root.add(joints[name]); }
    scene.add(root);
    const m = newState({ kind: 'hand', hand: handedness, handObj: { joints }, active: true, settle: 3, isMock: true });
    m.glove = makeGlove(COLORS[handedness], handedness);
    scene.add(m.glove);
    mocks.push(m);
    m.setFist = (x, y, z) => {
      joints.wrist.position.set(x, y - 0.01, z + 0.09);
      joints['index-finger-phalanx-proximal'].position.set(x - 0.02, y, z);
      joints['middle-finger-phalanx-proximal'].position.set(x, y, z);
      joints['ring-finger-phalanx-proximal'].position.set(x + 0.02, y, z);
      root.updateMatrixWorld(true);
    };
    m.setTracked = (on) => { for (const j of Object.values(joints)) j.visible = on; };
    return m;
  }

  return { hands, inputs, desktop, update, active, buzz, tick, showRays, onSelect, usingHands, injectMockHand };
}
