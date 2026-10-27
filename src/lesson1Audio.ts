// 第1课专用音频调度：单一播放序列、可取消；仅使用真实钢琴与长笛的本地采样。
import * as Tone from 'tone'
import type { L1Timbre } from './lesson1Data'

let feltPiano: Tone.Sampler | null = null
let flute: Tone.Sampler | null = null
let ready: Promise<void> | null = null
let playbackVersion = 0
let activeCancel: (() => void) | null = null

function disposeInstruments() {
  feltPiano?.dispose()
  flute?.dispose()
  feltPiano = null
  flute = null
}

// 课程开始与示范播放已经通过用户操作解锁这个音频环境。
// 麦克风音高分析复用它，避免在 getUserMedia 的异步授权之后新建一个可能被手机浏览器暂停的 AudioContext。
export function getLesson1AudioContext(): AudioContext {
  return Tone.getContext().rawContext as AudioContext
}

export async function prepareLesson1Audio(): Promise<void> {
  if (Tone.getContext().state !== 'running') await Tone.start()
  if (!ready) {
    ready = (async () => {
      const filter = new Tone.Filter(1900, 'lowpass')
      const volume = new Tone.Volume(-3)
      feltPiano = new Tone.Sampler({
        urls: { C4: 'C4.mp3' },
        baseUrl: '/audio/salamander/',
        release: 0.8,
      })
      feltPiano.chain(filter, volume, Tone.getDestination())

      // 复用项目已有的长笛实录音色；D4 由相邻的真实采样自动映射，不使用电子合成器。
      flute = new Tone.Sampler({
        urls: { C4: 'C4.mp3', E4: 'E4.mp3', A4: 'A4.mp3' },
        baseUrl: '/audio/flute/',
        release: 0.8,
      })
      const fluteVolume = new Tone.Volume(-4)
      flute.connect(fluteVolume)
      fluteVolume.toDestination()

      let timeout: ReturnType<typeof setTimeout> | null = null
      try {
        await Promise.race([
          Tone.loaded().then(() => undefined),
          new Promise<never>((_, reject) => {
            timeout = setTimeout(() => reject(new Error('音频加载超时')), 8000)
          }),
        ])
      } finally {
        if (timeout) clearTimeout(timeout)
      }
    })().catch(error => {
      ready = null
      disposeInstruments()
      throw error
    })
  }
  await ready
}

function trigger(midi: number, duration: number, timbre: L1Timbre) {
  const note = Tone.Frequency(midi, 'midi').toNote()
  if (timbre === 'flute') {
    if (!flute) throw new Error('长笛音色尚未加载')
    flute.triggerAttackRelease(note, duration, undefined, 0.68)
  } else {
    if (!feltPiano) throw new Error('钢琴音色尚未加载')
    feltPiano.triggerAttackRelease(note, duration, undefined, 0.72)
  }
}

export function stopLesson1Audio(): void {
  playbackVersion += 1
  const cancel = activeCancel
  activeCancel = null
  cancel?.()
  try { feltPiano?.releaseAll() } catch { /* 已释放 */ }
  try { flute?.releaseAll() } catch { /* 已释放 */ }
}

interface SequenceOptions {
  timbre?: L1Timbre
  noteMs?: number
  gapMs?: number
  onNote?: (index: number) => void
}

/**
 * 播放一个可取消序列。resolve(true)=完整播完；resolve(false)=被新播放、离开或后台取消。
 * 第1课不涉及原曲节奏，使用毫秒调度即可保证 500—650ms 音长与静音间隔。
 */
export function playLesson1Sequence(notes: number[], options: SequenceOptions = {}): Promise<boolean> {
  stopLesson1Audio()
  const version = playbackVersion
  const timbre = options.timbre ?? 'felt_piano'
  const noteMs = options.noteMs ?? 600
  const gapMs = options.gapMs ?? 300

  return prepareLesson1Audio().then(() => {
    if (version !== playbackVersion) return false
    return new Promise<boolean>((resolve, reject) => {
      let settled = false
      const timers: ReturnType<typeof setTimeout>[] = []
      const finish = (completed: boolean, error?: unknown) => {
        if (settled) return
        settled = true
        timers.forEach(clearTimeout)
        if (activeCancel === cancel) activeCancel = null
        if (error) reject(error)
        else resolve(completed)
      }
      const cancel = () => finish(false)
      activeCancel = cancel

      notes.forEach((midi, index) => {
        const at = index * (noteMs + gapMs)
        timers.push(setTimeout(() => {
          if (settled || version !== playbackVersion) return
          try {
            trigger(midi, noteMs / 1000, timbre)
            options.onNote?.(index)
          } catch (error) {
            finish(false, error)
          }
        }, at))
      })
      const total = notes.length * noteMs + Math.max(0, notes.length - 1) * gapMs
      timers.push(setTimeout(() => finish(true), total + 40))
    })
  }).catch(error => {
    if (version !== playbackVersion) return false
    throw error
  })
}
