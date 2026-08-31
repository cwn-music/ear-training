// 缪斯 Muse · 出题引擎
// 所有题型（Question 联合类型）、各级题型池、各题型生成器

export type Clef = 'treble' | 'bass'

// 节奏token：q=四分 ee=两个八分 eeee=四个十六分 h=二分 q.=附点四分 r=四分休止
export type Tok = 'q' | 'ee' | 'eeee' | 'h' | 'q.' | 'r' | 'e8' | 'e8.' | 'e16'
export const TOK_BEATS: Record<Tok, number> = { q: 1, ee: 1, eeee: 1, h: 2, 'q.': 1.5, r: 1, e8: 0.5, 'e8.': 0.75, e16: 0.25 }

export type InstId = 'piano' | 'violin' | 'flute' | 'trumpet'

// —— 题型定义 ——
export type PitchQ = { kind: 'pitch'; midi: number; options: number[]; keys: boolean }
export type StepleapQ = { kind: 'stepleap'; a: number; b: number; answer: 'step' | 'leap' }
export type IntervalQ = { kind: 'interval'; a: number; b: number; semis: number; options: number[] }
export type MelodyQ = { kind: 'melody'; notes: number[]; options: number[][] }
export type RhythmQ = { kind: 'rhythm'; tokens: Tok[]; options: Tok[][] }
export type ScaleQ = { kind: 'scale'; root: number; mode: 'major' | 'minor' }
export type TimbreQ = { kind: 'timbre'; inst: InstId; notes: number[] }
export type SightQ = { kind: 'sight'; midi: number; clef: Clef; options: number[] }

// —— 第一批新题型 ——
export type Cmp3 = 'up' | 'down' | 'same'
export type PitchCmpQ = { kind: 'pitchcmp'; a: number; b: number; answer: Cmp3 }
export type DurCmpQ = { kind: 'durcmp'; midi: number; da: number; db: number; answer: 'longer' | 'shorter' | 'same' }
export type DynCmpQ = { kind: 'dyncmp'; midi: number; va: number; vb: number; answer: 'louder' | 'softer' | 'same' }
export type DirectAns = 'up' | 'down' | 'repeat' | 'wave'
export type DirectQ = { kind: 'direct'; notes: number[]; answer: DirectAns; options: DirectAns[] }
export type MeterQ = { kind: 'meter'; beats: 2 | 3; tokens: Tok[] }

// —— 第二批新题型（按思维导图训练方式补充）——
// 摆音符：点击谱面上发光的候选位置，把题干给的音放上去（多邻国拖拽式的点击化改造）
export type PlaceQ = { kind: 'place'; midi: number; clef: Clef; slots: number[] }
// 位置判断：谱上画一个音并标注唱名，判断标注对不对
export type JudgeQ = { kind: 'judge'; midi: number; shown: number; clef: Clef }
// 补全音组：三个音挖掉中间一个，听出来后点琴键补上
export type FillQ = { kind: 'fill'; seq: (number | null)[]; answer: number; options: number[] }
// 三音组模唱：听三个音，跟着唱准（麦克风评测）
export type SingQ = { kind: 'sing'; notes: number[] }

export type Question =
  | PitchQ | StepleapQ | IntervalQ | MelodyQ | RhythmQ | ScaleQ | TimbreQ | SightQ
  | PitchCmpQ | DurCmpQ | DynCmpQ | DirectQ | MeterQ
  | PlaceQ | JudgeQ | FillQ | SingQ

export type Kind = Question['kind']

// —— 工具 ——
const rand = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1))
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const isWhite = (m: number) => [0, 2, 4, 5, 7, 9, 11].includes(m % 12)

// 自然音级步数（C 大调白键的线/间位置，相邻白键差 1）：谱面上下挪一格就 ±1
const DIA_STEPS = [0, 2, 4, 5, 7, 9, 11]
export function diatonicStep(midi: number): number {
  const idx = DIA_STEPS.indexOf(midi % 12)
  return Math.floor(midi / 12) * 7 + (idx < 0 ? 0 : idx)
}
// 反查：给定步数找 midi（仅白键）
export function midiOfStep(step: number): number {
  const oct = Math.floor(step / 7)
  const idx = ((step % 7) + 7) % 7
  return oct * 12 + DIA_STEPS[idx]
}

export const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
const SOLFEGE = ['do', 'do♯', 're', 're♯', 'mi', 'fa', 'fa♯', 'sol', 'sol♯', 'la', 'la♯', 'si']
export const nameOf = (midi: number) => NOTE_NAMES[midi % 12] + (Math.floor(midi / 12) - 1)
export const solfegeOf = (midi: number) => SOLFEGE[midi % 12]
// 界面展示用：只给唱名 + 音名，不带八度数字（如 do（C））
export const displayName = (midi: number) => `${solfegeOf(midi)}（${NOTE_NAMES[midi % 12]}）`

export const INTERVAL_NAMES: Record<number, string> = {
  1: '小二度', 2: '大二度', 3: '小三度', 4: '大三度', 5: '纯四度', 6: '增四度',
  7: '纯五度', 8: '小六度', 9: '大六度', 10: '小七度', 11: '大七度', 12: '纯八度',
}

// 识音选项的音高偏移（含 ±1 半音的近似干扰项）
export const PITCH_DELTAS = [-12, -7, -5, -4, -2, -1, 1, 2, 4, 5, 7, 12]

function pitchOptions(midi: number, pool: (d: number) => boolean): number[] {
  // 界面只显示唱名+音名（不带八度），所以选项的音名必须互不重复，避免两个「fa（F）」
  const seen = new Set<number>([midi % 12])
  const out: number[] = []
  for (const d of shuffle(PITCH_DELTAS)) {
    const m = midi + d
    if (!pool(m)) continue
    if (seen.has(m % 12)) continue
    seen.add(m % 12)
    out.push(m)
    if (out.length === 3) break
  }
  return shuffle([midi, ...out])
}

// —— 随机漫步旋律 ——
export function randomWalkMelody(n: number, lo: number, hi: number): number[] {
  const out = [rand(lo + 4, hi - 4)]
  for (let i = 1; i < n; i++) {
    let next = out[i - 1]
    for (let t = 0; t < 20; t++) {
      const step = pick([-4, -3, -2, -2, -1, -1, 1, 1, 2, 2, 3, 4])
      next = out[i - 1] + step
      if (next >= lo && next <= hi) break
      next = Math.min(hi, Math.max(lo, out[i - 1] - step))
    }
    out.push(next)
  }
  return out
}

// —— 各题型生成器 ——
function genPitch(level: number): PitchQ {
  // 第 1~2 课：只认 do re mi 三个白键，键盘高亮辅助（声音↔琴键↔唱名关联）
  if (level <= 2) {
    const midi = pick([60, 62, 64])
    const options = shuffle([60, 62, 64])
    return { kind: 'pitch', midi, options, keys: true }
  }
  const all = level >= 20
  let midi = 60
  for (let t = 0; t < 30; t++) {
    midi = rand(55, 79)
    if (all || isWhite(midi)) break
  }
  return { kind: 'pitch', midi, options: pitchOptions(midi, m => m >= 48 && m <= 83 && (all || isWhite(m))), keys: false }
}

function genStepleap(): StepleapQ {
  const step = Math.random() < 0.5
  const a = rand(55, 70)
  const d = step ? pick([1, 2]) : pick([3, 4, 5, 7])
  const dir = pick([-1, 1])
  const b = Math.min(79, Math.max(48, a + d * dir))
  return { kind: 'stepleap', a, b: b === a ? a + 2 : b, answer: Math.abs(b - a) <= 2 ? 'step' : 'leap' }
}

function genInterval(level: number): IntervalQ {
  let pool: number[]
  if (level === 6) pool = [1, 2]
  else if (level === 7) pool = [3, 4]
  else if (level === 8) pool = [7, 12]
  else pool = [1, 2, 3, 4, 5, 7, 8, 9, 12]
  const semis = pick(pool)
  const a = rand(50, 72 - semis)
  const b = a + semis
  const opts = new Set<number>([semis])
  const distract = shuffle(pool.filter(s => s !== semis))
  while (opts.size < Math.min(4, pool.length) && distract.length) opts.add(distract.pop()!)
  if (level >= 18) {
    const extra = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter(s => !opts.has(s)))
    while (opts.size < 4 && extra.length) opts.add(extra.pop()!)
  }
  return { kind: 'interval', a, b, semis, options: [...opts].sort((x, y) => x - y) }
}

function genMelody(level: number): MelodyQ {
  const n = level >= 16 ? pick([4, 5]) : 3
  const notes = randomWalkMelody(n, 57, 76)
  const options: number[][] = [notes]
  let guard = 0
  while (options.length < 3 && guard++ < 40) {
    const v = [...notes]
    const i = rand(0, n - 1)
    v[i] = Math.min(76, Math.max(57, v[i] + pick([-2, -1, 1, 2])))
    if (v.join() !== notes.join() && !options.some(o => o.join() === v.join())) options.push(v)
  }
  return { kind: 'melody', notes, options: shuffle(options) }
}

const RHY_BASIC: Tok[][] = [
  ['q', 'q', 'q', 'q'], ['ee', 'q', 'q', 'q'], ['q', 'ee', 'q', 'q'], ['q', 'q', 'ee', 'q'],
  ['q', 'q', 'q', 'ee'], ['ee', 'ee', 'q', 'q'], ['q', 'ee', 'ee', 'q'], ['ee', 'q', 'ee', 'q'],
  ['ee', 'q', 'q', 'ee'], ['q', 'q', 'ee', 'ee'], ['ee', 'ee', 'ee', 'q'], ['q', 'ee', 'q', 'ee'],
  ['h', 'q', 'q'], ['q', 'h', 'q'], ['q', 'q', 'h'], ['h', 'h'],
]
const RHY_ADV: Tok[][] = [
  ['q.', 'ee', 'q', 'q'], ['q', 'q.', 'ee', 'q'], ['ee', 'q.', 'ee', 'q'], ['eeee', 'q', 'q', 'q'],
  ['q', 'eeee', 'q', 'q'], ['q', 'q', 'eeee', 'q'], ['q.', 'ee', 'ee', 'q'], ['ee', 'eeee', 'q', 'q'],
  ['q', 'r', 'q', 'q'],
]
function genRhythm(level: number): RhythmQ {
  const bank = level >= 17 ? RHY_ADV : RHY_BASIC
  const tokens = pick(bank)
  const options: Tok[][] = [tokens]
  let guard = 0
  while (options.length < 3 && guard++ < 40) {
    const v = pick(bank)
    if (!options.some(o => o.join() === v.join())) options.push(v)
  }
  return { kind: 'rhythm', tokens, options: shuffle(options) }
}

function genScale(): ScaleQ {
  return { kind: 'scale', root: rand(57, 65), mode: pick(['major', 'minor'] as const) }
}

function genTimbre(): TimbreQ {
  return { kind: 'timbre', inst: pick(['piano', 'violin', 'flute', 'trumpet'] as const), notes: randomWalkMelody(3, 57, 72) }
}

export function makeSightQuestion(level: number): SightQ {
  let lo = 60, hi = 72, whiteOnly = true
  if (level >= 22) { lo = 48; hi = 76; whiteOnly = false }
  else if (level === 15) { lo = 40; hi = 55 }
  else if (level >= 14) { lo = 57; hi = 76 }
  let midi = 60
  for (let t = 0; t < 30; t++) {
    midi = rand(lo, hi)
    if (!whiteOnly || isWhite(midi)) break
  }
  const clef: Clef = midi <= 57 ? 'bass' : 'treble'
  return { kind: 'sight', midi, clef, options: pitchOptions(midi, m => m >= lo - 7 && m <= hi + 7 && (!whiteOnly || isWhite(m))) }
}

// —— 第二批新题型生成器 ——
// 摆音符 / 位置判断的音域与谱号规则和识谱题一致（第 5 课起都是白键）
function sightRange(level: number): { lo: number; hi: number } {
  if (level === 15) return { lo: 40, hi: 55 }
  if (level >= 14) return { lo: 57, hi: 76 }
  return { lo: 60, hi: 72 }
}

function genPlace(level: number): PlaceQ {
  const { lo, hi } = sightRange(level)
  let midi = 60
  for (let t = 0; t < 30; t++) {
    midi = rand(lo, hi)
    if (isWhite(midi)) break
  }
  const clef: Clef = midi <= 57 ? 'bass' : 'treble'
  // 候选位置：目标 + 上下相邻的白键格子（隔 1~3 格），共 4 个互不重复
  const step0 = diatonicStep(midi)
  const slots = new Set<number>([midi])
  for (let t = 0; t < 40 && slots.size < 4; t++) {
    const s = step0 + pick([-3, -2, -1, 1, 2, 3])
    const m = midiOfStep(s)
    if (m >= lo - 4 && m <= hi + 4) slots.add(m)
  }
  // 兜底：范围太窄时直接往上补
  for (let s = step0 + 1; slots.size < 4; s++) slots.add(midiOfStep(s))
  return { kind: 'place', midi, clef, slots: shuffle([...slots]) }
}

function genJudge(level: number): JudgeQ {
  const { lo, hi } = sightRange(level)
  let midi = 60
  for (let t = 0; t < 30; t++) {
    midi = rand(lo, hi)
    if (isWhite(midi)) break
  }
  const clef: Clef = midi <= 57 ? 'bass' : 'treble'
  // 一半概率画对；画错时挪 1~2 格白键位置（错位足够明显又不离谱）
  const right = Math.random() < 0.5
  let shown = midi
  if (!right) {
    for (let t = 0; t < 20; t++) {
      const m = midiOfStep(diatonicStep(midi) + pick([-2, -1, 1, 2]))
      if (m >= lo - 4 && m <= hi + 4 && m !== midi) { shown = m; break }
    }
    if (shown === midi) shown = midiOfStep(diatonicStep(midi) + 1)
  }
  return { kind: 'judge', midi, shown, clef }
}

function genFill(): FillQ {
  // 三音组挖中间音：级进（do _ mi）或三度跳进组合（do _ sol 这类），全部落在白键上
  // patterns 用音级步数（相邻白键差 1），保证任何根音下都是自然音
  const patterns: number[][] = [
    [0, 1, 2],   // do re mi
    [0, 2, 4],   // do mi sol
    [0, 1, 4],   // do re sol（先级进后跳进）
    [0, 2, 1],   // do mi re（先跳后级，向下回）
    [0, 4, 2],   // do sol mi
    [0, 2, 5],   // do mi la
    [0, 3, 4],   // do fa sol
  ]
  const rootStep = rand(diatonicStep(48), diatonicStep(60))
  const pat = pick(patterns)
  const seq = pat.map(s => midiOfStep(rootStep + s))
  const answer = seq[1]
  // 选项：缺音 + 邻近两个白键
  const opts = new Set<number>([answer])
  for (let t = 0; t < 20 && opts.size < 3; t++) {
    opts.add(midiOfStep(diatonicStep(answer) + pick([-2, -1, 1, 2])))
  }
  return { kind: 'fill', seq: [seq[0], null, seq[2]], answer, options: shuffle([...opts]) }
}

function genSing(): SingQ {
  // 三音组：只用白键（第 21 课还没教黑键模唱），级进为主、允许一次三度小跳，落在舒适音域
  for (let t = 0; t < 40; t++) {
    const start = midiOfStep(rand(diatonicStep(55), diatonicStep(64)))
    const d1 = pick([-2, -1, -1, 1, 1, 2]) // 白键步：±1=级进 ±2=三度
    const d2 = pick([-2, -1, -1, 1, 1, 2])
    const notes = [start, midiOfStep(diatonicStep(start) + d1), midiOfStep(diatonicStep(start) + d1 + d2)]
    if (notes.every(n => n >= 53 && n <= 67) && notes[0] !== notes[1] && notes[1] !== notes[2]) {
      return { kind: 'sing', notes }
    }
  }
  return { kind: 'sing', notes: [60, 62, 64] }
}

// —— 第一批新题型生成器 ——
function genPitchCmp(level: number): PitchCmpQ {
  // 初级（1~2 课）只用五度/八度大跨度，且不出「一样高」
  const gaps = level <= 2 ? [7, 12] : level <= 4 ? [5, 7, 12] : [2, 3, 4]
  const withSame = level > 4
  for (let t = 0; t < 30; t++) {
    const roll = Math.random()
    const answer: Cmp3 = !withSame ? (roll < 0.5 ? 'up' : 'down') : roll < 0.42 ? 'up' : roll < 0.84 ? 'down' : 'same'
    const a = rand(48, 76)
    const g = pick(gaps)
    const b = answer === 'same' ? a : answer === 'up' ? a + g : a - g
    if (b >= 45 && b <= 79) return { kind: 'pitchcmp', a, b, answer }
  }
  const a = 60
  return { kind: 'pitchcmp', a, b: 67, answer: 'up' }
}

function genDurCmp(level: number): DurCmpQ {
  const midi = rand(55, 72)
  const [short, long] = level <= 4 ? [0.3, 1.1] : [0.45, 0.85]
  const withSame = level > 4
  const roll = Math.random()
  if (roll < 0.5 || !withSame) {
    return roll < 0.25 || !withSame && roll < 0.5
      ? { kind: 'durcmp', midi, da: short, db: long, answer: 'longer' }
      : { kind: 'durcmp', midi, da: long, db: short, answer: 'shorter' }
  }
  if (roll < 0.8) return { kind: 'durcmp', midi, da: short, db: long, answer: 'longer' }
  if (roll < 0.9) return { kind: 'durcmp', midi, da: long, db: short, answer: 'shorter' }
  return { kind: 'durcmp', midi, da: 0.7, db: 0.7, answer: 'same' }
}

function genDynCmp(level: number): DynCmpQ {
  const midi = rand(55, 72)
  const [soft, loud] = level <= 4 ? [0.35, 1] : [0.55, 0.85]
  const withSame = level > 4
  const roll = Math.random()
  if (!withSame) {
    return roll < 0.5
      ? { kind: 'dyncmp', midi, va: soft, vb: loud, answer: 'louder' }
      : { kind: 'dyncmp', midi, va: loud, vb: soft, answer: 'softer' }
  }
  if (roll < 0.42) return { kind: 'dyncmp', midi, va: soft, vb: loud, answer: 'louder' }
  if (roll < 0.84) return { kind: 'dyncmp', midi, va: loud, vb: soft, answer: 'softer' }
  return { kind: 'dyncmp', midi, va: 0.7, vb: 0.7, answer: 'same' }
}

function genDirect(level: number): DirectQ {
  const withWave = level >= 16
  const options: DirectAns[] = withWave ? ['up', 'down', 'repeat', 'wave'] : ['up', 'down', 'repeat']
  const pool: DirectAns[] = withWave ? ['up', 'up', 'down', 'down', 'repeat', 'wave'] : ['up', 'up', 'down', 'down', 'repeat']
  const answer = pick(pool)
  const n = answer === 'repeat' ? 3 : withWave ? 4 : pick([3, 4])
  const lo = 57, hi = 76
  if (answer === 'repeat') {
    const m = rand(lo + 4, hi - 4)
    return { kind: 'direct', notes: [m, m, m], answer, options }
  }
  if (answer === 'up' || answer === 'down') {
    const dir = answer === 'up' ? 1 : -1
    for (let t = 0; t < 30; t++) {
      const start = rand(lo + 5, hi - 5)
      const notes = [start]
      let ok = true
      for (let i = 1; i < n; i++) {
        const next = notes[i - 1] + dir * pick([1, 2, 2, 3])
        if (next < lo || next > hi) { ok = false; break }
        notes.push(next)
      }
      if (ok) return { kind: 'direct', notes, answer, options }
    }
    return { kind: 'direct', notes: answer === 'up' ? [60, 62, 64] : [64, 62, 60], answer, options }
  }
  // wave：先上后下
  for (let t = 0; t < 30; t++) {
    const start = rand(lo + 2, hi - 10)
    const s1 = pick([2, 3]), s2 = pick([2, 3]), s3 = pick([1, 2, 3])
    const notes = [start, start + s1, start + s1 + s2, start + s1 + s2 - s3]
    if (notes[3] <= hi && notes[3] !== notes[2]) return { kind: 'direct', notes, answer, options }
  }
  return { kind: 'direct', notes: [60, 63, 65, 63], answer, options }
}

const METER2: Tok[][] = [['q', 'q'], ['ee', 'q'], ['q', 'ee'], ['ee', 'ee'], ['h']]
const METER3: Tok[][] = [['q', 'q', 'q'], ['ee', 'q', 'q'], ['q', 'ee', 'q'], ['q', 'q', 'ee'], ['h', 'q'], ['q', 'h']]
function genMeter(): MeterQ {
  const beats = pick([2, 3] as const)
  const bar = pick(beats === 2 ? METER2 : METER3)
  return { kind: 'meter', beats, tokens: [...bar, ...bar] }
}

// —— 各级题型池 ——
export const LEVEL_KINDS: Record<number, Kind[]> = {
  1: ['pitch'],
  2: ['pitchcmp', 'pitch'],
  3: ['durcmp'],
  4: ['dyncmp'],
  5: ['sight', 'pitch', 'place', 'judge'],
  6: ['interval', 'pitch'],
  7: ['interval', 'pitch'],
  8: ['interval', 'stepleap'],
  9: ['stepleap', 'direct', 'fill'],
  10: ['direct', 'melody'],
  11: ['meter', 'rhythm'],
  12: ['timbre', 'pitchcmp'],
  13: ['interval', 'stepleap', 'rhythm', 'melody', 'fill'],
  14: ['sight', 'pitch', 'place', 'judge'],
  15: ['sight', 'pitchcmp', 'place', 'judge'],
  16: ['melody', 'direct'],
  17: ['rhythm', 'meter'],
  18: ['interval', 'pitch'],
  19: ['scale', 'interval'],
  20: ['pitch', 'interval'],
  21: ['sight', 'melody', 'sing'],
  22: ['sight', 'pitch'],
  23: ['pitchcmp', 'durcmp', 'dyncmp', 'direct', 'meter', 'interval', 'melody', 'rhythm', 'scale', 'timbre', 'sight', 'stepleap', 'pitch', 'place', 'judge', 'fill'],
}

// 按指定题型生成一题（错题重练用：只抽错题题型，生成同知识点变式题）
export function makeQuestionOfKind(kind: Kind, level: number): Question {
  switch (kind) {
    case 'pitch': return genPitch(level)
    case 'stepleap': return genStepleap()
    case 'interval': return genInterval(level)
    case 'melody': return genMelody(level)
    case 'rhythm': return genRhythm(level)
    case 'scale': return genScale()
    case 'timbre': return genTimbre()
    case 'sight': return makeSightQuestion(level)
    case 'pitchcmp': return genPitchCmp(level)
    case 'durcmp': return genDurCmp(level)
    case 'dyncmp': return genDynCmp(level)
    case 'direct': return genDirect(level)
    case 'meter': return genMeter()
    case 'place': return genPlace(level)
    case 'judge': return genJudge(level)
    case 'fill': return genFill()
    case 'sing': return genSing()
  }
}

export function makeQuestion(level: number, wrongBoost?: string[]): Question {
  const kinds = LEVEL_KINDS[level] ?? ['pitch']
  let kind: Kind
  if (wrongBoost && wrongBoost.length > 0 && Math.random() < 0.5) {
    const inPool = wrongBoost.filter(k => (kinds as string[]).includes(k))
    kind = (inPool.length > 0 ? pick(inPool) : pick(kinds)) as Kind
  } else {
    kind = pick(kinds)
  }
  return makeQuestionOfKind(kind, level)
}

// 大调 / 自然小调 音阶（半音步进）
export const SCALE_STEPS: Record<'major' | 'minor', number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11, 12],
  minor: [0, 2, 3, 5, 7, 8, 10, 12],
}
