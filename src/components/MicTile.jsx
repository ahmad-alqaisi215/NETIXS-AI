export default function MicTile({ deviceId, label }) {
    return (
      <div className="mic-tile">
        <div className="header">
          <strong>{label || 'Microphone'}</strong>
        </div>
        <div className="meter">
          <div className="bar" style={{ width: `0%` }} />
        </div>
        <div className="meta">
          <span>-∞ dBFS</span>
          <span>…</span>
        </div>
      </div>
    )
  }
  