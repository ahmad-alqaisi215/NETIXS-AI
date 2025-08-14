import { useMemo, useEffect } from 'react'
import { useMicStream } from '../hooks/useMicStream.js'
import { useRmsMeter } from '../hooks/useRmsMeter.js'
import { useVad } from '../hooks/useVad.js'
import { useSpeakersStore } from '../store/speakersStore.js'

export default function MicTile({ deviceId, label, ws }) {
  const stream = useMicStream(deviceId)
  const { reading } = useRmsMeter(stream)
  const db = reading?.db ?? null
  const speaking = useVad(db, { thresholdDb: -45, hangMs: 250, frameMs: 20 })

  const upsert = useSpeakersStore(s => s.upsert)
  const rankAndMark = useSpeakersStore(s => s.rankAndMark)
  const isClosest = useSpeakersStore(s => s.speakers[deviceId]?.isClosest)

  useEffect(() => {
    upsert({ id: deviceId, label, db: db ?? -120, speaking })
    // Re-rank only when speaking toggles OR significant dB change (handled in upsert hysteresis)
    rankAndMark()
  }, [db, speaking, deviceId, label, upsert, rankAndMark])

  // Optional: send PCM only when this mic is closest
  useEffect(() => {
    if (!stream) return
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 })
    let cancelled = false

    ;(async () => {
      const source = ctx.createMediaStreamSource(stream)
      const processor = ctx.createScriptProcessor(4096, 1, 1)
      source.connect(processor)
      processor.connect(ctx.destination)

      processor.onaudioprocess = (e) => {
        if (cancelled || !ws || ws.readyState !== WebSocket.OPEN) return
        if (!isClosest) return
        const input = e.inputBuffer.getChannelData(0)
        const buf = new ArrayBuffer(input.length * 2)
        const view = new DataView(buf)
        for (let i = 0; i < input.length; i++) {
          let s = Math.max(-1, Math.min(1, input[i]))
          view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
        }
        ws.send(buf)
      }
    })()

    return () => { cancelled = true; ctx.close() }
    // ✅ depends only on isClosest boolean, not the whole speakers map
  }, [stream, ws, isClosest])
  
  const meter = useMemo(() => {
    const v = db ?? -120
    const pct = Math.min(100, Math.max(0, (v + 90) / 90 * 100))
    return { v, pct }
  }, [db])

  return (
    <div className={`mic-tile ${isClosest ? 'closest' : ''}`}>
      <div className="header">
        <strong>{label || 'Microphone'}</strong>
        {isClosest && <span className="badge">Closest</span>}
      </div>
      <div className="meter"><div className="bar" style={{ width: `${meter.pct}%` }} /></div>
      <div className="meta">
        <span>{Math.round((db ?? -120) * 10) / 10} dBFS</span>
        <span>{speaking ? '🎤 speaking' : '…'}</span>
      </div>
    </div>
  )
}
