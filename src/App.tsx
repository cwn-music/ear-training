import { useState } from "react";
import { initAudio, playInterval, playNote } from "./audio";
import { LEVELS, type Level } from "./lessons";
import {
  generateSession,
  generatePlacement,
  type AnyQuestion,
} from "./theory";
import Staff from "./Staff";
import Learn from "./Learn";
import SingTask from "./Sing";
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
  return { unlocked: 0, best: {} };
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

// 程度测试结果 -> 建议起始课
function suggestLevel(score: number, total: number): { tier: string; startId: number } {
  const pct = score / total;
  if (pct <= 0.33) return { tier: "零基础", startId: 0 };
  if (pct <= 0.58) return { tier: "有一点基础", startId: 3 };
  if (pct <= 0.83) return { tier: "较多基础", startId: 6 };
  return { tier: "专业水平", startId: 10 };
}

const Q_TITLES: Record<string, string> = {
  note: "这个音唱什么？",
  interval: "这两个音是什么音程？",
  pitch: "第二个音比第一个音……",
  stepleap: "这两个音是「级进」还是「跳进」？",
  sing: "先听范唱，再唱出这个音",
};

export default function App() {
  const [phase, setPhase] = useState<
    "map" | "learn" | "playing" | "done" | "placementDone"
  >("map");
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [streak, setStreak] = useState(() =>
    Number(localStorage.getItem("streak") ?? "0")
  );
  const [level, setLevel] = useState<Level>(LEVELS[0]);
  const [questions, setQuestions] = useState<AnyQuestion[]>([]);
  const [isPlacement, setIsPlacement] = useState(false);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [lastPct, setLastPct] = useState(0);
  const [placementScore, setPlacementScore] = useState(0);

  // 点课程卡片：初始化音频 -> 进入学习模式
  async function openLevel(lv: Level) {
    await initAudio();
    setLevel(lv);
    setIsPlacement(false);
    setPhase("learn");
  }

  // 开始学习/跳过学习 -> 正式闯关
  function beginQuiz() {
    setStreak(updateStreak());
    startRound(generateSession(level, loadWrongStats()), false);
  }

  // 程度测试
  async function startPlacement() {
    await initAudio();
    startRound(generatePlacement(loadWrongStats()), true);
  }

  function startRound(qs: AnyQuestion[], placement: boolean) {
    setQuestions(qs);
    setIsPlacement(placement);
    setIndex(0);
    setScore(0);
    setPicked(null);
    setPhase("playing");
    autoplay(qs[0]);
  }

  function autoplay(q: AnyQuestion) {
    if (q.kind === "interval" || q.kind === "pitch" || q.kind === "stepleap")
      playInterval(q.midi1, q.midi2);
    else playNote(q.midi);
  }

  function recordWrong(q: AnyQuestion) {
    const stats = loadWrongStats();
    stats[q.wrongKey] = (stats[q.wrongKey] ?? 0) + 1;
    localStorage.setItem("wrongStats", JSON.stringify(stats));
  }

  // 一题结束
  function finish(correct: boolean, q: AnyQuestion, delay = 1200) {
    if (!correct) recordWrong(q);
    const finalScore = score + (correct ? 1 : 0);
    if (correct) setScore(finalScore);
    setTimeout(() => {
      const ni = index + 1;
      if (ni >= questions.length) {
        if (isPlacement) {
          setPlacementScore(finalScore);
          setPhase("placementDone");
          return;
        }
        const pct = Math.round((finalScore / questions.length) * 100);
        setLastPct(pct);
        const p: Progress = {
          unlocked: progress.unlocked,
          best: { ...progress.best },
        };
        p.best[level.id] = Math.max(p.best[level.id] ?? 0, pct);
        if (pct >= 80 && level.id === p.unlocked && p.unlocked < LEVELS.length - 1) {
          p.unlocked += 1;
        }
        setProgress(p);
        localStorage.setItem("progress", JSON.stringify(p));
        setPhase("done");
      } else {
        setIndex(ni);
        setPicked(null);
        autoplay(questions[ni]);
      }
    }, delay);
  }

  function answer(opt: string) {
    if (picked) return;
    setPicked(opt);
    const q = questions[index];
    finish(opt === q.answer, q);
  }

  // 采用程度测试的建议
  function applySuggestion(startId: number) {
    const p: Progress = { unlocked: startId, best: {} };
    for (const lv of LEVELS) {
      if (lv.id < startId) p.best[lv.id] = 100;
    }
    setProgress(p);
    localStorage.setItem("progress", JSON.stringify(p));
    setPhase("map");
  }

  const levelName = (lv: Level) =>
    lv.id === 0 ? "入门课" : `第 ${lv.id} 课`;

  // ---------- 课程地图 ----------
  if (phase === "map") {
    return (
      <div className="page">
        <header className="topbar">
          <div className="logo">练耳鸭</div>
          <div className="streak">🔥 连续练习 {streak} 天</div>
        </header>
        <p className="hint">先学新知识，再闯关：每课 10 题，≥80% 解锁下一课</p>
        <button className="btn ghost mapTest" onClick={startPlacement}>
          📋 不知道自己的水平？先做个 3 分钟程度测试
        </button>
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
                onClick={() => openLevel(lv)}
              >
                <span className="lvBadge">
                  {locked ? "🔒" : passed ? "✓" : lv.id === 0 ? "★" : lv.id}
                </span>
                <span className="lvText">
                  <span className="lvTitle">
                    {levelName(lv)} · {lv.title}
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

  // ---------- 学习模式 ----------
  if (phase === "learn") {
    return (
      <Learn level={level} onStart={beginQuiz} onBack={() => setPhase("map")} />
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
            ? level.id === LEVELS.length - 1
              ? "恭喜！你完成了全部课程！"
              : "达标！下一课已解锁"
            : "差一点点，再练一组就能解锁"}
        </p>
        <button className="btn" onClick={beginQuiz}>
          再来一组
        </button>
        <button className="btn ghost" onClick={() => setPhase("map")}>
          返回课程
        </button>
      </div>
    );
  }

  // ---------- 程度测试结果 ----------
  if (phase === "placementDone") {
    const s = suggestLevel(placementScore, questions.length);
    const startName = s.startId === 0 ? "入门课" : `第 ${s.startId} 课`;
    return (
      <div className="page center">
        <div className="doneEmoji">📋</div>
        <h1 className="big" style={{ fontSize: 40 }}>
          {s.tier}
        </h1>
        <p className="meta">
          测试成绩 {placementScore}/{questions.length}
          <br />
          建议从「{startName}」开始学习，之前的课程将标记为已通过。
        </p>
        <button className="btn" onClick={() => applySuggestion(s.startId)}>
          从{startName}开始
        </button>
        <button className="btn ghost" onClick={() => applySuggestion(0)}>
          从头开始
        </button>
        <button className="btn ghost" onClick={() => setPhase("map")}>
          先看看课程列表
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

      {q.kind === "sing" ? (
        <>
          <p className="qTitle">{Q_TITLES.sing}</p>
          <Staff midi={q.midi} clef={q.clef} />
          <button className="replay" onClick={() => autoplay(q)}>
            🔊 听范唱
          </button>
          <SingTask key={index} midi={q.midi} onDone={(ok) => finish(ok, q, 100)} />
        </>
      ) : (
        <>
          <p className="qTitle">{Q_TITLES[q.kind]}</p>
          {q.kind === "note" && <Staff midi={q.midi} clef={q.clef} />}
          <button className="replay" onClick={() => autoplay(q)}>
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
        </>
      )}
    </div>
  );
}