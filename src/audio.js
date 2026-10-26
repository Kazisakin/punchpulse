// All sound is generated in code with the Web Audio API:
// no music files, no licensing issues, tiny download, works offline.

export const TRACKS = [
  {
    id: 'warmup', name: 'Neon Warmup', bpm: 104, pro: false,
    root: 45, // A2
    scale: [0, 3, 5, 7, 10],
    kick:  'x...x...x...x...',
    snare: '....x.......x...',
    hat:   '..x...x...x...x.',
    bass:  [0, 0, 7, 0, 5, 5, 3, 3],
  },
  {
    id: 'drive', name: 'Pulse Drive', bpm: 120, pro: false,
    root: 40, // E2
    scale: [0, 2, 3, 7, 10],
    kick:  'x...x...x...x...',
    snare: '....x.......x...',
    hat:   'x.x.x.x.x.x.x.x.',
    bass:  [0, 0, 12, 0, 10, 10, 7, 3],
  },
  {
    id: 'overdrive', name: 'Overdrive', bpm: 140, pro: true,
    root: 38, // D2
    scale: [0, 1, 5, 7, 8],
    kick:  'x..x..x.x...x..x',
    snare: '....x.......x..x',
    hat:   'xxxxxxxxxxxxxxxx',
    bass:  [0, 12, 0, 7, 0, 8, 7, 5],
  },
];

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
      this.master.gain.value = 0.8;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master.connect(comp).connect(this.ctx.destination);

      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.55;
      this.musicBus.connect(this.master);

      // Analyser drives the music-reactive equalizer bars
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.6;
      this.musicBus.connect(this.analyser);
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
    const intro = bar < 2;
    if (tr.kick[s] === 'x') this.kick(t);
    if (!intro && tr.snare[s] === 'x') this.snare(t);
    if (tr.hat[s] === 'x') this.hat(t, s % 4 === 2 ? 0.16 : 0.09);
    if (!intro && s % 2 === 0) {
      const note = tr.bass[(s / 2) % tr.bass.length];
      this.bass(t, midiToHz(tr.root + note), stepDur * 1.8);
    }
    // Arpeggio lead from bar 4 onward, varies every 4 bars
    if (bar >= 4 && s % 2 === 1) {
      const phrase = Math.floor(bar / 4) % 3;
      const idx = (s + phrase * 3 + bar) % tr.scale.length;
      const octave = (s % 8 === 7) ? 24 : 12;
      this.lead(t, midiToHz(tr.root + 12 + tr.scale[idx] + octave), stepDur * 0.9);
    }
  }

  // ---------- instruments ----------
  kick(t) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(g).connect(this.musicBus);
    o.start(t); o.stop(t + 0.36);
  }

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

  snare(t) {
    this._noise(t, 0.18, 'bandpass', 1800, 0.7);
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'triangle'; o.frequency.value = 190;
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(g).connect(this.musicBus);
    o.start(t); o.stop(t + 0.11);
  }

  hat(t, vol) { this._noise(t, 0.05, 'highpass', 8000, vol); }

  bass(t, hz, dur) {
    const o = this.ctx.createOscillator();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = hz;
    f.type = 'lowpass'; f.Q.value = 6;
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(140, t + dur);
    g.gain.setValueAtTime(0.32, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(f).connect(g).connect(this.musicBus);
    o.start(t); o.stop(t + dur + 0.02);
  }

  lead(t, hz, dur) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'square'; o.frequency.value = hz;
    g.gain.setValueAtTime(0.045, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.musicBus);
    o.start(t); o.stop(t + dur + 0.02);
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
