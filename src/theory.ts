// 缪斯 Muse · 出题引擎
// 所有题型（Question 联合类型）、各级题型池、各题型生成器

export type Clef = 'treble' | 'bass'

// 节奏token：q=四分 ee=两个八分 eeee=四个十六分 h=二分 q.=附点四分 r=四分休止
export type Tok = 'q' | 'ee' | 'eeee' | 'h' | 'q.' | 'r'
export const TOK_BEATS: Record<Tok, number> = { q: 1, ee: 1, eeee: 1, h: 2, 'q.': 1.5, r: 1 }

export type InstId = 'piano' | 'violin' | 'flute' | 'trumpet'

// —— 题型定义 ——
export type PitchQ = { kind: 'pitch'; midi: number; options: number[] }
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

export type Question =
  | PitchQ | StepleapQ | IntervalQ | MelodyQ | RhythmQ | ScaleQ | TimbreQ | SightQ
  | PitchCmpQ | DurCmpQ | DynCmpQ | DirectQ | MeterQ

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

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
const SOLFEGE = ['do', 'do♯', 're', 're♯', 'mi', 'fa', 'fa♯', 'sol', 'sol♯', 'la', 'la♯', 'si']
export const nameOf = (midi: number) => NOTE_NAMES[midi % 12] + (Math.floor(midi / 12) - 1)
export const solfegeOf = (midi: number) => SOLFEGE[midi % 12]

export const INTERVAL_NAMES: Record<number, string> = {
  1: '小二度', 2: '大二度', 3: '小三度', 4: '大三度', 5: '纯四度', 6: '增四度',
  7: '纯五度', 8: '小六度', 9: '大六度', 10: '小七度', 11: '大七度', 12: '纯八度',
}

// 识音选项的音高偏移（含 ±1 半音的近似干扰项）
export const PITCH_DELTAS = [-12, -7, -5, -4, -2, -1, 1, 2, 4, 5, 7, 12]

function pitchOptions(midi: number, pool: (d: number) => boolean): number[] {
  const deltas = shuffle(PITCH_DELTAS.filter(d => pool(midi + d))).slice(0, 3)
  return shuffle([midi, ...deltas.map(d => midi + d)])
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
  const all = level >= 20
  let midi = 60
  for (let t = 0; t < 30; t++) {
    midi = rand(55, 79)
    if (all || isWhite(midi)) break
  }
  return { kind: 'pitch', midi, options: pitchOptions(midi, m => m >= 48 && m <= 83 && (all || isWhite(m))) }
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

// —— 第一批新题型生成器 ——
function genPitchCmp(level: number): PitchCmpQ {
  const gaps = level <= 4 ? [5, 7, 12] : [2, 3, 4]
  for (let t = 0; t < 30; t++) {
    const roll = Math.random()
    const answer: Cmp3 = roll < 0.42 ? 'up' : roll < 0.84 ? 'down' : 'same'
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
  const [short, long] = level <= 3 ? [0.3, 1.1] : [0.45, 0.85]
  const roll = Math.random()
  if (roll < 0.42) return { kind: 'durcmp', midi, da: short, db: long, answer: 'longer' }
  if (roll < 0.84) return { kind: 'durcmp', midi, da: long, db: short, answer: 'shorter' }
  return { kind: 'durcmp', midi, da: 0.7, db: 0.7, answer: 'same' }
}

function genDynCmp(level: number): DynCmpQ {
  const midi = rand(55, 72)
  const [soft, loud] = level <= 4 ? [0.35, 1] : [0.55, 0.85]
  const roll = Math.random()
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
  1: ['pitchcmp'],
  2: ['pitchcmp', 'pitch'],
  3: ['durcmp', 'pitchcmp'],
  4: ['dyncmp', 'durcmp'],
  5: ['sight', 'pitch'],
  6: ['interval', 'pitch'],
  7: ['interval', 'pitch'],
  8: ['interval', 'stepleap'],
  9: ['stepleap', 'direct'],
  10: ['direct', 'melody'],
  11: ['meter', 'rhythm'],
  12: ['timbre', 'pitchcmp'],
  13: ['interval', 'stepleap', 'rhythm', 'melody'],
  14: ['sight', 'pitch'],
  15: ['sight', 'pitchcmp'],
  16: ['melody', 'direct'],
  17: ['rhythm', 'meter'],
  18: ['interval', 'pitch'],
  19: ['scale', 'interval'],
  20: ['pitch', 'interval'],
  21: ['sight', 'melody'],
  22: ['sight', 'pitch'],
  23: ['pitchcmp', 'durcmp', 'dyncmp', 'direct', 'meter', 'interval', 'melody', 'rhythm', 'scale', 'timbre', 'sight', 'stepleap', 'pitch'],
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
  }
}

// 大调 / 自然小调 音阶（半音步进）
export const SCALE_STEPS: Record<'major' | 'minor', number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11, 12],
  minor: [0, 2, 3, 5, 7, 8, 10, 12],
}