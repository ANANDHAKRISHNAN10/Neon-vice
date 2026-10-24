import { RADIO_STATIONS } from '../constants';
import { WeaponId } from '../types';

export class SoundEngine {
  private ctx: AudioContext | null = null;
  public muted = false;
  public masterVolume = 0.65;
  public radioStationIndex = 0;
  private isDriving = false;
  private currentSpeedRatio = 0;

  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private radioTimer: number | null = null;
  private stepIndex = 0;
  private sirenTimer: number | null = null;
  private sirenPhase = false;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.muted) {
      this.stopEngineAudio();
      this.stopRadioLoop();
    } else if (this.isDriving) {
      this.startEngineAudio();
      this.startRadioLoop();
    }
    return this.muted;
  }

  public setVolume(val: number) {
    this.masterVolume = Math.max(0, Math.min(1, val));
  }

  public cycleRadioStation(): { name: string; genre: string } {
    this.radioStationIndex =
      (this.radioStationIndex + 1) % RADIO_STATIONS.length;
    const station = RADIO_STATIONS[this.radioStationIndex];
    this.playUIClick();
    if (this.isDriving) {
      this.stopRadioLoop();
      if (station.bpm > 0) {
        this.startRadioLoop();
      }
    }
    return { name: station.name, genre: station.genre };
  }

  public getCurrentStation() {
    return RADIO_STATIONS[this.radioStationIndex];
  }

  public setDrivingState(driving: boolean, speedRatio = 0) {
    this.currentSpeedRatio = Math.min(1.5, Math.abs(speedRatio));
    if (driving && !this.isDriving) {
      this.isDriving = true;
      this.startEngineAudio();
      this.startRadioLoop();
    } else if (!driving && this.isDriving) {
      this.isDriving = false;
      this.stopEngineAudio();
      this.stopRadioLoop();
    }

    if (this.isDriving && this.engineOsc && this.engineGain && this.ctx) {
      const targetFreq = 52 + this.currentSpeedRatio * 145;
      this.engineOsc.frequency.setTargetAtTime(
        targetFreq,
        this.ctx.currentTime,
        0.06,
      );
      this.engineGain.gain.setTargetAtTime(
        this.muted
          ? 0
          : (0.04 + this.currentSpeedRatio * 0.06) * this.masterVolume,
        this.ctx.currentTime,
        0.08,
      );
    }
  }

  private startEngineAudio() {
    const ctx = this.ensureContext();
    if (!ctx || this.engineOsc) return;
    try {
      this.engineOsc = ctx.createOscillator();
      this.engineGain = ctx.createGain();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineGain.gain.value = 0.04 * this.masterVolume;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;

      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(ctx.destination);
      this.engineOsc.start();
    } catch {
      // Ignore audio context restrictions
    }
  }

  private stopEngineAudio() {
    if (this.engineOsc) {
      try {
        this.engineOsc.stop();
        this.engineOsc.disconnect();
      } catch {
        // Ignore
      }
      this.engineOsc = null;
      this.engineGain = null;
    }
  }

  private startRadioLoop() {
    this.stopRadioLoop();
    const station = RADIO_STATIONS[this.radioStationIndex];
    if (!station || station.bpm <= 0 || this.muted) return;

    const stepMs = (60 / station.bpm / 2) * 1000;
    this.radioTimer = window.setInterval(() => {
      if (!this.isDriving || this.muted) return;
      this.playSynthStep(station);
    }, stepMs);
  }

  private stopRadioLoop() {
    if (this.radioTimer !== null) {
      clearInterval(this.radioTimer);
      this.radioTimer = null;
    }
  }

  private playSynthStep(station: (typeof RADIO_STATIONS)[0]) {
    const ctx = this.ensureContext();
    if (!ctx || station.scale.length === 0) return;

    const now = ctx.currentTime;
    const step = this.stepIndex++;
    const semi = station.scale[step % station.scale.length];
    const octaveBoost = step % 8 === 0 ? 0.5 : step % 4 === 2 ? 2 : 1;
    const freq = station.rootNote * Math.pow(2, semi / 12) * octaveBoost;

    // Bass / Arpeggio note
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = step % 2 === 0 ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900 + Math.sin(step * 0.4) * 500, now);

    const vol = 0.045 * this.masterVolume;
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  public playWeaponFire(weapon: WeaponId) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (weapon === WeaponId.FISTS) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.11);
      gain.gain.setValueAtTime(0.22 * this.masterVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.13);
      return;
    }

    // Noise burst + punchy low oscillator
    const duration =
      weapon === WeaponId.SHOTGUN
        ? 0.28
        : weapon === WeaponId.SMG
          ? 0.09
          : 0.16;

    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(
      weapon === WeaponId.PLASMA_RIFLE
        ? 1600
        : weapon === WeaponId.SHOTGUN
          ? 520
          : 980,
      now,
    );

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.24 * this.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);

    if (weapon === WeaponId.PLASMA_RIFLE) {
      const laserOsc = ctx.createOscillator();
      const laserGain = ctx.createGain();
      laserOsc.type = 'sawtooth';
      laserOsc.frequency.setValueAtTime(880, now);
      laserOsc.frequency.exponentialRampToValueAtTime(160, now + 0.18);
      laserGain.gain.setValueAtTime(0.14 * this.masterVolume, now);
      laserGain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
      laserOsc.connect(laserGain);
      laserGain.connect(ctx.destination);
      laserOsc.start(now);
      laserOsc.stop(now + 0.2);
    }
  }

  public playTireScreech() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(620 + Math.random() * 90, now);
    osc.frequency.linearRampToValueAtTime(540, now + 0.12);
    gain.gain.setValueAtTime(0.035 * this.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playPoliceSirenBlip() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.sirenPhase = !this.sirenPhase;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(this.sirenPhase ? 680 : 920, now);
    gain.gain.setValueAtTime(0.04 * this.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  public playCashSound() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [587.33, 880, 1174.66];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);
      gain.gain.setValueAtTime(0.14 * this.masterVolume, now + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.24);
    });
  }

  public playMissionFanfare() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const chord = [440, 554.37, 659.25, 880];
    chord.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + i * 0.09);
      gain.gain.setValueAtTime(0.12 * this.masterVolume, now + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.65);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.09);
      osc.stop(now + i * 0.09 + 0.68);
    });
  }

  public playUIClick() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(740, now);
    gain.gain.setValueAtTime(0.08 * this.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  public dispose() {
    this.stopEngineAudio();
    this.stopRadioLoop();
    if (this.sirenTimer) clearInterval(this.sirenTimer);
    if (this.ctx) {
      void this.ctx.close();
    }
  }
}
