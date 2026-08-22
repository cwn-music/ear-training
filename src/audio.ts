import * as Tone from "tone";
import type { RhythmToken } from "./lessons";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function midiToNote(midi: number): string {
  const name = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return name + octave;
}

let sampler: Tone.Sampler | null = null;

export async function initAudio(): Promise<void> {
  if (sampler) return;
  await Tone.start();
  sampler = new Tone.Sampler({
    urls: {
      A0: "A0.mp3", C1: "C1.mp3", "D#1": "Ds1.mp3", "F#1": "Fs1.mp3",
      A1: "A1.mp3", C2: "C2.mp3", "D#2": "Ds2.mp3", "F#2": "Fs2.mp3",
      A2: "A2.mp3", C3: "C3.mp3", "D#3": "Ds3.mp3", "F#3": "Fs3.mp3",
      A3: "A3.mp3", C4: "C4.mp3", "D#4": "Ds4.mp3", "F#4": "Fs4.mp3",
      A4: "A4.mp3", C5: "C5.mp3", "D#5": "Ds5.mp3", "F#5": "Fs5.mp3",
      A5: "A5.mp3", C6: "C6.mp3", "D#6": "Ds6.mp3", "F#6": "Fs6.mp3",
      A6: "A6.mp3", C7: "C7.mp3", "D#7": "Ds7.mp3", "F#7": "Fs7.mp3",
      A7: "A7.mp3", C8: "C8.mp3",
    },
    release: 1,
    baseUrl: "https://tonejs.github.io/audio/salamander/",
  }).toDestination();
  await Tone.loaded();
}

export function playNote(midi: number): void {
  if (!sampler) return;
  sampler.triggerAttackRelease(midiToNote(midi), 1.0);
}

// 先后响起（旋律音程）
export function playInterval(midi1: number, midi2: number): void {
  if (!sampler) return;
  const now = Tone.now();
  sampler.triggerAttackRelease(midiToNote(midi1), 1.0, now);
  sampler.triggerAttackRelease(midiToNote(midi2), 1.0, now + 0.9);
}

// 同时响起（和声音程）
export function playHarmonic(midi1: number, midi2: number): void {
  if (!sampler) return;
  sampler.triggerAttackRelease([midiToNote(midi1), midiToNote(midi2)], 1.4);
}

// 一串旋律
export function playMelody(midis: number[], noteLen = 0.55): void {
  if (!sampler) return;
  const now = Tone.now();
  midis.forEach((m, i) => {
    sampler!.triggerAttackRelease(midiToNote(m), 0.5, now + i * noteLen);
  });
}

// 节奏型（用固定音高敲出来）
const RHYTHM_BEATS: Record<string, number> = {
  q: 1, e: 0.5, ee: 1, eeee: 1, h: 2, "q.": 1.5, r: 1,
};
export function playRhythm(tokens: RhythmToken[]): void {
  if (!sampler) return;
  let t = Tone.now() + 0.05;
  const beat = 0.8;
  for (const tok of tokens) {
    const dur = (RHYTHM_BEATS[tok] ?? 1) * beat;
    if (tok === "ee") {
      sampler.triggerAttackRelease("A4", 0.25, t);
      sampler.triggerAttackRelease("A4", 0.25, t + dur / 2);
    } else if (tok === "eeee") {
      for (let i = 0; i < 4; i++) {
        sampler.triggerAttackRelease("A4", 0.2, t + (i * dur) / 4);
      }
    } else if (tok !== "r") {
      sampler.triggerAttackRelease("A4", Math.min(dur * 0.9, 1.4), t);
    }
    t += dur;
  }
}

// ---------- 真实乐器采样（小提琴/长笛/小号） ----------
const INST_BASE = "https://nbrosowsky.github.io/tonejs-instruments/samples/";
const INST_URLS: Record<string, Record<string, string>> = {
  violin: {
    G3: "G3.mp3", C4: "C4.mp3", E4: "E4.mp3", G4: "G4.mp3",
    A4: "A4.mp3", C5: "C5.mp3", E5: "E5.mp3",
  },
  flute: {
    C4: "C4.mp3", E4: "E4.mp3", A4: "A4.mp3", C5: "C5.mp3", E5: "E5.mp3",
  },
  trumpet: {
    C4: "C4.mp3", "D#4": "Ds4.mp3", F4: "F4.mp3", G4: "G4.mp3",
    "A#4": "As4.mp3", D5: "D5.mp3",
  },
};
const instSamplers: Record<string, Tone.Sampler> = {};

export async function initInstruments(ids: string[]): Promise<void> {
  const pending = ids.filter((id) => id !== "piano" && INST_URLS[id] && !instSamplers[id]);
  if (pending.length === 0) return;
  await Tone.start();
  for (const id of pending) {
    instSamplers[id] = new Tone.Sampler({
      urls: INST_URLS[id],
      baseUrl: INST_BASE + id + "/",
    }).toDestination();
  }
  await Tone.loaded();
}

// 用指定乐器演奏一串旋律
export function playInstrumentMelody(id: string, midis: number[], noteLen = 0.5): void {
  const s = id === "piano" ? sampler : instSamplers[id];
  if (!s) return;
  const now = Tone.now();
  midis.forEach((m, i) => {
    s.triggerAttackRelease(midiToNote(m), 0.45, now + i * noteLen);
  });
}