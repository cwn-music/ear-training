import { l2SolfegeOf, L2_PITCHES } from './lesson2Data'

export function L2SoundIcon() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className="l1-sound-icon">
      <path d="M7 16h7l9-8v24l-9-8H7z" />
      <path d="M28 14c3 3 3 9 0 12M32 10c5 5 5 15 0 20" />
    </svg>
  )
}

export function L2PitchPath({ pitches }: { pitches: [number, number] }) {
  const same = pitches[0] === pitches[1]
  const rising = pitches[1] > pitches[0]
  const y1 = same ? 56 : rising ? 80 : 32
  const y2 = same ? 56 : rising ? 32 : 80
  return (
    <svg
      className="l1-pitch-path"
      viewBox="0 0 280 116"
      role="img"
      aria-label={same ? '两个音在同一水平高度' : rising ? '第二个音的位置更高' : '第二个音的位置更低'}
    >
      <path className="l1-path-line" d={`M48 ${y1} C105 ${y1} 165 ${y2} 232 ${y2}`} />
      <circle className="l1-path-dot" cx="48" cy={y1} r="11" />
      <circle className="l1-path-dot" cx={232} cy={y2} r={11} />
    </svg>
  )
}

interface ThreeKeyPianoProps {
  activePitch?: number | null
  correctPitch?: number | null
  wrongPitch?: number | null
  interactive?: boolean
  disabled?: boolean
  showNames?: boolean
  onPick?: (pitch: number) => void
}

export function ThreeKeyPiano({
  activePitch = null,
  correctPitch = null,
  wrongPitch = null,
  interactive = false,
  disabled = false,
  showNames = true,
  onPick,
}: ThreeKeyPianoProps) {
  return (
    <div className="l2-three-key-piano" aria-label="do、re、mi 三个琴键，位置从左到右固定">
      {L2_PITCHES.map((pitch, index) => {
        const name = l2SolfegeOf(pitch)
        const classes = ['l2-piano-key']
        if (activePitch === pitch) classes.push('playing')
        if (correctPitch === pitch) classes.push('correct')
        if (wrongPitch === pitch) classes.push('wrong')
        return (
          <button
            key={pitch}
            type="button"
            data-pitch={pitch}
            className={classes.join(' ')}
            disabled={!interactive || disabled}
            aria-label={`${showNames ? `${name}，` : ''}${['左侧', '中间', '右侧'][index]}琴键`}
            onClick={() => onPick?.(pitch)}
          >
            <span className="l2-key-index" aria-hidden="true">{index + 1}</span>
            {showNames && <strong>{name}</strong>}
          </button>
        )
      })}
    </div>
  )
}

export function L2Conch({ className = '' }: { className?: string }) {
  return <img className={`l2-conch ${className}`} src="/badges/conch.png" alt="" />
}
