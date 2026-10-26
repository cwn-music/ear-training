// 缪斯 Muse · 第一单元第1课「声音有高低」V2.0
import { useEffect, useMemo, useRef, useState } from 'react'
import Lesson1Choice from './Lesson1Choice'
import Lesson1Echo from './Lesson1Echo'
import { GuidedHandTask, SoundStepsTask } from './Lesson1Tasks'
import { prepareLesson1Audio, stopLesson1Audio } from './lesson1Audio'
import {
  archiveLesson1Session,
  buildLesson1ChoiceTasks,
  createLesson1Session,
  L1_TASK_IDS,
  loadLesson1Store,
  saveLesson1Current,
  type Lesson1Session,
} from './lesson1Data'
import './Unit1Lesson1.css'

interface Props {
  onBack: () => void
  onLessonComplete: () => void
}

type Stage = 'intro' | 'tasks' | 'done'

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
  const completionNotifiedRef = useRef<string | null>(null)
  const pendingFreshRef = useRef(false)

  const choiceTasks = useMemo(() => buildLesson1ChoiceTasks(session?.seed ?? 1), [session?.seed])
  const taskIndex = Math.max(0, Math.min(7, session?.currentTaskIndex ?? 0))

  useEffect(() => {
    saveLesson1Current(session)
  }, [session])

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        stopLesson1Audio()
      } else if (stage === 'tasks') {
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
    stopLesson1Audio()
    onBack()
  }

  const topBar = stage !== 'intro' && (
    <div className="l1-topbar">
      <div className="l1-brand">
        <img src="/muse-icon.png" alt="" />
        <span>缪斯 · 第1课</span>
      </div>
      <div className="l1-progress-label">{stage === 'done' ? '本课完成' : `任务 ${taskIndex + 1} / 8`}</div>
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

  if (stage === 'done') {
    return (
      <main className="lesson1Page l1-done">
        {topBar}
        <img className="l1-done-conch" src="/badges/conch.png" alt="完成本课的海螺" />
        <h1>本课完成</h1>
        <p className="l1-next-note">下一次：给三个声音取名字。</p>
        <div className="l1-done-actions">
          <button className="btn primary" onClick={() => void start(true)} disabled={starting}>再练一次</button>
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
