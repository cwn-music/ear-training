// 缪斯 Muse · 五线谱渲染（VexFlow）
import { useEffect, useRef } from 'react'
import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, Beam, Dot } from 'vexflow'
import { ensureStaffFont } from './staffFont'
import type { Clef, Tok } from './theory'

const LETTERS = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b']
const keyOf = (midi: number) => LETTERS[midi % 12] + '/' + (Math.floor(midi / 12) - 1)
const needsAcc = (midi: number) => LETTERS[midi % 12].includes('#')

interface Props {
  clef?: Clef
  midi?: number | null // 单音；null 表示隐藏答案（画一个空心占位符）
  midis?: number[] // 和弦/多音
  chord?: boolean
  rhythm?: Tok[]
  width?: number
  height?: number
}

// 把节奏 token 转成 VexFlow StaveNote
function tokNotes(tok: Tok, midi: number): StaveNote[] {
  const key = keyOf(midi)
  const mk = (dur: string, rest = false) => {
    const n = new StaveNote({ keys: rest ? ['b/4'] : [key], duration: dur })
    if (rest) n.setStyle({ fillStyle: '#33415C', strokeStyle: '#33415C' })
    return n
  }
  switch (tok) {
    case 'q': return [mk('q')]
    case 'h': return [mk('h')]
    case 'r': return [mk('qr', true)]
    case 'ee': return [mk('8'), mk('8')]
    case 'eeee': return [mk('16'), mk('16'), mk('16'), mk('16')]
    case 'q.': {
      const n = mk('qd')
      Dot.buildAndAttach([n], { all: true })
      return [n]
    }
  }
}

export default function Staff({ clef = 'treble', midi = null, midis, chord = false, rhythm, width = 320, height = 120 }: Props) {
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
      const stave = new Stave(8, 12, width - 16)
      stave.addClef(clef)
      stave.setContext(ctx).draw()

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
        voice.draw(ctx, stave)
        try {
          const beams = Beam.generateBeams(notes)
          beams.forEach(b => b.setContext(ctx).draw())
        } catch {
          // 附点/休止混合时无法自动连梁，忽略
        }
      }
    } catch (e) {
      // 渲染失败时保底显示空白谱，并把错误打到控制台便于定位
      console.warn('Staff render failed:', e)
    }
    }
  }, [clef, midi, midis, chord, rhythm, width, height])

  return <div ref={ref} className="staffWrap" />
}
