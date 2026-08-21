import type { Level, Clef, EarMode } from "./lessons";

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

// 固定唱名（白键）
const SOLFEGE: Record<number, string> = {
  0: "Do", 2: "Re", 4: "Mi", 5: "Fa", 7: "Sol", 9: "La", 11: "Si",
};
export function midiToSolfege(midi: number): string {
  return SOLFEGE[midi % 12] ?? "?";
}

export interface IntervalQuestion {
  kind: "interval";
  midi1: number;
  midi2: number;
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
export type AnyQuestion =
  | IntervalQuestion
  | NoteQuestion
  | SingQuestion
  | PitchQuestion
  | StepLeapQuestion;

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

// 在 rootMin~rootMax 里选一个起始音，加上 delta 后不超出合理音域
function pickTwoNotes(rootMin: number, rootMax: number, delta: number): [number, number] {
  for (let tries = 0; tries < 30; tries++) {
    const a = randInt(rootMin, rootMax);
    const b = a + delta;
    if (b >= 36 && b <= 84) return [a, b];
  }
  return [60, 60 + delta];
}

export function generateIntervalQuestion(
  level: Level,
  wrongStats: Record<string, number>
): IntervalQuestion {
  const pool = INTERVALS.filter((i) => level.intervals.includes(i.semitones));
  const interval = weightedPick(
    pool,
    (i) => 1 + (wrongStats["i" + i.semitones] ?? 0) * 2
  );
  const [midi1, midi2] = pickTwoNotes(level.rootMin, level.rootMax, interval.semitones);
  const names = new Set<string>([interval.name]);
  while (names.size < Math.min(4, pool.length)) {
    names.add(pool[Math.floor(Math.random() * pool.length)].name);
  }
  return {
    kind: "interval",
    midi1,
    midi2,
    answer: interval.name,
    options: shuffle([...names]),
    wrongKey: "i" + interval.semitones,
  };
}

export function generateNoteQuestion(
  level: Level,
  wrongStats: Record<string, number>
): NoteQuestion {
  const midi = weightedPick(level.notes, (n) => 1 + (wrongStats["n" + n] ?? 0) * 2);
  const clef = level.clefs[Math.floor(Math.random() * level.clefs.length)];
  const answer = midiToSolfege(midi);
  const all = ["Do", "Re", "Mi", "Fa", "Sol", "La", "Si"];
  const opts = new Set<string>([answer]);
  while (opts.size < 4) {
    opts.add(all[Math.floor(Math.random() * all.length)]);
  }
  return {
    kind: "note",
    midi,
    clef,
    answer,
    options: shuffle([...opts]),
    wrongKey: "n" + midi,
  };
}

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

// 高低听辨：第二个音更高 / 更低 / 相同
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

// 级进跳进听辨：级进 = 二度以内挨着走；跳进 = 三度以上
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

// 一组 10 题：识谱 4、练耳 3、跟唱 3（入门课没有音符，全部练耳）
export function generateSession(
  level: Level,
  wrongStats: Record<string, number>
): AnyQuestion[] {
  const ear = (lv: Level, w: Record<string, number>): AnyQuestion =>
    lv.ear === "interval"
      ? generateIntervalQuestion(lv, w)
      : lv.ear === "stepleap"
        ? generateStepLeapQuestion(lv, w)
        : generatePitchQuestion(lv, w);

  const qs: AnyQuestion[] = [];
  if (level.notes.length === 0) {
    for (let i = 0; i < 10; i++) qs.push(ear(level, wrongStats));
    return qs;
  }
  for (let i = 0; i < 10; i++) {
    if (i % 3 === 2) qs.push(generateSingQuestion(level, wrongStats));
    else if (i % 2 === 0) qs.push(generateNoteQuestion(level, wrongStats));
    else qs.push(ear(level, wrongStats));
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
  return { id: 0, title: "", desc: "", notes, intervals, ear, clefs, rootMin, rootMax };
}

export function generatePlacement(
  wrongStats: Record<string, number>
): AnyQuestion[] {
  const easy = testLevel([65, 67, 69, 71, 72], [], "pitch", 53, 65, ["treble"]);
  const mid = testLevel(
    [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77],
    [],
    "pitch",
    48,
    60,
    ["treble"]
  );
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