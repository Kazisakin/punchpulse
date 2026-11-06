// Central settings. Tweak gameplay feel here.
const params = new URLSearchParams(location.search);

export const CONFIG = {
  // In-app purchase SKU (must match the SKU in the Meta Developer Dashboard)
  PRO_SKU: 'punchpulse_pro',

  // ?dev=1 unlocks Pro content when testing in a normal browser
  DEV_UNLOCK: params.has('dev'),
  // ?test=1 lets any glove movement count as a punch (easier in the emulator)
  TEST_MODE: params.has('test'),

  // Minimum punch speed (metres/second). Hand tracking is a little smoother/slower
  // than controller tracking, so it gets a slightly lower threshold.
  MIN_PUNCH_SPEED: 1.2,
  HAND_MIN_PUNCH_SPEED: 0.95,
  DESKTOP_MIN_PUNCH_SPEED: 0.6,
  // Uppercuts must travel upward at least this fast
  UPPERCUT_MIN_UP_SPEED: 0.7,
  // Buttons only press when the fist/finger moves forward (stops accidental presses)
  BUTTON_PRESS_MIN_FORWARD: 0.25,

  // Targets
  TARGET_RADIUS: 0.13,
  HIT_RADIUS: 0.2,
  SPAWN_DISTANCE: 14,      // metres in front of the hit plane
  HIT_PLANE_Z: -0.55,      // where targets are on the beat (arm's length)
  MISS_Z: 0.25,            // passed the player = miss
  LANE_HALF_WIDTH: 0.22,
  // Dodge walls are judged when they reach the player's head
  WALL_JUDGE_Z: 0.0,
  DUCK_DEPTH: 0.22,        // head must drop this far below standing height
  LEAN_DISTANCE: 0.17,     // head must move this far sideways

  DURATIONS: [
    { minutes: 3, pro: false },
    { minutes: 5, pro: false },
    { minutes: 10, pro: true },
  ],
};

// speed in m/s, density = notes per beat, upper/block/wall = chance per beat, hitBonus = extra radius
export const DIFFICULTIES = [
  { id: 'easy',   name: 'EASY',   pro: false, speed: 5.5, density: 0.55, doubles: 0.0,  upper: 0.06, block: 0.03, wall: 0.035, hitBonus: 0.05 },
  { id: 'normal', name: 'NORMAL', pro: false, speed: 7.0, density: 0.8,  doubles: 0.25, upper: 0.10, block: 0.05, wall: 0.06,  hitBonus: 0.02 },
  { id: 'hard',   name: 'HARD',   pro: false, speed: 8.5, density: 0.95, doubles: 0.45, upper: 0.14, block: 0.06, wall: 0.08,  hitBonus: 0.0 },
  { id: 'expert', name: 'EXPERT', pro: true,  speed: 10,  density: 1.0,  doubles: 0.7,  upper: 0.17, block: 0.07, wall: 0.1,   hitBonus: -0.02 },
];
export const difficultyById = (id) => DIFFICULTIES.find((d) => d.id === id) || DIFFICULTIES[1];

export const THEMES = [
  { id: 'synthwave', name: 'SYNTHWAVE', pro: false },
  { id: 'ocean',     name: 'OCEAN',     pro: true },
  { id: 'space',     name: 'DEEP SPACE', pro: true },
];

export const COLORS = {
  left: 0xf2506b,
  right: 0x5a9ef0,
  accent: 0x2fd3e8,
  magenta: 0xe04cc6,
  block: 0xad8cf0,
  wall: 0xf2a444,
  gold: 0xf2cc55,
  bg: 0x05060f,
};

export const CSS = {
  left: '#f2506b',
  right: '#5a9ef0',
  accent: '#2fd3e8',
  magenta: '#e04cc6',
  green: '#4fe39a',
  gold: '#f2cc55',
  orange: '#f2a444',
  violet: '#ad8cf0',
  text: '#eaf2ff',
  dim: '#7f8db3',
  panel: 'rgba(8,12,30,0.88)',
};
