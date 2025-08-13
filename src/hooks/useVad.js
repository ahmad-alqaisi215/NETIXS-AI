import { useEffect, useState } from 'react'

// Energy-based VAD with hangover.
// thresholdDb: lower (e.g., -55) = more sensitive; higher (e.g., -40) = stricter
export function useVad(db, { thresholdDb = -45, hangMs = 250, frameMs = 20 } = {}) {
  const [speaking, setSpeaking] = useState(false)
  const [hang, setHang] = useState(0)

  useEffect(() => {
    if (db == null) return
    const above = db > thresholdDb
    if (above) {
      setSpeaking(true)
      setHang(hangMs)
    } else {
      setHang(h => {
        const next = Math.max(0, h - frameMs)
        if (next === 0) setSpeaking(false)
        return next
      })
    }
  }, [db, thresholdDb, hangMs, frameMs])

  return speaking
}
