import { create } from 'zustand'

export const useSpeakersStore = create((set) => ({
  speakers: {}, // id -> { id, label, db, speaking, isClosest, transcript }
  upsert: (p) => set(s => ({
    speakers: {
      ...s.speakers,
      [p.id]: { transcript: '', label: '', db: -120, speaking: false, isClosest: false, ...(s.speakers[p.id] || {}), ...p }
    }
  })),
  setTranscript: (id, text) => set(s => {
    const sp = s.speakers[id]; if (!sp) return {}
    return { speakers: { ...s.speakers, [id]: { ...sp, transcript: text } } }
  }),
}))
