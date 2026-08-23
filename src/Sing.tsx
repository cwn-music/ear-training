// 缪斯 Muse · 跟唱校准（pitchy 基频检测）
import { useEffect, useRef, useState } from 'react'
import { PitchDetector } from 'pitchy'
import { displayName } from './theory'

interface Props {
  target: number
  ghostMic?: boolean // 冒烟测试：不申请麦克风，直接成功
  onDone: (ok: boolean) => void
}

const CLARITY = 0.9
const TOL = 0.75 // 半音容差
const NEED_FRAMES = 12
const TIMEOUT_MS = 12000

const midiOfFreq = (f: number) => 69 + 12 * Math.log2(f / 440)

export default function Sing({ target, ghostMic = false, onDone }: Props) {
  const [heard, setHeard] = useState<number | null>(null)
  const [state, setState] = useState<'init' | 'listening' | 'done'>('init')
  const doneRef = useRef(false)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    if (ghostMic) {
      const t = setTimeout(() => {
        if (!doneRef.current) {
          doneRef.current = true
          setState('done')
          onDoneRef.current(true)
        }
      }, 400)
      return () => clearTimeout(t)
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
      setState('done')
      if (timer) clearTimeout(timer)
      stream?.getTracks().forEach(t => t.stop())
      void ctx?.close().catch(() => undefined)
      onDoneRef.current(ok)
    }

    const run = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch {
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
      setState('listening')

      const loop = () => {
        if (cancelled || doneRef.current) return
        an.getFloatTimeDomainData(buf)
        const [freq, clarity] = detector.findPitch(buf, ctx!.sampleRate)
        if (clarity > CLARITY && freq > 50 && freq < 1200) {
          const m = midiOfFreq(freq)
          setHeard(Math.round(m))
          const diff = (((m - target) % 12) + 18) % 12 - 6 // 折叠到 ±6 半音
          if (Math.abs(diff) <= TOL) {
            streak++
            if (streak >= NEED_FRAMES) {
              finish(true)
              return
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
  }, [target, ghostMic])

  return (
    <div className="singPanel">
      <div className="singTarget">请唱：{displayName(target)}</div>
      <div className={'singDot ' + state}>{state === 'listening' ? '正在听…' : state === 'done' ? '完成' : '准备中…'}</div>
      {heard !== null && <div className="singHeard">听到：{displayName(heard)}</div>}
    </div>
  )
}
