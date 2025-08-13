import { useEffect, useRef, useState } from 'react'

export function useRmsMeter(stream) {
  const [reading, setReading] = useState(null)
  const ctxRef = useRef(null)
  const nodeRef = useRef(null)
  const srcRef = useRef(null)

  useEffect(() => {
    let disposed = false
    ;(async () => {
      if (!stream) return
      const ctx = new AudioContext({ sampleRate: 48000 })
      ctxRef.current = ctx
      await ctx.audioWorklet.addModule('/meter-worklet.js')
      const src = ctx.createMediaStreamSource(stream)
      const worklet = new AudioWorkletNode(ctx, 'rms-processor')
      nodeRef.current = worklet
      srcRef.current = src

      worklet.port.onmessage = (e) => { if (!disposed) setReading(e.data) }

      src.connect(worklet)
      // do NOT route to speakers; leave worklet unconnected to destination
    })()

    return () => {
      disposed = true
      try { nodeRef.current?.disconnect() } catch {}
      try { srcRef.current?.disconnect() } catch {}
      try { ctxRef.current?.close() } catch {}
      nodeRef.current = null; srcRef.current = null; ctxRef.current = null
    }
  }, [stream])

  return { reading } // { rms, db } or null
}
