import { useState } from "react";
import {
  initAudio,
  initInstruments,
  playInterval,
  playNote,
  playHarmonic,
  playMelody,
  playRhythm,
  playInstrumentMelody,
} from "./audio";
import { LEVELS, UNITS, INSTRUMENTS, type Level } from "./lessons";
import {
  generateSession,
  generatePlacement,
  type AnyQuestion,
} from "./theory";
import Staff from "./Staff";
import MelodyStaff from "./MelodyStaff";
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

function suggestLevel(score: number, total: number): { tier: string; startId: number } {
  const pct = score / total;
  if (pct <= 0.33) return { tier: "零基础", startId: 0 };
  if (pct <= 0.58) return { tier: "有一点基础", startId: 3 };
  if (pct <= 0.83) return { tier: "较多基础", startId: 6 };
  return { tier: "专业水平", startId: 10 };
}

function qTitle(q: AnyQuestion): string {
  switch (q.kind) {
    case "note":
      return "这个音唱什么？";
    case "interval":
      return q.harmonic
        ? "同时响起的两个音是什么音程？"
        : "先后响起的两个音是什么音程？";
    case "pitch":
      return "第二个音比第一个音……";
    case "stepleap":
      return "这两个音是「级进」还是「跳进」？";
    case "melody":
      return "空缺（休止符）的位置是哪个音？";
    case "rhythm":
      return "你听到的是哪一条节奏？";
    case "scale":
      return "这条音阶是大调还是小调？";
    case "timbre":
      return "这段旋律是哪种乐器演奏的？";
    case "sing":
      return "先听范唱，再唱出这个音";
  }
}

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

  async function openLevel(lv: Level) {
    await initAudio();
    if (lv.ear === "timbre") await initInstruments(lv.instruments ?? []);
    setLevel(lv);
    setIsPlacement(false);
    setPhase("learn");
  }

  function beginQuiz() {
    setStreak(updateStreak());
    startRound(generateSession(level, loadWrongStats()), false);
  }

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
    switch (q.kind) {
      case "interval":
        if (q.harmonic) playHarmonic(q.midi1, q.midi2);
        else playInterval(q.midi1, q.midi2);
        break;
      case "pitch":
      case "stepleap":
        playInterval(q.midi1, q.midi2);
        break;
      case "melody":
        playMelody(q.notes);
        break;
      case "rhythm":
        playRhythm(q.tokens);
        break;
      case "scale":
        playMelody(q.midis, 0.45);
        break;
      case "timbre":
        playInstrumentMelody(q.instrument, q.midis);
        break;
      default:
        playNote(q.midi);
    }
  }

  function recordWrong(q: AnyQuestion) {
    const stats = loadWrongStats();
    stats[q.wrongKey] = (stats[q.wrongKey] ?? 0) + 1;
    localStorage.setItem("wrongStats", JSON.stringify(stats));
  }

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
    let lastUnit = 0;
    return (
      <div className="page">
        <header className="brand">
          <img src="/muse.png" alt="缪斯徽章" className="brandImg" />
          <div className="logo">缪斯</div>
          <div className="logoSub">MVSE · 视唱练耳</div>
          <div className="meander" />
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
            const showUnit = lv.unit !== lastUnit;
            lastUnit = lv.unit;
            return (
              <div key={lv.id}>
                {showUnit && (
                  <div className="unitHeader">
                    <span className="unitLine" />
                    <span className="unitName">{UNITS[lv.unit]}</span>
                    <span className="unitLine" />
                  </div>
                )}
                <button
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
              </div>
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
          <p className="qTitle">{qTitle(q)}</p>
          <Staff midi={q.midi} clef={q.clef} />
          <button className="replay" onClick={() => autoplay(q)}>
            🔊 听范唱
          </button>
          <SingTask key={index} midi={q.midi} onDone={(ok) => finish(ok, q, 100)} />
        </>
      ) : (
        <>
          <p className="qTitle">{qTitle(q)}</p>
          {q.kind === "note" && <Staff midi={q.midi} clef={q.clef} />}
          {q.kind === "melody" && (
            <MelodyStaff notes={q.notes} gapIndex={q.gapIndex} clef={q.clef} />
          )}
          <button className="replay" onClick={() => autoplay(q)}>
            {q.kind === "note" ? "🔊 听一听" : "🔊 再听一遍"}
          </button>
          <div className={"options" + (q.kind === "rhythm" ? " oneCol" : "")}>
            {q.options.map((opt) => {
              let cls = "opt";
              if (q.kind === "rhythm") cls += " rhythmOpt";
              const inst =
                q.kind === "timbre"
                  ? INSTRUMENTS.find((x) => x.name === opt)
                  : undefined;
              if (inst) cls += " instOpt";
              if (picked) {
                if (opt === q.answer) cls += " correct";
                else if (opt === picked) cls += " wrong";
              }
              return (
                <button key={opt} className={cls} onClick={() => answer(opt)}>
                  {inst && <img src={inst.img} alt="" />}
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