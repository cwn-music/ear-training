import { INSTRUMENTS } from "./lessons";
import type { Level, Clef, EarMode, RhythmToken } from "./lessons";

// 12 个音程
export interface IntervalDef {
  semitones: number;
  name: string;
}
export const INTERVALS: IntervalDef[] = [
  { semitones: 1, name: "小二度" },
  { semitones: 2, name: "大二度" },
  { semitones: 3, name: "小三度" },
  { semitones: 4, name: "大三度" },
  { semitones: 5, name: "纯四度" },
  { semitones: 6, name: "增四度" },
  { semitones: 7, name: "纯五度" },
  { semitones: 8, name: "小六度" },
  { semitones: 9, name: "大六度" },
  { semitones: 10, name: "小七度" },
  { semitones: 11, name: "大七度" },
  { semitones: 12, name: "纯八度" },
];

// 固定唱名（含变化音，用升号）
const SOLFEGE: Record<number, string> = {
  0: "Do", 1: "Do♯", 2: "Re", 3: "Re♯", 4: "Mi", 5: "Fa",
  6: "Fa♯", 7: "Sol", 8: "Sol♯", 9: "La", 10: "La♯", 11: "Si",
};
const WHITE_NAMES = ["Do", "Re", "Mi", "Fa", "Sol", "La", "Si"];
const ALL_NAMES = Object.values(SOLFEGE);

export function midiToSolfege(midi: number): string {
  return SOLFEGE[midi % 12] ?? "?";
}

// 关卡里如果有黑键音，选项就用全部 12 个唱名，否则只用 7 个白键唱名
function namePool(level: Level): string[] {
  const hasAccidental = level.notes.some(
    (n) => ![0, 2, 4, 5, 7, 9, 11].includes(n % 12)
  );
  return hasAccidental ? ALL_NAMES : WHITE_NAMES;
}

export interface IntervalQuestion {
  kind: "interval";
  midi1: number;
  midi2: number;
  harmonic?: boolean;
  answer: string;
  options: string[];
  wrongKey: string;
}
export interface NoteQuestion {
  kind: "note";
  midi: number;
  clef: Clef;
  answer: string;
  options: string[];
  wrongKey: string;
}
export interface SingQuestion {
  kind: "sing";
  midi: number;
  clef: Clef;
  answer: string;
  options: string[];
  wrongKey: string;
}
export interface PitchQuestion {
  kind: "pitch";
  midi1: number;
  midi2: number;
  answer: string;
  options: string[];
  wrongKey: string;
}
export interface StepLeapQuestion {
  kind: "stepleap";
  midi1: number;
  midi2: number;
  answer: string;
  options: string[];
  wrongKey: string;
}
export interface MelodyQuestion {
  kind: "melody";
  notes: number[];
  gapIndex: number;
  clef: Clef;
  answer: string;
  options: string[];
  wrongKey: string;
}
export interface RhythmQuestion {
  kind: "rhythm";
  tokens: RhythmToken[];
  answer: string;
  options: string[];
  wrongKey: string;
}
export interface ScaleQuestion {
  kind: "scale";
  midis: number[];
  answer: string;
  options: string[];
  wrongKey: string;
}
export interface TimbreQuestion {
  kind: "timbre";
  instrument: string;
  midis: number[];
  answer: string;
  options: string[];
  wrongKey: string;
}
export type AnyQuestion =
  | IntervalQuestion
  | NoteQuestion
  | SingQuestion
  | PitchQuestion
  | StepLeapQuestion
  | MelodyQuestion
  | RhythmQuestion
  | ScaleQuestion
  | TimbreQuestion;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function weightedPick<T>(items: T[], weight: (t: T) => number): T {
  const ws = items.map(weight);
  const total = ws.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= ws[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pickTwoNotes(rootMin: number, rootMax: number, delta: number): [number, number] {
  for (let tries = 0; tries < 30; tries++) {
    const a = randInt(rootMin, rootMax);
    const b = a + delta;
    if (b >= 36 && b <= 84) return [a, b];
  }
  return [60, 60 + delta];
}

function pickOptions(answer: string, pool: string[], count: number): string[] {
  const opts = new Set<string>([answer]);
  let guard = 0;
  while (opts.size < Math.min(count, pool.length) && guard < 100) {
    opts.add(pool[Math.floor(Math.random() * pool.length)]);
    guard++;
  }
  return shuffle([...opts]);
}

// ---------- 音程命名 ----------
export function generateIntervalQuestion(
  level: Level,
  wrongStats: Record<string, number>
): IntervalQuestion {
  const pool = INTERVALS.filter((i) => level.intervals.includes(i.semitones));
  const interval = weightedPick(pool, (i) => 1 + (wrongStats["i" + i.semitones] ?? 0) * 2);
  const [midi1, midi2] = pickTwoNotes(level.rootMin, level.rootMax, interval.semitones);
  return {
    kind: "interval",
    midi1,
    midi2,
    harmonic: level.harmonic === true,
    answer: interval.name,
    options: pickOptions(interval.name, pool.map((p) => p.name), 4),
    wrongKey: "i" + interval.semitones,
  };
}

// ---------- 识谱 ----------
export function generateNoteQuestion(
  level: Level,
  wrongStats: Record<string, number>
): NoteQuestion {
  const midi = weightedPick(level.notes, (n) => 1 + (wrongStats["n" + n] ?? 0) * 2);
  const clef = level.clefs[Math.floor(Math.random() * level.clefs.length)];
  const answer = midiToSolfege(midi);
  return {
    kind: "note",
    midi,
    clef,
    answer,
    options: pickOptions(answer, namePool(level), 4),
    wrongKey: "n" + midi,
  };
}

// ---------- 跟唱 ----------
export function generateSingQuestion(
  level: Level,
  wrongStats: Record<string, number>
): SingQuestion {
  const midi = weightedPick(level.notes, (n) => 1 + (wrongStats["s" + n] ?? 0) * 2);
  const clef = level.clefs[Math.floor(Math.random() * level.clefs.length)];
  return {
    kind: "sing",
    midi,
    clef,
    answer: midiToSolfege(midi),
    options: [],
    wrongKey: "s" + midi,
  };
}

// ---------- 高低听辨 ----------
export function generatePitchQuestion(
  level: Level,
  _wrongStats: Record<string, number>
): PitchQuestion {
  const same = Math.random() < 0.2;
  let midi1 = randInt(level.rootMin, level.rootMax);
  let midi2 = midi1;
  if (!same) {
    const deltas = [-12, -7, -5, -4, -2, -1, 1, 2, 4, 5, 7, 12];
    [midi1, midi2] = pickTwoNotes(
      level.rootMin,
      level.rootMax,
      deltas[Math.floor(Math.random() * deltas.length)]
    );
  }
  const answer = same ? "相同" : midi2 > midi1 ? "更高" : "更低";
  return {
    kind: "pitch",
    midi1,
    midi2,
    answer,
    options: shuffle(["更高", "更低", "相同"]),
    wrongKey: "pitch",
  };
}

// ---------- 级进跳进 ----------
export function generateStepLeapQuestion(
  level: Level,
  _wrongStats: Record<string, number>
): StepLeapQuestion {
  const step = Math.random() < 0.5;
  const pool = step ? [1, 2, -1, -2] : [3, 4, 5, 7, -3, -4, -5, -7];
  const [midi1, midi2] = pickTwoNotes(
    level.rootMin,
    level.rootMax,
    pool[Math.floor(Math.random() * pool.length)]
  );
  return {
    kind: "stepleap",
    midi1,
    midi2,
    answer: step ? "级进" : "跳进",
    options: shuffle(["级进", "跳进"]),
    wrongKey: step ? "step" : "leap",
  };
}

// 在音符池里随机漫步出一条旋律
function randomWalkMelody(pool: number[], len: number): number[] {
  const sorted = [...pool].sort((a, b) => a - b);
  const notes: number[] = [sorted[Math.floor(Math.random() * sorted.length)]];
  while (notes.length < len) {
    const prev = notes[notes.length - 1];
    const dir = Math.random() < 0.5 ? -1 : 1;
    const step = [1, 2, 2, 3, 4][Math.floor(Math.random() * 5)] * dir;
    let best = sorted[0];
    for (const n of sorted) {
      if (Math.abs(n - (prev + step)) < Math.abs(best - (prev + step))) best = n;
    }
    notes.push(best);
  }
  return notes;
}

// ---------- 旋律填空听写 ----------
export function generateMelodyQuestion(
  level: Level,
  _wrongStats: Record<string, number>
): MelodyQuestion {
  const len = level.id >= 16 ? 5 : 4;
  const notes = randomWalkMelody(level.notes, len);
  const gapIndex = randInt(1, len - 2);
  const answer = midiToSolfege(notes[gapIndex]);
  return {
    kind: "melody",
    notes,
    gapIndex,
    clef: level.clefs[0],
    answer,
    options: pickOptions(answer, namePool(level), 4),
    wrongKey: "m" + notes[gapIndex],
  };
}

// ---------- 节奏听写 ----------
const RHYTHM_LABEL: Record<string, string> = {
  q: "♩", e: "♪", ee: "♫", eeee: "♬♬", h: "𝅗", "q.": "♩.", r: "𝄽",
};
const RHYTHM_BEATS: Record<string, number> = {
  q: 1, e: 0.5, ee: 1, eeee: 1, h: 2, "q.": 1.5, r: 1,
};
export function rhythmToText(tokens: RhythmToken[]): string {
  let out = "";
  let beats = 0;
  for (const t of tokens) {
    if (beats > 0 && beats % 4 === 0) out += " │ ";
    out += (out === "" || out.endsWith("│ ") ? "" : " ") + RHYTHM_LABEL[t];
    beats += RHYTHM_BEATS[t];
  }
  return out;
}

export function generateRhythmQuestion(
  level: Level,
  wrongStats: Record<string, number>
): RhythmQuestion {
  const pool = level.rhythms ?? [];
  const tokens = weightedPick(pool, (t) => 1 + (wrongStats["r" + t.join("")] ?? 0) * 2);
  const answer = rhythmToText(tokens);
  const other = pool.filter((t) => rhythmToText(t) !== answer);
  const opts = new Set<string>([answer]);
  let guard = 0;
  while (opts.size < Math.min(4, pool.length) && other.length > 0 && guard < 100) {
    opts.add(rhythmToText(other[Math.floor(Math.random() * other.length)]));
    guard++;
  }
  return {
    kind: "rhythm",
    tokens,
    answer,
    options: shuffle([...opts]),
    wrongKey: "r" + tokens.join(""),
  };
}

// ---------- 大小调音阶听辨 ----------
export function generateScaleQuestion(
  level: Level,
  _wrongStats: Record<string, number>
): ScaleQuestion {
  const major = Math.random() < 0.5;
  const tonic = randInt(level.rootMin, level.rootMax);
  const steps = major ? [0, 2, 4, 5, 7, 9, 11, 12] : [0, 2, 3, 5, 7, 8, 10, 12];
  return {
    kind: "scale",
    midis: steps.map((s) => tonic + s),
    answer: major ? "大调" : "小调",
    options: ["大调", "小调"],
    wrongKey: "scale",
  };
}

// ---------- 乐器音色听辨 ----------
export function generateTimbreQuestion(
  level: Level,
  wrongStats: Record<string, number>
): TimbreQuestion {
  const ids = level.instruments ?? ["piano"];
  const inst = weightedPick(ids, (id) => 1 + (wrongStats["t" + id] ?? 0) * 2);
  const len = level.id >= 22 ? 6 : 5;
  const midis = randomWalkMelody([60, 62, 64, 65, 67, 69, 71, 72], len);
  const found = INSTRUMENTS.find((i) => i.id === inst);
  const answer = found ? found.name : inst;
  return {
    kind: "timbre",
    instrument: inst,
    midis,
    answer,
    options: shuffle(
      ids.map((id) => {
        const d = INSTRUMENTS.find((i) => i.id === id);
        return d ? d.name : id;
      })
    ),
    wrongKey: "t" + inst,
  };
}

// ---------- 一组 10 题 ----------
function generateEarQuestion(level: Level, w: Record<string, number>): AnyQuestion {
  switch (level.ear) {
    case "interval":
      return generateIntervalQuestion(level, w);
    case "stepleap":
      return generateStepLeapQuestion(level, w);
    case "melody":
      return generateMelodyQuestion(level, w);
    case "rhythm":
      return generateRhythmQuestion(level, w);
    case "scale":
      return generateScaleQuestion(level, w);
    case "timbre":
      return generateTimbreQuestion(level, w);
    default:
      return generatePitchQuestion(level, w);
  }
}

export function generateSession(
  level: Level,
  wrongStats: Record<string, number>
): AnyQuestion[] {
  const qs: AnyQuestion[] = [];
  if (level.notes.length === 0) {
    for (let i = 0; i < 10; i++) qs.push(generateEarQuestion(level, wrongStats));
    return qs;
  }
  for (let i = 0; i < 10; i++) {
    if (i % 3 === 2) qs.push(generateSingQuestion(level, wrongStats));
    else if (i % 2 === 0) qs.push(generateNoteQuestion(level, wrongStats));
    else qs.push(generateEarQuestion(level, wrongStats));
  }
  return qs;
}

// ---------- 程度测试：12 题，由易到难 ----------
function testLevel(
  notes: number[],
  intervals: number[],
  ear: EarMode,
  rootMin: number,
  rootMax: number,
  clefs: Clef[]
): Level {
  return { id: 0, unit: 1, title: "", desc: "", notes, intervals, ear, clefs, rootMin, rootMax };
}

export function generatePlacement(
  wrongStats: Record<string, number>
): AnyQuestion[] {
  const TREBLE_FULL = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77];
  const easy = testLevel([65, 67, 69, 71, 72], [], "pitch", 53, 65, ["treble"]);
  const mid = testLevel(TREBLE_FULL, [], "pitch", 48, 60, ["treble"]);
  const bass = testLevel([48, 50, 52, 53, 55, 57], [], "pitch", 40, 55, ["bass"]);
  return [
    generatePitchQuestion(easy, wrongStats),
    generatePitchQuestion(easy, wrongStats),
    generateStepLeapQuestion(easy, wrongStats),
    generateStepLeapQuestion(easy, wrongStats),
    generateNoteQuestion(easy, wrongStats),
    generateNoteQuestion(easy, wrongStats),
    generateNoteQuestion(mid, wrongStats),
    generateNoteQuestion(bass, wrongStats),
    generateIntervalQuestion(testLevel([], [1, 2], "interval", 50, 62, ["treble"]), wrongStats),
    generateIntervalQuestion(testLevel([], [3, 4], "interval", 50, 60, ["treble"]), wrongStats),
    generateIntervalQuestion(testLevel([], [5, 7], "interval", 48, 60, ["treble"]), wrongStats),
    generateIntervalQuestion(testLevel([], [12], "interval", 48, 60, ["treble"]), wrongStats),
  ];
}