// Procedural WebAudio SFX — no samples, all synthesized.
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;

export function setSoundEnabled(on: boolean) {
  enabled = on;
  if (master) master.gain.value = on ? 0.5 : 0;
}

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = enabled ? 0.5 : 0;
      master.connect(ctx.destination);
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function env(g: GainNode, t: number, a: number, d: number, peak = 1) {
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.001, t + a + d);
}

export function sfxFlipper() {
  const c = ac();
  if (!c || !master) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "square";
  o.frequency.setValueAtTime(180, t);
  o.frequency.exponentialRampToValueAtTime(60, t + 0.07);
  env(g, t, 0.002, 0.08, 0.5);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.12);
}

export function sfxBumper() {
  const c = ac();
  if (!c || !master) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(520, t);
  o.frequency.exponentialRampToValueAtTime(190, t + 0.12);
  env(g, t, 0.002, 0.14, 0.7);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.2);
}

export function sfxZap() {
  const c = ac();
  if (!c || !master) return;
  const t = c.currentTime;
  // filtered noise crack
  const len = c.sampleRate * 0.25;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = 1800;
  const g = c.createGain();
  env(g, t, 0.001, 0.22, 0.55);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  // coil whine rising
  const o = c.createOscillator();
  const g2 = c.createGain();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(300, t);
  o.frequency.exponentialRampToValueAtTime(1400, t + 0.22);
  env(g2, t, 0.01, 0.22, 0.12);
  o.connect(g2).connect(master);
  o.start(t);
  o.stop(t + 0.3);
}

export function sfxTarget() {
  const c = ac();
  if (!c || !master) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "triangle";
  o.frequency.setValueAtTime(880, t);
  env(g, t, 0.001, 0.09, 0.4);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.12);
}

export function sfxPortal() {
  const c = ac();
  if (!c || !master) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(220, t);
  o.frequency.exponentialRampToValueAtTime(880, t + 0.5);
  env(g, t, 0.05, 0.6, 0.5);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.7);
}

export function sfxDrain() {
  const c = ac();
  if (!c || !master) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(300, t);
  o.frequency.exponentialRampToValueAtTime(50, t + 0.5);
  env(g, t, 0.01, 0.5, 0.35);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.6);
}

export function sfxJackpot() {
  const c = ac();
  if (!c || !master) return;
  const t = c.currentTime;
  [523, 659, 784, 1046].forEach((fr, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "square";
    o.frequency.value = fr;
    env(g, t + i * 0.09, 0.005, 0.25, 0.25);
    o.connect(g).connect(master!);
    o.start(t + i * 0.09);
    o.stop(t + i * 0.09 + 0.3);
  });
}
