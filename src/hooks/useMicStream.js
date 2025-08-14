import { useEffect, useRef, useState } from 'react'

export function useMicStream(deviceId) {
  const [stream, setStream] = useState(null)
  const stopRef = useRef(() => {})

  useEffect(() => {
    let active = true

    const open = async () => {
      // If user picked nothing yet, do nothing
      if (!deviceId) return

      // Some browsers label the default device literally as "default" or ""
      const isDefaultLike = deviceId === 'default' || deviceId === ''

      // Build constraints:
      // - If it's a real deviceId, use { exact: deviceId }
      // - If it's "default" (or we want to be lenient), omit deviceId so the browser picks default
      const audioConstraints = {
        channelCount: 1,
        sampleRate: 48000,
        noiseSuppression: false,
        echoCancellation: false,
        autoGainControl: false,
        ...(isDefaultLike ? {} : { deviceId: { exact: deviceId } }),
      }

      let s
      try {
        s = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false })
      } catch (e) {
        console.warn('[useMicStream] exact deviceId failed, retrying without exact…', e)
        // Retry without exact (helps when device was unplugged/renamed/permissions changed)
        try {
          s = await navigator.mediaDevices.getUserMedia({
            audio: {
              channelCount: 1,
              sampleRate: 48000,
              noiseSuppression: false,
              echoCancellation: false,
              autoGainControl: false,
              // no deviceId → let the browser choose
            },
            video: false,
          })
        } catch (e2) {
          console.error('[useMicStream] getUserMedia failed:', e2)
          return
        }
      }

      if (!active) { s.getTracks().forEach(t => t.stop()); return }
      setStream(s)
      console.log('[useMicStream] opened stream for deviceId =', deviceId, 'tracks=', s.getAudioTracks().length)
      stopRef.current = () => s.getTracks().forEach(t => t.stop())
    }

    open()
    return () => { active = false; stopRef.current(); setStream(null) }
  }, [deviceId])

  return stream
}
