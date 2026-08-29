// 缪斯 Muse · 主应用
import { useEffect, useRef, useState } from 'react'
import './App.css'
import {
  LESSONS, UNITS, lessonOf,
} from './lessons'
import {
  type Question, type DirectAns,
  displayName, solfegeOf, INTERVAL_NAMES, makeQuestion, makeSightQuestion,
  SCALE_STEPS,
} from './theory'
import {
  ensureAudio, playMelody, playHarmonic, playRhythm, playTwo, playNote,
  initInstruments, playInstrumentMelody,
} from './audio'
import Staff from './Staff'
import Sing from './Sing'
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
  const [placementStage, setPlacementStage] = useState(0)
  const [placementHit, setPlacementHit] = useState(0)
  const [zooming, setZooming] = useState(false)
  const [syncOpen, setSyncOpen] = useState(false)
  const [syncIn, setSyncIn] = useState('')
  const [copied, setCopied] = useState(false)
  const audioReady = useRef(false)

  const q = questions[qi]

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
    const boost = topWrongKeys(wrongBook)
    const qs: Question[] = []
    for (let i = 0; i < QUIZ_COUNT; i++) qs.push(makeQuestion(lv, boost))
    setQuestions(qs)
    setQi(0)
    setScore(0)
    setPicked(null)
    setSinging(false)
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
    const qs: Question[] = []
    // 每关 3 题：2 道听力 + 1 道识谱（第 1 关用识音代替识谱）
    const boost: string[] = []
    qs.push(makeQuestion(lv, boost))
    qs.push(makeQuestion(lv, boost))
    qs.push(lv >= 5 ? makeSightQuestion(lv) : makeQuestion(lv, boost))
    setQuestions(qs)
    setQi(0)
    setPicked(null)
    setSinging(false)
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
          node: <Staff clef="treble" midi={71} rhythm={v} width={220} height={100} />,
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
    }
  }

  // 题目切换时自动播放
  useEffect(() => {
    if (phase === 'playing' && q && !singing) {
      const t = setTimeout(() => playQuestion(q), 350)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, qi, singing])

  const answer = (id: string) => {
    if (picked !== null || !q) return
    setPicked(id)
    const ok = isCorrect(q, id)
    const nextScore = ok ? score + 1 : score
    if (ok) setScore(nextScore)
    setWrongBook(bumpWrong(wrongBook, wrongKeyOf(q), ok))

    const isPlacement = placementStage > 0 || questions.length === 3

    // 识音题答对后进入跟唱
    const needSing = ok && q.kind === 'pitch' && !isPlacement && !singing

    setTimeout(() => {
      if (needSing) {
        setSinging(true)
        return
      }
      advance(ok, nextScore)
    }, needSing ? 900 : 1200)
  }

  const advance = (ok: boolean, nextScore: number) => {
    setSinging(false)
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
      if (passed) {
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

  const singDone = (_ok: boolean) => {
    advance(true, score)
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
          <img className="hero cover" src="/muse.webp" alt="缪斯 Muse" />
          <span className="conchRipple" aria-hidden="true" />
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
          <h3>{u.name}</h3>
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
      <div className="progressBar"><div style={{ width: `${(qi / questions.length) * 100}%` }} /></div>

      {!singing ? (
        <>
          <h3 className="prompt">{promptOf(q)}</h3>
          <button className="btn ghost" onClick={() => playQuestion(q)}>▶ 再听一遍</button>

          {q.kind === 'sight' && (
            <div className="staffBox">
              <Staff clef={q.clef} midi={q.midi} width={300} />
            </div>
          )}
          {q.kind === 'pitch' && q.keys && (
            <div className="staffBox">
              <Piano highlight={[q.midi]} label={false} />
            </div>
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
              {isCorrect(q, picked) ? '答对了' : `正确答案是 ${questionAnswer(q)}`}
              {q.kind === 'pitchcmp' && level <= 4 && (
                <Piano highlight={[q.a, q.b]} marks={{ [q.a]: '①', [q.b]: '②' }} from={Math.min(q.a, q.b) - 3} to={Math.max(q.a, q.b) + 3} label={false} />
              )}
            </div>
          )}
        </>
      ) : (
        q.kind === 'pitch' && (
          <div className="singBox">
            <p>答对了！跟着把它唱出来：</p>
            <Staff clef="treble" midi={q.midi} width={260} />
            <div className="staffBox">
              <Piano highlight={[q.midi]} from={Math.min(60, q.midi)} to={Math.max(71, q.midi)} />
            </div>
            <button className="btn ghost" onClick={() => { void ensureAudio().then(() => playNote(q.midi, 1.2, 0.9)) }}>
              ▶ 再听一遍
            </button>
            <Sing target={q.midi} ghostMic={new URLSearchParams(location.search).has('ghostMic')} onDone={singDone} />
            <button className="btn ghost small" onClick={() => singDone(true)}>跳过跟唱</button>
          </div>
        )
      )}
    </div>
  )

  const passed = score >= PASS_SCORE
  const done = (
    <div className="donePage">
      <h2>{passed ? '恭喜过关' : '还差一点'}</h2>
      <p className="scoreLine">{score} / {questions.length}</p>
      <p>{passed ? '下一课已经解锁。' : `答对 ${PASS_SCORE} 题即可过关，再试一次吧。`}</p>
      {passed && <p className="streakLine">已连续打卡 {streak.count} 天</p>}
      <div className="doneBtns">
        {passed && level < LESSONS.length && (
          <button className="btn primary" onClick={() => { setLevel(level + 1); setPhase('learn') }}>进入第 {level + 1} 课</button>
        )}
        <button className="btn ghost" onClick={() => startLevel(level)}>再练一遍</button>
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
