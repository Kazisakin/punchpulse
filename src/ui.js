// In-world UI drawn on canvas textures (no font files needed).
// Buttons can be punched, pointed at + trigger, or clicked with the mouse.
import * as THREE from 'three';
import { CSS } from './config.js';

const PX_PER_M = 1000; // canvas resolution

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
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

export function text(c, str, x, y, size, color = CSS.text, weight = 700, align = 'center') {
  c.font = `${weight} ${size}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
  c.fillStyle = color;
  c.textAlign = align;
  c.textBaseline = 'middle';
  c.fillText(str, x, y);
}

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
    this.hover = 0;
    this.cooldown = 0;
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
      const pad = 8;
      roundRect(c, pad, pad, W - pad * 2, H - pad * 2, 26);
      c.fillStyle = this.selected ? this.color : CSS.panel;
      c.globalAlpha = this.locked ? 0.55 : 1;
      c.fill();
      c.lineWidth = 8;
      c.strokeStyle = this.color;
      c.stroke();
      const fg = this.selected ? '#05060f' : CSS.text;
      // shrink the label until it fits inside the button
      let mainSize = Math.min(H * 0.38, 64);
      c.font = `700 ${mainSize}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
      const maxW = W * 0.84;
      const tw = c.measureText(this.label).width;
      if (tw > maxW) mainSize *= maxW / tw;
      if (this.sub) {
        text(c, this.label, W / 2, H * 0.4, mainSize, fg);
        text(c, this.sub, W / 2, H * 0.72, mainSize * 0.55, this.selected ? '#05060f' : CSS.dim, 600);
      } else {
        text(c, this.label, W / 2, H / 2, mainSize, fg);
      }
      c.globalAlpha = 1;
    });
  }

  press() {
    if (!this.enabled || !this.mesh.visible || this.cooldown > 0) return false;
    this.cooldown = 0.35;
    this.hover = 1;
    this.onPress?.(this);
    return true;
  }

  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.hover = Math.max(0, this.hover - dt * 4);
    const s = 1 + this.hover * 0.08;
    this.mesh.scale.set(s, s, 1);
  }
}

// Utility to check whether a glove is touching a button (punch-to-press)
const local = new THREE.Vector3();
export function gloveTouchesButton(glove, button) {
  if (!button.mesh.visible || !button.enabled) return false;
  local.copy(glove.pos);
  button.mesh.worldToLocal(local);
  return Math.abs(local.x) < button.w / 2 && Math.abs(local.y) < button.h / 2 && Math.abs(local.z) < 0.07;
}
