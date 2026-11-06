// Workout programs, the daily challenge and achievements.
import { TRACKS, trackById } from './audio.js';
import { difficultyById } from './config.js';
import { Storage, dateKey } from './storage.js';

// Programs
const S = (track, minutes, difficulty) => ({ track, minutes, difficulty });

export const PROGRAMS = [
  {
    id: 'starter', name: '7-DAY STARTER', pro: false,
    blurb: 'Learn the moves and build the habit',
    sessions: [
      S('warmup', 3, 'easy'), S('chill', 3, 'easy'), S('warmup', 3, 'normal'), S('drive', 3, 'easy'),
      S('chill', 5, 'normal'), S('drive', 3, 'normal'), S('warmup', 5, 'normal'),
    ],
  },
  {
    id: 'cardio', name: 'CARDIO BLAST', pro: true,
    blurb: '10 sessions to push your endurance',
    sessions: [
      S('drive', 5, 'normal'), S('sunset', 5, 'normal'), S('chill', 5, 'hard'), S('overdrive', 5, 'normal'),
      S('drive', 5, 'hard'), S('sunset', 5, 'hard'), S('warmup', 10, 'normal'), S('overdrive', 5, 'hard'),
      S('sunset', 10, 'normal'), S('thunder', 5, 'hard'),
    ],
  },
  {
    id: 'fightcamp', name: 'FIGHT CAMP', pro: true,
    blurb: '14 sessions — expert speed and power',
    sessions: [
      S('overdrive', 5, 'hard'), S('thunder', 5, 'hard'), S('sunset', 5, 'hard'), S('drive', 10, 'hard'),
      S('overdrive', 5, 'expert'), S('thunder', 5, 'hard'), S('sunset', 10, 'hard'), S('overdrive', 10, 'hard'),
      S('thunder', 5, 'expert'), S('drive', 10, 'expert'), S('sunset', 5, 'expert'), S('overdrive', 10, 'expert'),
      S('thunder', 10, 'hard'), S('thunder', 10, 'expert'),
    ],
  },
];
export const programById = (id) => PROGRAMS.find((p) => p.id === id);

export function nextProgramSession(program) {
  const done = Storage.programProgress(program.id);
  if (done >= program.sessions.length) return null;
  const s = program.sessions[done];
  return { index: done, track: trackById(s.track), minutes: s.minutes, difficulty: difficultyById(s.difficulty) };
}

// Daily challenge
// Same for everyone on a given day: free tracks only, harder on weekends.
export function dailyChallenge(date = new Date()) {
  const key = dateKey(date);
  const dayNum = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  const free = TRACKS.filter((t) => !t.pro);
  const weekend = date.getDay() === 0 || date.getDay() === 6;
  return {
    key,
    track: free[dayNum % free.length],
    minutes: 3,
    difficulty: difficultyById(weekend ? 'hard' : 'normal'),
    seed: dayNum * 7919,
  };
}

// Achievements
// check(ctx): ctx = { totals, streak, run, session, achievements }
export const ACHIEVEMENTS = [
  { id: 'first',     name: 'First Round',      desc: 'Finish your first workout',        check: (c) => c.totals.workouts >= 1 },
  { id: 'combo25',   name: 'In The Zone',      desc: 'Reach a 25 combo',                  check: (c) => c.run.maxCombo >= 25 },
  { id: 'combo50',   name: 'Unstoppable',      desc: 'Reach a 50 combo',                  check: (c) => c.run.maxCombo >= 50 },
  { id: 'combo100',  name: 'Perfect Rhythm',   desc: 'Reach a 100 combo',                 check: (c) => c.run.maxCombo >= 100 },
  { id: 'perfect20', name: 'Sharpshooter',     desc: '20 PERFECT hits in one workout',    check: (c) => c.run.perfects >= 20 },
  { id: 'punch1k',   name: 'Thousand Fists',   desc: 'Land 1,000 punches in total',       check: (c) => c.totals.punches >= 1000 },
  { id: 'kcal100',   name: 'Calorie Crusher',  desc: 'Burn 100 kcal in total',            check: (c) => c.totals.kcal >= 100 },
  { id: 'dodge25',   name: 'Untouchable',      desc: 'Dodge 25 walls in total',           check: (c) => c.totals.dodges >= 25 },
  { id: 'upper50',   name: 'Uppercut King',    desc: 'Land 50 uppercuts in total',        check: (c) => c.totals.uppercuts >= 50 },
  { id: 'streak3',   name: 'Habit Forming',    desc: 'Work out 3 days in a row',          check: (c) => c.streak.count >= 3 },
  { id: 'streak7',   name: 'One Week Strong',  desc: 'Work out 7 days in a row',          check: (c) => c.streak.count >= 7 },
  { id: 'daily1',    name: 'Daily Contender',  desc: 'Complete a daily challenge',        check: (c) => c.session.kind === 'daily' },
  { id: 'expert',    name: 'Expert Fighter',   desc: 'Finish a workout on EXPERT',        check: (c) => c.session.difficulty === 'expert' && c.run.accuracy >= 50 },
  { id: 'program1',  name: 'Graduate',         desc: 'Complete a workout program',        check: (c) => PROGRAMS.some((p) => Storage.programProgress(p.id) >= p.sessions.length) },
  { id: 'allsongs',  name: 'Music Lover',      desc: 'Play every song',                   check: (c) => TRACKS.every((t) => c.tracksPlayed[t.id]) },
];

// Returns the achievements newly unlocked by this run
export function evaluateAchievements(session, run) {
  const ctx = {
    totals: Storage.totals, streak: Storage.streak, run, session,
    achievements: Storage.achievements, tracksPlayed: Storage.tracksPlayed,
  };
  const unlocked = [];
  for (const a of ACHIEVEMENTS) {
    if (Storage.achievements[a.id]) continue;
    try {
      if (a.check(ctx) && Storage.unlockAchievement(a.id)) unlocked.push(a);
    } catch { /* ignore */ }
  }
  return unlocked;
}
