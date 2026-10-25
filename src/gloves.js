// Controllers shown as glowing gloves. Left = red, right = blue.
// Tracks each glove's world position and speed every frame (for punch detection).
// Also provides a mouse-driven "desktop glove" for testing without a headset.
import * as THREE from 'three';
import { COLORS } from './config.js';

function makeGlove(color) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.7, roughness: 0.4 });

  const fist = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), mat);
  fist.scale.set(1, 0.85, 1.25);
  fist.position.z = -0.05;
  group.add(fist);

  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.07, 16), mat);
  cuff.rotation.x = Math.PI / 2;
  cuff.position.z = 0.04;
  group.add(cuff);

  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 12, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, depthWrite: false })
  );
  halo.position.z = -0.05;
  group.add(halo);

  group.userData.mat = mat;
  group.userData.halo = halo;
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
        state.glove = makeGlove(COLORS[state.hand]);
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
    hand: 'any', glove: makeGlove(0xffffff), active: false,
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
    h.glove.userData.mat.emissiveIntensity = 0.7 + h.flash * 2.5;
    h.glove.userData.halo.scale.setScalar(1 + h.flash * 0.8);
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
