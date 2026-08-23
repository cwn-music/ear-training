// 缪斯 Muse · 五线谱渲染（VexFlow v5）
import { useEffect, useRef } from 'react'
import { Accidental, Beam, Dot, Formatter, Renderer, Stave, StaveNote, Voice } from 'vexflow'
import type { Clef, Tok } from './theory'
import { TOK_BEATS } from './theory'

const LETTERS = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b']
const keyOf = (midi: number) => LETTERS[midi % 12] + '/' + (Math.floor(midi / 12) - 1)
const hasSharp = (midi: number) => LETTERS[midi % 12].includes('#')

interface Props {
  clef?: Clef
  midi?: number | null
  midis?: number[] | null
  chord?: number[]
  rhythm?: Tok[]
  width?: number
  height?: number
}

export default function Staff({ clef = 'treble', midi = null, midis, chord, rhythm, width = 320, height = 120 }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const deps = JSON.stringify({ clef, midi, midis, chord, rhythm })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.innerHTML = ''
    try {
      const renderer = new Renderer(el, Renderer.Backends.SVG)
      renderer.resize(width, height)
      const ctx = renderer.getContext()
      const stave = new Stave(8, 10, width - 16)
      stave.addClef(clef)
      stave.setContext(ctx).draw()

      const notes: StaveNote[] = []
      const red = midis === null && midi !== null

      if (chord && chord.length > 0) {
        const n = new StaveNote({ keys: chord.map(keyOf), duration: 'q', clef })
        chord.forEach((m, i) => {
          if (hasSharp(m)) n.addModifier(new Accidental('#'), i)
        })
        notes.push(n)
      } else if (rhythm && rhythm.length > 0) {
        for (const tok of rhythm) {
          if (tok === 'r') {
            notes.push(new StaveNote({ keys: ['b/4'], duration: 'qr', clef }))
            continue
          }
          const durs = tok === 'ee' ? ['8', '8'] : tok === 'eeee' ? ['16', '16', '16', '16'] : [tok === 'h' ? '2' : 'q']
          for (const d of durs) {
            const n = new StaveNote({ keys: ['b/4'], duration: d, clef })
            if (tok === 'q.') Dot.buildAndAttach([n], { all: true })
            notes.push(n)
          }
        }
      } else {
        const list = midis ?? (midi !== null ? [midi] : [])
        for (const m of list) {
          const n = new StaveNote({ keys: [keyOf(m)], duration: 'q', clef })
          if (hasSharp(m)) n.addModifier(new Accidental('#'), 0)
          if (red) n.setStyle({ fillStyle: '#b23b2e', strokeStyle: '#b23b2e' })
          notes.push(n)
        }
      }

      if (notes.length > 0) {
        const beats = rhythm && rhythm.length > 0 ? Math.max(1, Math.round(rhythm.reduce((s, t) => s + TOK_BEATS[t], 0))) : Math.max(1, notes.length)
        const voice = new Voice({ numBeats: beats, beatValue: 4 })
        voice.setStrict(false)
        voice.addTickables(notes)
        let beams: Beam[] = []
        try {
          beams = Beam.generateBeams(notes)
        } catch {
          beams = []
        }
        new Formatter().joinVoices([voice]).formatToStave([voice], stave)
        voice.setContext(ctx).draw()
        beams.forEach(b => b.setContext(ctx).draw())
      }
    } catch {
      // 渲染失败时保持空白，不影响做题流程
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps, width, height, clef])

  return <div ref={ref} className="staff" style={{ width, height }} />
}