// 第2课人声参与：真实音准反馈、绿色光条、本地录音回放与无麦克风路径。
import { useEffect, useMemo, useRef, useState } from 'react'
import { PitchDetector } from 'pitchy'
import { getLesson1AudioContext, playLesson1Sequence, stopLesson1Audio } from './lesson1Audio'
import { l2SolfegeOf } from './lesson2Data'

type PitchAssessmentStatus = 'matched' | 'partial' | 'unstable' | 'different' | 'unclear' | 'unavailable' | 'notAssessed'

interface PitchAssessment {
  status: PitchAssessmentStatus
  matchedNotes: number
  totalNotes: number
  heardMidi: number | null
  needsSeparatedRepeat?: boolean
}

export interface L2VoiceResult {
  sequence: number[]
  participated: boolean
  usedMic: boolean
  micPermissionState: string
  pitchAssessment: Omit<PitchAssessment, 'heardMidi'>
  replayCount: number
  retryCount: number
}

interface Props {
  targets: number[]
  replayNonce: number
  showSolfege?: boolean
  demoLabel?: string
  recordLabel?: string
  continueLabel?: string
  onDemoNote?: (pitch: number | null) => void
  onContinue: (result: L2VoiceResult) => void
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

const notAssessed = (totalNotes: number): PitchAssessment => ({
  status: 'notAssessed', matchedNotes: 0, totalNotes, heardMidi: null,
})

const midiOfFreq = (frequency: number) => 69 + 12 * Math.log2(frequency / 440)
const octaveFoldedDiff = (midi: number, target: number) => (((midi - target) % 12) + 18) % 12 - 6

function MicIcon() {
  return (
    <svg viewBox="0 0 32 40" aria-hidden="true" className="l1-mic-icon">
      <rect x="9" y="3" width="14" height="24" rx="7" />
      <path d="M5 20c0 7 4 11 11 11s11-4 11-11M16 31v6M10 37h12" />
    </svg>
  )
}

function LivePitchIndicator({ midi, target }: { midi: number | null; target: number }) {
  const offset = midi === null ? null : midi - target
  const clampedOffset = offset === null ? 0 : Math.max(-6, Math.min(6, offset))
  const position = (clampedOffset + 6) / 12 * 100
  const near = midi !== null && Math.abs(octaveFoldedDiff(midi, target)) <= 0.75
  const direction = midi === null
    ? '等待你的声音'
    : near ? '已接近目标音高' : offset !== null && offset > 0 ? '当前声音偏高' : '当前声音偏低'
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

interface PitchMonitor {
  finish: () => PitchAssessment
  cancel: () => void
}

function createPitchMonitor(
  stream: MediaStream,
  targets: number[],
  onProgress: (matchedNotes: number) => void,
  onHear: (midi: number | null) => void,
  onRepeatWait: (waiting: boolean) => void,
): PitchMonitor {
  const context = getLesson1AudioContext()
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
    // 这是课程播放与分析共用的音频环境；只断开本次输入，不能关闭它。
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
        : bestNearStreak > 0 ? 'unstable' : heardMidi !== null ? 'different' : 'unclear'
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
  return { finish, cancel: cleanup }
}

function feedbackCopy(assessment: PitchAssessment) {
  switch (assessment.status) {
    case 'matched':
      return {
        tone: 'matched',
        title: assessment.totalNotes === 1 ? '这个音唱准了。' : assessment.totalNotes === 2 ? '这两个音都唱准了。' : '三个音都按顺序唱准了。',
        detail: '可以听一听自己的录音，也可以继续。',
      }
    case 'partial':
      return {
        tone: 'matched',
        title: `前 ${assessment.matchedNotes} 个音已经对准。`,
        detail: assessment.needsSeparatedRepeat
          ? '相邻的同音也要分开唱：稍停一下，再单独唱下一个音。'
          : '再听一次示范，接着练后面的音；也可以用分段练。',
      }
    case 'unstable':
      return { tone: 'retry', title: '已经很接近目标音高了。', detail: '再唱一次，把声音稍微拉长、稳住。' }
    case 'different':
      return { tone: 'retry', title: '这次音高还没有对准。', detail: '再听一次示范，慢慢唱回去；这次结果不会阻止你继续。' }
    case 'unclear':
      return { tone: 'retry', title: '这次没有听清音高。', detail: '可以在安静一点的地方再试一次，也可以点“我已模仿”。' }
    case 'unavailable':
      return { tone: 'retry', title: '这台设备暂时无法判断音高。', detail: '录音和模仿参与已保留，可以再试一次。' }
    default:
      return { tone: 'retry', title: '', detail: '' }
  }
}

export default function VoicePracticePanel({
  targets,
  replayNonce,
  showSolfege = false,
  demoLabel = '再听',
  recordLabel = '按住模仿',
  continueLabel = '继续',
  onDemoNote,
  onContinue,
}: Props) {
  const targetsKey = targets.join(',')
  const currentNotes = useMemo(() => targets, [targetsKey])
  const [participation, setParticipation] = useState<Participation>(DEFAULT_PARTICIPATION)
  const [assessment, setAssessment] = useState<PitchAssessment | null>(null)
  const [liveMatchedNotes, setLiveMatchedNotes] = useState(0)
  const [liveMidi, setLiveMidi] = useState<number | null>(null)
  const [waitingForRepeatedNote, setWaitingForRepeatedNote] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [replayCount, setReplayCount] = useState(0)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [demoPlaying, setDemoPlaying] = useState(false)
  const [message, setMessage] = useState('先听示范，再轻轻模仿。')
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
  const onDemoNoteRef = useRef(onDemoNote)
  onDemoNoteRef.current = onDemoNote

  const maxRecordingMs = currentNotes.length === 1 ? 5000 : 8000
  const nextLiveTarget = currentNotes[Math.min(liveMatchedNotes, currentNotes.length - 1)]
  const lastMatchedTarget = liveMatchedNotes > 0 ? currentNotes[liveMatchedNotes - 1] : null
  const livePitchTarget = lastMatchedTarget !== null && liveMidi !== null
    && Math.abs(octaveFoldedDiff(liveMidi, lastMatchedTarget)) <= 0.75
    ? lastMatchedTarget
    : nextLiveTarget
  const feedback = assessment ? feedbackCopy(assessment) : null

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
    setAssessment(null)
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
    const isRetry = assessment !== null || audioUrlRef.current !== null
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
        const nextAssessment = finishPitchMonitor() ?? notAssessed(currentNotes.length)
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
        setAssessment(nextAssessment)
        setParticipation({ participated: true, usedMic: true, micPermissionState: 'granted' })
        setMessage(blob.size > 0 ? '唱完了，可以再听一次。' : '已经完成一次模仿，也可以再试一次。')
      }
      try {
        pitchMonitorRef.current = createPitchMonitor(
          stream,
          currentNotes,
          matched => { if (mountedRef.current) setLiveMatchedNotes(matched) },
          midi => { if (mountedRef.current) setLiveMidi(midi) },
          waiting => { if (mountedRef.current) setWaitingForRepeatedNote(waiting) },
        )
      } catch {
        pitchAssessmentRef.current = {
          status: 'unavailable', matchedNotes: 0, totalNotes: currentNotes.length, heardMidi: null,
        }
      }
      stopLesson1Audio()
      recorder.start()
      if (isRetry) setRetryCount(previous => previous + 1)
      recordingStateRef.current = true
      preparingRef.current = false
      setRecording(true)
      setPreparing(false)
      setMessage(`正在录音，松开结束；最长 ${currentNotes.length === 1 ? 5 : 8} 秒。`)
      maxTimerRef.current = setTimeout(stopRecording, maxRecordingMs)
      if (stopRequestedRef.current) stopRecording()
    } catch (error) {
      cancelPitchMonitor()
      recordingStateRef.current = false
      preparingRef.current = false
      stopTracks()
      if (!mountedRef.current) return
      const name = error instanceof DOMException ? error.name : 'Error'
      const permission = name === 'NotAllowedError' ? 'denied' : 'unavailable'
      setParticipation({ participated: false, usedMic: false, micPermissionState: permission })
      setPreparing(false)
      setRecording(false)
      setMicMessage('没有开启麦克风也没关系。你可以自己模仿，再点“我已模仿”。')
      setMessage('录音不可用，不会影响听辨成绩和结课。')
    }
  }

  const playDemo = async (manual = true) => {
    if (recordingStateRef.current || preparingRef.current || demoPlaying) return
    if (manual) setReplayCount(previous => previous + 1)
    stopLesson1Audio()
    if (recordedAudioRef.current) {
      recordedAudioRef.current.pause()
      recordedAudioRef.current = null
    }
    const request = ++demoRequestRef.current
    setDemoPlaying(true)
    setMessage('听完整示范，再模仿。')
    onDemoNoteRef.current?.(null)
    try {
      await playLesson1Sequence(currentNotes, {
        noteMs: currentNotes.length === 1 ? 650 : 700,
        gapMs: 300,
        onNote: index => onDemoNoteRef.current?.(currentNotes[index]),
      })
    } catch {
      if (request === demoRequestRef.current) setMicMessage('声音没有加载好，请再点一次示范按钮。')
    } finally {
      onDemoNoteRef.current?.(null)
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

  const selfReport = () => {
    if (recordingStateRef.current || preparingRef.current) return
    stopLesson1Audio()
    setParticipation(previous => ({ ...previous, participated: true }))
    setMessage('谢谢你把声音模仿出来了，可以继续。')
  }

  const continuePractice = () => {
    if (!participation.participated || recordingStateRef.current || preparingRef.current) return
    stopLesson1Audio()
    clearLocalRecording()
    const currentAssessment = assessment ?? notAssessed(currentNotes.length)
    const { heardMidi: _heardMidi, ...storedAssessment } = currentAssessment
    onContinue({
      sequence: [...currentNotes],
      ...participation,
      pitchAssessment: storedAssessment,
      replayCount,
      retryCount,
    })
  }

  useEffect(() => {
    const request = ++demoRequestRef.current
    setDemoPlaying(true)
    let active = true
    void playLesson1Sequence(currentNotes, {
      noteMs: currentNotes.length === 1 ? 650 : 700,
      gapMs: 300,
      onNote: index => onDemoNoteRef.current?.(currentNotes[index]),
    }).then(() => {
      if (active && request === demoRequestRef.current) setDemoPlaying(false)
    }).catch(() => {
      if (active && request === demoRequestRef.current) {
        setDemoPlaying(false)
        setMicMessage('声音没有加载好，请再点一次示范按钮。')
      }
    }).finally(() => onDemoNoteRef.current?.(null))
    return () => {
      active = false
      stopLesson1Audio()
      onDemoNoteRef.current?.(null)
    }
  }, [currentNotes, replayNonce])

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
  }, [])

  return (
    <div className="l2-voice-panel">
      <div className="l1-echo-stage">
        <img src="/badges/conch.png" alt="海螺" className="l1-echo-conch" />
        <div className="l1-order-markers" aria-label={`共 ${currentNotes.length} 个音`}>
          {currentNotes.map((note, index) => (
            <span key={index}>
              {index + 1}
              {showSolfege && <small className="l2-marker-name">{l2SolfegeOf(note)}</small>}
            </span>
          ))}
        </div>
      </div>

      <p className="l1-echo-message" aria-live="polite">{message}</p>
      {micMessage && <p className="l1-mic-message">{micMessage}</p>}
      {recording && <LivePitchIndicator midi={liveMidi} target={livePitchTarget} />}
      {recording && (
        <p className="l1-pitch-live" aria-live="polite">
          {waitingForRepeatedNote
            ? `第 ${liveMatchedNotes} 个音已对准。稍停一下，再单独唱下一个同音。`
            : liveMatchedNotes > 0
              ? currentNotes.length === 1 ? '这个音已经对准，可以保持到松开。' : `已按顺序对准 ${liveMatchedNotes} / ${currentNotes.length} 个音。`
              : '正在这台设备上判断音高…'}
        </p>
      )}
      {!recording && feedback && assessment?.status !== 'notAssessed' && (
        <div className={`l1-pitch-feedback ${feedback.tone}`} aria-live="polite">
          <strong>{feedback.title}</strong>
          <span>{feedback.detail}</span>
        </div>
      )}

      <div className="l1-echo-actions">
        <button className="btn ghost" onClick={() => void playDemo()} disabled={demoPlaying || recording || preparing}>
          {demoPlaying ? '正在播放…' : demoLabel}
        </button>
        <button
          className={participation.participated ? 'btn ghost l1-record-button' : 'btn primary l1-record-button'}
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
          {recording ? '松开结束' : preparing ? '准备中…' : recordLabel}
        </button>
        {audioUrl && <button className="btn ghost" onClick={playMyRecording} disabled={recording || preparing}>听我的录音</button>}
      </div>

      <div className="l1-echo-support">
        <button className="l1-self-report" onClick={selfReport} disabled={recording || preparing}>我已模仿</button>
      </div>
      <button className="btn primary big" onClick={continuePractice} disabled={!participation.participated || recording || preparing}>
        {continueLabel}
      </button>
      <p className="l1-privacy">音高只在这台设备上分析，用于本次反馈；录音可即时回放，不上传，也不长期保存。</p>
    </div>
  )
}
