import React, { useEffect, useRef, useState } from 'react'
import { DEFAULTS, deriveProfile, profile, resetProfile, saveProfile } from '../../engine/handProfile'

// Calibración de la mano: seis poses, unos segundos cada una, y los umbrales
// salen de lo medido (engine/handProfile.js → deriveProfile).
//
// Cada paso sólo avanza mientras la mano está en algo parecido a la pose
// pedida (`need`, con márgenes amplios): así un cuadro con la mano a medio
// entrar o haciendo otra cosa no ensucia la muestra. El progreso se pinta por
// ref; React sólo se entera al cambiar de paso.

const STEPS = [
  { id: 'open', say: 'Open your hand, palm to the camera', need: s => s.fingers >= 3, ms: 1600 },
  { id: 'fist', say: 'Now close it into a fist', need: s => s.fingers <= 2.4, ms: 1600 },
  { id: 'point', say: 'Point with your index, like holding a pencil', need: s => s.rIdx > 0.35 && s.rOth < 1.8, ms: 1600 },
  { id: 'pinch', say: 'Touch your thumb to the tip of your index', need: s => s.rPinch < 0.5, ms: 1400 },
  { id: 'swipe', say: 'Open hand, swipe sideways twice — like turning a page', swipe: true },
  { id: 'low', say: 'Hold your open hand low, where scrolling should start', need: s => s.fingers >= 3 && s.y > 0.1, ms: 1600 },
]
const SWIPES = 2
const SWIPE_TIMEOUT = 9000

export default function Calibration({ signal, onClose }) {
  const [step, setStep] = useState(0)
  const [result, setResult] = useState(null)
  const ringRef = useRef(null)
  const samples = useRef({ open: [], fist: [], point: [], pinch: [], low: [], swipes: [] })

  useEffect(() => {
    if (result || step >= STEPS.length) return
    const cur = STEPS[step]
    let raf = 0, held = 0, last = performance.now(), began = last
    const hist = []
    let peak = 0, quietSince = 0

    const advance = () => setStep(i => i + 1)
    const tick = now => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(64, now - last)
      last = now
      const s = signal.current
      const present = s.source === 'hand' && s.hands > 0
      let p = 0

      if (cur.swipe) {
        // Un swipe es el mayor recorrido de x en 320 ms; se registra cuando la
        // mano vuelve a quedarse quieta, para medir el gesto entero.
        if (present && s.fingers >= 3) {
          hist.push({ t: now, x: s.x })
          while (hist.length && now - hist[0].t > 320) hist.shift()
          const span = Math.abs(s.x - hist[0].x)
          if (span > peak) peak = span
          if (span < 0.05) {
            if (!quietSince) quietSince = now
            if (peak > 0.15 && now - quietSince > 150) { samples.current.swipes.push(peak); peak = 0 }
          } else quietSince = 0
        }
        p = samples.current.swipes.length / SWIPES
        if (samples.current.swipes.length >= SWIPES || now - began > SWIPE_TIMEOUT) { advance(); return }
      } else {
        if (present && cur.need(s)) {
          held += dt
          samples.current[cur.id].push({
            fingers: s.fingers, rIdx: s.rIdx, rOth: s.rOth, rPinch: s.rPinch, y: s.y,
          })
        }
        p = held / cur.ms
        if (p >= 1) { advance(); return }
      }
      if (ringRef.current) ringRef.current.style.setProperty('--p', Math.min(1, p).toFixed(3))
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [step, result, signal])

  // Último paso medido: se derivan y se guardan los umbrales.
  useEffect(() => {
    if (step < STEPS.length || result) return
    const p = deriveProfile(samples.current)
    saveProfile(p)
    setResult(p)
  }, [step, result])

  const pct = (v, d) => `${v > d ? '+' : ''}${Math.round(((v - d) / d) * 100)}%`

  return (
    <div className="calib" role="dialog" aria-modal="false" aria-labelledby="calib-title">
      <h2 id="calib-title" className="calib__title">
        {result ? 'Tuned to your hand' : 'Tune to your hand'}
      </h2>

      {!result ? (
        <>
          <div ref={ringRef} className="calib__ring" aria-hidden="true">
            <span className="calib__count">{step + 1}<small> / {STEPS.length}</small></span>
          </div>
          <p className="calib__say" aria-live="polite">{STEPS[step]?.say}</p>
          <p className="calib__hint">It only counts while your hand is in the pose.</p>
          <div className="calib__actions">
            <button type="button" className="btn btn-ghost" onClick={() => setStep(i => i + 1)}>Skip this one</button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </>
      ) : (
        <>
          <p className="calib__say">Saved in this browser only. Nothing left your device.</p>
          <dl className="calib__summary">
            <div><dt>Swipe distance</dt><dd>{pct(result.swipe.dx, DEFAULTS.swipe.dx)}</dd></div>
            <div><dt>Scroll starts</dt><dd>{pct(result.scroll.dead, DEFAULTS.scroll.dead)}</dd></div>
            <div><dt>Open hand at</dt><dd>{result.open.toFixed(1)} fingers</dd></div>
            <div><dt>Pinch closes at</dt><dd>{profile.pinch.near.toFixed(2)}</dd></div>
          </dl>
          <div className="calib__actions">
            <button type="button" className="btn btn-primary" onClick={onClose}>Done</button>
            <button type="button" className="btn btn-ghost" onClick={() => { resetProfile(); onClose() }}>Use the defaults</button>
          </div>
        </>
      )}
    </div>
  )
}
