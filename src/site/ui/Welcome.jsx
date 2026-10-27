import React, { useEffect, useRef } from 'react'
import { sound } from '../../engine/audio/worldSound'
import { prefetchVision } from '../../engine/signal/prefetchVision'

// La pantalla de bienvenida: lo único que no se puede descubrir mirando es
// que el sitio suena y que se maneja con la mano. Se dice una vez, antes de
// entrar, y el mismo botón que lo explica lo enciende (un clic es lo que el
// navegador exige para el audio y para pedir la cámara).
//
// Se muestra en la primera visita; después se recuerda en este navegador.

export const WELCOME_KEY = 'welcomed'

export function shouldWelcome() {
  try { return localStorage.getItem(WELCOME_KEY) !== '1' } catch { return false }
}

const SpeakerArt = () => (
  <svg className="welcome__art" viewBox="0 0 64 64" aria-hidden="true">
    <path d="M14 26h8l11-9v30l-11-9h-8z" fill="currentColor" />
    {[0, 1, 2].map(i => (
      <path key={i} className="welcome__wave" style={{ '--i': i }}
        d={`M${40 + i * 6} ${22 - i * 4}a${12 + i * 6} ${12 + i * 6} 0 0 1 0 ${20 + i * 8}`}
        fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    ))}
  </svg>
)

const HandArt = () => (
  <svg className="welcome__art welcome__art--hand" viewBox="0 0 64 64" aria-hidden="true">
    <g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M24 36V18a3 3 0 0 1 6 0v14" />
      <path d="M30 31V13a3 3 0 0 1 6 0v18" />
      <path d="M36 31V16a3 3 0 0 1 6 0v16" />
      <path d="M42 32v-9a3 3 0 0 1 6 0v17c0 10-6 17-15 17-6 0-9.5-3-13-8l-6-9.5a3 3 0 0 1 5-3.4L24 40" />
    </g>
    <path className="welcome__trail" d="M8 12c6-6 12 6 18 0s12 6 18 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
)

const TiltArt = () => (
  <svg className="welcome__art welcome__art--tilt" viewBox="0 0 64 64" aria-hidden="true">
    <rect x="22" y="10" width="20" height="44" rx="4" fill="none" stroke="currentColor" strokeWidth="2.6" />
    <circle cx="32" cy="48" r="1.8" fill="currentColor" />
  </svg>
)

export default function Welcome({ cam, tilt, onDone }) {
  const first = useRef(null)
  useEffect(() => { first.current?.focus({ preventScroll: true }) }, [])
  // La bienvenida ofrece la cámara: mientras se lee, el modelo ya baja.
  useEffect(() => { if (!tilt.available && cam.canTrack) prefetchVision() }, [tilt.available, cam.canTrack])
  const phone = tilt.available
  const canMove = phone || cam.canTrack

  const enter = ({ withSound, withMove }) => {
    try { localStorage.setItem(WELCOME_KEY, '1') } catch { /* modo privado */ }
    sound.setOn(withSound)
    if (withSound) sound.unlock()
    if (withMove) { if (phone) { if (!tilt.on) tilt.toggle() } else if (!cam.camOn) cam.toggle() }
    onDone()
  }

  return (
    <div className="welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="welcome__card">
        <h1 id="welcome-title" className="welcome__title">
          This portfolio is a place you fly through.
        </h1>
        <ul className="welcome__list">
          <li className="welcome__item">
            <SpeakerArt />
            <p><strong>Turn the sound on.</strong> Every page has its own tone, and everything you touch answers back.</p>
          </li>
          {canMove && (
            <li className="welcome__item">
              {phone ? <TiltArt /> : <HandArt />}
              {phone
                ? <p><strong>Tilt your phone</strong> to look around the world.</p>
                : <p><strong>Turn your camera on</strong> and steer with your hand: swipe to fly, point to click. The video stays on this device. Nothing is sent.</p>}
            </li>
          )}
        </ul>
        <div className="welcome__actions">
          <button ref={first} type="button" className="btn btn-primary"
            onClick={() => enter({ withSound: true, withMove: canMove })}>
            {canMove ? (phone ? 'Enter with sound and tilt' : 'Enter with sound and camera') : 'Enter with sound'}
          </button>
          {canMove && (
            <button type="button" className="btn btn-ghost" onClick={() => enter({ withSound: true, withMove: false })}>
              Sound only
            </button>
          )}
          <button type="button" className="welcome__quiet" onClick={() => enter({ withSound: false, withMove: false })}>
            Enter without either
          </button>
        </div>
      </div>
    </div>
  )
}
