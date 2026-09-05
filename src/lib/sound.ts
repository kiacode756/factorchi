/**
 * Browser-native Web Audio API synthesizer for crisp, instant notification sounds.
 * Requires zero external mp3/wav assets, works completely offline and with zero latency.
 */

class SoundSynthesizer {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      if (!this.ctx || this.ctx.state === 'closed') {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  /**
   * Cash / Receipt received chime: A 3-tone ascending pleasant chord (D5 -> F#5 -> A5 -> D6)
   */
  public playReceiptReceived() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const notes = [
        { freq: 587.33, start: 0, dur: 0.18 },    // D5
        { freq: 739.99, start: 0.08, dur: 0.22 },  // F#5
        { freq: 880.00, start: 0.16, dur: 0.28 },  // A5
        { freq: 1174.66, start: 0.24, dur: 0.45 }, // D6 (bell shimmer)
      ];

      notes.forEach(({ freq, start, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + start);

        gain.gain.setValueAtTime(0, now + start);
        gain.gain.linearRampToValueAtTime(0.18, now + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + start);
        osc.stop(now + start + dur);
      });
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  /**
   * Success notification chime: A gentle high bell
   */
  public playSuccess() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const notes = [
        { freq: 659.25, start: 0, dur: 0.2 },   // E5
        { freq: 1046.50, start: 0.1, dur: 0.35 }, // C6
      ];

      notes.forEach(({ freq, start, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + start);

        gain.gain.setValueAtTime(0, now + start);
        gain.gain.linearRampToValueAtTime(0.15, now + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + start);
        osc.stop(now + start + dur);
      });
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  /**
   * Alert chime for urgent review
   */
  public playAlert() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.25);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }
}

export const sound = new SoundSynthesizer();
