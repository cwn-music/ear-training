// 第2课任务1、6、7：固定配额、完整播放后作答、原题稳定重试。
import { useCallback, useEffect, useRef, useState } from 'react'
import { playLesson1Sequence, stopLesson1Audio } from './lesson1Audio'
import {
  type L2Direction,
  type L2DirectionItem,
  type L2DirectionRecord,
  type L2KeyItem,
  type L2KeyRecord,
  type L2NameItem,
  type L2NameRecord,
} from './lesson2Data'
import { L2PitchPath, L2SoundIcon, ThreeKeyPiano } from './Lesson2Shared'

interface TaskProps {
  replayNonce: number
  onDone: (record: Record<string, unknown>) => void
}

type Status = 'playing' | 'awaitingAnswer' | 'feedbackCorrect' | 'feedbackRetry' | 'error'

const DIRECTION_LABELS: Record<L2Direction, string> = { up: '上行', same: '同音', down: '下行' }

export function DirectionWarmupTask({ items, replayNonce, onDone }: TaskProps & { items: L2DirectionItem[] }) {
  const [itemIndex, setItemIndex] = useState(0)
  const [status, setStatus] = useState<Status>('playing')
  const [wrongOption, setWrongOption] = useState<L2Direction | null>(null)
  const [firstAnswer, setFirstAnswer] = useState<L2Direction | null>(null)
  const [firstCorrect, setFirstCorrect] = useState<boolean | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [showPath, setShowPath] = useState(false)
  const [activeNote, setActiveNote] = useState<number | null>(null)
  const [audioError, setAudioError] = useState(false)
  const recordsRef = useRef<L2DirectionRecord[]>([])
  const replayCountRef = useRef(0)
  const itemStartedAtRef = useRef(Date.now())
  const previousReplayNonceRef = useRef(replayNonce)
  const statusRef = useRef(status)
  statusRef.current = status
  const current = items[itemIndex]

  const playForAnswer = useCallback(async (manual = false) => {
    if (manual) replayCountRef.current += 1
    setStatus('playing')
    setAudioError(false)
    setActiveNote(null)
    try {
      const completed = await playLesson1Sequence(current.pitches, {
        noteMs: 650,
        gapMs: 300,
        onNote: setActiveNote,
      })
      if (completed) setStatus('awaitingAnswer')
    } catch {
      setStatus('error')
      setAudioError(true)
    } finally {
      setActiveNote(null)
    }
  }, [current])

  const replayFeedback = useCallback(async () => {
    replayCountRef.current += 1
    setAudioError(false)
    setActiveNote(null)
    try {
      await playLesson1Sequence(current.pitches, { noteMs: 650, gapMs: 300, onNote: setActiveNote })
    } catch {
      setAudioError(true)
    } finally {
      setActiveNote(null)
    }
  }, [current])

  useEffect(() => {
    setWrongOption(null)
    setFirstAnswer(null)
    setFirstCorrect(null)
    setAttempts(0)
    setShowPath(false)
    replayCountRef.current = 0
    itemStartedAtRef.current = Date.now()
    void playForAnswer()
    return () => stopLesson1Audio()
  }, [itemIndex, playForAnswer])

  useEffect(() => {
    if (previousReplayNonceRef.current === replayNonce) return
    previousReplayNonceRef.current = replayNonce
    if (statusRef.current === 'feedbackCorrect') void replayFeedback()
    else void playForAnswer()
  }, [replayNonce, playForAnswer, replayFeedback])

  const answer = async (optionId: L2Direction) => {
    if (status !== 'awaitingAnswer') return
    const correct = optionId === current.correctOptionId
    const nextAttempts = attempts + 1
    const initialAnswer = firstAnswer ?? optionId
    const initialCorrect = firstCorrect ?? correct
    setFirstAnswer(initialAnswer)
    setFirstCorrect(initialCorrect)
    setAttempts(nextAttempts)
    setWrongOption(correct ? null : optionId)
    setShowPath(true)
    setStatus(correct ? 'feedbackCorrect' : 'feedbackRetry')
    replayCountRef.current += 1

    if (correct) {
      const record: L2DirectionRecord = {
        taskId: 'L02T01',
        itemId: current.itemId,
        pitches: current.pitches,
        relation: current.relation,
        optionOrder: current.optionOrder,
        correctIndex: current.correctIndex,
        firstAnswer: initialAnswer,
        firstAttemptCorrect: initialCorrect,
        attemptCount: nextAttempts,
        finalCorrect: true,
        replayCount: replayCountRef.current,
        durationMs: Date.now() - itemStartedAtRef.current,
        reviewTag: initialCorrect ? null : `L02T01:${current.relation}`,
      }
      recordsRef.current.push(record)
    }

    try {
      await playLesson1Sequence(current.pitches, { noteMs: 650, gapMs: 300, onNote: setActiveNote })
      if (!correct) {
        setWrongOption(null)
        setStatus('awaitingAnswer')
      }
    } catch {
      setAudioError(true)
      setStatus(correct ? 'feedbackCorrect' : 'awaitingAnswer')
    } finally {
      setActiveNote(null)
    }
  }

  const next = () => {
    if (status !== 'feedbackCorrect') return
    stopLesson1Audio()
    if (itemIndex + 1 < items.length) setItemIndex(itemIndex + 1)
    else onDone({ taskId: 'L02T01', items: recordsRef.current, completed: true })
  }

  const relationText = current.relation === 'same'
    ? '两个音一样高，声音没有往上，也没有往下。'
    : current.relation === 'up' ? '第二个音更高，声音往上走。' : '第二个音更低，声音往下走。'

  return (
    <section className="l1-task" aria-labelledby="L02T01-title">
      <h2 id="L02T01-title">声音怎样走？</h2>
      <p className="l1-guide">先听完整，再选择上行、同音或下行。</p>
      <p className="l1-item-count">本任务第 {itemIndex + 1} / {items.length} 题</p>
      <div className="l2-play-orbit" aria-hidden="true">
        <span className={activeNote === 0 ? 'playing' : ''}>1</span>
        <L2SoundIcon />
        <span className={activeNote === 1 ? 'playing' : ''}>2</span>
      </div>
      {showPath && <div className="l1-answer-visuals"><L2PitchPath pitches={current.pitches} /></div>}
      <div className="l1-choice-grid l1-choice-3">
        {current.optionOrder.map(optionId => (
          <button
            key={optionId}
            className={'l1-option' + (status === 'feedbackCorrect' && optionId === current.correctOptionId ? ' correct' : '') + (wrongOption === optionId ? ' wrong' : '')}
            disabled={status !== 'awaitingAnswer'}
            onClick={() => void answer(optionId)}
          >{DIRECTION_LABELS[optionId]}</button>
        ))}
      </div>
      {status === 'feedbackCorrect' && <p className="l1-feedback correct">{relationText}</p>}
      {status === 'feedbackRetry' && <p className="l1-feedback retry">再听一次，看着声音的路径试一试。</p>}
      {audioError && <p className="l1-feedback retry" role="alert">声音没有加载好，请点“再听一遍”重新加载。</p>}
      <div className="l1-task-actions wrap">
        <button className="btn ghost" disabled={status === 'playing'} onClick={() => {
          if (status === 'feedbackCorrect') void replayFeedback()
          else void playForAnswer(true)
        }}>再听一遍</button>
        <button className="btn ghost" disabled={attempts === 0 || status === 'playing'} onClick={() => {
          setShowPath(true)
          if (status === 'feedbackCorrect') void replayFeedback()
          else void playForAnswer(true)
        }}>看路径再听</button>
        {status === 'feedbackCorrect' && <button className="btn primary" onClick={next}>{itemIndex + 1 < items.length ? '下一题' : '完成这个任务'}</button>}
      </div>
    </section>
  )
}

export function ListenNameTask({ items, replayNonce, onDone }: TaskProps & { items: L2NameItem[] }) {
  const [itemIndex, setItemIndex] = useState(0)
  const [status, setStatus] = useState<Status>('playing')
  const [wrongOption, setWrongOption] = useState<string | null>(null)
  const [firstAnswer, setFirstAnswer] = useState<string | null>(null)
  const [firstCorrect, setFirstCorrect] = useState<boolean | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [usedReference, setUsedReference] = useState(false)
  const [activePitch, setActivePitch] = useState<number | null>(null)
  const [audioError, setAudioError] = useState(false)
  const recordsRef = useRef<L2NameRecord[]>([])
  const replayCountRef = useRef(0)
  const itemStartedAtRef = useRef(Date.now())
  const previousReplayNonceRef = useRef(replayNonce)
  const statusRef = useRef(status)
  statusRef.current = status
  const current = items[itemIndex]

  const playSequence = useCallback(async (notes: number[], after: 'awaitingAnswer' | 'feedbackCorrect', manual: boolean) => {
    if (manual) replayCountRef.current += 1
    setStatus('playing')
    setAudioError(false)
    setActivePitch(null)
    try {
      const completed = await playLesson1Sequence(notes, {
        noteMs: 650,
        gapMs: 300,
        onNote: index => setActivePitch(notes[index]),
      })
      if (completed) setStatus(after)
    } catch {
      setAudioError(true)
      setStatus(after)
    } finally {
      setActivePitch(null)
    }
  }, [])

  const playForAnswer = useCallback((manual = false) => playSequence([current.pitch], 'awaitingAnswer', manual), [current, playSequence])
  const replayCorrect = useCallback(() => playSequence([current.pitch], 'feedbackCorrect', true), [current, playSequence])

  useEffect(() => {
    setWrongOption(null)
    setFirstAnswer(null)
    setFirstCorrect(null)
    setAttempts(0)
    setShowAnswer(false)
    setUsedReference(false)
    replayCountRef.current = 0
    itemStartedAtRef.current = Date.now()
    void playForAnswer()
    return () => stopLesson1Audio()
  }, [itemIndex, playForAnswer])

  useEffect(() => {
    if (previousReplayNonceRef.current === replayNonce) return
    previousReplayNonceRef.current = replayNonce
    if (statusRef.current === 'feedbackCorrect') void replayCorrect()
    else void playForAnswer()
  }, [replayNonce, playForAnswer, replayCorrect])

  const playReference = async () => {
    if (status === 'playing') return
    setUsedReference(true)
    await playSequence([60, current.pitch], status === 'feedbackCorrect' ? 'feedbackCorrect' : 'awaitingAnswer', true)
  }

  const answer = async (optionId: string) => {
    if (status !== 'awaitingAnswer') return
    const correct = optionId === current.correctOptionId
    const nextAttempts = attempts + 1
    const initialAnswer = firstAnswer ?? optionId
    const initialCorrect = firstCorrect ?? correct
    setFirstAnswer(initialAnswer)
    setFirstCorrect(initialCorrect)
    setAttempts(nextAttempts)
    setWrongOption(correct ? null : optionId)
    setShowAnswer(true)
    if (!correct) setUsedReference(true)
    replayCountRef.current += 1

    if (correct) {
      const record: L2NameRecord = {
        taskId: 'L02T06',
        itemId: current.itemId,
        pitch: current.pitch,
        answerSolfege: current.answerSolfege,
        optionOrder: current.optionOrder,
        correctIndex: current.correctIndex,
        firstAnswer: initialAnswer,
        firstAttemptCorrect: initialCorrect,
        attemptCount: nextAttempts,
        finalCorrect: true,
        usedReference: usedReference || !initialCorrect,
        replayCount: replayCountRef.current,
        durationMs: Date.now() - itemStartedAtRef.current,
        reviewTag: initialCorrect ? null : `L02T06:${current.answerSolfege}`,
      }
      recordsRef.current.push(record)
    }

    setStatus(correct ? 'feedbackCorrect' : 'feedbackRetry')
    const notes = correct ? [current.pitch] : [60, current.pitch]
    try {
      await playLesson1Sequence(notes, { noteMs: 650, gapMs: 300, onNote: index => setActivePitch(notes[index]) })
      if (!correct) {
        setWrongOption(null)
        setStatus('awaitingAnswer')
      }
    } catch {
      setAudioError(true)
      setStatus(correct ? 'feedbackCorrect' : 'awaitingAnswer')
    } finally {
      setActivePitch(null)
    }
  }

  const next = () => {
    if (status !== 'feedbackCorrect') return
    stopLesson1Audio()
    if (itemIndex + 1 < items.length) setItemIndex(itemIndex + 1)
    else onDone({ taskId: 'L02T06', items: recordsRef.current, completed: true })
  }

  return (
    <section className="l1-task" aria-labelledby="L02T06-title">
      <h2 id="L02T06-title">你听到的是哪个名字？</h2>
      <p className="l1-guide">只听声音，先不看琴键答案。</p>
      <p className="l1-item-count">本任务第 {itemIndex + 1} / {items.length} 题</p>
      <div className={'l2-play-orbit single' + (activePitch !== null ? ' playing' : '')} aria-hidden="true"><L2SoundIcon /></div>
      {showAnswer && (
        <div className="l2-answer-key">
          <strong>{current.answerSolfege}</strong>
          <ThreeKeyPiano activePitch={activePitch} correctPitch={current.pitch} />
        </div>
      )}
      <div className="l1-choice-grid l1-choice-3">
        {current.optionOrder.map(optionId => (
          <button
            key={optionId}
            className={'l1-option' + (showAnswer && optionId === current.correctOptionId ? ' correct' : '') + (wrongOption === optionId ? ' wrong' : '')}
            disabled={status !== 'awaitingAnswer'}
            onClick={() => void answer(optionId)}
          >{optionId}</button>
        ))}
      </div>
      {status === 'feedbackCorrect' && <p className="l1-feedback correct">这个声音叫 {current.answerSolfege}，对应高亮的琴键。</p>}
      {status === 'feedbackRetry' && <p className="l1-feedback retry">先听 do 作参照，再听这个音；正确对应已经显示，再试一次。</p>}
      {audioError && <p className="l1-feedback retry" role="alert">声音没有加载好，请再听一次。</p>}
      <div className="l1-task-actions wrap">
        <button className="btn ghost" disabled={status === 'playing'} onClick={() => {
          if (status === 'feedbackCorrect') void replayCorrect()
          else void playForAnswer(true)
        }}>再听一次</button>
        <button className="btn ghost" disabled={status === 'playing'} onClick={() => void playReference()}>听参照音后重听</button>
        {status === 'feedbackCorrect' && <button className="btn primary" onClick={next}>{itemIndex + 1 < items.length ? '下一题' : '完成这个任务'}</button>}
      </div>
    </section>
  )
}

export function FindKeyTask({ items, replayNonce, onDone }: TaskProps & { items: L2KeyItem[] }) {
  const [itemIndex, setItemIndex] = useState(0)
  const [status, setStatus] = useState<Status>('playing')
  const [firstSelectedKey, setFirstSelectedKey] = useState<number | null>(null)
  const [firstCorrect, setFirstCorrect] = useState<boolean | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [wrongPitch, setWrongPitch] = useState<number | null>(null)
  const [showHint, setShowHint] = useState(false)
  const [usedSolfegeHint, setUsedSolfegeHint] = useState(false)
  const [activePitch, setActivePitch] = useState<number | null>(null)
  const [audioError, setAudioError] = useState(false)
  const recordsRef = useRef<L2KeyRecord[]>([])
  const replayCountRef = useRef(0)
  const itemStartedAtRef = useRef(Date.now())
  const previousReplayNonceRef = useRef(replayNonce)
  const statusRef = useRef(status)
  statusRef.current = status
  const current = items[itemIndex]

  const playTarget = useCallback(async (manual = false, after: 'awaitingAnswer' | 'feedbackCorrect' = 'awaitingAnswer') => {
    if (manual) replayCountRef.current += 1
    setStatus('playing')
    setAudioError(false)
    try {
      const completed = await playLesson1Sequence([current.pitch], { noteMs: 650, gapMs: 300, onNote: () => setActivePitch(current.pitch) })
      if (completed) setStatus(after)
    } catch {
      setAudioError(true)
      setStatus(after)
    } finally {
      setActivePitch(null)
    }
  }, [current])

  useEffect(() => {
    setFirstSelectedKey(null)
    setFirstCorrect(null)
    setAttempts(0)
    setWrongPitch(null)
    setShowHint(false)
    setUsedSolfegeHint(false)
    replayCountRef.current = 0
    itemStartedAtRef.current = Date.now()
    void playTarget()
    return () => stopLesson1Audio()
  }, [itemIndex, playTarget])

  useEffect(() => {
    if (previousReplayNonceRef.current === replayNonce) return
    previousReplayNonceRef.current = replayNonce
    void playTarget(false, statusRef.current === 'feedbackCorrect' ? 'feedbackCorrect' : 'awaitingAnswer')
  }, [replayNonce, playTarget])

  const answer = async (pitch: number) => {
    if (status !== 'awaitingAnswer') return
    const correct = pitch === current.pitch
    const nextAttempts = attempts + 1
    const initialSelected = firstSelectedKey ?? pitch
    const initialCorrect = firstCorrect ?? correct
    setFirstSelectedKey(initialSelected)
    setFirstCorrect(initialCorrect)
    setAttempts(nextAttempts)
    setWrongPitch(correct ? null : pitch)
    setShowHint(false)
    if (!correct) setUsedSolfegeHint(true)
    setStatus(correct ? 'feedbackCorrect' : 'feedbackRetry')
    replayCountRef.current += 1

    if (correct) {
      const record: L2KeyRecord = {
        taskId: 'L02T07',
        itemId: current.itemId,
        pitch: current.pitch,
        selectedKey: pitch,
        firstSelectedKey: initialSelected,
        firstAttemptCorrect: initialCorrect,
        attemptCount: nextAttempts,
        finalCorrect: true,
        usedSolfegeHint: usedSolfegeHint || !initialCorrect,
        replayCount: replayCountRef.current,
        durationMs: Date.now() - itemStartedAtRef.current,
        reviewTag: initialCorrect ? null : `L02T07:${current.answerSolfege}`,
      }
      recordsRef.current.push(record)
    }

    const notes = correct ? [pitch] : [pitch, current.pitch]
    try {
      await playLesson1Sequence(notes, { noteMs: 650, gapMs: 350, onNote: index => setActivePitch(notes[index]) })
      if (!correct) {
        setWrongPitch(null)
        setShowHint(true)
        setStatus('awaitingAnswer')
      }
    } catch {
      setAudioError(true)
      if (!correct) setShowHint(true)
      setStatus(correct ? 'feedbackCorrect' : 'awaitingAnswer')
    } finally {
      setActivePitch(null)
    }
  }

  const next = () => {
    if (status !== 'feedbackCorrect') return
    stopLesson1Audio()
    if (itemIndex + 1 < items.length) setItemIndex(itemIndex + 1)
    else onDone({ taskId: 'L02T07', items: recordsRef.current, completed: true })
  }

  return (
    <section className="l1-task" aria-labelledby="L02T07-title">
      <h2 id="L02T07-title">听一听，找到它的琴键</h2>
      <p className="l1-guide">可以先在心里唱出名字。三个琴键的位置一直不变。</p>
      <p className="l1-item-count">本任务第 {itemIndex + 1} / {items.length} 题</p>
      <ThreeKeyPiano
        interactive
        disabled={status !== 'awaitingAnswer'}
        activePitch={activePitch}
        correctPitch={showHint || status === 'feedbackCorrect' ? current.pitch : null}
        wrongPitch={wrongPitch}
        onPick={pitch => void answer(pitch)}
      />
      {status === 'feedbackCorrect' && <p className="l1-feedback correct">找到了，这是 {current.answerSolfege} 的琴键。</p>}
      {status === 'feedbackRetry' && <p className="l1-feedback retry">先听你点的音，再听目标音。唱名提示：目标是 {current.answerSolfege}。</p>}
      {showHint && status === 'awaitingAnswer' && <p className="l1-small-hint">唱名提示：目标是 {current.answerSolfege}，再点一次它的琴键。</p>}
      {audioError && <p className="l1-feedback retry" role="alert">声音没有加载好，请再听一次。</p>}
      <div className="l1-task-actions wrap">
        <button className="btn ghost" disabled={status === 'playing'} onClick={() => void playTarget(true, status === 'feedbackCorrect' ? 'feedbackCorrect' : 'awaitingAnswer')}>再听一次</button>
        <button className="btn ghost" disabled={attempts === 0 || status === 'playing'} onClick={() => {
          setUsedSolfegeHint(true)
          setShowHint(true)
          void playTarget(true, status === 'feedbackCorrect' ? 'feedbackCorrect' : 'awaitingAnswer')
        }}>听唱名提示</button>
        {status === 'feedbackCorrect' && <button className="btn primary" onClick={next}>{itemIndex + 1 < items.length ? '下一题' : '完成这个任务'}</button>}
      </div>
    </section>
  )
}
