import { useMemo } from 'react'
import { useSpeakersStore } from '../store/speakersStore.js'

export default function RankedTranscripts() {
  const speakers = useSpeakersStore(s => Object.values(s.speakers))
  const ordered = useMemo(() => [...speakers], [speakers])

  return (
    <div className="card">
      <h3>Ranked Transcriptions (closest → farthest)</h3>
      <ol className="transcripts">
        {ordered.map(s => (
          <li key={s.id}>
            <div className="row">
              <span className="who">{s.label || 'Mic'}</span>
              <span className="tags">
                <em>{Math.round(s.db ?? -120)} dBFS</em>
              </span>
            </div>
            <div className="text">{s.transcript || <i>…waiting…</i>}</div>
          </li>
        ))}
      </ol>
    </div>
  )
}
