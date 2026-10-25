# PunchPulse

A neon rhythm punch workout for Meta Quest, built with WebXR and Three.js. It runs fully offline, needs no server and has no accounts.

## Run locally
```
npx serve .
```
Then open http://localhost:3000/?dev=1 in Chrome.

| URL option | What it does |
|---|---|
| `?dev=1` | Unlocks Pro content for testing |
| `&test=1` | Any glove touch counts as a punch (easier in the emulator) |

To release the game, see **RELEASE_GUIDE.md**.

## How it plays
- Red targets are for the left hand and blue targets are for the right, arriving on the beat.
- Score = (100 + on-beat bonus + power bonus) × combo multiplier, up to ×4.
- 3- and 5-minute workouts are free; 10-minute workouts and the Overdrive track are Pro (in-app purchase).
- The game pauses automatically when the Meta menu opens or the headset comes off.

## Files
```
index.html            page + Enter VR overlay
manifest.webmanifest  app info for packaging
sw.js                 offline cache (bump VERSION on each update)
privacy.html          privacy policy (host it with the game)
vendor/               Three.js r160 (MIT licence), stored locally so the game works offline
icons/                app icons
store/                store art, screenshots, listing text
src/
  config.js    gameplay settings: punch speed, target speed, durations, Pro SKU
  main.js      screens, game loop, input, pause handling, boot
  arena.js     neon arena
  gloves.js    controller gloves, speed tracking, haptics, mouse glove
  targets.js   pooled targets, spawning, hit detection
  chart.js     beat-locked target patterns
  audio.js     generated music and sound effects (no audio files)
  effects.js   hit particles and shockwaves
  ui.js        in-world buttons and panels
  storage.js   high scores and stats (saved on the device)
  iap.js       Pro unlock through Meta's Digital Goods API
```

## Status
- [x] Phase 1–2: setup and scene
- [x] Phase 3: gameplay
- [x] Phase 4: game flow, music, high scores
- [x] Phase 5: pause handling, performance, offline support, privacy policy
- [x] Store art and listing text
- [ ] Phase 6: deploy and test on a Quest (see RELEASE_GUIDE.md)
- [ ] Phase 7: package and submit (see RELEASE_GUIDE.md)
