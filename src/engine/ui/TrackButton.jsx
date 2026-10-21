import React from 'react'

// El botón que enciende la cámara. Es lo único de la página que no se puede
// adivinar leyendo, así que tiene que parecer pulsable: los estilos (respira
// hasta que lo tocás) están en engine.css, .hero__track.
export default function TrackButton({ cam, compact = false, className = '' }) {
  if (!cam.canTrack) return null
  const label = cam.busy
    ? 'Starting…'
    : cam.camOn
      ? 'Stop tracking'
      : compact ? 'Hands' : cam.mode === 'hand' ? 'Move with your hands' : 'Move with your head'
  return (
    <button
      type="button"
      onClick={cam.toggle}
      className={`btn hero__track${cam.camOn ? ' hero__track--on' : ''}${compact ? ' hero__track--compact' : ''} ${className}`}
      aria-pressed={cam.camOn}
      title={compact && !cam.camOn ? 'Move through the site with your hands' : undefined}
    >
      {cam.camOn ? (
        <span className="hero__track-dot" aria-hidden="true" />
      ) : (
        <svg className="hero__track-cam" width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
          <rect x="1" y="4" width="9.5" height="7.5" rx="2" stroke="currentColor" strokeWidth="1.4" />
          <path d="M10.5 7.9l3-1.9v3.5l-3-1.6z" fill="currentColor" />
        </svg>
      )}
      {label}
    </button>
  )
}
