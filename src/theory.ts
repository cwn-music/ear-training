import type { Level, Clef } from "./lessons";

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
export type AnyQuestion = IntervalQuestion | NoteQuestion;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 加权随机：错过越多的内容，出现概率越高
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

export function generateIntervalQuestion(
  level: Level,
  wrongStats: Record<string, number>
): IntervalQuestion {
  const pool = INTERVALS.filter((i) => level.intervals.includes(i.semitones));
  const interval = weightedPick(
    pool,
    (i) => 1 + (wrongStats["i" + i.semitones] ?? 0) * 2
  );
  const span = level.rootMax - level.rootMin;
  const midi1 = level.rootMin + Math.floor(Math.random() * (span + 1));
  const midi2 = midi1 + interval.semitones;
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
  const midi = weightedPick(
    level.notes,
    (n) => 1 + (wrongStats["n" + n] ?? 0) * 2
  );
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

// 一组 10 题：识谱与练耳交替出现
export function generateSession(
  level: Level,
  wrongStats: Record<string, number>
): AnyQuestion[] {
  const qs: AnyQuestion[] = [];
  for (let i = 0; i < 10; i++) {
    qs.push(
      i % 2 === 0
        ? generateNoteQuestion(level, wrongStats)
        : generateIntervalQuestion(level, wrongStats)
    );
  }
  return qs;
}