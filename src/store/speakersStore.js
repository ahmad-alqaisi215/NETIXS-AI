import { create } from 'zustand'

const DEFAULT = {
  transcript: '',
  label: '',
  db: -120,
  speaking: false,
  isClosest: false,
}

export const useSpeakersStore = create((set, get) => ({
  speakers: {},

  // Only write when values actually change
  upsert: (p) => set((s) => {
    const prev = s.speakers[p.id]
    const next = { ...(prev || DEFAULT), ...p }
    if (prev &&
        prev.label === next.label &&
        prev.speaking === next.speaking &&
        Math.abs(prev.db - next.db) < 0.1 // 0.1 dB hysteresis
    ) {
      return {} // no change → no re-render
    }
    return { speakers: { ...s.speakers, [p.id]: next } }
  }),

  // Mark only if the closest actually changed
  rankAndMark: () => set((s) => {
    const arr = Object.values(s.speakers)
    const speaking = arr.filter(sp => sp.speaking)
    const newClosestId = speaking.length
      ? speaking.reduce((best, cur) => (best && s.speakers[best].db > cur.db ? best : cur.id), null)
      : null

    // Detect if anything would actually change
    let dirty = false
    const next = {}
    for (const sp of arr) {
      const willBeClosest = sp.id === newClosestId
      if (!!sp.isClosest !== !!willBeClosest) dirty = true
      next[sp.id] = { ...sp, isClosest: willBeClosest }
    }
    return dirty ? { speakers: next } : {}
  }),

  setTranscript: (id, text) => set((s) => {
    const sp = s.speakers[id]
    if (!sp || sp.transcript === text) return {}
    return { speakers: { ...s.speakers, [id]: { ...sp, transcript: text } } }
  }),
}))
