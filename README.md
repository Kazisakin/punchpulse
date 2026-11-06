# PunchPulse

Rhythm boxing workout for Meta Quest. Punch, uppercut, block and dodge targets that arrive on the beat. Works with hand tracking or controllers, in VR or mixed reality.

**Play:** https://kazisakin.github.io/punchpulse/ (open in the Quest browser, or on desktop for a mouse preview)

Built with WebXR and Three.js, no game engine. The whole game is static files, so there's no backend: it's hosted on GitHub Pages and packaged for the Meta Horizon Store as a PWA.

## Features
- Hand tracking: punches are detected from the knuckle joints using velocity, with filtering for tracking glitches
- Controllers and hands can be swapped mid-session
- Mixed reality mode (passthrough) and a seated mode
- Music is generated at runtime with the Web Audio API: 6 phonk tracks, no audio files
- Target charts are generated from a seed and locked to the BPM, so the daily challenge is the same for everyone
- Daily challenge, streaks, workout programs, achievements, stats
- One-time Pro unlock through Meta's Digital Goods API
- Works offline (service worker), progress saved locally

## Running locally
```
npx serve .
```
Open http://localhost:3000. Click "Desktop preview" to play with the mouse (click or Space to punch).

For headset testing without a Quest, the Immersive Web Emulator extension works.

## Code
```
src/
  main.js         scene setup, menus, game loop, XR session handling
  gloves.js       controller/hand input, glove models, punch velocity
  targets.js      target pools and hit detection
  chart.js        seeded chart generator
  audio.js        procedural music and sound effects
  arena.js        environment, themes, MR toggle
  ui.js           canvas-based world-space UI
  effects.js      hit particles and popups
  progression.js  programs, daily challenge, achievements
  storage.js      local save data
  iap.js          in-app purchase
  config.js       tuning values
sw.js             offline cache
```

Three.js r160 is vendored in `vendor/` so the app has no runtime dependencies.

## Performance
Targets 72 fps on Quest 2: unlit shaders, pooled objects (no allocations during play), instanced meshes for particles, and fake glow with sprites instead of post-processing.
