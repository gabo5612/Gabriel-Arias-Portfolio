import React from 'react'

// En el teléfono, la cámara frontal mirando tu mano es incómoda: el gesto
// natural es inclinar el aparato. Este botón enciende el giroscopio (iOS pide
// permiso desde un toque, por eso es un botón y no automático).
export default function TiltButton({ tilt, compact = false, className = '' }) {
  if (!tilt.available) return null
  return (
    <button
      type="button"
      onClick={tilt.toggle}
      className={`btn hero__track${tilt.on ? ' hero__track--on' : ''}${compact ? ' hero__track--compact' : ''} ${className}`}
      aria-pressed={tilt.on}
    >
      {tilt.on ? <span className="hero__track-dot" aria-hidden="true" /> : (
        <svg className="hero__track-cam" width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
          <rect x="4" y="1.5" width="7" height="12" rx="1.6" stroke="currentColor" strokeWidth="1.4" transform="rotate(-14 7.5 7.5)" />
        </svg>
      )}
      {tilt.on ? 'Stop tilt' : compact ? 'Tilt' : 'Tilt your phone to look around'}
    </button>
  )
}
