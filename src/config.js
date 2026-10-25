// Central settings. Tweak gameplay feel here.
const params = new URLSearchParams(location.search);

export const CONFIG = {
  // In-app purchase SKU (must match the SKU you create in the Meta Developer Dashboard)
  PRO_SKU: 'punchpulse_pro',

  // ?dev=1 unlocks Pro content when testing in a normal browser
  DEV_UNLOCK: params.has('dev'),

  // ?test=1 lets any glove movement count as a punch (easier in the emulator)
  TEST_MODE: params.has('test'),

  // Punch must be at least this fast (metres/second) to count
  MIN_PUNCH_SPEED: 1.2,
  DESKTOP_MIN_PUNCH_SPEED: 0.6,

  // Targets
  TARGET_RADIUS: 0.13,
  HIT_RADIUS: 0.2,         // target radius + glove reach tolerance
  TARGET_SPEED: 7,         // metres/second toward player
  SPAWN_DISTANCE: 14,      // metres in front of hit plane
  HIT_PLANE_Z: -0.55,      // where targets are on the beat (arm's length)
  MISS_Z: 0.25,            // passed the player = miss
  LANE_HALF_WIDTH: 0.22,   // left/right offset from centre

  // Workouts (minutes). `pro: true` needs the Pro unlock.
  DURATIONS: [
    { minutes: 3, pro: false },
    { minutes: 5, pro: false },
    { minutes: 10, pro: true },
  ],
};

export const COLORS = {
  left: 0xff3b5c,
  right: 0x4da3ff,
  accent: 0x00e5ff,
  magenta: 0xff2bd6,
  bg: 0x05060f,
};

export const CSS = {
  left: '#ff3b5c',
  right: '#4da3ff',
  accent: '#00e5ff',
  magenta: '#ff2bd6',
  text: '#eaf2ff',
  dim: '#7f8db3',
  panel: 'rgba(8,12,30,0.88)',
};
