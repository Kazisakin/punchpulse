// Controllers shown as glowing gloves. Left = red, right = blue.
// Tracks each glove's world position and speed every frame (for punch detection).
// Also provides a mouse-driven "desktop glove" for testing without a headset.
import * as THREE from 'three';
import { COLORS } from './config.js';
import { addRimGlow, glowSprite } from './gfx.js';

// Glossy boxing glove, built in "glove space":
//   -Z = knuckles / striking face, +Y = back of the hand, cuff at the origin (wrist).
// The right glove's thumb is on -X, the left glove's on +X.
function makeGlove(color, hand = 'right') {
  const group = new THREE.Group();
  const body = new THREE.Group();          // everything except the halo (squashed on impact)
  group.add(body);
  const mat = addRimGlow(
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.08, roughness: 0.3, metalness: 0.0, envMapIntensity: 0.6 }),
    color, 0.75, 2.6
  );
  const trim = new THREE.MeshStandardMaterial({ color: 0xf2f4ff, roughness: 0.4, envMapIntensity: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x14182c, roughness: 0.6, side: THREE.DoubleSide });

  // main padded fist: a rounded block, deeper than it is wide, slightly flattened top-to-bottom
  const fist = new THREE.Mesh(new THREE.SphereGeometry(0.07, 32, 22), mat);
  fist.scale.set(1.0, 0.92, 1.22);
  fist.position.set(0, 0.0, -0.085);
  body.add(fist);

  // knuckle pad: fuller striking face
  const pad = new THREE.Mesh(new THREE.SphereGeometry(0.058, 28, 18), mat);
  pad.scale.set(1.08, 0.9, 0.7);
  pad.position.set(0, 0.012, -0.135);
  body.add(pad);

  // white stripe across the back of the hand
  const stripe = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.07, 4, 10), trim);
  stripe.rotation.z = Math.PI / 2;
  stripe.position.set(0, 0.062, -0.09);
  body.add(stripe);

  // thumb tucked along the inner side, pointing forward
  const thumbSide = hand === 'left' ? 1 : -1;
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.021, 0.05, 6, 12), mat);
  thumb.rotation.set(Math.PI / 2, 0, 0);
  thumb.rotation.y = thumbSide * 0.25;
  thumb.position.set(thumbSide * 0.062, -0.018, -0.088);
  body.add(thumb);

  // cuff: open tube that narrows toward the wrist, white band, dark padded opening + lace strip
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.056, 0.08, 28, 1, true), mat);
  cuff.rotation.x = Math.PI / 2;            // cylinder +Y -> glove +Z (toward the elbow)
  cuff.position.z = -0.005;
  body.add(cuff);
  const lining = new THREE.Mesh(new THREE.CircleGeometry(0.044, 28), dark);
  lining.position.z = 0.034;                 // the opening you see when you look down your arm
  body.add(lining);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.006, 8, 28), trim);
  rim.position.z = 0.035;
  body.add(rim);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0545, 0.0565, 0.016, 28, 1, true), trim);
  band.rotation.x = Math.PI / 2;
  band.position.z = -0.036;
  body.add(band);
  const lace = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.006, 0.06), dark);
  lace.position.set(0, -0.049, 0.0);
  body.add(lace);

  const halo = glowSprite(color, 0.32, 0.3);
  halo.position.z = -0.09;
  group.add(halo);

  group.userData.mat = mat;
  group.userData.body = body;
  group.userData.halo = halo;
  group.userData.haloBase = 0.32;
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
const MAX_PLAUSIBLE_SPEED = 14; // m/s — faster than this is a tracking glitch, not a punch

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

  // ---------- Desktop glove (mouse) ----------
  const desktop = newState({
    kind: 'mouse', hand: 'any', glove: makeGlove(COLORS.accent), isDesktop: true,
    reach: 0.27,  // bigger hit area: aiming with a mouse is harder than with your fist
    boost: 0,     // seconds left of a click/space "punch"
  });
  desktop.glove.visible = false;
  desktop.glove.scale.setScalar(0.45); // it's close to the camera, keep it small
  scene.add(desktop.glove);

  const tmp = new THREE.Vector3();
  const wristPos = new THREE.Vector3();
  const v = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const gripPos = new THREE.Vector3();
  // Controller gloves are oriented from the pointing ray (its -Z runs along the forearm when you
  // punch). The grip space's -Z runs along the handle towards the thumb, which made the old glove
  // point up/sideways. Glove +Y (back of hand) -> ray +X on the right hand / -X on the left.
  const ROT_RIGHT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2);
  const ROT_LEFT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);

  function trackController(h) {
    h.tracked = h.grip.visible !== false && h.controller.visible !== false;
    if (!h.tracked) { h.glove.visible = false; return false; }
    h.grip.getWorldPosition(gripPos);
    h.controller.getWorldQuaternion(quat);
    fwd.set(0, 0, -1).applyQuaternion(quat);
    // glove: wrist sits a little behind the grip so the fist covers the hand holding the controller
    h.glove.position.copy(gripPos).addScaledVector(fwd, -0.05);
    h.glove.quaternion.copy(quat).multiply(h.hand === 'left' ? ROT_LEFT : ROT_RIGHT);
    h.glove.visible = true;
    // striking point: just in front of the knuckles
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
    h.glove.userData.mat.emissiveIntensity = 0.08 + h.flash * 1.4;
    // impact squash: the glove flattens a little on contact and springs back
    const k = Math.sin(h.flash * Math.PI) * 0.5 * h.flash;
    h.glove.userData.body.scale.set(1 + k * 0.18, 1 + k * 0.18, 1 - k * 0.25);
    h.glove.userData.halo.scale.setScalar(h.glove.userData.haloBase * (1 + h.flash * 1.2));
    h.glove.userData.halo.material.opacity = 0.3 + h.flash * 0.5;
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

  // ---------- Test hook: a fake tracked hand driven by code (used by automated tests) ----------
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
