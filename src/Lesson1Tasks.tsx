// 第1课任务1与6：身体感知、声音台阶；不采集身体位置，不使用谱面或唱名。
import { useCallback, useEffect, useRef, useState } from 'react'
import { playLesson1Sequence, stopLesson1Audio } from './lesson1Audio'

interface TaskProps {
  replayNonce: number
  onDone: (record: Record<string, unknown>) => void
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return reduced
}

export function HandDrawing({ className = '' }: { className?: string }) {
  return (
    <svg className={`l1-hand-drawing ${className}`} viewBox="0 0 110 130" aria-hidden="true">
      <path d="M25 69V37c0-8 12-8 12 0v22-42c0-9 13-9 13 0v40-49c0-9 13-9 13 0v49-40c0-9 13-9 13 0v45-26c0-9 13-9 13 0v39c0 29-14 43-38 43-18 0-29-9-36-24L9 78c-5-11 8-18 14-8l14 20" />
      <path className="l1-hand-detail" d="M38 82c10-6 23-7 35-2M49 96c8-3 16-2 23 2" />
    </svg>
  )
}

function HandGuide({ notes, position }: { notes: number[]; position: 'low' | 'high' | null }) {
  const reduced = useReducedMotion()
  const levelOf = (midi: number) => midi === 64 ? 'high' : 'low'
  if (reduced) {
    return (
      <div className="l1-hand-stage reduced" aria-label="两个静态手势位置按声音顺序排列">
        {notes.map((note, index) => (
          <div key={index} className={`l1-static-hand ${levelOf(note)}`}>
            <span>{index + 1}</span>
            <HandDrawing />
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="l1-hand-stage" aria-hidden="true">
      <span className="l1-hand-wave top" />
      <span className="l1-hand-wave bottom" />
      <div className={`l1-moving-hand ${position ?? 'rest'}`}>
        <HandDrawing />
      </div>
    </div>
  )
}

export function GuidedHandTask({ replayNonce, onDone }: TaskProps) {
  const [round, setRound] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [ready, setReady] = useState(false)
  const [position, setPosition] = useState<'low' | 'high' | null>(null)
  const [error, setError] = useState(false)
  const [replayCount, setReplayCount] = useState(0)
  const [demoReplayCount, setDemoReplayCount] = useState(0)
  const startedAtRef = useRef(Date.now())
  const notes = round === 0 ? [60, 64] : [64, 60]

  const playCurrent = useCallback(async () => {
    setPlaying(true)
    setReady(false)
    setError(false)
    setPosition(null)
    try {
      const completed = await playLesson1Sequence(notes, {
        noteMs: 600,
        gapMs: 300,
        onNote: index => setPosition(notes[index] === 64 ? 'high' : 'low'),
      })
      if (completed) {
        setPlaying(false)
        setReady(true)
      }
    } catch {
      setPlaying(false)
      setError(true)
    }
  }, [round])

  useEffect(() => {
    void playCurrent()
    return () => stopLesson1Audio()
  }, [playCurrent, replayNonce])

  return (
    <section className="l1-task l1-guided-demo" aria-labelledby="L01T01-title">
      <div className="l1-demo-notice" role="note">
        <strong>做题示范</strong>
      </div>
      <h2 id="L01T01-title">手跟着声音走</h2>
      <p className="l1-guide">声音与手的高低位置变化结合，会有更直观的感受。</p>
      <p className="l1-guide">可以用自己的手，跟着声音放得更高或更低。</p>
      <p className="l1-item-count">示范第 {round + 1} / 2 轮</p>
      <HandGuide notes={notes} position={position} />
      {error && <p className="l1-feedback retry" role="alert">声音没有加载好，请再试一次。</p>}
      <div className="l1-task-actions wrap">
        <button className="btn ghost" disabled={playing} onClick={() => {
          setReplayCount(value => value + 1)
          setDemoReplayCount(value => value + 1)
          void playCurrent()
        }}>再听并看示范</button>
        <button className="btn primary" disabled={!ready || playing} onClick={() => {
          stopLesson1Audio()
          if (round === 0) setRound(1)
          else onDone({
            taskId: 'L01T01',
            completed: true,
            replayCount,
            demoReplayCount,
            durationMs: Date.now() - startedAtRef.current,
          })
        }}>{round === 0 ? '看完示范，再看一轮' : '看完示范，开始正式练习'}</button>
      </div>
    </section>
  )
}

type StepLevel = 'high' | 'middle' | 'low'
const STEP_TARGETS: StepLevel[] = ['high', 'middle', 'low']
const STEP_LABELS: Record<StepLevel, string> = { high: '高', middle: '中', low: '低' }
const stepLevelOf = (pitch: number): StepLevel => pitch === 64 ? 'high' : pitch === 62 ? 'middle' : 'low'

function stepAtPoint(x: number, y: number, dragSource: HTMLElement): StepLevel | null {
  // 海螺位于指针下方，暂时跳过它才能读到真正的台阶落点。
  const previousPointerEvents = dragSource.style.pointerEvents
  dragSource.style.pointerEvents = 'none'
  const target = document.elementFromPoint(x, y)?.closest('[data-l1-step]')
  dragSource.style.pointerEvents = previousPointerEvents
  const level = target?.getAttribute('data-l1-step')
  return level === 'high' || level === 'middle' || level === 'low' ? level : null
}

export function SoundStepsTask({ replayNonce, onDone, sequence }: TaskProps & { sequence: number[] }) {
  const [stepIndex, setStepIndex] = useState(0)
  const [placements, setPlacements] = useState<{ step: number; pitch: number; target: StepLevel }[]>([])
  const [errors, setErrors] = useState([0, 0, 0])
  const [selected, setSelected] = useState(false)
  const [playing, setPlaying] = useState(true)
  const [feedback, setFeedback] = useState('先完整听三个音，再听当前音。')
  const [error, setError] = useState(false)
  const [replayCount, setReplayCount] = useState(0)
  const [soundingStep, setSoundingStep] = useState<number | null>(null)
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null)
  const [dragOverStep, setDragOverStep] = useState<StepLevel | null>(null)
  const dragRef = useRef({ pointerId: -1, x: 0, y: 0, moved: false })
  const suppressClickRef = useRef(false)
  const startedAtRef = useRef(Date.now())
  const completed = stepIndex >= sequence.length

  const playCurrent = useCallback(async (manual = false) => {
    if (completed) return
    if (manual) setReplayCount(value => value + 1)
    setPlaying(true)
    setError(false)
    try {
      const completedPlayback = await playLesson1Sequence([sequence[stepIndex]], { noteMs: 600, gapMs: 300 })
      if (completedPlayback) setPlaying(false)
    } catch {
      setPlaying(false)
      setError(true)
    }
  }, [completed, sequence, stepIndex])

  const playAll = useCallback(async (manual = false, thenCurrent = false, revealSteps = false) => {
    if (manual) setReplayCount(value => value + 1)
    setPlaying(true)
    setError(false)
    setSoundingStep(null)
    try {
      const done = await playLesson1Sequence(sequence, {
        noteMs: 600,
        gapMs: 250,
        onNote: index => { if (revealSteps) setSoundingStep(index) },
      })
      if (done && thenCurrent && !completed) {
        const currentDone = await playLesson1Sequence([sequence[stepIndex]], { noteMs: 600, gapMs: 300 })
        if (currentDone) setPlaying(false)
      } else if (done) {
        setPlaying(false)
      }
    } catch {
      setPlaying(false)
      setError(true)
    } finally {
      setSoundingStep(null)
    }
  }, [completed, sequence, stepIndex])

  useEffect(() => {
    setSelected(false)
    setDragOffset(null)
    setDragOverStep(null)
    if (completed) void playAll(false, false, true)
    else if (stepIndex === 0) void playAll(false, true, false)
    else void playCurrent()
    return () => stopLesson1Audio()
  }, [stepIndex, replayNonce, sequence])

  const attemptPlace = (target: StepLevel) => {
    if (playing || completed) return
    const current = stepIndex
    if (target === stepLevelOf(sequence[current])) {
      const placement = { step: current, pitch: sequence[current], target }
      setPlacements(previous => [...previous, placement])
      setFeedback('放好了。接着听下一个音。')
      setSelected(false)
      setPlaying(true)
      setStepIndex(current + 1)
    } else {
      setErrors(previous => previous.map((value, index) => index === current ? value + 1 : value))
      setFeedback('这一层不对。已经放好的不会清空，再听当前音试一次。')
      setSelected(false)
      void playCurrent()
    }
    setDragOffset(null)
    setDragOverStep(null)
  }

  const placedAt = (level: StepLevel) => placements.find(item => item.target === level)

  return (
    <section className="l1-task" aria-labelledby="L01T06-title">
      <h2 id="L01T06-title">把三个音送上声音台阶</h2>
      <p className="l1-guide">按听到的顺序，一个一个放。</p>
      <p className="l1-item-count">{completed ? '三个音都放好了' : `现在听第 ${stepIndex + 1} 个音`}</p>

      {!completed && (
        <div className="l1-card-waiting">
          <button
            className={'l1-sound-card' + (selected ? ' selected' : '') + (dragOffset ? ' dragging' : '')}
            style={dragOffset ? { transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` } : undefined}
            disabled={playing}
            aria-label="当前声音：点一下海螺再选台阶，或拖动海螺到台阶上"
            onDragStart={event => event.preventDefault()}
            onPointerDown={event => {
              if (playing) return
              event.preventDefault()
              event.currentTarget.setPointerCapture(event.pointerId)
              dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false }
              setDragOverStep(null)
            }}
            onPointerMove={event => {
              const drag = dragRef.current
              if (drag.pointerId !== event.pointerId) return
              const x = event.clientX - drag.x
              const y = event.clientY - drag.y
              if (Math.hypot(x, y) > 7) drag.moved = true
              if (drag.moved) {
                setSelected(true)
                setDragOffset({ x, y })
                setDragOverStep(stepAtPoint(event.clientX, event.clientY, event.currentTarget))
              }
            }}
            onPointerUp={event => {
              const drag = dragRef.current
              if (drag.pointerId !== event.pointerId) return
              if (drag.moved) {
                suppressClickRef.current = true
                const level = stepAtPoint(event.clientX, event.clientY, event.currentTarget)
                setDragOverStep(null)
                if (level) attemptPlace(level)
                else {
                  setFeedback('把海螺放到高、中或低的一层台阶上。')
                  setDragOffset(null)
                  setSelected(false)
                }
              }
              dragRef.current.pointerId = -1
            }}
            onPointerCancel={event => {
              if (dragRef.current.pointerId !== event.pointerId) return
              dragRef.current.pointerId = -1
              setDragOffset(null)
              setDragOverStep(null)
              setSelected(false)
            }}
            onClick={() => {
              if (suppressClickRef.current) {
                suppressClickRef.current = false
                return
              }
              setSelected(value => !value)
            }}
          >
            <img src="/badges/conch.png" alt="" draggable={false} />
          </button>
          <span className="l1-drag-hint">点海螺再点台阶，或直接拖动</span>
        </div>
      )}

      <div className="l1-steps" aria-label="低、中、高三层声音台阶">
        {STEP_TARGETS.map(level => {
          const placed = placedAt(level)
          return (
            <button
              key={level}
              data-l1-step={level}
              className={`l1-step ${level}` + (placed ? ' placed' : '') + (soundingStep === placed?.step ? ' sounding' : '') + (dragOverStep === level ? ' drop-target' : '')}
              disabled={playing}
              onClick={() => {
                if (placed) {
                  void playLesson1Sequence([placed.pitch], { noteMs: 600, gapMs: 300 })
                } else if (selected) {
                  attemptPlace(level)
                } else {
                  setFeedback('先点一下海螺，再点一层台阶。')
                }
              }}
            >
              <span className="l1-step-label">{STEP_LABELS[level]}</span>
              {placed && <span className="l1-placed-chip">第 {placed.step + 1} 个音</span>}
            </button>
          )
        })}
      </div>

      <p className="l1-feedback neutral" aria-live="polite">{feedback}</p>
      {error && <p className="l1-feedback retry" role="alert">声音没有加载好，请重听，不会记为放错。</p>}
      <div className="l1-task-actions wrap">
        {!completed && <button className="btn ghost" disabled={playing} onClick={() => void playCurrent(true)}>重听当前音</button>}
        <button className="btn ghost" disabled={playing} onClick={() => void playAll(true, !completed, completed)}>从头听三个音</button>
        {completed && (
          <button className="btn primary" disabled={playing} onClick={() => onDone({
            taskId: 'L01T06',
            sequence,
            placements,
            errorCountByStep: errors,
            replayCount,
            completed: true,
            durationMs: Date.now() - startedAtRef.current,
          })}>完成这个任务</button>
        )}
      </div>
    </section>
  )
}
