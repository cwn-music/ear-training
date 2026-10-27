// 缪斯 Muse · 答题动画示例
// 「怎么答题」卡里的循环小动画：用简笔界面元素演示完整答题动作——
// 听/看题目 → 手指点答案 → 标绿打勾。6 秒一轮，纯 CSS 驱动。
// 一课有多种新题型时（如第 5 课），轮播切换。
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import Staff from './Staff'
import { playLesson1Sequence, stopLesson1Audio } from './lesson1Audio'

export type DemoKind =
  | 'pitch' | 'sight' | 'place' | 'judge'
  | 'pitchcmp' | 'durcmp' | 'dyncmp'
  | 'interval' | 'stepleap' | 'direct' | 'fill'
  | 'melody' | 'rhythm' | 'meter' | 'timbre' | 'scale' | 'sing'
  | 'sing2' | 'play2' | 'dynote' | 'playalong'

// 每种新题型第一次出现的课
export const LESSON_DEMOS: Record<number, DemoKind[]> = {
  1: ['pitch'],
  2: ['pitchcmp', 'sing2', 'play2'],
  4: ['dyncmp', 'dynote'],
  5: ['sight', 'place', 'judge'],
  6: ['interval'],
  8: ['stepleap'],
  9: ['direct', 'fill'],
  10: ['melody'],
  11: ['rhythm', 'meter'],
  12: ['timbre'],
  19: ['scale'],
  21: ['sing'],
}

export const DEMO_LABELS: Record<DemoKind, string> = {
  pitch: '识音', sight: '识谱', place: '摆音符', judge: '对不对',
  pitchcmp: '比高低', durcmp: '比长短', dyncmp: '比强弱',
  interval: '音程', stepleap: '级进跳进', direct: '旋律走向', fill: '补缺口',
  melody: '选旋律', rhythm: '选节奏', meter: '数拍子', timbre: '辨音色',
  scale: '大小调', sing: '开口唱',
  sing2: '唱另一个音', play2: '弹另一个音', dynote: '强弱找音', playalong: '跟着弹',
}

type P = CSSProperties

// 手指小圆点：从底部出发，移到 (fx, fy) 点一下
function Finger({ fx, fy }: { fx: string; fy: string }) {
  return <span className="dmFinger" style={{ '--fx': fx, '--fy': fy } as P} />
}

// 选项片：at 是圆心的 left 值；hit 表示它会被点中（变绿打勾）
function Chip({ at, hit, children }: { at: string; hit?: boolean; children: ReactNode }) {
  return (
    <span className={'dmChip' + (hit ? ' dmHit' : '')} style={{ left: at }}>
      {children}
      {hit && <i className="dmCheck">✓</i>}
    </span>
  )
}

// 三道声波：表示「正在播放声音」
function Waves() {
  return <span className="dmWaves"><i /><i /><i /></span>
}

// 迷你钢琴（简笔；keys=3 时只画 do re mi 三个白键，第 1 课用）
function MiniPiano({ glowKey = -1, flashKey = -1, top, keys = 7 }: { glowKey?: number; flashKey?: number; top: number; keys?: number }) {
  const width = keys === 3 ? 80 : 182
  const blackX = keys === 3 ? [20, 47] : [19, 45, 97, 123, 149]
  return (
    <div className="dmPiano" style={{ top, width }}>
      {Array.from({ length: keys }, (_, i) => (
        <span key={i} className={'dmW' + (i === glowKey ? ' dmKeyGlow' : '') + (i === flashKey ? ' dmKeyFlash' : '')} />
      ))}
      {blackX.map(x => <span key={x} className="dmB" style={{ left: x }} />)}
    </div>
  )
}

// 迷你五线谱
function MiniStaff({ top, children }: { top: number; children?: ReactNode }) {
  return <div className="dmStaff" style={{ top }}>{children}</div>
}

// 谱面音符头
function Note({ x, y, cls = '' }: { x: string; y: number; cls?: string }) {
  return <span className={'dmNote ' + cls} style={{ left: x, top: y }} />
}

// 两个音的题（高低/长短/强弱/音程/级进）：① ② 小标
function Mark({ x, y, children }: { x: string; y: number; children: ReactNode }) {
  return <span className="dmMark" style={{ left: x, top: y }}>{children}</span>
}

function DemoStage({ kind }: { kind: DemoKind }) {
  switch (kind) {
    // 听音 → 琴键亮 → 点名字（第 1 课只有 do re mi 三个键）
    case 'pitch':
      return (
        <>
          <MiniPiano glowKey={0} top={16} keys={3} />
          <span className="dmSound" style={{ right: 14, top: 10 }}><Waves /></span>
          <Chip at="22%" hit>do</Chip>
          <Chip at="50%">re</Chip>
          <Chip at="78%">mi</Chip>
          <Finger fx="22%" fy="140px" />
        </>
      )
    // 看谱 → 点名字
    case 'sight':
      return (
        <>
          <MiniStaff top={22}>
            <Note x="50%" y={27} />
          </MiniStaff>
          <Chip at="22%">do</Chip>
          <Chip at="50%" hit>re</Chip>
          <Chip at="78%">mi</Chip>
          <Finger fx="50%" fy="140px" />
        </>
      )
    // 听音 → 点到谱面发光圈
    case 'place':
      return (
        <>
          <MiniStaff top={16}>
            {['18%', '38%', '58%', '78%'].map((x, i) => (
              <span key={x} className={'dmSlot' + (i === 1 ? ' dmSlotGood' : '')} style={{ left: x, top: 10 + i * 7 }} />
            ))}
            <Note x="38%" y={17} cls="dmNoteIn" />
          </MiniStaff>
          <span className="dmSound" style={{ right: 14, top: 10 }}><Waves /></span>
          <Finger fx="38%" fy="33px" />
        </>
      )
    // 谱上标的名字对不对 → 点 ✓ / ✗
    case 'judge':
      return (
        <>
          <MiniStaff top={14}>
            <Note x="50%" y={27} />
          </MiniStaff>
          <span className="dmClaim">这个音是 <b>re</b></span>
          <Chip at="30%" hit>✓ 标对了</Chip>
          <Chip at="70%">✗ 标错了</Chip>
          <Finger fx="30%" fy="140px" />
        </>
      )
    // 两个音比高低
    case 'pitchcmp':
      return (
        <>
          <span className="dmDot" style={{ left: '34%', top: 52 }} />
          <span className="dmDot" style={{ left: '62%', top: 24 }} />
          <Mark x="34%" y={76}>①</Mark>
          <Mark x="62%" y={48}>②</Mark>
          <span className="dmSound" style={{ right: 14, top: 10 }}><Waves /></span>
          <Chip at="32%" hit>更高</Chip>
          <Chip at="68%">更低</Chip>
          <Finger fx="32%" fy="140px" />
        </>
      )
    // 两个音比长短
    case 'durcmp':
      return (
        <>
          <span className="dmBar" style={{ left: '34%', top: 44, width: 30 }} />
          <span className="dmBar" style={{ left: '62%', top: 44, width: 84 }} />
          <Mark x="34%" y={66}>①</Mark>
          <Mark x="62%" y={66}>②</Mark>
          <Chip at="32%" hit>更长</Chip>
          <Chip at="68%">更短</Chip>
          <Finger fx="32%" fy="140px" />
        </>
      )
    // 两个音比强弱
    case 'dyncmp':
      return (
        <>
          <span className="dmDot" style={{ left: '34%', top: 44, width: 14, height: 14 }} />
          <span className="dmDot" style={{ left: '62%', top: 36, width: 28, height: 28 }} />
          <Mark x="34%" y={72}>①</Mark>
          <Mark x="62%" y={72}>②</Mark>
          <Chip at="32%" hit>更响</Chip>
          <Chip at="68%">更轻</Chip>
          <Finger fx="32%" fy="140px" />
        </>
      )
    // 一起响的两个音 → 音程
    case 'interval':
      return (
        <>
          <MiniStaff top={18}>
            <Note x="42%" y={27} cls="dmChord" />
            <Note x="58%" y={18} cls="dmChord" />
          </MiniStaff>
          <Chip at="32%" hit>大二度</Chip>
          <Chip at="68%">大三度</Chip>
          <Finger fx="32%" fy="140px" />
        </>
      )
      // 挨着走还是跳着走
    case 'stepleap':
      return (
        <>
          <MiniStaff top={18}>
            <Note x="42%" y={27} cls="dmChord" />
            <Note x="56%" y={22} cls="dmChord" />
          </MiniStaff>
          <Chip at="32%" hit>级进</Chip>
          <Chip at="68%">跳进</Chip>
          <Finger fx="32%" fy="140px" />
        </>
      )
    // 旋律往哪走
    case 'direct':
      return (
        <>
          <span className="dmDot" style={{ left: '30%', top: 56 }} />
          <span className="dmDot" style={{ left: '48%', top: 40 }} />
          <span className="dmDot" style={{ left: '66%', top: 24 }} />
          <span className="dmSound" style={{ right: 14, top: 10 }}><Waves /></span>
          <Chip at="20%" hit>上行</Chip>
          <Chip at="50%">下行</Chip>
          <Chip at="80%">反复</Chip>
          <Finger fx="20%" fy="140px" />
        </>
      )
    // 补缺口：听音组 → 点琴键补上
    case 'fill':
      return (
        <>
          <span className="dmSeqChip" style={{ left: '26%', top: 14 }}>do</span>
          <span className="dmSeqChip dmGap dmHit" style={{ left: '50%', top: 14 }}>
            <i className="dmGapQ">？</i>
            <i className="dmGapA">re</i>
          </span>
          <span className="dmSeqChip" style={{ left: '74%', top: 14 }}>mi</span>
          <MiniPiano flashKey={1} top={88} />
          <Finger fx="calc(50% - 52px)" fy="114px" />
        </>
      )
    // 听旋律 → 点一样的谱子（三行选一行）
    case 'melody':
      return (
        <>
          {[
            ['72%', '56%', '40%', '28%'],
            ['28%', '40%', '56%', '72%'],
            ['50%', '50%', '50%', '50%'],
          ].map((pat, i) => (
            <span key={i} className={'dmRow' + (i === 1 ? ' dmHit' : '')} style={{ top: 12 + i * 32 }}>
              <b>{'ABC'[i]}</b>
              {pat.map((y, j) => <span key={j} className="dmMini" style={{ left: `${30 + j * 16}%`, top: y }} />)}
              {i === 1 && <i className="dmCheck">✓</i>}
            </span>
          ))}
          <span className="dmSound" style={{ right: 14, top: 118 }}><Waves /></span>
          <Finger fx="50%" fy="57px" />
        </>
      )
    // 听节奏 → 点一样的节奏谱
    case 'rhythm':
      return (
        <>
          {[
            [50, 50],
            [62, 19, 19],
            [25, 25, 25, 25],
          ].map((pat, i) => (
            <span key={i} className={'dmRow' + (i === 0 ? ' dmHit' : '')} style={{ top: 12 + i * 32 }}>
              <b>{'ABC'[i]}</b>
              <span className="dmStrip">
                {pat.map((w, j) => <span key={j} className="dmSeg" style={{ width: `${w}%` }} />)}
              </span>
              {i === 0 && <i className="dmCheck">✓</i>}
            </span>
          ))}
          <span className="dmSound" style={{ right: 14, top: 118 }}><Waves /></span>
          <Finger fx="50%" fy="25px" />
        </>
      )
    // 数强拍 → 几拍子
    case 'meter':
      return (
        <>
          <div className="dmBeats">
            {[0, 1, 2, 3].map(i => (
              <span key={i} className={'dmBeat' + (i % 2 === 0 ? ' strong' : '')} style={{ '--n': i } as P} />
            ))}
          </div>
          <span className="dmSound" style={{ right: 14, top: 10 }}><Waves /></span>
          <Chip at="32%" hit>二拍子</Chip>
          <Chip at="68%">三拍子</Chip>
          <Finger fx="32%" fy="140px" />
        </>
      )
    // 哪种乐器在演奏
    case 'timbre':
      return (
        <>
          <span className="dmInst"><Waves /></span>
          <span className="dmWho">谁在演奏？</span>
          <Chip at="30%" >钢琴</Chip>
          <Chip at="70%" hit>小提琴</Chip>
          <span className="dmChip" style={{ left: '30%', bottom: 48 }}>长笛</span>
          <span className="dmChip" style={{ left: '70%', bottom: 48 }}>小号</span>
          <Finger fx="70%" fy="140px" />
        </>
      )
    // 大调还是小调
    case 'scale':
      return (
        <>
          <MiniStaff top={18}>
            {['24%', '41%', '58%', '75%'].map((x, i) => (
              <Note key={x} x={x} y={30 - i * 7} cls="dmChord" />
            ))}
          </MiniStaff>
          <span className="dmSound" style={{ right: 14, top: 10 }}><Waves /></span>
          <Chip at="32%" hit>大调</Chip>
          <Chip at="68%">小调</Chip>
          <Finger fx="32%" fy="140px" />
        </>
      )
    // 开口唱：三个音依次点亮
    case 'sing':
      return (
        <>
          <span className="dmMic" />
          {['do', 're', 'mi'].map((s, i) => (
            <span key={s} className="dmChip dmSingChip" style={{ left: `${26 + i * 24}%`, '--n': i } as P}>
              {s}
              <i className="dmCheck dmSingCheck">✓</i>
            </span>
          ))}
          <span className="dmSingHint">听示范 → 跟着唱 → 唱准一个亮一个</span>
        </>
      )
    // 唱另一个音：左边先后听 ①② 两个音（①会告诉你是 do），右边对着麦克风唱出 ②
    case 'sing2':
      return (
        <>
          <span className="dmDot" style={{ left: '20%', top: 40 }} />
          <span className="dmDot" style={{ left: '42%', top: 20 }} />
          <Mark x="20%" y={62}>① do</Mark>
          <Mark x="42%" y={42}>② ?</Mark>
          <span className="dmSound" style={{ left: '55%', top: 12 }}><Waves /></span>
          <span className="dmMicBox">
            <span className="dmMic" />
            <i className="dmCheck" />
            <span className="dmMicLabel">唱第二个音</span>
          </span>
          <span className="dmFlowHint">听两个音 → 第一个会告诉你 → 唱出第二个</span>
        </>
      )
    // 弹另一个音：① 的琴键已亮出，手指弹出 ②
    case 'play2':
      return (
        <>
          <span className="dmSound" style={{ right: 14, top: 10 }}><Waves /></span>
          <Mark x="calc(50% - 27px)" y={44}>①</Mark>
          <Mark x="50%" y={44}>②</Mark>
          <MiniPiano glowKey={0} flashKey={1} top={66} keys={3} />
          <Finger fx="50%" fy="94px" />
          <span className="dmFlowHint">第一个音已亮出 → 弹出第二个音</span>
        </>
      )
    // 强弱找音：先比强弱，再把更响的音弹出来
    case 'dynote':
      return (
        <>
          <span className="dmDot" style={{ left: '24%', top: 24, width: 14, height: 14 }} />
          <span className="dmDot" style={{ left: '50%', top: 18, width: 28, height: 28 }} />
          <Mark x="24%" y={48}>①</Mark>
          <Mark x="50%" y={48}>②</Mark>
          <span className="dmSound" style={{ right: 14, top: 10 }}><Waves /></span>
          <MiniPiano flashKey={1} top={72} keys={3} />
          <Finger fx="50%" fy="100px" />
          <span className="dmFlowHint">先比强弱 → 把更响的音弹出来</span>
        </>
      )
    // 跟着弹：长条滚到金色线，按那一行的琴键
    case 'playalong':
      return (
        <>
          <div className="dmRail">
            {[0, 1, 2].map(i => (
              <span key={i} className="dmRailBar" style={{ '--n': i } as P} />
            ))}
            <i className="dmRailBeat" />
          </div>
          <MiniPiano flashKey={1} top={76} keys={3} />
          <Finger fx="50%" fy="104px" />
          <span className="dmFlowHint">长条碰到金线 → 按那一行的琴键</span>
        </>
      )
  }
}

export default function HowToDemo({ demos }: { demos: DemoKind[] }) {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    if (demos.length <= 1) return
    const t = setInterval(() => setIdx(v => (v + 1) % demos.length), 6400)
    return () => clearInterval(t)
  }, [demos.length])
  const cur = demos[Math.min(idx, demos.length - 1)]
  return (
    <div className="dmWrap">
      {demos.length > 1 && (
        <div className="dmTabs">
          {demos.map((d, i) => (
            <button key={d} className={'dmTab' + (i === idx ? ' now' : '')} onClick={() => setIdx(i)}>
              {DEMO_LABELS[d]}
            </button>
          ))}
        </div>
      )}
      {/* key 切换让 CSS 动画从头重播 */}
      <div className="dmStage" key={cur}>
        <DemoStage kind={cur} />
      </div>
    </div>
  )
}

// —— 第3课课首：声音、唱名、谱面三向对应的可操作演示 ——
// 只用于 Learn 的课首说明，不参与第3课题目生成、作答判定或学习记录。
type L3Pitch = 60 | 62 | 64
type L3SceneId = 'listenName' | 'sightName' | 'listenPlace' | 'match'

const L3_PITCHES: L3Pitch[] = [60, 62, 64]
const L3_SOLFEGE: Record<L3Pitch, string> = { 60: 'do', 62: 're', 64: 'mi' }
const L3_POSITION: Record<L3Pitch, string> = { 60: '下加一线', 62: '下加一间', 64: '第一线' }

interface L3Scene {
  id: L3SceneId
  label: string
  pitch: L3Pitch
  steps: string[]
  soundSteps: number[]
}

const L3_SCENES: L3Scene[] = [
  {
    id: 'listenName', label: '听音选名', pitch: 62, soundSteps: [0, 2],
    steps: [
      '先听一个音，记住它的声音。',
      '再在 do、re、mi 中点它的名字。',
      '答后会再听一次，并看到对应的琴键。',
    ],
  },
  {
    id: 'sightName', label: '看谱选名', pitch: 62, soundSteps: [2],
    steps: [
      '先看音符在谱面上的位置。',
      '说出它的名字，再点对应选项。',
      '答后可以点听，把位置、名字和声音连起来。',
    ],
  },
  {
    id: 'listenPlace', label: '听音定位', pitch: 62, soundSteps: [0, 2],
    steps: [
      '先听声音，看看三个可以摆放的位置。',
      '点一下待放音符，再点它的谱面位置；也可以拖动。',
      '音符落到下加一间，再听一次这个位置的声音。',
    ],
  },
  {
    id: 'match', label: '三向配对', pitch: 62, soundSteps: [0, 3],
    steps: [
      '先点一张声音卡，听一听。',
      '再点与它相同的唱名。',
      '最后点对应的谱面位置。',
      '同一个声音的三个朋友，连成一组。',
    ],
  },
]

function useLesson3Sound(active: boolean) {
  const [sounding, setSounding] = useState(false)
  const [audioError, setAudioError] = useState(false)
  const requestRef = useRef(0)

  const stopSound = useCallback(() => {
    requestRef.current += 1
    stopLesson1Audio()
    setSounding(false)
    setAudioError(false)
  }, [])

  const playSound = useCallback((pitch: L3Pitch) => {
    const request = ++requestRef.current
    setSounding(true)
    setAudioError(false)
    void playLesson1Sequence([pitch], { noteMs: 650, gapMs: 0 })
      .catch(() => {
        if (request === requestRef.current) setAudioError(true)
      })
      .finally(() => {
        if (request === requestRef.current) setSounding(false)
      })
  }, [])

  useEffect(() => {
    if (!active) stopSound()
  }, [active, stopSound])

  useEffect(() => () => {
    requestRef.current += 1
    stopLesson1Audio()
  }, [])

  return { sounding, audioError, playSound, stopSound }
}

function L3SoundIcon({ active = false }: { active?: boolean }) {
  return (
    <span className={'l3-sound-icon' + (active ? ' sounding' : '')} aria-hidden="true">
      <svg viewBox="0 0 36 28">
        <path className="l3-speaker" d="M3 10h6l8-7v22l-8-7H3z" />
        <path className="l3-wave one" d="M22 9c3 3 3 7 0 10" />
        <path className="l3-wave two" d="M26 5c6 6 6 12 0 18" />
      </svg>
    </span>
  )
}

function L3TapPointer({ x, y, show }: { x: string; y: string; show: boolean }) {
  return (
    <span className={'l3-tap-pointer' + (show ? ' show' : '')} style={{ left: x, top: y }} aria-hidden="true">
      <i />
      <svg viewBox="0 0 28 32"><path d="M5 3l16 14-8 1 5 8-5 3-5-9-6 6z" /></svg>
    </span>
  )
}

function L3Options({ reveal }: { reveal: boolean }) {
  return (
    <div className="l3-demo-options">
      {L3_PITCHES.map(pitch => (
        <span key={pitch} className={'l3-demo-option' + (reveal && pitch === 62 ? ' correct' : '')}>
          {L3_SOLFEGE[pitch]}
          {reveal && pitch === 62 && <b aria-hidden="true">✓</b>}
        </span>
      ))}
    </div>
  )
}

function L3MiniKeys({ reveal }: { reveal: boolean }) {
  return (
    <span className="l3-mini-keys" aria-hidden="true">
      {L3_PITCHES.map(pitch => (
        <span key={pitch} className={reveal && pitch === 62 ? 'correct' : ''}>{L3_SOLFEGE[pitch]}</span>
      ))}
    </span>
  )
}

function L3MatchGrid({ step, sounding }: { step: number; sounding: boolean }) {
  const nameOrder: L3Pitch[] = [64, 62, 60]
  const staffOrder: L3Pitch[] = [64, 60, 62]
  const complete = step === 3
  return (
    <div className="l3-match-grid">
      <svg className="l3-match-lines" viewBox="0 0 300 280" preserveAspectRatio="none" aria-hidden="true">
        <path className={step >= 2 ? 'show' : ''} d="M91 66 C112 66 101 153 108 153" />
        <path className={complete ? 'show' : ''} d="M197 153 C216 153 201 240 209 240" />
      </svg>
      <div className="l3-match-head">声音</div>
      <div className="l3-match-head">唱名</div>
      <div className="l3-match-head">谱面</div>
      {[0, 1, 2].flatMap(row => [
        <div key={`sound-${row}`} className={'l3-match-card sound' + (row === 0 ? complete ? ' correct' : ' current' : '')}>
          <L3SoundIcon active={sounding && row === 0} />
          <span>声音 {'ABC'[row]}</span>
        </div>,
        <div key={`name-${row}`} className={'l3-match-card name' + (nameOrder[row] === 62 && step >= 1 ? complete ? ' correct' : ' current' : '')}>
          {L3_SOLFEGE[nameOrder[row]]}
        </div>,
        <div key={`staff-${row}`} className={'l3-match-card staff' + (staffOrder[row] === 62 && step >= 2 ? complete ? ' correct' : ' current' : '')}>
          <Staff midi={staffOrder[row]} noteDuration="q" width={82} height={80} staveY={-20} />
        </div>,
      ])}
      <L3TapPointer x="16%" y="24%" show={step === 0} />
      <L3TapPointer x="50%" y="55%" show={step === 1} />
      <L3TapPointer x="84%" y="86%" show={step === 2} />
    </div>
  )
}

function L3DemoScene({ scene, step, sounding }: { scene: L3Scene; step: number; sounding: boolean }) {
  const complete = step === scene.steps.length - 1
  if (scene.id === 'listenName') {
    return (
      <div className="l3-scene-inner">
        <div className="l3-listen-top">
          <span className="l3-sound-card"><L3SoundIcon active={sounding} /><span>{sounding ? '正在听' : '听一个音'}</span></span>
          <L3MiniKeys reveal={complete} />
        </div>
        <L3Options reveal={complete} />
        <L3TapPointer x="50%" y="82%" show={step === 1} />
      </div>
    )
  }
  if (scene.id === 'sightName') {
    return (
      <div className="l3-scene-inner">
        <div className={'l3-demo-staff-single' + (complete ? ' correct' : '')}>
          <Staff midi={62} noteDuration="q" width={280} height={126} />
          {complete && <span className="l3-staff-answer">re · 下加一间</span>}
        </div>
        <L3Options reveal={complete} />
        <L3TapPointer x="50%" y="82%" show={step === 1} />
      </div>
    )
  }
  if (scene.id === 'listenPlace') {
    return (
      <div className="l3-scene-inner place">
        <span className="l3-place-sound"><L3SoundIcon active={sounding} />{sounding ? '正在听' : '先听声音'}</span>
        <span className={'l3-waiting-note' + (complete ? ' placed' : '')}><i />待放音符</span>
        <div className="l3-demo-staff-place">
          <Staff
            slots={L3_PITCHES}
            placedMidi={complete ? 62 : null}
            revealMidi={complete ? 62 : null}
            width={280}
            height={150}
          />
        </div>
        <span className="l3-place-tip">点按或拖动，都可以</span>
        <L3TapPointer x="57%" y="55%" show={step === 1} />
      </div>
    )
  }
  return <L3MatchGrid step={step} sounding={sounding} />
}

export function Lesson3IntroDemo({ active = true }: { active?: boolean }) {
  const [sceneId, setSceneId] = useState<L3SceneId>('listenName')
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const scene = L3_SCENES.find(item => item.id === sceneId) ?? L3_SCENES[0]
  const last = scene.steps.length - 1
  const { sounding, audioError, playSound, stopSound } = useLesson3Sound(active)

  useEffect(() => {
    if (!playing || !active) return
    const timer = window.setTimeout(() => {
      const next = Math.min(step + 1, last)
      setStep(next)
      if (next === last) setPlaying(false)
      if (scene.soundSteps.includes(next)) playSound(scene.pitch)
      else stopSound()
    }, 1900)
    return () => window.clearTimeout(timer)
  }, [active, last, playSound, playing, scene, step, stopSound])

  const selectScene = (next: L3SceneId) => {
    stopSound()
    setPlaying(false)
    setSceneId(next)
    setStep(0)
  }

  const togglePlaying = () => {
    if (playing) {
      setPlaying(false)
      stopSound()
      return
    }
    const startAt = step === last ? 0 : step
    setStep(startAt)
    setPlaying(true)
    if (scene.soundSteps.includes(startAt)) playSound(scene.pitch)
    else stopSound()
  }

  const goToStep = (next: number) => {
    const bounded = Math.max(0, Math.min(last, next))
    setPlaying(false)
    setStep(bounded)
    if (scene.soundSteps.includes(bounded)) playSound(scene.pitch)
    else stopSound()
  }

  return (
    <section className="l3-demo" aria-label="第3课做题示范">
      <div className="l3-demo-heading">
        <span>做题示范</span>
        <p>选一种题，跟着分步演示看一遍。</p>
      </div>
      <div className="l3-demo-tabs" aria-label="选择示范类型">
        {L3_SCENES.map(item => (
          <button
            key={item.id}
            type="button"
            className={item.id === sceneId ? 'now' : ''}
            aria-pressed={item.id === sceneId}
            onClick={() => selectScene(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="l3-demo-stage" data-l3-scene={scene.id} data-l3-step={step} data-playing={playing}>
        <div className="l3-demo-step-copy">
          <span>第 {step + 1} / {scene.steps.length} 步</span>
          <p aria-live="polite">{scene.steps[step]}</p>
        </div>
        <div className="l3-demo-scene" aria-hidden="true">
          <L3DemoScene scene={scene} step={step} sounding={sounding} />
        </div>
      </div>
      <div className="l3-demo-controls">
        <button type="button" className="ghost" disabled={step === 0} onClick={() => goToStep(step - 1)}>上一步</button>
        <button type="button" className="primary" onClick={togglePlaying}>
          {playing ? '暂停示范' : step === last ? '再演示一次' : step > 0 ? '继续示范' : '播放示范'}
        </button>
        <button type="button" className="ghost" disabled={step === last} onClick={() => goToStep(step + 1)}>下一步</button>
      </div>
      {audioError && <p className="l3-audio-error" role="alert">声音暂时没有加载好，请再点一次播放。</p>}
    </section>
  )
}

export function Lesson3StaffHomes({ active = true }: { active?: boolean }) {
  const [current, setCurrent] = useState<L3Pitch | null>(null)
  const { sounding, audioError, playSound } = useLesson3Sound(active)
  return (
    <div className="l3-homes">
      <div className="l3-home-list">
        {L3_PITCHES.map(pitch => (
          <button
            key={pitch}
            type="button"
            className={'l3-home-row' + (current === pitch ? ' now' : '')}
            aria-label={`听 ${L3_SOLFEGE[pitch]}，${L3_POSITION[pitch]}`}
            onClick={() => { setCurrent(pitch); playSound(pitch) }}
          >
            <span className="l3-home-copy">
              <strong>{L3_SOLFEGE[pitch]}</strong>
              <small>{L3_POSITION[pitch]}</small>
            </span>
            <span className="l3-home-staff" aria-hidden="true">
              <Staff midi={pitch} noteDuration="q" width={180} height={112} staveY={0} />
            </span>
          </button>
        ))}
      </div>
      <p className="l3-home-feedback" aria-live="polite">
        {current === null
          ? '从下到上：do、re、mi。'
          : `${L3_SOLFEGE[current]} 住在${L3_POSITION[current]}${sounding && current !== null ? '，正在听它的声音。' : '。'}`}
      </p>
      {audioError && <p className="l3-audio-error" role="alert">声音暂时没有加载好，请再点一次。</p>}
    </div>
  )
}
