import { useState, useMemo } from 'react'
import DevicePicker from '../components/DevicePicker.jsx'
import MicTile from '../components/MicTile.jsx'
import RankedTranscripts from '../components/RankedTranscripts.jsx'
import { useAudioDevices } from '../hooks/useAudioDevices.js'

export default function Home() {
  const { devices } = useAudioDevices()
  const [opened, setOpened] = useState([])

  const picked = useMemo(() => {
    const map = new Map(opened.map(id => [id, devices.find(d => d.deviceId === id)]))
    return Array.from(map.entries()).filter(([, d]) => !!d).map(([id, d]) => ({
      id, label: d.label || 'Microphone'
    }))
  }, [opened, devices])

  return (
    <>
      {!opened.length && <DevicePicker onPick={setOpened} />}
      {!!opened.length && (
        <>
          <div className="grid">
            {picked.map(p => (
              <MicTile key={p.id} deviceId={p.id} label={p.label} />
            ))}
          </div>
          <RankedTranscripts />
          <button className="secondary" onClick={() => setOpened([])}>Reset devices</button>
        </>
      )}
    </>
  )
}
