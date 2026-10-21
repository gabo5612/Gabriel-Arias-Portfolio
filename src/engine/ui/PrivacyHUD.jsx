import React, { useEffect, useRef, useState } from 'react'

// El panel es el argumento, no un adorno de debug.
//
// "Los datos no salen de la máquina" es la tesis del CV. Acá se demuestra en la
// máquina de quien mira: el contador de peticiones lo alimenta un
// PerformanceObserver real desde el instante en que arranca el tracking, no un
// cero escrito a mano. Si algún día alguien mete una llamada saliente en el
// bucle, este número la delata solo.

// Esqueleto de la mano, tal como los conecta MediaPipe. Se dibuja para que se
// vea que el modelo entiende la mano entera, no sólo un punto promedio.
const BONES = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
]

function Row({ label, value, good }) {
  return (
    <div className="hud__row">
      <span className="hud__label">{label}</span>
      <span className={`hud__value${good ? ' hud__value--good' : ''}`}>{value}</span>
    </div>
  )
}

export default function PrivacyHUD({ stats, video, mode, onMode, muted, onMute, onStop, onCalibrate, calibrated }) {
  const [net, setNet] = useState(0)
  // Cerrado por defecto: el panel acompaña, no compite con la página.
  const [more, setMore] = useState(false)
  const canvasRef = useRef(null)
  const statsRef = useRef(stats)
  statsRef.current = stats

  // Cuenta desde que se monta, y este componente se monta cuando el tracking ya
  // está vivo — el modelo se descargó antes, así que no se le imputa.
  useEffect(() => {
    if (typeof PerformanceObserver === 'undefined') return
    const here = window.location.origin
    const obs = new PerformanceObserver(list => {
      const out = list.getEntries().filter(e => !e.name.startsWith(here) && !e.name.startsWith('blob:') && !e.name.startsWith('data:'))
      if (out.length) setNet(n => n + out.length)
    })
    try { obs.observe({ type: 'resource', buffered: false }) } catch { return }
    return () => obs.disconnect()
  }, [])

  // Previsualización con la detección encima. Verse a uno mismo con el recuadro
  // o el esqueleto es lo que convence de que funciona; un número no.
  // stats se lee de un ref para que el efecto no se reinicie en cada cuadro.
  useEffect(() => {
    if (!video || !canvasRef.current) return
    const cv = canvasRef.current
    const ctx = cv.getContext('2d')
    let raf = 0
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const vw = video.videoWidth, vh = video.videoHeight
      if (!vw) return
      if (cv.width !== vw) { cv.width = vw; cv.height = vh }

      ctx.save()
      ctx.translate(vw, 0); ctx.scale(-1, 1)   // espejo: la gente espera verse como en un espejo
      ctx.drawImage(video, 0, 0, vw, vh)

      const s = statsRef.current
      // Ámbar la mano que manda la cámara, turquesa la segunda: con las dos en
      // cuadro hay que poder decir de un vistazo cuál mueve la vista.
      const skeleton = (lm, stroke, dotFill) => {
        ctx.strokeStyle = stroke
        ctx.lineWidth = 2
        ctx.beginPath()
        for (const [a, b] of BONES) {
          if (!lm[a] || !lm[b]) continue
          ctx.moveTo(lm[a].x * vw, lm[a].y * vh)
          ctx.lineTo(lm[b].x * vw, lm[b].y * vh)
        }
        ctx.stroke()
        ctx.fillStyle = dotFill
        for (const p of lm) {
          ctx.beginPath(); ctx.arc(p.x * vw, p.y * vh, 2.5, 0, 6.283); ctx.fill()
        }
      }
      if (s?.lm) {
        // Los landmarks vienen normalizados 0..1, así que escalan solos.
        skeleton(s.lm, '#f5a524', '#ffe6b8')
        if (s.lm2) skeleton(s.lm2, '#2dd4bf', '#c7fff4')
      } else if (s?.box) {
        ctx.strokeStyle = '#f5a524'
        ctx.lineWidth = 2
        ctx.strokeRect(s.box.originX, s.box.originY, s.box.width, s.box.height)
      }
      ctx.restore()
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [video])

  const calibrating = stats?.calibrating
  const found = stats?.found
  const target = stats?.target || (mode === 'hand' ? 'hand' : 'head')
  const status = !found ? `Show your ${target}` : calibrating ? 'Calibrating…' : 'Local'

  return (
    <div className={`hud${more ? ' hud--more' : ''}`} role="status" aria-live="polite">
      {/* Lo único siempre visible: la cámara, con el estado y los dos
          controles encima. Lo que prueba que nada sale (el contador) va en la
          etiqueta; el resto de la telemetría, detrás de "More". */}
      <div className="hud__cam">
        <canvas ref={canvasRef} className="hud__preview" aria-label="Webcam preview with detection overlay" />
        <span className="hud__badge">
          <span className="hud__dot" aria-hidden="true" />
          {status}
          {found && !calibrating && (
            <span className={net === 0 ? 'hud__value--good' : 'hud__value--bad'}>
              {net === 0 ? ' · 0 sent' : ` · ${net} sent`}
            </span>
          )}
        </span>
        <div className="hud__tools">
          <button
            type="button"
            className={`hud__icon${muted ? '' : ' hud__icon--on'}`}
            onClick={onMute}
            aria-pressed={!muted}
            aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
            title={muted ? 'Turn sound on' : 'Turn sound off'}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2 6h2.5L8 3v10L4.5 10H2z" fill="currentColor" />
              {muted
                ? <path d="M11 6l4 4M15 6l-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                : <path d="M10.5 5.5a3.5 3.5 0 010 5M12.5 3.5a6.3 6.3 0 010 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />}
            </svg>
          </button>
          <button type="button" className="hud__icon" onClick={onStop} aria-label="Turn the camera off" title="Turn the camera off">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 2v6M4.5 4.5a5 5 0 107 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className="hud__bar">
        {/* Sin calibrar, la invitación se ve sin abrir nada: es lo que más
            mejora la experiencia y cuesta veinte segundos. */}
        {onCalibrate && (
          <button type="button" className="hud__tune" onClick={onCalibrate}>
            {calibrated ? 'Recalibrate' : 'Tune to your hand'}
          </button>
        )}
        <button type="button" className="hud__more" aria-expanded={more} onClick={() => setMore(m => !m)}>
          {more ? 'Less' : 'More'}
        </button>
      </div>

      {more && (
        <div className="hud__details">
          {/* Sin onMode no hay selector: el sitio sólo usa la mano; el lab
              conserva la cabeza para la retícula de profundidad. */}
          {onMode && (
            <div className="hud__modes" role="group" aria-label="Tracking source">
              <button
                type="button"
                className={`hud__mode${mode === 'hand' ? ' hud__mode--on' : ''}`}
                aria-pressed={mode === 'hand'}
                onClick={() => onMode('hand')}
              >
                Hands
              </button>
              <button
                type="button"
                className={`hud__mode${mode === 'face' ? ' hud__mode--on' : ''}`}
                aria-pressed={mode === 'face'}
                onClick={() => onMode('face')}
              >
                Head
              </button>
            </div>
          )}
          <div className="hud__rows">
            {mode === 'hand' && (
              <>
                <Row label="Hands" value={`${stats?.hands ?? 0} / 2`} />
                <Row
                  label="Fingers up"
                  value={
                    stats?.hands > 1
                      ? `${(stats?.fingers ?? 0).toFixed(1)} + ${(stats?.fingers2 ?? 0).toFixed(1)}`
                      : `${(stats?.fingers ?? 0).toFixed(1)} / 5`
                  }
                />
              </>
            )}
            <Row label="Detection" value={`${stats?.fps ?? 0} fps`} />
            <Row
              label="Compute"
              value={`${stats?.delegate ?? '—'} · ${stats?.vw ?? 0}×${stats?.vh ?? 0}`}
            />
            <Row label="Latency" value={`${Math.round(stats?.latency ?? 0)} ms`} />
            <Row label="Left this device" value={net === 0 ? '0 requests' : `${net} requests`} good={net === 0} />
            <Row label="Uploaded" value="0 bytes" good />
            <Row label="Model" value="WASM, in your browser" good />
            <Row label="Audio" value={muted ? 'muted' : 'synthesised live'} />
          </div>
          <p className="hud__note">
            Enforced, not promised: this page ships a <code>connect-src 'self'</code> policy,
            so the browser itself refuses any outbound call.
          </p>
        </div>
      )}
    </div>
  )
}
