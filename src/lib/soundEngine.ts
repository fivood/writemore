import { useStore } from '../store';
import { publicAsset } from './assets';

const KEY_FILES = ['key-1', 'key-2', 'key-3', 'space', 'bell', 'carriage-return'] as const;
type SoundFile = (typeof KEY_FILES)[number];

class TypewriterSoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private rawBytes = new Map<SoundFile, Promise<ArrayBuffer | null>>();
  private buffers = new Map<SoundFile, AudioBuffer>();
  private decoding = new Map<SoundFile, Promise<AudioBuffer | null>>();
  private voices = new Set<{ stop: () => void }>();
  private fallbackNoise: AudioBuffer | null = null;
  private serial = 0;
  private column = 0;

  private isEnabled(): boolean {
    return useStore.getState().soundEnabled;
  }

  private fetchRaw(name: SoundFile): Promise<ArrayBuffer | null> {
    if (!this.rawBytes.has(name)) {
      const p = fetch(publicAsset(`audio/${name}.wav`))
        .then(r => (r.ok ? r.arrayBuffer() : null))
        .catch(() => null);
      this.rawBytes.set(name, p);
    }
    return this.rawBytes.get(name)!;
  }

  private ensureContext(): boolean {
    if (this.ctx) return true;
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.masterGain = this.ctx.createGain();
      this.limiter = this.ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -8;
      this.limiter.knee.value = 8;
      this.limiter.ratio.value = 4;
      this.limiter.attack.value = 0.003;
      this.limiter.release.value = 0.18;
      this.masterGain.gain.value = 0.75;
      this.masterGain.connect(this.limiter);
      this.limiter.connect(this.ctx.destination);
      return true;
    } catch {
      this.ctx = null;
      this.masterGain = null;
      this.limiter = null;
      return false;
    }
  }

  private decode(name: SoundFile): Promise<AudioBuffer | null> {
    if (this.buffers.has(name)) return Promise.resolve(this.buffers.get(name)!);
    if (!this.decoding.has(name)) {
      const p = this.fetchRaw(name)
        .then(bytes => (bytes && this.ctx ? this.ctx.decodeAudioData(bytes.slice(0)) : null))
        .then(buf => {
          if (buf) this.buffers.set(name, buf);
          return buf;
        })
        .catch(() => null);
      this.decoding.set(name, p);
    }
    return this.decoding.get(name)!;
  }

  preload(): void {
    KEY_FILES.forEach(f => void this.fetchRaw(f));
  }

  async unlock(): Promise<boolean> {
    if (!this.ensureContext() || !this.ctx) return false;
    try {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
    } catch {
      return false;
    }
    await Promise.all(KEY_FILES.map(f => this.decode(f)));
    return this.ctx.state === 'running';
  }

  private playBuffer(
    buffer: AudioBuffer,
    opts: { when?: number; rate?: number; level?: number; cutoff?: number; pan?: number } = {}
  ): void {
    if (!this.ctx || !this.masterGain) return;
    while (this.voices.size >= 20) {
      const oldest = this.voices.values().next().value;
      oldest?.stop();
    }
    const when = opts.when ?? this.ctx.currentTime;
    const rate = opts.rate ?? 1;
    const level = opts.level ?? 0.85;
    const cutoff = opts.cutoff ?? 9800;
    const panVal = opts.pan ?? 0;

    const src = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    const panner = this.ctx.createStereoPanner();

    src.buffer = buffer;
    src.playbackRate.value = rate;
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    filter.Q.value = 0.5;
    panner.pan.value = Math.max(-1, Math.min(1, panVal));

    const duration = buffer.duration;
    const end = when + duration / rate;
    gain.gain.setValueAtTime(level, when);
    gain.gain.setValueAtTime(level, Math.max(when, end - 0.015));
    gain.gain.linearRampToValueAtTime(0, end);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(this.masterGain);

    let dead = false;
    const entry = {
      stop: () => {
        if (dead) return;
        dead = true;
        this.voices.delete(entry);
        try { src.stop(); } catch { /* noop */ }
        src.disconnect();
        filter.disconnect();
        gain.disconnect();
        panner.disconnect();
      },
    };
    src.onended = () => entry.stop();
    this.voices.add(entry);
    src.start(when, 0, duration);
  }

  private playFallbackClick(when: number, level = 0.2): void {
    if (!this.ctx) return;
    if (!this.fallbackNoise) {
      const len = Math.ceil(this.ctx.sampleRate * 0.055);
      this.fallbackNoise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const ch = this.fallbackNoise.getChannelData(0);
      for (let i = 0; i < len; i++) {
        ch[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.008));
      }
    }
    this.playBuffer(this.fallbackNoise, { when, level, cutoff: 8500 });
  }

  hitKey(key = 'a'): void {
    if (!this.isEnabled()) return;
    if (!this.ctx) {
      void this.unlock();
      if (!this.ctx) return;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});

    const lower = key.toLowerCase();
    if (lower === 'shift' || lower === 'control' || lower === 'alt' || lower === 'meta' || lower === 'capslock') {
      return;
    }
    if (lower === 'enter') {
      this.carriageReturn(true);
      return;
    }

    const when = this.ctx.currentTime;
    const isSpace = key === ' ' || lower === 'space';
    const isBack = lower === 'backspace';
    const file: SoundFile = isSpace || isBack ? 'space' : (`key-${1 + (this.serial++ % 3)}` as SoundFile);
    const buf = this.buffers.get(file);
    const spread = 1 + (Math.random() - 0.5) * 0.04;
    const rate = spread * (isBack ? 1.14 : isSpace ? 0.94 : 1.02);
    const pan = (((key.charCodeAt(0) || 65) % 9) - 4) * 0.03;

    if (buf) {
      this.playBuffer(buf, {
        when,
        rate,
        level: isSpace ? 0.58 : 0.78 + Math.random() * 0.08,
        cutoff: 9800,
        pan,
      });
    } else {
      void this.decode(file);
      this.playFallbackClick(when, 0.18);
    }

    this.column = isBack ? Math.max(0, this.column - 1) : this.column + 1;
    if (this.column === 46) {
      this.bell(when + 0.05);
    }
  }

  bell(when?: number): void {
    if (!this.isEnabled()) return;
    if (!this.ctx) {
      void this.unlock();
      if (!this.ctx) return;
    }
    const t = when ?? this.ctx.currentTime;
    const buf = this.buffers.get('bell');
    if (buf) {
      this.playBuffer(buf, { when: t, level: 0.36, rate: 1, cutoff: 11000 });
    } else {
      void this.decode('bell');
    }
  }

  carriageReturn(withBell = false): void {
    if (!this.isEnabled()) return;
    if (!this.ctx) {
      void this.unlock().then(ok => {
        if (ok) this.carriageReturn(withBell);
      });
      return;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
    this.column = 0;
    const now = this.ctx.currentTime;
    const buf = this.buffers.get('carriage-return');
    if (buf) {
      this.playBuffer(buf, { when: now, rate: 1.02, level: 0.65, cutoff: 9500, pan: -0.1 });
    } else {
      void this.decode('carriage-return');
      this.playFallbackClick(now, 0.22);
    }
    if (withBell) {
      this.bell(now + 0.08);
    }
  }

  /** 抽词洗牌时的清脆三连击声 */
  cardShuffle(): void {
    if (!this.isEnabled()) return;
    void this.unlock().then(ok => {
      if (!ok || !this.ctx) return;
      const t = this.ctx.currentTime;
      (['key-1', 'key-2', 'key-3'] as SoundFile[]).forEach((f, idx) => {
        const b = this.buffers.get(f);
        if (b) {
          this.playBuffer(b, { when: t + idx * 0.065, rate: 1.12 + idx * 0.04, level: 0.5, pan: (idx - 1) * 0.12 });
        }
      });
    });
  }
}

const sound = new TypewriterSoundEngine();

export const preloadTypewriterAudio = () => sound.preload();
export const unlockTypewriterAudio = () => sound.unlock();
export const playKeystroke = (key?: string) => sound.hitKey(key);
export const playBell = () => sound.bell();
export const playCarriageReturn = (withBell = false) => sound.carriageReturn(withBell);
export const playCardShuffle = () => sound.cardShuffle();
