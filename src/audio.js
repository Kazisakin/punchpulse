// All sound is generated in code with the Web Audio API:
// no music files, no licensing issues, tiny download, works offline.
//
// The soundtrack is ORIGINAL phonk-style music (not copies of any real songs): an 808 cowbell
// hook drenched in reverb, a distorted 808 bass that slides between notes, hard kicks with
// sidechain "pump", claps, fast hi-hat rolls and (on the harder tracks) a gritty drift lead.
//
// Notation (4 bars = 64 sixteenth-steps):
//   seq('0 . 3 . | ...')  -> semitones above the root ('.' = rest, '|' is just a bar marker)
//   hits('0@0 3@10 | ...') -> 808 notes: note@step within each bar
// cowA plays for 8 bars, then cowB (the variation) for 8 bars, and so on.
const seq = (str) => {
  const out = str.split(/[\s|]+/).filter(Boolean).map((t) => (t === '.' ? null : Number(t)));
  while (out.length < 64) out.push(null);
  return out;
};
const hits = (str) => {
  const out = new Array(64).fill(null);
  str.split('|').forEach((bar, b) => bar.trim().split(/\s+/).filter(Boolean).forEach((h) => {
    const [n, st] = h.split('@').map(Number);
    out[b * 16 + st] = n;
  }));
  return out;
};

export const TRACKS = [
  {
    id: 'warmup', name: 'Night Shift', bpm: 125, pro: false,
    root: 42, // F#
    kick:  'x.....x...x.....',
    clap:  '....x.......x...',
    hat:   'x.x.x.x.x.x.x.xx',
    cowA: seq('0 . 0 . 3 . 0 . 7 . 5 . 3 . 1 . | 0 . 0 . 3 . 0 . -2 . . . 0 . . . | 0 . 0 . 3 . 0 . 7 . 8 . 7 . 5 . | 3 . 1 . 0 . . . -2 . 0 . . . . .'),
    cowB: seq('12 . 10 . 8 . 7 . 8 . 7 . 5 . 3 . | 5 . 3 . 1 . 0 . 1 . 3 . 0 . . . | 12 . 10 . 8 . 7 . 8 . 10 . 12 . 13 . | 12 . 10 . 8 . 7 . 5 . 3 . 0 . . .'),
    b808: hits('0@0 0@6 3@10 | -2@0 -2@10 | 0@0 0@6 3@10 | 1@0 1@10 -2@14'),
  },
  {
    id: 'drive', name: 'Redline Rush', bpm: 130, pro: false,
    root: 40, // E
    kick:  'x..x..x...x..x..',
    clap:  '....x.......x...',
    hat:   'xx.xxx.xxx.xxx.x',
    cowA: seq('7 7 . 7 . 5 . 3 . 5 . 7 . . 3 . | 1 . 1 . 3 . 1 . 0 . . . . . . . | 7 7 . 7 . 5 . 3 . 5 . 7 . 8 . 7 | 5 . 3 . 1 . 0 . 1 . 3 . 0 . . .'),
    cowB: seq('12 . 12 . 13 . 12 . 10 . 8 . 7 . 8 . | 7 . 5 . 3 . 5 . 7 . . . . . . . | 12 . 12 . 15 . 13 . 12 . 10 . 8 . 10 . | 12 . 8 . 7 . 5 . 3 . 1 . 0 . . .'),
    b808: hits('0@0 0@3 0@6 3@10 | 1@0 1@6 -2@10 | 0@0 0@3 0@6 5@10 | 3@0 1@8 0@12'),
  },
  {
    id: 'chill', name: 'Smoke & Chrome', bpm: 118, pro: false,
    root: 43, // G
    kick:  'x.......x.x.....',
    clap:  '........x.......',
    hat:   'x.x.x.xxx.x.x.xx',
    cowA: seq('0 . . 0 . . 3 . . 5 . . 3 . . . | 1 . . 0 . . -2 . . 0 . . . . . . | 0 . . 0 . . 3 . . 7 . . 5 . 3 . | 1 . 0 . -2 . 0 . . . . . . . . .'),
    cowB: seq('12 . . 10 . . 8 . . 7 . . 8 . . . | 10 . . 8 . . 7 . . 5 . . 3 . . . | 12 . . 10 . . 8 . . 12 . . 15 . 13 . | 12 . 10 . 8 . 7 . . . . . . . . .'),
    b808: hits('0@0 0@10 | -4@0 -2@8 | 0@0 0@10 3@14 | -5@0 -2@8'),
    pad: true,
  },
  {
    id: 'overdrive', name: 'Gear Grinder', bpm: 140, pro: true,
    root: 38, // D
    kick:  'x..x..x.x..x..x.',
    clap:  '....x.......x...',
    hat:   'xxxxxxxxxxxxxxxx',
    cowA: seq('0 0 3 0 1 0 . 0 0 0 3 0 5 3 1 . | 0 0 3 0 1 0 . 0 -2 . -2 . 0 . . . | 0 0 3 0 1 0 . 0 0 0 3 0 7 5 3 . | 8 7 5 3 1 . 0 . -2 . 0 . . . . .'),
    cowB: seq('12 12 15 12 13 12 . 12 12 12 15 12 17 15 13 . | 12 12 15 12 13 12 . 12 10 . 10 . 12 . . . | 12 12 15 12 13 12 . 12 12 12 15 12 19 17 15 . | 20 19 17 15 13 . 12 . 10 . 12 . . . . .'),
    b808: hits('0@0 0@3 1@6 0@10 0@13 | 0@0 0@3 -2@8 -2@10 | 0@0 0@3 1@6 0@10 0@13 | 3@0 1@4 0@8 -2@12'),
    lead: true,
  },
  {
    id: 'sunset', name: 'Afterburn', bpm: 135, pro: true,
    root: 41, // F
    kick:  'x.....x.x.......',
    clap:  '....x.......x...',
    hat:   'x.xxx.x.x.xxx.xx',
    cowA: seq('7 . 5 . 3 . 5 . 7 . . 10 . 8 7 . | 5 . 3 . 1 . 3 . 0 . . . . . . . | 7 . 5 . 3 . 5 . 7 . . 10 . 12 10 . | 8 . 7 . 5 . 3 . 1 . 0 . . . . .'),
    cowB: seq('15 . 12 . 10 . 12 . 15 . . 17 . 15 13 . | 12 . 10 . 8 . 10 . 7 . . . . . . . | 15 . 12 . 10 . 12 . 15 . . 19 . 17 15 . | 13 . 12 . 10 . 8 . 7 . 5 . . . . .'),
    b808: hits('0@0 0@6 0@8 | -4@0 -4@6 -2@8 | 0@0 0@6 3@8 | -2@0 1@8 0@12'),
    pad: true, lead: true,
  },
  {
    id: 'thunder', name: 'Baile Thunder', bpm: 150, pro: true,
    root: 36, // C
    kick:  'x..x..x.x..x..x.',
    clap:  '....x..x....x..x',
    hat:   'xxxxxxxxxxxxxxxx',
    cowA: seq('12 . 12 . 13 . 12 10 . 8 . 7 . 8 . . | 12 . 12 . 15 . 13 12 . 10 . 8 7 . . . | 12 . 12 . 13 . 12 10 . 8 . 7 . 5 . 7 | 8 . 7 . 5 . 3 . 1 . 0 . . . . .'),
    cowB: seq('0 0 . 0 0 . 3 . 0 0 . 0 1 . 0 . | 0 0 . 0 0 . 3 . 5 . 3 . 1 . 0 . | 0 0 . 0 0 . 3 . 0 0 . 0 1 . 0 . | 7 . 5 . 3 . 1 . 0 . . . -2 . . .'),
    b808: hits('0@0 0@3 0@6 1@8 0@11 0@14 | 0@0 0@3 3@6 1@8 0@11 | 0@0 0@3 0@6 1@8 0@11 0@14 | -2@0 -2@3 0@8 1@12'),
    lead: true,
  },
];
export const trackById = (id) => TRACKS.find((t) => t.id === id) || TRACKS[0];

const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.track = null;
    this.playing = false;
    this.startTime = 0;
    this.nextStep = 0;
    this.timer = null;
  }

  // Must be called from a user gesture (click / Enter VR)
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.72;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 6;
      comp.ratio.value = 12;          // acts as a limiter so the loud phonk tracks never clip
      comp.attack.value = 0.002;
      comp.release.value = 0.15;
      this.master.connect(comp).connect(this.ctx.destination);

      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.55;
      this.musicBus.connect(this.master);

      // Analyser drives the music-reactive equalizer bars
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.6;
      this.musicBus.connect(this.analyser);

      // 808 bus: soft-clip distortion + lowpass for that saturated phonk bass
      this.bassBus = this.ctx.createGain();
      this.bassBus.gain.value = 0.62;
      const shaper = this.ctx.createWaveShaper();
      const curve = new Float32Array(1024);
      for (let i = 0; i < curve.length; i++) { const x = (i / (curve.length - 1)) * 2 - 1; curve[i] = Math.tanh(x * 3.2) / Math.tanh(3.2); }
      shaper.curve = curve;
      shaper.oversample = '2x';
      this.bassFilter = this.ctx.createBiquadFilter();
      this.bassFilter.type = 'lowpass';
      this.bassFilter.frequency.value = 1400;
      this.bassBus.connect(shaper).connect(this.bassFilter).connect(this.musicBus);

      // "pump" bus: melody, pads and hats duck on every kick (sidechain feel)
      this.pumpBus = this.ctx.createGain();
      this.pumpBus.connect(this.musicBus);
      // reverb send (generated impulse response, ~1.6 s dark hall) for the cowbell and lead
      this.reverb = this.ctx.createConvolver();
      const irLen = Math.floor(this.ctx.sampleRate * 1.6);
      const ir = this.ctx.createBuffer(2, irLen, this.ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        for (let i = 0; i < irLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 3);
      }
      this.reverb.buffer = ir;
      this.reverbSend = this.ctx.createGain();
      this.reverbSend.gain.value = 0.32;
      const verbTone = this.ctx.createBiquadFilter();
      verbTone.type = 'lowpass'; verbTone.frequency.value = 3200;
      this.reverbSend.connect(this.reverb).connect(verbTone).connect(this.pumpBus);
      this.spectrumData = new Uint8Array(this.analyser.frequencyBinCount);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 0.9;
      this.sfxBus.connect(this.master);

      // 1 second of white noise, reused by drums and effects
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  // Seconds since the music started (the game clock)
  get songTime() { return this.playing ? this.ctx.currentTime - this.startTime : 0; }

  get secondsPerBeat() { return this.track ? 60 / this.track.bpm : 0.5; }

  // Current music frequency levels (0..255 per bin), or null when silent
  spectrum() {
    if (!this.analyser || !this.playing) return null;
    this.analyser.getByteFrequencyData(this.spectrumData);
    return this.spectrumData;
  }

  start(track, delay = 0.1) {
    this.unlock();
    this.stop();
    this.track = track;
    this.playing = true;
    this.startTime = this.ctx.currentTime + delay;
    this.nextStep = 0;
    this.last808 = 0;
    this.pumpBus.gain.cancelScheduledValues(0);
    this.pumpBus.gain.value = 1;
    this.timer = setInterval(() => this._schedule(), 25);
    this._schedule();
  }

  stop() {
    this.playing = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  pause() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  // Look-ahead scheduler: books notes ~120ms in advance for tight timing
  _schedule() {
    if (!this.playing) return;
    const stepDur = this.secondsPerBeat / 4; // 16th notes
    const horizon = this.ctx.currentTime + 0.12;
    while (this.startTime + this.nextStep * stepDur < horizon) {
      this._playStep(this.nextStep, this.startTime + this.nextStep * stepDur, stepDur);
      this.nextStep++;
    }
  }

  _playStep(step, t, stepDur) {
    const tr = this.track;
    const s = step % 16;
    const bar = Math.floor(step / 16);
    const s64 = step % 64;
    const intro = bar < 2;                             // hook + hats first, then the drop
    const breakdown = bar % 16 === 15;                 // one stripped-back bar every 16
    const fill = bar % 4 === 3;                        // hi-hat roll + extra kick at the end of every 4 bars
    const sectionB = !intro && Math.floor(bar / 8) % 2 === 1;

    if (!intro && !breakdown && tr.kick[s] === 'x') { this.kick(t); this.pump(t); }
    if (!intro && !breakdown && fill && s === 14) { this.kick(t); this.pump(t); }
    if (!intro && tr.clap[s] === 'x') this.clap(t);
    if (fill && s >= 12) {
      for (let r = 0; r < 3; r++) this.hat(t + (r * stepDur) / 3, 0.06 + r * 0.02);
    } else if (tr.hat[s] === 'x') this.hat(t, s % 4 === 2 ? 0.12 : 0.07);
    if (!intro && s % 8 === 4) this.openHat(t);

    // distorted 808 that slides into each new note and rings until the next one
    const bn = tr.b808[s64];
    if (!intro && bn !== null) {
      let len = 1;
      while (len < 12 && tr.b808[(s64 + len) % 64] === null) len++;
      this.bass808(t, midiToHz(tr.root + bn), stepDur * len * (breakdown ? 0.5 : 1));
    }
    // cowbell hook (A for 8 bars, then the B variation)
    const cn = (sectionB ? tr.cowB : tr.cowA)[s64];
    if (cn !== null) {
      this.cowbell(t, midiToHz(tr.root + 36 + cn), breakdown ? 0.07 : 0.1);
      if (tr.lead && sectionB && !breakdown) this.lead(t, midiToHz(tr.root + 24 + cn), stepDur * 1.6);
    }
    if (tr.pad && s === 0 && bar % 2 === 0) {
      const shift = [0, -4, -2, -5][Math.floor(bar / 2) % 4];
      [0, 3, 7].forEach((n) => this.pad(t, midiToHz(tr.root + 24 + n + shift), stepDur * 31));
    }
  }

  // sidechain: dip the melody bus on the kick and let it swell back
  pump(t) {
    const g = this.pumpBus.gain;
    g.setValueAtTime(0.45, t);
    g.linearRampToValueAtTime(1, t + 0.18);
  }

  // ---------- instruments ----------
  kick(t) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(190, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.09);
    g.gain.setValueAtTime(0.95, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    o.connect(g).connect(this.musicBus);
    o.start(t); o.stop(t + 0.3);
    this._noise(t, 0.012, 'highpass', 3000, 0.35); // click
  }

  bass808(t, hz, dur) {
    dur = Math.max(0.18, Math.min(dur, 1.6));
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    const from = this.last808 || hz;
    if (Math.abs(from - hz) > 1) {                    // new note: glide from the last one (the phonk "slide")
      o.frequency.setValueAtTime(from, t);
      o.frequency.exponentialRampToValueAtTime(hz, t + 0.08);
    } else {                                           // same note: a punchy pitch drop
      o.frequency.setValueAtTime(hz * 2, t);
      o.frequency.exponentialRampToValueAtTime(hz, t + 0.03);
    }
    this.last808 = hz;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.9, t + 0.006);
    g.gain.setValueAtTime(0.9, t + dur * 0.55);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.bassBus);
    o.start(t); o.stop(t + dur + 0.02);
  }

  // TR-808 style cowbell: two detuned square waves through a band-pass, sharp decay
  cowbell(t, hz, vol = 0.11) {
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = hz * 1.5; bp.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(vol * 0.35, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    for (const ratio of [1, 1.48]) {
      const o = this.ctx.createOscillator();
      o.type = 'square'; o.frequency.value = hz * ratio;
      o.connect(bp);
      o.start(t); o.stop(t + 0.3);
    }
    bp.connect(g);
    g.connect(this.pumpBus);
    g.connect(this.reverbSend);
  }

  // gritty "drift" lead: two detuned saws through a resonant low-pass, doubles the hook
  lead(t, hz, dur) {
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.Q.value = 5;
    f.frequency.setValueAtTime(2600, t);
    f.frequency.exponentialRampToValueAtTime(700, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    for (const det of [-12, 12]) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = hz; o.detune.value = det;
      o.connect(f);
      o.start(t); o.stop(t + dur + 0.02);
    }
    f.connect(g);
    g.connect(this.pumpBus);
    g.connect(this.reverbSend);
  }

  clap(t) {
    // three quick noise bursts + a tail = hand clap
    for (let i = 0; i < 3; i++) this._noise(t + i * 0.011, 0.03, 'bandpass', 1500, 0.55);
    this._noise(t + 0.033, 0.16, 'bandpass', 1200, 0.5);
  }

  openHat(t) { this._noise(t, 0.16, 'highpass', 7000, 0.06, this.pumpBus); }

  _noise(t, dur, type, freq, vol, bus) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(bus || this.musicBus);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.01);
  }

  hat(t, vol) { this._noise(t, 0.05, 'highpass', 8000, vol, this.pumpBus); }

  pad(t, hz, dur) {
    const o = this.ctx.createOscillator();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = hz; o.detune.value = (Math.random() - 0.5) * 14;
    f.type = 'lowpass'; f.frequency.value = 1100;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.03, t + dur * 0.2);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(this.pumpBus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // ---------- sound effects ----------
  sfxHit(strength = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._noise(t, 0.12, 'lowpass', 2500, 0.6 * strength, this.sfxBus);
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(520 + 200 * strength, t);
    o.frequency.exponentialRampToValueAtTime(180, t + 0.12);
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.connect(g).connect(this.sfxBus);
    o.start(t); o.stop(t + 0.16);
  }

  sfxMiss() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.2);
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g).connect(this.sfxBus);
    o.start(t); o.stop(t + 0.23);
  }

  sfxClick() { this.beep(880, 0.06, 0.2); }

  sfxDodge() { this.beep(660, 0.08, 0.18); setTimeout(() => this.beep(990, 0.1, 0.16), 70); }

  sfxBlock() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._noise(t, 0.2, 'bandpass', 600, 0.6, this.sfxBus);
    this.beep(220, 0.18, 0.25);
  }

  sfxOuch() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._noise(t, 0.25, 'lowpass', 400, 0.7, this.sfxBus);
    this.beep(110, 0.25, 0.3);
  }

  sfxAchievement() {
    [784, 988, 1175, 1568].forEach((hz, i) => setTimeout(() => this.beep(hz, 0.18, 0.18), i * 90));
  }

  beep(hz, dur = 0.12, vol = 0.25) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'triangle'; o.frequency.value = hz;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.sfxBus);
    o.start(t); o.stop(t + dur + 0.01);
  }
}
