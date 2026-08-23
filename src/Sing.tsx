// 缪斯 Muse · 跟唱校准（pitchy 音高检测）
import { useEffect, useRef, useState } from 'react'
import { PitchDetector } from 'pitchy'
import { nameOf, solfegeOf } from './theory'

interface Props {
  target: number
  onPass: () => void
  onSkip: () => void
}

const NEED_FRAMES = 12
const TIMEOUT_MS = 12000

export default function Sing({ target, onPass, onSkip }: Props) {
  const [heard, setHeard] = useState('')
  const [cents, setCents] = useState<number | null>(null)
  const [frames, setFrames] = useState(0)
  const [failed, setFailed] = useState(false)
  const passRef = useRef(onPass)
  passRef.current = onPass
  const skipRef = useRef(onSkip)
  skipRef.current = onSkip

  useEffect(() => {
    let alive = true
    let stream: MediaStream | null = null
    let ctx: AudioContext | null = null
    let raf = 0
    const timer = window.setTimeout(() => {
      if (alive) setFailed(true)
    }, TIMEOUT_MS)

    async function boot() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        if (!alive) return
        ctx = new AudioContext()
        const src = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 2048
        src.connect(analyser)
        const detector = PitchDetector.forFloat32Array(analyser.fftSize)
        const buf = new Float32Array(analyser.fftSize)
        const loop = () => {
          if (!alive || !ctx) return
          analyser.getFloatTimeDomainData(buf)
          const [freq, clarity] = detector.findPitch(buf, ctx.sampleRate)
          if (clarity > 0.9 && freq > 50) {
            const m = 69 + 12 * Math.log2(freq / 440)
            const diff = ((((m - target) % 12) + 18) % 12) - 6
            setHeard(nameOf(Math.round(m)))
            setCents(Math.round(diff * 100))
            if (Math.abs(diff) <= 0.75) {
              setFrames(f => {
                const n = f + 1
                if (n >= NEED_FRAMES && alive) {
                  alive = false
                  window.clearTimeout(timer)
                  passRef.current()
                }
                return n
              })
            } else {
              setFrames(0)
            }
          }
          raf = requestAnimationFrame(loop)
        }
        loop()
      } catch {
        if (alive) setFailed(true)
      }
    }
    void boot()

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      window.clearTimeout(timer)
      stream?.getTracks().forEach(t => t.stop())
      if (ctx) void ctx.close()
    }
  }, [target])

  const pct = Math.min(100, Math.round((frames / NEED_FRAMES) * 100))

  return (
    <div className="singPanel">
      <div className="singTarget">
        请唱：<b>{nameOf(target)}</b>（{solfegeOf(target)}）
      </div>
      <div className="singHeard">
        {heard ? `听到：${heard}` : '唱出这个音，保持稳定……'}
        {cents !== null && <span className="singCents">{cents > 0 ? `+${cents}` : cents} 音分</span>}
      </div>
      <div className="singBar">
        <div className="singBarFill" style={{ width: pct + '%' }} />
      </div>
      {frames > 0 && <div className="singGood">很好，保持住这个音！</div>}
      {failed && (
        <button className="ghostMic" onClick={() => skipRef.current()}>
          麦克风用不了？先跳过，以后再唱
        </button>
      )}
    </div>
  )
}