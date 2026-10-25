// High scores and lifetime stats, saved on the headset only (no server, no account).
const KEY = 'punchpulse_v1';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
function save(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* storage unavailable */ }
}

const data = Object.assign({ best: {}, workouts: 0, kcal: 0, punches: 0, pro: false }, load());

export const Storage = {
  bestFor(minutes, trackId) { return data.best[`${minutes}_${trackId}`] || 0; },

  // Returns true if this is a new best
  recordWorkout(minutes, trackId, score, kcal, punches) {
    const k = `${minutes}_${trackId}`;
    const isBest = score > (data.best[k] || 0);
    if (isBest) data.best[k] = score;
    data.workouts += 1;
    data.kcal += kcal;
    data.punches += punches;
    save(data);
    return isBest;
  },

  get lifetime() { return { workouts: data.workouts, kcal: Math.round(data.kcal), punches: data.punches }; },

  get proCached() { return !!data.pro; },
  set proCached(v) { data.pro = !!v; save(data); },
};
