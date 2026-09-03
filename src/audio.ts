// 缪斯 Muse · 音频引擎（Tone.js 采样钢琴 + 三音色乐器）
import * as Tone from 'tone'
import type { InstId, Tok } from './theory'
import { TOK_BEATS } from './theory'

const PIANO_URLS: Record<string, string> = {
  A0: 'A0.mp3', C1: 'C1.mp3', 'D#1': 'Ds1.mp3', 'F#1': 'Fs1.mp3',
  A1: 'A1.mp3', C2: 'C2.mp3', 'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3',
  A2: 'A2.mp3', C3: 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3',
  A3: 'A3.mp3', C4: 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3',
  A4: 'A4.mp3', C5: 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3',
  A5: 'A5.mp3', C6: 'C6.mp3', 'D#6': 'Ds6.mp3', 'F#6': 'Fs6.mp3',
  A6: 'A6.mp3', C7: 'C7.mp3', 'D#7': 'Ds7.mp3', 'F#7': 'Fs7.mp3',
  A7: 'A7.mp3', C8: 'C8.mp3',
}
// 采样文件托管在站点自己的域名下（public/audio/），不再依赖 github.io——国内网络直连 GitHub 经常被掐断，
// 这就是安卓/部分苹果手机做题没声音的根源。采样清单按音色库真实存在的文件整理（原清单里小提琴 B4/D5/F5、
// 小号 F#4/A4/C5/E5 在源头就是 404，已剔除并补上真实存在的更密采样，音色过渡更自然）。
const PIANO_BASE = '/audio/salamander/'

const INST_URLS: Record<Exclude<InstId, 'piano'>, { base: string; urls: Record<string, string> }> = {
  violin: {
    base: '/audio/violin/',
    urls: { G3: 'G3.mp3', A3: 'A3.mp3', C4: 'C4.mp3', E4: 'E4.mp3', G4: 'G4.mp3', A4: 'A4.mp3', C5: 'C5.mp3', E5: 'E5.mp3', G5: 'G5.mp3', A5: 'A5.mp3', C6: 'C6.mp3', E6: 'E6.mp3', G6: 'G6.mp3' },
  },
  flute: {
    base: '/audio/flute/',
    urls: { C4: 'C4.mp3', E4: 'E4.mp3', A4: 'A4.mp3', C5: 'C5.mp3', E5: 'E5.mp3', A5: 'A5.mp3', C6: 'C6.mp3' },
  },
  trumpet: {
    base: '/audio/trumpet/',
    urls: { A3: 'A3.mp3', C4: 'C4.mp3', 'D#4': 'Ds4.mp3', G4: 'G4.mp3', D5: 'D5.mp3', F5: 'F5.mp3', A5: 'A5.mp3', C6: 'C6.mp3' },
  },
}

let piano: Tone.Sampler | null = null
let ready: Promise<void> | null = null
const instSamplers: Partial<Record<InstId, Tone.Sampler>> = {}
let instReady: Promise<void> | null = null

const midiToName = (m: number) => Tone.Frequency(m, 'midi').toNote()

// 采样未加载完成时静默跳过，不让整段逻辑崩掉
function safeTrigger(s: Tone.Sampler, note: string, dur: number | string, t?: number, vel = 0.9) {
  try {
    s.triggerAttackRelease(note, dur, t, vel)
  } catch {
    // ignore
  }
}

// 移动端音频解锁：iOS Safari 来电/切后台后 AudioContext 会掉进 interrupted/suspended，
// 安卓部分 WebView 也要求在手势里恢复。挂一次全局监听，任何触摸/点击/回前台都把上下文拉回 running。
let unlockInstalled = false
export function installAudioUnlock(): void {
  if (unlockInstalled) return
  unlockInstalled = true
  const resume = () => {
    if (Tone.getContext().state !== 'running') void Tone.start().catch(() => undefined)
  }
  for (const ev of ['pointerdown', 'touchstart', 'keydown']) {
    window.addEventListener(ev, resume, { passive: true })
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) resume()
  })
}

export async function ensureAudio(): Promise<void> {
  if (Tone.getContext().state !== 'running') await Tone.start()
  if (!ready) {
    piano = new Tone.Sampler({ urls: PIANO_URLS, baseUrl: PIANO_BASE, release: 1.5 }).toDestination()
    ready = Promise.race([
      Tone.loaded().then(() => undefined),
      new Promise<void>(res => setTimeout(res, 5000)),
    ])
  }
  await ready
}

export function playNote(midi: number, dur = 0.9, vel = 0.9) {
  if (piano) safeTrigger(piano, midiToName(midi), dur, undefined, vel)
}

export function playMelody(notes: number[], gap = 0.45, dur = 0.85, vels?: number[]) {
  if (!piano) return
  const now = Tone.now()
  notes.forEach((n, i) => safeTrigger(piano!, midiToName(n), dur, now + i * (dur + gap), vels?.[i] ?? 0.9))
}

export function playHarmonic(notes: number[], dur = 1.6) {
  if (!piano) return
  const now = Tone.now()
  notes.forEach(n => safeTrigger(piano!, midiToName(n), dur, now, 0.8))
}

// 补全音组题：序列里的 null 是空拍（停顿一拍），让「缺了一个音」能被听出来
export function playFill(seq: (number | null)[], gap = 0.45, dur = 0.85) {
  if (!piano) return
  const now = Tone.now()
  seq.forEach((n, i) => {
    if (n !== null) safeTrigger(piano!, midiToName(n), dur, now + i * (dur + gap), 0.9)
  })
}

// 两个音：各自的时值 / 力度可不同（长短、强弱比较题用）
export function playTwo(a: number, b: number, opt: { da?: number; db?: number; va?: number; vb?: number; gap?: number } = {}) {
  if (!piano) return
  const { da = 0.7, db = 0.7, va = 0.9, vb = 0.9, gap = 0.5 } = opt
  const now = Tone.now()
  safeTrigger(piano, midiToName(a), da, now, va)
  safeTrigger(piano, midiToName(b), db, now + da + gap, vb)
}

export function playRhythm(tokens: Tok[], bpm = 72, accentBeats?: number) {
  if (!piano) return
  const beat = 60 / bpm
  const now = Tone.now()
  let t = 0
  let beatsPassed = 0
  const midi = 72
  for (const tok of tokens) {
    const b = TOK_BEATS[tok]
    const accented = accentBeats ? beatsPassed % accentBeats === 0 : false
    if (tok !== 'r') {
      const vel = accentBeats ? (accented ? 1.0 : 0.55) : 0.9
      if (tok === 'ee') {
        safeTrigger(piano, midiToName(midi), beat * 0.4, now + t, vel)
        safeTrigger(piano, midiToName(midi), beat * 0.4, now + t + beat * 0.5, vel * 0.9)
      } else if (tok === 'eeee') {
        for (let i = 0; i < 4; i++) safeTrigger(piano, midiToName(midi), beat * 0.2, now + t + beat * 0.25 * i, vel * (i === 0 ? 1 : 0.85))
      } else if (tok === 'e8') {
        safeTrigger(piano, midiToName(midi), beat * 0.4, now + t, vel)
      } else if (tok === 'e8.') {
        safeTrigger(piano, midiToName(midi), beat * 0.65, now + t, vel)
      } else if (tok === 'e16') {
        safeTrigger(piano, midiToName(midi), beat * 0.18, now + t, vel)
      } else {
        safeTrigger(piano, midiToName(midi), beat * Math.min(b, 2) * 0.9, now + t, vel)
      }
    }
    t += beat * b
    beatsPassed += b
  }
}

export function playScaleNotes(notes: number[]) {
  playMelody(notes, 0.05, 0.5)
}

export async function initInstruments(): Promise<void> {
  if (Tone.getContext().state !== 'running') await Tone.start()
  if (!instReady) {
    instReady = (async () => {
      await ensureAudio()
      const entries = Object.entries(INST_URLS) as [Exclude<InstId, 'piano'>, { base: string; urls: Record<string, string> }][]
      for (const [id, cfg] of entries) {
        if (!instSamplers[id]) {
          instSamplers[id] = new Tone.Sampler({ urls: cfg.urls, baseUrl: cfg.base, release: 1.2 }).toDestination()
        }
      }
      await Promise.race([
        Tone.loaded().then(() => undefined),
        new Promise<void>(res => setTimeout(res, 5000)),
      ])
    })()
  }
  await instReady
}

export function playInstrumentMelody(inst: InstId, notes: number[]) {
  const s = inst === 'piano' ? piano : instSamplers[inst]
  if (!s) return
  const now = Tone.now()
  notes.forEach((n, i) => safeTrigger(s, midiToName(n), 0.6, now + i * 0.68, 0.9))
}
