// Controllers shown as glowing gloves. Left = red, right = blue.
// Tracks each glove's world position and speed every frame (for punch detection).
// Also provides a mouse-driven "desktop glove" for testing without a headset.
import * as THREE from 'three';
import { COLORS } from './config.js';
import { addRimGlow, glowSprite } from './gfx.js';

// Glossy boxing glove: padded fist, knuckle bulge, thumb, cuff with a white band,
// lit leather look + neon rim glow + soft halo.
function makeGlove(color, hand = 'right') {
  const group = new THREE.Group();
  const mat = addRimGlow(
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.08, roughness: 0.32, metalness: 0.0, envMapIntensity: 0.55 }),
    color, 0.75, 2.6
  );
  const trim = new THREE.MeshStandardMaterial({ color: 0xe8ecff, roughness: 0.45, envMapIntensity: 0.4 });

  // big rounded padded fist (the striking surface faces -z)
  const fist = new THREE.Mesh(new THREE.SphereGeometry(0.068, 28, 20), mat);
  fist.scale.set(1.0, 1.08, 1.12);
  fist.position.set(0, 0.008, -0.075);
  group.add(fist);

  // finger roll: a padded bulge over the knuckles
  const roll = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.06, 8, 16), mat);
  roll.rotation.z = Math.PI / 2;
  roll.position.set(0, 0.03, -0.112);
  group.add(roll);

  // thumb tucked along the side
  const thumbSide = hand === 'left' ? 1 : -1;
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.019, 0.045, 6, 12), mat);
  thumb.rotation.set(Math.PI / 2.3, 0, thumbSide * 0.35);
  thumb.position.set(thumbSide * 0.058, -0.008, -0.08);
  group.add(thumb);

  // short tapered wrist cuff + white band
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.058, 0.06, 28), mat);
  cuff.rotation.x = Math.PI / 2;
  cuff.position.z = 0.0;
  group.add(cuff);

  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0565, 0.0585, 0.014, 28, 1, true), trim);
  band.rotation.x = Math.PI / 2;
  band.position.z = 0.012;
  group.add(band);

  const halo = glowSprite(color, 0.3, 0.3);
  halo.position.z = -0.07;
  group.add(halo);

  group.userData.mat = mat;
  group.userData.halo = halo;
  group.userData.haloBase = 0.3;
  return group;
}

function makeRay() {
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: COLORS.accent, transparent: true, opacity: 0.6 }));
  line.scale.z = 3;
  line.visible = false;
  return line;
}

export function createGloves(renderer, scene) {
  const hands = {};        // 'left' / 'right' -> state
  const controllers = [];  // for pointer rays
  const listeners = { select: [] };

  for (let i = 0; i < 2; i++) {
    const controller = renderer.xr.getController(i);
    const grip = renderer.xr.getControllerGrip(i);
    scene.add(controller, grip);
    const ray = makeRay();
    controller.add(ray);

    const state = {
      controller, grip, ray, glove: null, hand: null, gamepad: null,
      pos: new THREE.Vector3(), prevPos: new THREE.Vector3(), velocity: new THREE.Vector3(),
      speed: 0, active: false, flash: 0,
    };
    controllers.push(state);

    controller.addEventListener('connected', (e) => {
      // Controllers only: ignore tracked hands (we don't support hand tracking)
      if (e.data.hand) return;
      state.hand = e.data.handedness === 'left' ? 'left' : 'right';
      state.gamepad = e.data.gamepad || null;
      if (!state.glove) {
        state.glove = makeGlove(COLORS[state.hand], state.hand);
        grip.add(state.glove);
      }
      state.active = true;
      hands[state.hand] = state;
    });

    controller.addEventListener('disconnected', () => {
      if (state.glove) grip.remove(state.glove);
      if (state.hand && hands[state.hand] === state) delete hands[state.hand];
      state.glove = null;
      state.active = false;
    });

    controller.addEventListener('select', () => listeners.select.forEach((fn) => fn(state)));
  }

  // ---------- Desktop glove (mouse) ----------
  const desktop = {
    hand: 'any', glove: makeGlove(COLORS.accent), active: false,
    pos: new THREE.Vector3(), prevPos: new THREE.Vector3(), velocity: new THREE.Vector3(),
    speed: 0, flash: 0, isDesktop: true,
    reach: 0.27,  // bigger hit area: aiming with a mouse is harder than with your fist
    boost: 0,     // seconds left of a click/space "punch"
  };
  desktop.glove.visible = false;
  desktop.glove.scale.setScalar(0.45); // it's close to the camera, keep it small
  scene.add(desktop.glove);

  const tmp = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const quat = new THREE.Quaternion();

  function update(dt, xrActive) {
    for (const h of Object.values(hands)) {
      // fist centre sits a little in front of the grip
      h.grip.getWorldPosition(tmp);
      tmp.add(fwd.set(0, 0, -0.05).applyQuaternion(h.grip.getWorldQuaternion(quat)));
      h.velocity.copy(tmp).sub(h.prevPos).divideScalar(Math.max(dt, 1e-3));
      h.speed = h.velocity.length();
      h.prevPos.copy(tmp);
      h.pos.copy(tmp);
      flashFade(h, dt);
    }
    desktop.active = !xrActive && desktop.glove.visible;
    if (desktop.active) {
      desktop.velocity.copy(desktop.pos).sub(desktop.prevPos).divideScalar(Math.max(dt, 1e-3));
      // smooth mouse speed a bit
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
    h.glove.userData.halo.scale.setScalar(h.glove.userData.haloBase * (1 + h.flash * 1.2));
    h.glove.userData.halo.material.opacity = 0.3 + h.flash * 0.5;
  }

  // All gloves that can currently punch
  function active() {
    const list = Object.values(hands).filter((h) => h.active);
    if (desktop.active) list.push(desktop);
    return list;
  }

  function buzz(h, intensity = 0.6, ms = 60) {
    h.flash = 1;
    const actuator = h?.gamepad?.hapticActuators?.[0];
    if (actuator?.pulse) actuator.pulse(intensity, ms);
  }

  function showRays(visible) {
    controllers.forEach((c) => (c.ray.visible = visible && c.active));
  }

  function onSelect(fn) { listeners.select.push(fn); }

  return { hands, desktop, controllers, update, active, buzz, showRays, onSelect };
}
