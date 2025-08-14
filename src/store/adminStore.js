import { create } from 'zustand'

const DEFAULT = { studentId: '', deviceLabel: '', db: -120, speaking: false, isClosest: false, transcript: '' }

export const useAdminStore = create((set, get) => ({
  students: {},

  upsertStudent: (p) => set((s) => {
    const prev = s.students[p.studentId]
    const next = { ...(prev || DEFAULT), ...p }
    if (prev &&
        prev.deviceLabel === next.deviceLabel &&
        prev.speaking === next.speaking &&
        Math.abs(prev.db - next.db) < 0.1 && // small hysteresis
        prev.transcript === next.transcript) {
      return {}
    }
    return { students: { ...s.students, [p.studentId]: next } }
  }),

  // mark exactly one "closest" (if someone is speaking)
  rankAndMark: () => set((s) => {
    const arr = Object.values(s.students)
    const speaking = arr.filter(x => x.speaking)
    const topId = speaking.length
      ? speaking.reduce((best, cur) => {
          if (!best) return cur.studentId
          const b = s.students[best]
          return (b.db > cur.db) ? best : cur.studentId
        }, null)
      : null

    let dirty = false
    const next = {}
    for (const stu of arr) {
      const will = stu.studentId === topId
      if (!!stu.isClosest !== !!will) dirty = true
      next[stu.studentId] = { ...stu, isClosest: will }
    }
    return dirty ? { students: next } : {}
  }),

  setTranscript: (studentId, text) => set((s) => {
    const prev = s.students[studentId]
    if (!prev || prev.transcript === text) return {}
    return { students: { ...s.students, [studentId]: { ...prev, transcript: text } } }
  }),

  clearAll: () => set({ students: {} }),
}))
