// PunchPulse — main game: scene setup, menus, sessions, game loop, input, XR session handling.
import * as THREE from 'three';
import { CONFIG, COLORS, CSS, DIFFICULTIES, THEMES, difficultyById } from './config.js';
import { createArena } from './arena.js';
import { createGloves } from './gloves.js';
import { TargetManager } from './targets.js';
import { Effects } from './effects.js';
import { AudioEngine, TRACKS, trackById } from './audio.js';
import { generateChart, tutorialChart } from './chart.js';
import { Storage, dateKey } from './storage.js';
import { PROGRAMS, nextProgramSession, dailyChallenge, ACHIEVEMENTS, evaluateAchievements } from './progression.js';
import { IAP } from './iap.js';
import { Panel, Button, gloveTouchesButton, buttonNormal, roundRect, text, fitText, card, pop, updateTweens } from './ui.js';
import { glowSprite } from './gfx.js';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';

// =====================================================================
// Scene, camera, renderer
// =====================================================================
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 100);
camera.position.set(0, 1.6, 0);
camera.lookAt(0, 1.52, -1.2);

// alpha: true so Mixed Reality can show the real room behind the game
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x000000, 0);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFoveation(1);
document.body.appendChild(renderer.domElement);

const arena = createArena(scene);
const gloves = createGloves(renderer, scene);
const targets = new TargetManager(scene);
const fx = new Effects(scene);
const audio = new AudioEngine();

{ // soft studio reflections for the glossy gloves (generated once)
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
}

const settings = Storage.settings;
arena.setTheme(settings.theme);

// =====================================================================
// UI building blocks. The UI group sits at the player's eye height; in menus it also turns to
// face wherever the player is looking (like the Quest home menu).
// =====================================================================
const ui = new THREE.Group();
ui.position.y = 1.6;
scene.add(ui);
let headY = 1.6;

// Menu layout: buttons live on a plane 0.75 m in front of the eyes (arm's reach for a poke,
// comfortable to point at), centred slightly above eye level; info panels sit just behind it.
const MENU_Z = -0.75, MENU_Y = 0.13, MENU_SCALE = 1.1;
function nearPlane(parent) {
  const p = new THREE.Group();
  p.position.set(0, MENU_Y, MENU_Z);
  p.scale.setScalar(MENU_SCALE);
  parent.add(p);
  return p;
}

const buttons = [];
function addButton(parent, w, h, label, x, y, onPress, opts = {}) {
  const b = new Button(w, h, label, onPress, opts);
  b.mesh.position.set(x, y, opts.z ?? 0);
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
const ROW = [0.04, -0.11, -0.26, -0.41]; // button rows (relative to head height)
const COL3 = [-0.27, 0, 0.27];
const BW = 0.24, BH = 0.12;

let uiLock = 0; // short input lock after every screen change (no accidental double presses)
const lockUI = () => { uiLock = 0.45; };

// ---------- shared menu panels ----------
const menu = new THREE.Group();
ui.add(menu);
const TITLE_Y = 0.5, TITLE_Z = -1.0;
const titlePanel = addPanel(menu, 1.1, 0.3, 0, TITLE_Y, TITLE_Z);
const menuNear = nearPlane(menu);
// one glass card behind every menu's buttons, so each screen reads as one clean block
const backCard = addPanel(menuNear, 0.98, 0.675, 0, -0.2175, -0.02);
backCard.mesh.renderOrder = 9;
backCard.draw((c, W, H) => card(c, W, H, { border: 'rgba(0,229,255,0.35)', fill: 'rgba(6,9,24,0.72)', radius: 40, line: 4 }));
const msgPanel = addPanel(menuNear, 0.9, 0.055, 0, -0.515, 0);
const statsPanel = addPanel(menu, 1.5, 0.82, 0, 0.17, -1.05);

function setMessage(str, color = CSS.dim) {
  msgPanel.draw((c, W, H) => fitText(c, str, W / 2, H / 2, 32, W - 20, color, 600));
}

function drawTitle(title, line2 = '', line3 = '', color = '#ffffff') {
  titlePanel.draw((c, W, H) => {
    c.shadowColor = CSS.accent; c.shadowBlur = 36;
    fitText(c, title, W / 2, H * 0.3, 120, W - 60, color, 900);
    c.shadowBlur = 0;
    if (line2) fitText(c, line2, W / 2, H * 0.64, 38, W - 60, CSS.text, 600);
    if (line3) fitText(c, line3, W / 2, H * 0.86, 32, W - 60, CSS.dim, 600);
  });
}

// ---------- pages ----------
const pages = {};
function makePage(name) {
  const g = nearPlane(menu);
  g.visible = false;
  pages[name] = g;
  return g;
}
let page = 'home';

// ---------------- HOME ----------------
const home = makePage('home');
const homeBtns = {
  quick: addButton(home, BW, BH, 'QUICK PLAY', COL3[0], ROW[0], () => showPage('quick'), { color: CSS.accent }),
  daily: addButton(home, BW, BH, 'DAILY', COL3[1], ROW[0], () => startSession(dailySession()), { color: CSS.gold }),
  programs: addButton(home, BW, BH, 'PROGRAMS', COL3[2], ROW[0], () => showPage('programs'), { color: CSS.green }),
  stats: addButton(home, BW, BH, 'STATS', COL3[0], ROW[1], () => showPage('stats'), { color: CSS.violet }),
  settings: addButton(home, BW, BH, 'SETTINGS', COL3[1], ROW[1], () => showPage('settings'), { color: CSS.dim }),
  tutorial: addButton(home, BW, BH, 'TUTORIAL', COL3[2], ROW[1], () => startSession(tutorialSession()), { color: CSS.magenta }),
  pro: addButton(home, 0.51, 0.1, 'UNLOCK PRO', 0, ROW[2], () => askPro(true), { color: CSS.gold }),
  exit: addButton(home, 0.24, 0.1, 'EXIT', 0, ROW[3], () => exitGame(), { color: CSS.left }),
};

// ---------------- QUICK PLAY ----------------
const quick = makePage('quick');
const sel = { minutes: 3, trackIndex: 0 };
const durationButtons = CONFIG.DURATIONS.map((d, i) =>
  addButton(quick, BW, BH, `${d.minutes} MIN`, COL3[i], ROW[0], () => {
    if (d.pro && !IAP.pro) return askPro();
    sel.minutes = d.minutes; audio.sfxClick(); refreshQuick();
  })
);
const prevTrack = addButton(quick, 0.12, BH, '◀', -0.33, ROW[1], () => cycleTrack(-1), { color: CSS.magenta });
const trackButton = addButton(quick, 0.5, BH, '', 0, ROW[1], () => cycleTrack(1), { color: CSS.magenta });
const nextTrack = addButton(quick, 0.12, BH, '▶', 0.33, ROW[1], () => cycleTrack(1), { color: CSS.magenta });
const diffButtons = DIFFICULTIES.map((d, i) =>
  addButton(quick, 0.17, 0.1, d.name, -0.285 + i * 0.19, ROW[2], () => {
    if (d.pro && !IAP.pro) return askPro();
    Storage.setSetting('difficulty', d.id); audio.sfxClick(); refreshQuick();
  }, { color: CSS.orange })
);
addButton(quick, 0.17, BH, 'BACK', -0.29, ROW[3], () => showPage('home'), { color: CSS.dim });
addButton(quick, 0.42, BH, 'START', 0.1, ROW[3], () => startSession(quickSession()), { color: CSS.green });

function cycleTrack(dir) {
  sel.trackIndex = (sel.trackIndex + dir + TRACKS.length) % TRACKS.length;
  audio.sfxClick();
  refreshQuick();
}

// ---------------- PROGRAMS ----------------
const programsPage = makePage('programs');
const programButtons = PROGRAMS.map((p, i) =>
  addButton(programsPage, 0.78, 0.12, p.name, 0, ROW[i], () => pressProgram(p), { color: CSS.green })
);
addButton(programsPage, 0.24, 0.1, 'BACK', 0, ROW[3] - 0.01, () => showPage('home'), { color: CSS.dim });

// ---------------- STATS ----------------
const statsPage = makePage('stats');
addButton(statsPage, 0.24, 0.1, 'BACK', 0, ROW[3] - 0.03, () => showPage('home'), { color: CSS.dim });

// ---------------- SETTINGS ----------------
const settingsPage = makePage('settings');
const postureButtons = ['standing', 'seated'].map((p, i) =>
  addButton(settingsPage, 0.3, BH, p.toUpperCase(), i ? 0.17 : -0.17, ROW[0], () => {
    Storage.setSetting('posture', p); audio.sfxClick(); refreshSettings();
  }, { color: CSS.accent })
);
let arSupported = false;
const modeButtons = ['vr', 'mr'].map((m, i) =>
  addButton(settingsPage, 0.3, BH, m === 'vr' ? 'VIRTUAL REALITY' : 'MIXED REALITY', i ? 0.17 : -0.17, ROW[1], () => setMode(m), { color: CSS.magenta })
);
const themeButtons = THEMES.map((t, i) =>
  addButton(settingsPage, BW, 0.1, t.name, COL3[i], ROW[2], () => {
    if (t.pro && !IAP.pro) return askPro();
    Storage.setSetting('theme', t.id); arena.setTheme(t.id); audio.sfxClick(); refreshSettings();
  }, { color: CSS.violet })
);
const hintsButton = addButton(settingsPage, 0.3, 0.1, 'HINTS', -0.17, ROW[3] - 0.01, () => {
  Storage.setSetting('hints', hintsActive() ? 'off' : 'on'); audio.sfxClick(); refreshSettings();
}, { color: CSS.gold });
addButton(settingsPage, 0.3, 0.1, 'BACK', 0.17, ROW[3] - 0.01, () => showPage('home'), { color: CSS.dim });

// Hints show during a player's first real workout, or always if they switch them on.
function hintsActive() {
  return settings.hints === 'on' || (settings.hints !== 'off' && !settings.firstRunDone);
}

// ---------- refresh functions ----------
function refreshHome() {
  const streak = Storage.streak;
  const daily = dailyChallenge();
  const dailyBest = Storage.dailyBest();
  const t = Storage.totals;
  drawTitle('PUNCHPULSE',
    streak.count > 0 ? `🔥 ${streak.count}-day streak   •   Today's challenge: ${daily.track.name}` : `Today's challenge: ${daily.track.name} · ${daily.difficulty.name}`,
    `Workouts: ${t.workouts}   •   Total kcal: ${Math.round(t.kcal)}   •   Punches: ${t.punches.toLocaleString()}`);
  homeBtns.daily.set({ sub: dailyBest ? `BEST ${dailyBest.toLocaleString()}` : 'NEW TODAY' });
  homeBtns.tutorial.set({ selected: !settings.tutorialDone, sub: settings.tutorialDone ? '' : 'START HERE' });
  homeBtns.pro.mesh.visible = !IAP.pro && IAP.available;
  homeBtns.pro.set({ label: IAP.price ? `UNLOCK PRO  ${IAP.price}` : 'UNLOCK PRO' });
  homeBtns.exit.mesh.position.y = homeBtns.pro.mesh.visible ? ROW[3] : ROW[2];
  setMessage(gloves.usingHands() ? 'Point and pinch to select  •  or poke a button'
    : 'Point and pull the trigger  •  or punch a button');
  if (!settings.tutorialDone) setMessage('New here? Punch TUTORIAL to learn the moves (1 minute)', CSS.gold);
}

function refreshQuick() {
  const track = TRACKS[sel.trackIndex];
  const diff = difficultyById(settings.difficulty);
  durationButtons.forEach((b, i) => {
    const d = CONFIG.DURATIONS[i];
    const locked = d.pro && !IAP.pro;
    b.set({ selected: d.minutes === sel.minutes, locked, sub: locked ? 'PRO' : '' });
  });
  const tLocked = track.pro && !IAP.pro;
  trackButton.set({ label: track.name.toUpperCase(), sub: tLocked ? `${track.bpm} BPM · PRO` : `${track.bpm} BPM`, locked: tLocked });
  diffButtons.forEach((b, i) => {
    const d = DIFFICULTIES[i];
    const locked = d.pro && !IAP.pro;
    b.set({ selected: d.id === diff.id, locked, sub: locked ? 'PRO' : '' });
  });
  const best = Storage.bestFor({ mode: settings.mode, minutes: sel.minutes, trackId: track.id, difficulty: diff.id });
  drawTitle('QUICK PLAY', `${track.name} · ${sel.minutes} min · ${diff.name}${settings.posture === 'seated' ? ' · SEATED' : ''}`,
    best ? `Your best: ${best.toLocaleString()}` : 'No score yet — set the first one!');
  setMessage('Tap the song name or arrows to change the song');
}

function refreshPrograms() {
  programButtons.forEach((b, i) => {
    const p = PROGRAMS[i];
    const done = Storage.programProgress(p.id);
    const locked = p.pro && !IAP.pro;
    const finished = done >= p.sessions.length;
    const next = nextProgramSession(p);
    b.set({
      label: `${p.name}   ${finished ? '✓ COMPLETE' : `DAY ${done + 1}/${p.sessions.length}`}`,
      sub: locked ? 'PRO' : finished ? 'Punch again to restart' : `Next: ${next.track.name} · ${next.minutes} min · ${next.difficulty.name}`,
      locked,
    });
  });
  drawTitle('PROGRAMS', 'Guided plans that get harder day by day', 'Each punch starts your next session');
  setMessage('Pick a program — your progress is saved automatically');
}

function refreshSettings() {
  postureButtons.forEach((b, i) => b.set({ selected: settings.posture === (i ? 'seated' : 'standing') }));
  modeButtons.forEach((b, i) => {
    const m = i ? 'mr' : 'vr';
    const unsupported = m === 'mr' && !arSupported;
    b.set({ selected: settings.mode === m, locked: unsupported, sub: unsupported ? 'NOT AVAILABLE HERE' : m === 'mr' ? 'SEE YOUR ROOM' : 'FULL ARENA' });
  });
  themeButtons.forEach((b, i) => {
    const t = THEMES[i];
    const locked = t.pro && !IAP.pro;
    b.set({ selected: settings.theme === t.id, locked, sub: locked ? 'PRO' : '' });
  });
  const hOn = hintsActive();
  hintsButton.set({ label: hOn ? 'HINTS: ON' : 'HINTS: OFF', selected: hOn,
    sub: settings.hints === 'on' || settings.hints === 'off' ? '' : 'FIRST WORKOUT' });
  drawTitle('SETTINGS', settings.posture === 'seated' ? 'Seated: targets stay in reach, no dodge walls' : 'Standing: full workout with ducks and leans',
    settings.mode === 'mr' ? 'Mixed Reality: play in your own room' : 'Virtual Reality: neon arena');
  setMessage('Changes are saved automatically');
}

function refreshStats() {
  drawTitle('YOUR STATS', '', '');
  titlePanel.mesh.visible = false;
  const t = Storage.totals;
  const s = Storage.streak;
  const hist = Storage.history;
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    days.push({ label: 'SMTWTFS'[d.getDay()], kcal: hist[dateKey(d)]?.kcal || 0 });
  }
  const maxK = Math.max(30, ...days.map((d) => d.kcal));
  statsPanel.draw((c, W, H) => {
    card(c, W, H, { border: CSS.violet, radius: 40 });
    text(c, 'YOUR STATS', 60, 70, 64, '#fff', 900, 'left');
    // left column: numbers
    const rows = [
      ['Current streak', `🔥 ${s.count} day${s.count === 1 ? '' : 's'}`],
      ['Best streak', `${s.best} days`],
      ['Workouts', `${t.workouts}`],
      ['Total calories', `${Math.round(t.kcal)} kcal`],
      ['Punches landed', t.punches.toLocaleString()],
      ['Uppercuts · Blocks · Dodges', `${t.uppercuts} · ${t.blocks} · ${t.dodges}`],
      ['Best combo', `${t.maxCombo}`],
      ['Time trained', `${Math.round(t.seconds / 60)} min`],
    ];
    rows.forEach(([k, v], i) => {
      const y = 150 + i * 56;
      text(c, k, 60, y, 34, CSS.dim, 600, 'left');
      text(c, v, 700, y, 36, '#fff', 800, 'right');
    });
    // weekly chart
    text(c, 'LAST 7 DAYS (kcal)', 60, 618, 32, CSS.violet, 800, 'left');
    const bx = 60, bw = 640, bh = 90, by = 745;
    days.forEach((d, i) => {
      const w = bw / 7 - 18, x = bx + i * (bw / 7) + 9;
      const h = Math.max(4, (d.kcal / maxK) * bh);
      roundRect(c, x, by - h, w, h, 8); c.fillStyle = d.kcal ? CSS.accent : 'rgba(255,255,255,0.12)'; c.fill();
      text(c, d.label, x + w / 2, by + 6 + 14, 26, CSS.dim, 700);
      if (d.kcal) text(c, `${Math.round(d.kcal)}`, x + w / 2, by - h - 18, 24, '#fff', 700);
    });
    // right column: achievements
    const unlocked = Storage.achievements;
    const count = ACHIEVEMENTS.filter((a) => unlocked[a.id]).length;
    text(c, `ACHIEVEMENTS ${count}/${ACHIEVEMENTS.length}`, 780, 70, 44, CSS.gold, 900, 'left');
    ACHIEVEMENTS.forEach((a, i) => {
      const y = 130 + i * 43;
      const got = !!unlocked[a.id];
      text(c, got ? '★' : '☆', 790, y, 30, got ? CSS.gold : CSS.dim, 900, 'left');
      fitText(c, a.name, 832, y, 28, 240, got ? '#fff' : CSS.dim, 800, 'left');
      fitText(c, a.desc, 1085, y, 23, W - 1085 - 40, CSS.dim, 500, 'left');
    });
  });
  setMessage('Keep your streak alive — one workout a day');
}

function showPage(name) {
  page = name;
  for (const [n, g] of Object.entries(pages)) g.visible = n === name;
  titlePanel.mesh.visible = name !== 'stats';
  statsPanel.mesh.visible = name === 'stats';
  backCard.mesh.visible = name !== 'stats';
  ({ home: refreshHome, quick: refreshQuick, programs: refreshPrograms, stats: refreshStats, settings: refreshSettings })[name]();
  if (state === 'menu') audio.sfxClick();
  // entrance animation: card + title pop, buttons pop in one after another
  if (name === 'stats') pop(statsPanel.mesh, { from: 0.9 });
  else { pop(titlePanel.mesh, { from: 0.92 }); pop(backCard.mesh, { from: 0.96, dur: 0.25 }); }
  appearButtons(pages[name]);
  lockUI();
}

function appearButtons(group, delay = 0.04) {
  let i = 0;
  for (const b of buttons) if (isVisibleInTree(b.mesh) && isInside(b.mesh, group)) b.appear(delay + Math.min(0.22, i++ * 0.022));
}
function isInside(obj, group) {
  for (let o = obj; o; o = o.parent) if (o === group) return true;
  return false;
}

async function askPro(fromButton) {
  if (IAP.pro) return;
  if (!IAP.available) {
    setMessage('PRO unlock is available in the Meta Horizon Store version', CSS.gold);
    audio.sfxMiss();
    return;
  }
  if (!fromButton) { setMessage('That is a PRO feature — UNLOCK PRO on the home page', CSS.gold); return; }
  const ok = await IAP.buyPro();
  setMessage(ok ? 'PRO unlocked — thank you!' : 'Purchase cancelled', ok ? CSS.green : CSS.dim);
  showPage(page);
}

// ---------- in-game panels ----------
const countdownPanel = addPanel(ui, 0.6, 0.6, 0, 0.1, -1.5);
const hud = addPanel(ui, 1.4, 0.26, 0, 0.42, -2.2);
const hintPanel = addPanel(ui, 1.8, 0.2, 0, 0.7, -2.2);
countdownPanel.mesh.visible = hud.mesh.visible = hintPanel.mesh.visible = false;
// Always-visible pause button next to the HUD: point at it and pinch / pull the trigger.
// (Controllers can also press B or Y; the Quest menu button pauses too.)
const gameBar = new THREE.Group();
ui.add(gameBar);
const pauseButton = addButton(gameBar, 0.34, 0.2, 'II  PAUSE', -0.92, 0.42, () => pauseGame(), { color: CSS.dim, z: -2.18 });
gameBar.visible = false;

const pauseGroup = new THREE.Group();
ui.add(pauseGroup);
const pausePanel = addPanel(pauseGroup, 0.9, 0.24, 0, 0.36, -1.1);
pausePanel.draw((c, W, H) => {
  card(c, W, H, { border: CSS.accent, radius: 34 });
  text(c, 'PAUSED', W / 2, H * 0.42, 100, '#fff', 900);
  fitText(c, 'Point and pinch (or pull the trigger) to choose', W / 2, H * 0.78, 32, W - 60, CSS.dim, 600);
});
const pauseNear = nearPlane(pauseGroup);
addButton(pauseNear, BW, BH, 'RESUME', -0.27, ROW[1], () => resumeGame(), { color: CSS.green });
addButton(pauseNear, BW, BH, 'RESTART', 0, ROW[1], () => { audio.resume(); startSession(lastSession); }, { color: CSS.accent });
addButton(pauseNear, BW, BH, 'QUIT', 0.27, ROW[1], () => quitToMenu(), { color: CSS.left, sub: 'TO MENU' });
pauseGroup.visible = false;

const resultsGroup = new THREE.Group();
ui.add(resultsGroup);
const resultsPanel = addPanel(resultsGroup, 1.2, 0.82, 0, 0.21, -1.35);
const resultsNear = nearPlane(resultsGroup);
const againButton = addButton(resultsNear, BW, BH, 'AGAIN', -0.14, -0.33, () => startSession(lastSession), { color: CSS.green });
addButton(resultsNear, BW, BH, 'MENU', 0.14, -0.33, () => showMenu(), { color: CSS.accent });
resultsGroup.visible = false;

// =====================================================================
// Sessions
// =====================================================================
function baseSession() {
  return { mode: settings.mode, posture: settings.posture };
}
function quickSession() {
  const track = TRACKS[sel.trackIndex];
  const difficulty = difficultyById(settings.difficulty);
  if ((track.pro || difficulty.pro || sel.minutes === 10) && !IAP.pro) return null;
  return { ...baseSession(), kind: 'quick', track, minutes: sel.minutes, difficulty, label: `${track.name} · ${difficulty.name}` };
}
function dailySession() {
  const d = dailyChallenge();
  return { ...baseSession(), kind: 'daily', track: d.track, minutes: d.minutes, difficulty: d.difficulty, seed: d.seed, label: `Daily challenge · ${d.track.name}` };
}
function tutorialSession() {
  return { ...baseSession(), kind: 'tutorial', track: trackById('warmup'), minutes: 1, difficulty: { ...difficultyById('easy'), speed: 5 }, label: 'Tutorial' };
}
function pressProgram(p) {
  if (p.pro && !IAP.pro) return askPro();
  if (Storage.programProgress(p.id) >= p.sessions.length) { Storage.resetProgram(p.id); refreshPrograms(); return; }
  const n = nextProgramSession(p);
  if ((n.track.pro || n.difficulty.pro) && !IAP.pro) return askPro();
  startSession({ ...baseSession(), kind: 'program', programId: p.id, programDay: n.index + 1, track: n.track, minutes: n.minutes, difficulty: n.difficulty, label: `${p.name} · Day ${n.index + 1}` });
}

// =====================================================================
// Game state
// =====================================================================
let state = 'menu'; // menu | countdown | playing | paused | results
let session = null;
let lastSession = null;
let countdownEnd = 0, lastCount = 0, pausedFrom = null;
const g = {};
function resetRun() {
  Object.assign(g, {
    score: 0, combo: 0, maxCombo: 0, hits: 0, misses: 0, wrong: 0, kcal: 0, punches: 0,
    perfects: 0, uppercuts: 0, blocks: 0, blockMisses: 0, dodges: 0, ouches: 0, duration: 180,
  });
}
resetRun();
let hudDirty = true, hudTimer = 0;
const headPos = new THREE.Vector3();
const headRef = { x: 0, y: 1.6 };

function setScreen(s) {
  state = s;
  const inGame = s === 'playing' || s === 'countdown';
  menu.visible = s === 'menu';
  countdownPanel.mesh.visible = s === 'countdown';
  hud.mesh.visible = inGame;
  gameBar.visible = inGame;
  hintPanel.mesh.visible = inGame && !!session?.hints;
  pauseGroup.visible = s === 'paused';
  resultsGroup.visible = s === 'results';
  gloves.showRays(!inGame);
  placeUI(true);
  if (s === 'paused') { pop(pausePanel.mesh, { from: 0.9 }); appearButtons(pauseGroup); }
  if (s === 'results') { pop(resultsPanel.mesh, { from: 0.88, dur: 0.4 }); appearButtons(resultsGroup, 0.25); }
  if (inGame) { pop(hud.mesh, { from: 0.9 }); pauseButton.appear(0.1); }
  lockUI();
}

// Menus face the player: snap in front of them when a screen opens, then follow lazily if they
// turn away (more than ~35°) or walk off. During play the UI stays fixed to the arena's front.
const fwdTmp = new THREE.Vector3();
let uiYaw = 0;
function headYaw() {
  if (!renderer.xr.isPresenting) return 0;
  renderer.xr.getCamera().getWorldDirection(fwdTmp);
  if (Math.hypot(fwdTmp.x, fwdTmp.z) < 0.2) return uiYaw; // looking straight up/down: keep
  return Math.atan2(-fwdTmp.x, -fwdTmp.z);
}
function angleDiff(a, b) { return Math.atan2(Math.sin(a - b), Math.cos(a - b)); }
function placeUI(snap = false, dt = 0) {
  const inGame = state === 'playing' || state === 'countdown';
  const xr = renderer.xr.isPresenting;
  const tx = inGame || !xr ? 0 : headPos.x, tz = inGame || !xr ? 0 : headPos.z;
  const tyaw = inGame ? 0 : headYaw();
  if (snap) { uiYaw = tyaw; ui.position.x = tx; ui.position.z = tz; }
  else if (!inGame) {
    const d = angleDiff(tyaw, uiYaw);
    if (Math.abs(d) > 0.6 || ui.userData.following) {
      ui.userData.following = Math.abs(d) > 0.05;
      uiYaw += d * Math.min(1, dt * 3);
    }
    const k = Math.min(1, dt * 2);
    if (Math.hypot(tx - ui.position.x, tz - ui.position.z) > 0.25 || ui.userData.moving) {
      ui.userData.moving = Math.hypot(tx - ui.position.x, tz - ui.position.z) > 0.02;
      ui.position.x += (tx - ui.position.x) * k; ui.position.z += (tz - ui.position.z) * k;
    }
  }
  ui.rotation.y = uiYaw;
}

function showMenu() {
  audio.stop();
  targets.reset([]);
  setScreen('menu');
  showPage(settings.tutorialDone ? (page === 'stats' ? 'home' : page) : 'home');
}

function startSession(s) {
  if (!s) return askPro();
  session = s;
  lastSession = s;
  audio.unlock();
  audio.stop();
  measureHead(true);
  resetRun();
  const seated = s.posture === 'seated';
  if (s.kind === 'tutorial') {
    const tut = tutorialChart({ track: s.track, seated });
    g.duration = tut.duration;
    targets.reset(tut.notes, s.difficulty);
  } else {
    g.duration = s.minutes * 60;
    targets.reset(generateChart({ track: s.track, durationSec: g.duration, difficulty: s.difficulty, seated, seed: s.seed }), s.difficulty);
  }
  countdownEnd = performance.now() + 3000;
  lastCount = 4;
  hudDirty = true;
  s.hints = s.kind === 'tutorial' || hintsActive();
  hintState.seen = new Set(); hintState.until = 0; hintState.misses = 0; hintState.wrongShown = 0; hintState.wallShown = false; hintState.doneShown = false;
  setScreen('countdown');
  lastHint = null;
  if (s.kind === 'tutorial') drawHint('Stand in the glowing circle — get ready!');
  else if (s.hints) drawHint(gloves.usingHands() ? 'Make FISTS!  RED = LEFT hand  •  BLUE = RIGHT hand' : 'RED = LEFT glove  •  BLUE = RIGHT glove  •  punch on the beat', 4);
  else drawHint('');
}

function startGame() {
  measureHead(true);
  headRef.x = headPos.x; headRef.y = headPos.y || headY;
  audio.start(session.track, 0.05);
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

function letterGrade(acc) { return acc >= 95 ? 'S' : acc >= 85 ? 'A' : acc >= 70 ? 'B' : acc >= 50 ? 'C' : 'D'; }

function endGame() {
  audio.stop();
  const good = g.hits + g.blocks + g.dodges;
  const total = good + g.misses + g.wrong + g.blockMisses + g.ouches;
  const accuracy = total ? Math.round((good / total) * 100) : 0;
  const kcal = Math.round(g.kcal);
  const seconds = Math.round(Math.min(audio.songTime, g.duration));

  let isBest = false, achievements = [];
  if (session.kind === 'tutorial') {
    Storage.setSetting('tutorialDone', true);
  } else if (!settings.firstRunDone) {
    Storage.setSetting('firstRunDone', true); // first real workout done: auto-hints switch off
  }
  const rec = Storage.recordWorkout(
    { mode: session.mode, minutes: session.minutes, trackId: session.track.id, difficulty: session.difficulty.id, kind: session.kind, programId: session.programId },
    { score: g.score, kcal: g.kcal, punches: g.hits, uppercuts: g.uppercuts, blocks: g.blocks, dodges: g.dodges, perfects: g.perfects, maxCombo: g.maxCombo, seconds }
  );
  isBest = rec.isBest && session.kind !== 'tutorial';
  achievements = evaluateAchievements({ ...session, difficulty: session.difficulty.id },
    { maxCombo: g.maxCombo, perfects: g.perfects, accuracy });
  const streak = Storage.streak;

  audio.beep(660, 0.15); setTimeout(() => audio.beep(880, 0.25), 160);
  if (achievements.length) setTimeout(() => audio.sfxAchievement(), 600);

  const heading = { quick: 'WORKOUT COMPLETE', daily: 'DAILY CHALLENGE', program: (session.label || '').toUpperCase(), tutorial: 'TUTORIAL COMPLETE' }[session.kind];
  resultsPanel.draw((c, W, H) => {
    card(c, W, H, { border: CSS.accent, radius: 40 });
    fitText(c, heading, W / 2, 80, 66, W - 60, CSS.accent, 900);
    text(c, g.score.toLocaleString(), W / 2 - 120, 200, 140, '#fff', 900);
    text(c, letterGrade(accuracy), W / 2 + 330, 200, 150, CSS.gold, 900);
    let y = 300;
    if (isBest) { text(c, 'NEW BEST!', W / 2, y, 52, CSS.gold, 900); y += 64; }
    if (streak.count > 0) { text(c, `🔥 ${streak.count}-day streak`, W / 2, y, 44, '#ff8a3d', 800); y += 60; }
    const rows = [
      ['Accuracy', `${accuracy}%`],
      ['Max combo', `${g.maxCombo}`],
      ['Perfect hits', `${g.perfects}`],
      ['Uppercuts · Blocks · Dodges', `${g.uppercuts} · ${g.blocks} · ${g.dodges}`],
      ['Est. calories', `${kcal} kcal`],
    ];
    rows.forEach(([k, v], i) => {
      const ry = y + 20 + i * 58;
      text(c, k, 170, ry, 40, CSS.dim, 600, 'left');
      text(c, v, W - 170, ry, 40, '#fff', 800, 'right');
    });
    y += 20 + rows.length * 58 + 10;
    achievements.slice(0, 3).forEach((a, i) => {
      text(c, `★ ACHIEVEMENT: ${a.name}`, W / 2, y + i * 50, 38, CSS.gold, 900);
    });
  });
  againButton.set({ label: session.kind === 'program' ? 'NEXT DAY' : session.kind === 'tutorial' ? 'PLAY NOW' : 'AGAIN' });
  againButton.onPress = () => {
    if (session.kind === 'program') pressProgram(PROGRAMS.find((p) => p.id === session.programId));
    else if (session.kind === 'tutorial') startSession(quickSession() || dailySession());
    else startSession(lastSession);
  };
  setScreen('results');
}

// =====================================================================
// Gameplay
// =====================================================================
const minSpeed = (gl) => gl.isDesktop ? CONFIG.DESKTOP_MIN_PUNCH_SPEED : gl.kind === 'hand' ? CONFIG.HAND_MIN_PUNCH_SPEED : CONFIG.MIN_PUNCH_SPEED;
const mult = () => 1 + Math.min(3, Math.floor(g.combo / 10));

function updatePlaying(dt) {
  const t = audio.songTime;
  const xr = renderer.xr.isPresenting;
  // let the standing reference follow the player slowly while no wall is coming
  if (xr && targets.timeToNextWall(t) > 2.5) {
    headRef.x += (headPos.x - headRef.x) * 0.02;
    headRef.y += (headPos.y - headRef.y) * 0.02;
  }
  const res = targets.update({
    songTime: t, headY, headPos: xr ? headPos : null, headRef, gloves: gloves.active(), minSpeed,
    autoDodge: !xr, // desktop preview can't move its head
  });

  for (const h of res.hits) {
    g.combo++; g.maxCombo = Math.max(g.maxCombo, g.combo); g.hits++; g.punches++;
    const grade = h.timing < 0.15 ? 'PERFECT' : h.timing < 0.35 ? 'GREAT' : 'GOOD';
    if (grade === 'PERFECT') g.perfects++;
    const onBeat = grade === 'PERFECT' ? 50 : grade === 'GREAT' ? 25 : 0;
    const power = Math.min(50, Math.round(h.speed * 10));
    const upper = h.type === 'upper';
    if (upper) g.uppercuts++;
    g.score += (100 + onBeat + power + (upper ? 50 : 0)) * mult();
    g.kcal += upper ? 0.1 : 0.07;
    fx.burst(h.pos, COLORS[h.hand], Math.min(1.4, 0.6 + h.speed / 5) * (grade === 'PERFECT' ? 1.25 : 1));
    fx.popup(upper ? 'UPPER' : grade, h.pos);
    audio.sfxHit(Math.min(1.3, 0.6 + h.speed / 5));
    gloves.buzz(h.glove, 0.8, 50);
  }
  if (session.hints && session.kind !== 'tutorial') reactiveHints(res, t);
  for (const w of res.wrong) {
    g.combo = 0; g.wrong++; g.punches++;
    fx.burst(w.pos, 0x888888, 0.5); fx.popup('WRONG', w.pos);
    audio.sfxMiss(); gloves.buzz(w.glove, 0.2, 30);
  }
  for (const b of res.blocks) {
    g.combo++; g.maxCombo = Math.max(g.maxCombo, g.combo); g.blocks++;
    g.score += 150 * mult(); g.kcal += 0.08;
    fx.burst(b.pos, COLORS.block, 1.1); fx.popup('BLOCK', b.pos);
    audio.sfxBlock();
    gloves.active().forEach((gl) => gloves.buzz(gl, 0.9, 80));
  }
  for (const d of res.dodges) {
    g.combo++; g.maxCombo = Math.max(g.maxCombo, g.combo); g.dodges++;
    g.score += 100 * mult(); g.kcal += 0.25; // squats and leans burn more
    fx.popup('DODGE', d.pos); audio.sfxDodge();
  }
  for (const o of res.ouches) {
    g.combo = 0; g.ouches++;
    fx.burst(o.pos, COLORS.left, 0.8); fx.popup('OUCH', o.pos); audio.sfxOuch();
    gloves.active().forEach((gl) => gloves.buzz(gl, 1, 120));
  }
  if (res.misses || res.blockMisses) {
    g.combo = 0; g.misses += res.misses; g.blockMisses += res.blockMisses; audio.sfxMiss();
  }
  if (res.hits.length || res.wrong.length || res.blocks.length || res.dodges.length || res.ouches.length || res.misses || res.blockMisses) hudDirty = true;

  g.kcal += dt * 0.07; // baseline effort while moving
  if (session.kind === 'tutorial') updateTutorialHint(t);
  else if (session.hints) updateFreePlayHint(t);
  if (t >= g.duration) endGame();
}

// ---------- tutorial hints ----------
const HINTS = {
  'punch-left': 'Punch RED targets with your LEFT fist — on the beat',
  'punch-right': 'Punch BLUE targets with your RIGHT fist',
  'upper-left': 'Arrow = UPPERCUT: swing your fist UP from below',
  'upper-right': 'Uppercut with your RIGHT — punch upward',
  'block-both': 'Purple bar = BLOCK: raise BOTH fists in front of your face',
  'duck-none': 'Orange wall = DUCK: bend your knees and go under it',
  'leanL-none': 'LEAN LEFT to dodge the wall',
  'leanR-none': 'LEAN RIGHT to dodge the wall',
};
// first-workout hints (Quick Play / Daily / Programs): one per move type, the first time it appears
const FIRST_HINTS = {
  punch: 'RED = LEFT fist  •  BLUE = RIGHT fist  •  hit as the ring closes',
  upper: 'ARROW target = UPPERCUT: swing your fist UP from below',
  block: 'PURPLE bar = BLOCK: raise BOTH fists in front of your face',
  duck: 'ORANGE wall = DUCK: bend your knees and go under it',
  leanL: 'Wall on the right = LEAN LEFT to dodge it',
  leanR: 'Wall on the left = LEAN RIGHT to dodge it',
};
const hintState = { seen: new Set(), until: 0, misses: 0, wrongShown: 0, wallShown: false, doneShown: false };
let lastHint = null;
function drawHint(str, holdSec = 0) {
  if (holdSec) hintState.until = (state === 'playing' ? audio.songTime : 0) + holdSec;
  if (str === lastHint) return;
  lastHint = str;
  hintPanel.draw((c, W, H) => {
    if (!str) return;
    card(c, W, H, { border: CSS.gold, fill: 'rgba(8,12,30,0.88)', radius: 34 });
    fitText(c, str, W / 2, H / 2, 66, W - 70, '#fff', 800);
  });
  if (str) pop(hintPanel.mesh, { from: 0.85, dur: 0.28 });
}
function updateFreePlayHint(t) {
  if (t < hintState.until) return;
  const upcoming = targets.chart.find((n) => n.time > t && n.time - t < 2.6 && !hintState.seen.has(n.type));
  if (upcoming) {
    hintState.seen.add(upcoming.type);
    drawHint(FIRST_HINTS[upcoming.type] || '', Math.max(2.4, upcoming.time - t + 0.6));
    return;
  }
  if (!hintState.doneShown && t > 50 && hintState.seen.size >= 2) {
    hintState.doneShown = true;
    drawHint('Nice! Hints switch off after this workout (Settings → Hints)', 3.5);
    return;
  }
  drawHint('');
}
function reactiveHints(res, t) {
  if (res.hits.length) hintState.misses = 0;
  hintState.misses += res.misses;
  if (res.wrong.length && hintState.wrongShown < 2) {
    hintState.wrongShown++;
    drawHint('Wrong hand!  RED = LEFT  •  BLUE = RIGHT', 2.5);
  } else if (hintState.misses >= 3) {
    hintState.misses = 0;
    drawHint(gloves.usingHands() ? 'Make a tight fist and punch THROUGH the target — quick and firm'
      : 'Punch THROUGH the target as the ring closes — quick and firm', 3);
  } else if (res.ouches.length && !hintState.wallShown) {
    hintState.wallShown = true;
    drawHint('Watch the walls — DUCK under or LEAN around them', 3);
  }
}
function updateTutorialHint(t) {
  const upcoming = targets.chart.find((n) => n.time > t - 0.2);
  if (!upcoming) return drawHint('Great job! That is everything — enjoy the workout!');
  if (upcoming.time - t < 3.2) drawHint(HINTS[`${upcoming.type}-${upcoming.hand}`] || '');
}

// ---------- HUD ----------
function drawHud() {
  const t = state === 'playing' || state === 'paused' ? audio.songTime : 0;
  const left = Math.max(0, g.duration - t);
  const mm = Math.floor(left / 60), ss = Math.floor(left % 60).toString().padStart(2, '0');
  const m = mult();
  hud.draw((c, W, H) => {
    card(c, W, H, { border: 'rgba(0,229,255,0.4)', fill: 'rgba(8,12,30,0.72)', radius: 34 });
    const cols = [W * 0.15, W * 0.39, W * 0.62, W * 0.85];
    const labels = ['SCORE', 'COMBO', 'TIME', 'KCAL'];
    const vals = [g.score.toLocaleString(), `${g.combo}  x${m}`, `${mm}:${ss}`, `${Math.round(g.kcal)}`];
    labels.forEach((l, i) => {
      text(c, l, cols[i], 62, 38, CSS.dim, 700);
      text(c, vals[i], cols[i], 135, 72, i === 1 && m > 1 ? CSS.gold : '#fff', 900);
    });
    if (session) text(c, session.label, W / 2, 205, 30, CSS.dim, 600);
    const p = g.duration ? Math.min(1, t / g.duration) : 0;
    roundRect(c, 40, H - 32, W - 80, 12, 6); c.fillStyle = 'rgba(255,255,255,0.12)'; c.fill();
    roundRect(c, 40, H - 32, Math.max(12, (W - 80) * p), 12, 6); c.fillStyle = CSS.accent; c.fill();
  });
}

function updateCountdown() {
  measureHead();
  const remaining = (countdownEnd - performance.now()) / 1000;
  const n = Math.ceil(remaining);
  if (n !== lastCount) {
    lastCount = n;
    if (n > 0) audio.beep(520, 0.12); else audio.beep(1040, 0.25);
    countdownPanel.draw((c, W, H) => {
      c.shadowColor = CSS.accent; c.shadowBlur = 50;
      text(c, n > 0 ? `${n}` : 'GO!', W / 2, H / 2, n > 0 ? 420 : 260, '#fff', 900);
    });
    pop(countdownPanel.mesh, { from: 1.5, dur: 0.35 });
  }
  if (remaining <= 0) startGame();
}

// =====================================================================
// Input: punching / poking buttons, pointer + trigger or pinch, mouse
// =====================================================================
const touching = new Map(); // button -> Set of gloves inside it

function isVisibleInTree(obj) {
  for (let o = obj; o; o = o.parent) if (!o.visible) return false;
  return true;
}

function updateButtonTouches() {
  const list = gloves.active().filter((gl) => !gl.isDesktop);
  for (const b of buttons) {
    let set = touching.get(b);
    if (!set) touching.set(b, (set = new Set()));
    const visible = isVisibleInTree(b.mesh);
    for (const gl of list) {
      const inside = visible && gloveTouchesButton(gl, b, gl.kind === 'hand' ? 0.1 : 0.08);
      if (inside && !set.has(gl)) {
        set.add(gl);
        // must move INTO the button (whichever way the menu faces), and not right after a screen change
        const into = -gl.velocity.dot(buttonNormal(b));
        if (uiLock <= 0 && into > CONFIG.BUTTON_PRESS_MIN_FORWARD && b.press()) gloves.buzz(gl, 0.5, 40);
      } else if (!inside) set.delete(gl);
    }
  }
}

const raycaster = new THREE.Raycaster();
function pointerButtons() {
  const inGame = state === 'playing' || state === 'countdown';
  return inGame ? (gameBar.visible ? [pauseButton] : []) : buttons.filter((b) => isVisibleInTree(b.mesh));
}
function rayHit() {
  const hit = raycaster.intersectObjects(pointerButtons().map((b) => b.mesh), false)[0];
  return hit || null;
}
function pressFromRay() {
  if (uiLock > 0) return false;
  const hit = rayHit();
  if (hit) { hit.object.userData.button.press(); return true; }
  return false;
}
const rotM = new THREE.Matrix4();
function setRayFrom(ctrl) {
  rotM.extractRotation(ctrl.controller.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(ctrl.controller.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(rotM);
}

gloves.onSelect((ctrl) => {
  audio.unlock();
  setRayFrom(ctrl);
  if (pressFromRay()) gloves.buzz(ctrl, 0.5, 40);
});

// Pointer feedback: the button under each ray glows and grows, a dot marks the exact spot, and the
// ray stops at the button. During play the ray only appears while aiming at the PAUSE button.
const cursors = gloves.inputs.map(() => {
  const s = glowSprite(0xffffff, 0.035, 0.95);
  s.renderOrder = 20; s.material.depthTest = false; s.visible = false;
  scene.add(s);
  return s;
});
const lastFocus = new Map();
function updatePointers() {
  for (const b of buttons) b.focus = false;
  const inGame = state === 'playing' || state === 'countdown';
  gloves.inputs.forEach((h, i) => {
    const cur = cursors[i];
    cur.visible = false;
    if (!h.active || !renderer.xr.isPresenting) { h.ray.visible = false; return; }
    setRayFrom(h);
    const hit = rayHit();
    if (hit) {
      const b = hit.object.userData.button;
      b.focus = true;
      cur.position.copy(hit.point).addScaledVector(raycaster.ray.direction, -0.005);
      cur.visible = true;
      h.ray.scale.z = hit.distance;
      if (lastFocus.get(h) !== b && h.kind === 'controller') gloves.tick(h);
      lastFocus.set(h, b);
    } else {
      h.ray.scale.z = 1.2;
      lastFocus.delete(h);
    }
    h.ray.visible = inGame ? !!hit : true;
  });
}

// Controller B / Y button pauses during play
const prevBY = new Map();
function pollPauseButtons() {
  for (const h of gloves.inputs) {
    const pressed = !!h.gamepad?.buttons?.[5]?.pressed;
    if (pressed && !prevBY.get(h) && (state === 'playing' || state === 'countdown')) pauseGame();
    prevBY.set(h, pressed);
  }
}

function exitGame() {
  const s = renderer.xr.getSession();
  if (s) s.end().catch(() => {});
  setTimeout(() => { try { window.close(); } catch { /* not allowed in a normal tab */ } }, 300);
}

// ---------- mouse (desktop preview) ----------
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
let mouseHeld = false;
renderer.domElement.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (renderer.xr.isPresenting) return;
  mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(mouse, camera);
  if (state === 'playing') { mouseHeld = true; desktopPunch(); }
  else pressFromRay();
});
addEventListener('pointerup', () => { mouseHeld = false; });
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.key === 'p') state === 'paused' ? resumeGame() : pauseGame();
  if (e.code === 'Space' && state === 'playing') { e.preventDefault(); desktopPunch(); }
});
function desktopPunch() {
  if (renderer.xr.isPresenting) return;
  gloves.desktop.boost = 0.2;
  gloves.desktop.flash = 1;
}
setInterval(() => { if (mouseHeld && state === 'playing') gloves.desktop.boost = 0.1; }, 50);

// =====================================================================
// Head tracking, pause when headset removed / system menu opened
// =====================================================================
function measureHead(snap = false) {
  if (renderer.xr.isPresenting) {
    renderer.xr.getCamera().getWorldPosition(headPos);
    if (headPos.y < 0.5) return;
    const target = THREE.MathUtils.clamp(headPos.y, 0.9, 2.1);
    headY = snap ? target : THREE.MathUtils.lerp(headY, target, 0.05);
  } else {
    headPos.set(0, 1.6, 0);
    headY = 1.6;
  }
  ui.position.y = headY;
}

// =====================================================================
// XR sessions: VR or Mixed Reality (passthrough), hands or controllers
// =====================================================================
const overlay = document.getElementById('overlay');
const vrBtn = document.getElementById('enter-vr');
const mrBtn = document.getElementById('enter-mr');
const deskBtn = document.getElementById('desktop');
let pendingRestart = null;

async function startXR(mode = settings.mode) {
  audio.unlock();
  const sessionType = mode === 'mr' && arSupported ? 'immersive-ar' : 'immersive-vr';
  try {
    const session = await navigator.xr.requestSession(sessionType, { optionalFeatures: ['local-floor', 'hand-tracking'] });
    arena.setMixedReality(sessionType === 'immersive-ar');
    await renderer.xr.setSession(session);
    return true;
  } catch (e) {
    console.warn('Could not start XR:', e);
    return false;
  }
}

function setMode(m) {
  if (m === 'mr' && !arSupported) return;
  Storage.setSetting('mode', m);
  audio.sfxClick();
  refreshSettings();
  const xrSession = renderer.xr.getSession();
  if (xrSession && (m === 'mr') !== arena.isMR) {
    // switching needs a new XR session
    pendingRestart = m;
    xrSession.end();
  } else if (!xrSession) {
    arena.setMixedReality(false);
  }
}

renderer.xr.addEventListener('sessionstart', () => {
  audio.unlock();
  overlay.classList.add('hidden');
  const s = renderer.xr.getSession();
  s.addEventListener('visibilitychange', () => {
    // 'visible-blurred' = system menu open, 'hidden' = headset removed
    if (s.visibilityState !== 'visible') pauseGame();
  });
  gloves.desktop.glove.visible = false;
  ui.userData.placedOnce = false; // re-centre the menu in front of the player once the head pose arrives
  if (state === 'menu') showPage(page);
});
renderer.xr.addEventListener('sessionend', async () => {
  arena.setMixedReality(false);
  if (pendingRestart) {
    const m = pendingRestart;
    pendingRestart = null;
    if (await startXR(m)) return;
  }
  pauseGame();
  overlay.classList.remove('hidden');
  measureHead(true);
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });

vrBtn.addEventListener('click', () => { Storage.setSetting('mode', 'vr'); startXR('vr'); });
mrBtn.addEventListener('click', () => { Storage.setSetting('mode', 'mr'); startXR('mr'); });
deskBtn.addEventListener('click', () => { audio.unlock(); overlay.classList.add('hidden'); });

(async () => {
  const xrOk = navigator.xr && await navigator.xr.isSessionSupported('immersive-vr').catch(() => false);
  arSupported = !!(navigator.xr && await navigator.xr.isSessionSupported('immersive-ar').catch(() => false));
  if (xrOk) {
    vrBtn.disabled = false;
    vrBtn.textContent = 'ENTER VR';
    deskBtn.style.display = 'none';
    if (arSupported) mrBtn.style.display = '';
    // Installed as a Quest app (PWA): jump straight in; the app icon tap counts as the user gesture
    if (window.getDigitalGoodsService !== undefined) {
      if (!(await startXR(settings.mode))) await startXR('vr');
    }
  } else {
    vrBtn.textContent = 'VR NOT AVAILABLE';
  }
  if (state === 'menu' && page === 'settings') refreshSettings();
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
  uiLock = Math.max(0, uiLock - dt);

  gloves.update(dt, xr);
  if (xr) renderer.xr.getCamera().getWorldPosition(headPos);
  if (state === 'menu' || state === 'results' || state === 'paused') measureHead();
  if (xr && !ui.userData.placedOnce && headPos.y > 0.5) { ui.userData.placedOnce = true; placeUI(true); }

  if (state === 'countdown') updateCountdown();
  else if (state === 'playing') updatePlaying(dt);
  if (state !== 'playing' && state !== 'countdown') updateButtonTouches();
  updatePointers();
  pollPauseButtons();
  placeUI(false, dt);
  titlePanel.mesh.position.y = TITLE_Y + Math.sin(clock.elapsedTime * 1.2) * 0.006; // gentle float

  buttons.forEach((b) => b.update(dt));
  updateTweens(dt);
  fx.update(dt);

  let pulse, phase;
  if (state === 'playing') {
    phase = (audio.songTime / audio.secondsPerBeat) % 1;
    pulse = Math.exp(-phase * 5);
  } else {
    phase = (clock.elapsedTime * 0.5) % 1;
    pulse = 0.35 + 0.15 * Math.sin(clock.elapsedTime * 2);
  }
  arena.update(clock.elapsedTime, pulse, dt, phase, state === 'playing' ? audio.spectrum() : null);

  hudTimer += dt;
  if (hud.mesh.visible && (hudDirty || hudTimer > 0.25)) { drawHud(); hudDirty = false; hudTimer = 0; }

  renderer.render(scene, camera);
});

// =====================================================================
// Boot
// =====================================================================
setScreen('menu');
showPage('home');
IAP.init().finally(() => { if (state === 'menu') showPage(page); });

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

// Exposed for debugging in DevTools and automated tests
window.punchpulse = {
  state: () => state, page: () => page, g, sel, settings, session: () => session,
  startSession, quickSession, dailySession, tutorialSession, pressProgram, showPage, showMenu,
  pauseGame, resumeGame, endGame, exitGame, hintsActive, ui, buttons, audio, IAP, targets, camera, renderer, gloves, scene, arena, headRef, headPos,
};
