/**
 * Tiny synthesized sound design (WebAudio, no assets):
 *  - clink(): two glasses touching — inharmonic bright partials, fast decay
 *  - conquer(): warm rising major chord for taking over territory
 * Only ever triggered by user gestures; can be muted in the profile.
 */
const KEY = 'bc_sound';
let ctx: AudioContext | null = null;

export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    // ignore
  }
}

function audio(): AudioContext | null {
  if (!soundEnabled()) return null;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function partial(ac: AudioContext, out: AudioNode, freq: number, start: number, decay: number, gain: number) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, start + decay);
  osc.connect(g).connect(out);
  osc.start(start);
  osc.stop(start + decay + 0.05);
}

/** Call from a tap handler: unlocks audio on iOS before any async work. */
export function primeAudio(): void {
  audio();
}

export function clink(): void {
  const ac = audio();
  if (!ac) return;
  const out = ac.createGain();
  out.gain.value = 0.18;
  out.connect(ac.destination);
  const t = ac.currentTime + 0.01;
  // Glass: strongly inharmonic partials; second, slightly detuned glass 60 ms later
  for (const [offset, detune] of [[0, 1], [0.06, 1.035]] as const) {
    partial(ac, out, 2150 * detune, t + offset, 0.7, 0.5);
    partial(ac, out, 3420 * detune, t + offset, 0.45, 0.3);
    partial(ac, out, 5230 * detune, t + offset, 0.25, 0.18);
    partial(ac, out, 7610 * detune, t + offset, 0.12, 0.08);
  }
}

export function conquer(): void {
  const ac = audio();
  if (!ac) return;
  const out = ac.createGain();
  out.gain.value = 0.12;
  out.connect(ac.destination);
  const t = ac.currentTime + 0.02;
  [392, 493.9, 587.3, 784].forEach((f, i) => {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f * 0.98, t + i * 0.07);
    osc.frequency.exponentialRampToValueAtTime(f, t + i * 0.07 + 0.12);
    g.gain.setValueAtTime(0, t + i * 0.07);
    g.gain.linearRampToValueAtTime(0.5, t + i * 0.07 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.07 + 1.1);
    osc.connect(g).connect(out);
    osc.start(t + i * 0.07);
    osc.stop(t + i * 0.07 + 1.2);
  });
}
