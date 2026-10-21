import React, { useEffect, useRef } from 'react'
import { createSwipeDetector } from '../../engine/gestures'

// La guía del swipe del lab, conectada a la navegación: el detector corre en
// su propio rAF leyendo la señal, pinta el medidor por refs y, cuando hay
// swipe, llama al mismo `go` que el teclado. Horizontal cambia de página;
// vertical recorre los ítems donde los hay.

const HandIcon = () => (
  <svg viewBox="0 0 40 48" width="30" height="36" aria-hidden="true">
    <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 26V10a2.5 2.5 0 0 1 5 0v12" />
      <path d="M17 21V6a2.5 2.5 0 0 1 5 0v15" />
      <path d="M22 21V8a2.5 2.5 0 0 1 5 0v14" />
      <path d="M27 22v-9a2.5 2.5 0 0 1 5 0v15c0 9-5.5 15-13 15-5 0-8-2.5-11-7l-5-8a2.6 2.6 0 0 1 4.3-2.9L12 29" />
    </g>
  </svg>
)

export default function GestureGuide({ signal, pages, state, go }) {
  const guideRef = useRef(null)
  const fillRRef = useRef(null)
  const fillLRef = useRef(null)
  const capRef = useRef(null)
  // El rAF vive lo que vive el componente; lo que cambia con la navegación se
  // lee de un ref para no reiniciarlo en cada página.
  const live = useRef({ pages, state, go })
  live.current = { pages, state, go }

  useEffect(() => {
    const det = createSwipeDetector({ axes: 'xy' })
    let raf = 0, flashTimer = 0, shown = ''
    const set = (state, caption) => {
      const g = guideRef.current
      if (!g) return
      const key = state + caption
      if (key === shown) return
      shown = key
      g.dataset.state = state
      capRef.current.textContent = caption
    }
    const tick = now => {
      raf = requestAnimationFrame(tick)
      const { pages, state, go } = live.current
      const N = pages.length
      const hasItems = !!pages[state.page].items?.length
      const r = det.push(signal.current, now)

      const p = r.progress
      fillRRef.current.style.transform = `scaleX(${Math.max(0, p)})`
      fillLRef.current.style.transform = `scaleX(${Math.max(0, -p)})`

      const prev = pages[(state.page - 1 + N) % N].label
      const next = pages[(state.page + 1) % N].label
      if (r.state === 'idle') set('idle', 'Show your hand to the camera')
      else if (r.state === 'closed') set('closed', 'Open your hand to move')
      else set('open', `Swipe left for ${prev}, right for ${next}${hasItems ? '. Up or down to browse' : ''}`)

      if (r.swipe) {
        if (r.swipe.axis === 'x') go({ type: 'page', dir: r.swipe.dir })
        else if (hasItems) go({ type: 'item', dir: r.swipe.dir })
        const g = guideRef.current
        g.dataset.flash = r.swipe.axis === 'x' ? (r.swipe.dir > 0 ? 'next' : 'prev') : 'item'
        clearTimeout(flashTimer)
        flashTimer = setTimeout(() => { delete g.dataset.flash }, 700)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); clearTimeout(flashTimer) }
  }, [signal])

  return (
    <div ref={guideRef} className="gesture" data-state="idle" aria-hidden="true">
      <div className="gesture__stage">
        <span className="gesture__arrow gesture__arrow--l">‹</span>
        <span className="gesture__hand"><HandIcon /></span>
        <span className="gesture__arrow gesture__arrow--r">›</span>
      </div>
      <div className="gesture__meter">
        <span ref={fillLRef} className="gesture__fill gesture__fill--l" />
        <span ref={fillRRef} className="gesture__fill gesture__fill--r" />
        <span className="gesture__notch" />
      </div>
      <span ref={capRef} className="gesture__caption" />
    </div>
  )
}
