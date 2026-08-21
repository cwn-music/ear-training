import { useState } from "react";
import { initAudio, playInterval, playNote } from "./audio";
import { LEVELS, type Level } from "./lessons";
import { generateSession, type AnyQuestion } from "./theory";
import Staff from "./Staff";
import "./App.css";

interface Progress {
  unlocked: number;
  best: Record<number, number>;
}

function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem("progress");
    if (raw) return JSON.parse(raw);
  } catch {
    /* 忽略损坏的数据 */
  }
  return { unlocked: 1, best: {} };
}

function loadWrongStats(): Record<string, number> {
  try {
    const raw = localStorage.getItem("wrongStats");
    if (raw) return JSON.parse(raw);
  } catch {
    /* 忽略损坏的数据 */
  }
  return {};
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function updateStreak(): number {
  const today = todayStr();
  const last = localStorage.getItem("lastDate");
  let streak = Number(localStorage.getItem("streak") ?? "0");
  if (last === today) return streak;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  streak = last === yesterday ? streak + 1 : 1;
  localStorage.setItem("lastDate", today);
  localStorage.setItem("streak", String(streak));
  return streak;
}

export default function App() {
  const [phase, setPhase] = useState<"map" | "playing" | "done">("map");
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [streak, setStreak] = useState(() =>
    Number(localStorage.getItem("streak") ?? "0")
  );
  const [level, setLevel] = useState<Level>(LEVELS[0]);
  const [questions, setQuestions] = useState<AnyQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [lastPct, setLastPct] = useState(0);

  async function start(lv: Level) {
    await initAudio();
    setStreak(updateStreak());
    const qs = generateSession(lv, loadWrongStats());
    setLevel(lv);
    setQuestions(qs);
    setIndex(0);
    setScore(0);
    setPicked(null);
    setPhase("playing");
    const first = qs[0];
    if (first.kind === "interval") playInterval(first.midi1, first.midi2);
  }

  function replay(q: AnyQuestion) {
    if (q.kind === "interval") playInterval(q.midi1, q.midi2);
    else playNote(q.midi);
  }

  function recordWrong(q: AnyQuestion) {
    const stats = loadWrongStats();
    stats[q.wrongKey] = (stats[q.wrongKey] ?? 0) + 1;
    localStorage.setItem("wrongStats", JSON.stringify(stats));
  }

  function answer(opt: string) {
    if (picked) return;
    setPicked(opt);
    const q = questions[index];
    const correct = opt === q.answer;
    if (!correct) recordWrong(q);
    const finalScore = score + (correct ? 1 : 0);
    if (correct) setScore(finalScore);
    setTimeout(() => {
      const ni = index + 1;
      if (ni >= questions.length) {
        const pct = Math.round((finalScore / questions.length) * 100);
        setLastPct(pct);
        const p: Progress = {
          unlocked: progress.unlocked,
          best: { ...progress.best },
        };
        p.best[level.id] = Math.max(p.best[level.id] ?? 0, pct);
        if (pct >= 80 && level.id === p.unlocked && p.unlocked < LEVELS.length) {
          p.unlocked += 1;
        }
        setProgress(p);
        localStorage.setItem("progress", JSON.stringify(p));
        setPhase("done");
      } else {
        setIndex(ni);
        setPicked(null);
        const nq = questions[ni];
        if (nq.kind === "interval") playInterval(nq.midi1, nq.midi2);
      }
    }, 1200);
  }

  // ---------- 课程地图 ----------
  if (phase === "map") {
    return (
      <div className="page">
        <header className="topbar">
          <div className="logo">练耳鸭</div>
          <div className="streak">🔥 连续练习 {streak} 天</div>
        </header>
        <p className="hint">每课 10 题，正确率 ≥80% 解锁下一课</p>
        <div className="levelList">
          {LEVELS.map((lv) => {
            const locked = lv.id > progress.unlocked;
            const best = progress.best[lv.id];
            const passed = (best ?? 0) >= 80;
            const current = lv.id === progress.unlocked && !passed;
            return (
              <button
                key={lv.id}
                className={
                  "levelCard" +
                  (locked ? " locked" : "") +
                  (passed ? " passed" : "") +
                  (current ? " current" : "")
                }
                disabled={locked}
                onClick={() => start(lv)}
              >
                <span className="lvBadge">
                  {locked ? "🔒" : passed ? "✓" : lv.id}
                </span>
                <span className="lvText">
                  <span className="lvTitle">
                    第 {lv.id} 课 · {lv.title}
                    {lv.review ? " ★" : ""}
                  </span>
                  <span className="lvDesc">{lv.desc}</span>
                </span>
                {best !== undefined && !locked && (
                  <span className="lvBest">{best}%</span>
                )}
              </button>
            );
          })}
        </div>
        <p className="hint small">做错的内容会自动多出现 · 带 ★ 的是复习课</p>
      </div>
    );
  }

  // ---------- 结算页 ----------
  if (phase === "done") {
    const passed = lastPct >= 80;
    return (
      <div className="page center">
        <div className="doneEmoji">{passed ? "🎉" : "💪"}</div>
        <h1 className="big">{lastPct}%</h1>
        <p className="meta">
          {passed
            ? level.id === LEVELS.length
              ? "恭喜！你完成了全部课程！"
              : "达标！下一课已解锁"
            : "差一点点，再练一组就能解锁"}
        </p>
        <button className="btn" onClick={() => start(level)}>
          再来一组
        </button>
        <button className="btn ghost" onClick={() => setPhase("map")}>
          返回课程
        </button>
      </div>
    );
  }

  // ---------- 练习页 ----------
  const q = questions[index];
  return (
    <div className="page">
      <div className="sessionTop">
        <button className="closeBtn" onClick={() => setPhase("map")}>
          ✕
        </button>
        <div className="track">
          <div
            className="fill"
            style={{ width: `${(index / questions.length) * 100}%` }}
          />
        </div>
        <span className="counter">
          {index + 1}/{questions.length}
        </span>
      </div>

      <p className="qTitle">
        {q.kind === "note" ? "这个音唱什么？" : "这两个音是什么音程？"}
      </p>

      {q.kind === "note" && <Staff midi={q.midi} clef={q.clef} />}

      <button className="replay" onClick={() => replay(q)}>
        {q.kind === "note" ? "🔊 听一听" : "🔊 再听一遍"}
      </button>

      <div className="options">
        {q.options.map((opt) => {
          let cls = "opt";
          if (picked) {
            if (opt === q.answer) cls += " correct";
            else if (opt === picked) cls += " wrong";
          }
          return (
            <button key={opt} className={cls} onClick={() => answer(opt)}>
              {opt}
            </button>
          );
        })}
      </div>

      {picked && (
        <p className={"feedback " + (picked === q.answer ? "ok" : "no")}>
          {picked === q.answer ? "答对了！" : `正确答案：${q.answer}`}
        </p>
      )}
    </div>
  );
}