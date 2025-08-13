import { useState } from 'react'
import { useAudioDevices } from '../hooks/useAudioDevices.js'

export default function DevicePicker({ onPick }) {
  const { devices, ready } = useAudioDevices()
  const [selected, setSelected] = useState([])

  const toggle = (id) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  return (
    <div className="card">
      <h3>Pick microphones</h3>
      {!ready && <p>Requesting permission…</p>}
      <ul className="list">
        {devices.map(d => (
          <li key={d.deviceId}>
            <label>
              <input
                type="checkbox"
                checked={selected.includes(d.deviceId)}
                onChange={() => toggle(d.deviceId)}
              />
              {d.label || 'Microphone'}
            </label>
          </li>
        ))}
      </ul>
      <button disabled={!selected.length} onClick={() => onPick(selected)}>Open Selected</button>
    </div>
  )
}
