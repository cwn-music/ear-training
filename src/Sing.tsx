import { useEffect, useRef, useState } from "react";
import { PitchDetector } from "pitchy";
import { midiToSolfege } from "./theory";

// 用于显示"你唱的是"的音名（含升降）
const PITCH_NAMES = [
  "Do", "Do#", "Re", "Re#", "Mi", "Fa",
  "Fa#", "Sol", "Sol#", "La", "La#", "Si",
];

function freqToMidi(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440);
}

type State = "idle" | "listening" | "ok" | "no" | "error";

export default function SingTask({
  midi,
  onDone,
}: {
  midi: number;
  onDone: (ok: boolean) => void;
}) {
  const [state, setState] = useState<State>("idle");
  const [heard, setHeard] = useState<string>("—");
  const stopRef = useRef<() => void>(() => {});
  const doneRef = useRef(false);

  // 组件卸载时务必释放麦克风
  useEffect(() => {
    return () => stopRef.current();
  }, []);

  async function start() {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setState("error");
      return;
    }
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    const detector = PitchDetector.forFloat32Array(analyser.fftSize);
    const buf = new Float32Array(analyser.fftSize);

    let raf = 0;
    let stopped = false;
    stopRef.current = () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream.getTracks().forEach((t) => t.stop());
      ctx.close().catch(() => {});
    };

    setState("listening");
    let matchFrames = 0;
    const startedAt = performance.now();

    const finish = (ok: boolean) => {
      if (doneRef.current) return;
      doneRef.current = true;
      stopRef.current();
      setState(ok ? "ok" : "no");
      setTimeout(() => onDone(ok), 1400);
    };

    const tick = () => {
      if (stopped || doneRef.current) return;
      analyser.getFloatTimeDomainData(buf);
      const [freq, clarity] = detector.findPitch(buf, ctx.sampleRate);
      if (freq && clarity > 0.9) {
        const m = freqToMidi(freq);
        // 与目标音的"最近八度"半音差，范围 [-6, 6)
        const diff = ((((m - midi) % 12) + 18) % 12) - 6;
        setHeard(PITCH_NAMES[((Math.round(m) % 12) + 12) % 12]);
        // 偏差半音以内算命中（允许跨八度，对男女声都友好）
        if (Math.abs(diff) < 0.5) {
          matchFrames++;
        } else {
          matchFrames = 0;
        }
        if (matchFrames >= 12) {
          finish(true);
          return;
        }
      } else {
        matchFrames = 0;
      }
      if (performance.now() - startedAt > 8000) {
        finish(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  if (state === "error") {
    return (
      <div className="singBox">
        <p className="learnText">
          无法使用麦克风。请检查浏览器的麦克风权限（地址栏左侧的小锁图标里可以开启）。
        </p>
        <button className="micBtn" onClick={() => onDone(false)}>
          跳过本题
        </button>
      </div>
    );
  }

  return (
    <div className="singBox">
      {state === "idle" && (
        <button className="micBtn" onClick={start}>
          🎤 开始唱
        </button>
      )}
      {state === "listening" && (
        <div className="hearBox">
          🎧 正在听……你唱的是 <b>{heard}</b>
          <div className="hearHint">保持住这个音，唱准约 1 秒即通过</div>
        </div>
      )}
      {state === "ok" && <p className="feedback ok">唱准了！🎉</p>}
      {state === "no" && (
        <p className="feedback no">
          时间到～正确音高是 {midiToSolfege(midi)}，多听几遍范唱再试试
        </p>
      )}
    </div>
  );
}