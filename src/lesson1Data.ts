// 缪斯 Muse · 第一单元第1课：固定配额、可复现出题与本地学习会话

export const L1 = {
  unitId: 'muse_u1',
  unitVersion: '2.0.0',
  lessonId: 'muse_u1_l01_pitch_height',
  lessonVersion: '2.0.0',
} as const

export const L1_TASK_IDS = [
  'L01T01', 'L01T02', 'L01T03', 'L01T04',
  'L01T05', 'L01T06', 'L01T07', 'L01T08',
] as const

// 本课已经学习的三个音；所有随机材料都只从这三个音中抽取。
export const L1_LEARNED_PITCHES = [60, 62, 64] as const

export type ChoiceTaskId = 'L01T02' | 'L01T03' | 'L01T04' | 'L01T05'
export type ChoiceKind = 'compare' | 'sameDifferent' | 'direction'
export type ComparisonDirection = 'secondToFirst' | 'firstToSecond'
export type L1Timbre = 'felt_piano' | 'flute'

export interface ChoiceOption {
  id: string
  label: string
}

export interface ChoiceItem {
  itemId: string
  pitches: [number, number]
  relation: string
  comparisonDirection?: ComparisonDirection
  correctOptionId: string
  optionOrder: string[]
  correctIndex: number
}

export interface ChoiceTaskConfig {
  taskId: ChoiceTaskId
  kind: ChoiceKind
  title: string
  guide: string
  timbre: L1Timbre
  options: ChoiceOption[]
  items: ChoiceItem[]
}

export interface ChoiceRecord {
  taskId: ChoiceTaskId
  itemId: string
  pitches: [number, number]
  relation: string
  comparisonDirection?: ComparisonDirection
  correctOptionId: string
  optionOrder: string[]
  correctIndex: number
  firstAnswer: string
  firstAttemptCorrect: boolean
  attemptCount: number
  finalCorrect: boolean
  replayCount: number
  durationMs: number
  timbre: L1Timbre
  reviewTag: string | null
}

export interface Lesson1Session {
  unitId: typeof L1.unitId
  unitVersion: typeof L1.unitVersion
  lessonId: typeof L1.lessonId
  lessonVersion: typeof L1.lessonVersion
  sessionId: string
  seed: number
  startedAt: string
  completedAt: string | null
  currentTaskIndex: number
  status: 'inProgress' | 'completed'
  completedTaskIds: string[]
  records: Record<string, unknown>
}

interface Lesson1Store {
  current: Lesson1Session | null
  history: Lesson1Session[]
}

const STORAGE_KEY = 'muse-u1-l01-v2'

function randomSeed(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    return crypto.getRandomValues(new Uint32Array(1))[0] || 1
  }
  return Math.floor(Math.random() * 0xffffffff) || 1
}

function seededRandom(seed: number): () => number {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let t = value
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function pickRandom<T>(values: readonly T[], random: () => number): T {
  return values[Math.floor(random() * values.length)]!
}

function relationOf(kind: ChoiceKind, pitches: [number, number]): string {
  const [a, b] = pitches
  if (kind === 'sameDifferent') return a === b ? 'same' : 'different'
  if (kind === 'direction') return b > a ? 'up' : b < a ? 'down' : 'same'
  return b > a ? 'higher' : b < a ? 'lower' : 'same'
}

const COMPARE_OPTIONS: ChoiceOption[] = [
  { id: 'higher', label: '更高' },
  { id: 'same', label: '相同' },
  { id: 'lower', label: '更低' },
]
const SAME_OPTIONS: ChoiceOption[] = [
  { id: 'same', label: '相同' },
  { id: 'different', label: '不同' },
]
const DIRECTION_OPTIONS: ChoiceOption[] = [
  { id: 'up', label: '上行' },
  { id: 'same', label: '同音' },
  { id: 'down', label: '下行' },
]

const BASE_TASKS: Record<ChoiceTaskId, Omit<ChoiceTaskConfig, 'items'> & { items: [number, number][] }> = {
  L01T02: {
    taskId: 'L01T02',
    kind: 'compare',
    title: '第二个音和第一个音相比？',
    guide: '先听完整，再选择；两个音可能一样高。',
    timbre: 'felt_piano',
    options: COMPARE_OPTIONS,
    items: [[60, 64], [64, 64], [64, 60]],
  },
  L01T03: {
    taskId: 'L01T03',
    kind: 'compare',
    title: '第二个音和第一个音相比？',
    guide: '这次换成长笛的声音，耳朵要做的事没有变。',
    timbre: 'flute',
    options: COMPARE_OPTIONS,
    items: [[60, 62], [62, 62], [64, 62]],
  },
  L01T04: {
    taskId: 'L01T04',
    kind: 'sameDifferent',
    title: '两个音完全相同吗？',
    guide: '这次只判断“相同”或“不同”。',
    timbre: 'felt_piano',
    options: SAME_OPTIONS,
    items: [[64, 64], [62, 60]],
  },
  L01T05: {
    taskId: 'L01T05',
    kind: 'direction',
    title: '从第一个音到第二个音，声音怎样走？',
    guide: '可能往上、往下，也可能没有移动。',
    timbre: 'felt_piano',
    options: DIRECTION_OPTIONS,
    items: [[60, 62], [62, 62], [64, 62]],
  },
}

function pairsForRelation(kind: ChoiceKind, relation: string): [number, number][] {
  const pairs = L1_LEARNED_PITCHES.flatMap(first =>
    L1_LEARNED_PITCHES.map(second => [first, second] as [number, number]),
  )
  return pairs.filter(pair => relationOf(kind, pair) === relation)
}

export function buildLesson1ChoiceTasks(seed: number): Record<ChoiceTaskId, ChoiceTaskConfig> {
  const random = seededRandom(seed)
  const result = {} as Record<ChoiceTaskId, ChoiceTaskConfig>
  for (const taskId of ['L01T02', 'L01T03', 'L01T04', 'L01T05'] as const) {
    const base = BASE_TASKS[taskId]
    const materials = shuffle(base.items.map((example, index) => {
      const relation = relationOf(base.kind, example)
      const pitches = pickRandom(pairsForRelation(base.kind, relation), random)
      return {
        itemId: `I0${index + 1}`,
        pitches: [...pitches] as [number, number],
      }
    }), random)
    // 比较题每组保留两种问法：其中一题反向问“第一个音与第二个音相比”。
    // 提问方向只改变正确选项，不改变原始音高材料及其三类配额。
    const comparisonDirections = base.kind === 'compare'
      ? shuffle<ComparisonDirection>(['secondToFirst', 'secondToFirst', 'firstToSecond'], random)
      : []
    const items = materials.map((item, index) => {
      const relation = relationOf(base.kind, item.pitches)
      const comparisonDirection = base.kind === 'compare'
        ? comparisonDirections[index]
        : undefined
      const correctOptionId = comparisonDirection === 'firstToSecond'
        ? relation === 'higher' ? 'lower' : relation === 'lower' ? 'higher' : relation
        : relation
      const optionOrder = shuffle(base.options.map(option => option.id), random)
      return {
        ...item,
        relation,
        ...(comparisonDirection ? { comparisonDirection } : {}),
        correctOptionId,
        optionOrder,
        correctIndex: optionOrder.indexOf(correctOptionId),
      }
    })
    result[taskId] = { ...base, items }
  }
  return result
}

export function buildLesson1SoundSteps(seed: number): number[] {
  // 高、中、低各出现一次，只随机先后顺序，保留原台阶拖放规则。
  const random = seededRandom((seed ^ 0x51ed270b) >>> 0)
  return shuffle(L1_LEARNED_PITCHES, random)
}

export interface Lesson1EchoMaterials {
  singleRounds: number[][]
  phrase: number[]
}

export function buildLesson1EchoMaterials(seed: number): Lesson1EchoMaterials {
  const random = seededRandom((seed ^ 0x2f6e2b1d) >>> 0)
  const singleRounds = shuffle(L1_LEARNED_PITCHES, random)
    .slice(0, 2)
    .map(pitch => [pitch])

  // 保留“三个音中有两个同音”的任务配额，但同音音高、另一个音及其位置都会变化。
  const repeatedPitch = pickRandom(L1_LEARNED_PITCHES, random)
  const otherPitch = pickRandom(L1_LEARNED_PITCHES.filter(pitch => pitch !== repeatedPitch), random)
  const otherPosition = Math.floor(random() * 3)
  const phrase = [repeatedPitch, repeatedPitch, repeatedPitch]
  phrase[otherPosition] = otherPitch
  return { singleRounds, phrase }
}

export function createLesson1Session(seed = randomSeed()): Lesson1Session {
  const now = new Date().toISOString()
  return {
    ...L1,
    sessionId: `l01-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    seed: seed >>> 0,
    startedAt: now,
    completedAt: null,
    currentTaskIndex: 0,
    status: 'inProgress',
    completedTaskIds: [],
    records: {},
  }
}

function isSession(value: unknown): value is Lesson1Session {
  if (!value || typeof value !== 'object') return false
  const s = value as Partial<Lesson1Session>
  return s.lessonId === L1.lessonId
    && s.lessonVersion === L1.lessonVersion
    && typeof s.sessionId === 'string'
    && typeof s.seed === 'number'
    && typeof s.currentTaskIndex === 'number'
    && Array.isArray(s.completedTaskIds)
    && !!s.records && typeof s.records === 'object'
}

export function loadLesson1Store(): Lesson1Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { current: null, history: [] }
    const parsed = JSON.parse(raw) as Partial<Lesson1Store>
    return {
      current: isSession(parsed.current) ? parsed.current : null,
      history: Array.isArray(parsed.history) ? parsed.history.filter(isSession) : [],
    }
  } catch {
    return { current: null, history: [] }
  }
}

export function saveLesson1Current(session: Lesson1Session | null): void {
  try {
    const store = loadLesson1Store()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...store, current: session }))
  } catch {
    // 浏览器禁用存储时仍允许完成本次学习，不影响音乐反馈。
  }
}

export function archiveLesson1Session(session: Lesson1Session | null): void {
  if (!session) return
  try {
    const store = loadLesson1Store()
    if (!store.history.some(item => item.sessionId === session.sessionId)) {
      store.history.push(session)
    }
    if (store.current?.sessionId === session.sessionId) store.current = null
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // 历史不可写时不阻断新课。
  }
}
