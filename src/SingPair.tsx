// 缪斯 Muse · 模唱另一个音（第二课）：先后听两个音，告知第一个，把第二个唱出来
import { useState } from 'react'
import { displayName } from './theory'
import { ensureAudio, playTwo } from './audio'
import Staff, { noteYOnStaff } from './Staff'
import Sing from './Sing'

interface Props {
  a: number // 先播的音（已告知唱名，作为参照）
  b: number // 后播的音（要听出来并唱准的目标，不显示唱名）
  ghostMic?: boolean
  onDone: (ok: boolean, heard: number | null) => void
}

export default function SingPair({ a, b, ghostMic = false, onDone }: Props) {
  const [armed, setArmed] = useState(false) // 孩子点「开始跟唱」后才开麦
  const [heard, setHeard] = useState<number | null>(null) // 实时听到的音（光条用）
  return (
    <div className="singPair">
      <p className="hintLine">
        第一个音是 <b>{displayName(a)}</b>——以它为参照，听出并唱出<b>第二个音</b>
      </p>
      <div className="singLiveWrap">
        {/* 空谱面：光条落在哪条线/间，唱的就是哪个音；目标唱名最后才揭晓 */}
        <Staff clef="treble" width={240} />
        {armed && heard !== null && (() => {
          const y = Math.max(4, Math.min(116, noteYOnStaff(heard, 'treble', 12)))
          const diff = (((heard - b) % 12) + 18) % 12 - 6
          return <span className={'pitchBar' + (Math.abs(diff) <= 0.75 ? ' ok' : '')} style={{ top: y }} />
        })()}
      </div>
      {armed && <p className="liveTip">金色光条跟着你的声音走——变成绿色，就是唱准了</p>}
      <div className="singPairBtns">
        <button className="btn ghost" onClick={() => { void ensureAudio().then(() => playTwo(a, b, { gap: 0.55 })) }}>
          ▶ 再听两个音
        </button>
        {!armed && (
          <button className="btn primary big" onClick={() => setArmed(true)}>🎤 开始跟唱</button>
        )}
      </div>
      {armed && (
        <Sing
          target={b}
          prompt="唱出你听到的第二个音"
          ghostMic={ghostMic}
          onDone={(ok, h) => onDone(ok, h ?? null)}
          onHear={setHeard}
        />
      )}
    </div>
  )
}
