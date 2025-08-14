import { useEffect, useMemo, useRef, useState } from 'react'
import { createWs } from '../api/wsClient.js'
import { useAdminStore } from '../store/adminStore.js'

export default function AdminPage() {
  const [ws, setWs] = useState(null)
  const studentsMap = useAdminStore(s => s.students)
  const upsertStudent = useAdminStore(s => s.upsertStudent)
  const rankAndMark = useAdminStore(s => s.rankAndMark)
  const setTranscript = useAdminStore(s => s.setTranscript)
  const clearAll = useAdminStore(s => s.clearAll)
  const connectedRef = useRef(false)

  // open WS once
  useEffect(() => {
    const socket = createWs({ role: 'admin' })
    setWs(socket)

    socket.onopen = () => {
      connectedRef.current = true
      socket.send(JSON.stringify({ type: 'hello', role: 'admin' }))
      console.log('[admin->server] hello sent')
    }

    socket.onclose = () => { connectedRef.current = false }
    socket.onerror = () => { connectedRef.current = false }

    socket.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data)
        // Expected:
        // {type:'hello', role:'student', studentId, deviceLabel}
        // {type:'metrics', studentId, db, speaking}
        // {type:'transcript', studentId, text}
        // (optional) {type:'ranking', order:[{studentId, db}, ...]}

        if (msg.type === 'hello' && msg.role === 'student') {
          upsertStudent({ studentId: msg.studentId, deviceLabel: msg.deviceLabel })
          rankAndMark()
        } else if (msg.type === 'metrics') {
          upsertStudent({ studentId: msg.studentId, db: msg.db, speaking: !!msg.speaking })
          rankAndMark()
        } else if (msg.type === 'transcript') {
          setTranscript(msg.studentId, msg.text)
        } else if (msg.type === 'ranking' && Array.isArray(msg.order)) {
          // If the server sends an explicit ranking, trust it
          const current = Object.values(useAdminStore.getState().students)
          const top = msg.order[0]?.studentId || null
          const next = {}
          for (const s of current) next[s.studentId] = { ...s, isClosest: s.studentId === top }
          useAdminStore.setState({ students: next })
        } else if (msg.type === 'reset') {
          clearAll()
        }
      } catch (e) {
        // non-JSON frames ignored
      }
    }

    return () => socket.close()
  }, [upsertStudent, rankAndMark, setTranscript, clearAll])

  const ordered = useMemo(() => {
    const arr = Object.values(studentsMap)
    return arr.sort((a, b) => {
      const aKey = (a.isClosest ? 1000 : 0) + (a.speaking ? 100 : 0) + a.db
      const bKey = (b.isClosest ? 1000 : 0) + (b.speaking ? 100 : 0) + b.db
      return bKey - aKey
    })
  }, [studentsMap])

  return (
    <>
      <div className="card">
        <h2>Admin Dashboard</h2>
        <p className="sub">Live students ranked by intensity (closest first) • transcripts below each name</p>
        <div style={{ display:'flex', gap:8, marginTop:8 }}>
          <button className="secondary" onClick={clearAll}>Clear list</button>
          {!ws && <span style={{opacity:.7}}>No WS yet</span>}
        </div>
      </div>

      <div className="card">
        <h3>Live Students</h3>
        <ol className="transcripts">
          {ordered.map(s => {
            const pct = Math.min(100, Math.max(0, ( (s.db ?? -120) + 90) / 90 * 100))
            return (
              <li key={s.studentId}>
                <div className="row">
                  <span className="who">
                    {s.studentId} <small style={{opacity:.7}}>· {s.deviceLabel || 'mic'}</small>
                  </span>
                  <span className="tags">
                    {s.isClosest && <em>closest</em>}
                    {s.speaking && <em>speaking</em>}
                    <em>{Number.isFinite(s.db) ? Math.round(s.db) : -120} dBFS</em>
                  </span>
                </div>

                {/* mini meter */}
                <div className="meter" style={{ marginTop: 8 }}>
                  <div className="bar" style={{ width: `${pct}%` }} />
                </div>

                <div className="text" style={{marginTop:8}}>
                  {s.transcript || <i>…waiting…</i>}
                </div>
              </li>
            )
          })}
          {!ordered.length && <li><i>No students connected yet</i></li>}
        </ol>
      </div>
    </>
  )
}
