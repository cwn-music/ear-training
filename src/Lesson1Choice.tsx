// 第1课任务2—5：固定配额、完整播放后作答、答错原题重试。
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChoiceRecord, ChoiceTaskConfig } from './lesson1Data'
import { playLesson1Sequence, stopLesson1Audio } from './lesson1Audio'
import { HandDrawing } from './Lesson1Tasks'

interface Props {
  config: ChoiceTaskConfig
  replayNonce: number
  onDone: (record: Record<string, unknown>) => void
}

type Status = 'playing' | 'awaitingAnswer' | 'feedbackCorrect' | 'feedbackRetry' | 'feedbackReveal' | 'error'

const MAX_ATTEMPTS = 3

function SoundIcon() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className="l1-sound-icon">
      <path d="M7 16h7l9-8v24l-9-8H7z" />
      <path d="M28 14c3 3 3 9 0 12M32 10c5 5 5 15 0 20" />
    </svg>
  )
}

function pitchPathGeometry(pitches: [number, number]) {
  const same = pitches[0] === pitches[1]
  const rising = pitches[1] > pitches[0]
  return {
    same,
    rising,
    y1: same ? 56 : rising ? 80 : 32,
    y2: same ? 56 : rising ? 32 : 80,
  }
}

function PitchPath({ pitches }: { pitches: [number, number] }) {
  const { same, rising, y1, y2 } = pitchPathGeometry(pitches)
  return (
    <svg className="l1-pitch-path" viewBox="0 0 280 116" role="img" aria-label={same ? '两个音在同一水平高度' : rising ? '第二个音的位置更高' : '第二个音的位置更低'}>
      <path className="l1-path-line" d={`M48 ${y1} C105 ${y1} 165 ${y2} 232 ${y2}`} />
      <circle className="l1-path-dot" cx="48" cy={y1} r="11" />
      <circle className="l1-path-dot" cx="232" cy={y2} r="11" />
    </svg>
  )
}

export default function Lesson1Choice({ config, replayNonce, onDone }: Props) {
  const [itemIndex, setItemIndex] = useState(0)
  const [status, setStatus] = useState<Status>('playing')
  const [wrongOption, setWrongOption] = useState<string | null>(null)
  const [firstAnswer, setFirstAnswer] = useState<string | null>(null)
  const [firstCorrect, setFirstCorrect] = useState<boolean | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [showPath, setShowPath] = useState(false)
  const [activeNote, setActiveNote] = useState<number | null>(null)
  const [feedbackPlaying, setFeedbackPlaying] = useState(false)
  const [soloPlaying, setSoloPlaying] = useState<number | null>(null)
  const [error, setError] = useState(false)

  const recordsRef = useRef<ChoiceRecord[]>([])
  const replayCountRef = useRef(0)
  const itemStartedAtRef = useRef(Date.now())
  const statusRef = useRef(status)
  statusRef.current = status
  const previousReplayNonceRef = useRef(replayNonce)

  const current = config.items[itemIndex]
  const labelOf = (id: string) => config.options.find(option => option.id === id)?.label ?? id

  const playForAnswer = useCallback(async (manual = false) => {
    if (manual) replayCountRef.current += 1
    setStatus('playing')
    setError(false)
    setActiveNote(null)
    try {
      const completed = await playLesson1Sequence(current.pitches, {
        timbre: config.timbre,
        noteMs: 600,
        gapMs: 300,
        onNote: setActiveNote,
      })
      if (completed) {
        setActiveNote(null)
        setStatus('awaitingAnswer')
      }
    } catch {
      setActiveNote(null)
      setStatus('error')
      setError(true)
    }
  }, [config.timbre, current])

  const replayFeedback = useCallback(async () => {
    replayCountRef.current += 1
    setFeedbackPlaying(true)
    setError(false)
    setActiveNote(null)
    try {
      await playLesson1Sequence(current.pitches, {
        timbre: config.timbre,
        noteMs: 600,
        gapMs: 300,
        onNote: setActiveNote,
      })
    } catch {
      setError(true)
    } finally {
      setActiveNote(null)
      setFeedbackPlaying(false)
    }
  }, [config.timbre, current])

  useEffect(() => {
    setWrongOption(null)
    setFirstAnswer(null)
    setFirstCorrect(null)
    setAttempts(0)
    setShowPath(false)
    setFeedbackPlaying(false)
    replayCountRef.current = 0
    itemStartedAtRef.current = Date.now()
    void playForAnswer()
    return () => stopLesson1Audio()
  }, [itemIndex, playForAnswer])

  useEffect(() => {
    // 只在“从后台回来”这一事件变化时重播；切题时由初始化效果负责，避免双序列。
    if (previousReplayNonceRef.current === replayNonce) return
    previousReplayNonceRef.current = replayNonce
    if (statusRef.current === 'feedbackCorrect' || statusRef.current === 'feedbackReveal') void replayFeedback()
    else void playForAnswer()
  }, [replayNonce, playForAnswer, replayFeedback])

  const playSolo = async (index: number) => {
    if (status === 'playing' || feedbackPlaying || soloPlaying !== null) return
    replayCountRef.current += 1
    setSoloPlaying(index)
    setActiveNote(index)
    try {
      await playLesson1Sequence([current.pitches[index]], {
        timbre: config.timbre,
        noteMs: 600,
        gapMs: 300,
      })
    } catch {
      setError(true)
    } finally {
      setSoloPlaying(null)
      setActiveNote(null)
    }
  }

  const answer = async (optionId: string) => {
    if (status !== 'awaitingAnswer' || feedbackPlaying || attempts >= MAX_ATTEMPTS) return
    const correct = optionId === current.correctOptionId
    const nextAttempts = attempts + 1
    const itemSettled = correct || nextAttempts === MAX_ATTEMPTS
    const initialAnswer = firstAnswer ?? optionId
    const initialCorrect = firstCorrect ?? correct
    setFirstAnswer(initialAnswer)
    setFirstCorrect(initialCorrect)
    setAttempts(nextAttempts)
    setWrongOption(correct ? null : optionId)
    // 前两次答错只重听、重试；答对或第三次答错时才显示完整答案。
    setShowPath(itemSettled)
    setError(false)
    replayCountRef.current += 1
    setFeedbackPlaying(true)

    if (itemSettled) {
      const record: ChoiceRecord = {
        taskId: config.taskId,
        itemId: current.itemId,
        pitches: current.pitches,
        relation: current.relation,
        comparisonDirection: current.comparisonDirection,
        correctOptionId: current.correctOptionId,
        optionOrder: current.optionOrder,
        correctIndex: current.correctIndex,
        firstAnswer: initialAnswer,
        firstAttemptCorrect: initialCorrect,
        attemptCount: nextAttempts,
        finalCorrect: correct,
        replayCount: replayCountRef.current,
        durationMs: Date.now() - itemStartedAtRef.current,
        timbre: config.timbre,
        reviewTag: current.relation === 'same' && !initialCorrect ? `${config.taskId}:same` : null,
      }
      const existing = recordsRef.current.findIndex(item => item.itemId === current.itemId)
      if (existing >= 0) recordsRef.current[existing] = record
      else recordsRef.current.push(record)
    }

    if (correct) setStatus('feedbackCorrect')
    else if (itemSettled) setStatus('feedbackReveal')
    else setStatus('feedbackRetry')

    try {
      const completed = await playLesson1Sequence(current.pitches, {
        timbre: config.timbre,
        noteMs: 600,
        gapMs: 300,
        onNote: setActiveNote,
      })
      if (!itemSettled && completed) {
        setWrongOption(null)
        setStatus('awaitingAnswer')
      }
    } catch {
      setError(true)
      if (!itemSettled) setStatus('error')
    } finally {
      setActiveNote(null)
      setFeedbackPlaying(false)
    }
  }

  const next = () => {
    if ((status !== 'feedbackCorrect' && status !== 'feedbackReveal') || feedbackPlaying) return
    stopLesson1Audio()
    if (itemIndex + 1 < config.items.length) {
      // 与切题同步清空答案，避免新题在效果运行前闪现上一题状态。
      setStatus('playing')
      setWrongOption(null)
      setShowPath(false)
      setActiveNote(null)
      setItemIndex(itemIndex + 1)
    } else {
      onDone({
        taskId: config.taskId,
        items: recordsRef.current,
        completed: true,
      })
    }
  }

  const relationText = current.relation === 'same'
    ? config.kind === 'direction' ? '声音没有往上，也没有往下。' : '两个音一样高。'
    : current.relation === 'different'
      ? '两个音不同。'
      : config.kind === 'compare' && current.comparisonDirection === 'firstToSecond'
        ? current.correctOptionId === 'higher'
          ? '第一个音更高，第二个音更低。'
          : '第一个音更低，第二个音更高。'
        : current.relation === 'higher' || current.relation === 'up'
          ? '第二个音更高，声音往上走。'
          : '第二个音更低，声音往下走。'
  const itemTitle = config.kind === 'compare' && current.comparisonDirection === 'firstToSecond'
    ? '第一个音与第二个音相比？'
    : config.title
  const showHand = config.taskId === 'L01T02' || config.taskId === 'L01T03'
  const answerFeedback = status === 'feedbackCorrect' || status === 'feedbackReveal'
  const handNoteIndex = activeNote ?? (feedbackPlaying || status === 'playing' ? 0 : 1)
  const handGeometry = pitchPathGeometry(current.pitches)
  const handPoint = {
    x: handNoteIndex === 0 ? 48 : 232,
    y: handNoteIndex === 0 ? handGeometry.y1 : handGeometry.y2,
  }

  return (
    <section className="l1-task l1-choice-task" aria-labelledby={`${config.taskId}-title`}>
      <h2 id={`${config.taskId}-title`}>{itemTitle}</h2>
      <p className="l1-guide">{config.guide}</p>
      <p className="l1-item-count">本任务第 {itemIndex + 1} / {config.items.length} 题</p>

      <div className="l1-sound-pair" aria-label="两个声音，可在完整播放后分开听">
        {[0, 1].map(index => (
          <button
            key={index}
            className={'l1-sound-button' + (activeNote === index ? ' playing' : '')}
            onClick={() => void playSolo(index)}
            disabled={status === 'playing' || feedbackPlaying || soloPlaying !== null}
            aria-label={`分开听第 ${index + 1} 个音`}
          >
            <SoundIcon />
            <span>{index + 1}</span>
          </button>
        ))}
      </div>
      <p className="l1-small-hint">先完整听，再选择；可点 1、2 分开听。</p>

      {showPath && (
        <div className="l1-answer-visuals">
          <div className="l1-pitch-path-wrap">
            <PitchPath pitches={current.pitches} />
            {showHand && (
              <div
                className="l1-answer-hand"
                data-note-index={handNoteIndex}
                style={{ left: `${handPoint.x / 280 * 100}%`, top: `${handPoint.y / 116 * 100}%` }}
                aria-hidden="true"
              >
                <HandDrawing />
              </div>
            )}
          </div>
          {showHand && <p className="l1-gesture-caption">手势回顾：手也跟着声音移动。</p>}
        </div>
      )}

      <div className={`l1-choice-grid l1-choice-${current.optionOrder.length}`}>
        {current.optionOrder.map(optionId => {
          const isWrong = wrongOption === optionId
          const showCorrect = answerFeedback && optionId === current.correctOptionId
          return (
            <button
              key={optionId}
              className={'l1-option' + (showCorrect ? ' correct' : '') + (isWrong ? ' wrong' : '')}
              disabled={status !== 'awaitingAnswer' || feedbackPlaying}
              onClick={() => void answer(optionId)}
            >
              {showCorrect && <span aria-hidden="true">✓ </span>}
              {labelOf(optionId)}
              {isWrong && <small>{status === 'feedbackReveal' ? '你的选择' : '再听听'}</small>}
            </button>
          )
        })}
      </div>

      {status === 'playing' && <p className="l1-status" aria-live="polite">正在播放，请先听完整…</p>}
      {status === 'feedbackCorrect' && (
        <div className="l1-feedback correct" aria-live="polite">
          <strong>答对了。</strong> {relationText}
        </div>
      )}
      {status === 'feedbackRetry' && (
        <div className="l1-feedback retry" aria-live="polite">
          再听一遍。
        </div>
      )}
      {status === 'awaitingAnswer' && attempts > 0 && attempts < MAX_ATTEMPTS && (
        <div className="l1-feedback retry" aria-live="polite">
          <strong>再试一次。</strong> 听完两个音再选择。
        </div>
      )}
      {status === 'feedbackReveal' && (
        <div className="l1-feedback reveal" aria-live="polite">
          正确答案是“{labelOf(current.correctOptionId)}”。{relationText}
          {showHand ? '请看路径和手势移动的方向。' : '请看声音路径，再听一遍。'}
        </div>
      )}
      {error && (
        <div className="l1-feedback retry" role="alert">
          {answerFeedback ? '反馈声音没有播放完整，不影响继续。' : '声音没有播放完整，请重新加载后再试。'}
          <button className="btn ghost" onClick={() => answerFeedback ? void replayFeedback() : void playForAnswer()}>重新加载</button>
        </div>
      )}

      <div className="l1-task-actions">
        <button
          className="btn ghost"
          onClick={() => answerFeedback ? void replayFeedback() : void playForAnswer(true)}
          disabled={status === 'playing' || feedbackPlaying}
        >
          {status === 'feedbackReveal' ? '看着答案再听' : config.taskId === 'L01T05' && showPath ? '看路径再听' : '再听一遍'}
        </button>
        {answerFeedback && (
          <button className="btn primary" onClick={next} disabled={feedbackPlaying}>
            {itemIndex + 1 < config.items.length ? '下一题' : '完成这个任务'}
          </button>
        )}
      </div>
    </section>
  )
}
