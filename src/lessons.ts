// 课程关卡数据：12 课，循序渐进（参考法国视唱练耳教材体系）
// notes: 该课识谱题允许出现的音（MIDI 音高）
// intervals: 该课练耳题允许出现的音程（半音数）
// rootMin/rootMax: 练耳题起始音范围
// clefs: 识谱题使用的谱号
// review: 复习课（不引入新内容）

export type Clef = "treble" | "bass";

export interface Level {
  id: number;
  title: string;
  desc: string;
  notes: number[];
  intervals: number[];
  clefs: Clef[];
  rootMin: number;
  rootMax: number;
  review?: boolean;
}

// 高音谱号白键：C4=60 D4=62 E4=64 F4=65 G4=67 A4=69 B4=71 C5=72 D5=74 E5=76 F5=77
// 低音谱号白键：C3=48 D3=50 E3=52 F3=53 G3=55 A3=57
const TREBLE_LOW = [60, 62, 64, 65, 67, 69, 71, 72];
const TREBLE_FULL = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77];
const BASS_ALL = [48, 50, 52, 53, 55, 57];

export const LEVELS: Level[] = [
  {
    id: 1,
    title: "第一步",
    desc: "Fa Sol La 三个音 · 二度音程",
    notes: [65, 67, 69],
    intervals: [1, 2],
    clefs: ["treble"],
    rootMin: 53,
    rootMax: 60,
  },
  {
    id: 2,
    title: "两个新朋友",
    desc: "加入 Si Do · 三度音程",
    notes: [65, 67, 69, 71, 72],
    intervals: [1, 2, 3, 4],
    clefs: ["treble"],
    rootMin: 53,
    rootMax: 60,
  },
  {
    id: 3,
    title: "小复习",
    desc: "前五个音 · 二度与三度",
    notes: [65, 67, 69, 71, 72],
    intervals: [1, 2, 3, 4],
    clefs: ["treble"],
    rootMin: 53,
    rootMax: 62,
    review: true,
  },
  {
    id: 4,
    title: "向高处走",
    desc: "高音 Ré Mi Fa · 四五度",
    notes: [65, 67, 69, 71, 72, 74, 76, 77],
    intervals: [2, 3, 4, 5, 7],
    clefs: ["treble"],
    rootMin: 50,
    rootMax: 60,
  },
  {
    id: 5,
    title: "向下探索",
    desc: "下加线 Do Ré Mi · 六度",
    notes: TREBLE_LOW,
    intervals: [2, 4, 5, 7, 8, 9],
    clefs: ["treble"],
    rootMin: 48,
    rootMax: 57,
  },
  {
    id: 6,
    title: "阶段复习",
    desc: "高音谱号全音域",
    notes: TREBLE_FULL,
    intervals: [1, 2, 3, 4, 5, 7, 8, 9],
    clefs: ["treble"],
    rootMin: 48,
    rootMax: 57,
    review: true,
  },
  {
    id: 7,
    title: "大跳挑战",
    desc: "七度音程",
    notes: TREBLE_FULL,
    intervals: [5, 7, 8, 9, 10, 11],
    clefs: ["treble"],
    rootMin: 45,
    rootMax: 57,
  },
  {
    id: 8,
    title: "低音谱号",
    desc: "低音 Do Ré Mi · 纯八度",
    notes: [48, 50, 52],
    intervals: [4, 5, 7, 12],
    clefs: ["bass"],
    rootMin: 40,
    rootMax: 50,
  },
  {
    id: 9,
    title: "低音扩展",
    desc: "低音 Do 到 La",
    notes: BASS_ALL,
    intervals: [2, 4, 5, 7, 9, 12],
    clefs: ["bass"],
    rootMin: 40,
    rootMax: 50,
  },
  {
    id: 10,
    title: "双谱号复习",
    desc: "高音谱号与低音谱号混合",
    notes: [...TREBLE_LOW, 48, 50, 52],
    intervals: [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12],
    clefs: ["treble", "bass"],
    rootMin: 43,
    rootMax: 55,
    review: true,
  },
  {
    id: 11,
    title: "增四度陷阱",
    desc: "最有个性的音程来了",
    notes: TREBLE_FULL,
    intervals: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    clefs: ["treble"],
    rootMin: 43,
    rootMax: 55,
  },
  {
    id: 12,
    title: "毕业总复习",
    desc: "第一年全部内容",
    notes: [...TREBLE_FULL, ...BASS_ALL],
    intervals: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    clefs: ["treble", "bass"],
    rootMin: 40,
    rootMax: 57,
    review: true,
  },
];