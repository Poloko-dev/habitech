// Timer alarms synthesized with the Web Audio API – no audio files needed.
// Browsers only allow audio after a user gesture, so call unlockAudio() from a
// click handler (Start, Test sound) before the timer needs to ring.

let ctx = null;

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

export function unlockAudio() {
  const c = getCtx();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

// Unlock on the first interaction anywhere, so a timer restored after a reload can still ring.
if (typeof window !== 'undefined') {
  const once = () => {
    unlockAudio();
    window.removeEventListener('pointerdown', once);
    window.removeEventListener('keydown', once);
  };
  window.addEventListener('pointerdown', once);
  window.addEventListener('keydown', once);
}

/** One decaying tone. */
function tone(c, out, { freq, start, dur, type = 'sine', gain = 0.5, attack = 0.01 }) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g).connect(out);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

const SOUNDS = {
  // Bright three-note arpeggio, played twice.
  chime(c, out, t) {
    for (let rep = 0; rep < 2; rep++) {
      const base = t + rep * 1.1;
      [1046.5, 1318.5, 1568.0].forEach((f, i) => {
        tone(c, out, { freq: f, start: base + i * 0.16, dur: 0.9, gain: 0.35 });
        tone(c, out, { freq: f * 2, start: base + i * 0.16, dur: 0.5, gain: 0.06 });
      });
    }
  },
  // Struck bell with inharmonic partials, three strikes.
  bell(c, out, t) {
    for (let rep = 0; rep < 3; rep++) {
      const s = t + rep * 1.3;
      [[1, 0.4, 2.4], [2.0, 0.18, 1.6], [2.76, 0.12, 1.2], [5.4, 0.05, 0.6]].forEach(([ratio, gain, dur]) =>
        tone(c, out, { freq: 660 * ratio, start: s, dur, gain, attack: 0.005 }));
    }
  },
  // Classic kitchen-timer style beeps: three groups of four.
  digital(c, out, t) {
    for (let grp = 0; grp < 3; grp++) {
      for (let i = 0; i < 4; i++) {
        tone(c, out, { freq: 2000, start: t + grp * 0.9 + i * 0.14, dur: 0.09, type: 'square', gain: 0.12, attack: 0.003 });
      }
    }
  },
  // Gentle two-note rise – softer, for the end of a break.
  soft(c, out, t) {
    [[523.25, 0], [783.99, 0.35]].forEach(([f, dt]) => {
      tone(c, out, { freq: f, start: t + dt, dur: 1.6, gain: 0.3, attack: 0.04 });
      tone(c, out, { freq: f * 2, start: t + dt, dur: 0.9, gain: 0.05, attack: 0.04 });
    });
  },
};

export const SOUND_OPTIONS = [
  { value: 'chime', label: 'Chime' },
  { value: 'bell', label: 'Bell' },
  { value: 'digital', label: 'Digital beep' },
  { value: 'soft', label: 'Soft rise' },
  { value: 'none', label: 'No sound' },
];

/** Plays a named alarm at volume 0..1. Returns false if audio isn't available. */
export function playSound(name, volume = 0.7) {
  if (name === 'none' || !SOUNDS[name]) return true;
  const c = getCtx();
  if (!c) return false;
  if (c.state === 'suspended') c.resume().catch(() => {});
  const master = c.createGain();
  master.gain.value = Math.max(0, Math.min(1, volume));
  master.connect(c.destination);
  SOUNDS[name](c, master, c.currentTime + 0.05);
  return c.state === 'running';
}
