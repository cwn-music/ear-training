// 缪斯 Muse · 答题动画示例
// 「怎么答题」卡里的循环小动画：用简笔界面元素演示完整答题动作——
// 听/看题目 → 手指点答案 → 标绿打勾。6 秒一轮，纯 CSS 驱动。
// 一课有多种新题型时（如第 5 课），轮播切换。
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'

export type DemoKind =
  | 'pitch' | 'sight' | 'place' | 'judge'
  | 'pitchcmp' | 'durcmp' | 'dyncmp'
  | 'interval' | 'stepleap' | 'direct' | 'fill'
  | 'melody' | 'rhythm' | 'meter' | 'timbre' | 'scale' | 'sing'

// 每种新题型第一次出现的课
export const LESSON_DEMOS: Record<number, DemoKind[]> = {
  1: ['pitch'],
  2: ['pitchcmp'],
  3: ['durcmp'],
  4: ['dyncmp'],
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
