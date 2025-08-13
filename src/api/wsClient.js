export function createWs({ deviceIdList = [] } = {}) {
    const defaultUrl = (location.protocol === 'https:' ? 'wss://' : 'ws://') + 'localhost:8000/asr'
    const url = import.meta.env.VITE_WS_URL || defaultUrl
    const ws = new WebSocket(url)
    ws.binaryType = 'arraybuffer'
    ws.onopen = () => {
      // initial handshake so backend knows who is sending what
      ws.send(JSON.stringify({
        type: 'hello',
        client: 'closest-speaker-ui',
        sampleRate: 16000,
        devices: deviceIdList, // optional
      }))
    }
    return ws
  }
  