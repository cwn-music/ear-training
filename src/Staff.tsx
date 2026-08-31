// 缪斯 Muse · 五线谱渲染（VexFlow）
import { useEffect, useRef } from 'react'
import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, Beam, Dot, Stem } from 'vexflow'
import { ensureStaffFont } from './staffFont'
import type { Clef, Tok } from './theory'

const LETTERS = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b']
const keyOf = (midi: number) => LETTERS[midi % 12] + '/' + (Math.floor(midi / 12) - 1)
const needsAcc = (midi: number) => LETTERS[midi % 12].includes('#')

interface SlotRect { midi: number; x: number; y: number }

interface Props {
  clef?: Clef | 'none' // 'none' = 不画谱号（纯节奏谱用）
  midi?: number | null // 单音；null 表示隐藏答案（画一个空心占位符）
  midis?: number[] // 和弦/多音
  chord?: boolean
  rhythm?: Tok[]
  width?: number
  height?: number
  // —— 摆音符模式：谱面上画发光候选圈，点击后由父组件热区接管 ——
  slots?: number[] // 候选位置的音（白键）
  placedMidi?: number | null // 已放置的音符（画符头）
  revealMidi?: number | null // 揭晓：这个音的位置画绿圈（正确答案）
  wrongMidi?: number | null // 揭晓：错选的位置画红圈
  onSlots?: (rects: SlotRect[]) => void
}

// 把节奏 token 转成 VexFlow StaveNote
function tokNotes(tok: Tok, midi: number): StaveNote[] {
  const key = keyOf(midi)
  const mk = (dur: string, rest = false) => {
    const n = new StaveNote({ keys: rest ? ['b/4'] : [key], duration: dur })
    // 节奏谱符干统一朝上（教材惯例），并让连梁与符干方向一致
    if (!rest) n.setStemDirection(Stem.UP)
    if (rest) n.setStyle({ fillStyle: '#33415C', strokeStyle: '#33415C' })
    return n
  }
  switch (tok) {
    case 'q': return [mk('q')]
    case 'h': return [mk('h')]
    case 'r': return [mk('qr', true)]
    case 'ee': return [mk('8'), mk('8')]
    case 'eeee': return [mk('16'), mk('16'), mk('16'), mk('16')]
    case 'e8': return [mk('8')]
    case 'e8.': {
      const n = mk('8d')
      Dot.buildAndAttach([n], { all: true })
      return [n]
    }
    case 'e16': return [mk('16')]
    case 'q.': {
      const n = mk('qd')
      Dot.buildAndAttach([n], { all: true })
      return [n]
    }
  }
}

export default function Staff({ clef = 'treble', midi = null, midis, chord = false, rhythm, width = 320, height = 120, slots, placedMidi = null, revealMidi = null, wrongMidi = null, onSlots }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    const el = ref.current
    if (!el) return
    // 先确保 Bravura 音乐字体加载完成，再绘制（否则音符是空白字形）
    void ensureStaffFont().then(() => {
      if (cancelled || !ref.current) return
      drawStaff(ref.current)
    })
    return () => { cancelled = true }

    function drawStaff(el: HTMLDivElement) {
    el.innerHTML = ''
    try {
      const renderer = new Renderer(el, Renderer.Backends.SVG)
      renderer.resize(width, height)
      const ctx = renderer.getContext()
      ctx.setFont('Arial', 10)
      // 摆音符模式抬高谱表，给上加线/下加线的候选圈留位置
      const stave = new Stave(8, slots ? 44 : 12, width - 16)
      if (clef === 'none') {
        // 教材式节奏谱：隐藏五线谱线（保留谱表定位功能），符头排在同一高度
        stave.options.lineConfig.forEach(l => { l.visible = false })
      } else {
        stave.addClef(clef)
      }
      stave.setContext(ctx).draw()

      // 摆音符：候选发光圈 + 已放置的符头
      if (slots && clef !== 'none') {
        const svgEl = el.querySelector('svg')
        if (svgEl) {
          const svg: SVGSVGElement = svgEl
          const NS = 'http://www.w3.org/2000/svg'
          const mk = <T extends SVGElement>(tag: string) => document.createElementNS(NS, tag) as T
          const lineOf = (m: number) => {
            const n = new StaveNote({ keys: [keyOf(m)], duration: 'q', clef })
            return n.getKeyProps()[0].line // 半格数（treble 从 c/4=0 起）
          }
          const yOf = (m: number) => stave.getYForLine(5 - lineOf(m)) // 5 线坐标：0=顶线 4=底线
          const xStep = (width - 110) / (slots.length - 1)
          const rects: SlotRect[] = slots.map((m, i) => ({ midi: m, x: 76 + i * xStep, y: yOf(m) }))

          // 加线（候选圈落在线外时画对应的小横线）
          const ledger = (x: number, line: number, color: string) => {
            const lo = Math.floor(Math.min(line, 1))
            const hi = Math.ceil(Math.max(line, 5))
            for (let l = lo; l <= 0; l++) drawLedgerSeg(l)
            for (let l = 6; l <= hi; l++) drawLedgerSeg(l)
            function drawLedgerSeg(l: number) {
              const seg = mk<SVGLineElement>('line')
              seg.setAttribute('x1', String(x - 15)); seg.setAttribute('x2', String(x + 15))
              seg.setAttribute('y1', String(stave.getYForLine(5 - l))); seg.setAttribute('y2', String(stave.getYForLine(5 - l)))
              seg.setAttribute('stroke', color); seg.setAttribute('stroke-width', '1.6')
              svg.appendChild(seg)
            }
          }

          const INK = '#22304A'
          for (const r of rects) {
            const isRight = revealMidi === r.midi
            const isWrong = wrongMidi === r.midi
            const color = isRight ? '#3a7d44' : isWrong ? '#D9534F' : '#B9962F'
            ledger(r.x, lineOf(r.midi), isRight ? '#3a7d44' : INK)
            const c = mk<SVGCircleElement>('circle')
            c.setAttribute('cx', String(r.x)); c.setAttribute('cy', String(r.y)); c.setAttribute('r', '11')
            c.setAttribute('fill', isRight ? 'rgba(58,125,68,0.14)' : isWrong ? 'rgba(217,83,79,0.12)' : 'rgba(185,150,47,0.10)')
            c.setAttribute('stroke', color)
            c.setAttribute('stroke-width', isRight || isWrong ? '2.2' : '1.8')
            if (!isRight && !isWrong) c.setAttribute('stroke-dasharray', '4 3')
            c.setAttribute('class', 'slotRing')
            svg.appendChild(c)
          }

          // 已放置的音符：自绘符头 + 符干（与 VexFlow 实心四分一致的比例）
          if (placedMidi != null) {
            const r = rects.find(rr => rr.midi === placedMidi)
            if (r) {
              const wrong = wrongMidi === placedMidi
              const headColor = wrong ? '#D9534F' : INK
              const head = mk<SVGEllipseElement>('ellipse')
              head.setAttribute('cx', String(r.x)); head.setAttribute('cy', String(r.y))
              head.setAttribute('rx', '6.2'); head.setAttribute('ry', '4.6')
              head.setAttribute('fill', headColor)
              head.setAttribute('transform', `rotate(-18 ${r.x} ${r.y})`)
              svg.appendChild(head)
              const stem = mk<SVGLineElement>('line')
              stem.setAttribute('x1', String(r.x + 5.6)); stem.setAttribute('x2', String(r.x + 5.6))
              stem.setAttribute('y1', String(r.y - 1)); stem.setAttribute('y2', String(r.y - 34))
              stem.setAttribute('stroke', headColor); stem.setAttribute('stroke-width', '1.8')
              svg.appendChild(stem)
            }
          }
          onSlots?.(rects)
        }
      }

      let notes: StaveNote[] = []
      if (rhythm) {
        notes = rhythm.flatMap(tok => tokNotes(tok, midi ?? 71))
      } else if (midis && midis.length > 0) {
        if (chord) {
          const n = new StaveNote({ keys: midis.map(keyOf), duration: 'w' })
          midis.forEach((m, i) => {
            if (needsAcc(m)) n.addModifier(new Accidental('#'), i)
          })
          notes = [n]
        } else {
          notes = midis.map(m => {
            const n = new StaveNote({ keys: [keyOf(m)], duration: 'w' })
            if (needsAcc(m)) n.addModifier(new Accidental('#'), 0)
            return n
          })
        }
      } else if (midi !== null) {
        const n = new StaveNote({ keys: [keyOf(midi)], duration: 'w' })
        if (needsAcc(midi)) n.addModifier(new Accidental('#'), 0)
        notes = [n]
      }

      if (notes.length > 0) {
        // 隐藏答案模式：把音符涂成浅灰，只提示节奏位置
        const red = midi === null && !rhythm
        if (red) notes.forEach(n => n.setStyle({ fillStyle: '#c8c2b4', strokeStyle: '#c8c2b4' }))
        const voice = new Voice({ numBeats: 4, beatValue: 4 }).setStrict(false)
        voice.addTickables(notes)
        new Formatter().joinVoices([voice]).formatToStave([voice], stave)
        // 连梁按「连续可连梁段」分组生成（四分/二分/附点/休止会打断分组），
        // 且必须在 voice.draw 之前算：generateBeams 会把统一的符干方向写回音符，符干与梁才一致
        const beams: Beam[] = []
        let run: StaveNote[] = []
        const flush = () => {
          if (run.length > 1) {
            try {
              beams.push(...Beam.generateBeams(run, { stemDirection: Stem.UP }))
            } catch (e) {
              console.warn('beam fail:', e)
            }
          }
          run = []
        }
        for (const n of notes) {
          const d = n.getDuration()
          if (!n.isRest() && (d === '8' || d === '16' || d === '32')) run.push(n)
          else flush()
        }
        flush()
        voice.draw(ctx, stave)
        beams.forEach(b => b.setContext(ctx).draw())
      }
    } catch (e) {
      // 渲染失败时保底显示空白谱，并把错误打到控制台便于定位
      console.warn('Staff render failed:', e)
    }
    }
  }, [clef, midi, midis, chord, rhythm, width, height, slots, placedMidi, revealMidi, wrongMidi])

  return <div ref={ref} className="staffWrap" />
}
