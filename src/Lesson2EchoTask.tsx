// 第2课任务8：两条固定三音短句；完整示范，可选前两音＋后两音支持，再回到完整句。
import { useEffect, useRef, useState } from 'react'
import { playLesson1Sequence, stopLesson1Audio } from './lesson1Audio'
import { l2SolfegeOf } from './lesson2Data'
import { ThreeKeyPiano } from './Lesson2Shared'
import VoicePracticePanel, { type L2VoiceResult } from './Lesson2Voice'

interface Props {
  phrases: number[][]
  replayNonce: number
  onDone: (record: Record<string, unknown>) => void
}

type EchoStage = 'initial' | 'support' | 'segmentFirst' | 'segmentSecond' | 'final'

interface PhraseDraft {
  initialFull: L2VoiceResult | null
  segments: L2VoiceResult[]
  usedSegmentSupport: boolean
}

export default function Lesson2EchoTask({ phrases, replayNonce, onDone }: Props) {
  const [phraseIndex, setPhraseIndex] = useState(0)
  const [stage, setStage] = useState<EchoStage>('initial')
  const [activePitch, setActivePitch] = useState<number | null>(null)
  const [supportPlaying, setSupportPlaying] = useState(false)
  const [audioError, setAudioError] = useState(false)
  const recordsRef = useRef<Array<Record<string, unknown>>>([])
  const draftRef = useRef<PhraseDraft>({ initialFull: null, segments: [], usedSegmentSupport: false })
  const currentPhrase = phrases[phraseIndex]
  const phraseNames = currentPhrase.map(l2SolfegeOf).join(' — ')

  useEffect(() => () => stopLesson1Audio(), [])

  const finishPhrase = (finalFull: L2VoiceResult) => {
    const draft = draftRef.current
    const record = {
      phraseIndex,
      sequence: [...currentPhrase],
      solfege: currentPhrase.map(l2SolfegeOf),
      initialFull: draft.initialFull,
      usedSegmentSupport: draft.usedSegmentSupport,
      segments: draft.segments,
      finalFull,
      completed: true,
    }
    if (phraseIndex + 1 < phrases.length) {
      recordsRef.current.push(record)
      draftRef.current = { initialFull: null, segments: [], usedSegmentSupport: false }
      setPhraseIndex(phraseIndex + 1)
      setStage('initial')
    } else {
      onDone({ taskId: 'L02T08', phrases: [...recordsRef.current, record], completed: true })
    }
  }

  const playSupportDemo = async () => {
    setSupportPlaying(true)
    setAudioError(false)
    try {
      await playLesson1Sequence(currentPhrase, {
        noteMs: 700,
        gapMs: 300,
        onNote: index => setActivePitch(currentPhrase[index]),
      })
    } catch {
      setAudioError(true)
    } finally {
      setActivePitch(null)
      setSupportPlaying(false)
    }
  }

  const voicePanel = (targets: number[], continueLabel: string, onContinue: (result: L2VoiceResult) => void) => (
    <VoicePracticePanel
      key={`${phraseIndex}-${stage}`}
      targets={targets}
      replayNonce={replayNonce}
      showSolfege
      demoLabel={targets.length === 3 ? '再听完整短句' : '再听这两个音'}
      recordLabel={targets.length === 3 ? '开始唱完整短句' : '开始唱这两个音'}
      continueLabel={continueLabel}
      onDemoNote={setActivePitch}
      onContinue={onContinue}
    />
  )

  return (
    <section className="l1-task" aria-labelledby="L02T08-title">
      <h2 id="L02T08-title">三音唱名回声</h2>
      <p className="l1-item-count">第 {phraseIndex + 1} / {phrases.length} 条短句</p>
      <div className="l2-phrase-banner" aria-label={`当前短句：${phraseNames}`}>
        <span>{phraseIndex === 0 ? '先往下，再往上' : '从下往上'}</span>
        <strong>{phraseNames}</strong>
      </div>
      <ThreeKeyPiano activePitch={activePitch} showNames />

      {stage === 'support' ? (
        <div className="l2-segment-support">
          <p className="l1-guide">需要的话，先练前两音和后两音；最后都要回到完整短句。</p>
          <div className="l2-segment-choices">
            <button className="btn ghost" onClick={() => {
              draftRef.current.usedSegmentSupport = true
              setStage('segmentFirst')
            }}>分段练一练</button>
            <button className="btn ghost" disabled={supportPlaying} onClick={() => void playSupportDemo()}>再听完整示范</button>
          </div>
          {audioError && <p className="l1-feedback retry" role="alert">声音没有加载好，请再试一次。</p>}
          <button className="btn primary" onClick={() => setStage('final')}>不用分段，完整模仿</button>
        </div>
      ) : stage === 'initial' ? voicePanel(currentPhrase, '这条听完了', result => {
        draftRef.current.initialFull = result
        setStage('support')
      }) : stage === 'segmentFirst' ? voicePanel(currentPhrase.slice(0, 2), '练后两音', result => {
        draftRef.current.segments.push(result)
        setStage('segmentSecond')
      }) : stage === 'segmentSecond' ? voicePanel(currentPhrase.slice(1), '回到完整短句', result => {
        draftRef.current.segments.push(result)
        setStage('final')
      }) : voicePanel(currentPhrase, phraseIndex + 1 < phrases.length ? '练下一条' : '完成这个任务', finishPhrase)}
    </section>
  )
}
