// 缪斯 Muse · 音频引擎（Tone.js Sampler，懒加载真实乐器采样）
import * as Tone from 'tone'
import type { InstId, Tok } from './theory'
import { TOK_BEATS } from './theory'

let started = false
let piano: Tone.Sampler | null = null
const instSamplers: Partial<Record<InstId, Tone.Sampler>> = {}

const SALAMANDER = 'https://tonejs.github.io/audio/salamander/'
const INST_BASE = 'https://nbrosowsky.github.io/tonejs-instruments/samples/'

const PIANO_URLS: Record<string, string> = {
  C3: 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3', A3: 'A3.mp3',
  C4: 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3', A4: 'A4.mp3',
  C5: 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3', A5: 'A5.mp3',
}
const INST_URLS: Record<Exclude<InstId, 'piano'>, { base: string; urls: Record<string, string> }> = {
  violin: {
    base: INST_BASE + 'violin/',
    urls: { G3: 'G3.mp3', C4: 'C4.mp3', E4: 'E4.mp3', G4: 'G4.mp3', A4: 'A4.mp3', C5: 'C5.mp3', E5: 'E5.mp3' },
  },
  flute: {
    base: INST_BASE + 'flute/',
    urls: { C4: 'C4.mp3', E4: 'E4.mp3', A4: 'A4.mp3', C5: 'C5.mp3', E5: 'E5.mp3', A5: 'A5.mp3', C6: 'C6.mp3' },
  },
  trumpet: {
    base: INST_BASE + 'trumpet/',
    urls: { F3: 'F3.mp3', A3: 'A3.mp3', C4: 'C4.mp3', 'D#4': 'Ds4.mp3', F4: 'F4.mp3', G4: 'G4.mp3', 'A#4': 'As4.mp3', D5: 'D5.mp3', F5: 'F5.mp3', A5: 'A5.mp3', C6: 'C6.mp3' },
  },
}

const noteName = (midi: number) => Tone.Frequency(midi, 'midi').toNote()

function safeTrigger(s: Tone.Sampler, note: string | string[], dur: number, t: number, vel: number) {
  try {
    s.triggerAttackRelease(note, dur, t, vel)
  } catch {
    // 采样未加载完时跳过，不影响做题流程
  }
}

export async function ensureAudio() {
  if (!started) {
    await Tone.start()
    started = true
    piano = new Tone.Sampler({ urls: PIANO_URLS, baseUrl: SALAMANDER }).toDestination()
  }
  // 等采样加载好再播放（最多等 5 秒，超时也照播）
  await Promise.race([Tone.loaded(), new Promise(r => setTimeout(r, 5000))])
}

// 懒加载乐器采样（音色题用）
export async function initInstruments() {
  await ensureAudio()
  for (const id of ['violin', 'flute', 'trumpet'] as const) {
    if (!instSamplers[id]) {
      instSamplers[id] = new Tone.Sampler({ urls: INST_URLS[id].urls, baseUrl: INST_URLS[id].base }).toDestination()
    }
  }
  await Promise.race([Tone.loaded(), new Promise(r => setTimeout(r, 5000))])
}

export function playNote(midi: number, dur = 0.85, vel = 0.9) {
  const p = piano
  if (!p) return
  safeTrigger(p, noteName(midi), dur, Tone.now(), vel)
}

export function playMelody(notes: number[], gap = 0.45, dur = 0.85, vels?: number[]) {
  const p = piano
  if (!p) return
  const t0 = Tone.now() + 0.05
  notes.forEach((m, i) => {
    safeTrigger(p, noteName(m), dur, t0 + i * (dur + gap), vels ? vels[i] : 0.9)
  })
}

export function playHarmonic(a: number, b: number, dur = 1.4) {
  const p = piano
  if (!p) return
  const t = Tone.now()
  safeTrigger(p, [noteName(a), noteName(b)], dur, t, 0.9)
}

// 两个音依次播放：可分别控制时长与力度（长短/强弱/高低比较题用）
export function playTwo(a: number, b: number, opt?: { da?: number; db?: number; va?: number; vb?: number; gap?: number }) {
  const p = piano
  if (!p) return
  const da = opt?.da ?? 0.85
  const db = opt?.db ?? 0.85
  const gap = opt?.gap ?? 0.5
  const t0 = Tone.now() + 0.05
  safeTrigger(p, noteName(a), da, t0, opt?.va ?? 0.9)
  safeTrigger(p, noteName(b), db, t0 + da + gap, opt?.vb ?? 0.9)
}

// 节奏播放：accentBeats 表示每几拍一个重音（拍号题用）
export function playRhythm(tokens: Tok[], bpm = 72, accentBeats?: number) {
  const p = piano
  if (!p) return
  const beatSec = 60 / bpm
  const t0 = Tone.now() + 0.05
  let pos = 0
  let t = t0
  for (const tok of tokens) {
    const beats = TOK_BEATS[tok]
    if (tok === 'r') {
      pos += beats
      t += beats * beatSec
      continue
    }
    const parts = tok === 'ee' ? 2 : tok === 'eeee' ? 4 : 1
    const each = (beats * beatSec) / parts
    for (let i = 0; i < parts; i++) {
      const posHere = pos + (i * beats) / parts
      const isAccent = accentBeats !== undefined && Math.abs(posHere % accentBeats) < 1e-6
      safeTrigger(p, 'C4', Math.max(0.18, each * 0.9), t + i * each, isAccent ? 1 : 0.55)
    }
    pos += beats
    t += beats * beatSec
  }
}

export function rhythmBeats(tokens: Tok[]) {
  return tokens.reduce((s, t) => s + TOK_BEATS[t], 0)
}

export function playScaleNotes(root: number, steps: number[]) {
  playMelody(steps.map(s => root + s), 0.28, 0.55)
}

export function playInstrument(inst: InstId, midi: number, dur = 0.9) {
  const s = instSamplers[inst] ?? piano
  if (!s) return
  safeTrigger(s, noteName(midi), dur, Tone.now(), 0.9)
}

export function playInstrumentMelody(inst: InstId, notes: number[], gap = 0.4, dur = 0.8) {
  const s = instSamplers[inst] ?? piano
  if (!s) return
  const t0 = Tone.now() + 0.05
  notes.forEach((m, i) => {
    safeTrigger(s, noteName(m), dur, t0 + i * (dur + gap), 0.9)
  })
}