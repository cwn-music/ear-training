// 缪斯 Muse · 学习页（每课概念卡 + 谱例 + 范听）
import type { ReactNode } from 'react'
import Staff from './Staff'
import { INTERVAL_NAMES, SCALE_STEPS } from './theory'
import { playInstrumentMelody, playMelody, playRhythm, playScaleNotes, playTwo } from './audio'
import { INSTRUMENTS } from './lessons'

export const INTERVAL_DESCS: Record<number, string> = {
  1: '小二度：相距 1 个半音', 2: '大二度：相距 2 个半音',
  3: '小三度：相距 3 个半音', 4: '大三度：相距 4 个半音',
  5: '纯四度：相距 5 个半音', 6: '增四度：相距 6 个半音',
  7: '纯五度：相距 7 个半音', 8: '小六度：相距 8 个半音',
  9: '大六度：相距 9 个半音', 10: '小七度：相距 10 个半音',
  11: '大七度：相距 11 个半音', 12: '纯八度：相距 12 个半音，频率比 2:1',
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

function PlayBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="playBtn" onClick={onClick}>
      ▶ {label}
    </button>
  )
}

function IntervalCard({ semis, a }: { semis: number; a: number }) {
  return (
    <div className="intCard">
      <div className="intName">{INTERVAL_NAMES[semis]}</div>
      <div className="intDesc">{INTERVAL_DESCS[semis]}</div>
      <Staff midi={null} midis={[a, a + semis]} width={200} height={110} />
      <PlayBtn label="范听" onClick={() => playTwo(a, a + semis)} />
    </div>
  )
}

export function renderBody(id: number): ReactNode {
  switch (id) {
    case 1:
      return (
        <>
          <Card title="声音从哪里来">
            <p>声音由物体振动产生，振动经空气传播到耳朵。每秒振动的次数叫频率，单位是赫兹（Hz）。人耳能听到的范围约为 20 至 20000 Hz。</p>
            <PlayBtn label="听一个低音" onClick={() => playTwo(48, 48)} />
            <PlayBtn label="听一个高音" onClick={() => playTwo(72, 72)} />
          </Card>
          <Card title="今天要练">
            <p>听两个先后出现的音，分辨第二个音更高还是更低。先听大跨度，很容易分辨。</p>
          </Card>
        </>
      )
    case 2:
      return (
        <>
          <Card title="音的高低">
            <p>频率越高，音就越高。钢琴从左到右音越来越高，中央 C 的频率约 261.63 Hz。</p>
            <Staff midi={null} midis={[48, 60, 72]} width={240} />
            <PlayBtn label="范听：由低到高" onClick={() => playMelody([48, 60, 72], 0.4)} />
          </Card>
          <Card title="今天要练">
            <p>继续分辨高低，并开始认识音的名字：C D E F G A B 对应唱名 do re mi fa sol la si。</p>
          </Card>
        </>
      )
    case 3:
      return (
        <>
          <Card title="音的长短">
            <p>音的长短指振动持续的时间。记谱上用音值表示相对长短：一个全音符等于 2 个二分音符，等于 4 个四分音符。</p>
            <PlayBtn label="范听：先短后长" onClick={() => playTwo(60, 60, { da: 0.3, db: 1.2 })} />
            <PlayBtn label="范听：先长后短" onClick={() => playTwo(64, 64, { da: 1.2, db: 0.3 })} />
          </Card>
          <Card title="今天要练">
            <p>听两个音，分辨第二个音更长还是更短。注意保持注意力到音的结尾。</p>
          </Card>
        </>
      )
    case 4:
      return (
        <>
          <Card title="音的强弱">
            <p>振动的幅度（振幅）越大，声音越响。乐谱上的力度记号来自意大利语：piano（p，弱）、forte（f，强）、mezzo（m，中等）。</p>
            <PlayBtn label="范听：先轻后响" onClick={() => playTwo(60, 60, { va: 0.35, vb: 1 })} />
            <PlayBtn label="范听：先响后轻" onClick={() => playTwo(64, 64, { va: 1, vb: 0.35 })} />
          </Card>
          <Card title="今天要练">
            <p>听两个音，分辨第二个音更响还是更轻。音高和长短都一样，只比强弱。</p>
          </Card>
        </>
      )
    case 5:
      return (
        <>
          <Card title="五线谱与高音谱号">
            <p>五线谱有五条线和四个间。高音谱号又称 G 谱号，它的螺旋中心围绕第二线，第二线上的音是 G4（sol）。中央 C（do）在下加一线上。</p>
            <Staff midi={null} midis={[60, 62, 64, 65, 67, 69, 71]} width={320} />
            <PlayBtn label="范听：do 到 si" onClick={() => playMelody([60, 62, 64, 65, 67, 69, 71], 0.3)} />
          </Card>
          <Card title="今天要练">
            <p>看谱认音：认出它叫什么名字，再开口把它唱准。</p>
          </Card>
        </>
      )
    case 6:
      return (
        <>
          <Card title="二度音程">
            <p>音程是两个音之间的距离。二度是相邻的两个音级：小二度相距 1 个半音，大二度相距 2 个半音。</p>
            <div className="intRow">
              <IntervalCard semis={1} a={60} />
              <IntervalCard semis={2} a={60} />
            </div>
          </Card>
        </>
      )
    case 7:
      return (
        <>
          <Card title="三度音程">
            <p>三度跨过三个音级：小三度相距 3 个半音，大三度相距 4 个半音。</p>
            <div className="intRow">
              <IntervalCard semis={3} a={60} />
              <IntervalCard semis={4} a={60} />
            </div>
          </Card>
        </>
      )
    case 8:
      return (
        <>
          <Card title="五度与八度">
            <p>纯五度相距 7 个半音，纯八度相距 12 个半音。纯八度的两个音，频率比正好是 2:1。</p>
            <div className="intRow">
              <IntervalCard semis={7} a={55} />
              <IntervalCard semis={12} a={55} />
            </div>
          </Card>
        </>
      )
    case 9:
      return (
        <>
          <Card title="级进与跳进">
            <p>相邻音级之间的进行（不超过 2 个半音）叫级进；超过二度的进行叫跳进。</p>
            <PlayBtn label="范听：级进" onClick={() => playMelody([60, 62, 64, 65], 0.3)} />
            <PlayBtn label="范听：跳进" onClick={() => playMelody([60, 67, 62, 72], 0.3)} />
          </Card>
          <Card title="旋律的走向">
            <p>旋律可以上行（越来越高）、下行（越来越低）或同音反复（同一个音重复）。</p>
          </Card>
        </>
      )
    case 10:
      return (
        <>
          <Card title="旋律的走向">
            <p>上行：音一个比一个高；下行：一个比一个低；同音反复：同一个音连续重复。更长的旋律还会出现先上后下的波浪形。</p>
            <PlayBtn label="上行" onClick={() => playMelody([60, 63, 65, 67], 0.3)} />
            <PlayBtn label="下行" onClick={() => playMelody([67, 65, 63, 60], 0.3)} />
            <PlayBtn label="同音反复" onClick={() => playMelody([62, 62, 62], 0.3)} />
          </Card>
        </>
      )
    case 11:
      return (
        <>
          <Card title="二拍子与三拍子">
            <p>拍号写在谱号后面。2/4 拍以四分音符为一拍、每小节两拍，强弱规律是「强、弱」；3/4 拍每小节三拍，规律是「强、弱、弱」。</p>
            <PlayBtn label="范听：二拍子" onClick={() => playRhythm(['q', 'q', 'q', 'q'], 72, 2)} />
            <PlayBtn label="范听：三拍子" onClick={() => playRhythm(['q', 'q', 'q', 'q', 'q', 'q'], 72, 3)} />
          </Card>
          <Card title="今天要练">
            <p>听一段节奏，找重音落在第几拍：每隔一拍重一次是二拍子，每隔两拍重一次是三拍子。</p>
          </Card>
        </>
      )
    case 12:
      return (
        <>
          <Card title="四种乐器">
            <div className="instGrid">
              {INSTRUMENTS.map(inst => (
                <div className="instCard" key={inst.id}>
                  <img src={inst.img} alt={inst.name} />
                  <div className="instName">{inst.name}</div>
                  <p>{inst.desc}</p>
                  <PlayBtn label="范听" onClick={() => void playInstrumentMelody(inst.id, [60, 64, 67], 0.35)} />
                </div>
              ))}
            </div>
          </Card>
        </>
      )
    case 13:
      return (
        <>
          <Card title="单元二复习">
            <p>这一课把前面学过的混在一起：二度、三度、五度、八度音程，级进与跳进，节奏型，短旋律。答错的内容会被记住，之后优先再练。</p>
          </Card>
        </>
      )
    case 14:
      return (
        <>
          <Card title="高音谱表进阶">
            <p>识谱范围扩展到上加间：从 A3 一直到 E5。位置越高，音越高。</p>
            <Staff midi={null} midis={[57, 60, 64, 67, 72, 76]} width={320} />
            <PlayBtn label="范听" onClick={() => playMelody([57, 60, 64, 67, 72, 76], 0.28)} />
          </Card>
        </>
      )
    case 15:
      return (
        <>
          <Card title="低音谱表">
            <p>低音谱号又称 F 谱号，它的两个点夹住第四线，第四线上的音是 F3（fa）。低音谱表用来记较低的音。</p>
            <Staff clef="bass" midi={null} midis={[40, 43, 45, 48, 50, 52, 55]} width={320} />
            <PlayBtn label="范听" onClick={() => playMelody([40, 43, 45, 48, 50, 52, 55], 0.28)} />
          </Card>
        </>
      )
    case 16:
      return (
        <>
          <Card title="旋律小乐句">
            <p>几个音连起来就成了一小句旋律。听的时候先抓住走向（上行还是下行），再分辨具体的音。</p>
            <PlayBtn label="范听一条小乐句" onClick={() => playMelody([60, 64, 62, 65, 67], 0.32)} />
          </Card>
        </>
      )
    case 17:
      return (
        <>
          <Card title="附点、十六分与休止">
            <p>附点把前面音符的时值延长一半：附点四分音符等于 1.5 拍。四个十六分音符合起来是一拍。休止符表示安静一拍。</p>
            <Staff rhythm={['q.', 'ee', 'eeee', 'q']} width={320} />
            <PlayBtn label="范听" onClick={() => playRhythm(['q.', 'ee', 'eeee', 'q'], 72)} />
          </Card>
        </>
      )
    case 18:
      return (
        <>
          <Card title="音程总表">
            <p>目前学过的所有音程，按半音数排列：</p>
            <ul className="intList">
              {[1, 2, 3, 4, 5, 7, 8, 9, 12].map(s => (
                <li key={s}>{INTERVAL_DESCS[s]}</li>
              ))}
            </ul>
          </Card>
        </>
      )
    case 19:
      return (
        <>
          <Card title="大调与小调">
            <p>大调音阶的半音在第 3–4 级和第 7–8 级之间（全、全、半、全、全、全、半）。自然小调的半音在第 2–3 级和第 5–6 级之间。</p>
            <PlayBtn label="范听：大调" onClick={() => playScaleNotes(60, SCALE_STEPS.major)} />
            <PlayBtn label="范听：小调" onClick={() => playScaleNotes(60, SCALE_STEPS.minor)} />
          </Card>
        </>
      )
    case 20:
      return (
        <>
          <Card title="变化音">
            <p>升号 ♯ 把音升高半个音，降号 ♭ 降低半个音。钢琴上的黑键就是变化音。</p>
            <Staff midi={null} midis={[60, 61, 62, 63, 64]} width={300} />
            <PlayBtn label="范听：半音上行" onClick={() => playMelody([60, 61, 62, 63, 64], 0.3)} />
          </Card>
        </>
      )
    case 21:
      return (
        <>
          <Card title="视唱综合">
            <p>看谱时先读节奏、再读音高，然后开口唱。唱的时候保持气息平稳，音要唱满时值。</p>
          </Card>
        </>
      )
    case 22:
      return (
        <>
          <Card title="全音域识谱">
            <p>高音谱表和低音谱表合起来，覆盖从大字组到小字二组的音。遇到变化音，先看升降号再唱。</p>
          </Card>
        </>
      )
    default:
      return (
        <>
          <Card title="毕业音乐会">
            <p>最后一课把所有内容合在一起：高低、长短、强弱、走向、拍号、音程、旋律、节奏、音阶、音色、识谱与视唱。准备好就开始吧。</p>
          </Card>
        </>
      )
  }
}