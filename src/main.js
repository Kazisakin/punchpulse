// PunchPulse — main game: scene setup, screens, game loop, pause handling.
import * as THREE from 'three';
import { CONFIG, COLORS, CSS } from './config.js';
import { createArena } from './arena.js';
import { createGloves } from './gloves.js';
import { TargetManager } from './targets.js';
import { Effects } from './effects.js';
import { AudioEngine, TRACKS } from './audio.js';
import { generateChart } from './chart.js';
import { Storage } from './storage.js';
import { IAP } from './iap.js';
import { Panel, Button, gloveTouchesButton, roundRect, text } from './ui.js';

// =====================================================================
// Scene, camera, renderer
// =====================================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.bg);

const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 100);
camera.position.set(0, 1.6, 0);
camera.lookAt(0, 1.35, -1.2);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFoveation(1);
document.body.appendChild(renderer.domElement);

const arena = createArena(scene);
const gloves = createGloves(renderer, scene);
const targets = new TargetManager(scene);
const fx = new Effects(scene);
const audio = new AudioEngine();

// =====================================================================
// UI (follows the player's head height)
// =====================================================================
const ui = new THREE.Group();
ui.position.y = 1.6;
scene.add(ui);
let headY = 1.6;

const buttons = [];
function addButton(parent, w, h, label, x, y, z, onPress, opts) {
  const b = new Button(w, h, label, onPress, opts);
  b.mesh.position.set(x, y, z);
  parent.add(b.mesh);
  buttons.push(b);
  return b;
}
function addPanel(parent, w, h, x, y, z) {
  const p = new Panel(w, h);
  p.mesh.position.set(x, y, z);
  parent.add(p.mesh);
  return p;
}
const NEAR = CONFIG.HIT_PLANE_Z; // buttons sit at punch distance

// ---------- Menu ----------
const menu = new THREE.Group();
ui.add(menu);
const titlePanel = addPanel(menu, 1.3, 0.42, 0, 0.42, -1.5);
const msgPanel = addPanel(menu, 0.8, 0.06, 0, -0.54, NEAR);

const sel = { minutes: 3, track: TRACKS[0] };

const durationButtons = CONFIG.DURATIONS.map((d, i) =>
  addButton(menu, 0.24, 0.12, `${d.minutes} MIN`, (i - 1) * 0.27, 0.0, NEAR, () => {
    if (d.pro && !IAP.pro) return askPro();
    sel.minutes = d.minutes; audio.sfxClick(); refreshMenu();
  })
);
const trackButtons = TRACKS.map((t, i) =>
  addButton(menu, 0.24, 0.12, t.name.toUpperCase(), (i - 1) * 0.27, -0.15, NEAR, () => {
    if (t.pro && !IAP.pro) return askPro();
    sel.track = t; audio.sfxClick(); refreshMenu();
  }, { color: CSS.magenta })
);
const startButton = addButton(menu, 0.42, 0.13, 'START', 0, -0.31, NEAR, () => startCountdown(), { color: '#3dff9a' });
const proButton = addButton(menu, 0.42, 0.08, 'UNLOCK PRO', 0, -0.44, NEAR, () => askPro(true), { color: '#ffd23d' });

function setMessage(str, color = CSS.dim) {
  msgPanel.draw((c, W, H) => text(c, str, W / 2, H / 2, 34, color, 600));
}

async function askPro(fromButton) {
  if (IAP.pro) return;
  if (!IAP.available) {
    setMessage('PRO unlock is available in the Meta Horizon Store version', '#ffd23d');
    audio.sfxMiss();
    return;
  }
  if (!fromButton) setMessage('That is a PRO feature — unlock it below', '#ffd23d');
  else {
    const ok = await IAP.buyPro();
    setMessage(ok ? 'PRO unlocked — thank you!' : 'Purchase cancelled', ok ? '#3dff9a' : CSS.dim);
    refreshMenu();
  }
}

function refreshMenu() {
  durationButtons.forEach((b, i) => {
    const d = CONFIG.DURATIONS[i];
    const locked = d.pro && !IAP.pro;
    b.set({ selected: d.minutes === sel.minutes, locked, sub: locked ? 'PRO' : '' });
  });
  trackButtons.forEach((b, i) => {
    const t = TRACKS[i];
    const locked = t.pro && !IAP.pro;
    b.set({ selected: t === sel.track, locked, sub: locked ? 'PRO' : `${t.bpm} BPM` });
  });
  proButton.mesh.visible = !IAP.pro && IAP.available;
  proButton.set({ label: IAP.price ? `UNLOCK PRO  ${IAP.price}` : 'UNLOCK PRO' });

  const best = Storage.bestFor(sel.minutes, sel.track.id);
  const life = Storage.lifetime;
  titlePanel.draw((c, W, H) => {
    c.shadowColor = CSS.accent; c.shadowBlur = 40;
    text(c, 'PUNCHPULSE', W / 2, H * 0.3, 150, '#ffffff', 900);
    c.shadowBlur = 0;
    text(c, 'Punch RED with your LEFT  •  BLUE with your RIGHT', W / 2, H * 0.62, 44, CSS.text, 600);
    text(c, `Best: ${best.toLocaleString()}    •    Workouts: ${life.workouts}    •    Total kcal: ${life.kcal}`,
      W / 2, H * 0.84, 38, CSS.dim, 600);
  });
}

// ---------- Countdown ----------
const countdownPanel = addPanel(ui, 0.6, 0.6, 0, 0.1, -1.5);
countdownPanel.mesh.visible = false;

// ---------- HUD ----------
const hud = addPanel(ui, 1.4, 0.26, 0, 0.42, -2.2);
hud.mesh.visible = false;

// ---------- Pause ----------
const pauseGroup = new THREE.Group();
ui.add(pauseGroup);
const pausePanel = addPanel(pauseGroup, 0.9, 0.26, 0, 0.3, -1.3);
pausePanel.draw((c, W, H) => {
  roundRect(c, 6, 6, W - 12, H - 12, 30); c.fillStyle = CSS.panel; c.fill();
  text(c, 'PAUSED', W / 2, H * 0.4, 110, '#fff', 900);
  text(c, 'Punch or point at a button to continue', W / 2, H * 0.78, 38, CSS.dim, 600);
});
addButton(pauseGroup, 0.24, 0.12, 'RESUME', -0.14, -0.08, NEAR, () => resumeGame(), { color: '#3dff9a' });
addButton(pauseGroup, 0.24, 0.12, 'QUIT', 0.14, -0.08, NEAR, () => quitToMenu(), { color: CSS.left });
pauseGroup.visible = false;

// ---------- Results ----------
const resultsGroup = new THREE.Group();
ui.add(resultsGroup);
const resultsPanel = addPanel(resultsGroup, 1.1, 0.7, 0, 0.25, -1.5);
addButton(resultsGroup, 0.24, 0.12, 'AGAIN', -0.14, -0.22, NEAR, () => startCountdown(), { color: '#3dff9a' });
addButton(resultsGroup, 0.24, 0.12, 'MENU', 0.14, -0.22, NEAR, () => showMenu(), { color: CSS.accent });
resultsGroup.visible = false;

// =====================================================================
// Game state
// =====================================================================
let state = 'menu'; // menu | countdown | playing | paused | results
let countdownEnd = 0;
let lastCount = 0;
let pausedFrom = null;
const g = { score: 0, combo: 0, maxCombo: 0, hits: 0, misses: 0, wrong: 0, kcal: 0, duration: 180, punches: 0 };
let hudDirty = true;
let hudTimer = 0;

function setScreen(s) {
  state = s;
  menu.visible = s === 'menu';
  countdownPanel.mesh.visible = s === 'countdown';
  hud.mesh.visible = s === 'playing' || s === 'countdown';
  pauseGroup.visible = s === 'paused';
  resultsGroup.visible = s === 'results';
  gloves.showRays(s === 'menu' || s === 'paused' || s === 'results');
}

function showMenu() {
  audio.stop();
  targets.reset([]);
  setMessage('Punch a button  •  or point and pull the trigger');
  refreshMenu();
  setScreen('menu');
}

function startCountdown() {
  audio.unlock();
  audio.stop();
  measureHead(true);
  Object.assign(g, { score: 0, combo: 0, maxCombo: 0, hits: 0, misses: 0, wrong: 0, kcal: 0, punches: 0 });
  g.duration = sel.minutes * 60;
  targets.reset(generateChart(sel.track, g.duration));
  countdownEnd = performance.now() + 3000;
  lastCount = 4;
  hudDirty = true;
  setScreen('countdown');
}

function startGame() {
  audio.start(sel.track, 0.05);
  setScreen('playing');
}

function pauseGame() {
  if (state !== 'playing' && state !== 'countdown') return;
  pausedFrom = state;
  audio.pause();
  setScreen('paused');
}

function resumeGame() {
  audio.unlock();
  if (pausedFrom === 'countdown') { countdownEnd = performance.now() + 3000; lastCount = 4; setScreen('countdown'); return; }
  audio.resume();
  setScreen('playing');
}

function quitToMenu() { audio.resume(); showMenu(); }

function endGame() {
  audio.stop();
  const total = g.hits + g.misses + g.wrong;
  const accuracy = total ? Math.round((g.hits / total) * 100) : 0;
  const kcal = Math.round(g.kcal);
  const isBest = Storage.recordWorkout(sel.minutes, sel.track.id, g.score, g.kcal, g.punches);
  audio.beep(660, 0.15); setTimeout(() => audio.beep(880, 0.25), 160);

  resultsPanel.draw((c, W, H) => {
    roundRect(c, 6, 6, W - 12, H - 12, 36); c.fillStyle = CSS.panel; c.fill();
    c.lineWidth = 6; c.strokeStyle = CSS.accent; c.stroke();
    text(c, 'WORKOUT COMPLETE', W / 2, 90, 70, CSS.accent, 900);
    text(c, g.score.toLocaleString(), W / 2, 220, 150, '#fff', 900);
    if (isBest) text(c, 'NEW BEST!', W / 2, 320, 56, '#ffd23d', 900);
    const rows = [
      ['Accuracy', `${accuracy}%`],
      ['Max combo', `${g.maxCombo}`],
      ['Punches landed', `${g.hits}`],
      ['Est. calories', `${kcal} kcal`],
    ];
    rows.forEach(([k, v], i) => {
      const y = 410 + i * 66;
      text(c, k, 180, y, 46, CSS.dim, 600, 'left');
      text(c, v, W - 180, y, 46, '#fff', 800, 'right');
    });
  });
  setScreen('results');
}

// =====================================================================
// Gameplay
// =====================================================================
function updatePlaying(dt) {
  const t = audio.songTime;
  const minSpeed = gloves.desktop.active ? CONFIG.DESKTOP_MIN_PUNCH_SPEED : CONFIG.MIN_PUNCH_SPEED;
  const res = targets.update(t, headY, gloves.active(), minSpeed);

  for (const h of res.hits) {
    g.combo++;
    g.maxCombo = Math.max(g.maxCombo, g.combo);
    g.hits++; g.punches++;
    const mult = 1 + Math.min(3, Math.floor(g.combo / 10));
    const onBeat = h.timing < 0.3 ? 50 : 0;
    const power = Math.min(50, Math.round(h.speed * 10));
    g.score += (100 + onBeat + power) * mult;
    g.kcal += 0.07;
    fx.burst(h.pos, COLORS[h.hand], Math.min(1.4, 0.6 + h.speed / 5));
    audio.sfxHit(Math.min(1.3, 0.6 + h.speed / 5));
    gloves.buzz(h.glove, 0.8, 50);
    hudDirty = true;
  }
  for (const w of res.wrong) {
    g.combo = 0; g.wrong++; g.punches++;
    fx.burst(w.pos, 0x888888, 0.5);
    audio.sfxMiss();
    gloves.buzz(w.glove, 0.2, 30);
    hudDirty = true;
  }
  if (res.misses) { g.combo = 0; g.misses += res.misses; audio.sfxMiss(); hudDirty = true; }

  g.kcal += dt * 0.07; // baseline effort while moving

  if (t >= g.duration) endGame();
}

function drawHud() {
  const t = state === 'playing' || state === 'paused' ? audio.songTime : 0;
  const left = Math.max(0, g.duration - t);
  const mm = Math.floor(left / 60), ss = Math.floor(left % 60).toString().padStart(2, '0');
  const mult = 1 + Math.min(3, Math.floor(g.combo / 10));
  hud.draw((c, W, H) => {
    roundRect(c, 6, 6, W - 12, H - 12, 30); c.fillStyle = 'rgba(8,12,30,0.7)'; c.fill();
    const cols = [W * 0.15, W * 0.39, W * 0.62, W * 0.85];
    const labels = ['SCORE', 'COMBO', 'TIME', 'KCAL'];
    const vals = [g.score.toLocaleString(), `${g.combo}  x${mult}`, `${mm}:${ss}`, `${Math.round(g.kcal)}`];
    labels.forEach((l, i) => {
      text(c, l, cols[i], 70, 40, CSS.dim, 700);
      text(c, vals[i], cols[i], 148, 74, i === 1 && mult > 1 ? '#ffd23d' : '#fff', 900);
    });
    // progress bar
    const p = g.duration ? Math.min(1, t / g.duration) : 0;
    roundRect(c, 40, H - 40, W - 80, 14, 7); c.fillStyle = 'rgba(255,255,255,0.12)'; c.fill();
    roundRect(c, 40, H - 40, Math.max(14, (W - 80) * p), 14, 7); c.fillStyle = CSS.accent; c.fill();
  });
}

function updateCountdown() {
  const remaining = (countdownEnd - performance.now()) / 1000;
  const n = Math.ceil(remaining);
  if (n !== lastCount) {
    lastCount = n;
    if (n > 0) audio.beep(520, 0.12); else audio.beep(1040, 0.25);
    countdownPanel.draw((c, W, H) => {
      c.shadowColor = CSS.accent; c.shadowBlur = 50;
      text(c, n > 0 ? `${n}` : 'GO!', W / 2, H / 2, n > 0 ? 420 : 260, '#fff', 900);
    });
  }
  if (remaining <= 0) startGame();
}

// =====================================================================
// Input: punching buttons, pointer + trigger, mouse
// =====================================================================
const touching = new Map(); // button -> Set of gloves inside it

function updateButtonTouches() {
  const list = gloves.active().filter((gl) => !gl.isDesktop);
  for (const b of buttons) {
    let set = touching.get(b);
    if (!set) touching.set(b, (set = new Set()));
    const visible = b.mesh.visible && isVisibleInTree(b.mesh);
    for (const gl of list) {
      const inside = visible && gloveTouchesButton(gl, b);
      if (inside && !set.has(gl)) {
        set.add(gl);
        if (b.press()) gloves.buzz(gl, 0.5, 40);
      } else if (!inside) set.delete(gl);
    }
  }
}

function isVisibleInTree(obj) {
  for (let o = obj; o; o = o.parent) if (!o.visible) return false;
  return true;
}

const raycaster = new THREE.Raycaster();
function pressFromRay() {
  const meshes = buttons.filter((b) => isVisibleInTree(b.mesh)).map((b) => b.mesh);
  const hit = raycaster.intersectObjects(meshes, false)[0];
  if (hit) { hit.object.userData.button.press(); return true; }
  return false;
}

gloves.onSelect((ctrl) => {
  audio.unlock();
  if (state === 'playing' || state === 'countdown') return;
  const m = new THREE.Matrix4().extractRotation(ctrl.controller.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(ctrl.controller.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(m);
  if (pressFromRay()) gloves.buzz(ctrl, 0.5, 40);
});

// Mouse (desktop preview)
const mouse = new THREE.Vector2();
const punchPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -CONFIG.HIT_PLANE_Z);
const planeHit = new THREE.Vector3();
renderer.domElement.addEventListener('pointermove', (e) => {
  if (renderer.xr.isPresenting) return;
  mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(mouse, camera);
  if (raycaster.ray.intersectPlane(punchPlane, planeHit)) {
    gloves.desktop.pos.copy(planeHit);
    if (!gloves.desktop.glove.visible) { gloves.desktop.prevPos.copy(planeHit); gloves.desktop.glove.visible = true; }
  }
});
renderer.domElement.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (renderer.xr.isPresenting) return;
  mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(mouse, camera);
  if (state === 'playing') desktopPunch();
  else pressFromRay();
});
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.key === 'p') state === 'paused' ? resumeGame() : pauseGame();
  if (e.code === 'Space' && state === 'playing') { e.preventDefault(); desktopPunch(); }
});

// Desktop preview: a click or Space throws a punch where the glove is.
// Holding the mouse button keeps punching, so you can sweep across targets.
let mouseHeld = false;
addEventListener('pointerup', () => { mouseHeld = false; });
renderer.domElement.addEventListener('pointerdown', () => { if (state === 'playing') mouseHeld = true; });
function desktopPunch() {
  if (renderer.xr.isPresenting) return;
  gloves.desktop.boost = 0.2;
  gloves.desktop.flash = 1;
}
setInterval(() => { if (mouseHeld && state === 'playing') gloves.desktop.boost = 0.1; }, 50);

// =====================================================================
// Head height + pause when headset removed / system menu opened
// =====================================================================
const headPos = new THREE.Vector3();
function measureHead(snap = false) {
  if (renderer.xr.isPresenting) {
    renderer.xr.getCamera().getWorldPosition(headPos);
    if (headPos.y < 0.5) return; // pose not ready yet
    const target = THREE.MathUtils.clamp(headPos.y, 1.0, 2.1);
    headY = snap ? target : THREE.MathUtils.lerp(headY, target, 0.05);
  } else {
    headY = 1.6;
  }
  ui.position.y = headY;
}

renderer.xr.addEventListener('sessionstart', () => {
  audio.unlock();
  overlay.classList.add('hidden');
  const session = renderer.xr.getSession();
  session.addEventListener('visibilitychange', () => {
    // 'visible-blurred' = system menu open, 'hidden' = headset removed
    if (session.visibilityState !== 'visible') pauseGame();
  });
  gloves.desktop.glove.visible = false;
});
renderer.xr.addEventListener('sessionend', () => {
  pauseGame();
  overlay.classList.remove('hidden');
  measureHead(true);
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });

// =====================================================================
// Enter VR overlay (HTML)
// =====================================================================
const overlay = document.getElementById('overlay');
const vrBtn = document.getElementById('enter-vr');
const deskBtn = document.getElementById('desktop');

async function startXR() {
  audio.unlock();
  try {
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] });
    await renderer.xr.setSession(session);
    return true;
  } catch (e) {
    console.warn('Could not start VR:', e);
    return false;
  }
}

vrBtn.addEventListener('click', startXR);
deskBtn.addEventListener('click', () => { audio.unlock(); overlay.classList.add('hidden'); });

(async () => {
  const xrOk = navigator.xr && await navigator.xr.isSessionSupported('immersive-vr').catch(() => false);
  if (xrOk) {
    vrBtn.disabled = false;
    vrBtn.textContent = 'ENTER VR';
    // Installed as a Quest app (PWA): jump straight into VR, the app icon tap counts as the user gesture
    if (window.getDigitalGoodsService !== undefined) startXR();
  } else {
    vrBtn.textContent = 'VR NOT AVAILABLE';
  }
})();

// =====================================================================
// Main loop
// =====================================================================
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const xr = renderer.xr.isPresenting;

  gloves.update(dt, xr);
  if (state === 'menu' || state === 'results' || state === 'paused') measureHead();

  if (state === 'countdown') updateCountdown();
  else if (state === 'playing') updatePlaying(dt);
  if (state !== 'playing') updateButtonTouches();

  buttons.forEach((b) => b.update(dt));
  fx.update(dt);

  // Arena pulses on the beat while playing
  let pulse;
  if (state === 'playing') {
    const phase = (audio.songTime / audio.secondsPerBeat) % 1;
    pulse = Math.exp(-phase * 5);
  } else pulse = 0.35 + 0.15 * Math.sin(clock.elapsedTime * 2);
  arena.update(clock.elapsedTime, pulse, dt);

  hudTimer += dt;
  if (hud.mesh.visible && (hudDirty || hudTimer > 0.25)) { drawHud(); hudDirty = false; hudTimer = 0; }

  renderer.render(scene, camera);
});

// =====================================================================
// Boot
// =====================================================================
IAP.init().finally(() => showMenu());
showMenu();

// Offline cache: only on the live site. On localhost it would serve stale code while you edit.
const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
if ('serviceWorker' in navigator) {
  if (isLocal) {
    navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
    if (window.caches) caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
  } else if (location.protocol === 'https:') {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW failed', e));
  }
}

// Exposed for debugging in DevTools
window.punchpulse = { state: () => state, g, sel, startCountdown, pauseGame, resumeGame, endGame, audio, IAP, targets, camera };
