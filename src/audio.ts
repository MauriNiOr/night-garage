type SoundScene = 'menu' | 'garage' | 'road' | 'race' | 'off';
type Effect = 'ui' | 'step' | 'tool' | 'success' | 'collision' | 'shift' | 'turbo' | 'door' | 'start';
type EngineVoice = {
  main: OscillatorNode;
  harmonic: OscillatorNode;
  filter: BiquadFilterNode;
  level: GainNode;
};

const scores = {
  menu: { tempo: 78, roots: [38, 34, 41, 36], racing: false },
  garage: { tempo: 84, roots: [38, 34, 41, 36], racing: false },
  road: { tempo: 102, roots: [38, 41, 34, 36], racing: false },
  race: { tempo: 134, roots: [38, 34, 41, 36], racing: true },
} as const;

const chords = [[0, 3, 7, 14], [0, 4, 7, 11], [0, 4, 7, 14], [0, 4, 7, 10]] as const;
const nocturne = [2, -1, -1, 0, -1, -1, 3, -1, -1, -1, 1, -1, -1, -1, 2, -1];
const pursuit = [0, -1, 2, 1, -1, 2, -1, 3, 0, -1, 2, -1, 1, 2, -1, 3];
const engineVoices = [1, 1.18, 1.12, 0.83, 1.23, 0.94, 0.73, 1.30, 0.89, 1.06, 0.79, 1.16];

function midi(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

function fraction(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function smooth(param: AudioParam, value: number, now: number, seconds = 0.05): void {
  param.setTargetAtTime(value, now, seconds);
}

class NightAudio {
  private context?: AudioContext;
  private music?: GainNode;
  private effects?: GainNode;
  private scoreLane?: GainNode;
  private rain?: GainNode;
  private tire?: GainNode;
  private engine?: EngineVoice;
  private noise?: AudioBuffer;
  private mode: SoundScene = 'menu';
  private musicVolume = 0.58;
  private effectVolume = 0.78;
  private step = 0;
  private nextBeat = 0;
  private lastGear = 0;
  private lastDrive = -1;
  private lastStep = -1;
  private lastCollision = -1;
  private nextTraffic = 0;
  private boosting = false;

  async unlock(): Promise<void> {
    if (this.context) {
      if (this.context.state !== 'running' && this.context.state !== 'closed') {
        await this.context.resume().catch(() => undefined);
      }
      return;
    }

    const Audio = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Audio) return;

    try {
      const context = new Audio();
      this.context = context;

      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -17;
      compressor.knee.value = 18;
      compressor.ratio.value = 3;
      compressor.connect(context.destination);

      this.music = context.createGain();
      this.effects = context.createGain();
      this.music.connect(compressor);
      this.effects.connect(compressor);
      this.music.gain.value = this.musicVolume;
      this.effects.gain.value = this.effectVolume;

      this.noise = context.createBuffer(1, 2 * context.sampleRate, context.sampleRate);
      const samples = this.noise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;

      this.rain = this.noiseLoop('bandpass', 1_110, 0.43, this.effects);
      this.tire = this.noiseLoop('bandpass', 920, 0.8, this.effects);
      this.engine = this.createEngine(this.effects);
      this.applyScene();

      window.setInterval(() => this.scheduleMusic(), 40);
      if (context.state === 'suspended') await context.resume().catch(() => undefined);
    } catch {
      if (this.context) void this.context.close().catch(() => undefined);
      this.context = undefined;
    }
  }

  levels(music: number, sfx: number): void {
    this.musicVolume = fraction(music);
    this.effectVolume = fraction(sfx);
    if (!this.context || !this.music || !this.effects) return;
    smooth(this.music.gain, this.musicVolume, this.context.currentTime);
    smooth(this.effects.gain, this.effectVolume, this.context.currentTime);
  }

  scene(mode: SoundScene): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.applyScene();
  }

  drive(speed: number, throttle: number, slip: number, gear: number, model = 0): void {
    const context = this.context;
    const engine = this.engine;
    if (!context || !engine || !this.tire || (this.mode !== 'road' && this.mode !== 'race')) return;

    const now = context.currentTime;
    const engaged = Math.max(1, Math.abs(gear));
    const transmission = 18 + engaged * 18;
    const acceleration = fraction(throttle);
    const speedFraction = fraction(Math.abs(speed) / 195);
    const rpm = Math.max(0, Math.min(1, Math.abs(speed) / transmission + acceleration * 0.18));
    const voice = engineVoices[Math.floor(model)] ?? 1;
    if (gear !== this.lastGear && this.lastGear > 0 && speed > 10) this.play('shift');
    this.lastGear = gear;

    if (now - this.lastDrive < 0.035) return;
    this.lastDrive = now;
    const fundamental = (26 + 104 * rpm + 16 * acceleration) * voice;
    const skid = fraction(Math.abs(slip));
    smooth(engine.main.frequency, fundamental, now, 0.04);
    smooth(engine.harmonic.frequency, fundamental * (model % 3 === 0 ? 2.005 : 1.51), now, 0.05);
    smooth(engine.filter.frequency, 140 + acceleration * 540 + speedFraction * 430, now, 0.08);
    smooth(engine.level.gain, 0.035 + acceleration * 0.04 + speedFraction * 0.016, now);
    smooth(this.tire.gain, speedFraction * (0.011 + 0.17 * skid), now, 0.07);
  }

  boost(active: boolean): void {
    if (active && !this.boosting) this.play('turbo');
    this.boosting = active;
  }

  play(name: Effect): void {
    const context = this.context;
    const bus = this.effects;
    if (!context || !bus || this.mode === 'off' || this.effectVolume === 0) return;
    const now = context.currentTime;

    switch (name) {
      case 'ui':
        this.tone(bus, 'sine', 880, now, 0.045, 0.044, 0.003, 630);
        break;
      case 'step':
        if (now - this.lastStep < 0.155) break;
        this.lastStep = now;
        this.burst(bus, 'lowpass', 620 + Math.random() * 260, now, 0.064, 0.075);
        break;
      case 'tool':
        this.burst(bus, 'bandpass', 2_350, now, 0.11, 0.13);
        this.tone(bus, 'triangle', 1_230, now + 0.02, 0.13, 0.038, 0.003, 938);
        this.burst(bus, 'bandpass', 3_620, now + 0.074, 0.038, 0.082);
        break;
      case 'success':
        [62, 65, 69, 76].forEach((note, index) => {
          this.tone(bus, 'triangle', midi(note), now + 0.07 * index, 0.22, 0.065, 0.009);
        });
        break;
      case 'collision':
        if (now - this.lastCollision < 0.16) break;
        this.lastCollision = now;
        this.burst(bus, 'lowpass', 370, now, 0.13, 0.38);
        this.burst(bus, 'bandpass', 1_600, now + 0.018, 0.17, 0.15);
        this.tone(bus, 'triangle', 94, now, 0.14, 0.15, 0.005, 29);
        break;
      case 'shift':
        this.burst(bus, 'bandpass', 660, now, 0.104, 0.13);
        this.tone(bus, 'triangle', 138, now, 0.097, 0.06, 0.006, 65);
        break;
      case 'turbo':
        this.burst(bus, 'highpass', 2_150, now, 0.31, 0.16, 0.025);
        this.tone(bus, 'sine', 500, now, 0.26, 0.055, 0.06, 2_000);
        break;
      case 'door':
        this.burst(bus, 'lowpass', 570, now, 0.66, 0.14, 0.09);
        this.tone(bus, 'triangle', 56, now, 0.64, 0.11, 0.1, 43);
        this.burst(bus, 'bandpass', 1_850, now + 0.48, 0.12, 0.085);
        break;
      case 'start':
        this.tone(bus, 'triangle', 510, now, 0.15, 0.088, 0.004);
        this.tone(bus, 'sine', 1_020, now, 0.18, 0.04, 0.005);
        break;
    }
  }

  private applyScene(): void {
    const context = this.context;
    if (!context || !this.music || !this.rain || !this.tire || !this.engine) return;
    const now = context.currentTime;

    if (this.scoreLane) {
      const previousLane = this.scoreLane;
      smooth(previousLane.gain, 0, now, 0.12);
      window.setTimeout(() => previousLane.disconnect(), 850);
      this.scoreLane = undefined;
    }

    if (this.mode !== 'off') {
      this.scoreLane = context.createGain();
      this.scoreLane.gain.value = 0.001;
      this.scoreLane.connect(this.music);
      smooth(this.scoreLane.gain, 1, now, 0.18);
      this.step = 0;
      this.nextBeat = now + 0.045;
    }

    const driving = this.mode === 'road' || this.mode === 'race';
    smooth(this.rain.gain, this.mode === 'off' ? 0 : driving ? 0.068 : 0.033, now, 0.32);
    smooth(this.tire.gain, 0, now);
    smooth(this.engine.main.frequency, 31, now);
    smooth(this.engine.harmonic.frequency, 62, now);
    smooth(this.engine.filter.frequency, 170, now);
    smooth(this.engine.level.gain, driving ? 0.039 : 0, now, 0.13);
    this.lastGear = 0;
    this.boosting = false;
    this.nextTraffic = now + 2.5;
  }

  private scheduleMusic(): void {
    const context = this.context;
    const lane = this.scoreLane;
    if (!context || !lane || context.state !== 'running' || this.mode === 'off' || document.hidden) return;

    const score = scores[this.mode];
    const interval = 15 / score.tempo;
    const now = context.currentTime;
    if (this.mode === 'road' && now >= this.nextTraffic) {
      this.passTraffic(now);
      this.nextTraffic = now + 7 + Math.random() * 8;
    }
    if (this.nextBeat < now - interval) this.nextBeat = now + 0.025;

    while (this.nextBeat < now + 0.14) {
      const at = Math.max(now + 0.006, this.nextBeat);
      this.playBeat(lane, score, at, interval);
      this.nextBeat += interval;
      this.step++;
    }
  }

  private passTraffic(now: number): void {
    if (!this.effects || this.effectVolume === 0) return;
    this.burst(this.effects, 'bandpass', 720, now, 1.05, 0.081, 0.29);
    this.tone(this.effects, 'triangle', 106, now, 1.22, 0.04, 0.32, 54);
  }

  private playBeat(destination: GainNode, score: (typeof scores)[keyof typeof scores], at: number, interval: number): void {
    const beat = this.step % 16;
    const bar = Math.floor(this.step / 16) % 4;
    const root = score.roots[bar];
    const chord = chords[bar];
    const racing = score.racing;
    const syncopated = this.mode === 'road' || racing;

    if (beat === 0) {
      chord.forEach((offset, index) => {
        const frequency = midi(root + 24 + offset) * (index % 2 ? 1.002 : 0.998);
        this.tone(destination, 'triangle', frequency, at, 16.7 * interval, racing ? 0.014 : 0.027, interval * 2.2);
      });
    }

    if (beat === 0 || beat === 8 || (racing && (beat === 3 || beat === 6 || beat === 11 || beat === 14))) {
      const note = root - (racing && beat === 14 ? 5 : 0);
      this.tone(destination, racing ? 'triangle' : 'sine', midi(note), at, interval * (racing ? 1.7 : 5.7), racing ? 0.13 : 0.105, 0.02);
    }

    const pluck = (racing ? pursuit : nocturne)[beat];
    if (pluck >= 0) {
      const frequency = midi(root + (racing ? 36 : 24) + chord[pluck]);
      this.tone(destination, 'triangle', frequency, at, interval * (racing ? 1.22 : 2.5), racing ? 0.053 : 0.046, 0.012);
      if (!racing) this.tone(destination, 'sine', frequency, at + interval * 2.7, interval * 2.1, 0.014, 0.014);
    }

    if (beat % (racing ? 4 : 8) === 0) {
      this.tone(destination, 'sine', 104, at, 0.20, racing ? 0.31 : 0.115, 0.006, 39);
    }
    if (beat === 4 || beat === 12) this.burst(destination, 'bandpass', 1_900, at, 0.14, racing ? 0.14 : 0.029);
    if (beat % (syncopated ? 2 : 4) === 2) this.burst(destination, 'highpass', 6_500, at + 0.011, 0.052, racing ? 0.077 : 0.043);
    if (racing && beat === 15) this.burst(destination, 'highpass', 7_600, at, 0.035, 0.043);
  }

  private createEngine(output: GainNode): EngineVoice {
    const context = output.context;
    const main = context.createOscillator();
    const harmonic = context.createOscillator();
    const mix = context.createGain();
    const filter = context.createBiquadFilter();
    const level = context.createGain();

    main.type = 'sawtooth';
    harmonic.type = 'triangle';
    mix.gain.value = 0.48;
    filter.type = 'lowpass';
    filter.Q.value = 0.77;
    level.gain.value = 0;
    main.connect(filter);
    harmonic.connect(mix).connect(filter);
    filter.connect(level).connect(output);
    main.start();
    harmonic.start();
    return { main, harmonic, filter, level };
  }

  private noiseLoop(type: BiquadFilterType, hz: number, q: number, destination: GainNode): GainNode {
    const context = destination.context;
    const source = context.createBufferSource();
    source.buffer = this.noise ?? null;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = hz;
    filter.Q.value = q;
    const volume = context.createGain();
    volume.gain.value = 0;
    source.connect(filter).connect(volume).connect(destination);
    source.start(0, Math.random());
    return volume;
  }

  private tone(destination: GainNode, shape: OscillatorType, hz: number, at: number, duration: number, peak: number, attack: number, endHz?: number): void {
    const context = destination.context;
    const oscillator = context.createOscillator();
    oscillator.type = shape;
    oscillator.frequency.setValueAtTime(hz, at);
    if (endHz) oscillator.frequency.exponentialRampToValueAtTime(endHz, at + duration * 0.89);

    const volume = this.envelope(destination, at, duration, peak, attack);
    oscillator.connect(volume);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.016);
    oscillator.onended = () => {
      oscillator.disconnect();
      volume.disconnect();
    };
  }

  private burst(destination: GainNode, type: BiquadFilterType, frequency: number, at: number, duration: number, peak: number, attack = 0.008): void {
    if (!this.noise) return;
    const context = destination.context;
    const source = context.createBufferSource();
    source.buffer = this.noise;
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = 0.8;

    const volume = this.envelope(destination, at, duration, peak, attack);
    source.connect(filter).connect(volume);
    source.start(at, Math.random() * 0.9, duration + 0.016);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      volume.disconnect();
    };
  }

  private envelope(destination: GainNode, at: number, duration: number, peak: number, attack: number): GainNode {
    const volume = destination.context.createGain();
    volume.gain.setValueAtTime(0.0001, at);
    volume.gain.exponentialRampToValueAtTime(peak, at + attack);
    volume.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    volume.connect(destination);
    return volume;
  }
}

export const audio = new NightAudio();
