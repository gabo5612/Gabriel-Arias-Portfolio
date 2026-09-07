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

export default function PrivacyHUD({ stats, video, mode, onMode, muted, onMute, onStop }) {
  const [net, setNet] = useState(0)
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
  const target = stats?.target || (mode === 'hand' ? 'right hand' : 'head')

  return (
    <div className="hud" role="status" aria-live="polite">
      <div className="hud__head">
        <span className="hud__dot" aria-hidden="true" />
        <strong className="hud__title">
          {!found ? `Show your ${target}` : calibrating ? 'Calibrating…' : 'Tracking locally'}
        </strong>
        <button
          type="button"
          className={`hud__stop hud__sound${muted ? '' : ' hud__sound--on'}`}
          onClick={onMute}
          aria-pressed={!muted}
          title={muted ? 'Turn sound on' : 'Turn sound off'}
        >
          {muted ? 'Sound off' : 'Sound on'}
        </button>
        <button type="button" className="hud__stop" onClick={onStop}>
          Turn off
        </button>
      </div>

      <div className="hud__body">
      <canvas ref={canvasRef} className="hud__preview" aria-label="Webcam preview with detection overlay" />
      <div className="hud__side">
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

      {/* Resumen de una línea. En móvil sustituye a la tabla entera: de las ocho
          filas, sólo dos dicen algo que el visitante necesite — cuánto te ve, y
          que no sale nada del dispositivo. El resto es telemetría para mí. */}
      <p className="hud__compact">
        <span>
          {mode === 'hand'
            ? `${stats?.hands ?? 0}/2 hands · ${(stats?.fingers ?? 0).toFixed(1)}/5`
            : found ? 'head tracked' : 'no head'}
        </span>
        <span className="hud__value--good">
          {net === 0 ? 'nothing left this device' : `${net} requests left`}
        </span>
      </p>
      </div>
      </div>

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
  )
}
