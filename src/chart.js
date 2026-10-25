// Builds the list of targets ("notes") for a workout, locked to the music's beat.
// Same track + length always gives the same pattern (seeded), so players can improve.
import { CONFIG } from './config.js';

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateChart(track, durationSec) {
  const rand = rng(track.bpm * 1000 + durationSec);
  const spb = 60 / track.bpm;
  const travel = CONFIG.SPAWN_DISTANCE / CONFIG.TARGET_SPEED;
  const notes = [];
  let hand = 'left';
  const endTime = durationSec - 1.5;

  const totalBars = Math.floor(durationSec / (spb * 4));
  for (let bar = 1; bar < totalBars; bar++) {
    const barStart = bar * 4 * spb;
    const p = barStart / durationSec;           // workout progress 0..1
    const restBar = bar % 8 === 7;              // breather every 8 bars
    const warmup = p < 0.12;

    const beats = [];
    if (warmup || restBar) {
      beats.push(0, 2);
    } else {
      beats.push(0, 1, 2, 3);
      // add off-beat doubles as the workout heats up
      if (p > 0.35 && rand() < 0.35 + p * 0.4) beats.push(3.5);
      if (p > 0.6 && rand() < 0.3) beats.push(1.5);
    }
    beats.sort((a, b) => a - b);

    for (const b of beats) {
      const time = barStart + b * spb;
      if (time < travel + 0.3 || time > endTime) continue;

      // Mostly alternate hands, sometimes repeat
      if (rand() > 0.22) hand = hand === 'left' ? 'right' : 'left';
      const side = hand === 'left' ? -1 : 1;

      // Height relative to head: jab (face), body shot (low), high
      const r = rand();
      const yOff = r < 0.6 ? -0.22 : r < 0.82 ? -0.45 : -0.05;
      const x = side * CONFIG.LANE_HALF_WIDTH + (rand() - 0.5) * 0.16;

      notes.push({ time, hand, x, yOff });
    }
  }
  return notes;
}
