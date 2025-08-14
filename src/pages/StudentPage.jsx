import { useEffect, useMemo, useState } from 'react'
import { useAudioDevices } from '../hooks/useAudioDevices.js'
import { useMicStream } from '../hooks/useMicStream.js'
import { useRmsMeter } from '../hooks/useRmsMeter.js'
import { useVad } from '../hooks/useVad.js'
import { createWs } from '../api/wsClient.js'

export default function StudentPage() {
  // ---------- state ----------
  const { devices, ready } = useAudioDevices()
  const [name, setName] = useState('')
  const [pickedId, setPickedId] = useState('')
  const [ws, setWs] = useState(null)
  const [connected, setConnected] = useState(false)

  // ---------- audio (browser-side) ----------
  const stream = useMicStream(pickedId)
  const { reading } = useRmsMeter(stream)          // { rms, db } every ~20ms
  const db = reading?.db ?? null
  const speaking = useVad(db, { thresholdDb: -45, hangMs: 250, frameMs: 20 })

  const deviceLabel = useMemo(() => {
    return devices.find(d => d.deviceId === pickedId)?.label || (pickedId ? 'Microphone' : '')
  }, [devices, pickedId])

  // ---------- connect / disconnect ----------
  const connect = () => {
    if (!name.trim() || !pickedId) return
    const socket = createWs({ role: 'student' })
    setWs(socket)

    socket.onopen = () => {
      setConnected(true)
      // Announce who we are
      socket.send(JSON.stringify({
        type: 'hello',
        role: 'student',
        studentId: name.trim(),
        sampleRate: 16000,
        deviceLabel,
      }))
      console.log('[student->server] hello sent')
    }

    socket.onmessage = (evt) => {
      try { console.log('[student<-server]', JSON.parse(evt.data)) } catch {}
    }

    const onClose = () => { setConnected(false) }
    socket.onclose = onClose
    socket.onerror = onClose
  }

  const disconnect = () => {
    try { ws?.close() } catch {}
    setWs(null)
    setConnected(false)
  }

  // close WS on tab close
  useEffect(() => {
    const h = () => { try { ws?.close() } catch {} }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [ws])

  // ---------- send metrics every ~100ms ----------
  useEffect(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    let t = null
    const tick = () => {
      const payload = {
        type: 'metrics',
        role: 'student',
        studentId: name.trim(),
        db: typeof db === 'number' ? Math.round(db * 10) / 10 : -120,
        speaking: !!speaking,
        ts: Date.now(),
      }
      try { ws.send(JSON.stringify(payload)) } catch {}
      t = setTimeout(tick, 100)
    }
    tick()
    return () => t && clearTimeout(t)
  }, [ws, db, speaking, name])

  // ---------- send PCM16 audio frames only while speaking ----------
  useEffect(() => {
    if (!stream || !ws) return
    let cancelled = false
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 })

    ;(async () => {
      const source = ctx.createMediaStreamSource(stream)
      const proc = ctx.createScriptProcessor(4096, 1, 1)
      source.connect(proc)
      proc.connect(ctx.destination)

      proc.onaudioprocess = (e) => {
        if (cancelled || !ws || ws.readyState !== WebSocket.OPEN) return
        if (!speaking) return
        const input = e.inputBuffer.getChannelData(0)
        const buf = new ArrayBuffer(input.length * 2)
        const view = new DataView(buf)
        for (let i = 0; i < input.length; i++) {
          let s = Math.max(-1, Math.min(1, input[i]))
          view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
        }
        try { ws.send(buf) } catch {}
      }
    })()

    return () => { cancelled = true; ctx.close() }
  }, [stream, ws, speaking])

  // ---------- UI meter ----------
  const pct = useMemo(() => {
    const v = db ?? -120
    return Math.min(100, Math.max(0, (v + 90) / 90 * 100)) // map -90..0 dBFS → 0..100%
  }, [db])

  return (
    <div className="card">
      <h2>Student</h2>

      <div style={{display:'grid', gap:12, maxWidth:560}}>
        <label>
          Your name
          <input
            style={{width:'100%', marginTop:6, padding:8, borderRadius:8, border:'1px solid #333', background:'#0f1220', color:'#fff'}}
            placeholder="e.g. Student 12"
            value={name}
            onChange={e=>setName(e.target.value)}
          />
        </label>

        <label>
          Pick microphone
          {!ready && <p>Requesting permission…</p>}
          <select
            style={{width:'100%', marginTop:6, padding:8, borderRadius:8, border:'1px solid #333', background:'#0f1220', color:'#fff'}}
            value={pickedId}
            onChange={e=>setPickedId(e.target.value)}
          >
            <option value="">-- choose --</option>
            {devices.map(d => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || 'Microphone'}</option>
            ))}
          </select>
        </label>

        <div style={{display:'flex', gap:8}}>
          <button disabled={!name.trim() || !pickedId || connected} onClick={connect}>
            {connected ? 'Connected' : 'Connect to Teacher'}
          </button>
          <button className="secondary" disabled={!connected} onClick={disconnect}>
            Disconnect
          </button>
        </div>

        <div className="mic-tile" style={{marginTop:12}}>
          <div className="header">
            <strong>{deviceLabel || 'Microphone'}</strong>
            {speaking && <span className="badge">Speaking</span>}
          </div>
          <div className="meter"><div className="bar" style={{ width: `${pct}%` }} /></div>
          <div className="meta">
            <span>{Math.round((db ?? -120) * 10) / 10} dBFS</span>
            <span>{speaking ? '🎤 speaking' : '…'}</span>
          </div>
        </div>

        <p className="sub" style={{marginTop:4}}>
          Browser is computing RMS→dB and VAD locally. Audio frames are sent only while you’re speaking.
        </p>
      </div>
    </div>
  )
}
