import React, { useCallback, useImperativeHandle, useRef, forwardRef } from 'react'

// La avenida vista desde arriba, con un punto por página y un marcador donde
// está la cámara. No es decoración: es la misma línea sobre la que vuela el
// mundo (World.jsx pone la estación i a i/(N−1) del recorrido), así que el
// marcador recorre el mapa exactamente como la cámara recorre el mundo.
//
// El marcador se mueve por ref desde el bucle del mundo, sin pasar por React.

const W = 132, H = 64, PAD = 10

// t ∈ [0, 1] a lo largo de la avenida → izquierda a derecha en el mapa.
const at = t => [PAD + Math.max(0, Math.min(1, t)) * (W - PAD * 2), H / 2]

const RouteMap = forwardRef(function RouteMap({ pages, state, go }, ref) {
  const markerRef = useRef(null)
  const N = pages.length
  const prev = pages[(state.page - 1 + N) % N]
  const next = pages[(state.page + 1) % N]

  useImperativeHandle(ref, () => ({
    travel(t, flying) {
      const m = markerRef.current
      if (!m) return
      const [x, y] = at(t)
      m.setAttribute('cx', x.toFixed(1))
      m.setAttribute('cy', y.toFixed(1))
      m.dataset.flying = flying ? '1' : ''
    },
  }), [])

  const onDot = useCallback(id => go({ type: 'goto', id }), [go])

  return (
    <nav className="route" aria-label="Previous and next section">
      <button type="button" className="route__step route__step--prev" onClick={() => go({ type: 'page', dir: -1 })}>
        <span aria-hidden="true">‹</span> {prev.label}
      </button>

      <div className="route__map">
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
          <line x1={PAD} y1={H / 2} x2={W - PAD} y2={H / 2} className="route__loop" />
          {pages.map((p, i) => {
            const [x, y] = at(i / (N - 1))
            return <circle key={p.id} cx={x} cy={y} r={i === state.page ? 4 : 2.6}
              className={`route__stop${i === state.page ? ' route__stop--on' : ''}`} />
          })}
          <circle ref={markerRef} cx={at(state.page / (N - 1))[0]} cy={at(state.page / (N - 1))[1]} r="6" className="route__me" />
        </svg>
        {/* Botones invisibles encima de cada parada: el SVG dibuja, el botón
            es lo que el teclado y el lector de pantalla encuentran. */}
        {pages.map((p, i) => {
          const [x, y] = at(i / (N - 1))
          return (
            <button key={p.id} type="button" className="route__hit"
              style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` }}
              aria-label={`Fly to ${p.label}`} title={p.label}
              aria-current={i === state.page ? 'page' : undefined}
              onClick={() => onDot(p.id)} />
          )
        })}
      </div>

      <button type="button" className="route__step route__step--next" onClick={() => go({ type: 'page', dir: 1 })}>
        {next.label} <span aria-hidden="true">›</span>
      </button>
    </nav>
  )
})

export default RouteMap
