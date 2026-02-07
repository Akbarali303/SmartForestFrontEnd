/**
 * Ogohlantirish tovushi — kritik hodisalar (o't, xavf) uchun.
 * Fayl kerak emas: Web Audio API orqali o'zimiz signal chiqaramiz.
 * 3 soniya yoki to'xtatguncha davom etadi. Mute localStorage da.
 */

const LOOP_MAX_MS = 3_000;
const STORAGE_KEY = 'alert-sound-muted';

let stopTimeoutId: ReturnType<typeof setTimeout> | null = null;
let repeatIntervalId: ReturnType<typeof setInterval> | null = null;
let audioContext: AudioContext | null = null;
let oscillator: OscillatorNode | null = null;
let gainNode: GainNode | null = null;

function playSynthesizedAlert(): void {
  if (typeof window === 'undefined') return;
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    audioContext = ctx;
    ctx.resume?.();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator = osc;
    gainNode = gain;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.3);
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.25, ctx.currentTime + 0.5);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.55);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.55);

    const repeat = (): void => {
      const t = ctx.currentTime;
      const o2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      o2.type = 'sine';
      o2.frequency.setValueAtTime(880, t);
      o2.frequency.setValueAtTime(660, t + 0.15);
      o2.frequency.setValueAtTime(880, t + 0.3);
      o2.frequency.setValueAtTime(660, t + 0.45);
      o2.connect(g2);
      g2.connect(ctx.destination);
      g2.gain.setValueAtTime(0, t);
      g2.gain.linearRampToValueAtTime(0.25, t + 0.05);
      g2.gain.setValueAtTime(0.25, t + 0.5);
      g2.gain.linearRampToValueAtTime(0, t + 0.55);
      o2.start(t);
      o2.stop(t + 0.55);
    };

    let count = 0;
    repeatIntervalId = setInterval(() => {
      count += 1;
      if (count * 600 >= LOOP_MAX_MS) {
        if (repeatIntervalId) clearInterval(repeatIntervalId);
        repeatIntervalId = null;
        return;
      }
      repeat();
    }, 600);
    stopTimeoutId = setTimeout(() => {
      if (repeatIntervalId) clearInterval(repeatIntervalId);
      repeatIntervalId = null;
      alertSound.stop();
    }, LOOP_MAX_MS);
  } catch {
    // brauzer Web Audio API qo'llamasa hech narsa
  }
}

export const alertSound = {
  play(): void {
    if (typeof window === 'undefined') return;
    if (this.isMuted()) return;
    this.stop();
    playSynthesizedAlert();
  },

  stop(): void {
    if (stopTimeoutId) {
      clearTimeout(stopTimeoutId);
      stopTimeoutId = null;
    }
    if (repeatIntervalId) {
      clearInterval(repeatIntervalId);
      repeatIntervalId = null;
    }
    if (oscillator) {
      try {
        oscillator.stop();
      } catch {
        // already stopped
      }
      oscillator = null;
    }
    if (gainNode) {
      gainNode = null;
    }
    if (audioContext) {
      audioContext.close().catch(() => {});
      audioContext = null;
    }
  },

  setMuted(muted: boolean): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
    } catch {
      // ignore
    }
  },

  isMuted(): boolean {
    if (typeof window === 'undefined') return true;
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  },
};
