class RmsProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this._accum = 0
    this._count = 0
    this._samplesPerFrame = 960 // ~20ms at 48kHz
  }
  process(inputs) {
    const ch0 = inputs[0]?.[0]
    if (!ch0) return true
    for (let i = 0; i < ch0.length; i++) {
      const s = ch0[i]
      this._accum += s * s
      this._count++
      if (this._count >= this._samplesPerFrame) {
        const rms = Math.sqrt(this._accum / this._count)
        const db = 20 * Math.log10(rms + 1e-12) // dBFS
        this.port.postMessage({ rms, db })
        this._accum = 0; this._count = 0
      }
    }
    return true
  }
}
registerProcessor('rms-processor', RmsProcessor)
