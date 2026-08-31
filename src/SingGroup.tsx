// 缪斯 Muse · 三音组模唱（pitchy 基频检测，逐音判定）
// 判定规则与单音跟唱一致：八度折叠 + 0.75 半音容差 + 连续若干帧稳定才算唱准
import { useEffect, useRef, useState } from 'react'
import { PitchDetector } from 'pitchy'
import { displayName } from './theory'
import { ensureAudio, playMelody } from './audio'

interface Props {
  targets: number[] // 三个目标音
  ghostMic?: boolean // 冒烟测试：不申请麦克风，直接逐音通过
  onDone: (ok: boolean) => void
}

const CLARITY = 0.88
const TOL = 0.75 // 半音容差
const NEED_FRAMES = 10
const TIMEOUT_MS = 24000

const midiOfFreq = (f: number) => 69 + 12 * Math.log2(f / 440)

export default function SingGroup({ targets, ghostMic = false, onDone }: Props) {
  const [idx, setIdx] = useState(0) // 当前要唱第几个音
  const [heard, setHeard] = useState<number | null>(null)
  const [micErr, setMicErr] = useState(false)
  const doneRef = useRef(false)
  const idxRef = useRef(0)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    if (ghostMic) {
      // 演示模式：每 600ms 点亮一个音
      const timers = targets.map((_, i) =>
        setTimeout(() => {
          setIdx(i + 1)
          idxRef.current = i + 1
        }, 2500 * (i + 1)),
      )
      const fin = setTimeout(() => {
        if (!doneRef.current) {
          doneRef.current = true
          onDoneRef.current(true)
        }
      }, 2500 * targets.length + 800)
      return () => { timers.forEach(clearTimeout); clearTimeout(fin) }
    }

    let stream: MediaStream | null = null
    let ctx: AudioContext | null = null
    let raf = 0
    let timer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false
    let streak = 0

    const finish = (ok: boolean) => {
      if (doneRef.current) return
      doneRef.current = true
      if (timer) clearTimeout(timer)
      stream?.getTracks().forEach(t => t.stop())
      void ctx?.close().catch(() => undefined)
      onDoneRef.current(ok)
    }

    const run = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch {
        setMicErr(true)
        finish(false)
        return
      }
      if (cancelled) return
      ctx = new AudioContext()
      const src = ctx.createMediaStreamSource(stream)
      const an = ctx.createAnalyser()
      an.fftSize = 2048
      src.connect(an)
      const detector = PitchDetector.forFloat32Array(an.fftSize)
      const buf = new Float32Array(an.fftSize)
      timer = setTimeout(() => finish(false), TIMEOUT_MS)

      const loop = () => {
        if (cancelled || doneRef.current) return
        an.getFloatTimeDomainData(buf)
        const [freq, clarity] = detector.findPitch(buf, ctx!.sampleRate)
        const cur = idxRef.current
        if (cur < targets.length && clarity > CLARITY && freq > 50 && freq < 1200) {
          const m = midiOfFreq(freq)
          setHeard(Math.round(m))
          const diff = (((m - targets[cur]) % 12) + 18) % 12 - 6 // 八度折叠到 ±6
          if (Math.abs(diff) <= TOL) {
            streak++
            if (streak >= NEED_FRAMES) {
              streak = 0
              idxRef.current = cur + 1
              setIdx(cur + 1)
              if (cur + 1 >= targets.length) {
                finish(true)
                return
              }
            }
          } else {
            streak = 0
          }
        } else {
          streak = 0
        }
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
    }
    void run()

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      if (timer) clearTimeout(timer)
      stream?.getTracks().forEach(t => t.stop())
      void ctx?.close().catch(() => undefined)
    }
  }, [targets, ghostMic])

  const replay = () => {
    void ensureAudio().then(() => playMelody(targets, 0.5, 0.7))
  }

  return (
    <div className="singPanel">
      <div className="singGroupRow">
        {targets.map((t, i) => (
          <span
            key={i}
            className={
              'singGroupNote' + (i < idx ? ' hit' : i === idx ? ' now' : '')
            }
          >
            {displayName(t)}
            {i < idx && <span className="singGroupCheck">✓</span>}
          </span>
        ))}
      </div>
      <div className="singDot listening">
        {micErr ? '没有听到麦克风，点下方跳过' : idx >= targets.length ? '完成' : `正在听第 ${idx + 1} 个音…`}
      </div>
      {heard !== null && idx < targets.length && <div className="singHeard">听到：{displayName(heard)}</div>}
      <button className="btn ghost small" onClick={replay}>▶ 再听一遍示范</button>
    </div>
  )
}
