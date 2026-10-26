// Shared graphics helpers: glow textures and cheap glowing shaders.
// Everything here is designed for mobile VR GPUs (Quest 2): no post-processing,
// glow is faked with additive sprites and fresnel rim shaders.
import * as THREE from 'three';

let glowTex = null;
// Soft round glow texture (white), tinted per use
export function glowTexture() {
  if (glowTex) return glowTex;
  const s = 128;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.2, 'rgba(255,255,255,0.8)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.22)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, s, s);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

// Additive glowing sprite
export function glowSprite(color, size, opacity = 1) {
  const m = new THREE.SpriteMaterial({
    map: glowTexture(), color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  const s = new THREE.Sprite(m);
  s.scale.setScalar(size);
  return s;
}

// Fresnel "energy" material: bright rim, darker centre. Unlit and cheap.
export function fresnelMaterial(color, { core = 0.25, rim = 1.6, power = 2.2, opacity = 1, additive = false } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uCore: { value: core },
      uRim: { value: rim },
      uPower: { value: power },
      uOpacity: { value: opacity },
      uFlash: { value: 0 },
    },
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uCore, uRim, uPower, uOpacity, uFlash;
      varying vec3 vN; varying vec3 vV;
      void main() {
        float f = pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), uPower);
        vec3 col = uColor * (uCore + f * uRim) + vec3(f * 0.35 + uFlash);
        gl_FragColor = vec4(col, uOpacity * (additiveAlpha(f)));
      }`.replace('additiveAlpha(f)', additive ? 'clamp(0.15 + f, 0.0, 1.0)' : '1.0'),
    transparent: additive || opacity < 1,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: !additive,
    toneMapped: false,
  });
}

// Adds a fresnel rim glow to a standard (lit) material without replacing it
export function addRimGlow(material, color, strength = 1.2, power = 2.5) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = { value: new THREE.Color(color) };
    shader.uniforms.uRimStrength = { value: strength };
    shader.uniforms.uRimPower = { value: power };
    material.userData.shader = shader;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRimColor; uniform float uRimStrength, uRimPower;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float rimF = pow(1.0 - saturate(dot(normalize(vNormal), normalize(vViewPosition))), uRimPower);
        totalEmissiveRadiance += uRimColor * rimF * uRimStrength;`);
  };
  return material;
}
