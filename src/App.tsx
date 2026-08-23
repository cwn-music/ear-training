// 缪斯 Muse · 主程序
import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import './App.css'
import Staff from './Staff'
import Sing from './Sing'
import { renderBody } from './Learn'
import { LESSONS, UNITS, lessonOf, INSTRUMENTS } from './lessons'
import type { DirectAns, Kind, Question } from './theory'
import { INTERVAL_NAMES, SCALE_STEPS, makeQuestion, makeSightQuestion, nameOf, solfegeOf } from './theory'
import { ensureAudio, initInstruments, playInstrumentMelody, playMelody, playNote, playRhythm, playScaleNotes, playTwo } from './audio'

type Phase = 'home' | 'map' | 'learn' | 'playing' | 'done' | 'placementDone'

const QUIZ_COUNT = 8
const PASS_SCORE = 6
const PLACEMENT_LEVELS = [1, 5, 9, 14]
const PLACEMENT_TARGETS = [0, 4, 8, 13, 16]

// —— 本地存储 ——
const loadNum = (k: string, d: number) => {
  try {
    const v = localStorage.getItem(k)
    return v === null ? d : Number(v)
  } catch {
    return d
  }
}
const saveNum = (k: string, v: number) => {
  try {
    localStorage.setItem(k, String(v))
  } catch {
    /* 忽略 */
  }
}

interface Streak {
  last: string
  count: number
}
const loadStreak = (): Streak => {
  try {
    const v = localStorage.getItem('muse-streak-v1')
    return v ? (JSON.parse(v) as Streak) : { last: '', count: 0 }
  } catch {
    return { last: '', count: 0 }
  }
}
const loadWrong = (): Record<string, number> => {
  try {
    const v = localStorage.getItem('muse-wrong-v1')
    return v ? (JSON.parse(v) as Record<string, number>) : {}
  } catch {
    return {}
  }
}

function todayKey(d = new Date()) {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

const KIND_LABEL: Record<Kind, string> = {
  pitch: '识音', stepleap: '级进跳进', interval: '音程', melody: '旋律', rhythm: '节奏',
  scale: '音阶', timbre: '音色', sight: '视唱',
  pitchcmp: '高低比较', durcmp: '长短比较', dyncmp: '强弱比较', direct: '旋律走向', meter: '拍号',
}

export default function App() {
  const [phase, setPhase] = useState<Phase>('home')
  const [unlocked, setUnlocked] = useState(() => Math.max(1, loadNum('muse-progress-v1', 1)))
  const [streak, setStreak] = useState<Streak>(loadStreak)
  const [wrong, setWrong] = useState<Record<string, number>>(loadWrong)
  const [level, setLevel] = useState(1)

  // 答题流程
  const [quiz, setQuiz] = useState<Question[]>([])
  const [idx, setIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [singing, setSinging] = useState(false)

  // 定级测试
  const [plGate, setPlGate] = useState(-1)
  const [plPassed, setPlPassed] = useState(0)
  const [placing, setPlacing] = useState(false)

  const q = quiz[idx]

  const recordWrong = useCallback((kind: Kind, correct: boolean) => {
    setWrong(w => {
      const next = { ...w }
      next[kind] = (next[kind] ?? 0) + (correct ? -1 : 2)
      if (next[kind] <= 0) delete next[kind]
      try {
        localStorage.setItem('muse-wrong-v1', JSON.stringify(next))
      } catch {
        /* 忽略 */
      }
      return next
    })
  }, [])

  const playQuestion = useCallback((question: Question) => {
    void ensureAudio().then(() => {
      switch (question.kind) {
        case 'pitch':
          playNote(question.midi)
          break
        case 'stepleap':
          playTwo(question.a, question.b, { gap: 0.5 })
          break
        case 'interval':
          playTwo(question.a, question.b, { gap: 0.45 })
          break
        case 'melody':
          playMelody(question.notes, 0.4)
          break
        case 'rhythm':
          playRhythm(question.tokens)
          break
        case 'scale':
          playScaleNotes(question.root, SCALE_STEPS[question.mode])
          break
        case 'timbre':
          void initInstruments().then(() => playInstrumentMelody(question.inst, question.notes))
          break
        case 'pitchcmp':
          playTwo(question.a, question.b)
          break
        case 'durcmp':
          playTwo(question.midi, question.midi, { da: question.da, db: question.db })
          break
        case 'dyncmp':
          playTwo(question.midi, question.midi, { va: question.va, vb: question.vb })
          break
        case 'direct':
          playMelody(question.notes, 0.32)
          break
        case 'meter':
          playRhythm(question.tokens, 72, question.beats)
          break
        case 'sight':
          break
      }
    })
  }, [])

  // 换题自动播放
  useEffect(() => {
    if (phase === 'playing' && q) {
      const t = window.setTimeout(() => playQuestion(q), 350)
      return () => window.clearTimeout(t)
    }
  }, [phase, idx, q, playQuestion])

  const topWrongKeys = () =>
    Object.entries(wrong)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([k]) => k)

  function startQuiz(lv: number, placement = false) {
    setLevel(lv)
    const qs: Question[] = []
    if (placement) {
      // 定级：每关 3 题（2 听 + 1 识音）
      for (let i = 0; i < 2; i++) {
        let x = makeQuestion(lv)
        let guard = 0
        while (x.kind === 'sight' && guard++ < 10) x = makeQuestion(lv)
        qs.push(x)
      }
      qs.push(makeSightQuestion(lv))
    } else {
      const boost = topWrongKeys()
      for (let i = 0; i < QUIZ_COUNT; i++) qs.push(makeQuestion(lv, boost))
    }
    setQuiz(qs)
    setIdx(0)
    setScore(0)
    setPicked(null)
    setSinging(false)
    setPhase('playing')
  }

  function startPlacement() {
    setPlPassed(0)
    setPlGate(0)
    startQuiz(PLACEMENT_LEVELS[0], true)
  }

  // 答案键：统一成字符串比较
  function answerKeyOf(question: Question): string {
    switch (question.kind) {
      case 'pitch':
        return String(question.midi)
      case 'stepleap':
        return question.answer
      case 'interval':
        return String(question.semis)
      case 'melody':
        return question.notes.join(',')
      case 'rhythm':
        return question.tokens.join(',')
      case 'scale':
        return question.mode
      case 'timbre':
        return question.inst
      case 'sight':
        return String(question.midi)
      case 'pitchcmp':
        return question.answer
      case 'durcmp':
        return question.answer
      case 'dyncmp':
        return question.answer
      case 'direct':
        return question.answer
      case 'meter':
        return String(question.beats)
    }
  }

  function pick_(key: string) {
    if (picked || !q) return
    setPicked(key)
    const correct = key === answerKeyOf(q)
    recordWrong(q.kind, correct)
    if (correct) {
      if (q.kind === 'sight') {
        setSinging(true) // 识音答对 → 跟唱
      } else {
        setScore(s => s + 1)
      }
    }
  }

  function nextQuestion() {
    setPicked(null)
    setSinging(false)
    if (idx + 1 < quiz.length) {
      setIdx(i => i + 1)
    } else {
      finishRound()
    }
  }

  function finishRound() {
    if (placing) {
      if (score >= 2) {
        const passed = plGate + 1
        setPlPassed(passed)
        if (passed < PLACEMENT_LEVELS.length) {
          setPlGate(passed)
          startQuiz(PLACEMENT_LEVELS[passed], true)
          return
        }
      }
      finishPlacement()
    } else {
      if (score >= PASS_SCORE && level === unlocked && level < LESSONS.length) {
        const nu = level + 1
        setUnlocked(nu)
        saveNum('muse-progress-v1', nu)
      }
      bumpStreak()
      setPhase('done')
    }
  }

  function finishPlacement() {
    const target = PLACEMENT_TARGETS[plPassed] ?? 0
    if (target >= 1) {
      setUnlocked(target)
      saveNum('muse-progress-v1', target)
    }
    setPlacing(false)
    setPlGate(-1)
    setPhase('placementDone')
  }

  function bumpStreak() {
    const today = todayKey()
    if (streak.last === today) return
    const yest = todayKey(new Date(Date.now() - 86400000))
    const next: Streak = { last: today, count: streak.last === yest ? streak.count + 1 : 1 }
    setStreak(next)
    try {
      localStorage.setItem('muse-streak-v1', JSON.stringify(next))
    } catch {
      /* 忽略 */
    }
  }

  function openLesson(lv: number) {
    setLevel(lv)
    setPhase('learn')
  }

  // —— 选项构建 ——
  interface Opt {
    key: string
    label: string
    node?: ReactNode
  }
  function optionsOf(question: Question): Opt[] {
    switch (question.kind) {
      case 'pitch':
        return question.options.map(m => ({ key: String(m), label: `${nameOf(m)}（${solfegeOf(m)}）` }))
      case 'stepleap':
        return [
          { key: 'step', label: '级进（挨着走）' },
          { key: 'leap', label: '跳进（跨着走）' },
        ]
      case 'interval':
        return question.options.map(s => ({ key: String(s), label: INTERVAL_NAMES[s] }))
      case 'melody':
        return question.options.map((ns, i) => ({
          key: ns.join(','),
          label: `旋律 ${'ABC'[i]}`,
          node: <Staff midi={null} midis={ns} width={210} height={100} />,
        }))
      case 'rhythm':
        return question.options.map((ts, i) => ({
          key: ts.join(','),
          label: `节奏 ${'ABC'[i]}`,
          node: <Staff rhythm={ts} width={210} height={100} />,
        }))
      case 'scale':
        return [
          { key: 'major', label: '大调' },
          { key: 'minor', label: '小调' },
        ]
      case 'timbre':
        return INSTRUMENTS.map(inst => ({
          key: inst.id,
          label: inst.name,
          node: <img className="optInst" src={inst.img} alt={inst.name} />,
        }))
      case 'sight':
        return question.options.map(m => ({ key: String(m), label: `${nameOf(m)}（${solfegeOf(m)}）` }))
      case 'pitchcmp':
        return [
          { key: 'up', label: '更高' },
          { key: 'down', label: '更低' },
          { key: 'same', label: '一样高' },
        ]
      case 'durcmp':
        return [
          { key: 'longer', label: '更长' },
          { key: 'shorter', label: '更短' },
          { key: 'same', label: '一样长' },
        ]
      case 'dyncmp':
        return [
          { key: 'louder', label: '更响' },
          { key: 'softer', label: '更轻' },
          { key: 'same', label: '一样响' },
        ]
      case 'direct': {
        const labels: Record<DirectAns, string> = { up: '上行', down: '下行', repeat: '同音反复', wave: '波浪（先上后下）' }
        return question.options.map(a => ({ key: a, label: labels[a] }))
      }
      case 'meter':
        return [
          { key: '2', label: '二拍子（强 · 弱）' },
          { key: '3', label: '三拍子（强 · 弱 · 弱）' },
        ]
    }
  }

  function promptOf(question: Question): string {
    switch (question.kind) {
      case 'pitch': return '听一听，这个音是？'
      case 'stepleap': return '先后两个音：它们是级进还是跳进？'
      case 'interval': return '先后两个音：这个音程是？'
      case 'melody': return '你听到的是哪一条旋律？'
      case 'rhythm': return '你听到的是哪一条节奏？'
      case 'scale': return '这条音阶是大调还是小调？'
      case 'timbre': return '这是哪种乐器在演奏？'
      case 'sight': return '这个音是？认出它，再唱出来'
      case 'pitchcmp': return '听先后两个音：第二个音比第一个音……'
      case 'durcmp': return '先后两个音高相同：第二个音比第一个音……'
      case 'dyncmp': return '先后两个音高相同：第二个音比第一个音……'
      case 'direct': return '这段旋律的走向是……'
      case 'meter': return '听重音：这段节奏是几拍子？'
    }
  }

  const answerKey = q ? answerKeyOf(q) : ''
  const opts = q ? optionsOf(q) : []

  // —— 界面 ——
  if (phase === 'home') {
    return (
      <div className="page">
        <header className="brand">缪斯 Muse</header>
        <div className="heroCard">
          <img src="/hero.png" alt="缪斯" />
        </div>
        <h1 className="homeTitle">每天一刻钟，练出音乐耳</h1>
        <p className="homeSub">听音 · 节奏 · 视唱，从声音的礼物开始</p>
        <div className="homeBtns">
          <button className="primaryBtn" onClick={() => setPhase('map')}>开始学习</button>
          <button className="ghostBtn" onClick={() => { setPlacing(true); setPlGate(0); startPlacement() }}>定级测试</button>
        </div>
        {streak.count > 0 && <p className="streakLine">已连续练习 {streak.count} 天</p>}
      </div>
    )
  }

  if (phase === 'map') {
    return (
      <div className="page">
        <header className="brand">缪斯 Muse</header>
        <button className="ghostBtn" onClick={() => setPhase('home')}>← 首页</button>
        {UNITS.map(u => (
          <section className="unitCard" key={u.id}>
            <h2>{u.name}</h2>
            <div className="lvGrid">
              {LESSONS.filter(l => l.unit === u.id).map(l => {
                const locked = l.id > unlocked
                return (
                  <button key={l.id} className={'lv' + (locked ? ' locked' : '')} disabled={locked} onClick={() => openLesson(l.id)}>
                    <span className="lvNum">{l.id}</span>
                    <span className="lvTitle">{l.title}</span>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    )
  }

  if (phase === 'learn') {
    const ls = lessonOf(level)
    return (
      <div className="page">
        <header className="brand">缪斯 Muse</header>
        <button className="ghostBtn" onClick={() => setPhase('map')}>← 课程地图</button>
        <h2 className="learnTitle">第 {ls.id} 课 · {ls.title}</h2>
        <p className="learnGoal">{ls.goal}</p>
        {renderBody(ls.id)}
        <button
          className="primaryBtn big"
          onClick={() => {
            setPlacing(false)
            setPlGate(-1)
            startQuiz(level)
          }}
        >
          开始练习（{QUIZ_COUNT} 题）
        </button>
      </div>
    )
  }

  if (phase === 'playing' && q) {
    return (
      <div className="page">
        <header className="brand">缪斯 Muse</header>
        <div className="quizHead">
          <span>{placing ? `定级 · 第 ${plGate + 1} 关` : `第 ${level} 课`} · 第 {idx + 1}/{quiz.length} 题</span>
          <span className="kindTag">{KIND_LABEL[q.kind]}</span>
        </div>
        <h2 className="qPrompt">{promptOf(q)}</h2>
        {q.kind === 'sight' && (
          <div className="sightWrap">
            <Staff clef={q.clef} midi={q.midi} width={240} />
          </div>
        )}
        {!singing && q.kind !== 'sight' && (
          <button className="ghostBtn" onClick={() => playQuestion(q)}>↻ 再听一遍</button>
        )}
        {!singing && (
          <div className={'optGrid' + (q.kind === 'melody' || q.kind === 'rhythm' ? ' staffOpts' : '') + (q.kind === 'timbre' ? ' instOpts' : '')}>
            {opts.map(o => {
              const cls =
                'optBtn' +
                (picked
                  ? o.key === answerKey
                    ? ' right'
                    : o.key === picked
                      ? ' wrongPick'
                      : ' dim'
                  : '')
              return (
                <button key={o.key} className={cls} onClick={() => pick_(o.key)}>
                  {o.node}
                  <span>{o.label}</span>
                </button>
              )
            })}
          </div>
        )}
        {singing && q.kind === 'sight' && (
          <Sing
            target={q.midi}
            onPass={() => {
              setScore(s => s + 1)
              setSinging(false)
            }}
            onSkip={() => setSinging(false)}
          />
        )}
        {picked && !singing && (
          <div className="fbRow">
            <span className={picked === answerKey ? 'fbOk' : 'fbNo'}>
              {picked === answerKey ? '答对了' : '正确答案已标出'}
            </span>
            <button className="primaryBtn" onClick={nextQuestion}>
              {idx + 1 < quiz.length ? '下一题' : '看结果'}
            </button>
          </div>
        )}
        {picked && !singing && q.kind === 'sight' && picked !== answerKey && (
          <div className="sightWrap">
            <Staff clef={q.clef} midi={q.midi} midis={null} width={240} />
          </div>
        )}
      </div>
    )
  }

  if (phase === 'done') {
    const pass = score >= PASS_SCORE
    return (
      <div className="page">
        <header className="brand">缪斯 Muse</header>
        <div className="doneCard">
          <h2>{pass ? '通关！' : '再练一次吧'}</h2>
          <p className="doneScore">{score} / {quiz.length}</p>
          <p>{pass ? `第 ${level + 1} 课已解锁。` : `答对 ${PASS_SCORE} 题即可过关。`}</p>
          <div className="homeBtns">
            {pass && level < LESSONS.length && (
              <button className="primaryBtn" onClick={() => openLesson(level + 1)}>下一课</button>
            )}
            <button className={pass ? 'ghostBtn' : 'primaryBtn'} onClick={() => startQuiz(level)}>再练一次</button>
            <button className="ghostBtn" onClick={() => setPhase('map')}>课程地图</button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'placementDone') {
    const target = PLACEMENT_TARGETS[plPassed] ?? 0
    return (
      <div className="page">
        <header className="brand">缪斯 Muse</header>
        <div className="doneCard">
          <h2>定级完成</h2>
          <p>{target >= 1 ? `你可以从第 ${target} 课开始。` : '从第 1 课开始，打牢基础。'}</p>
          <button className="primaryBtn" onClick={() => { setPhase('map') }}>进入课程地图</button>
        </div>
      </div>
    )
  }

  return null
}