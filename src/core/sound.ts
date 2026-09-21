import { ChimeType } from './types';

export class SoundSynthesizer {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  playChime(type: ChimeType = 'pulse', volume: number = 0.8): void {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const vol = Math.max(0, Math.min(1, volume));

      switch (type) {
        case 'digital': {
          // Tri-tone retro sequence: 1046.5Hz (C6), 1318.5Hz (E6), 1568Hz (G6) with snappy triangle envelope
          const tones = [
            { freq: 1046.5, start: 0, dur: 0.08 },
            { freq: 1318.5, start: 0.08, dur: 0.08 },
            { freq: 1568.0, start: 0.16, dur: 0.12 },
          ];

          for (const tone of tones) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(tone.freq, now + tone.start);

            gain.gain.setValueAtTime(0.001, now + tone.start);
            gain.gain.exponentialRampToValueAtTime(vol * 0.4, now + tone.start + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.001, now + tone.start + tone.dur);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + tone.start);
            osc.stop(now + tone.start + tone.dur + 0.01);
          }
          break;
        }

        case 'radar': {
          // Resonant sonar ping: 1400Hz gliding down to 1000Hz with exponential gain decay
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1400, now);
          osc.frequency.exponentialRampToValueAtTime(1000, now + 0.4);

          gain.gain.setValueAtTime(0.001, now);
          gain.gain.exponentialRampToValueAtTime(vol * 0.5, now + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.52);
          break;
        }

        case 'alarm': {
          // Double-beep: two 90ms bursts of 880Hz (A5) separated by 60ms gap
          const beeps = [0, 0.15]; // burst 1: 0 to 0.09s, burst 2: 0.15 to 0.24s (60ms gap)
          for (const start of beeps) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(880, now + start);

            gain.gain.setValueAtTime(0.001, now + start);
            gain.gain.exponentialRampToValueAtTime(vol * 0.25, now + start + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, now + start + 0.09);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + start);
            osc.stop(now + start + 0.095);
          }
          break;
        }

        case 'pulse':
        default: {
          // Tone 1: 784 Hz (G5) for 120ms
          const osc1 = ctx.createOscillator();
          const gain1 = ctx.createGain();
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(784, now);

          gain1.gain.setValueAtTime(0.001, now);
          gain1.gain.exponentialRampToValueAtTime(vol * 0.35, now + 0.02);
          gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

          osc1.connect(gain1);
          gain1.connect(ctx.destination);
          osc1.start(now);
          osc1.stop(now + 0.13);

          // Tone 2: 1046.5 Hz (C6) for 240ms (plays 80ms after tone 1)
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(1046.5, now + 0.08);

          gain2.gain.setValueAtTime(0.001, now + 0.08);
          gain2.gain.exponentialRampToValueAtTime(vol * 0.45, now + 0.1);
          gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start(now + 0.08);
          osc2.stop(now + 0.33);
          break;
        }
      }
    } catch (err) {
      console.warn('Audio playback not allowed or failed:', err);
    }
  }

  preview(type: ChimeType = 'pulse', volume: number = 0.8): void {
    this.playChime(type, volume);
  }
}
