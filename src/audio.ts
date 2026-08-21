import * as Tone from "tone";

let piano: Tone.Sampler | null = null;

const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function midiToNote(midi: number): string {
  return NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
}

// 必须在用户点击按钮后调用（浏览器自动播放策略要求）
export async function initAudio(): Promise<void> {
  if (piano) return;
  await Tone.start();
  // Salamander 钢琴音色，从 Tone.js 官方音色库在线加载
  piano = new Tone.Sampler({
    urls: {
      A0: "A0.mp3",
      C1: "C1.mp3",
      "D#1": "Ds1.mp3",
      "F#1": "Fs1.mp3",
      A1: "A1.mp3",
      C2: "C2.mp3",
      "D#2": "Ds2.mp3",
      "F#2": "Fs2.mp3",
      A2: "A2.mp3",
      C3: "C3.mp3",
      "D#3": "Ds3.mp3",
      "F#3": "Fs3.mp3",
      A3: "A3.mp3",
      C4: "C4.mp3",
      "D#4": "Ds4.mp3",
      "F#4": "Fs4.mp3",
      A4: "A4.mp3",
      C5: "C5.mp3",
      "D#5": "Ds5.mp3",
      "F#5": "Fs5.mp3",
      A5: "A5.mp3",
      C6: "C6.mp3",
      "D#6": "Ds6.mp3",
      "F#6": "Fs6.mp3",
      A6: "A6.mp3",
      C7: "C7.mp3",
      "D#7": "Ds7.mp3",
      "F#7": "Fs7.mp3",
      A7: "A7.mp3",
      C8: "C8.mp3",
    },
    baseUrl: "https://tonejs.github.io/audio/salamander/",
  }).toDestination();
  await Tone.loaded(); // 等音色全部加载完再开始
}

// 弹单个音
export function playNote(midi: number): void {
  if (!piano) return;
  piano.triggerAttackRelease(midiToNote(midi), 1.0, Tone.now());
}

// 先后弹两个音：m1 响起，0.9 秒后 m2 响起
export function playInterval(midi1: number, midi2: number): void {
  if (!piano) return;
  const now = Tone.now();
  piano.triggerAttackRelease(midiToNote(midi1), 1.0, now);
  piano.triggerAttackRelease(midiToNote(midi2), 1.4, now + 0.9);
}