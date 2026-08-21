// 乐理引擎：音用 MIDI 数字表示（中央 C = 60）

export interface IntervalDef {
  semitones: number; // 半音数
  name: string;
}

export const INTERVALS: IntervalDef[] = [
  { semitones: 1, name: "小二度" },
  { semitones: 2, name: "大二度" },
  { semitones: 3, name: "小三度" },
  { semitones: 4, name: "大三度" },
  { semitones: 5, name: "纯四度" },
  { semitones: 6, name: "三全音" },
  { semitones: 7, name: "纯五度" },
  { semitones: 8, name: "小六度" },
  { semitones: 9, name: "大六度" },
  { semitones: 10, name: "小七度" },
  { semitones: 11, name: "大七度" },
  { semitones: 12, name: "纯八度" },
];

export interface Question {
  root: number; // 根音 MIDI
  answer: IntervalDef;
  options: IntervalDef[];
}

// level 控制解锁多少种音程；wrongStats 让答错过的内容更高频出现
export function generateQuestion(
  level: number,
  wrongStats: Record<string, number>
): Question {
  const pool = INTERVALS.slice(0, Math.min(2 + level, INTERVALS.length));

  // 错题加权：每错一次，权重 +1
  const weighted = pool.flatMap((iv) => {
    const w = 1 + (wrongStats[iv.name] ?? 0);
    return Array(w).fill(iv);
  });
  const answer = weighted[Math.floor(Math.random() * weighted.length)];

  // 根音随机落在 C3–B3
  const root = 48 + Math.floor(Math.random() * 12);

  // 选项：答案 + 最多 3 个干扰项，按半音数排序展示
  const others = pool.filter((iv) => iv.name !== answer.name);
  const distractors = others.sort(() => Math.random() - 0.5).slice(0, 3);
  const options = [...distractors, answer].sort(
    (a, b) => a.semitones - b.semitones
  );

  return { root, answer, options };
}

// ---------- 识谱模式 ----------

// 音名 → 唱名（固定唱名法，C = Do）
const SOLFEGE: Record<number, string> = {
  0: "Do",
  2: "Re",
  4: "Mi",
  5: "Fa",
  7: "Sol",
  9: "La",
  11: "Si",
};

export function midiToSolfege(midi: number): string {
  return SOLFEGE[midi % 12] ?? "?";
}

// 第 1 关音池：Fa Sol La Si Do（同《法国儿童视唱教程》第 1 课的五个音）
export const NOTE_POOL = [65, 67, 69, 71, 72]; // F4 G4 A4 B4 C5

export interface NoteQuestion {
  midi: number; // 要认的音
  answer: string; // 正确唱名
  options: string[]; // 4 个选项
}

export function generateNoteQuestion(
  wrongStats: Record<string, number>
): NoteQuestion {
  // 错题加权
  const weighted = NOTE_POOL.flatMap((m) =>
    Array(1 + (wrongStats[midiToSolfege(m)] ?? 0)).fill(m)
  );
  const midi = weighted[Math.floor(Math.random() * weighted.length)];
  const answer = midiToSolfege(midi);

  const allNames = ["Do", "Re", "Mi", "Fa", "Sol", "La", "Si"];
  const distractors = allNames
    .filter((n) => n !== answer)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
  const options = [...distractors, answer].sort(() => Math.random() - 0.5);

  return { midi, answer, options };
}