import { useMemo } from 'react'
import { useSpeakersStore } from '../store/speakersStore.js'

export default function RankedTranscripts() {
  // ✅ Select the map (stable reference), not Object.values directly
  const speakersMap = useSpeakersStore(s => s.speakers)
  const ordered = useMemo(() => {
    const arr = Object.values(speakersMap)
    // Closest + speaking first, then by dB
    return arr.sort((a, b) => {
      const aKey = (a.isClosest ? 1000 : 0) + (a.speaking ? 100 : 0) + a.db
      const bKey = (b.isClosest ? 1000 : 0) + (b.speaking ? 100 : 0) + b.db
      return bKey - aKey
    })
  }, [speakersMap])

  return (
    <div className="card">
      <h3>Ranked Transcriptions (closest → farthest)</h3>
      <ol className="transcripts">
        {ordered.map(s => (
          <li key={s.id}>
            <div className="row">
              <span className="who">{s.label || 'Mic'}</span>
              <span className="tags">
                {s.isClosest && <em>closest</em>}
                {s.speaking && <em>speaking</em>}
                <em>{Math.round(s.db)} dBFS</em>
              </span>
            </div>
            <div className="text">{s.transcript || <i>…waiting…</i>}</div>
          </li>
        ))}
      </ol>
    </div>
  )
}
