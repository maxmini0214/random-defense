/**
 * SoundManager — All sounds generated via Web Audio API (no external assets).
 */

export class SoundManager {
  private ctx: AudioContext | null = null;
  private _muted: boolean = false;
  private masterGain: GainNode | null = null;
  private initialized: boolean = false;

  constructor() {
    // Restore mute state from localStorage
    this._muted = localStorage.getItem('dg_muted') === '1';
  }

  /** Lazy-init AudioContext (must be called after user gesture) */
  private ensureContext(): AudioContext | null {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this._muted ? 0 : 0.3;
        this.masterGain.connect(this.ctx.destination);
        this.initialized = true;
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public get muted(): boolean { return this._muted; }

  public toggleMute(): boolean {
    this._muted = !this._muted;
    localStorage.setItem('dg_muted', this._muted ? '1' : '0');
    if (this.masterGain) {
      this.masterGain.gain.value = this._muted ? 0 : 0.3;
    }
    return this._muted;
  }

  /** Initialize on first user interaction */
  public init(): void {
    this.ensureContext();
  }

  // ========== Helper to create oscillator → masterGain ==========

  private osc(type: OscillatorType, freq: number, duration: number, gainVal: number = 0.3, delay: number = 0): OscillatorNode | null {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return null;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(gainVal, ctx.currentTime + delay);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
    o.connect(g).connect(this.masterGain);
    o.start(ctx.currentTime + delay);
    o.stop(ctx.currentTime + delay + duration + 0.05);
    return o;
  }

  private noise(duration: number, gainVal: number = 0.1, delay: number = 0): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gainVal, ctx.currentTime + delay);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
    src.connect(g).connect(this.masterGain);
    src.start(ctx.currentTime + delay);
    src.stop(ctx.currentTime + delay + duration + 0.01);
  }

  // ========== SOUND EFFECTS ==========

  /** Summon: rising tone, pitch scales with grade (0=common..4=mythic) */
  public playSummon(gradeIndex: number): void {
    const baseFreq = 300 + gradeIndex * 150;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(baseFreq, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(baseFreq * 2, ctx.currentTime + 0.15);
    g.gain.setValueAtTime(0.25, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    o.connect(g).connect(this.masterGain);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + 0.25);

    // Sparkle for epic+
    if (gradeIndex >= 2) {
      this.osc('sine', baseFreq * 2.5, 0.1, 0.15, 0.08);
      this.osc('sine', baseFreq * 3, 0.08, 0.1, 0.12);
    }
  }

  /** Attack — warrior: thump */
  public playAttackWarrior(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(150, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.08);
    g.gain.setValueAtTime(0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    o.connect(g).connect(this.masterGain);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + 0.12);
    this.noise(0.05, 0.08);
  }

  /** Attack — archer: short high swish */
  public playAttackArcher(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(1200, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.06);
    g.gain.setValueAtTime(0.1, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    o.connect(g).connect(this.masterGain);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + 0.1);
  }

  /** Attack — mage: magical shimmer */
  public playAttackMage(): void {
    this.osc('sine', 600, 0.12, 0.15);
    this.osc('sine', 900, 0.1, 0.1, 0.03);
    this.osc('triangle', 1200, 0.08, 0.08, 0.05);
  }

  /** Merge: rising glissando + sparkle */
  public playMerge(gradeIndex: number): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const baseFreq = 300 + gradeIndex * 100;

    // Glissando
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(baseFreq, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(baseFreq * 3, ctx.currentTime + 0.3);
    g.gain.setValueAtTime(0.25, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    o.connect(g).connect(this.masterGain);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + 0.4);

    // Sparkle notes
    this.osc('sine', baseFreq * 2, 0.1, 0.15, 0.15);
    this.osc('sine', baseFreq * 2.5, 0.1, 0.12, 0.2);
    this.osc('sine', baseFreq * 3, 0.08, 0.1, 0.25);

    // Extra chime for legend/mythic
    if (gradeIndex >= 3) {
      this.osc('sine', baseFreq * 4, 0.15, 0.1, 0.3);
    }
  }

  /** Enemy killed: short pop/explosion */
  public playEnemyKill(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(200, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.12);
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    o.connect(g).connect(this.masterGain);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + 0.18);
    this.noise(0.08, 0.1);
  }

  /** Wave start: drum/horn */
  public playWaveStart(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    // Drum hit
    const drum = ctx.createOscillator();
    const dg = ctx.createGain();
    drum.type = 'sine';
    drum.frequency.setValueAtTime(120, ctx.currentTime);
    drum.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.15);
    dg.gain.setValueAtTime(0.3, ctx.currentTime);
    dg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    drum.connect(dg).connect(this.masterGain);
    drum.start(ctx.currentTime);
    drum.stop(ctx.currentTime + 0.25);

    // Horn
    this.osc('sawtooth', 220, 0.3, 0.12, 0.1);
    this.osc('sawtooth', 330, 0.2, 0.08, 0.15);
  }

  /** Boss appear: low rumbling warning */
  public playBossAppear(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    // Low rumble
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(60, ctx.currentTime);
    o.frequency.setValueAtTime(55, ctx.currentTime + 0.2);
    o.frequency.setValueAtTime(65, ctx.currentTime + 0.4);
    g.gain.setValueAtTime(0.2, ctx.currentTime);
    g.gain.setValueAtTime(0.25, ctx.currentTime + 0.3);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    o.connect(g).connect(this.masterGain);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + 0.65);

    // Warning beeps
    this.osc('square', 200, 0.1, 0.15, 0.0);
    this.osc('square', 200, 0.1, 0.15, 0.2);
    this.osc('square', 300, 0.15, 0.15, 0.4);
  }

  /** Game over: descending tone */
  public playGameOver(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const notes = [400, 350, 280, 200, 120];
    notes.forEach((freq, i) => {
      this.osc('sine', freq, 0.25, 0.2, i * 0.15);
    });

    // Low rumble at end
    this.osc('sawtooth', 60, 0.5, 0.15, 0.6);
  }

  /** Victory: fanfare */
  public playVictory(): void {
    const notes = [
      { freq: 523, delay: 0 },     // C5
      { freq: 659, delay: 0.12 },   // E5
      { freq: 784, delay: 0.24 },   // G5
      { freq: 1047, delay: 0.4 },   // C6
    ];
    notes.forEach(n => {
      this.osc('sine', n.freq, 0.25, 0.2, n.delay);
      this.osc('triangle', n.freq * 1.005, 0.25, 0.1, n.delay); // slight detune for richness
    });

    // Sustain chord
    this.osc('sine', 523, 0.5, 0.12, 0.55);
    this.osc('sine', 659, 0.5, 0.1, 0.55);
    this.osc('sine', 784, 0.5, 0.1, 0.55);
    this.osc('sine', 1047, 0.6, 0.12, 0.55);
  }

  /** Button click: short tick */
  public playClick(): void {
    this.osc('sine', 800, 0.04, 0.15);
    this.osc('sine', 1000, 0.03, 0.1, 0.02);
  }

  /** Sell unit sound */
  public playSell(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(600, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.12);
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    o.connect(g).connect(this.masterGain);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + 0.18);
  }
}

/** Global singleton */
export const soundManager = new SoundManager();
