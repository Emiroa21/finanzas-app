import { useState } from 'react'
import { checkPin, faceIdEnabled, unlockWithFaceId } from '../lock'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  const press = async (k: string) => {
    if (!k) return
    setError(false)
    if (k === '⌫') return setPin(pin.slice(0, -1))
    const next = (pin + k).slice(0, 6)
    setPin(next)
    if (next.length >= 4 && (await checkPin(next))) onUnlock()
    else if (next.length === 6) {
      setError(true)
      setPin('')
    }
  }

  const faceId = async () => {
    if (await unlockWithFaceId()) onUnlock()
  }

  return (
    <div className="lock">
      <div className="lock-icon">🔒</div>
      <h2>Mis Finanzas</h2>
      <p className="muted">{error ? 'PIN incorrecto' : 'Escribe tu PIN'}</p>
      <div className="pin-dots">
        {Array.from({ length: Math.max(4, pin.length) }, (_, i) => (
          <span key={i} className={i < pin.length ? 'on' : ''} />
        ))}
      </div>
      <div className="keypad lock-pad">
        {KEYS.map((k, i) => (
          <button key={i} onClick={() => press(k)} disabled={!k} aria-label={k === '⌫' ? 'Borrar' : k || undefined}>
            {k}
          </button>
        ))}
      </div>
      {faceIdEnabled() && (
        <button className="primary-btn lock-faceid" onClick={faceId}>
          Usar Face ID
        </button>
      )}
    </div>
  )
}
