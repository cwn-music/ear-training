// 课程关卡数据：三个单元共 23 课（参考法国视唱练耳教材体系）
export type Clef = "treble" | "bass";
export type EarMode = "pitch" | "stepleap" | "interval" | "melody" | "rhythm" | "scale" | "timbre";
export type RhythmToken = "q" | "e" | "ee" | "eeee" | "h" | "q." | "r";

export interface Level {
  id: number;
  unit: number;
  title: string;
  desc: string;
  notes: number[];
  intervals: number[];
  ear: EarMode;
  clefs: Clef[];
  rootMin: number;
  rootMax: number;
  review?: boolean;
  harmonic?: boolean;
  rhythms?: RhythmToken[][];
  instruments?: string[];
}

// 乐器音色（第三单元）
export interface InstrumentDef {
  id: string;
  name: string;
  desc: string;
  img: string;
}
export const INSTRUMENTS: InstrumentDef[] = [
  { id: "piano", name: "钢琴", desc: "键盘乐器之王。声音清脆明亮，每个音都像一颗饱满的水珠，余音会慢慢消散。", img: "/instruments/piano.png" },
  { id: "violin", name: "小提琴", desc: "弦乐之王。音色最接近人声，可以拉出连绵不断的长音，像在歌唱。", img: "/instruments/violin.png" },
  { id: "flute", name: "长笛", desc: "木管乐器。声音清澈悠扬，像清晨的鸟鸣，带一点流动的气息声。", img: "/instruments/flute.png" },
  { id: "trumpet", name: "小号", desc: "铜管乐器。声音嘹亮辉煌，像庆典的号角，常用来宣告重要的时刻。", img: "/instruments/trumpet.png" },
];

// 高音谱号白键：C4=60 D4=62 E4=64 F4=65 G4=67 A4=69 B4=71 C5=72 D5=74 E5=76 F5=77
// 低音谱号白键：C3=48 D3=50 E3=52 F3=53 G3=55 A3=57
const TREBLE_LOW = [60, 62, 64, 65, 67, 69, 71, 72];
const TREBLE_FULL = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77];
const CHROMATIC = [60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72];
const BASS_ALL = [48, 50, 52, 53, 55, 57];
const ALL_INTERVALS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

// 节奏型（q=四分 e=八分 ee=二八 eeee=四十六 h=二分 q.=附点四分 r=四分休止）
const RHYTHMS_BASIC: RhythmToken[][] = [
  ["q", "ee", "q", "q", "q", "ee", "q", "q"],
  ["h", "q", "q", "q", "ee", "h"],
  ["q", "q", "ee", "q", "q", "q", "ee", "q"],
  ["ee", "q", "q", "q", "q", "q", "q", "ee"],
  ["q", "r", "q", "q", "q", "q", "r", "q"],
  ["h", "h", "q", "q", "q", "q"],
  ["ee", "ee", "ee", "ee", "q", "q", "q", "q"],
];
const RHYTHMS_ADV: RhythmToken[][] = [
  ...RHYTHMS_BASIC,
  ["q.", "e", "q", "q", "q", "q.", "e", "q"],
  ["eeee", "q", "q", "q", "eeee", "q", "q"],
  ["q", "eeee", "q", "q", "q.", "e", "h"],
  ["h", "q.", "e", "eeee", "q", "q", "q"],
];

export const LEVELS: Level[] = [
  // ---------- 第一单元 · 打好基础 ----------
  { id: 0, unit: 1, title: "认识五线谱", desc: "音乐的地基：谱子怎么看", notes: [], intervals: [], ear: "pitch", clefs: ["treble"], rootMin: 53, rootMax: 65 },
  { id: 1, unit: 1, title: "第一步", desc: "Fa Sol La 三个音", notes: [65, 67, 69], intervals: [], ear: "pitch", clefs: ["treble"], rootMin: 53, rootMax: 65 },
  { id: 2, unit: 1, title: "两个新朋友", desc: "加入 Si Do · 级进与跳进", notes: [65, 67, 69, 71, 72], intervals: [], ear: "stepleap", clefs: ["treble"], rootMin: 53, rootMax: 67 },
  { id: 3, unit: 1, title: "小复习", desc: "前五个音 · 级进与跳进", notes: [65, 67, 69, 71, 72], intervals: [], ear: "stepleap", clefs: ["treble"], rootMin: 53, rootMax: 67, review: true },
  { id: 4, unit: 1, title: "向高处走", desc: "高音 Ré Mi Fa · 二度音程", notes: [65, 67, 69, 71, 72, 74, 76, 77], intervals: [1, 2], ear: "interval", clefs: ["treble"], rootMin: 50, rootMax: 62 },
  { id: 5, unit: 1, title: "向下探索", desc: "下加线 Do Ré Mi · 三度音程", notes: TREBLE_LOW, intervals: [2, 3, 4], ear: "interval", clefs: ["treble"], rootMin: 48, rootMax: 60 },
  { id: 6, unit: 1, title: "阶段复习", desc: "高音谱号全音域 · 二度三度", notes: TREBLE_FULL, intervals: [1, 2, 3, 4], ear: "interval", clefs: ["treble"], rootMin: 48, rootMax: 60, review: true },
  { id: 7, unit: 1, title: "号角与钟声", desc: "纯四度与纯五度", notes: TREBLE_FULL, intervals: [3, 4, 5, 7], ear: "interval", clefs: ["treble"], rootMin: 45, rootMax: 60 },
  { id: 8, unit: 1, title: "低音谱号", desc: "低音 Do Ré Mi · 纯八度", notes: [48, 50, 52], intervals: [5, 7, 12], ear: "interval", clefs: ["bass"], rootMin: 40, rootMax: 52 },
  { id: 9, unit: 1, title: "低音扩展", desc: "低音 Do 到 La · 六度", notes: BASS_ALL, intervals: [2, 4, 5, 7, 8, 9], ear: "interval", clefs: ["bass"], rootMin: 40, rootMax: 55 },
  { id: 10, unit: 1, title: "双谱号复习", desc: "高音谱号与低音谱号混合", notes: [...TREBLE_LOW, 48, 50, 52], intervals: [1, 2, 3, 4, 5, 7, 8, 9, 12], ear: "interval", clefs: ["treble", "bass"], rootMin: 43, rootMax: 57, review: true },
  { id: 11, unit: 1, title: "大跳挑战", desc: "七度与增四度", notes: TREBLE_FULL, intervals: [5, 6, 7, 10, 11, 12], ear: "interval", clefs: ["treble"], rootMin: 43, rootMax: 57 },
  { id: 12, unit: 1, title: "毕业总复习", desc: "第一单元全部内容", notes: [...TREBLE_FULL, ...BASS_ALL], intervals: ALL_INTERVALS, ear: "interval", clefs: ["treble", "bass"], rootMin: 40, rootMax: 57, review: true },
  // ---------- 第二单元 · 进阶之路 ----------
  { id: 13, unit: 2, title: "黑键初探", desc: "一个八度内的全部 12 个音", notes: CHROMATIC, intervals: [1, 2, 3, 4], ear: "interval", clefs: ["treble"], rootMin: 55, rootMax: 62 },
  { id: 14, unit: 2, title: "和声音程", desc: "两个音同时响起，是什么音程？", notes: TREBLE_FULL, intervals: [2, 3, 4, 5, 7, 12], ear: "interval", clefs: ["treble"], rootMin: 48, rootMax: 60, harmonic: true },
  { id: 15, unit: 2, title: "旋律填空", desc: "听旋律，补出缺失的音", notes: TREBLE_LOW, intervals: [2, 3, 4, 5, 7], ear: "melody", clefs: ["treble"], rootMin: 50, rootMax: 60 },
  { id: 16, unit: 2, title: "旋律填空 II", desc: "更长的旋律，更大的音域", notes: TREBLE_FULL, intervals: [1, 2, 3, 4, 5, 7], ear: "melody", clefs: ["treble"], rootMin: 48, rootMax: 60 },
  { id: 17, unit: 2, title: "节奏耳朵", desc: "听节奏，选出正确的节奏型", notes: TREBLE_FULL, intervals: [2, 4, 5, 7], ear: "rhythm", clefs: ["treble"], rootMin: 48, rootMax: 60, rhythms: RHYTHMS_BASIC },
  { id: 18, unit: 2, title: "节奏耳朵 II", desc: "附点与十六分音符", notes: TREBLE_FULL, intervals: [2, 4, 5, 7], ear: "rhythm", clefs: ["treble"], rootMin: 48, rootMax: 60, rhythms: RHYTHMS_ADV },
  { id: 19, unit: 2, title: "大调与小调", desc: "明亮的还是忧郁的？", notes: TREBLE_FULL, intervals: [3, 4, 8, 9], ear: "scale", clefs: ["treble"], rootMin: 48, rootMax: 60 },
  { id: 20, unit: 2, title: "第二单元复习", desc: "全部进阶内容混合", notes: [...TREBLE_LOW, ...BASS_ALL], intervals: ALL_INTERVALS, ear: "interval", clefs: ["treble", "bass"], rootMin: 43, rootMax: 57, review: true, harmonic: true },
  // ---------- 第三单元 · 缤纷音色 ----------
  { id: 21, unit: 3, title: "乐器音色 I", desc: "钢琴 · 小提琴 · 长笛 · 小号", notes: [], intervals: [], ear: "timbre", clefs: ["treble"], rootMin: 60, rootMax: 72, instruments: ["piano", "violin", "flute", "trumpet"] },
  { id: 22, unit: 3, title: "乐器音色 II", desc: "听更长的旋律，辨更细的音色", notes: [], intervals: [], ear: "timbre", clefs: ["treble"], rootMin: 60, rootMax: 72, instruments: ["piano", "violin", "flute", "trumpet"] },
];

export const UNITS: Record<number, string> = {
  1: "第一单元 · 打好基础",
  2: "第二单元 · 进阶之路",
  3: "第三单元 · 缤纷音色",
};