// 缪斯 Muse · 跟唱校准（pitchy 基频检测）
import { useEffect, useRef, useState } from 'react'
import { PitchDetector } from 'pitchy'
import { displayName } from './theory'

interface Props {
  target: number
  ghostMic?: boolean // 冒烟测试：不申请麦克风，直接成功
  prompt?: string // 覆盖「请唱：X」文案（模唱另一个音时不能剧透目标唱名）
  onDone: (ok: boolean, heard?: number | null) => void
  onHear?: (midi: number | null) => void // 实时汇报听到的音（谱面光条用）
}

const CLARITY = 0.9
const TOL = 0.75 // 半音容差
const NEED_FRAMES = 12
const TIMEOUT_MS = 12000

const midiOfFreq = (f: number) => 69 + 12 * Math.log2(f / 440)

export default function Sing({ target, ghostMic = false, prompt, onDone, onHear }: Props) {
  const [heard, setHeard] = useState<number | null>(null)
  const [state, setState] = useState<'init' | 'listening' | 'done'>('init')
  const doneRef = useRef(false)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const onHearRef = useRef(onHear)
  onHearRef.current = onHear
  // 听到的音按次数记账：唱错时取出「唱得最多的那个音」做正误对比
  const heardCount = useRef(new Map<number, number>())

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
    // 光条汇报：音变才上报；短暂听不清（<300ms）不急着收光条，避免闪烁
    let lastSent: number | null = null
    let lastClearAt = 0

    const finish = (ok: boolean) => {
      if (doneRef.current) return
      doneRef.current = true
      setState('done')
      if (timer) clearTimeout(timer)
      stream?.getTracks().forEach(t => t.stop())
      void ctx?.close().catch(() => undefined)
      let top: number | null = null
      let topN = 0
      heardCount.current.forEach((n, m) => {
        if (n > topN) { topN = n; top = m }
      })
      onDoneRef.current(ok, top)
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
          const r = Math.round(m)
          setHeard(r)
          heardCount.current.set(r, (heardCount.current.get(r) ?? 0) + 1)
          lastClearAt = performance.now()
          if (lastSent !== r) {
            lastSent = r
            onHearRef.current?.(r)
          }
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
          if (lastSent !== null && performance.now() - lastClearAt > 300) {
            lastSent = null
            onHearRef.current?.(null)
          }
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
      <div className="singTarget">{prompt ?? `请唱：${displayName(target)}`}</div>
      <div className={'singDot ' + state}>{state === 'listening' ? '正在听…' : state === 'done' ? '完成' : '准备中…'}</div>
      {heard !== null && <div className="singHeard">听到：{displayName(heard)}</div>}
    </div>
  )
}
