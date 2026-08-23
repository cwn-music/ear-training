// 缪斯 Muse · 迷你钢琴键盘（可点击发声、可高亮、可标记 ①②）
import { useMemo } from 'react'
import { NOTE_NAMES, solfegeOf } from './theory'
import { ensureAudio, playNote } from './audio'

interface Props {
  from?: number // 默认 60（中央 do）
  to?: number // 默认 71（si）
  highlight?: number[]
  marks?: Record<number, string>
  interactive?: boolean
  label?: boolean
}

const BLACK_PCS = new Set([1, 3, 6, 8, 10])

export default function Piano({ from = 60, to = 71, highlight = [], marks = {}, interactive = false, label = true }: Props) {
  const { whites, blacks } = useMemo(() => {
    const ws: number[] = []
    const bs: { midi: number; afterWhite: number }[] = []
    for (let m = from; m <= to; m++) {
      if (BLACK_PCS.has(m % 12)) {
        bs.push({ midi: m, afterWhite: ws.length - 1 })
      } else {
        ws.push(m)
      }
    }
    return { whites: ws, blacks: bs }
  }, [from, to])

  const hl = new Set(highlight)
  const whiteW = 100 / whites.length

  const press = (m: number) => {
    if (!interactive) return
    void ensureAudio().then(() => playNote(m, 0.8, 0.9))
  }

  return (
    <div className="piano" aria-hidden={!interactive}>
      <div className="pianoWhites">
        {whites.map(m => (
          <div
            key={m}
            className={'pianoWhite' + (hl.has(m) ? ' hl' : '') + (interactive ? ' tap' : '')}
            onClick={() => press(m)}
          >
            {marks[m] && <span className="pianoMark">{marks[m]}</span>}
            {label && (
              <span className="pianoKeyLabel">
                {solfegeOf(m)}
                <small>{NOTE_NAMES[m % 12]}</small>
              </span>
            )}
          </div>
        ))}
      </div>
      {blacks.map(({ midi, afterWhite }) => (
        <div
          key={midi}
          className={'pianoBlack' + (hl.has(midi) ? ' hl' : '') + (interactive ? ' tap' : '')}
          style={{ left: `calc(${(afterWhite + 1) * whiteW}% - 4%)` }}
          onClick={() => press(midi)}
        >
          {marks[midi] && <span className="pianoMark dark">{marks[midi]}</span>}
        </div>
      ))}
    </div>
  )
}
