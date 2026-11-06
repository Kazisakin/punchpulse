// Beat-locked target charts. Seeded, so the daily challenge is the same for everyone.
// Note types:
//   punch  - normal target for one hand (hand: 'left' | 'right')
//   upper  - uppercut: must be hit with an upward punch
//   block  - guard: both fists up in front of the face as it arrives (hand: 'both')
//   duck   - horizontal wall at head height: duck under it (standing only)
//   leanL / leanR - side wall: lean your head left / right (standing only)
import { CONFIG } from './config.js';

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const isWall = (type) => type === 'duck' || type === 'leanL' || type === 'leanR';

// Time a note must spawn before its beat so it arrives exactly on time
export function travelTime(note, speed) {
  const judgeZ = isWall(note.type) ? CONFIG.WALL_JUDGE_Z : CONFIG.HIT_PLANE_Z;
  return (CONFIG.SPAWN_DISTANCE + (judgeZ - CONFIG.HIT_PLANE_Z)) / speed;
}

export function generateChart({ track, durationSec, difficulty, seated = false, seed }) {
  const d = difficulty;
  const rand = rng(seed ?? (track.bpm * 1000 + durationSec + d.speed * 17));
  const spb = 60 / track.bpm;
  const earliest = (CONFIG.SPAWN_DISTANCE + 0.6) / d.speed + 0.3;
  const endTime = durationSec - 1.5;
  const notes = [];
  let hand = 'left';
  let blockedUntil = 0; // no other notes until this time (after walls / blocks)

  const totalBars = Math.floor(durationSec / (spb * 4));
  for (let bar = 1; bar < totalBars; bar++) {
    const barStart = bar * 4 * spb;
    const p = barStart / durationSec;
    const restBar = bar % 8 === 7;
    const warmup = p < 0.1;
    const specialsOn = p > 0.12;

    const beats = [];
    if (warmup || restBar) beats.push(0, 2);
    else {
      beats.push(0, 2);
      if (rand() < d.density) beats.push(1);
      if (rand() < d.density) beats.push(3);
      if (rand() < d.doubles * (0.4 + p)) beats.push(3.5);
      if (rand() < d.doubles * p * 0.7) beats.push(1.5);
    }
    beats.sort((a, b) => a - b);

    for (const b of beats) {
      const time = barStart + b * spb;
      if (time < earliest || time > endTime || time < blockedUntil) continue;

      const r = rand();
      // Dodge walls (standing only, on whole beats)
      if (specialsOn && !seated && Number.isInteger(b) && r < d.wall) {
        const kind = rand();
        const type = kind < 0.4 ? 'duck' : kind < 0.7 ? 'leanL' : 'leanR';
        notes.push({ time, type, hand: 'none', x: 0, yOff: 0 });
        blockedUntil = time + spb * 2;
        continue;
      }
      // Block (both fists up)
      if (specialsOn && Number.isInteger(b) && r < d.wall + d.block) {
        notes.push({ time, type: 'block', hand: 'both', x: 0, yOff: seated ? -0.12 : -0.15 });
        blockedUntil = time + spb * 1.5;
        continue;
      }

      if (rand() > 0.22) hand = hand === 'left' ? 'right' : 'left';
      const side = hand === 'left' ? -1 : 1;
      const isUpper = specialsOn && r < d.wall + d.block + d.upper;

      let yOff, x;
      if (isUpper) {
        yOff = seated ? -0.28 : -0.32;
        x = side * (CONFIG.LANE_HALF_WIDTH * 0.75);
      } else {
        const h = rand();
        if (seated) yOff = h < 0.65 ? -0.18 : h < 0.85 ? -0.3 : -0.06;
        else yOff = h < 0.6 ? -0.22 : h < 0.82 ? -0.45 : -0.05;
        x = side * CONFIG.LANE_HALF_WIDTH + (rand() - 0.5) * (seated ? 0.1 : 0.16);
        // expert: occasional cross-body targets
        if (d.id === 'expert' && rand() < 0.12) x = -x * 0.6;
      }
      notes.push({ time, type: isUpper ? 'upper' : 'punch', hand, x, yOff });
    }
  }
  return notes;
}

// Fixed, slow tutorial: teaches each move once, with spacing for the instructions.
export function tutorialChart({ track, seated }) {
  const spb = 60 / track.bpm;
  const seq = [
    { type: 'punch', hand: 'left' }, { type: 'punch', hand: 'left' },
    { type: 'punch', hand: 'right' }, { type: 'punch', hand: 'right' },
    { type: 'punch', hand: 'left' }, { type: 'punch', hand: 'right' },
    { type: 'upper', hand: 'left' }, { type: 'upper', hand: 'right' },
    { type: 'block', hand: 'both' }, { type: 'block', hand: 'both' },
  ];
  if (!seated) seq.push({ type: 'duck', hand: 'none' }, { type: 'leanL', hand: 'none' }, { type: 'leanR', hand: 'none' });
  const notes = [];
  let beat = 8;
  let prevType = null;
  for (const n of seq) {
    if (n.type !== prevType) beat += 6; // breathing room when the move changes
    const side = n.hand === 'left' ? -1 : 1;
    notes.push({
      time: beat * spb,
      type: n.type,
      hand: n.hand,
      x: n.type === 'punch' ? side * CONFIG.LANE_HALF_WIDTH : n.type === 'upper' ? side * CONFIG.LANE_HALF_WIDTH * 0.75 : 0,
      yOff: n.type === 'upper' ? -0.32 : n.type === 'block' ? -0.15 : n.type === 'punch' ? -0.2 : 0,
    });
    beat += 4;
    prevType = n.type;
  }
  return { notes, duration: (beat + 6) * spb };
}
