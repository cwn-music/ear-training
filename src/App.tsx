import { useState } from "react";
import { initAudio, playInterval, playNote } from "./audio";
import { generateQuestion, generateNoteQuestion } from "./theory";
import type { Question, NoteQuestion } from "./theory";
import Staff from "./Staff";
import "./App.css";

const TOTAL = 10; // 每组 10 题

type Mode = "interval" | "note";

// 连胜逻辑：今天第一次练习时更新；昨天练过则 +1，否则归零重计
function updateStreak(): number {
  const today = new Date().toDateString();
  const last = localStorage.getItem("lastDate");
  let streak = Number(localStorage.getItem("streak") ?? "0");
  if (last !== today) {
    const yesterday = new Date(Date.now() - 864e5).toDateString();
    streak = last === yesterday ? streak + 1 : 1;
    localStorage.setItem("streak", String(streak));
    localStorage.setItem("lastDate", today);
  }
  return streak;
}

function loadWrongStats(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem("wrongStats") ?? "{}");
  } catch {
    return {};
  }
}

export default function App() {
  const [phase, setPhase] = useState<"start" | "playing" | "done">("start");
  const [mode, setMode] = useState<Mode>("interval");
  const [q, setQ] = useState<Question | null>(null); // 练耳题
  const [nq, setNq] = useState<NoteQuestion | null>(null); // 识谱题
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [wrongStats, setWrongStats] = useState<Record<string, number>>(
    loadWrongStats
  );
  const [streak, setStreak] = useState(() =>
    Number(localStorage.getItem("streak") ?? "0")
  );

  function nextQuestion(stats: Record<string, number>, m: Mode) {
    setPicked(null);
    if (m === "interval") {
      const question = generateQuestion(3, stats); // 先解锁前 5 个音程
      setQ(question);
      playInterval(question.root, question.root + question.answer.semitones);
    } else {
      setNq(generateNoteQuestion(stats)); // 识谱题不出声
    }
  }

  async function start(m: Mode) {
    await initAudio();
    setMode(m);
    setStreak(updateStreak());
    setIndex(0);
    setScore(0);
    setPhase("playing");
    nextQuestion(wrongStats, m);
  }

  function answer(name: string) {
    if (picked) return;
    const correctName = mode === "interval" ? q?.answer.name : nq?.answer;
    if (!correctName) return;
    setPicked(name);
    let stats = wrongStats;
    if (name === correctName) {
      setScore((s) => s + 10);
    } else {
      stats = { ...wrongStats, [correctName]: (wrongStats[correctName] ?? 0) + 1 };
      setWrongStats(stats);
      localStorage.setItem("wrongStats", JSON.stringify(stats));
    }
    setTimeout(() => {
      if (index + 1 >= TOTAL) {
        setPhase("done");
      } else {
        setIndex((i) => i + 1);
        nextQuestion(stats, mode);
      }
    }, 1200);
  }

  // ---------- 页面 ----------

  if (phase === "start") {
    return (
      <div className="page">
        <div className="logo">练耳鸭</div>
        <div className="meta">🔥 连续练习 {streak} 天</div>
        <button className="btn" onClick={() => start("interval")}>
          🎧 练耳 · 音程听辨
        </button>
        <button className="btn" onClick={() => start("note")}>
          🎼 识谱 · 看谱认音
        </button>
        <div className="meta">每组 10 题 · 错的内容会自动多出现</div>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="page">
        <div className="logo">🎉</div>
        <div className="big">本组得分 {score}</div>
        <div className="meta">
          答对 {score / 10} / {TOTAL} 题 · 🔥 连续 {streak} 天
        </div>
        <button className="btn" onClick={() => start(mode)}>再来一组</button>
        <button className="replay" onClick={() => setPhase("start")}>
          换个玩法
        </button>
      </div>
    );
  }

  const isInterval = mode === "interval";
  const options = isInterval ? q?.options.map((o) => o.name) : nq?.options;
  const answerName = isInterval ? q?.answer.name : nq?.answer;

  return (
    <div className="page">
      <div className="meta">
        第 {index + 1} / {TOTAL} 题 · XP {score}
      </div>
      {isInterval ? (
        <>
          <div className="big">🎧 这是什么音程？</div>
          <button
            className="replay"
            onClick={() =>
              q && playInterval(q.root, q.root + q.answer.semitones)
            }
          >
            🔁 再听一遍
          </button>
        </>
      ) : (
        <>
          <div className="big">🎼 这个音唱什么？</div>
          {nq && <Staff midi={nq.midi} />}
          <button className="replay" onClick={() => nq && playNote(nq.midi)}>
            🔊 听一听
          </button>
        </>
      )}
      <div className="options">
        {options?.map((name) => {
          let cls = "opt";
          if (picked) {
            if (name === answerName) cls += " correct";
            else if (name === picked) cls += " wrong";
          }
          return (
            <button key={name} className={cls} onClick={() => answer(name)}>
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
}