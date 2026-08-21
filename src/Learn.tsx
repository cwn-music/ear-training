import { useState } from "react";
import { LEVELS, type Level } from "./lessons";
import { INTERVALS, midiToSolfege } from "./theory";
import { playInterval, playNote } from "./audio";
import Staff from "./Staff";
import SingTask from "./Sing";

// 每个音程的一句话「色彩描述」
const INTERVAL_DESCS: Record<number, string> = {
  1: "两个音紧紧挨着，最紧张，像脚步声一点点逼近。",
  2: "相邻的两个音，像上台阶一样自然——《两只老虎》开头就是它。",
  3: "带一点柔和、忧郁的色彩。",
  4: "明亮开朗，像拉开窗帘晒到太阳。",
  5: "开阔稳定，像号角的呼唤。",
  6: "又叫三全音，中世纪的修道士管它叫「魔鬼音程」。",
  7: "非常和谐空旷，像教堂的钟声。",
  8: "温柔中带一点忧伤。",
  9: "开阔又甜美，像一个大大的拥抱。",
  10: "悬在半空，有一种想要「解决」的推动力。",
  11: "差一步就到八度，紧张又迷人。",
  12: "同一个音的高低两个版本，完全融合在一起。",
};

// 入门课的概念卡片
const CONCEPT_CARDS = [
  {
    title: "五线谱：音符的楼梯",
    body: "五线谱是五条平行的横线。音符写在越高的位置，声音就越高——就像爬楼梯一样。",
  },
  {
    title: "谱号",
    body: "谱子开头那个花体的符号叫「高音谱号」，表示这行谱用较高的音区来唱。第 8 课你还会认识它的兄弟：低音谱号。",
  },
  {
    title: "「高」不是「大声」",
    body: "音乐里说音的「高低」，不是声音大小，而是振动的快慢：小鸟叫是高音，大鼓是低音。接下来考考你的耳朵。",
  },
];

type Card =
  | { type: "welcome" }
  | { type: "concept"; title: string; body: string }
  | { type: "note"; midi: number }
  | { type: "interval"; semitones: number }
  | { type: "ready" };

export default function Learn({
  level,
  onStart,
  onBack,
}: {
  level: Level;
  onStart: () => void;
  onBack: () => void;
}) {
  const [i, setI] = useState(0);

  // 自动找出本课的新内容：本课有、之前所有课都没有的音符和音程
  const prev = LEVELS.filter((l) => l.id < level.id);
  const prevNotes = new Set(prev.flatMap((l) => l.notes));
  const prevInts = new Set(prev.flatMap((l) => l.intervals));
  const newNotes = level.notes.filter((n) => !prevNotes.has(n));
  const newInts = level.intervals.filter((s) => !prevInts.has(s));

  const cards: Card[] = [{ type: "welcome" }];
  if (level.id === 0) {
    for (const c of CONCEPT_CARDS) cards.push({ type: "concept", ...c });
  }
  for (const midi of newNotes) cards.push({ type: "note", midi });
  for (const s of newInts) cards.push({ type: "interval", semitones: s });
  cards.push({ type: "ready" });

  const card = cards[i];
  const isLast = i === cards.length - 1;

  const levelName = level.id === 0 ? "入门课" : `第 ${level.id} 课`;

  return (
    <div className="page">
      <div className="sessionTop">
        <button className="closeBtn" onClick={onBack}>
          ✕
        </button>
        <div className="track">
          <div
            className="fill"
            style={{ width: `${((i + 1) / cards.length) * 100}%` }}
          />
        </div>
        <span className="counter">
          {i + 1}/{cards.length}
        </span>
      </div>

      <div className="learnCard">
        {card.type === "welcome" && (
          <>
            <div className="learnTag">{levelName}</div>
            <div className="learnTitle">{level.title}</div>
            <p className="learnText">
              {level.id === 0
                ? "在开始之前，先花两分钟认识五线谱——这是所有音乐的地基。"
                : newNotes.length + newInts.length > 0
                  ? `本课新内容：${
                      newNotes.length > 0
                        ? newNotes.map((n) => midiToSolfege(n)).join("、") +
                          " 共 " +
                          newNotes.length +
                          " 个新音符"
                        : ""
                    }${newNotes.length > 0 && newInts.length > 0 ? "；" : ""}${
                      newInts.length > 0
                        ? newInts
                            .map((s) => INTERVALS.find((d) => d.semitones === s)!.name)
                            .join("、")
                        : ""
                    }`
                  : "这是复习课，没有新内容。温故而知新，直接闯关吧！"}
            </p>
          </>
        )}

        {card.type === "concept" && (
          <>
            <div className="learnTag">小知识</div>
            <div className="learnTitle">{card.title}</div>
            <p className="learnText">{card.body}</p>
          </>
        )}

        {card.type === "note" && (
          <>
            <div className="learnTag">新音符</div>
            <Staff midi={card.midi} clef={level.clefs[0]} />
            <div className="noteName">{midiToSolfege(card.midi)}</div>
            <div className="stepList">
              ① 看：记住它在谱子上的位置
              <br />
              ② 听：点下方按钮，听它的声音
              <br />③ 唱：跟着钢琴，把这个音唱出来
            </div>
            <button className="replay" onClick={() => playNote(card.midi)}>
              🔊 听一听
            </button>
            <SingTask key={card.midi} midi={card.midi} onDone={() => {}} />
          </>
        )}

        {card.type === "interval" && (
          <>
            <div className="learnTag">新音程</div>
            <div className="noteName" style={{ fontSize: 32 }}>
              {INTERVALS.find((d) => d.semitones === card.semitones)!.name}
            </div>
            <p className="learnText">{INTERVAL_DESCS[card.semitones]}</p>
            <button
              className="replay"
              onClick={() => playInterval(60, 60 + card.semitones)}
            >
              🔊 听示例（从中央 Do 出发）
            </button>
          </>
        )}

        {card.type === "ready" && (
          <>
            <div className="doneEmoji">🚀</div>
            <div className="learnTitle">准备好了！</div>
            <p className="learnText">
              接下来 10 道题，答对 8 题就过关。做错的内容会自动多出现。
            </p>
          </>
        )}
      </div>

      <div className="learnNav">
        {card.type !== "ready" && (
          <button className="btn ghost" onClick={onStart}>
            跳过学习，直接闯关
          </button>
        )}
        {isLast ? (
          <button className="btn" onClick={onStart}>
            开始闯关
          </button>
        ) : (
          <button className="btn" onClick={() => setI(i + 1)}>
            下一张
          </button>
        )}
      </div>
    </div>
  );
}