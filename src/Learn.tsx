import { useState } from "react";
import { LEVELS, INSTRUMENTS, type Level } from "./lessons";
import { INTERVALS, midiToSolfege, rhythmToText } from "./theory";
import {
  playInterval,
  playNote,
  playHarmonic,
  playMelody,
  playRhythm,
  playInstrumentMelody,
} from "./audio";
import Staff from "./Staff";
import MelodyStaff from "./MelodyStaff";
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

// 入门课的概念卡片（每张都带谱例）
const CONCEPT_CARDS: {
  title: string;
  body: string;
  visual: "scale" | "clef" | "highlow";
}[] = [
  {
    title: "五线谱：音符的楼梯",
    body: "五线谱是五条平行的横线。音符写在越高的位置，声音就越高——就像爬楼梯一样。",
    visual: "scale",
  },
  {
    title: "谱号",
    body: "谱子开头那个花体的符号叫「高音谱号」，又叫 G 谱号。第 8 课你还会认识它的兄弟：低音谱号。",
    visual: "clef",
  },
  {
    title: "「高」不是「大声」",
    body: "音乐里说音的「高低」，不是声音大小，而是振动的快慢：小鸟叫是高音，大鼓是低音。接下来考考你的耳朵。",
    visual: "highlow",
  },
];

const MAJOR_SCALE = [60, 62, 64, 65, 67, 69, 71, 72];
const MINOR_SCALE = [57, 59, 60, 62, 64, 65, 67, 69];
const MELODY_DEMO = [60, 62, 64, 65];

type Card =
  | { type: "welcome" }
  | { type: "concept"; title: string; body: string; visual: "scale" | "clef" | "highlow" }
  | { type: "note"; midi: number }
  | { type: "interval"; semitones: number }
  | { type: "melodyDemo" }
  | { type: "rhythmDemo" }
  | { type: "scaleDemo" }
  | { type: "harmonicDemo" }
  | { type: "instrument"; id: string }
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
  const hasNew = newNotes.length + newInts.length > 0;
  const prevSameEar = prev.some((l) => l.ear === level.ear);

  const cards: Card[] = [{ type: "welcome" }];
  if (level.id === 0) {
    for (const c of CONCEPT_CARDS) cards.push({ type: "concept", ...c });
  }
  for (const midi of newNotes) cards.push({ type: "note", midi });
  for (const s of newInts) cards.push({ type: "interval", semitones: s });
  // 新题型的讲解卡（只在该题型第一次出现时展示）
  if (!prevSameEar) {
    if (level.ear === "melody") cards.push({ type: "melodyDemo" });
    if (level.ear === "rhythm") cards.push({ type: "rhythmDemo" });
    if (level.ear === "scale") cards.push({ type: "scaleDemo" });
    if (level.ear === "timbre") {
      for (const id of level.instruments ?? []) cards.push({ type: "instrument", id });
    }
  }
  if (level.harmonic && !prev.some((l) => l.harmonic)) {
    cards.push({ type: "harmonicDemo" });
  }
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
            <p className="learnText">{level.desc}</p>
            <p className="learnText">
              {level.id === 0
                ? "在开始之前，先花两分钟认识五线谱——这是所有音乐的地基。"
                : hasNew
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
                  : level.review
                    ? "这是复习课，没有新内容。温故而知新，直接闯关吧！"
                    : prevSameEar
                      ? "本课延续之前的题型，难度升级。准备好了就直接闯关吧！"
                      : "本课没有新音符，重点是一种新的练耳题型，先看看讲解再开始吧！"}
            </p>
          </>
        )}

        {card.type === "concept" && (
          <>
            <div className="learnTag">小知识</div>
            <div className="learnTitle">{card.title}</div>
            {card.visual === "scale" && (
              <>
                <MelodyStaff notes={MAJOR_SCALE} gapIndex={-1} />
                <p className="conceptLabel">从 Do 到高音 Do，像八级台阶，越走越高</p>
              </>
            )}
            {card.visual === "clef" && (
              <>
                <Staff midi={67} />
                <p className="conceptLabel">高音谱号的螺旋中心，环绕的正是 Sol 所在的第二线</p>
              </>
            )}
            {card.visual === "highlow" && (
              <div className="conceptStaffs">
                <div>
                  <Staff midi={48} clef="bass" />
                  <p className="conceptLabel">低音 · 像大鼓</p>
                </div>
                <div>
                  <Staff midi={76} />
                  <p className="conceptLabel">高音 · 像小鸟</p>
                </div>
              </div>
            )}
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
            {level.harmonic ? (
              <Staff midi={60} midi2={60 + card.semitones} />
            ) : (
              <MelodyStaff notes={[60, 60 + card.semitones]} gapIndex={-1} />
            )}
            <p className="conceptLabel">示例：从 Do 出发</p>
            <p className="learnText">{INTERVAL_DESCS[card.semitones]}</p>
            <button
              className="replay"
              onClick={() => playInterval(60, 60 + card.semitones)}
            >
              🔊 听示例（从中央 Do 出发）
            </button>
          </>
        )}

        {card.type === "melodyDemo" && (
          <>
            <div className="learnTag">新题型 · 旋律填空</div>
            <div className="learnTitle">空缺的音</div>
            <p className="learnText">
              一条旋律里藏着一个空缺（画成休止符的位置）。仔细听完整条旋律，判断空缺处应该是哪个音。
            </p>
            <MelodyStaff notes={MELODY_DEMO} gapIndex={1} />
            <p className="conceptLabel">比如这条：Do、？、Mi、Fa</p>
            <button className="replay" onClick={() => playMelody(MELODY_DEMO)}>
              🔊 听示例
            </button>
          </>
        )}

        {card.type === "rhythmDemo" && (
          <>
            <div className="learnTag">新题型 · 节奏听写</div>
            <div className="learnTitle">节奏的语言</div>
            <p className="learnText">
              ♩ 一拍 · ♫ 一拍两个音 · 𝅗 两拍 · ♩. 一拍半 · 𝄽 休止一拍。
              听钢琴敲出的节奏，选出你听到的那一条。
            </p>
            <div className="rhythmBig">
              {rhythmToText(level.rhythms?.[0] ?? ["q", "q", "q", "q"])}
            </div>
            <button
              className="replay"
              onClick={() => playRhythm(level.rhythms?.[0] ?? ["q", "q", "q", "q"])}
            >
              🔊 听示例
            </button>
          </>
        )}

        {card.type === "scaleDemo" && (
          <>
            <div className="learnTag">新题型 · 调式听辨</div>
            <div className="learnTitle">大调与小调</div>
            <p className="learnText">
              大调明亮开朗，像晴天；小调柔和忧郁，像阴天。区别主要在第三个音。
            </p>
            <MelodyStaff notes={MAJOR_SCALE} gapIndex={-1} />
            <p className="conceptLabel">大调音阶 · 明亮</p>
            <button className="replay" onClick={() => playMelody(MAJOR_SCALE, 0.4)}>
              🔊 听大调
            </button>
            <MelodyStaff notes={MINOR_SCALE} gapIndex={-1} />
            <p className="conceptLabel">小调音阶（从 La 开始）· 忧郁</p>
            <button className="replay" onClick={() => playMelody(MINOR_SCALE, 0.4)}>
              🔊 听小调
            </button>
          </>
        )}

        {card.type === "harmonicDemo" && (
          <>
            <div className="learnTag">新题型 · 和声音程</div>
            <div className="learnTitle">两个音同时响起</div>
            <p className="learnText">
              之前的音程是一个先、一个后；现在两个音同时响起，像两只手一起按下琴键。
              诀窍：先抓住低音，再听高音，把它们在脑子里「拆开」。
            </p>
            <Staff midi={60} midi2={67} />
            <p className="conceptLabel">Do 和 Sol 同时响起（纯五度）</p>
            <button className="replay" onClick={() => playHarmonic(60, 67)}>
              🔊 听示例
            </button>
          </>
        )}

        {card.type === "instrument" &&
          (() => {
            const inst = INSTRUMENTS.find((x) => x.id === card.id);
            if (!inst) return null;
            return (
              <>
                <div className="learnTag">认识乐器</div>
                <div className="instCard">
                  <img className="instImgBig" src={inst.img} alt={inst.name} />
                  <div>
                    <div className="instName">{inst.name}</div>
                    <div className="instDesc">{inst.desc}</div>
                  </div>
                </div>
                <button
                  className="replay"
                  onClick={() => playInstrumentMelody(inst.id, [60, 64, 67, 72])}
                >
                  🔊 听音色（Do Mi Sol 高音Do）
                </button>
              </>
            );
          })()}

        {card.type === "ready" && (
          <>
            <div className="doneEmoji">🏛️</div>
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