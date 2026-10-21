import React from 'react'
import { useSound } from '../useSiteSound'

// Sonido sí o no. Se recuerda en este navegador.
export default function SoundButton({ className = '' }) {
  const { on, toggle } = useSound()
  const label = on ? 'Turn sound off' : 'Turn sound on'
  return (
    <button type="button" className={`sound-btn ${className}`} onClick={toggle}
      aria-pressed={on} aria-label={label} title={label}>
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path d="M3 7h2.5L9 4v10l-3.5-3H3z" fill="currentColor" />
        {on ? (
          <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="sound-btn__waves">
            <path d="M11.5 6.6a3.4 3.4 0 0 1 0 4.8" />
            <path d="M13.6 4.6a6.2 6.2 0 0 1 0 8.8" />
          </g>
        ) : (
          <path d="M12 7l4 4m0-4l-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        )}
      </svg>
    </button>
  )
}
