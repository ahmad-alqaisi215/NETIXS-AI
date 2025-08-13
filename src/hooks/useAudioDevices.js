import { useEffect, useState } from 'react'

export function useAudioDevices() {
  const [devices, setDevices] = useState([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const load = async () => {
      try { await navigator.mediaDevices.getUserMedia({ audio: true }) } catch {}
      const list = await navigator.mediaDevices.enumerateDevices()
      setDevices(list.filter(d => d.kind === 'audioinput'))
      setReady(true)
    }
    load()
    navigator.mediaDevices.addEventListener('devicechange', load)
    return () => navigator.mediaDevices.removeEventListener('devicechange', load)
  }, [])

  return { devices, ready }
}
