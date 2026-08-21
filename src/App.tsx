import { useState } from "react";
import { initAudio, playInterval } from "./audio";
import { generateQuestion } from "./theory";
import type { Question } from "./theory";
import "./App.css";

const TOTAL = 10; // 每组 10 题

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
  const [q, setQ] = useState<Question | null>(null);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [wrongStats, setWrongStats] = useState<Record<string, number>>(
    loadWrongStats
  );
  const [streak, setStreak] = useState(() =>
    Number(localStorage.getItem("streak") ?? "0")
  );

  function playCurrent(question: Question) {
    playInterval(question.root, question.root + question.answer.semitones);
  }

  function nextQuestion(stats: Record<string, number>) {
    const question = generateQuestion(3, stats); // 先解锁前 5 个音程
    setQ(question);
    setPicked(null);
    playCurrent(question);
  }

  async function start() {
    await initAudio();
    setStreak(updateStreak());
    setIndex(0);
    setScore(0);
    setPhase("playing");
    nextQuestion(wrongStats);
  }

  function answer(name: string) {
    if (!q || picked) return;
    setPicked(name);
    let stats = wrongStats;
    if (name === q.answer.name) {
      setScore((s) => s + 10);
    } else {
      stats = { ...wrongStats, [q.answer.name]: (wrongStats[q.answer.name] ?? 0) + 1 };
      setWrongStats(stats);
      localStorage.setItem("wrongStats", JSON.stringify(stats));
    }
    setTimeout(() => {
      if (index + 1 >= TOTAL) {
        setPhase("done");
      } else {
        setIndex((i) => i + 1);
        nextQuestion(stats);
      }
    }, 1200);
  }

  // ---------- 页面 ----------

  if (phase === "start") {
    return (
      <div className="page">
        <div className="logo">练耳鸭</div>
        <div className="meta">🔥 连续练习 {streak} 天</div>
        <button className="btn" onClick={start}>开始练习</button>
        <div className="meta">每天 10 题，听两个音，选出音程</div>
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
        <button className="btn" onClick={start}>再来一组</button>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="meta">
        第 {index + 1} / {TOTAL} 题 · XP {score}
      </div>
      <div className="big">🎧 这是什么音程？</div>
      <button className="replay" onClick={() => q && playCurrent(q)}>
        🔁 再听一遍
      </button>
      <div className="options">
        {q?.options.map((iv) => {
          let cls = "opt";
          if (picked) {
            if (iv.name === q.answer.name) cls += " correct";
            else if (iv.name === picked) cls += " wrong";
          }
          return (
            <button key={iv.name} className={cls} onClick={() => answer(iv.name)}>
              {iv.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}