// 缪斯 Muse · 节奏符号小词典（第 11 课单符号 / 第 17 课组合节奏型）：图形 + 动画 + 声音
import { useState } from 'react'
import Staff from './Staff'
import { ensureAudio, playRhythm } from './audio'
import { TOK_BEATS, type Tok } from './theory'

const BPM = 72
const BEAT_SEC = 60 / BPM

export interface DictEntry {
  name: string
  alias?: string // 俗称，如「二八」
  sub?: string // 构成说明，如「附点八分 + 十六分」
  glyph: Tok[] // 谱面上展示的长相
  demo: Tok[] // 点「听一听」播放的节奏（填满一小节四拍）
  glyphW?: number // 谱面宽度（组合型需要更宽）
}

// —— 第 11 课：六个基本符号 ——
const ENTRIES: DictEntry[] = [
  { name: '四分音符', glyph: ['q'], demo: ['q', 'q', 'q', 'q'] },
  { name: '八分音符', alias: '两个连在一起，又叫「二八」', glyph: ['ee'], demo: ['ee', 'ee', 'ee', 'ee'] },
  { name: '十六分音符', alias: '四个连在一起，又叫「四十六」', glyph: ['eeee'], demo: ['eeee', 'eeee', 'eeee', 'eeee'] },
  { name: '二分音符', glyph: ['h'], demo: ['h', 'h'] },
  { name: '附点四分音符', glyph: ['q.'], demo: ['q.', 'q.', 'q'] },
  { name: '四分休止符', glyph: ['r'], demo: ['q', 'r', 'q', 'r'] },
]

// —— 第 17 课：组合节奏型（俗称按音基教材口径） ——
export const COMBO_ENTRIES: DictEntry[] = [
  { name: '小附点', sub: '附点八分 + 十六分', glyph: ['e8.', 'e16'], demo: ['e8.', 'e16', 'e8.', 'e16', 'e8.', 'e16', 'e8.', 'e16'], glyphW: 132 },
  { name: '后小附点', sub: '十六分 + 附点八分', glyph: ['e16', 'e8.'], demo: ['e16', 'e8.', 'e16', 'e8.', 'e16', 'e8.', 'e16', 'e8.'], glyphW: 132 },
  { name: '前八后十六', sub: '八分 + 两个十六分', glyph: ['e8', 'e16', 'e16'], demo: ['e8', 'e16', 'e16', 'e8', 'e16', 'e16', 'e8', 'e16', 'e16', 'e8', 'e16', 'e16'], glyphW: 132 },
  { name: '前十六后八', sub: '两个十六分 + 八分', glyph: ['e16', 'e16', 'e8'], demo: ['e16', 'e16', 'e8', 'e16', 'e16', 'e8', 'e16', 'e16', 'e8', 'e16', 'e16', 'e8'], glyphW: 132 },
  { name: '小切分', sub: '十六分 + 八分 + 十六分，中间的音骑在拍点上', glyph: ['e16', 'e8', 'e16'], demo: ['e16', 'e8', 'e16', 'e16', 'e8', 'e16', 'e16', 'e8', 'e16', 'e16', 'e8', 'e16'], glyphW: 132 },
]

interface Seg {
  dur: number // 占几拍
  rest: boolean
}

// 把 token 序列展开成拍格条上的色块：ee 拆成两个半拍，eeee 拆成四个四分之一拍；原子 token 直接取时值
function segments(demo: Tok[]): Seg[] {
  const segs: Seg[] = []
  for (const tok of demo) {
    if (tok === 'ee') segs.push({ dur: 0.5, rest: false }, { dur: 0.5, rest: false })
    else if (tok === 'eeee') for (let i = 0; i < 4; i++) segs.push({ dur: 0.25, rest: false })
    else segs.push({ dur: TOK_BEATS[tok], rest: tok === 'r' })
  }
  return segs
}

function DictRow({ entry }: { entry: DictEntry }) {
  const [playKey, setPlayKey] = useState(0) // 递增以重启播放线动画
  const segs = segments(entry.demo)
  const totalBeats = segs.reduce((s, x) => s + x.dur, 0)
  const totalSec = totalBeats * BEAT_SEC

  const play = () => {
    void ensureAudio().then(() => {
      playRhythm(entry.demo, BPM)
      setPlayKey(k => k + 1)
    })
  }

  return (
    <div className="dictRow">
      <div className="dictHead">
        <span className="dictName">
          {entry.name}
          {entry.alias && <span className="dictAlias">{entry.alias}</span>}
          {entry.sub && <span className="dictSub">{entry.sub}</span>}
        </span>
        <Staff clef="none" rhythm={entry.glyph} width={entry.glyphW ?? 104} height={82} />
      </div>
      <div className="dictStrip">
        {segs.map((s, i) => (
          <div key={i} className={'dictSeg' + (s.rest ? ' rest' : '')} style={{ flexGrow: s.dur }} />
        ))}
        {playKey > 0 && (
          <div key={playKey} className="dictPlayhead" style={{ animationDuration: `${totalSec}s` }} />
        )}
      </div>
      <div className="dictFoot">
        <div className="dictTicks">
          {[1, 2, 3, 4].map(n => (
            <span key={n}>{n}</span>
          ))}
        </div>
        <button type="button" className="dictPlay" onClick={play}>
          ▶ 听一听
        </button>
      </div>
    </div>
  )
}

export default function RhythmDict({ entries = ENTRIES }: { entries?: DictEntry[] }) {
  return (
    <div className="dictList">
      {entries.map(e => (
        <DictRow key={e.name} entry={e} />
      ))}
    </div>
  )
}
