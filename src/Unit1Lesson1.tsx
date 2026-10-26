// 缪斯 Muse · 第一单元第1课「声音有高低」V2.0
import { useEffect, useMemo, useRef, useState } from 'react'
import Lesson1Choice from './Lesson1Choice'
import Lesson1Echo from './Lesson1Echo'
import { GuidedHandTask, SoundStepsTask } from './Lesson1Tasks'
import { playLesson1Sequence, prepareLesson1Audio, stopLesson1Audio } from './lesson1Audio'
import {
  archiveLesson1Session,
  buildLesson1ChoiceTasks,
  createLesson1Session,
  L1_TASK_IDS,
  loadLesson1Store,
  saveLesson1Current,
  type ChoiceItem,
  type ChoiceRecord,
  type ChoiceTaskConfig,
  type ChoiceTaskId,
  type Lesson1Session,
} from './lesson1Data'
import './Unit1Lesson1.css'

interface Props {
  onBack: () => void
  onLessonComplete: () => void
}

type Stage = 'intro' | 'tasks' | 'done' | 'review' | 'reviewDone'

const CHOICE_TASK_IDS: ChoiceTaskId[] = ['L01T02', 'L01T03', 'L01T04', 'L01T05']
type WrongRecord = Pick<ChoiceRecord, 'itemId' | 'firstAnswer' | 'firstAttemptCorrect'>
interface WrongEntry {
  config: ChoiceTaskConfig
  item: ChoiceItem
  firstAnswer: string
}

function wrongRecordsOf(value: unknown): WrongRecord[] {
  if (!value || typeof value !== 'object') return []
  const items = (value as { items?: unknown }).items
  if (!Array.isArray(items)) return []
  return items.filter((item): item is WrongRecord => {
    if (!item || typeof item !== 'object') return false
    const record = item as Partial<ChoiceRecord>
    return typeof record.itemId === 'string'
      && typeof record.firstAnswer === 'string'
      && record.firstAttemptCorrect === false
  })
}

function collectWrongEntries(
  session: Lesson1Session | null,
  tasks: Record<ChoiceTaskId, ChoiceTaskConfig>,
): WrongEntry[] {
  const entries: WrongEntry[] = []
  for (const taskId of CHOICE_TASK_IDS) {
    const config = tasks[taskId]
    for (const record of wrongRecordsOf(session?.records[taskId])) {
      const item = config.items.find(candidate => candidate.itemId === record.itemId)
      if (item) entries.push({ config, item, firstAnswer: record.firstAnswer })
    }
  }
  return entries
}

const optionLabel = (config: ChoiceTaskConfig, optionId: string) =>
  config.options.find(option => option.id === optionId)?.label ?? optionId

const reviewPromptOf = (entry: WrongEntry) =>
  entry.config.kind === 'compare' && entry.item.comparisonDirection === 'firstToSecond'
    ? '第一个音与第二个音相比？'
    : entry.config.title

function requestedSeed(): number | undefined {
  const value = new URLSearchParams(location.search).get('lesson1Seed')
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed >>> 0 : undefined
}

export default function Unit1Lesson1({ onBack, onLessonComplete }: Props) {
  const [session, setSession] = useState<Lesson1Session | null>(() => loadLesson1Store().current)
  const [stage, setStage] = useState<Stage>(() => {
    const current = loadLesson1Store().current
    return current?.status === 'completed' ? 'done' : 'intro'
  })
  const [starting, setStarting] = useState(false)
  const [audioError, setAudioError] = useState(false)
  const [replayNonce, setReplayNonce] = useState(0)
  const [reviewIndex, setReviewIndex] = useState(0)
  const [reviewPlayingKey, setReviewPlayingKey] = useState<string | null>(null)
  const [reviewAudioError, setReviewAudioError] = useState(false)
  const completionNotifiedRef = useRef<string | null>(null)
  const pendingFreshRef = useRef(false)
  const reviewPlayRequestRef = useRef(0)

  const choiceTasks = useMemo(() => buildLesson1ChoiceTasks(session?.seed ?? 1), [session?.seed])
  const wrongEntries = useMemo(() => collectWrongEntries(session, choiceTasks), [session, choiceTasks])
  const reviewConfigs = useMemo(() => {
    const groups: ChoiceTaskConfig[] = []
    for (const taskId of CHOICE_TASK_IDS) {
      const items = wrongEntries.filter(entry => entry.config.taskId === taskId).map(entry => entry.item)
      if (items.length > 0) groups.push({ ...choiceTasks[taskId], items })
    }
    return groups
  }, [choiceTasks, wrongEntries])
  const taskIndex = Math.max(0, Math.min(7, session?.currentTaskIndex ?? 0))

  useEffect(() => {
    saveLesson1Current(session)
  }, [session])

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        stopLesson1Audio()
      } else if (stage === 'tasks' || stage === 'review') {
        setReplayNonce(value => value + 1)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      stopLesson1Audio()
    }
  }, [stage])

  const start = async (fresh = false) => {
    if (starting) return
    reviewPlayRequestRef.current += 1
    setReviewPlayingKey(null)
    setReviewIndex(0)
    stopLesson1Audio()
    pendingFreshRef.current = fresh
    setStarting(true)
    setAudioError(false)
    try {
      await prepareLesson1Audio()
      let next = session
      if (fresh || !next || next.status === 'completed') {
        archiveLesson1Session(next)
        next = createLesson1Session(requestedSeed())
        completionNotifiedRef.current = null
        setSession(next)
      }
      setStage('tasks')
    } catch {
      setAudioError(true)
    } finally {
      setStarting(false)
    }
  }

  const startWrongReview = () => {
    if (reviewConfigs.length === 0) return
    reviewPlayRequestRef.current += 1
    setReviewPlayingKey(null)
    setReviewAudioError(false)
    setReviewIndex(0)
    stopLesson1Audio()
    setStage('review')
  }

  const playWrongEntry = async (entry: WrongEntry) => {
    const key = `${entry.config.taskId}:${entry.item.itemId}`
    if (reviewPlayingKey !== null) return
    const request = ++reviewPlayRequestRef.current
    setReviewPlayingKey(key)
    setReviewAudioError(false)
    try {
      await playLesson1Sequence(entry.item.pitches, {
        timbre: entry.config.timbre,
        noteMs: 600,
        gapMs: 300,
      })
    } catch {
      if (request === reviewPlayRequestRef.current) setReviewAudioError(true)
    } finally {
      if (request === reviewPlayRequestRef.current) setReviewPlayingKey(null)
    }
  }

  const finishReviewGroup = () => {
    stopLesson1Audio()
    if (reviewIndex + 1 < reviewConfigs.length) setReviewIndex(reviewIndex + 1)
    else setStage('reviewDone')
  }

  const finishTask = (index: number, record: Record<string, unknown>) => {
    stopLesson1Audio()
    const taskId = L1_TASK_IDS[index]
    const isLast = index === 7
    setSession(previous => {
      if (!previous) return previous
      return {
        ...previous,
        records: { ...previous.records, [taskId]: record },
        completedTaskIds: [...new Set([...previous.completedTaskIds, taskId])],
        currentTaskIndex: isLast ? 7 : Math.max(previous.currentTaskIndex, index + 1),
        status: isLast ? 'completed' : 'inProgress',
        completedAt: isLast ? new Date().toISOString() : previous.completedAt,
      }
    })
    if (isLast) {
      setStage('done')
      if (session && completionNotifiedRef.current !== session.sessionId) {
        completionNotifiedRef.current = session.sessionId
        onLessonComplete()
      }
    }
  }

  const goBack = () => {
    reviewPlayRequestRef.current += 1
    setReviewPlayingKey(null)
    stopLesson1Audio()
    onBack()
  }

  const progressLabel = stage === 'done'
    ? '本课完成'
    : stage === 'review'
      ? '错题回顾'
      : stage === 'reviewDone' ? '订正完成' : `任务 ${taskIndex + 1} / 8`

  const topBar = stage !== 'intro' && (
    <div className="l1-topbar">
      <div className="l1-brand">
        <img src="/muse-icon.png" alt="" />
        <span>第1课</span>
      </div>
      <div className="l1-progress-label">{progressLabel}</div>
      <div className="l1-progress" aria-label={`八段课程进度，已完成 ${session?.completedTaskIds.length ?? 0} 个任务`}>
        {L1_TASK_IDS.map((taskId, index) => (
          <span
            key={taskId}
            className={(session?.completedTaskIds.includes(taskId) ? 'done ' : '') + (stage === 'tasks' && index === taskIndex ? 'now' : '')}
          />
        ))}
      </div>
    </div>
  )

  if (stage === 'intro' || !session) {
    const canResume = session?.status === 'inProgress'
    return (
      <main className="lesson1Page l1-intro">
        <button className="backLink" onClick={goBack}>‹ 返回地图</button>
        <img className="l1-intro-conch" src="/badges/conch.png" alt="海螺" />
        <p className="l1-kicker">第一单元 · 第1课</p>
        <h1>声音有高低</h1>
        {canResume && <p className="l1-resume-note">上次已完成 {session.completedTaskIds.length} 个任务，可以从任务 {taskIndex + 1} 继续。</p>}
        {audioError && (
          <div className="l1-feedback retry" role="alert">
            声音还没有准备好。请检查网络后重新加载；没有声音时不会开始计题。
          </div>
        )}
        <button className="btn primary big" onClick={() => void start(false)} disabled={starting}>
          {starting ? '正在准备声音…' : canResume ? '继续这一课' : '开始这一课'}
        </button>
        {canResume && (
          <button className="btn ghost" onClick={() => void start(true)} disabled={starting}>从头再练</button>
        )}
        {audioError && <button className="btn ghost" onClick={() => void start(pendingFreshRef.current)}>重新加载</button>}
      </main>
    )
  }

  if (stage === 'review') {
    const config = reviewConfigs[reviewIndex]!
    return (
      <main className="lesson1Page">
        {topBar}
        <button className="backLink" onClick={() => { stopLesson1Audio(); setStage('done') }}>‹ 返回本课完成页</button>
        <div className="l1-task-slot" key={`review-${session.sessionId}-${reviewIndex}`}>
          <Lesson1Choice config={config} replayNonce={replayNonce} onDone={finishReviewGroup} />
        </div>
      </main>
    )
  }

  if (stage === 'reviewDone') {
    return (
      <main className="lesson1Page l1-done">
        {topBar}
        <img className="l1-done-conch" src="/badges/conch.png" alt="完成错题回顾的海螺" />
        <h1>错题订正完成</h1>
        <p className="l1-next-note">这组错题都重新练过一遍。</p>
        <div className="l1-done-actions">
          <button className="btn primary" onClick={startWrongReview}>再练一组错题</button>
          <button className="btn ghost" onClick={() => setStage('done')}>回本课完成页</button>
          <button className="btn ghost" onClick={goBack}>回学习地图</button>
        </div>
      </main>
    )
  }

  if (stage === 'done') {
    return (
      <main className="lesson1Page l1-done">
        {topBar}
        <img className="l1-done-conch" src="/badges/conch.png" alt="完成本课的海螺" />
        <h1>本课完成</h1>
        <p className="l1-next-note">下一次：给三个声音取名字。</p>
        {wrongEntries.length > 0 && (
          <section className="l1-review-box" aria-labelledby="l1-review-title">
            <h2 id="l1-review-title">本次错题回顾</h2>
            {wrongEntries.map(entry => {
              const key = `${entry.config.taskId}:${entry.item.itemId}`
              const playing = reviewPlayingKey === key
              return (
                <div className="l1-review-row" key={key}>
                  <div className="l1-review-copy">
                    <span className="l1-review-prompt">{reviewPromptOf(entry)}</span>
                    <span className="l1-review-answer">
                      第一次：{optionLabel(entry.config, entry.firstAnswer)} · 正确：{optionLabel(entry.config, entry.item.correctOptionId)}
                    </span>
                  </div>
                  <button
                    className="btn ghost small"
                    onClick={() => void playWrongEntry(entry)}
                    disabled={reviewPlayingKey !== null}
                    aria-label={`重听：${reviewPromptOf(entry)}`}
                  >
                    {playing ? '正在播放…' : '▶ 重听'}
                  </button>
                </div>
              )
            })}
            {reviewAudioError && <p className="l1-review-audio-error" role="alert">声音没有加载好，请再点一次“重听”。</p>}
          </section>
        )}
        <div className="l1-done-actions">
          <button className="btn primary" onClick={() => void start(true)} disabled={starting}>再练一次</button>
          {wrongEntries.length > 0 && <button className="btn ghost" onClick={startWrongReview}>只练错题（{wrongEntries.length} 题）</button>}
          <button className="btn ghost" onClick={goBack}>回学习地图</button>
        </div>
      </main>
    )
  }

  return (
    <main className="lesson1Page">
      {topBar}
      <button className="backLink" onClick={goBack}>‹ 返回地图</button>
      <div className="l1-task-slot" key={`${session.sessionId}-${taskIndex}`}>
        {taskIndex === 0 && <GuidedHandTask replayNonce={replayNonce} onDone={record => finishTask(0, record)} />}
        {taskIndex === 1 && <Lesson1Choice config={choiceTasks.L01T02} replayNonce={replayNonce} onDone={record => finishTask(1, record)} />}
        {taskIndex === 2 && <Lesson1Choice config={choiceTasks.L01T03} replayNonce={replayNonce} onDone={record => finishTask(2, record)} />}
        {taskIndex === 3 && <Lesson1Choice config={choiceTasks.L01T04} replayNonce={replayNonce} onDone={record => finishTask(3, record)} />}
        {taskIndex === 4 && <Lesson1Choice config={choiceTasks.L01T05} replayNonce={replayNonce} onDone={record => finishTask(4, record)} />}
        {taskIndex === 5 && <SoundStepsTask replayNonce={replayNonce} onDone={record => finishTask(5, record)} />}
        {taskIndex === 6 && <Lesson1Echo taskId="L01T07" replayNonce={replayNonce} onDone={record => finishTask(6, record)} />}
        {taskIndex === 7 && <Lesson1Echo taskId="L01T08" replayNonce={replayNonce} onDone={record => finishTask(7, record)} />}
      </div>
    </main>
  )
}
