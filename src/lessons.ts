// 课程关卡数据：入门课 + 12 课，循序渐进（参考法国视唱练耳教材体系）
// ear: 练耳题的题型
//   "pitch"    = 高低听辨（第二个音更高/更低/相同）
//   "stepleap" = 级进跳进听辨（两个音是挨着走还是跳着走）
//   "interval" = 音程命名
export type Clef = "treble" | "bass";
export type EarMode = "pitch" | "stepleap" | "interval";

export interface Level {
  id: number;
  title: string;
  desc: string;
  notes: number[];
  intervals: number[];
  ear: EarMode;
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
  { id: 0, title: "认识五线谱", desc: "音乐的地基：谱子怎么看", notes: [], intervals: [], ear: "pitch", clefs: ["treble"], rootMin: 53, rootMax: 65 },
  { id: 1, title: "第一步", desc: "Fa Sol La 三个音", notes: [65, 67, 69], intervals: [], ear: "pitch", clefs: ["treble"], rootMin: 53, rootMax: 65 },
  { id: 2, title: "两个新朋友", desc: "加入 Si Do · 级进与跳进", notes: [65, 67, 69, 71, 72], intervals: [], ear: "stepleap", clefs: ["treble"], rootMin: 53, rootMax: 67 },
  { id: 3, title: "小复习", desc: "前五个音 · 级进与跳进", notes: [65, 67, 69, 71, 72], intervals: [], ear: "stepleap", clefs: ["treble"], rootMin: 53, rootMax: 67, review: true },
  { id: 4, title: "向高处走", desc: "高音 Ré Mi Fa · 二度音程", notes: [65, 67, 69, 71, 72, 74, 76, 77], intervals: [1, 2], ear: "interval", clefs: ["treble"], rootMin: 50, rootMax: 62 },
  { id: 5, title: "向下探索", desc: "下加线 Do Ré Mi · 三度音程", notes: TREBLE_LOW, intervals: [2, 3, 4], ear: "interval", clefs: ["treble"], rootMin: 48, rootMax: 60 },
  { id: 6, title: "阶段复习", desc: "高音谱号全音域 · 二度三度", notes: TREBLE_FULL, intervals: [1, 2, 3, 4], ear: "interval", clefs: ["treble"], rootMin: 48, rootMax: 60, review: true },
  { id: 7, title: "号角与钟声", desc: "纯四度与纯五度", notes: TREBLE_FULL, intervals: [3, 4, 5, 7], ear: "interval", clefs: ["treble"], rootMin: 45, rootMax: 60 },
  { id: 8, title: "低音谱号", desc: "低音 Do Ré Mi · 纯八度", notes: [48, 50, 52], intervals: [5, 7, 12], ear: "interval", clefs: ["bass"], rootMin: 40, rootMax: 52 },
  { id: 9, title: "低音扩展", desc: "低音 Do 到 La · 六度", notes: BASS_ALL, intervals: [2, 4, 5, 7, 8, 9], ear: "interval", clefs: ["bass"], rootMin: 40, rootMax: 55 },
  { id: 10, title: "双谱号复习", desc: "高音谱号与低音谱号混合", notes: [...TREBLE_LOW, 48, 50, 52], intervals: [1, 2, 3, 4, 5, 7, 8, 9, 12], ear: "interval", clefs: ["treble", "bass"], rootMin: 43, rootMax: 57, review: true },
  { id: 11, title: "大跳挑战", desc: "七度与增四度", notes: TREBLE_FULL, intervals: [5, 6, 7, 10, 11, 12], ear: "interval", clefs: ["treble"], rootMin: 43, rootMax: 57 },
  { id: 12, title: "毕业总复习", desc: "第一年全部内容", notes: [...TREBLE_FULL, ...BASS_ALL], intervals: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], ear: "interval", clefs: ["treble", "bass"], rootMin: 40, rootMax: 57, review: true },
];