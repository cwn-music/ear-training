// 第一单元第2课「三个音有名字」：固定配额、会话随机与本地学习记录。

export const L2 = {
  unitId: 'muse_u1',
  unitVersion: '2.0.0',
  lessonId: 'muse_u1_l02_solfege_names',
  lessonVersion: '2.0.0',
} as const

export const L2_TASK_IDS = [
  'L02T01', 'L02T02', 'L02T03', 'L02T04',
  'L02T05', 'L02T06', 'L02T07', 'L02T08',
] as const

export const L2_PITCHES = [60, 62, 64] as const
export type L2Pitch = typeof L2_PITCHES[number]
export type L2Solfege = 'do' | 're' | 'mi'
export type L2Direction = 'up' | 'same' | 'down'
export type L2Step = 'low' | 'middle' | 'high'

export const l2SolfegeOf = (pitch: number): L2Solfege =>
  pitch === 60 ? 'do' : pitch === 62 ? 're' : 'mi'

export const l2StepOf = (pitch: number): L2Step =>
  pitch === 60 ? 'low' : pitch === 62 ? 'middle' : 'high'

export interface Lesson2Session {
  unitId: typeof L2.unitId
  unitVersion: typeof L2.unitVersion
  lessonId: typeof L2.lessonId
  lessonVersion: typeof L2.lessonVersion
  sessionId: string
  seed: number
  startedAt: string
  completedAt: string | null
  currentTaskIndex: number
  status: 'inProgress' | 'completed'
  completedTaskIds: string[]
  records: Record<string, unknown>
}

interface Lesson2Store {
  current: Lesson2Session | null
  history: Lesson2Session[]
}

export interface L2DirectionItem {
  itemId: string
  pitches: [number, number]
  relation: L2Direction
  correctOptionId: L2Direction
  optionOrder: L2Direction[]
  correctIndex: number
}

export interface L2NameItem {
  itemId: string
  pitch: number
  answerSolfege: L2Solfege
  correctOptionId: L2Solfege
  optionOrder: L2Solfege[]
  correctIndex: number
}

export interface L2KeyItem {
  itemId: string
  pitch: number
  answerSolfege: L2Solfege
  targetKey: 'left' | 'middle' | 'right'
}

export interface Lesson2Materials {
  directionItems: L2DirectionItem[]
  nameItems: L2NameItem[]
  keyItems: L2KeyItem[]
  stepOrder: number[]
  phrases: number[][]
}

export interface L2DirectionRecord {
  taskId: 'L02T01'
  itemId: string
  pitches: [number, number]
  relation: L2Direction
  optionOrder: L2Direction[]
  correctIndex: number
  firstAnswer: string
  firstAttemptCorrect: boolean
  attemptCount: number
  finalCorrect: boolean
  replayCount: number
  durationMs: number
  reviewTag: string | null
}

export interface L2NameRecord {
  taskId: 'L02T06'
  itemId: string
  pitch: number
  answerSolfege: L2Solfege
  optionOrder: L2Solfege[]
  correctIndex: number
  firstAnswer: string
  firstAttemptCorrect: boolean
  attemptCount: number
  finalCorrect: boolean
  usedReference: boolean
  replayCount: number
  durationMs: number
  reviewTag: string | null
}

export interface L2KeyRecord {
  taskId: 'L02T07'
  itemId: string
  pitch: number
  selectedKey: number
  firstSelectedKey: number
  firstAttemptCorrect: boolean
  attemptCount: number
  finalCorrect: boolean
  usedSolfegeHint: boolean
  replayCount: number
  durationMs: number
  reviewTag: string | null
}

const STORAGE_KEY = 'muse-u1-l02-v2'

function randomSeed(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const values = new Uint32Array(1)
    crypto.getRandomValues(values)
    return values[0] || 1
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
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1))
    ;[result[index], result[other]] = [result[other], result[index]]
  }
  return result
}

const directionOf = (pitches: [number, number]): L2Direction =>
  pitches[1] > pitches[0] ? 'up' : pitches[1] < pitches[0] ? 'down' : 'same'

export function buildLesson2Materials(seed: number): Lesson2Materials {
  const random = seededRandom(seed)
  const directionBase: [number, number][] = [[60, 62], [62, 62], [64, 62]]
  const directionItems = shuffle(directionBase.map((pitches, index) => ({
    itemId: `I0${index + 1}`,
    pitches: [...pitches] as [number, number],
  })), random).map(item => {
    const relation = directionOf(item.pitches)
    const optionOrder = shuffle<L2Direction>(['up', 'same', 'down'], random)
    return {
      ...item,
      relation,
      correctOptionId: relation,
      optionOrder,
      correctIndex: optionOrder.indexOf(relation),
    }
  })

  const nameItems = shuffle(L2_PITCHES.map((pitch, index) => ({
    itemId: `I0${index + 1}`,
    pitch,
  })), random).map(item => {
    const answerSolfege = l2SolfegeOf(item.pitch)
    const optionOrder = shuffle<L2Solfege>(['do', 're', 'mi'], random)
    return {
      ...item,
      answerSolfege,
      correctOptionId: answerSolfege,
      optionOrder,
      correctIndex: optionOrder.indexOf(answerSolfege),
    }
  })

  const keyItems = shuffle([62, 64, 60].map((pitch, index) => ({
    itemId: `I0${index + 1}`,
    pitch,
  })), random).map(item => ({
    ...item,
    answerSolfege: l2SolfegeOf(item.pitch),
    targetKey: item.pitch === 60 ? 'left' as const : item.pitch === 62 ? 'middle' as const : 'right' as const,
  }))

  return {
    directionItems,
    nameItems,
    keyItems,
    stepOrder: shuffle(L2_PITCHES, random),
    phrases: [[64, 62, 60], [60, 62, 64]],
  }
}

export function createLesson2Session(seed = randomSeed()): Lesson2Session {
  const now = new Date().toISOString()
  return {
    ...L2,
    sessionId: `l02-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    seed: seed >>> 0,
    startedAt: now,
    completedAt: null,
    currentTaskIndex: 0,
    status: 'inProgress',
    completedTaskIds: [],
    records: {},
  }
}

function isSession(value: unknown): value is Lesson2Session {
  if (!value || typeof value !== 'object') return false
  const session = value as Partial<Lesson2Session>
  return session.unitId === L2.unitId
    && session.unitVersion === L2.unitVersion
    && session.lessonId === L2.lessonId
    && session.lessonVersion === L2.lessonVersion
    && typeof session.sessionId === 'string'
    && typeof session.seed === 'number'
    && typeof session.startedAt === 'string'
    && typeof session.currentTaskIndex === 'number'
    && (session.status === 'inProgress' || session.status === 'completed')
    && Array.isArray(session.completedTaskIds)
    && !!session.records && typeof session.records === 'object'
}

export function loadLesson2Store(): Lesson2Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { current: null, history: [] }
    const parsed = JSON.parse(raw) as Partial<Lesson2Store>
    return {
      current: isSession(parsed.current) ? parsed.current : null,
      history: Array.isArray(parsed.history) ? parsed.history.filter(isSession) : [],
    }
  } catch {
    return { current: null, history: [] }
  }
}

export function saveLesson2Current(session: Lesson2Session | null): void {
  try {
    const store = loadLesson2Store()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...store, current: session }))
  } catch {
    // 浏览器禁用存储时不阻断本课学习。
  }
}

export function archiveLesson2Session(session: Lesson2Session | null): void {
  if (!session) return
  try {
    const store = loadLesson2Store()
    if (!store.history.some(item => item.sessionId === session.sessionId)) {
      store.history.push(session)
    }
    if (store.current?.sessionId === session.sessionId) store.current = null
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // 历史不可写时仍允许开始新会话。
  }
}
