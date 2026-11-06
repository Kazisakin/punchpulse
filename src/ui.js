// Canvas-texture UI. Buttons work with poke/punch, ray + trigger/pinch, or mouse.
import * as THREE from 'three';
import { CSS } from './config.js';

const PX_PER_M = 1000; // canvas resolution
export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const font = (size, weight = 700) => `${weight} ${Math.round(size)}px ${FONT}`;

export class Panel {
  constructor(w, h, { transparent = true } = {}) {
    this.w = w; this.h = h;
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.round(w * PX_PER_M);
    this.canvas.height = Math.round(h * PX_PER_M);
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: this.texture, transparent, depthWrite: false, toneMapped: false })
    );
    this.mesh.renderOrder = 10;
    this.mesh.userData.panel = this;
  }

  draw(fn) {
    const c = this.ctx;
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    fn(c, this.canvas.width, this.canvas.height);
    this.texture.needsUpdate = true;
  }
}

export function roundRect(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

// shared panel style
export function card(c, W, H, { border = CSS.accent, fill = CSS.panel, radius = 34, line = 4 } = {}) {
  const p = line + 2;
  roundRect(c, p, p, W - p * 2, H - p * 2, radius);
  c.fillStyle = fill;
  c.fill();
  const grd = c.createLinearGradient(0, 0, 0, H * 0.5);
  grd.addColorStop(0, 'rgba(255,255,255,0.06)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = grd;
  c.fill();
  c.lineWidth = line;
  c.strokeStyle = border;
  c.globalAlpha *= 0.9;
  c.stroke();
  c.globalAlpha = 1;
}

// Like text(), but shrinks the font so the string never exceeds maxW pixels
export function fitText(c, str, x, y, size, maxW, color = CSS.text, weight = 700, align = 'center') {
  c.font = font(size, weight);
  const w = c.measureText(str).width;
  text(c, str, x, y, w > maxW ? size * (maxW / w) : size, color, weight, align);
}

export function text(c, str, x, y, size, color = CSS.text, weight = 700, align = 'center') {
  c.font = font(size, weight);
  c.fillStyle = color;
  c.textAlign = align;
  c.textBaseline = 'middle';
  c.fillText(str, x, y);
}

const easeOutBack = (t) => { const s = 1.6; t -= 1; return t * t * ((s + 1) * t + s) + 1; };
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const clamp01 = (t) => Math.min(1, Math.max(0, t));

export class Button extends Panel {
  constructor(w, h, label, onPress, { color = CSS.accent, sub = '' } = {}) {
    super(w, h);
    this.label = label;
    this.sub = sub;
    this.color = color;
    this.onPress = onPress;
    this.selected = false;
    this.locked = false;
    this.enabled = true;
    this.hover = 0;      // press flash (1 -> 0)
    this.focus = false;  // a pointer ray is on it
    this.focusAmt = 0;
    this.introT = 1;     // seconds since appear(); < 0 while waiting for its stagger delay
    this.cooldown = 0;
    this.baseZ = null;
    this.mesh.userData.button = this;
    this.render();
  }

  set({ label, sub, selected, locked, color } = {}) {
    if (label !== undefined) this.label = label;
    if (sub !== undefined) this.sub = sub;
    if (selected !== undefined) this.selected = selected;
    if (locked !== undefined) this.locked = locked;
    if (color !== undefined) this.color = color;
    this.render();
  }

  render() {
    this.draw((c, W, H) => {
      c.globalAlpha = this.locked ? 0.5 : 1;
      card(c, W, H, {
        border: this.color,
        fill: this.selected ? this.color : CSS.panel,
        radius: Math.min(30, H * 0.28),
        line: 6,
      });
      c.globalAlpha = this.locked ? 0.5 : 1;
      const fg = this.selected ? '#05060f' : CSS.text;
      let mainSize = Math.min(H * 0.36, 60);
      c.font = font(mainSize, 800);
      const maxW = W * 0.84;
      const tw = c.measureText(this.label).width;
      if (tw > maxW) mainSize *= maxW / tw;
      if (this.sub) {
        text(c, this.label, W / 2, H * 0.4, mainSize, fg, 800);
        fitText(c, this.sub, W / 2, H * 0.72, Math.min(mainSize * 0.55, 30), maxW, this.selected ? '#05060f' : CSS.dim, 600);
      } else {
        text(c, this.label, W / 2, H / 2, mainSize, fg, 800);
      }
      c.globalAlpha = 1;
    });
  }

  // play the pop-in animation (delay = stagger in seconds)
  appear(delay = 0) { this.introT = -delay; }

  press() {
    if (!this.enabled || !this.mesh.visible || this.cooldown > 0) return false;
    this.cooldown = 0.35;
    this.hover = 1;
    this.onPress?.(this);
    return true;
  }

  update(dt) {
    if (this.baseZ === null) this.baseZ = this.mesh.position.z;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.hover = Math.max(0, this.hover - dt * 4);
    this.focusAmt += ((this.focus ? 1 : 0) - this.focusAmt) * Math.min(1, dt * 14);
    this.introT += dt;
    const k = easeOutBack(clamp01(this.introT / 0.32));
    const s = (0.7 + 0.3 * k) * (1 + this.focusAmt * 0.05 + this.hover * 0.06);
    this.mesh.scale.set(s, s, 1);
    this.mesh.position.z = this.baseZ + this.focusAmt * 0.01 - this.hover * 0.015;
    const m = this.mesh.material;
    m.opacity = clamp01(this.introT / 0.18);
    m.color.setScalar(1 + this.focusAmt * 0.35 + this.hover * 0.5);
  }
}

// Tiny tween helper for panels: scale + fade pop
const tweens = new Map(); // mesh -> tween
export function pop(mesh, { delay = 0, dur = 0.32, from = 0.85 } = {}) {
  if (mesh.userData.baseScale === undefined) mesh.userData.baseScale = mesh.scale.x;
  tweens.set(mesh, { t: -delay, dur, from });
  apply(mesh, tweens.get(mesh));
}
function apply(mesh, tw) {
  const base = mesh.userData.baseScale;
  const k = clamp01(tw.t / tw.dur);
  const e = tw.from > 1 ? easeOutCubic(k) : easeOutBack(k);
  mesh.scale.setScalar(base * (tw.from + (1 - tw.from) * e));
  if (mesh.material) mesh.material.opacity = clamp01(tw.t / (tw.dur * 0.6));
}
export function updateTweens(dt) {
  for (const [mesh, tw] of tweens) {
    tw.t += dt;
    apply(mesh, tw);
    if (tw.t >= tw.dur) tweens.delete(mesh);
  }
}

// Is a glove inside a button? (poke / punch to press)
const local = new THREE.Vector3();
export function gloveTouchesButton(glove, button, depth = 0.08) {
  if (!button.mesh.visible || !button.enabled) return false;
  local.copy(glove.pos);
  button.mesh.worldToLocal(local);
  const s = button.mesh.scale.x || 1; // undo the hover/press scale so the hit box stays stable
  return Math.abs(local.x * s) < button.w / 2 + 0.01 && Math.abs(local.y * s) < button.h / 2 + 0.01 && Math.abs(local.z) < depth;
}

// World-space direction a button faces (its +Z). A press must move against this.
const nrm = new THREE.Vector3();
const q = new THREE.Quaternion();
export function buttonNormal(button) {
  return nrm.set(0, 0, 1).applyQuaternion(button.mesh.getWorldQuaternion(q));
}
