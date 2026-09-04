// 缪斯 Muse · 跟着音乐弹奏（第三课）：彩色长条从右边滚向金色节拍线，到线时按下它那一行的琴键
// 规则（与孩子约定好的）：节拍相对严格，但没按键时音乐会停下来等你，按对了再继续走
import { useEffect, useRef, useState } from 'react'
import { PA_PATTERNS, solfegeOf } from './theory'
import { ensureAudio, playNote } from './audio'
import { noteYOnStaff } from './Staff'
import Piano from './Piano'

interface Stats { hit: number; filled: number; wrong: number }
interface Props { pat: number; onDone: (ok: boolean, stats: Stats) => void }

const BPM = 60
const SPB = 60 / BPM // 每拍 1 秒
const EARLY = 0.45 // 拍：允许提前按键的量
const LATE = 0.6 // 拍：晚这么多还没按 → 停下来等
const PXB = 64 // 每拍像素
const LINEX = 76 // 节拍线 x
const LEAD = 2 // 起拍：开始前留 2 拍让长条先滚进来
const STAVE_Y = 20

interface N { m: number; beats: number; start: number; st: 0 | 1 | 2 | 3; guided: boolean }
// st: 0=在路上 1=进入判定窗 2=准时按中 3=停下等待后补上

export default function PlayAlong({ pat, onDone }: Props) {
  const [notes] = useState<N[]>(() => {
    let t = LEAD
    return PA_PATTERNS[pat].map(n => {
      const x: N = { m: n.m, beats: n.beats, start: t, st: 0, guided: false }
      t += n.beats
      return x
    })
  })
  const total = notes.reduce((s, n) => s + n.beats, 0) + LEAD
  const [phase, setPhase] = useState<'ready' | 'run' | 'pause' | 'done'>('ready')
  const [, setTick] = useState(0)
  const [flash, setFlash] = useState(false) // 错键红闪
  const tRef = useRef(0)
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const statsRef = useRef<Stats>({ hit: 0, filled: 0, wrong: 0 })
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 主时钟：只有 run 状态才走拍；暂停时 last 照常刷新，恢复时不跳拍
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const step = (now: number) => {
      const dt = (now - last) / 1000 / SPB
      last = now
      if (phaseRef.current === 'run') {
        tRef.current += dt
        const t = tRef.current
        const cur = notes.find(n => n.st === 0 || n.st === 1)
        if (cur) {
          if (cur.st === 0 && t >= cur.start - EARLY) cur.st = 1
          if (!cur.guided && t >= cur.start) {
            cur.guided = true
            void ensureAudio().then(() => playNote(cur.m, Math.min(cur.beats * SPB * 0.9, 1.6), 0.4)) // 轻柔的引导音
          }
          if (cur.st === 1 && t > cur.start + LATE) setPhase('pause') // 没人按 → 停下来等
        } else if (t > total + 0.6) {
          setPhase('done')
          const s = { ...statsRef.current }
          onDoneRef.current(s.wrong <= 1, s)
          return
        }
        setTick(x => x + 1)
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [notes, total])

  const doFlash = () => {
    setFlash(true)
    if (flashTimer.current) clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlash(false), 350)
  }

  const onPress = (m: number) => {
    if (phaseRef.current !== 'run' && phaseRef.current !== 'pause') return
    const cur = notes.find(n => n.st === 0 || n.st === 1)
    if (!cur) return
    if (phaseRef.current === 'pause') {
      if (m === cur.m) {
        cur.st = 3
        statsRef.current.filled++
        tRef.current = cur.start // 把时间倒回这个音的起点，后面的长条重新获得完整判定窗
        setPhase('run')
      } else {
        statsRef.current.wrong++
        doFlash()
      }
    } else if (m !== cur.m) {
      statsRef.current.wrong++ // 错键
      doFlash()
    } else if (tRef.current >= cur.start - EARLY && tRef.current <= cur.start + LATE) {
      cur.st = 2
      statsRef.current.hit++
    } else {
      statsRef.current.wrong++ // 抢拍太早
      doFlash()
    }
    setTick(x => x + 1)
  }

  const start = () => {
    void ensureAudio()
    tRef.current = 0
    setPhase('run')
  }

  // 谱面坐标：复用五线谱的 y 计算，三条音轨就是 do re mi 在谱上的真实位置
  const yDo = noteYOnStaff(60, 'treble', STAVE_Y)
  const yRe = noteYOnStaff(62, 'treble', STAVE_Y)
  const yMi = noteYOnStaff(64, 'treble', STAVE_Y)
  const laneY = (m: number) => (m === 60 ? yDo : m === 62 ? yRe : yMi)
  const lineYs = [64, 67, 71, 74, 77].map(m => noteYOnStaff(m, 'treble', STAVE_Y)) // E4 G4 B4 D5 F5 五条线
  const W = 340
  const H = Math.ceil(yDo) + 20
  const t = tRef.current
  const cur = notes.find(n => n.st === 0 || n.st === 1)
  const stats = statsRef.current

  return (
    <div className="playAlong">
      <div className={'paStage' + (flash ? ' paFlash' : '')}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="paSvg">
          {/* 五线谱底 */}
          {lineYs.map((y, i) => (
            <line key={i} x1={8} y1={y} x2={W - 8} y2={y} className="paLine" />
          ))}
          {/* 音轨标签 + 轨道小音符 */}
          {([60, 62, 64] as const).map(m => (
            <g key={m}>
              <text x={16} y={laneY(m) + 3.5} className="paLane">{solfegeOf(m)}</text>
              <ellipse cx={34} cy={laneY(m)} rx={4.6} ry={3.6} className="paLaneDot" />
              {m === 60 && <line x1={28} y1={yDo} x2={40} y2={yDo} className="paLine" />}
            </g>
          ))}
          {/* 金色节拍线 */}
          <line x1={LINEX} y1={6} x2={LINEX} y2={H - 6} className="paBeat" />
          <path d={`M ${LINEX} 4 l 5 6 l -5 6 l -5 -6 z`} className="paBeatGem" />
          {/* 滚动长条 */}
          {notes.map((n, i) => {
            const x = LINEX + (n.start - t) * PXB
            const w = n.beats * PXB - 6
            if (x > W - 6 || x + w < 8) return null
            const y = laneY(n.m)
            const cls = 'paBar'
              + (n.st === 2 ? ' hit' : n.st === 3 ? ' filled' : '')
              + (phase === 'pause' && cur === n ? ' waiting' : '')
              + (phase === 'run' && cur === n && n.st === 1 ? ' due' : '')
            return (
              <g key={i}>
                {n.m === 60 && <line x1={Math.max(x - 3, 8)} y1={yDo} x2={Math.min(x + w + 3, W - 8)} y2={yDo} className="paLine" />}
                <rect x={x} y={y - 7.5} width={w} height={15} rx={7.5} className={cls} />
              </g>
            )
          })}
        </svg>
      </div>
      <p className="paHint">
        {phase === 'ready' && '只用 do re mi 三个键。点「开始」，长条会从右边滚过来'}
        {phase === 'run' && '长条一碰到金色线，就按它那一行的琴键'}
        {phase === 'pause' && cur && <>音乐停下来等你——按下 <b>{solfegeOf(cur.m)}</b> 就继续走</>}
        {phase === 'done' && '弹完啦！'}
      </p>
      {phase !== 'ready' && (
        <div className="paStats">
          <span className="paChip ok">准时 {stats.hit}</span>
          <span className="paChip fill">补上 {stats.filled}</span>
          <span className="paChip miss">错键 {stats.wrong}</span>
        </div>
      )}
      {phase === 'ready'
        ? <button className="btn primary big" onClick={start}>▶ 开始</button>
        : <Piano interactive={phase === 'run' || phase === 'pause'} from={60} to={64} onPick={onPress} />}
    </div>
  )
}
