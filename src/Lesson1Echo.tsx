// 第1课任务7—8：本地录音与即时回放，并保留旧版的 Pitchy 音准判断与文字反馈。
import { useEffect, useMemo, useRef, useState } from 'react'
import { PitchDetector } from 'pitchy'
import { playLesson1Sequence, stopLesson1Audio } from './lesson1Audio'
import type { Lesson1EchoMaterials } from './lesson1Data'

interface Props {
  taskId: 'L01T07' | 'L01T08'
  materials: Lesson1EchoMaterials
  replayNonce: number
  onDone: (record: Record<string, unknown>) => void
}

interface Participation {
  participated: boolean
  usedMic: boolean
  micPermissionState: string
}

const DEFAULT_PARTICIPATION: Participation = {
  participated: false,
  usedMic: false,
  micPermissionState: 'notRequested',
}

function MicIcon() {
  return (
    <svg viewBox="0 0 32 40" aria-hidden="true" className="l1-mic-icon">
      <rect x="9" y="3" width="14" height="24" rx="7" />
      <path d="M5 20c0 7 4 11 11 11s11-4 11-11M16 31v6M10 37h12" />
    </svg>
  )
}

function EchoPath({ notes }: { notes: number[] }) {
  const min = Math.min(...notes)
  const max = Math.max(...notes)
  const xs = [48, 150, 232]
  const points = notes.map((note, index) => ({
    x: xs[index],
    y: max === min ? 56 : 78 - (note - min) / (max - min) * 44,
  }))
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ')
  return (
    <svg className="l1-echo-path" viewBox="0 0 280 110" role="img" aria-label="三个音的高低与顺序示意">
      <path d={path} />
      {points.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="10" />)}
    </svg>
  )
}

type PitchAssessmentStatus = 'matched' | 'partial' | 'unstable' | 'different' | 'unclear' | 'unavailable' | 'notAssessed'

interface PitchAssessment {
  status: PitchAssessmentStatus
  matchedNotes: number
  totalNotes: number
  heardMidi: number | null
  needsSeparatedRepeat?: boolean
}

interface PitchMonitor {
  finish: () => PitchAssessment
  cancel: () => void
}

const midiOfFreq = (frequency: number) => 69 + 12 * Math.log2(frequency / 440)
const octaveFoldedDiff = (midi: number, target: number) => (((midi - target) % 12) + 18) % 12 - 6

function LivePitchIndicator({ midi, target }: { midi: number | null; target: number }) {
  const offset = midi === null ? null : midi - target
  const clampedOffset = offset === null ? 0 : Math.max(-6, Math.min(6, offset))
  const position = (clampedOffset + 6) / 12 * 100
  const near = midi !== null && Math.abs(octaveFoldedDiff(midi, target)) <= 0.75
  const direction = midi === null
    ? '等待你的声音'
    : near
      ? '已接近目标音高'
      : offset !== null && offset > 0
        ? '当前声音偏高'
        : offset !== null && offset < 0 ? '当前声音偏低' : '当前声音与目标同高'

  return (
    <div className="l1-live-pitch-panel">
      <div className="l1-live-pitch" role="img" aria-label={`实时音高：${direction}`}>
        <span className="l1-pitch-level high">高</span>
        <span className="l1-pitch-level low">低</span>
        <div className="l1-live-pitch-track" aria-hidden="true">
          <span className="l1-pitch-target-line" />
          {midi === null
            ? <span className="l1-live-pitch-placeholder">等待你的声音</span>
            : <span className={'l1-live-pitch-bar' + (near ? ' near' : '')} style={{ bottom: `${position}%` }} />}
        </div>
        <span className="l1-pitch-target-label" aria-hidden="true">目标</span>
      </div>
      <p className="l1-live-pitch-tip">光条跟着你的声音高低移动，变绿表示对准。</p>
    </div>
  )
}

const notAssessed = (totalNotes: number): PitchAssessment => ({
  status: 'notAssessed', matchedNotes: 0, totalNotes, heardMidi: null,
})

// 与旧版 Sing / SingGroup 一致：八度折叠、0.75 半音容差、连续稳定帧才算对准。
// 不显示音名、频率、曲线或五线谱；只用高低光条提供实时位置反馈。
function createPitchMonitor(
  stream: MediaStream,
  targets: number[],
  onProgress: (matchedNotes: number) => void,
  onHear: (midi: number | null) => void,
  onRepeatWait: (waiting: boolean) => void,
): PitchMonitor {
  const context = new AudioContext()
  const source = context.createMediaStreamSource(stream)
  const analyser = context.createAnalyser()
  analyser.fftSize = 2048
  source.connect(analyser)
  const detector = PitchDetector.forFloat32Array(analyser.fftSize)
  const buffer = new Float32Array(analyser.fftSize)
  const clarityThreshold = targets.length === 1 ? 0.9 : 0.88
  const needFrames = targets.length === 1 ? 12 : 10
  const heardCounts = new Map<number, number>()
  let raf = 0
  let cleaned = false
  let monitoring = true
  let targetIndex = 0
  let streak = 0
  let bestNearStreak = 0
  let singleMatched = false
  let cached: PitchAssessment | null = null
  let hearing = false
  let lastHeardAt = 0
  let lastHeardUpdateAt = 0
  let waitingForRepeatedNote = false
  let repeatGapStartedAt: number | null = null

  const setRepeatWaiting = (waiting: boolean) => {
    if (waitingForRepeatedNote === waiting) return
    waitingForRepeatedNote = waiting
    onRepeatWait(waiting)
  }

  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    monitoring = false
    cancelAnimationFrame(raf)
    try { source.disconnect() } catch { /* 已断开 */ }
    try { analyser.disconnect() } catch { /* 已断开 */ }
    void context.close().catch(() => undefined)
  }

  const finish = () => {
    if (cached) return cached
    cleanup()
    let heardMidi: number | null = null
    let mostFrames = 0
    heardCounts.forEach((count, midi) => {
      if (count > mostFrames) {
        mostFrames = count
        heardMidi = midi
      }
    })
    const matchedNotes = targets.length === 1 ? (singleMatched ? 1 : 0) : targetIndex
    const allMatched = matchedNotes === targets.length
    if (allMatched) heardMidi = targets[targets.length - 1]
    const status: PitchAssessmentStatus = allMatched
      ? 'matched'
      : matchedNotes > 0
        ? 'partial'
        : bestNearStreak > 0
          ? 'unstable'
          : heardMidi !== null ? 'different' : 'unclear'
    const needsSeparatedRepeat = matchedNotes > 0
      && matchedNotes < targets.length
      && targets[matchedNotes] === targets[matchedNotes - 1]
    cached = { status, matchedNotes, totalNotes: targets.length, heardMidi, needsSeparatedRepeat }
    return cached
  }

  const loop = () => {
    if (cleaned || !monitoring) return
    analyser.getFloatTimeDomainData(buffer)
    let squareSum = 0
    for (const sample of buffer) squareSum += sample * sample
    const rms = Math.sqrt(squareSum / buffer.length)
    const [frequency, clarity] = detector.findPitch(buffer, context.sampleRate)
    const hasPitch = targetIndex < targets.length
      && clarity > clarityThreshold
      && frequency > 50
      && frequency < 1200
    const midi = hasPitch ? midiOfFreq(frequency) : null
    const now = performance.now()

    if (midi !== null) {
      lastHeardAt = now
      if (!hearing || now - lastHeardUpdateAt >= 50) {
        hearing = true
        lastHeardUpdateAt = now
        onHear(midi)
      }
      const rounded = Math.round(midi)
      heardCounts.set(rounded, (heardCounts.get(rounded) ?? 0) + 1)
    } else {
      streak = 0
      if (hearing && now - lastHeardAt > 300) {
        hearing = false
        onHear(null)
      }
    }

    if (targetIndex < targets.length && waitingForRepeatedNote) {
      // 相邻同音不能沿用上一次发声：接近静音且当前目标音也中断，才开始计算 100ms 分段间隔。
      // 既不把长音衰减当作停顿，也不被静音中的低频假音高阻止分段。
      const targetStillSounding = midi !== null
        && Math.abs(octaveFoldedDiff(midi, targets[targetIndex])) <= 0.75
      const hasQuietGap = rms <= 0.025 && !targetStillSounding
      if (hasQuietGap) {
        if (repeatGapStartedAt === null) repeatGapStartedAt = now
      } else {
        repeatGapStartedAt = null
      }
      streak = 0
      if (repeatGapStartedAt !== null && now - repeatGapStartedAt >= 100) {
        repeatGapStartedAt = null
        setRepeatWaiting(false)
        if (hearing) {
          hearing = false
          onHear(null)
        }
      }
      raf = requestAnimationFrame(loop)
      return
    }

    if (midi !== null && targetIndex < targets.length) {
      const near = Math.abs(octaveFoldedDiff(midi, targets[targetIndex])) <= 0.75
      if (near) {
        streak += 1
        bestNearStreak = Math.max(bestNearStreak, streak)
        if (streak >= needFrames) {
          const matchedTarget = targets[targetIndex]
          if (targets.length === 1) {
            singleMatched = true
            targetIndex = 1
            onProgress(1)
            monitoring = false
            return
          }
          targetIndex += 1
          streak = 0
          onProgress(targetIndex)
          if (targetIndex >= targets.length) {
            monitoring = false
            return
          }
          if (targets[targetIndex] === matchedTarget) {
            repeatGapStartedAt = null
            setRepeatWaiting(true)
          }
        }
      } else {
        streak = 0
      }
    }
    raf = requestAnimationFrame(loop)
  }

  void context.resume().catch(() => undefined)
  raf = requestAnimationFrame(loop)
  return {
    finish,
    cancel: () => { cleanup() },
  }
}

function pitchFeedbackCopy(assessment: PitchAssessment) {
  switch (assessment.status) {
    case 'matched':
      return {
        tone: 'matched',
        title: assessment.totalNotes === 1
          ? '这个音唱准了。'
          : assessment.totalNotes === 2 ? '这一组的两个音都唱准了。' : '三个音都按顺序唱准了。',
        detail: '可以听一听自己的录音，也可以继续。',
      }
    case 'partial':
      return {
        tone: 'matched',
        title: `前 ${assessment.matchedNotes} 个音已经对准。`,
        detail: assessment.needsSeparatedRepeat
          ? '相邻的同音也要分开唱：稍停一下，再单独唱下一个音。'
          : '再听一次示范，接着练后面的音；也可以用分组练。',
      }
    case 'unstable':
      return {
        tone: 'retry',
        title: '已经很接近目标音高了。',
        detail: '再唱一次，把声音稍微拉长、稳住。',
      }
    case 'different':
      return {
        tone: 'retry',
        title: '这次音高还没有对准。',
        detail: '再听一次示范，慢慢唱回去；这次结果不会阻止你继续。',
      }
    case 'unclear':
      return {
        tone: 'retry',
        title: '这次没有听清音高。',
        detail: '可以在安静一点的地方再试一次，也可以点“我已模仿”。',
      }
    case 'unavailable':
      return {
        tone: 'retry',
        title: '这次暂时无法判断音高。',
        detail: '录音和模仿参与已保留，可以再试一次。',
      }
    default:
      return { tone: 'retry', title: '', detail: '' }
  }
}

export default function Lesson1Echo({ taskId, materials, replayNonce, onDone }: Props) {
  const isPhrase = taskId === 'L01T08'
  const singleRounds = materials.singleRounds
  const fullPhrase = materials.phrase
  const phraseGroups = useMemo(() => [fullPhrase.slice(0, 2), fullPhrase.slice(1)], [fullPhrase])
  const [round, setRound] = useState(0)
  const [group, setGroup] = useState<number | null>(null)
  const [participation, setParticipation] = useState<Record<string, Participation>>({})
  const [assessments, setAssessments] = useState<Record<string, PitchAssessment>>({})
  const [liveMatchedNotes, setLiveMatchedNotes] = useState(0)
  const [liveMidi, setLiveMidi] = useState<number | null>(null)
  const [waitingForRepeatedNote, setWaitingForRepeatedNote] = useState(false)
  const [retryCounts, setRetryCounts] = useState<Record<string, number>>({})
  const [usedSegmentSupport, setUsedSegmentSupport] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [demoPlaying, setDemoPlaying] = useState(false)
  const [message, setMessage] = useState('先听示范，再按住按钮唱回去。')
  const [micMessage, setMicMessage] = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const pitchMonitorRef = useRef<PitchMonitor | null>(null)
  const pitchAssessmentRef = useRef<PitchAssessment | null>(null)
  const audioUrlRef = useRef<string | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const preparingRef = useRef(false)
  const stopRequestedRef = useRef(false)
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const recordedAudioRef = useRef<HTMLAudioElement | null>(null)
  const demoRequestRef = useRef(0)
  const recordingStateRef = useRef(false)
  const mountedRef = useRef(true)
  const startedAtRef = useRef(Date.now())

  const currentKey = isPhrase ? (group === null ? 'full' : `group-${group}`) : `single-${round}`
  const currentNotes = useMemo(() => {
    if (isPhrase) return group === null ? fullPhrase : phraseGroups[group]
    return singleRounds[round]
  }, [fullPhrase, group, isPhrase, phraseGroups, round, singleRounds])
  const currentParticipation = participation[currentKey] ?? DEFAULT_PARTICIPATION
  const currentAssessment = assessments[currentKey] ?? null
  const pitchFeedback = currentAssessment ? pitchFeedbackCopy(currentAssessment) : null
  const maxRecordingMs = isPhrase ? 8000 : 5000

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
  }

  const finishPitchMonitor = () => {
    const monitor = pitchMonitorRef.current
    if (monitor) {
      pitchMonitorRef.current = null
      pitchAssessmentRef.current = monitor.finish()
    }
    return pitchAssessmentRef.current
  }

  const cancelPitchMonitor = () => {
    pitchMonitorRef.current?.cancel()
    pitchMonitorRef.current = null
    pitchAssessmentRef.current = null
  }

  const clearPitchAssessment = () => {
    cancelPitchMonitor()
    setLiveMatchedNotes(0)
    setLiveMidi(null)
    setWaitingForRepeatedNote(false)
    setAssessments(previous => {
      if (!previous[currentKey]) return previous
      const next = { ...previous }
      delete next[currentKey]
      return next
    })
  }

  const updateLocalAudioUrl = (next: string | null) => {
    const previous = audioUrlRef.current
    audioUrlRef.current = next
    if (previous && previous !== next) URL.revokeObjectURL(previous)
    if (mountedRef.current) setAudioUrl(next)
  }

  const clearLocalRecording = () => {
    if (recordedAudioRef.current) {
      recordedAudioRef.current.pause()
      recordedAudioRef.current = null
    }
    updateLocalAudioUrl(null)
  }

  const markParticipated = (usedMic: boolean, permission: string) => {
    setParticipation(previous => ({
      ...previous,
      [currentKey]: { participated: true, usedMic, micPermissionState: permission },
    }))
  }

  const stopRecording = () => {
    stopRequestedRef.current = true
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current)
      maxTimerRef.current = null
    }
    finishPitchMonitor()
    const recorder = recorderRef.current
    if (recorder?.state === 'recording') recorder.stop()
  }

  const beginRecording = async () => {
    if (recordingStateRef.current || preparingRef.current || demoPlaying) return
    stopLesson1Audio()
    clearLocalRecording()
    clearPitchAssessment()
    chunksRef.current = []
    stopRequestedRef.current = false
    preparingRef.current = true
    setPreparing(true)
    setMicMessage(null)
    setMessage('准备录音…')

    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        throw new DOMException('当前浏览器不支持录音', 'NotSupportedError')
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!mountedRef.current) {
        stream.getTracks().forEach(track => track.stop())
        return
      }
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      let recorderFailed = false
      recorderRef.current = recorder
      recorder.ondataavailable = event => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onerror = () => {
        recorderFailed = true
        cancelPitchMonitor()
        recordingStateRef.current = false
        preparingRef.current = false
        if (maxTimerRef.current) {
          clearTimeout(maxTimerRef.current)
          maxTimerRef.current = null
        }
        stopTracks()
        if (!mountedRef.current) return
        setRecording(false)
        setPreparing(false)
        setMicMessage('这次没有录好，也可以点“我已模仿”继续。')
        setMessage('录音没有成功，不会影响本课完成。')
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        const assessment = finishPitchMonitor() ?? {
          status: 'unavailable' as const,
          matchedNotes: 0,
          totalNotes: currentNotes.length,
          heardMidi: null,
        }
        recordingStateRef.current = false
        preparingRef.current = false
        if (recorderRef.current === recorder) recorderRef.current = null
        if (maxTimerRef.current) {
          clearTimeout(maxTimerRef.current)
          maxTimerRef.current = null
        }
        stopTracks()
        if (!mountedRef.current || recorderFailed) return
        setRecording(false)
        setPreparing(false)
        if (blob.size > 0) updateLocalAudioUrl(URL.createObjectURL(blob))
        setAssessments(previous => ({ ...previous, [currentKey]: assessment }))
        markParticipated(true, 'granted')
        setMessage(blob.size > 0 ? '唱完了，可以再听一次。' : '已经完成一次模仿，也可以再试一次。')
      }
      try {
        pitchMonitorRef.current = createPitchMonitor(
          stream,
          currentNotes,
          matchedNotes => {
            if (mountedRef.current) setLiveMatchedNotes(matchedNotes)
          },
          midi => {
            if (mountedRef.current) setLiveMidi(midi)
          },
          waiting => {
            if (mountedRef.current) setWaitingForRepeatedNote(waiting)
          },
        )
      } catch {
        // 录音仍可使用；只是本次设备无法完成音高分析。
        pitchAssessmentRef.current = {
          status: 'unavailable', matchedNotes: 0, totalNotes: currentNotes.length, heardMidi: null,
        }
      }
      // 若权限等待期间页面从后台恢复并重启了示范，录音前再次确保示范停止。
      stopLesson1Audio()
      recorder.start()
      recordingStateRef.current = true
      preparingRef.current = false
      setRecording(true)
      setPreparing(false)
      setMessage(`正在录音，松开结束；最长 ${isPhrase ? 8 : 5} 秒。`)
      maxTimerRef.current = setTimeout(stopRecording, maxRecordingMs)
      // 权限弹窗期间已经松开：取得录音器后马上收尾，不让界面卡在准备状态。
      if (stopRequestedRef.current) stopRecording()
    } catch (error) {
      cancelPitchMonitor()
      recordingStateRef.current = false
      preparingRef.current = false
      stopTracks()
      if (!mountedRef.current) return
      const name = error instanceof DOMException ? error.name : 'Error'
      const permission = name === 'NotAllowedError' ? 'denied' : 'unavailable'
      setParticipation(previous => ({
        ...previous,
        [currentKey]: { participated: false, usedMic: false, micPermissionState: permission },
      }))
      setPreparing(false)
      setRecording(false)
      setMicMessage('没有开启麦克风也没关系。你可以自己模仿，再点“我已模仿”。')
      setMessage('录音不可用，不会影响听辨成绩和结课。')
    }
  }

  const playDemo = async () => {
    if (recordingStateRef.current || preparingRef.current) return
    stopLesson1Audio()
    if (recordedAudioRef.current) {
      recordedAudioRef.current.pause()
      recordedAudioRef.current = null
    }
    const request = ++demoRequestRef.current
    setDemoPlaying(true)
    setMessage('听完整示范，再模仿。')
    try {
      await playLesson1Sequence(currentNotes, { noteMs: 700, gapMs: 300 })
    } catch {
      if (request === demoRequestRef.current) setMicMessage('声音没有加载好，请点“听示范”重试。')
    } finally {
      if (request === demoRequestRef.current && mountedRef.current) setDemoPlaying(false)
    }
  }

  const playMyRecording = () => {
    if (!audioUrl || recordingStateRef.current || preparingRef.current) return
    stopLesson1Audio()
    recordedAudioRef.current?.pause()
    const audio = new Audio(audioUrl)
    recordedAudioRef.current = audio
    audio.onended = () => { recordedAudioRef.current = null }
    audio.onerror = () => {
      recordedAudioRef.current = null
      setMicMessage('本地录音暂时无法回放，可以再唱一次。')
    }
    void audio.play().catch(() => setMicMessage('点一次“听我的录音”即可回放。'))
  }

  const retry = () => {
    if (recordingStateRef.current || preparingRef.current) return
    clearLocalRecording()
    clearPitchAssessment()
    setRetryCounts(previous => ({ ...previous, [currentKey]: (previous[currentKey] ?? 0) + 1 }))
    setMessage('再听一次示范，然后慢慢唱。')
    void playDemo()
  }

  const selfReport = () => {
    if (recordingStateRef.current || preparingRef.current) return
    stopLesson1Audio()
    const previous = participation[currentKey] ?? DEFAULT_PARTICIPATION
    markParticipated(previous.usedMic, previous.micPermissionState)
    setMessage('谢谢你把声音模仿出来了，可以继续。')
  }

  const continuePractice = () => {
    if (!currentParticipation.participated || recordingStateRef.current || preparingRef.current) return
    clearLocalRecording()
    if (!isPhrase) {
      if (round === 0) {
        setRound(1)
        setMessage('再听一个音，把它唱回去。')
      } else {
        onDone({
          taskId,
          rounds: singleRounds.map((notes, index) => ({
            pitch: notes[0],
            ...(participation[`single-${index}`] ?? DEFAULT_PARTICIPATION),
            pitchAssessment: assessments[`single-${index}`] ?? notAssessed(1),
            retryCount: retryCounts[`single-${index}`] ?? 0,
          })),
          completed: true,
          durationMs: Date.now() - startedAtRef.current,
        })
      }
      return
    }

    if (group === 0) {
      setGroup(1)
      setMessage('现在练第二组，按顺序把两个音分开唱。')
    } else if (group === 1) {
      setGroup(null)
      setMessage('回到完整三音，按顺序唱回去。')
    } else {
      onDone({
        taskId,
        sequence: fullPhrase,
        ...(participation.full ?? DEFAULT_PARTICIPATION),
        pitchAssessment: assessments.full ?? notAssessed(fullPhrase.length),
        usedSegmentSupport,
        retryCount: retryCounts.full ?? 0,
        completed: true,
        lessonCompletedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAtRef.current,
      })
    }
  }

  useEffect(() => {
    clearLocalRecording()
    const request = ++demoRequestRef.current
    setDemoPlaying(true)
    let active = true
    void playLesson1Sequence(currentNotes, { noteMs: 700, gapMs: 300 })
      .then(() => {
        if (active && request === demoRequestRef.current) setDemoPlaying(false)
      })
      .catch(() => {
        if (active && request === demoRequestRef.current) {
          setDemoPlaying(false)
          setMicMessage('声音没有加载好，请点“听示范”重试。')
        }
      })
    return () => {
      active = false
      stopLesson1Audio()
    }
    // currentKey 同时覆盖单音轮次、完整短句与分组切换。
  }, [currentKey, replayNonce])

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        stopLesson1Audio()
        stopRecording()
        recordedAudioRef.current?.pause()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      stopLesson1Audio()
      stopRecording()
      cancelPitchMonitor()
      stopTracks()
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
      recordedAudioRef.current?.pause()
      recordedAudioRef.current = null
    }
    // 真正的卸载清理；本地录音 URL 始终从 ref 读取，避免状态变化触发清理。
  }, [])

  const title = isPhrase ? '听三个音，按顺序唱回去。' : '听一个音，把它唱回去。'
  const guide = !isPhrase
    ? '用“唔”或“啦”都可以。'
    : group === null
      ? '这条短句里，有两个音一样高；每个音都要分开唱。'
      : '按顺序唱两个音；如果同音相邻，要分开唱。'
  const continueLabel = !isPhrase
    ? '继续'
    : group === 0
      ? '练下一组'
      : group === 1
        ? '回到完整三音'
        : '完成这一课'

  return (
    <section className="l1-task l1-echo-task" aria-labelledby={`${taskId}-title`}>
      <h2 id={`${taskId}-title`}>{title}</h2>
      <p className="l1-guide">{guide}</p>

      <div className="l1-echo-stage">
        <img src="/badges/conch.png" alt="海螺" className="l1-echo-conch" />
        <div className="l1-order-markers" aria-label={`共 ${currentNotes.length} 个音`}>
          {currentNotes.map((_, index) => <span key={index}>{index + 1}</span>)}
        </div>
        {isPhrase && group === null && currentParticipation.participated && <EchoPath notes={currentNotes} />}
      </div>

      <p className="l1-echo-message" aria-live="polite">{message}</p>
      {micMessage && <p className="l1-mic-message">{micMessage}</p>}
      {recording && (
        <LivePitchIndicator
          midi={liveMidi}
          target={currentNotes[Math.min(liveMatchedNotes, currentNotes.length - 1)]}
        />
      )}
      {recording && (
        <p className="l1-pitch-live" aria-live="polite">
          {waitingForRepeatedNote
            ? `第 ${liveMatchedNotes} 个音已对准。稍停一下，再单独唱下一个同音。`
            : liveMatchedNotes > 0
              ? currentNotes.length === 1
                ? '这个音已经对准，可以保持到松开。'
                : `已按顺序对准 ${liveMatchedNotes} / ${currentNotes.length} 个音。`
              : '正在这台设备上判断音高…'}
        </p>
      )}
      {!recording && pitchFeedback && currentAssessment?.status !== 'notAssessed' && (
        <div className={`l1-pitch-feedback ${pitchFeedback.tone}`} aria-live="polite">
          <strong>{pitchFeedback.title}</strong>
          <span>{pitchFeedback.detail}</span>
        </div>
      )}
      {isPhrase && group !== null && <p className="l1-support-label">分组练 · 第 {group + 1} 组</p>}

      <div className="l1-echo-actions">
        <button className="btn ghost" onClick={() => void playDemo()} disabled={demoPlaying || recording || preparing}>
          {demoPlaying ? '正在播放…' : isPhrase ? '听示范' : '再听示范'}
        </button>
        <button
          className={currentParticipation.participated ? 'btn ghost l1-record-button' : 'btn primary l1-record-button'}
          disabled={demoPlaying}
          aria-pressed={recording}
          onPointerDown={event => {
            event.currentTarget.setPointerCapture(event.pointerId)
            void beginRecording()
          }}
          onPointerUp={stopRecording}
          onPointerCancel={stopRecording}
          onLostPointerCapture={stopRecording}
          onKeyDown={event => {
            if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
              event.preventDefault()
              void beginRecording()
            }
          }}
          onKeyUp={event => {
            if (event.key === ' ' || event.key === 'Enter') stopRecording()
          }}
        >
          <MicIcon />
          {recording ? '松开结束' : preparing ? '准备中…' : '按住唱回去'}
        </button>
        {audioUrl && <button className="btn ghost" onClick={playMyRecording} disabled={recording || preparing}>听我的录音</button>}
        <button className="btn ghost" onClick={retry} disabled={demoPlaying || recording || preparing}>{isPhrase ? '再唱一次' : '再试一次'}</button>
      </div>

      <div className="l1-echo-support">
        {isPhrase && group === null && (
          <button className="btn ghost" disabled={recording || preparing} onClick={() => {
            clearLocalRecording()
            setUsedSegmentSupport(true)
            setGroup(0)
            setMessage('先练第一组，再练第二组。')
          }}>分组练</button>
        )}
        {isPhrase && group !== null && (
          <button className="btn ghost" disabled={recording || preparing} onClick={() => {
            clearLocalRecording()
            setGroup(null)
            setMessage('回到完整三音。')
          }}>回到完整三音</button>
        )}
        <button className="l1-self-report" onClick={selfReport} disabled={recording || preparing}>我已模仿</button>
      </div>

      <button className="btn primary big" onClick={continuePractice} disabled={!currentParticipation.participated || recording || preparing}>
        {continueLabel}
      </button>
      <p className="l1-privacy">音高只在这台设备上分析，用于本次反馈；录音可即时回放，不上传，也不长期保存。</p>
    </section>
  )
}
