import { useEffect, useRef, useState } from 'react'

export function useMicStream(deviceId) {
  const [stream, setStream] = useState(null)
  const stopRef = useRef(() => {})

  useEffect(() => {
    let active = true
    const open = async () => {
      if (!deviceId) return
      const s = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: deviceId },
          channelCount: 1,
          sampleRate: 48000,
          noiseSuppression: false,
          echoCancellation: false,
          autoGainControl: false,
        },
        video: false,
      })
      if (!active) { s.getTracks().forEach(t => t.stop()); return }
      setStream(s)
      stopRef.current = () => s.getTracks().forEach(t => t.stop())
    }
    open()
    return () => { active = false; stopRef.current(); setStream(null) }
  }, [deviceId])

  return stream
}
