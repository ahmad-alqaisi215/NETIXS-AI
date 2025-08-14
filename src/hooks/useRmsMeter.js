import { useEffect, useRef, useState } from 'react'

// Live RMS/dBFS from a MediaStream using an AudioWorklet
export function useRmsMeter(stream) {
  const [reading, setReading] = useState(null)
  const ctxRef = useRef(null)
  const nodeRef = useRef(null)
  const srcRef = useRef(null)
  const sinkRef = useRef(null)

  useEffect(() => {
    let disposed = false
    ;(async () => {
      if (!stream) return

      // 1) Create context and ensure it runs
      const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 })
      ctxRef.current = ctx

      try {
        // 2) Load the worklet module (no public/ copy needed with URL import)
        await ctx.audioWorklet.addModule(new URL('../audio/meter-worklet.js', import.meta.url))
      } catch (err) {
        console.error('[useRmsMeter] Failed to load worklet module:', err)
        return
      }

      // 3) Build graph: mic -> worklet -> zeroGain -> destination
      const src = ctx.createMediaStreamSource(stream)
      const worklet = new AudioWorkletNode(ctx, 'rms-processor')
      const zeroGain = ctx.createGain()
      zeroGain.gain.value = 0

      nodeRef.current = worklet
      srcRef.current = src
      sinkRef.current = zeroGain

      worklet.port.onmessage = (e) => {
        if (!disposed) setReading(e.data) // { rms, db }
      }

      src.connect(worklet)
      worklet.connect(zeroGain)
      zeroGain.connect(ctx.destination)

      // 4) Some browsers start suspended; resume it
      if (ctx.state === 'suspended') {
        try {
          await ctx.resume()
          console.log('[useRmsMeter] AudioContext resumed')
        } catch (e) {
          console.warn('[useRmsMeter] Could not resume AudioContext:', e)
        }
      }
      console.log('[useRmsMeter] Worklet running')
    })()

    return () => {
      disposed = true
      try { nodeRef.current?.disconnect() } catch {}
      try { srcRef.current?.disconnect() } catch {}
      try { sinkRef.current?.disconnect() } catch {}
      try { ctxRef.current?.close() } catch {}
      nodeRef.current = null; srcRef.current = null; sinkRef.current = null; ctxRef.current = null
    }
  }, [stream])

  return { reading }  // { rms, db } or null
}
