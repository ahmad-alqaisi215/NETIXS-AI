import { create } from 'zustand'

export const useSpeakersStore = create((set, get) => ({
  speakers: {}, // id -> { id, label, db, speaking, isClosest, transcript }
  upsert: (p) => set(s => ({
    speakers: {
      ...s.speakers,
      [p.id]: { transcript: '', label: '', db: -120, speaking: false, isClosest: false, ...(s.speakers[p.id] || {}), ...p }
    }
  })),
  rankAndMark: () => set(s => {
    const arr = Object.values(s.speakers)
    arr.forEach(sp => sp.isClosest = false)
    const speaking = arr.filter(sp => sp.speaking)
    if (speaking.length) {
      speaking.sort((a, b) => b.db - a.db)
      speaking[0].isClosest = true
    }
    const next = {}
    arr.forEach(sp => next[sp.id] = sp)
    return { speakers: next }
  }),
  setTranscript: (id, text) => set(s => {
    const sp = s.speakers[id]; if (!sp) return {}
    return { speakers: { ...s.speakers, [id]: { ...sp, transcript: text } } }
  }),
}))
