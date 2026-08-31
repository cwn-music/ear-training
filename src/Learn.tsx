// 缪斯 Muse · 学习页（概念卡 + 范听）
import { useEffect, useState, type ReactNode } from 'react'
import { lessonOf, INSTRUMENTS } from './lessons'
import { ensureAudio, playMelody, playRhythm, playTwo, initInstruments, playInstrumentMelody, playNote } from './audio'
import { INTERVAL_NAMES, displayName, type Clef } from './theory'
import Staff from './Staff'
import Piano from './Piano'
import RhythmDict, { COMBO_ENTRIES } from './RhythmDict'

interface Props {
  lessonId: number
  onStart: () => void
  onBack: () => void
}

const INTERVAL_DESCS: Record<number, string> = {
  1: '小二度：紧挨着的两个音，最窄的距离',
  2: '大二度：do 到 re 的距离，像上一格台阶',
  3: '小三度：三个半音，色彩偏暗',
  4: '大三度：四个半音，色彩明亮',
  5: '纯四度：开阔而空洞',
  6: '增四度：不稳定，需要解决',
  7: '纯五度：最稳定的音程之一',
  8: '小六度：柔和而忧伤',
  9: '大六度：宽广明亮',
  10: '小七度：紧张，想要上行解决',
  11: '大七度：距离八度只差半步',
  12: '纯八度：同一个音的高低重复',
}

// 新题型第一次出现的课：开练前先看「怎么答题」，答错成本降为零
const HOWTO: Record<number, string[]> = {
  1: ['先听播放的音，同时琴键上会亮出它的位置', '在选项里点它的名字（do / re / mi）', '答错也没关系：正确答案会标绿，还会再播一遍'],
  2: ['会先后播放两个音', '判断第二个音比第一个更高还是更低，点对应按钮', '不确定就点「再听一遍」，不限次数'],
  3: ['会先后播放两个音', '判断第二个音更长还是更短'],
  4: ['会先后播放两个音', '判断第二个音更响还是更轻'],
  5: ['先看谱面上音符的位置，再听它的声音', '在选项里点它的名字', '「摆音符」题：听一个音，在谱面上点发光的圆圈，把它放回自己的位置', '「对不对」题：谱上标的名字，你觉得对就点 ✓，不对就点 ✗', '从 do 或 sol 出发，一格一格数到它的位置'],
  6: ['两个音会一起响起', '判断它们之间的距离（音程）是几度', '两个音隔得越远，音程越宽'],
  8: ['会先后播放两个音', '挨着的是级进，隔得远的是跳进'],
  9: ['听一小串音', '判断它整体往上走、往下走，还是原地不动', '「补缺口」题：三个音中间空了一个，点琴键把它补上'],
  10: ['听一小段旋律', '选项是三小段谱子，找出和你听到的一样那段', '先听走向，再对谱子上的高高低低'],
  11: ['听一段节奏', '选项是三行节奏谱，找出相同的一段', '问「几拍子」时，数强拍隔几拍出现一次'],
  12: ['听一段旋律，判断是哪种乐器在演奏', '分不清就多点几次「再听一遍」，抓住乐器的「味道」'],
  14: ['识谱范围变宽了，会出现下加线、上加线的音', '「摆音符」题：把听到的音点到谱面上发光的格子里', '「对不对」题：谱上标的名字你觉得对就点 ✓'],
  15: ['低音谱表的题和高音谱表一样做，只是起点不同', '「摆音符」与「对不对」题会帮你熟悉新地图'],
  19: ['听一串音阶', '大调明亮、小调柔和，关键差别在第三个音'],
  21: ['识谱与旋律题和以前一样', '「开口唱」题：听三个音，跟着唱出来，唱准一个亮一个', '会用到麦克风，点允许就好；不方便唱可以跳过'],
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="learnCard">
      <h3>{title}</h3>
      <div className="learnBody">{children}</div>
    </div>
  )
}

function PlayBtn({ label, onPlay }: { label: string; onPlay: () => void }) {
  const [busy, setBusy] = useState(false)
  return (
    <button
      className="btn ghost small"
      disabled={busy}
      onClick={() => {
        setBusy(true)
        void ensureAudio().then(() => {
          onPlay()
          setTimeout(() => setBusy(false), 1600)
        })
      }}
    >
      ▶ {label}
    </button>
  )
}

function IntervalCard({ semis }: { semis: number }) {
  return (
    <div className="intervalRow">
      <div className="intervalName">{INTERVAL_NAMES[semis]}</div>
      <div className="intervalDesc">{INTERVAL_DESCS[semis]}</div>
      <PlayBtn label="先后" onPlay={() => playMelody([60, 60 + semis], 0.5)} />
      <PlayBtn label="同时" onPlay={() => { playMelody([60], 0, 1.4); playMelody([60 + semis], 0, 1.4) }} />
    </div>
  )
}

// 单音闪卡：一张卡一个谱面位置，先自己说名字，再点开对答案（同时听声音）
function Flashcards({ clef, notes }: { clef: Clef; notes: number[] }) {
  const [flipped, setFlipped] = useState<Record<number, boolean>>({})
  return (
    <div className="flashGrid">
      {notes.map(m => (
        <button
          key={m}
          className={'flashCard' + (flipped[m] ? ' flipped' : '')}
          onClick={() => {
            setFlipped(f => ({ ...f, [m]: !f[m] }))
            void ensureAudio().then(() => playNote(m))
          }}
        >
          <Staff clef={clef} midi={m} width={108} height={112} noteX={66} staveY={0} />
          <span className="flashName">{flipped[m] ? displayName(m) : '?'}</span>
        </button>
      ))}
    </div>
  )
}

export default function Learn({ lessonId, onStart, onBack }: Props) {
  const lesson = lessonOf(lessonId)

  useEffect(() => {
    if (lessonId === 12) void initInstruments()
  }, [lessonId])

  const renderBody = () => {
    switch (lessonId) {
      case 1:
        return (
          <>
            <Card title="认识琴键">
              <p>钢琴的白键七个一组，依次是 do re mi fa sol la si。</p>
              <p>点一点琴键，听听它们的声音：</p>
              <Piano interactive highlight={[60, 62, 64]} />
            </Card>
            <Card title="今天要练">
              <p>只认三个音：do re mi。听一听声音、看一看位置、说一说名字。</p>
              <PlayBtn label="do" onPlay={() => playNote(60)} />
              <PlayBtn label="re" onPlay={() => playNote(62)} />
              <PlayBtn label="mi" onPlay={() => playNote(64)} />
            </Card>
          </>
        )
      case 2:
        return (
          <>
            <Card title="键盘上的高与低">
              <p>琴键越靠右，声音越高；越靠左，声音越低。</p>
              <Piano interactive highlight={[53, 67]} marks={{ 53: '低', 67: '高' }} from={53} to={71} />
            </Card>
            <Card title="听一听">
              <p>先听一个低音，再听一个高音：</p>
              <PlayBtn label="低 → 高" onPlay={() => playTwo(53, 67, { gap: 0.6 })} />
              <PlayBtn label="高 → 低" onPlay={() => playTwo(67, 53, { gap: 0.6 })} />
            </Card>
            <Card title="今天要练">
              <p>听两个音，说出第二个音比第一个高还是低。答完题，看一看它们在琴键上隔了多远。</p>
            </Card>
          </>
        )
      case 3:
        return (
          <>
            <Card title="声音有长有短">
              <p>一个音可以很短，也可以拖得很长。长与短由它持续的时间决定。</p>
              <PlayBtn label="短" onPlay={() => playNote(60, 0.25)} />
              <PlayBtn label="长" onPlay={() => playNote(60, 1.6)} />
            </Card>
            <Card title="今天要练">
              <p>听两个音，说出第二个音更长还是更短。</p>
            </Card>
          </>
        )
      case 4:
        return (
          <>
            <Card title="声音有强有弱">
              <p>同一个音，可以轻轻弹，也可以重重弹。轻轻弹声音弱，重重弹声音强。</p>
              <PlayBtn label="弱" onPlay={() => playNote(60, 0.9, 0.35)} />
              <PlayBtn label="强" onPlay={() => playNote(60, 0.9, 1)} />
            </Card>
            <Card title="今天要练">
              <p>听两个音，说出第二个音更响还是更轻。</p>
            </Card>
          </>
        )
      case 5:
        return (
          <>
            <Card title="五线谱是音高的地图">
              <p>五条线，从下到上。音越高，位置越高。音符落在线上或线间。</p>
              <Staff clef="treble" midi={64} width={300} />
              <p className="tip">高音谱号又叫做 sol 谱号：它的圆圈绕着第二线，第二线上的音就是 sol。do（中央 do）住在五线谱下面的下加一线上。</p>
              <Staff clef="treble" midi={60} width={300} />
            </Card>
            <Card title="单音卡片 · 每个位置认一认">
              <p>一个卡片一个位置。先看着音符说出它的名字，再点开对答案——顺便听一听它的声音。</p>
              <Flashcards clef="treble" notes={[60, 62, 64, 65, 67, 69, 71, 72]} />
            </Card>
            <Card title="看谱 → 唱名">
              <p>先看音符的位置，说出它是什么音，再把它唱出来。练习里还会请你把听到的音「放」到谱面上它自己的位置，反过来也能帮你记住地图。</p>
            </Card>
          </>
        )
      case 6:
        return (
          <>
            <Card title="二度 · 相邻的音">
              <p>音程，就是两个音之间的距离。两个音隔得越远，音程越宽。这个距离用「度」来数：do 挨着 re，是二度；do 到 mi 中间隔着一个音，是三度。</p>
              <p>这一课先练最相邻的两种：小二度和大二度。点下面的按钮，听一听它们有多近：</p>
              <IntervalCard semis={1} />
              <IntervalCard semis={2} />
            </Card>
          </>
        )
      case 7:
        return (
          <>
            <Card title="三度 · 隔一个白键">
              <p>三度比二度宽一点。大三度明亮，小三度柔和。</p>
              <IntervalCard semis={3} />
              <IntervalCard semis={4} />
            </Card>
          </>
        )
      case 8:
        return (
          <>
            <Card title="五度与八度">
              <p>纯五度开阔稳定；纯八度是同一个音在高处的重复，听起来几乎「重合」。</p>
              <IntervalCard semis={7} />
              <IntervalCard semis={12} />
            </Card>
          </>
        )
      case 9:
        return (
          <>
            <Card title="级进与跳进">
              <p>音与音挨着走，叫「级进」，像走台阶；隔得远，叫「跳进」，像跳格子。</p>
              <PlayBtn label="级进" onPlay={() => playMelody([60, 62, 64])} />
              <PlayBtn label="跳进" onPlay={() => playMelody([60, 64, 67])} />
            </Card>
          </>
        )
      case 10:
        return (
          <>
            <Card title="旋律会走路">
              <p>一串音可以一直往上走（上行）、一直往下走（下行），也可以原地不动（同音反复）。</p>
              <PlayBtn label="上行" onPlay={() => playMelody([60, 62, 64, 65])} />
              <PlayBtn label="下行" onPlay={() => playMelody([65, 64, 62, 60])} />
              <PlayBtn label="同音反复" onPlay={() => playMelody([62, 62, 62])} />
            </Card>
          </>
        )
      case 11:
        return (
          <>
            <Card title="节奏符号小词典">
              <p>题目里的节奏谱，就是由这六个符号组成的。每个符号占多长时间，看色块、听声音：</p>
              <RhythmDict />
              <p>休止符比较特别：它不占声音，只数拍子——到了它就安静一拍。</p>
            </Card>
            <Card title="拍子会循环">
              <p>二拍子：强、弱，像走路。三拍子：强、弱、弱，像转圆圈。</p>
              <PlayBtn label="二拍子" onPlay={() => playRhythm(['q', 'q', 'q', 'q'], 72, 2)} />
              <PlayBtn label="三拍子" onPlay={() => playRhythm(['q', 'q', 'q', 'q', 'q', 'q'], 72, 3)} />
            </Card>
          </>
        )
      case 12:
        return (
          <>
            <Card title="四种乐器的颜色">
              <p>同一个旋律，不同的乐器唱出来，味道完全不同。这就是「音色」。</p>
              <div className="instGrid">
                {INSTRUMENTS.map(inst => (
                  <div key={inst.id} className="instCard">
                    <img src={inst.img} alt={inst.name} />
                    <div className="instName">{inst.name}</div>
                    <div className="instDesc">{inst.desc}</div>
                    <button
                      className="btn ghost small"
                      onClick={() => {
                        void initInstruments().then(() => playInstrumentMelody(inst.id, [60, 62, 64, 65]))
                      }}
                    >
                      ▶ 听一听
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )
      case 13:
        return (
          <Card title="复习">
            <p>这一课把单元二学到的内容混在一起练：二度三度、级进跳进、旋律走向、拍子与节奏、乐器音色。</p>
          </Card>
        )
      case 14:
        return (
          <>
            <Card title="高音谱表进阶">
              <p>五线谱还可以往下加线、往上加线，装下更低和更高的音。这一课我们把认谱范围放宽到低音 la 到高音 mi。</p>
              <Staff clef="treble" midi={76} width={300} />
            </Card>
            <Card title="单音卡片 · 更宽的范围">
              <p>老规矩：先说名字，再点开对答案。多了加线上的位置，别慌，一格一格数。</p>
              <Flashcards clef="treble" notes={[57, 59, 60, 62, 64, 65, 67, 69, 71, 72, 74, 76]} />
            </Card>
          </>
        )
      case 15:
        return (
          <>
            <Card title="低音谱号">
              <p>低音谱号又叫做 fa 谱号：它的两个点夹着第四线，第四线上的音就是 fa。左手的低音区常用它。</p>
              <Staff clef="bass" midi={53} width={300} />
            </Card>
            <Card title="单音卡片 · 低音谱表">
              <p>同一张地图，换了一把尺子。先说名字，再点开对答案。</p>
              <Flashcards clef="bass" notes={[40, 41, 43, 45, 47, 48, 50, 52, 53, 55]} />
            </Card>
          </>
        )
      case 16:
        return (
          <Card title="更长的旋律">
            <p>现在一次要记四到五个音。诀窍：先听出它的走向，再留意哪个音「不一样」。</p>
            <PlayBtn label="试一试" onPlay={() => playMelody([60, 62, 65, 64, 67])} />
          </Card>
        )
      case 17:
        return (
          <>
            <Card title="附点与更密的节奏">
              <p>音符后面的小点叫「附点」，让这个音变长一半。四个十六分音符挤在一拍里，跑得飞快。</p>
              <PlayBtn label="附点节奏" onPlay={() => playRhythm(['q.', 'ee', 'q', 'q'])} />
              <PlayBtn label="十六分" onPlay={() => playRhythm(['eeee', 'q', 'q', 'q'])} />
            </Card>
            <Card title="节奏型小词典">
              <p>基本符号手拉手组成常用的「节奏型」，每个都住在一拍里。它们有约定俗成的名字，看色块、听声音：</p>
              <RhythmDict entries={COMBO_ENTRIES} />
            </Card>
          </>
        )
      case 18:
        return (
          <>
            <Card title="音程大集合">
              <p>把学过的音程放在一起听：先从最像的一对里分辨，再听最不相似的。</p>
              {[2, 3, 4, 5, 7, 9, 12].map(s => <IntervalCard key={s} semis={s} />)}
            </Card>
          </>
        )
      case 19:
        return (
          <>
            <Card title="大调明亮，小调柔和">
              <p>同样是 do 开头的一串音，大调听起来明亮坚定，小调听起来柔和忧郁。差别在第三个音。</p>
              <PlayBtn label="大调音阶" onPlay={() => playMelody([60, 62, 64, 65, 67, 69, 71, 72], 0.06, 0.5)} />
              <PlayBtn label="小调音阶" onPlay={() => playMelody([60, 62, 63, 65, 67, 68, 70, 72], 0.06, 0.5)} />
            </Card>
          </>
        )
      case 20:
        return (
          <>
            <Card title="黑键加入">
              <p>白键之间的黑键叫「变化音」。带 ♯ 的音比原来高半个音。现在识音题里会出现黑键了。</p>
              <Piano interactive highlight={[61]} />
            </Card>
          </>
        )
      case 21:
        return (
          <>
            <Card title="视唱综合">
              <p>看着谱子，先在心里听到它，再唱出来。唱错了没关系，多听一遍范唱再试。</p>
              <Staff clef="treble" midi={67} width={300} />
            </Card>
            <Card title="开口唱 · 三音组模唱">
              <p>这一课开始，真的要开口唱了。系统先弹三个音，你跟着唱——用「啦」哼也行。唱准一个，那个音就会亮起来。第一次会向你借一下麦克风，唱完就还。</p>
              <p className="tip">小诀窍：先把示范多听两遍，在心里跟着哼，再出声。</p>
            </Card>
          </>
        )
      case 22:
        return (
          <Card title="全音域识谱">
            <p>高音谱表和低音谱表混合出现，黑键也会出现。看清谱号，再看位置。</p>
            <Staff clef="bass" midi={50} width={300} />
            <Staff clef="treble" midi={73} width={300} />
          </Card>
        )
      case 23:
        return (
          <Card title="毕业音乐会">
            <p>最后一课：所有题型综合登场。放轻松，把每一次答题都当作一次小演出。</p>
          </Card>
        )
      default:
        return null
    }
  }

  return (
    <div className="learnPage">
      <button className="backLink" onClick={onBack}>‹ 返回地图</button>
      <h2>第 {lesson.id} 课 · {lesson.title}</h2>
      <p className="goal">{lesson.goal}</p>
      {HOWTO[lessonId] && (
        <Card title="怎么答题">
          <ol className="howtoList">
            {HOWTO[lessonId].map(s => <li key={s}>{s}</li>)}
          </ol>
        </Card>
      )}
      {renderBody()}
      <button className="btn primary big" onClick={onStart}>开始练习</button>
    </div>
  )
}
