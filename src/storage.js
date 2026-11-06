// Local save (localStorage). v2 adds settings, history, streaks, programs, achievements.
const KEY = 'punchpulse_v2';
const OLD_KEY = 'punchpulse_v1';

function readJSON(key) {
  try { return JSON.parse(localStorage.getItem(key)) || null; } catch { return null; }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* storage unavailable */ }
}

// Local calendar date as YYYY-MM-DD (so streaks follow the player's own midnight)
export function dateKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function daysBetween(a, b) {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000);
}

const DEFAULTS = {
  version: 2,
  pro: false,
  settings: { difficulty: 'normal', posture: 'standing', mode: 'vr', theme: 'synthwave', tutorialDone: false },
  best: {},               // "mode_minutes_track_difficulty" -> score
  totals: { workouts: 0, kcal: 0, punches: 0, uppercuts: 0, blocks: 0, dodges: 0, perfects: 0, maxCombo: 0, seconds: 0 },
  history: {},            // "YYYY-MM-DD" -> { kcal, workouts, seconds }
  streak: { count: 0, last: null, best: 0 },
  daily: {},              // "YYYY-MM-DD" -> best daily-challenge score
  programs: {},           // programId -> sessions completed
  achievements: {},       // id -> unlock timestamp
  tracksPlayed: {},       // trackId -> true
};

function merge(base, extra) {
  const out = structuredClone(base);
  for (const k of Object.keys(extra || {})) {
    if (out[k] && typeof out[k] === 'object' && !Array.isArray(out[k]) && typeof extra[k] === 'object') {
      out[k] = { ...out[k], ...extra[k] };
    } else out[k] = extra[k];
  }
  return out;
}

let data = merge(DEFAULTS, readJSON(KEY));
// Migrate v1 saves (scores, lifetime stats, Pro flag)
if (!readJSON(KEY)) {
  const v1 = readJSON(OLD_KEY);
  if (v1) {
    data.pro = !!v1.pro;
    data.totals.workouts = v1.workouts || 0;
    data.totals.kcal = v1.kcal || 0;
    data.totals.punches = v1.punches || 0;
    for (const [k, v] of Object.entries(v1.best || {})) data.best[`vr_${k}_normal`] = v;
    data.settings.tutorialDone = (v1.workouts || 0) > 0;
    save();
  }
}

export const Storage = {
  get settings() { return data.settings; },
  setSetting(key, value) { data.settings[key] = value; save(); },

  bestKey(s) { return `${s.mode}_${s.minutes}_${s.trackId}_${s.difficulty}`; },
  bestFor(s) { return data.best[this.bestKey(s)] || 0; },

  get totals() { return data.totals; },
  get streak() {
    // a streak is broken if the last workout was before yesterday
    const today = dateKey();
    if (data.streak.last && daysBetween(data.streak.last, today) > 1) return { ...data.streak, count: 0 };
    return data.streak;
  },
  get history() { return data.history; },
  get achievements() { return data.achievements; },
  get tracksPlayed() { return data.tracksPlayed; },
  programProgress(id) { return data.programs[id] || 0; },
  dailyBest(day = dateKey()) { return data.daily[day] || 0; },

  /**
   * Save a finished workout. Returns { isBest, streakChanged } for the results screen.
   * session: { mode, minutes, trackId, difficulty, kind: 'quick'|'daily'|'program'|'tutorial', programId }
   * stats:   { score, kcal, punches, uppercuts, blocks, dodges, perfects, maxCombo, seconds }
   */
  recordWorkout(session, stats) {
    const today = dateKey();
    const k = this.bestKey(session);
    const isBest = stats.score > (data.best[k] || 0);
    if (isBest) data.best[k] = stats.score;

    const t = data.totals;
    t.workouts += 1;
    t.kcal += stats.kcal;
    t.punches += stats.punches;
    t.uppercuts += stats.uppercuts;
    t.blocks += stats.blocks;
    t.dodges += stats.dodges;
    t.perfects += stats.perfects;
    t.seconds += stats.seconds;
    t.maxCombo = Math.max(t.maxCombo, stats.maxCombo);

    const h = data.history[today] || { kcal: 0, workouts: 0, seconds: 0 };
    h.kcal += stats.kcal; h.workouts += 1; h.seconds += stats.seconds;
    data.history[today] = h;
    // keep ~90 days of history
    const keys = Object.keys(data.history).sort();
    while (keys.length > 90) delete data.history[keys.shift()];

    let streakChanged = false;
    const s = data.streak;
    if (s.last !== today) {
      s.count = s.last && daysBetween(s.last, today) === 1 ? s.count + 1 : 1;
      s.last = today;
      s.best = Math.max(s.best, s.count);
      streakChanged = true;
    }

    if (session.kind === 'daily') data.daily[today] = Math.max(data.daily[today] || 0, stats.score);
    if (session.kind === 'program' && session.programId) data.programs[session.programId] = (data.programs[session.programId] || 0) + 1;
    data.tracksPlayed[session.trackId] = true;

    save();
    return { isBest, streakChanged };
  },

  unlockAchievement(id) {
    if (data.achievements[id]) return false;
    data.achievements[id] = Date.now();
    save();
    return true;
  },

  resetProgram(id) { data.programs[id] = 0; save(); },

  get proCached() { return !!data.pro; },
  set proCached(v) { data.pro = !!v; save(); },
};
