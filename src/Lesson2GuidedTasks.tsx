// 第2课任务2—5：匿名声音熟悉、比较、排高低，再按低到高揭示唱名。
import { useCallback, useEffect, useRef, useState } from 'react'
import { HandDrawing } from './Lesson1Tasks'
import { playLesson1Sequence, stopLesson1Audio } from './lesson1Audio'
import { L2_PITCHES, l2SolfegeOf, type L2Solfege, type L2Step } from './lesson2Data'
import { L2Conch, L2SoundIcon, ThreeKeyPiano } from './Lesson2Shared'
import VoicePracticePanel, { type L2VoiceResult } from './Lesson2Voice'

interface TaskProps {
  replayNonce: number
  onDone: (record: Record<string, unknown>) => void
}

export function RememberLowTask({ replayNonce, onDone }: TaskProps) {
  const [stage, setStage] = useState<'round1' | 'between' | 'round2' | 'finalReference'>('round1')
  const [rounds, setRounds] = useState<L2VoiceResult[]>([])
  const [referencePlaying, setReferencePlaying] = useState(false)
  const [referenceReplayCount, setReferenceReplayCount] = useState(0)
  const [audioError, setAudioError] = useState(false)
  const previousReplayNonceRef = useRef(replayNonce)

  const playReference = useCallback(async (countReplay = false) => {
    if (countReplay) setReferenceReplayCount(count => count + 1)
    setReferencePlaying(true)
    setAudioError(false)
    try {
      await playLesson1Sequence([60], { noteMs: 650, gapMs: 300 })
    } catch {
      setAudioError(true)
    } finally {
      setReferencePlaying(false)
    }
  }, [])

  useEffect(() => {
    if (stage !== 'finalReference') return
    void playReference()
    return () => stopLesson1Audio()
  }, [stage, playReference])

  useEffect(() => {
    if (previousReplayNonceRef.current === replayNonce) return
    previousReplayNonceRef.current = replayNonce
    if (stage === 'between' || stage === 'finalReference') void playReference(true)
  }, [replayNonce, stage, playReference])

  const finishRound = (result: L2VoiceResult) => {
    setRounds(previous => [...previous, result])
    if (stage === 'round1') setStage('between')
    else setStage('finalReference')
  }

  if (stage === 'round1' || stage === 'round2') {
    return (
      <section className="l1-task" aria-labelledby="L02T02-title">
        <h2 id="L02T02-title">记住最低的声音</h2>
        <p className="l1-guide">先听，再模仿。现在只叫它“声音A”。</p>
        <p className="l1-item-count">第 {stage === 'round1' ? 1 : 2} 轮，共 2 轮</p>
        <div className="l2-anonymous-hero"><L2Conch /><strong>声音A</strong></div>
        <VoicePracticePanel
          key={stage}
          targets={[60]}
          replayNonce={replayNonce}
          demoLabel="再听声音A"
          recordLabel="按住模仿"
          continueLabel="完成这一轮"
          onContinue={finishRound}
        />
      </section>
    )
  }

  return (
    <section className="l1-task" aria-labelledby="L02T02-title">
      <h2 id="L02T02-title">{stage === 'between' ? '再听一次，开始第二轮' : '把声音A记牢'}</h2>
      <p className="l1-guide">{stage === 'between' ? '先听参照，再独立模仿一轮。' : '最后再听一次这个最低的声音。'}</p>
      <button className={'l2-anonymous-hero as-button' + (referencePlaying ? ' playing' : '')} onClick={() => void playReference(true)} disabled={referencePlaying}>
        <L2Conch /><strong>声音A</strong><span>点按重听</span>
      </button>
      {audioError && <p className="l1-feedback retry" role="alert">声音没有加载好，请点“声音A”重新加载。</p>}
      <div className="l1-task-actions">
        {stage === 'between'
          ? <button className="btn primary" onClick={() => setStage('round2')}>开始第二轮</button>
          : <button className="btn primary" disabled={referencePlaying} onClick={() => onDone({ taskId: 'L02T02', rounds, referenceReplayCount, completed: true })}>继续</button>}
      </div>
    </section>
  )
}

type CompareChoice = 'higher' | 'same' | 'lower' | 'unsure'

export function RememberMiddleTask({ replayNonce, onDone }: TaskProps) {
  const [stage, setStage] = useState<'voice' | 'compare'>('voice')
  const [voiceResult, setVoiceResult] = useState<L2VoiceResult | null>(null)
  const [status, setStatus] = useState<'playing' | 'awaiting' | 'correct'>('playing')
  const [activePitch, setActivePitch] = useState<number | null>(null)
  const [wrongChoice, setWrongChoice] = useState<CompareChoice | null>(null)
  const [usedGestureHelp, setUsedGestureHelp] = useState(false)
  const [helpReplayCount, setHelpReplayCount] = useState(0)
  const [audioError, setAudioError] = useState(false)
  const previousReplayNonceRef = useRef(replayNonce)
  const stageRef = useRef(stage)
  stageRef.current = stage

  const playComparison = useCallback(async (after: 'awaiting' | 'correct' = 'awaiting') => {
    setStatus('playing')
    setAudioError(false)
    try {
      const completed = await playLesson1Sequence([60, 62], { noteMs: 650, gapMs: 300, onNote: index => setActivePitch(index === 0 ? 60 : 62) })
      if (completed) setStatus(after)
    } catch {
      setAudioError(true)
      setStatus(after)
    } finally {
      setActivePitch(null)
    }
  }, [])

  useEffect(() => {
    if (stage !== 'compare') return
    void playComparison()
    return () => stopLesson1Audio()
  }, [stage, playComparison])

  useEffect(() => {
    if (previousReplayNonceRef.current === replayNonce) return
    previousReplayNonceRef.current = replayNonce
    if (stageRef.current === 'compare') void playComparison(status === 'correct' ? 'correct' : 'awaiting')
  }, [replayNonce, playComparison, status])

  const playHelp = async () => {
    setUsedGestureHelp(true)
    setHelpReplayCount(count => count + 1)
    setStatus('playing')
    setAudioError(false)
    try {
      await playLesson1Sequence([60], { noteMs: 650, gapMs: 300, onNote: () => setActivePitch(60) })
      await playLesson1Sequence([62], { noteMs: 650, gapMs: 300, onNote: () => setActivePitch(62) })
      setStatus('awaiting')
    } catch {
      setAudioError(true)
      setStatus('awaiting')
    } finally {
      setActivePitch(null)
    }
  }

  const playSingleCard = async (pitch: number) => {
    const after = status === 'correct' ? 'correct' : 'awaiting'
    setStatus('playing')
    setAudioError(false)
    try {
      const completed = await playLesson1Sequence([pitch], { noteMs: 650, gapMs: 300, onNote: () => setActivePitch(pitch) })
      if (completed) setStatus(after)
    } catch {
      setAudioError(true)
      setStatus(after)
    } finally {
      setActivePitch(null)
    }
  }

  const answer = async (choice: CompareChoice) => {
    if (status !== 'awaiting') return
    if (choice === 'higher') {
      setWrongChoice(null)
      setStatus('correct')
      await playComparison('correct')
    } else {
      setWrongChoice(choice)
      await playHelp()
      setWrongChoice(null)
    }
  }

  if (stage === 'voice') {
    return (
      <section className="l1-task" aria-labelledby="L02T03-title">
        <h2 id="L02T03-title">记住中间的声音</h2>
        <p className="l1-guide">来了一个新声音，先叫它“声音B”。</p>
        <div className="l2-anonymous-hero"><L2Conch /><strong>声音B</strong></div>
        <VoicePracticePanel
          targets={[62]}
          replayNonce={replayNonce}
          demoLabel="再听声音B"
          recordLabel="按住模仿"
          continueLabel="和声音A比一比"
          onContinue={result => {
            setVoiceResult(result)
            setStage('compare')
          }}
        />
      </section>
    )
  }

  return (
    <section className="l1-task" aria-labelledby="L02T03-title">
      <h2 id="L02T03-title">声音B比声音A高吗？</h2>
      <p className="l1-guide">两张卡放在同样高的位置，只用耳朵比较。</p>
      <div className="l2-anonymous-cards" aria-label="两张相同高度的匿名声音卡">
        {[60, 62].map((pitch, index) => (
          <button key={pitch} className={'l2-sound-card' + (activePitch === pitch ? ' playing' : '')} disabled={status === 'playing'} onClick={() => void playSingleCard(pitch)}>
            <L2SoundIcon /><strong>{index === 0 ? '声音A' : '声音B'}</strong>
          </button>
        ))}
      </div>
      {(usedGestureHelp || status === 'correct') && (
        <div className="l2-hand-compare" aria-label="声音A的手势较低，声音B的手势较高">
          <div className={activePitch === 60 ? 'active' : ''}><HandDrawing /><span>声音A</span></div>
          <div className={'higher ' + (activePitch === 62 ? 'active' : '')}><HandDrawing /><span>声音B</span></div>
        </div>
      )}
      <div className="l1-choice-grid l1-choice-3">
        {([['higher', '第二个更高'], ['same', '一样高'], ['lower', '第二个更低']] as const).map(([id, label]) => (
          <button key={id} className={'l1-option' + (status === 'correct' && id === 'higher' ? ' correct' : '') + (wrongChoice === id ? ' wrong' : '')} disabled={status !== 'awaiting'} onClick={() => void answer(id)}>{label}</button>
        ))}
      </div>
      <button className="btn text" disabled={status !== 'awaiting'} onClick={() => void answer('unsure')}>我不确定，分听并看手势</button>
      {status === 'correct' && <p className="l1-feedback correct">第二个更高。声音B比声音A高。</p>}
      {usedGestureHelp && status === 'awaiting' && <p className="l1-small-hint">已经分别播放，并补上手势。这不是新的听辨错题，可以再试。</p>}
      {audioError && <p className="l1-feedback retry" role="alert">声音没有加载好，请再听一次。</p>}
      <div className="l1-task-actions wrap">
        <button className="btn ghost" disabled={status === 'playing'} onClick={() => void playComparison(status === 'correct' ? 'correct' : 'awaiting')}>再听两个声音</button>
        {status === 'correct' && <button className="btn primary" onClick={() => onDone({ taskId: 'L02T03', voice: voiceResult, comparisonConfirmed: true, usedGestureHelp, helpReplayCount, completed: true })}>继续</button>}
      </div>
    </section>
  )
}

type OrderStage = 'voice' | 'order' | 'complete'
type PlacementMethod = 'tap' | 'drag'

export function OrderThreeTask({ stepOrder, replayNonce, onDone }: TaskProps & { stepOrder: number[] }) {
  const [stage, setStage] = useState<OrderStage>('voice')
  const [voiceResult, setVoiceResult] = useState<L2VoiceResult | null>(null)
  const [pending, setPending] = useState<number[]>(stepOrder)
  const [slots, setSlots] = useState<Record<L2Step, number | null>>({ low: null, middle: null, high: null })
  const [selected, setSelected] = useState<number | null>(null)
  const [selectedMethod, setSelectedMethod] = useState<PlacementMethod>('tap')
  const [activePitch, setActivePitch] = useState<number | null>(null)
  const [wrongSlot, setWrongSlot] = useState<L2Step | null>(null)
  const [message, setMessage] = useState('')
  const [scalePlayed, setScalePlayed] = useState(false)
  const placementsRef = useRef<Array<{ pitch: number; slot: L2Step; correct: boolean; method: PlacementMethod }>>([])
  const cardNamesRef = useRef(new Map(stepOrder.map((pitch, index) => [pitch, `声音卡${['①', '②', '③'][index]}`])))
  const previousReplayNonceRef = useRef(replayNonce)
  const stageRef = useRef(stage)
  stageRef.current = stage
  const selectedRef = useRef(selected)
  selectedRef.current = selected

  const playNote = useCallback(async (pitch: number) => {
    setActivePitch(pitch)
    try {
      await playLesson1Sequence([pitch], { noteMs: 650, gapMs: 300 })
    } catch {
      setMessage('声音没有加载好，请再点一次这张卡。')
    } finally {
      setActivePitch(null)
    }
  }, [])

  const playScale = useCallback(async () => {
    setScalePlayed(false)
    try {
      const completed = await playLesson1Sequence([60, 62, 64], { noteMs: 650, gapMs: 250, onNote: index => setActivePitch([60, 62, 64][index]) })
      setScalePlayed(completed)
      if (!completed) setMessage('完整播放被中断，请再从低到高听一遍。')
    } catch {
      setMessage('声音没有加载好，请再从低到高听一遍。')
    } finally {
      setActivePitch(null)
    }
  }, [])

  useEffect(() => {
    if (stage !== 'complete') return
    void playScale()
    return () => stopLesson1Audio()
  }, [stage, playScale])

  useEffect(() => {
    if (previousReplayNonceRef.current === replayNonce) return
    previousReplayNonceRef.current = replayNonce
    if (stageRef.current === 'complete') void playScale()
    else if (stageRef.current === 'order' && selectedRef.current !== null) void playNote(selectedRef.current)
  }, [replayNonce, playScale, playNote])

  const expectedPitch: Record<L2Step, number> = { low: 60, middle: 62, high: 64 }
  const placeCard = (pitch: number, slot: L2Step, method: PlacementMethod) => {
    if (slots[slot] !== null) return
    const correct = expectedPitch[slot] === pitch
    placementsRef.current.push({ pitch, slot, correct, method })
    if (!correct) {
      setWrongSlot(slot)
      setMessage('这张卡先退回来，已经放对的卡不会清空。再听一听。')
      window.setTimeout(() => setWrongSlot(null), 550)
      void playNote(pitch)
      return
    }
    const nextSlots = { ...slots, [slot]: pitch }
    setSlots(nextSlots)
    setPending(previous => previous.filter(item => item !== pitch))
    setSelected(null)
    setWrongSlot(null)
    setMessage('放对了。')
    if (Object.values(nextSlots).every(value => value !== null)) setStage('complete')
    else void playNote(pitch)
  }

  if (stage === 'voice') {
    return (
      <section className="l1-task" aria-labelledby="L02T04-title">
        <h2 id="L02T04-title">再认识一个更高的声音</h2>
        <p className="l1-guide">先模仿新声音，再把三张声音卡排上台阶。</p>
        <div className="l2-anonymous-hero"><L2Conch /><strong>新声音</strong></div>
        <VoicePracticePanel
          targets={[64]}
          replayNonce={replayNonce}
          demoLabel="再听新声音"
          recordLabel="按住模仿"
          continueLabel="开始排高低"
          onContinue={result => {
            setVoiceResult(result)
            setStage('order')
          }}
        />
      </section>
    )
  }

  const card = (pitch: number, placed: boolean) => (
    <button
      key={pitch}
      data-pitch={pitch}
      draggable={!placed}
      className={'l2-sound-card l2-order-card' + (selected === pitch ? ' selected' : '') + (activePitch === pitch ? ' playing' : '')}
      aria-label={`${cardNamesRef.current.get(pitch) ?? '声音卡'}，${placed ? '已放好，点按播放' : '点按选择并播放'}`}
      onDragStart={event => {
        setSelected(pitch)
        setSelectedMethod('drag')
        event.dataTransfer.setData('text/plain', String(pitch))
        event.dataTransfer.effectAllowed = 'move'
      }}
      onClick={() => {
        if (placed) {
          void playNote(pitch)
          return
        }
        setSelected(pitch)
        setSelectedMethod('tap')
        setMessage('已拿起这张卡，再点一个空台阶。')
        void playNote(pitch)
      }}
    >
      <L2SoundIcon /><strong>{cardNamesRef.current.get(pitch)}</strong><span>{placed ? '已放好' : selected === pitch ? '已拿起' : '点按或拖动'}</span>
    </button>
  )

  return (
    <section className="l1-task" aria-labelledby="L02T04-title">
      <h2 id="L02T04-title">三个声音排高低</h2>
      <p className="l1-guide">点按卡片再点台阶，或直接拖动。每张卡都可以先听。</p>
      <div className="l2-step-board" aria-label="低、中、高三个台阶">
        {(['high', 'middle', 'low'] as L2Step[]).map(step => (
          <div
            key={step}
            className={'l2-step-slot ' + step + (wrongSlot === step ? ' wrong' : '')}
            onDragOver={event => {
              if (slots[step] === null) event.preventDefault()
            }}
            onDrop={event => {
              event.preventDefault()
              const pitch = Number(event.dataTransfer.getData('text/plain')) || selected
              if (pitch !== null) placeCard(pitch, step, 'drag')
            }}
          >
            <span className="l2-step-label">{step === 'low' ? '低' : step === 'middle' ? '中' : '高'}</span>
            {slots[step] === null ? (
              <button
                className="l2-empty-slot"
                aria-label={`${step === 'low' ? '低' : step === 'middle' ? '中' : '高'}台阶，空位`}
                onClick={() => {
                  if (selected !== null) placeCard(selected, step, selectedMethod)
                }}
              >放在这里</button>
            ) : card(slots[step] as number, true)}
          </div>
        ))}
      </div>
      {pending.length > 0 && <div className="l2-pending-cards" aria-label="待排声音卡">{pending.map(pitch => card(pitch, false))}</div>}
      {stage === 'complete' && <p className="l1-feedback correct">已经从低到高完整播放。三个声音的顺序排好了。</p>}
      {message && stage !== 'complete' && <p className="l1-small-hint">{message}</p>}
      <div className="l1-task-actions wrap">
        {stage === 'complete' && <button className="btn ghost" onClick={() => void playScale()}>再从低到高听一遍</button>}
        {stage === 'complete' && <button className="btn primary" disabled={!scalePlayed} onClick={() => onDone({ taskId: 'L02T04', voice: voiceResult, initialOrder: stepOrder, placements: placementsRef.current, usedDrag: placementsRef.current.some(item => item.method === 'drag'), wrongAttempts: placementsRef.current.filter(item => !item.correct).length, completed: true })}>继续</button>}
      </div>
    </section>
  )
}

export function SolfegeRevealTask({ replayNonce, onDone }: TaskProps) {
  const [revealedCount, setRevealedCount] = useState(0)
  const [activePitch, setActivePitch] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [listenOrder, setListenOrder] = useState<number[]>([])
  const [freeListenCounts, setFreeListenCounts] = useState<Record<string, number>>({})
  const [audioError, setAudioError] = useState(false)
  const lastListenedRef = useRef<number>(60)
  const previousReplayNonceRef = useRef(replayNonce)
  const revealedCountRef = useRef(revealedCount)
  revealedCountRef.current = revealedCount

  const listen = useCallback(async (pitch: number, guided: boolean) => {
    if (playing) return
    lastListenedRef.current = pitch
    setActivePitch(pitch)
    setPlaying(true)
    setAudioError(false)
    const name = l2SolfegeOf(pitch)
    if (guided) {
      setRevealedCount(count => count + 1)
      setListenOrder(previous => [...previous, pitch])
    } else {
      setFreeListenCounts(previous => ({ ...previous, [name]: (previous[name] ?? 0) + 1 }))
    }
    try {
      const completed = await playLesson1Sequence([pitch], { noteMs: 700, gapMs: 300 })
      if (!completed) throw new Error('播放中断')
    } catch {
      setAudioError(true)
      if (guided) {
        setRevealedCount(count => Math.max(0, count - 1))
        setListenOrder(previous => previous.slice(0, -1))
      } else {
        setFreeListenCounts(previous => ({ ...previous, [name]: Math.max(0, (previous[name] ?? 1) - 1) }))
      }
    } finally {
      setActivePitch(null)
      setPlaying(false)
    }
  }, [playing])

  useEffect(() => {
    if (previousReplayNonceRef.current === replayNonce) return
    previousReplayNonceRef.current = replayNonce
    if (revealedCountRef.current >= 3) void listen(lastListenedRef.current, false)
  }, [replayNonce, listen])

  const solfegeNames: Record<number, L2Solfege> = { 60: 'do', 62: 're', 64: 'mi' }

  return (
    <section className="l1-task" aria-labelledby="L02T05-title">
      <h2 id="L02T05-title">三个音有名字</h2>
      <p className="l1-guide">{revealedCount < 3 ? '按从低到高的顺序点听。每次都会同时出现名字、声音和琴键。' : '现在可以按任意顺序自由点听。'}</p>
      <div className="l2-solfege-cards">
        {L2_PITCHES.map((pitch, index) => {
          const revealed = index < revealedCount
          const isNext = index === revealedCount
          return (
            <button
              key={pitch}
              className={'l2-solfege-card' + (activePitch === pitch ? ' playing' : '') + (revealed ? ' revealed' : '')}
              disabled={playing || (revealedCount < 3 && !isNext)}
              onClick={() => void listen(pitch, revealedCount < 3)}
              aria-label={revealed ? `再听 ${solfegeNames[pitch]}` : `点听第${index + 1}个声音`}
            >
              <span className="l2-reveal-step">{index + 1}</span>
              <strong>{revealed ? solfegeNames[pitch] : '点听'}</strong>
              <span>{revealed ? '再听一次' : index === 0 ? '最低' : index === 1 ? '中间' : '最高'}</span>
            </button>
          )
        })}
      </div>
      <ThreeKeyPiano activePitch={activePitch} showNames={revealedCount >= 3} />
      <p className="l1-item-count">已按顺序点听 {Math.min(revealedCount, 3)} / 3 次</p>
      {audioError && <p className="l1-feedback retry" role="alert">这次播放没有完成，请重新点听；不计入已完成次数。</p>}
      <div className="l1-task-actions">
        <button className="btn primary" disabled={revealedCount < 3 || playing} onClick={() => onDone({ taskId: 'L02T05', revealOrder: [60, 62, 64], listenOrder, freeListenCounts, completed: true })}>继续</button>
      </div>
    </section>
  )
}
