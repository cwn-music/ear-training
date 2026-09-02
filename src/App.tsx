// 缪斯 Muse · 主应用
import { useEffect, useRef, useState } from 'react'
import './App.css'
import {
  LESSONS, UNITS, lessonOf,
} from './lessons'
import {
  type Question, type DirectAns, type Kind,
  displayName, solfegeOf, INTERVAL_NAMES, makeQuestion, makeSightQuestion,
  makeQuestionOfKind, LEVEL_KINDS,
  SCALE_STEPS,
} from './theory'
import {
  ensureAudio, playMelody, playHarmonic, playRhythm, playTwo, playNote,
  initInstruments, playInstrumentMelody, playFill,
} from './audio'
import Staff, { noteYOnStaff } from './Staff'
import Sing from './Sing'
import SingGroup from './SingGroup'
import Piano from './Piano'
import Learn from './Learn'

type Phase = 'home' | 'map' | 'learn' | 'playing' | 'done' | 'placementDone'

const QUIZ_COUNT = 8
const PASS_SCORE = 6

const P_PROGRESS = 'muse-progress-v1'
const P_STREAK = 'muse-streak-v1'
const P_WRONG = 'muse-wrong-v1'

function load<T>(key: string, fb: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fb
  } catch {
    return fb
  }
}
function save(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* ignore */ }
}

// —— 错题本 ——
const wrongKeyOf = (q: Question): string => q.kind
function bumpWrong(book: Record<string, number>, key: string, ok: boolean) {
  const next = { ...book }
  if (ok) {
    const v = (next[key] ?? 0) - 1
    if (v <= 0) delete next[key]
    else next[key] = v
  } else {
    next[key] = (next[key] ?? 0) + 2
  }
  save(P_WRONG, next)
  return next
}
const topWrongKeys = (book: Record<string, number>) =>
  Object.entries(book).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k]) => k)

// 补全音组题的琴键范围：选项+已给音的最小/最大各扩一个白键，两端都落在白键上（黑键开头的琴键会错位）
const isWhiteKey = (m: number) => [0, 2, 4, 5, 7, 9, 11].includes(m % 12)
const fillRange = (q: { options: number[]; seq: (number | null)[] }) => {
  const all = [...q.options, ...q.seq.filter((n): n is number => n !== null)]
  let from = Math.min(...all) - 1
  let to = Math.max(...all) + 1
  while (!isWhiteKey(from)) from--
  while (!isWhiteKey(to)) to++
  return { from, to }
}

// —— 出题去重 ——
// 题目签名：同签名视为「雷同题」。一套题内不与前两题同签名；多题型的课不连出 3 道同题型
const sigOf = (q: Question): string => {
  switch (q.kind) {
    case 'pitch':
    case 'sight': return `${q.kind}:${q.midi}`
    case 'interval': return `int:${q.semis}`
    case 'stepleap': return `sl:${q.a},${q.b}`
    case 'melody':
    case 'direct': return `${q.kind}:${q.notes.join(',')}`
    case 'rhythm': return `rh:${q.tokens.join(',')}`
    case 'meter': return `m:${q.beats}`
    case 'scale': return `sc:${q.mode}`
    case 'timbre': return `ti:${q.inst}`
    case 'pitchcmp': return `pc:${q.answer}:${Math.abs(q.b - q.a)}`
    case 'durcmp': return `dc:${q.answer}`
    case 'dyncmp': return `dy:${q.answer}`
    case 'place': return `pl:${q.midi}`
    case 'judge': return `jd:${q.midi}:${q.shown === q.midi}`
    case 'fill': return `fi:${q.seq.map(n => n ?? 'x').join(',')}`
    case 'sing': return `sg:${q.notes.join(',')}`
  }
}

function genQuiz(lv: number, count: number, boost: string[]): Question[] {
  const kinds = LEVEL_KINDS[lv] ?? ['pitch']
  const qs: Question[] = []
  for (let i = 0; i < count; i++) {
    let cand = makeQuestion(lv, boost)
    for (let t = 0; t < 30; t++) {
      const dup = qs.slice(-2).some(x => sigOf(x) === sigOf(cand))
      const kindRun3 = kinds.length > 1 && qs.length >= 2
        && qs[qs.length - 1].kind === cand.kind && qs[qs.length - 2].kind === cand.kind
      if (!dup && !kindRun3) break
      cand = makeQuestion(lv, boost)
    }
    qs.push(cand)
  }
  return qs
}

// —— 定级 ——
const PLACEMENT_LEVELS = [1, 5, 9, 14]
const PLACEMENT_TARGETS = [0, 4, 8, 13, 16]

export default function App() {
  const [phase, setPhase] = useState<Phase>('home')
  const [maxUnlocked, setMaxUnlocked] = useState(() => load(P_PROGRESS, 1))
  const [streak, setStreak] = useState(() => load(P_STREAK, { count: 0, last: '' }))
  const [wrongBook, setWrongBook] = useState<Record<string, number>>(() => load(P_WRONG, {}))
  const [level, setLevel] = useState(1)
  const [questions, setQuestions] = useState<Question[]>([])
  const [qi, setQi] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [singing, setSinging] = useState(false)
  const [singArmed, setSingArmed] = useState(false) // 跟唱是否已开始听音（孩子点「开始跟唱」后才开麦）
  const [singHold, setSingHold] = useState(false) // 唱对瞬间的定格庆祝（光条钉在音符上）
  // 跟唱结果：null=还在听；ok/heard 用于停留反馈（唱对要夸，唱错要对比）
  const [singResult, setSingResult] = useState<{ ok: boolean; heard: number | null } | null>(null)
  // 跟唱中实时听到的音（谱面光条用，null=收起来）
  const [liveHeard, setLiveHeard] = useState<number | null>(null)
  const [placementStage, setPlacementStage] = useState(0)
  const [placementHit, setPlacementHit] = useState(0)
  const [zooming, setZooming] = useState(false)
  const [syncOpen, setSyncOpen] = useState(false)
  const [syncIn, setSyncIn] = useState('')
  const [copied, setCopied] = useState(false)
  const [sessionLog, setSessionLog] = useState<{ q: Question; ok: boolean; picked: string }[]>([])
  const [reviewMode, setReviewMode] = useState(false)
  const audioReady = useRef(false)

  const q = questions[qi]
  // 定级测试中不展示答错后的停留操作（保持快节奏）
  const isPlacementNow = placementStage > 0 || questions.length === 3
  // 摆音符题的候选圈坐标（Staff 画完后回调回来，用于绝对定位热区）
  const [slotRects, setSlotRects] = useState<{ midi: number; x: number; y: number }[]>([])
  const slotRectsRef = useRef(slotRects)
  slotRectsRef.current = slotRects

  useEffect(() => {
    save(P_PROGRESS, maxUnlocked)
  }, [maxUnlocked])

  const warmup = () => {
    if (!audioReady.current) {
      audioReady.current = true
      void ensureAudio()
    }
  }

  const startLevel = (lv: number) => {
    setLevel(lv)
    setQuestions(genQuiz(lv, QUIZ_COUNT, topWrongKeys(wrongBook)))
    setQi(0)
    setScore(0)
    setPicked(null)
    setSinging(false)
    setSingArmed(false)
    setSingHold(false)
    setSingResult(null)
    setLiveHeard(null)
    setSessionLog([])
    setReviewMode(false)
    setPlacementStage(0)
    setPhase('playing')
  }

  // 只练错题：按错题本里错得最多的题型，生成同知识点的变式题（不出原题）
  const startWrongReview = () => {
    const keys = topWrongKeys(wrongBook)
    if (keys.length === 0) return
    const qs: Question[] = []
    for (let i = 0; i < QUIZ_COUNT; i++) {
      const kind = keys[i % keys.length] as Kind
      let cand = makeQuestionOfKind(kind, level)
      for (let t = 0; t < 30 && qs.slice(-2).some(x => sigOf(x) === sigOf(cand)); t++) {
        cand = makeQuestionOfKind(kind, level)
      }
      qs.push(cand)
    }
    setQuestions(qs)
    setQi(0)
    setScore(0)
    setPicked(null)
    setSinging(false)
    setSingArmed(false)
    setSingHold(false)
    setSingResult(null)
    setLiveHeard(null)
    setSessionLog([])
    setReviewMode(true)
    setPlacementStage(0)
    setPhase('playing')
  }

  const startPlacement = () => {
    setPlacementStage(0)
    setPlacementHit(0)
    runPlacementStage(0)
  }

  const runPlacementStage = (stage: number) => {
    const lv = PLACEMENT_LEVELS[stage]
    setLevel(lv)
    // 每关 3 题：2 道听力 + 1 道识谱（第 1 关用识音代替识谱）
    const qs = genQuiz(lv, 2, [])
    qs.push(lv >= 5 ? makeSightQuestion(lv) : makeQuestion(lv))
    setQuestions(qs)
    setQi(0)
    setPicked(null)
    setSinging(false)
    setSingArmed(false)
    setSingHold(false)
    setSingResult(null)
    setLiveHeard(null)
    setSessionLog([])
    setReviewMode(false)
    setPhase('playing')
  }

  const questionAnswer = (question: Question): string => {
    switch (question.kind) {
      case 'pitch': return displayName(question.midi)
      case 'sight': return displayName(question.midi)
      case 'stepleap': return question.answer === 'step' ? '级进' : '跳进'
      case 'interval': return INTERVAL_NAMES[question.semis]
      case 'melody': return question.notes.map(solfegeOf).join(' ')
      case 'rhythm': return question.tokens.join(' ')
      case 'scale': return question.mode === 'major' ? '大调' : '小调'
      case 'timbre': return question.inst
      case 'pitchcmp': return question.answer === 'up' ? '更高' : question.answer === 'down' ? '更低' : '一样高'
      case 'durcmp': return question.answer === 'longer' ? '更长' : question.answer === 'shorter' ? '更短' : '一样长'
      case 'dyncmp': return question.answer === 'louder' ? '更响' : question.answer === 'softer' ? '更轻' : '一样响'
      case 'direct': return ({ up: '上行', down: '下行', repeat: '同音反复', wave: '先上后下' } as Record<DirectAns, string>)[question.answer]
      case 'meter': return question.beats === 2 ? '二拍子' : '三拍子'
      case 'place': return displayName(question.midi)
      case 'judge': return question.shown === question.midi ? '标对了' : '标错了'
      case 'fill': return displayName(question.answer)
      case 'sing': return question.notes.map(solfegeOf).join(' ')
    }
  }

  // 旋律/节奏题的选项是 ABC 谱面，回顾时显示「选项 X」而不是原始数据
  const answerLabelOf = (question: Question): string => {
    if (question.kind === 'melody' || question.kind === 'rhythm') {
      const idx = optionOf(question).findIndex(o => isCorrect(question, o.id))
      return `选项${'ABC'[idx] ?? '?'}`
    }
    return questionAnswer(question)
  }

  // 答错后的文字诊断：不只给正确答案，还说清「你错在哪」
  const diagnosisOf = (question: Question, pickedId: string): string => {
    const pickedLabel = optionOf(question).find(o => o.id === pickedId)?.label ?? ''
    switch (question.kind) {
      case 'pitch':
      case 'sight': {
        const p = Number(pickedId)
        return `你选的是 ${displayName(p)}，比正确答案${p > question.midi ? '高' : '低'}了`
      }
      case 'interval': {
        const p = Number(pickedId)
        return `你选的是${INTERVAL_NAMES[p]}——${INTERVAL_NAMES[question.semis]}比它更${question.semis > p ? '宽' : '窄'}`
      }
      case 'stepleap':
        return question.answer === 'step'
          ? '这两个音是紧挨着的（级进），中间没有跨键'
          : '这两个音中间隔着键，是跳进'
      case 'pitchcmp':
      case 'durcmp':
      case 'dyncmp':
        return `你选的是「${pickedLabel}」，其实第二个音${questionAnswer(question)}`
      case 'scale':
        return question.mode === 'major'
          ? '这是大调——第三个音高半音，听起来明亮'
          : '这是小调——第三个音低半音，听起来柔和'
      case 'timbre':
        return `这是${questionAnswer(question)}的声音，记住它的味道`
      case 'direct':
        return `这串音其实是${questionAnswer(question)}，跟着音的起伏再听一遍`
      case 'meter':
        return question.beats === 2
          ? '强拍每隔一拍出现一次，是二拍子'
          : '强拍每隔两拍出现一次，是三拍子'
      case 'melody':
        return `你选的是${pickedLabel}，正确旋律是 ${question.notes.map(solfegeOf).join(' ')}`
      case 'rhythm':
        return `你选的是${pickedLabel}，对照标绿的节奏谱数一数拍子`
      case 'place':
        return `${displayName(question.midi)} 住在标绿的那个格子，从最近的线或间数过去`
      case 'judge':
        return question.shown === question.midi
          ? '这个音其实标对了，它的名字就是它'
          : `这个位置其实是 ${displayName(question.shown)}，不是 ${displayName(question.midi)}`
      case 'fill': {
        const p = Number(pickedId)
        return `你补的是 ${displayName(p)}，中间这个音应该是 ${displayName(question.answer)}，跟着琴键再唱一遍`
      }
      case 'sing':
        return '没关系，先点「再听一遍示范」，把三个音哼熟了再唱'
    }
  }

  const optionOf = (question: Question): { id: string; label: string; node?: React.ReactNode }[] => {
    switch (question.kind) {
      case 'pitch':
      case 'sight':
        return question.options.map(m => ({ id: String(m), label: displayName(m) }))
      case 'stepleap':
        return [{ id: 'step', label: '级进' }, { id: 'leap', label: '跳进' }]
      case 'interval':
        return question.options.map(s => ({ id: String(s), label: INTERVAL_NAMES[s] }))
      case 'melody':
        return question.options.map((v, i) => ({
          id: v.join(','),
          label: `选项${'ABC'[i]}`,
          node: <Staff clef="treble" midis={v} width={200} height={100} />,
        }))
      case 'rhythm':
        return question.options.map((v, i) => ({
          id: v.join(','),
          label: `选项${'ABC'[i]}`,
          node: <Staff clef="none" rhythm={v} width={220} height={100} />,
        }))
      case 'scale':
        return [{ id: 'major', label: '大调' }, { id: 'minor', label: '小调' }]
      case 'timbre':
        return [
          { id: 'piano', label: '钢琴' }, { id: 'violin', label: '小提琴' },
          { id: 'flute', label: '长笛' }, { id: 'trumpet', label: '小号' },
        ]
      case 'pitchcmp':
        return [
          { id: 'up', label: '更高' }, { id: 'down', label: '更低' },
          ...(level > 4 ? [{ id: 'same', label: '一样高' }] : []),
        ]
      case 'durcmp':
        return [
          { id: 'longer', label: '更长' }, { id: 'shorter', label: '更短' },
          ...(level > 4 ? [{ id: 'same', label: '一样长' }] : []),
        ]
      case 'dyncmp':
        return [
          { id: 'louder', label: '更响' }, { id: 'softer', label: '更轻' },
          ...(level > 4 ? [{ id: 'same', label: '一样响' }] : []),
        ]
      case 'direct': {
        const names: Record<DirectAns, string> = { up: '上行', down: '下行', repeat: '同音反复', wave: '先上后下' }
        return question.options.map(o => ({ id: o, label: names[o] }))
      }
      case 'meter':
        return [{ id: '2', label: '二拍子' }, { id: '3', label: '三拍子' }]
      case 'judge':
        return [{ id: 'yes', label: '标对了 ✓' }, { id: 'no', label: '标错了 ✗' }]
      case 'place': // 摆音符：点谱面上的发光圈作答，不出选项按钮
      case 'fill': // 补全音组：点琴键作答，不出选项按钮
      case 'sing': // 模唱：麦克风评测，不出选项按钮
        return []
    }
  }

  const idToValue = (question: Question, id: string): unknown => {
    switch (question.kind) {
      case 'pitch':
      case 'sight': return Number(id)
      case 'interval': return Number(id)
      case 'melody':
      case 'rhythm': return id
      case 'meter': return Number(id)
      default: return id
    }
  }

  const isCorrect = (question: Question, id: string): boolean => {
    const v = idToValue(question, id)
    switch (question.kind) {
      case 'pitch':
      case 'sight': return v === question.midi
      case 'stepleap': return v === question.answer
      case 'interval': return v === question.semis
      case 'melody': return v === question.notes.join(',')
      case 'rhythm': return v === question.tokens.join(',')
      case 'scale': return v === question.mode
      case 'timbre': return v === question.inst
      case 'pitchcmp':
      case 'durcmp':
      case 'dyncmp': return v === question.answer
      case 'direct': return v === question.answer
      case 'meter': return v === question.beats
      case 'place': return Number(id) === question.midi
      case 'judge': return (id === 'yes') === (question.shown === question.midi)
      case 'fill': return Number(id) === question.answer
      case 'sing': return id === 'sing-ok'
    }
  }

  const playQuestion = (question: Question) => {
    switch (question.kind) {
      case 'pitch': playNote(question.midi); break
      case 'sight': playNote(question.midi); break
      case 'stepleap': playMelody([question.a, question.b]); break
      case 'interval': playHarmonic([question.a, question.b]); break
      case 'melody': playMelody(question.notes); break
      case 'rhythm': playRhythm(question.tokens); break
      case 'scale': playMelody(SCALE_STEPS[question.mode].map(s => question.root + s), 0.06, 0.5); break
      case 'timbre':
        void initInstruments().then(() => playInstrumentMelody(question.inst, question.notes))
        break
      case 'pitchcmp': playTwo(question.a, question.b, { gap: 0.5 }); break
      case 'durcmp': playTwo(question.midi, question.midi, { da: question.da, db: question.db, gap: 0.4 }); break
      case 'dyncmp': playTwo(question.midi, question.midi, { va: question.va, vb: question.vb, gap: 0.5 }); break
      case 'direct': playMelody(question.notes); break
      case 'meter': playRhythm(question.tokens, 72, question.beats); break
      case 'place': playNote(question.midi); break
      case 'judge': playNote(question.shown); break
      case 'fill': playFill(question.seq); break
      case 'sing': playMelody(question.notes, 0.5, 0.7); break
    }
  }

  const promptOf = (question: Question): string => {
    switch (question.kind) {
      case 'pitch': return level <= 2 ? '看这个音、听这个音：它是？' : '听一听，这个音是？'
      case 'sight': return '看着谱子，这个音是？'
      case 'stepleap': return '这两个音是级进还是跳进？'
      case 'interval': return '一起响的两个音，音程是？'
      case 'melody': return '哪一段是你听到的旋律？'
      case 'rhythm': return '哪一段是你听到的节奏？'
      case 'scale': return '这是大调还是小调？'
      case 'timbre': return '这是哪种乐器在演奏？'
      case 'pitchcmp': return '第二个音比第一个音——'
      case 'durcmp': return '第二个音比第一个音——'
      case 'dyncmp': return '第二个音比第一个音——'
      case 'direct': return '这串音是怎么走的？'
      case 'meter': return '这段节奏是几拍子？'
      case 'place': return `听一听、点一点：把 ${displayName(question.midi)} 放到谱面上它的位置`
      case 'judge': return '谱面上这个音的名字，标对了吗？'
      case 'fill': return '这段音组缺了一个音——听一听，点琴键把它补上'
      case 'sing': return '听示范，跟着唱出这三个音（唱准一个亮一个）'
    }
  }

  // 题目切换时自动播放
  useEffect(() => {
    setSlotRects([])
    if (phase === 'playing' && q && !singing) {
      const t = setTimeout(() => playQuestion(q), 350)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, qi, singing])

  // 答错反馈的三层：结果（对错）→ 图形定位（正确项标绿）→ 文字诊断（错在哪）
  // 长内容的题（旋律/节奏等）不再自动重播，靠延长停留 + 谱面对照
  const LONG_KINDS: Kind[] = ['melody', 'rhythm', 'scale', 'timbre', 'meter', 'direct']

  const answer = (id: string) => {
    if (picked !== null || !q) return
    setPicked(id)
    const ok = isCorrect(q, id)
    const nextScore = ok ? score + 1 : score
    if (ok) setScore(nextScore)
    setWrongBook(bumpWrong(wrongBook, wrongKeyOf(q), ok))
    setSessionLog(log => [...log, { q, ok, picked: id }])

    const isPlacement = placementStage > 0 || questions.length === 3

    // 识音题答对后进入跟唱
    const needSing = ok && q.kind === 'pitch' && !isPlacement && !singing

    // 模唱题：麦克风评测刚结束，反馈停住不自动跳题，由学习者自己点「下一题」
    if (q.kind === 'sing') {
      if (!ok) window.setTimeout(() => playQuestion(q), 600) // 唱错：自动重播一遍示范
      return
    }

    // 答错（普通练习）：停住不自动跳题，等学习者消化反馈、自己点「下一题」
    // 识音/识谱题的正误对比也改为学习者点按钮播放，不再自动播
    if (!ok && !isPlacement) {
      if (q.kind !== 'pitch' && q.kind !== 'sight' && !LONG_KINDS.includes(q.kind)) {
        window.setTimeout(() => playQuestion(q), 750) // 其余短内容的题自动重播一遍题目
      }
      return
    }

    const dwell = ok
      ? (needSing ? 900 : 1200)
      : 2000 // 定级测试答错：保持快节奏

    setTimeout(() => {
      if (needSing) {
        setSingResult(null)
        setLiveHeard(null)
        setSingArmed(false) // 先停住，等孩子自己点「开始跟唱」
        setSinging(true)
        return
      }
      advance(ok, nextScore)
    }, dwell)
  }

  const advance = (ok: boolean, nextScore: number) => {
    if (singHoldTimer.current) { clearTimeout(singHoldTimer.current); singHoldTimer.current = null } // 定格期间点了跳过/下一题：取消定格
    setSinging(false)
    setSingArmed(false)
    setSingHold(false)
    setSingResult(null)
    setLiveHeard(null)
    setPicked(null)
    const isPlacement = questions.length === 3
    if (isPlacement) {
      const hit = placementHit + (ok ? 1 : 0)
      setPlacementHit(hit)
      if (qi + 1 < 3) {
        setQi(qi + 1)
        return
      }
      // 一关结束
      const passed = hit >= 2
      if (passed && placementStage + 1 < PLACEMENT_LEVELS.length) {
        const nextStage = placementStage + 1
        setPlacementStage(nextStage)
        runPlacementStage(nextStage)
      } else {
        const finalStage = passed ? placementStage + 1 : placementStage
        const target = PLACEMENT_TARGETS[finalStage]
        const lv = Math.max(1, Math.min(LESSONS.length, target || 1))
        setMaxUnlocked(Math.max(maxUnlocked, lv))
        setPhase('placementDone')
      }
      return
    }
    if (qi + 1 < questions.length) {
      setQi(qi + 1)
    } else {
      const passed = nextScore >= PASS_SCORE
      if (passed && !reviewMode) {
        const today = new Date().toISOString().slice(0, 10)
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
        const count = streak.last === today ? streak.count : streak.last === yesterday ? streak.count + 1 : 1
        const next = { count, last: today }
        setStreak(next)
        save(P_STREAK, next)
        setMaxUnlocked(Math.max(maxUnlocked, Math.min(level + 1, LESSONS.length)))
      }
      setPhase('done')
    }
  }

  // 跟唱结束：不立刻跳题，停住给明确反馈；唱错时播一遍对比（你唱的 → 正确的）
  // 唱对时先定格 1.6s：光条钉在目标音符上变绿 +「对准了！」，让孩子看到成功的一刻，再切结果卡
  const singHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const singDone = (ok: boolean, heard: number | null = null) => {
    if (!q || q.kind !== 'pitch') return
    if (ok) {
      setLiveHeard(q.midi) // 光条钉在目标音上（diff=0 → 绿色）
      setSingHold(true)
      singHoldTimer.current = setTimeout(() => {
        singHoldTimer.current = null
        setSingHold(false)
        setLiveHeard(null)
        setSingResult({ ok: true, heard })
      }, 1600)
      return
    }
    setLiveHeard(null)
    setSingResult({ ok, heard })
    if (!ok) {
      window.setTimeout(() => {
        if (heard !== null && heard !== q.midi) playTwo(heard, q.midi, { da: 0.9, db: 0.9, gap: 0.6 })
        else playNote(q.midi, 1.2, 0.9)
      }, 450)
    }
  }

  // 点击封面：放大海螺 → 进入学习地图
  const enterFromCover = () => {
    if (zooming) return
    warmup()
    setZooming(true)
    window.setTimeout(() => {
      setZooming(false)
      setPhase('map')
    }, 1150)
  }

  // —— 多设备进度同步：导出/导入同步码 ——
  const syncCode = () => {
    try {
      return btoa(JSON.stringify({ p: maxUnlocked, s: streak, w: wrongBook }))
    } catch {
      return ''
    }
  }

  const copySyncCode = () => {
    const code = syncCode()
    const done = () => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    }
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(code).then(done).catch(done)
    } else {
      done()
    }
  }

  const importSync = () => {
    try {
      const d = JSON.parse(atob(syncIn.trim())) as { p?: number; s?: { count: number; last: string }; w?: Record<string, number> }
      if (typeof d.p !== 'number' || d.p < 1 || d.p > 999) throw new Error('bad')
      localStorage.setItem(P_PROGRESS, JSON.stringify(Math.round(d.p)))
      localStorage.setItem(P_STREAK, JSON.stringify(d.s ?? { count: 0, last: '' }))
      localStorage.setItem(P_WRONG, JSON.stringify(d.w ?? {}))
      location.reload()
    } catch {
      window.alert('同步码无效，请检查后重试')
    }
  }

  // —— 渲染 ——
  const home = (
    <div className={'homePage' + (zooming ? ' zooming' : '')}>
      <button className="coverBtn" onClick={enterFromCover} aria-label="轻点海螺，进入学习">
        <span className="coverFrame">
          <span className="coverImgBox">
            <img className="hero cover" src="/muse.webp" alt="缪斯 Muse" />
            <span className="conchRipple" aria-hidden="true" />
          </span>
          <span className="coverHint">轻点海螺 · 进入学习</span>
        </span>
      </button>
      <button className="placementLink" onClick={() => { warmup(); startPlacement() }}>
        {maxUnlocked > 1 ? '重新定级测试' : '先做定级测试 · 跳过已会的内容'}
      </button>
      {streak.count > 0 && <p className="streakLine">已连续打卡 {streak.count} 天</p>}
      <div className="zoomFade" aria-hidden="true" />
    </div>
  )

  const map = (
    <div className="mapPage">
      <button className="backLink" onClick={() => setPhase('home')}>‹ 首页</button>
      <h2>学习地图</h2>
      {UNITS.map(u => (
        <div key={u.id} className="unitBlock">
          <img className="unitCover" src={`/covers/unit${u.id}.webp`} alt={u.name} />
          <h3>
            {u.name}
            <span className="unitCount">
              {u.lessonIds.filter(id => id < maxUnlocked).length} / {u.lessonIds.length} 只海螺
            </span>
          </h3>
          <div className="lessonGrid">
            {u.lessonIds.map(id => {
              const locked = id > maxUnlocked
              const done = id < maxUnlocked
              return (
                <button
                  key={id}
                  className={'lessonNode' + (locked ? ' locked' : done ? ' done' : '')}
                  disabled={locked}
                  onClick={() => { warmup(); setLevel(id); setPhase('learn') }}
                >
                  {done && <img className="badgeIcon" src="/badges/conch.png" alt="" />}
                  <span className="lessonNum">{id}</span>
                  <span className="lessonTitle">{lessonOf(id).title}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <div className="syncBox">
        <button className="placementLink" onClick={() => setSyncOpen(!syncOpen)}>
          {syncOpen ? '收起进度同步' : '进度同步 · 两台设备'}
        </button>
        {syncOpen && (
          <div className="syncPanel">
            <p className="syncTip">把这台设备的进度带到另一台：复制同步码</p>
            <div className="syncRow">
              <input readOnly value={syncCode()} onFocus={e => e.target.select()} />
              <button className="btn ghost small" onClick={copySyncCode}>{copied ? '已复制 ✓' : '复制'}</button>
            </div>
            <p className="syncTip">从另一台设备恢复进度到这里：</p>
            <div className="syncRow">
              <input placeholder="粘贴同步码" value={syncIn} onChange={e => setSyncIn(e.target.value)} />
              <button className="btn ghost small" onClick={importSync}>恢复</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  const playing = q && (
    <div className="quizPage">
      <div className="quizTop">
        <span>第 {qi + 1} / {questions.length} 题</span>
        <span>得分 {score}</span>
      </div>
      <div className="quizDots">
        {questions.map((_, i) => {
          const log = sessionLog[i]
          const cls = 'quizDot' + (log ? (log.ok ? ' done' : ' miss') : i === qi ? ' now' : '')
          return <span key={i} className={cls} />
        })}
      </div>

      {!singing ? (
        <>
          <h3 className="prompt">{promptOf(q)}</h3>
          {q.kind !== 'sing' && (
            <button className="btn ghost" onClick={() => playQuestion(q)}>▶ 再听一遍</button>
          )}

          {q.kind === 'sight' && (
            <div className="staffBox">
              <Staff clef={q.clef} midi={q.midi} width={300} />
            </div>
          )}
          {q.kind === 'pitch' && q.keys && (
            <div className="staffBox">
              {/* 第 1~2 课只认 do re mi，琴键也只给这三个 */}
              <Piano highlight={[q.midi]} label={false} from={level <= 2 ? 60 : undefined} to={level <= 2 ? 64 : undefined} />
            </div>
          )}

          {q.kind === 'place' && (
            <div className="staffBox placeWrap">
              <Staff
                clef={q.clef}
                slots={q.slots}
                width={320}
                height={158}
                placedMidi={picked !== null ? Number(picked) : null}
                revealMidi={picked !== null ? q.midi : null}
                wrongMidi={picked !== null && Number(picked) !== q.midi ? Number(picked) : null}
                onSlots={rects => {
                  const prev = slotRectsRef.current
                  if (prev.length !== rects.length || prev.some((p, i) => p.midi !== rects[i].midi)) {
                    setSlotRects(rects)
                  }
                }}
              />
              {slotRects.map(r => (
                <button
                  key={r.midi}
                  className="slotBtn"
                  style={{ left: r.x, top: r.y }}
                  disabled={picked !== null}
                  aria-label={`放到这里`}
                  onClick={() => answer(String(r.midi))}
                />
              ))}
            </div>
          )}

          {q.kind === 'judge' && (
            <div className="staffBox judgeBox">
              <Staff clef={q.clef} midi={q.shown} width={300} />
              <p className="judgeClaim">这个音是 <b>{displayName(q.midi)}</b></p>
            </div>
          )}

          {q.kind === 'fill' && (
            <div className="staffBox fillBox">
              <div className="fillSeq">
                {q.seq.map((n, i) =>
                  n === null
                    ? <span key={i} className={'fillGap' + (picked !== null ? (Number(picked) === q.answer ? ' ok' : ' no') : '')}>{picked !== null ? solfegeOf(Number(picked)) : '？'}</span>
                    : <span key={i} className="fillNote">{solfegeOf(n)}</span>,
                )}
              </div>
              <Piano
                interactive={picked === null}
                from={fillRange(q).from}
                to={fillRange(q).to}
                highlight={picked !== null ? [q.answer] : []}
                onPick={m => answer(String(m))}
              />
            </div>
          )}

          {q.kind === 'sing' && picked === null && (
            <SingGroup
              targets={q.notes}
              ghostMic={new URLSearchParams(location.search).has('ghostMic')}
              onDone={ok => answer(ok ? 'sing-ok' : 'sing-no')}
            />
          )}
          {q.kind === 'sing' && picked === null && (
            <button className="btn ghost small" onClick={() => answer('sing-no')}>跳过这一题</button>
          )}

          <div className={'options' + (q.kind === 'melody' || q.kind === 'rhythm' ? ' wide' : '')}>
            {optionOf(q).map(o => {
              const cls = picked === null
                ? 'option'
                : isCorrect(q, o.id)
                  ? 'option correct'
                  : o.id === picked
                    ? 'option wrong'
                    : 'option'
              return (
                <button key={o.id} className={cls} disabled={picked !== null} onClick={() => answer(o.id)}>
                  {o.node ?? o.label}
                </button>
              )
            })}
          </div>

          {picked !== null && (
            <div className={'feedback ' + (isCorrect(q, picked) ? 'ok' : 'no')}>
              {isCorrect(q, picked) ? (
                q.kind === 'sing' ? '答对了！三个音都唱准了' : '答对了'
              ) : (
                <>
                  <div className="fbDiag">{diagnosisOf(q, picked)}</div>
                  <div className="fbAnswer">
                    {q.kind === 'sing'
                      ? '示范已自动重播一遍，跟熟了再点下方按钮继续'
                      : q.kind === 'place'
                        ? `正确答案：${answerLabelOf(q)}（谱面上标绿的位置）`
                        : q.kind === 'fill'
                          ? `正确答案：${answerLabelOf(q)}（琴键上已亮出，声音会再播一遍）`
                          : q.kind === 'pitch' || q.kind === 'sight'
                            ? `正确答案：${answerLabelOf(q)}（已标绿，点下方按钮对比听）`
                            : `正确答案：${answerLabelOf(q)}（已标绿${!LONG_KINDS.includes(q.kind) && questions.length !== 3 ? '，声音会再播一遍' : ''}）`}
                  </div>
                  {!isPlacementNow && q.kind !== 'sing' && (
                    <div className="fbActions">
                      {(q.kind === 'pitch' || q.kind === 'sight') && (
                        <>
                          <button
                            className="btn ghost small"
                            onClick={() => { void ensureAudio().then(() => playNote(Number(picked))) }}
                          >
                            ▶ 你选的 {displayName(Number(picked))}
                          </button>
                          <button
                            className="btn ghost small"
                            onClick={() => { void ensureAudio().then(() => playNote(q.kind === 'pitch' || q.kind === 'sight' ? q.midi : 60)) }}
                          >
                            ▶ 正确的 {answerLabelOf(q)}
                          </button>
                        </>
                      )}
                      <button className="btn primary" onClick={() => advance(false, score)}>
                        {qi + 1 < questions.length ? '下一题 ›' : '查看成绩 ›'}
                      </button>
                    </div>
                  )}
                </>
              )}
              {q.kind === 'pitchcmp' && level <= 4 && (
                <Piano highlight={[q.a, q.b]} marks={{ [q.a]: '①', [q.b]: '②' }} from={Math.min(q.a, q.b) - 3} to={Math.max(q.a, q.b) + 3} label={false} />
              )}
              {q.kind === 'sing' && (
                <div className="singNextRow">
                  {!isCorrect(q, picked) && (
                    <button className="btn ghost small" onClick={() => playQuestion(q)}>▶ 再听一遍示范</button>
                  )}
                  <button className="btn primary" onClick={() => advance(isCorrect(q, picked), score)}>
                    {qi + 1 < questions.length ? '下一题 ›' : '查看成绩 ›'
                    }
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        q.kind === 'pitch' && (
          <div className="singBox">
            {singResult === null ? (
              <>
                <p>答对了！跟着把它唱出来：</p>
                <div className="singLiveWrap">
                  <Staff clef="treble" midi={q.midi} width={260} />
                  {singArmed && liveHeard !== null && (() => {
                    const y = Math.max(4, Math.min(116, noteYOnStaff(liveHeard, 'treble', 12)))
                    const diff = (((liveHeard - q.midi) % 12) + 18) % 12 - 6
                    return <span className={'pitchBar' + (Math.abs(diff) <= 0.75 ? ' ok' : '') + (singHold ? ' lock' : '')} style={{ top: y }} />
                  })()}
                </div>
                {singArmed && (singHold
                  ? <p className="liveTip singYay">对准了！唱得真好听</p>
                  : <p className="liveTip">金色光条跟着你的声音走——对齐谱上的音符、变成绿色，就是唱准了</p>)}
                <div className="staffBox">
                  <Piano highlight={[q.midi]} from={level <= 2 ? 60 : Math.min(60, q.midi)} to={level <= 2 ? 64 : Math.max(71, q.midi)} />
                </div>
                <button className="btn ghost" onClick={() => { void ensureAudio().then(() => playNote(q.midi, 1.2, 0.9)) }}>
                  ▶ 再听一遍
                </button>
                {singArmed ? (
                  <>
                    <Sing target={q.midi} ghostMic={new URLSearchParams(location.search).has('ghostMic')} onDone={singDone} onHear={setLiveHeard} />
                    <button className="btn ghost small" onClick={() => advance(true, score)}>跳过跟唱</button>
                  </>
                ) : (
                  <>
                    <button className="btn primary big" onClick={() => setSingArmed(true)}>🎤 开始跟唱</button>
                    <button className="btn ghost small" onClick={() => advance(true, score)}>跳过跟唱</button>
                  </>
                )}
              </>
            ) : singResult.ok ? (
              <>
                <p>跟着唱一遍：</p>
                <Staff clef="treble" midi={q.midi} width={260} />
                <div className="feedback ok">
                  <div className="fbDiag">唱对了！</div>
                  <div className="fbAnswer">{displayName(q.midi)} 这个音，听得准、也唱得准了</div>
                </div>
                <button className="btn primary big" onClick={() => advance(true, score)}>
                  {qi + 1 < questions.length ? '下一题 ›' : '查看成绩 ›'}
                </button>
              </>
            ) : (
              <>
                <p>跟着唱一遍：</p>
                <Staff clef="treble" midi={q.midi} width={260} />
                <div className="feedback no">
                  <div className="fbDiag">
                    {singResult.heard === null
                      ? '这次没听清你的声音'
                      : singResult.heard === q.midi
                        ? `你已经唱到 ${displayName(q.midi)} 了，只是没稳住`
                        : singResult.heard % 12 === q.midi % 12
                          ? `音名唱对了，只是高低差了一个八度`
                          : `你唱的是 ${displayName(singResult.heard)}，目标是 ${displayName(q.midi)}`}
                  </div>
                  <div className="fbAnswer">
                    {singResult.heard === null
                      ? `正确的音是 ${displayName(q.midi)}，再听一遍，跟着哼一哼`
                      : singResult.heard === q.midi
                        ? '再唱一次，把音拉长、稳住就算数'
                        : '已先后播放你唱的和正确的音，听听差在哪'}
                  </div>
                </div>
                <div>
                  <button className="btn ghost small" onClick={() => { void ensureAudio().then(() => playNote(q.midi, 1.2, 0.9)) }}>
                    ▶ 听正确的
                  </button>
                  {singResult.heard !== null && singResult.heard !== q.midi && (
                    <button className="btn ghost small" onClick={() => { void ensureAudio().then(() => playTwo(singResult.heard!, q.midi, { da: 0.9, db: 0.9, gap: 0.6 })) }}>
                      ▶ 对比再听
                    </button>
                  )}
                </div>
                <button className="btn primary" onClick={() => setSingResult(null)}>再唱一次</button>
                <div>
                  <button className="btn ghost small" onClick={() => advance(true, score)}>
                    {qi + 1 < questions.length ? '先去下一题 ›' : '先去看成绩 ›'}
                  </button>
                </div>
              </>
            )}
          </div>
        )
      )}
    </div>
  )

  const passed = score >= PASS_SCORE
  const wrongsThis = sessionLog.filter(l => !l.ok)
  const wrongKinds = topWrongKeys(wrongBook)
  const justGraduated = !reviewMode && passed && level === LESSONS.length
  const justUnlocked = !reviewMode && passed && level < LESSONS.length && maxUnlocked === level + 1
  const done = (
    <div className="donePage">
      <h2>{reviewMode ? '错题订正完成' : justGraduated ? '毕业音乐会 · 圆满结束' : passed ? '恭喜过关' : '继续努力'}</h2>
      <p className="scoreLine">{score} / {questions.length}</p>
      <p>
        {reviewMode
          ? '这组错题都订正了一遍，回地图继续吧。'
          : justGraduated
            ? '二十三课全部完成，你收集了满满一捧海螺。'
            : passed
              ? justUnlocked
                ? `下一课已解锁，你收集到第 ${level} 只海螺。`
                : '保持这个感觉，继续！'
              : `已经答对 ${score} 题啦，再对 ${PASS_SCORE - score} 题就过关。`}
      </p>
      {passed && !reviewMode && <p className="streakLine">已连续打卡 {streak.count} 天</p>}

      {justGraduated && (
        <div className="gradWall">
          {LESSONS.map(l => (
            <img key={l.id} src="/badges/conch.png" className="gradBadge" style={{ animationDelay: `${l.id * 0.07}s` }} alt="海螺徽章" />
          ))}
        </div>
      )}

      {wrongsThis.length > 0 && (
        <div className="reviewBox">
          <h3>本次错题回顾</h3>
          {wrongsThis.map((l, i) => (
            <div key={i} className="reviewRow">
              <div className="reviewText">
                <span className="reviewPrompt">{promptOf(l.q)}</span>
                <span className="reviewAns">
                  你选：{optionOf(l.q).find(o => o.id === l.picked)?.label}　·　正确：{answerLabelOf(l.q)}
                </span>
              </div>
              <button className="btn ghost small" onClick={() => playQuestion(l.q)}>▶ 重听</button>
            </div>
          ))}
        </div>
      )}

      <div className="doneBtns">
        {!reviewMode && passed && level < LESSONS.length && (
          <button className="btn primary" onClick={() => { setLevel(level + 1); setPhase('learn') }}>进入第 {level + 1} 课</button>
        )}
        {!reviewMode && (
          <button className="btn ghost" onClick={() => startLevel(level)}>再练一遍</button>
        )}
        {wrongKinds.length > 0 && (
          <button className="btn ghost" onClick={startWrongReview}>
            {reviewMode ? '再练一组错题' : `只练错题（${wrongKinds.length} 类）`}
          </button>
        )}
        <button className="btn ghost" onClick={() => setPhase('map')}>回地图</button>
      </div>
    </div>
  )

  const placementDone = (
    <div className="donePage">
      <h2>定级完成</h2>
      <p>建议从第 {maxUnlocked} 课「{lessonOf(maxUnlocked).title}」开始。</p>
      <button className="btn primary big" onClick={() => setPhase('map')}>去学习地图</button>
    </div>
  )

  return (
    <div className="appShell">
      {phase === 'home' && home}
      {phase === 'map' && map}
      {phase === 'learn' && <Learn lessonId={level} onStart={() => startLevel(level)} onBack={() => setPhase('map')} />}
      {phase === 'playing' && playing}
      {phase === 'done' && done}
      {phase === 'placementDone' && placementDone}
    </div>
  )
}
