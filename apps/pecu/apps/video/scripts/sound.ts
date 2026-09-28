/**
 * Synthesizes the soundtrack into public/soundtrack.wav. Nothing is sampled: every sound is
 * generated here and placed from src/timeline.ts, so each cue lands on the frame it belongs to.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { bento, chatOut, confirmSwap, DURATION, headlines, markerAt, outro, reveal, revealTime, turns, typeLead } from "../src/timeline";

const RATE = 48_000;
const TAU = Math.PI * 2;
const length = Math.ceil(DURATION * RATE);
const dry = [new Float32Array(length), new Float32Array(length)];
const send = new Float32Array(length);

let seed = 0x2f6b1d3;
const noise = () => {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return ((seed >>> 0) / 4_294_967_296) * 2 - 1;
};

function voice(duration: number, sample: (t: number) => number) {
  const out = new Float32Array(Math.round(duration * RATE));
  for (let i = 0; i < out.length; i++) out[i] = sample(i / RATE);
  return out;
}

/** Places a voice at `time` seconds with an equal-power pan and a reverb send. */
function place(time: number, samples: Float32Array, gain: number, pan = 0, reverb = 0.2) {
  const start = Math.round(time * RATE);
  const angle = ((pan + 1) * Math.PI) / 4;
  const [l, r] = [Math.cos(angle) * gain, Math.sin(angle) * gain];
  for (let i = 0; i < samples.length; i++) {
    const j = start + i;
    if (j < 0 || j >= length) continue;
    dry[0][j] += samples[i] * l;
    dry[1][j] += samples[i] * r;
    send[j] += samples[i] * gain * reverb;
  }
}

const lowpass = (cutoff: number) => {
  const a = 1 - Math.exp((-TAU * cutoff) / RATE);
  let y = 0;
  return (x: number) => (y += a * (x - y));
};
const highpass = (cutoff: number) => {
  const low = lowpass(cutoff);
  return (x: number) => x - low(x);
};
const attack = (t: number, seconds: number) => Math.min(1, t / seconds);

// Instruments

/** A soft mallet: fundamental plus two quick upper partials. */
const mallet = (freq: number, decay = 5.5) =>
  voice(1.2, (t) =>
    attack(t, 0.002) *
    (Math.sin(TAU * freq * t) * Math.exp(-t * decay) +
      0.3 * Math.sin(TAU * freq * 4 * t) * Math.exp(-t * 18) +
      0.1 * Math.sin(TAU * freq * 9.2 * t) * Math.exp(-t * 40)),
  );

/** A clay bloop: a short downward chirp, used when a card lands. */
function bloop(freq: number) {
  let phase = 0;
  return voice(0.25, (t) => {
    phase += (TAU * freq * (1 + 0.8 * Math.exp(-t * 55))) / RATE;
    return attack(t, 0.001) * Math.sin(phase) * Math.exp(-t * 20);
  });
}

function tick() {
  const hp = highpass(2500);
  const tone = 2600 + noise() * 300;
  return voice(0.04, (t) => (hp(noise()) * 0.8 + Math.sin(TAU * tone * t) * 0.35) * Math.exp(-t * 320));
}

function whoosh(duration: number, from: number, to: number) {
  let cutoff = from;
  const a = () => 1 - Math.exp((-TAU * cutoff) / RATE);
  let y1 = 0;
  let y2 = 0;
  return voice(duration, (t) => {
    const p = t / duration;
    cutoff = from * (to / from) ** Math.sin((p * Math.PI) / 2);
    y1 += a() * (noise() - y1);
    y2 += a() * (y1 - y2);
    return y2 * Math.sin(Math.PI * p) ** 2 * 2.2;
  });
}

const chime = (freq: number) =>
  voice(1.8, (t) =>
    attack(t, 0.003) *
    (Math.sin(TAU * freq * t) * Math.exp(-t * 2.6) +
      0.35 * Math.sin(TAU * freq * 2.76 * t) * Math.exp(-t * 5.5) +
      0.15 * Math.sin(TAU * freq * 5.4 * t) * Math.exp(-t * 11)),
  );

function kick(depth = 1) {
  let phase = 0;
  return voice(0.5, (t) => {
    phase += (TAU * (46 + 95 * depth * Math.exp(-t * 32))) / RATE;
    return attack(t, 0.001) * Math.sin(phase) * Math.exp(-t * 7);
  });
}

function shaker() {
  const hp = highpass(6000);
  return voice(0.09, (t) => hp(noise()) * attack(t, 0.006) * Math.exp(-t * 55));
}

/** A plucked bass that decays across the bar instead of gating on and off. */
const bass = (freq: number, duration: number) =>
  voice(duration + 0.2, (t) => {
    const env = attack(t, 0.02) * Math.exp(-t * 1.1) * (t < duration ? 1 : Math.exp(-(t - duration) * 25));
    return env * (Math.sin(TAU * freq * t) + 0.35 * Math.sin(TAU * freq * 2 * t) * Math.exp(-t * 3));
  });

/** Warm pad: three detuned saws per note through two gentle low-pass stages. */
function pad(freqs: number[], duration: number, rise = 1.2, fall = 1.4) {
  const voices = freqs.flatMap((freq) => [-7, 0, 7].map((cents) => ({ freq: freq * 2 ** (cents / 1200), phase: noise() * 0.5 + 0.5 })));
  const lp1 = lowpass(900);
  const lp2 = lowpass(1400);
  return voice(duration + fall, (t) => {
    let sum = 0;
    for (const v of voices) {
      v.phase = (v.phase + v.freq / RATE) % 1;
      sum += v.phase * 2 - 1;
    }
    const env = Math.min(1, t / rise) * (t < duration ? 1 : Math.exp(-(t - duration) * (3 / fall)));
    return lp2(lp1(sum / voices.length)) * env;
  });
}

// Harmony: Am7, Fmaj7, Cmaj7, G6, one chord per two-second bar.
const note = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const chords = [
  { root: 45, tones: [57, 60, 64, 67] },
  { root: 41, tones: [53, 57, 60, 64] },
  { root: 48, tones: [60, 64, 67, 71] },
  { root: 43, tones: [55, 59, 62, 64] },
];
const BAR = 2;
const arpeggio = [0, 2, 1, 3, 2, 1, 3, 2];

// Music

place(0, pad(chords[0].tones.map(note), reveal.move, 1.2), 0.16, 0, 0.35);
// The snail writes P-e-c-u.
reveal.letters.forEach((source, i) => place(revealTime(source), mallet(note([76, 79, 81, 84][i])), 0.16, -0.3 + i * 0.2, 0.4));

const grooveStart = reveal.move;
const grooveEnd = bento.expand;
for (let bar = 0; grooveStart + bar * BAR < grooveEnd; bar++) {
  const t0 = grooveStart + bar * BAR;
  const chord = chords[bar % chords.length];
  const barEnd = Math.min(BAR, grooveEnd - t0);
  place(t0, pad(chord.tones.map(note), barEnd, 0.4, 0.8), 0.09, 0, 0.35);
  place(t0, bass(note(chord.root), barEnd), 0.08, 0, 0);
  for (let beat = 0; beat < 4; beat++) {
    const t = t0 + beat * 0.5;
    if (t >= grooveEnd) break;
    if (beat % 2 === 0) place(t, kick(), 0.2, 0, 0);
    place(t + 0.25, shaker(), 0.05, beat % 2 ? 0.25 : -0.25, 0.1);
  }
  arpeggio.forEach((step, i) => {
    const t = t0 + i * 0.25;
    if (t < grooveEnd) place(t, mallet(note(chord.tones[step] + 12), 7), 0.07, i % 2 ? 0.35 : -0.35, 0.45);
  });
}

// The closing chord and a slower arpeggio on the dark frame.
const land = bento.expand + 0.65;
place(land, kick(1.4), 0.3, 0, 0.1);
place(land, bass(note(41), 2.6), 0.1, 0, 0);
place(land, pad([53, 57, 60, 64, 67].map(note), DURATION - land - 1.2, 0.3, 1.2), 0.16, 0, 0.4);
[65, 69, 72, 76, 79, 81].forEach((midi, i) => place(land + 0.5 + i * 0.5, mallet(note(midi), 4), 0.06, i % 2 ? 0.4 : -0.4, 0.5));

// Sound design

place(reveal.move, whoosh(0.8, 250, 1800), 0.1, 0.2, 0.3);

for (const turn of Object.values(turns)) {
  const typing = turn.send - typeLead - turn.type;
  for (let i = 0; i < turn.prompt.length; i++) {
    if (turn.prompt[i] === " ") continue;
    place(turn.type + (i / turn.prompt.length) * typing, tick(), 0.05, 0.3, 0.05);
  }
  place(turn.send - 0.02, whoosh(0.4, 500, 3500), 0.09, 0.3, 0.2);
  place(turn.send, bloop(880), 0.08, 0.3, 0.1);
}
[turns.balance, turns.swap, turns.stocks, turns.flows, turns.odds].forEach((turn, i) =>
  place(turn.reply, bloop([523, 587, 659, 698, 784][i]), 0.24, 0.15, 0.25),
);

for (const headline of Object.values(headlines)) place(markerAt(headline), whoosh(0.35, 900, 2600), 0.035, -0.4, 0.2);

place(confirmSwap, tick(), 0.14, 0.2, 0.05);
place(confirmSwap + 0.5, chime(note(88)), 0.12, 0.2, 0.45);
place(confirmSwap + 0.56, chime(note(95)), 0.08, 0.3, 0.45);

place(chatOut, whoosh(0.5, 300, 2400), 0.08, 0, 0.3);
[72, 74, 76, 79, 81, 84].forEach((midi, i) => place(bento.in + i * bento.stagger, bloop(note(midi)), 0.14, -0.5 + i * 0.2, 0.3));
const safeAt = bento.in + 4 * bento.stagger + 0.35;
place(safeAt + 0.3, mallet(note(84), 8), 0.07, 0, 0.3);
place(safeAt + 0.75, mallet(note(88), 8), 0.07, 0, 0.3);

place(bento.expand, whoosh(0.7, 180, 4200), 0.16, 0, 0.3);
"pecu".split("").forEach((_, i) => place(outro.wordmark + i * 0.06, mallet(note([72, 76, 79, 84][i]), 6), 0.06, -0.2 + i * 0.13, 0.4));

// A small Schroeder reverb on the send bus.
function reverb(input: Float32Array, spread: number) {
  const out = new Float32Array(input.length);
  const combs = [1557, 1617, 1491, 1422].map((d) => ({ buffer: new Float32Array(d + spread), i: 0, low: 0 }));
  const allpasses = [556, 441].map((d) => ({ buffer: new Float32Array(d + spread), i: 0 }));
  for (let n = 0; n < input.length; n++) {
    let sum = 0;
    for (const c of combs) {
      const y = c.buffer[c.i];
      c.low = y * 0.7 + c.low * 0.3;
      c.buffer[c.i] = input[n] * 0.5 + c.low * 0.82;
      c.i = (c.i + 1) % c.buffer.length;
      sum += y;
    }
    for (const a of allpasses) {
      const y = a.buffer[a.i];
      a.buffer[a.i] = sum + y * 0.5;
      a.i = (a.i + 1) % a.buffer.length;
      sum = y - sum;
    }
    out[n] = sum * 0.25;
  }
  return out;
}

const wet = [reverb(send, 0), reverb(send, 23)];
const fadeOut = 1.2;
let peak = 0;
const mix = [new Float32Array(length), new Float32Array(length)];
for (let ch = 0; ch < 2; ch++) {
  for (let n = 0; n < length; n++) {
    const t = n / RATE;
    const fade = Math.min(1, t / 0.02, (DURATION - t) / fadeOut);
    mix[ch][n] = (dry[ch][n] + wet[ch][n]) * Math.max(0, fade);
    peak = Math.max(peak, Math.abs(mix[ch][n]));
  }
}

// Gentle limiting to about -16 LUFS with headroom for the cues, then 16-bit PCM.
const drive = 0.9;
const gain = 0.8 / Math.tanh(drive);
const pcm = Buffer.alloc(44 + length * 4);
pcm.write("RIFF", 0);
pcm.writeUInt32LE(36 + length * 4, 4);
pcm.write("WAVEfmt ", 8);
pcm.writeUInt32LE(16, 16);
pcm.writeUInt16LE(1, 20);
pcm.writeUInt16LE(2, 22);
pcm.writeUInt32LE(RATE, 24);
pcm.writeUInt32LE(RATE * 4, 28);
pcm.writeUInt16LE(4, 32);
pcm.writeUInt16LE(16, 34);
pcm.write("data", 36);
pcm.writeUInt32LE(length * 4, 40);
let sumSquares = 0;
for (let n = 0; n < length; n++) {
  for (let ch = 0; ch < 2; ch++) {
    const value = Math.tanh((mix[ch][n] / peak) * drive) * gain;
    sumSquares += value * value;
    pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value)) * 32767), 44 + n * 4 + ch * 2);
  }
}

const out = path.join(import.meta.dir, "../public/soundtrack.wav");
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, pcm);
const rms = Math.sqrt(sumSquares / (length * 2));
console.log(`${out} · ${DURATION}s · RMS ${(20 * Math.log10(rms)).toFixed(1)} dBFS · pre-limit peak ${peak.toFixed(2)}`);
