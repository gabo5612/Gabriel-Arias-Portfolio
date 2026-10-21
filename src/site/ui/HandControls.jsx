import React, { useEffect, useRef } from 'react'
import { createDwell, createPinchClick, createSwipeDetector, handMode, scrollSpeed } from '../../engine/gestures'
import { fromHand, releaseHand } from '../pointer'

// Todo lo que la mano hace en el sitio, en un solo bucle sobre la señal:
//
//   palma abierta   swipe lateral = otra estación; mano baja o alta = scroll
//   índice (lápiz)  cursor en la punta del dedo; pellizco = clic, o quedarse
//                   1.5 s quieto sobre un link/botón (el anillo se va llenando)
//
// Las acciones pasan por el mismo `go` que el teclado y el clic va al mismo
// elemento que recibiría el mouse, así que la mano no tiene reglas propias.
// Todo se pinta por refs: con la cámara encendida esto corre a 60 fps y React
// no se entera.

const CLICKABLE = 'a[href], button:not([disabled]), [role="button"]'

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

export default function HandControls({ signal, pages, state, go }) {
  const guideRef = useRef(null)
  const fillRRef = useRef(null)
  const fillLRef = useRef(null)
  const capRef = useRef(null)
  const cursorRef = useRef(null)
  // El bucle vive lo que vive el componente; lo que cambia con la navegación
  // se lee de un ref para no reiniciarlo en cada página.
  const live = useRef({ pages, state, go })
  live.current = { pages, state, go }

  useEffect(() => {
    const swipe = createSwipeDetector({ axes: 'x' })
    const pinch = createPinchClick()
    const dwell = createDwell({ ms: 1500 })
    let raf = 0, last = performance.now(), mode = 'none'
    let flashTimer = 0, shown = '', hover = null, carry = 0

    const set = (st, caption, extra = '') => {
      const key = st + caption + extra
      if (key === shown) return
      shown = key
      const g = guideRef.current
      g.dataset.state = st
      g.dataset.scroll = extra
      capRef.current.textContent = caption
    }
    const setHover = el => {
      if (el === hover) return
      hover?.classList.remove('is-hand-hover')
      hover = el
      hover?.classList.add('is-hand-hover')
      cursorRef.current.dataset.over = el ? '1' : ''
    }
    const clickAt = (x, y) => {
      const el = document.elementFromPoint(x, y)?.closest(CLICKABLE)
      // Nada clicable debajo: puede ser la figura. El mundo decide si el
      // pellizco cayó sobre ella (la hace estallar) o en el vacío.
      if (!el) { window.dispatchEvent(new CustomEvent('world-poke', { detail: { x, y } })); return }
      // Un .click() sintético dispara los mismos onClick de React que el mouse.
      el.click()
      el.classList.add('is-hand-press')
      setTimeout(() => el.classList.remove('is-hand-press'), 220)
    }

    const tick = now => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(64, now - last)
      last = now
      const s = signal.current
      const { pages, state, go } = live.current
      const N = pages.length
      mode = handMode(s, mode)

      // ── Cursor ────────────────────────────────────────────────────────────
      const cur = cursorRef.current
      if (mode === 'point') {
        const r = pinch.push(s.pinch ?? 0, (s.px ?? 0.5) * window.innerWidth, (s.py ?? 0.5) * window.innerHeight)
        fromHand(r.x, r.y, now)
        cur.style.transform = `translate3d(${r.x}px, ${r.y}px, 0)`
        cur.style.setProperty('--pinch', (s.pinch ?? 0).toFixed(3))
        cur.dataset.on = '1'
        cur.dataset.down = r.down ? '1' : ''
        setHover(document.elementFromPoint(r.x, r.y)?.closest(CLICKABLE) || null)
        // Mientras el pellizco se cierra no corre el contador: son dos formas
        // de hacer clic y no deben sumarse.
        const dw = r.down || (s.pinch ?? 0) > 0.3 ? { progress: 0, fire: false } : dwell.push(hover, r.x, r.y, now)
        cur.style.setProperty('--dwell', dw.progress.toFixed(3))
        if (r.click) { clickAt(r.x, r.y); dwell.spend(hover) }
        else if (dw.fire) clickAt(r.x, r.y)
      } else {
        cur.dataset.on = ''
        cur.style.setProperty('--dwell', '0')
        pinch.reset()
        dwell.reset()
        releaseHand()
        setHover(null)
      }

      // ── Swipe ─────────────────────────────────────────────────────────────
      const sw = swipe.push(s, now)
      const p = mode === 'open' ? sw.progress : 0
      fillRRef.current.style.transform = `scaleX(${Math.max(0, p)})`
      fillLRef.current.style.transform = `scaleX(${Math.max(0, -p)})`
      if (sw.swipe && mode === 'open') {
        go({ type: 'page', dir: sw.swipe.dir })
        const g = guideRef.current
        g.dataset.flash = sw.swipe.dir > 0 ? 'next' : 'prev'
        clearTimeout(flashTimer)
        flashTimer = setTimeout(() => { delete g.dataset.flash }, 700)
      }

      // ── Scroll con la altura de la mano ───────────────────────────────────
      // Sólo con la palma abierta y sin un swipe a medio hacer: un barrido
      // lateral no debe arrastrar el texto de paso.
      let scrolling = ''
      if (mode === 'open' && Math.abs(sw.progress) < 0.3) {
        const v = scrollSpeed(s.y)
        const el = document.querySelector('.site__main .panel:last-child [data-scroll]')
        if (v && el) {
          // scrollTop es entero en muchos navegadores: se acumula el resto o
          // las velocidades bajas nunca llegan a mover un píxel.
          carry += (v * dt) / 1000
          const step = Math.trunc(carry)
          if (step) { el.scrollTop += step; carry -= step }
          const atEnd = v > 0
            ? el.scrollTop + el.clientHeight >= el.scrollHeight - 1
            : el.scrollTop <= 0
          if (!atEnd) scrolling = v > 0 ? 'down' : 'up'
        } else carry = 0
      }

      const prev = pages[(state.page - 1 + N) % N].label
      const next = pages[(state.page + 1) % N].label
      if (mode === 'none') set('idle', 'Show your hand to the camera')
      else if (mode === 'point') set('point', hover ? 'Hold still to open, or pinch to open now' : 'Point at a link. Pinch, or hold still for 1.5 seconds')
      else if (mode === 'closed') set('closed', 'Open your hand to move, or point your index to use it as a cursor')
      else if (scrolling) set('open', scrolling === 'down' ? 'Scrolling down' : 'Scrolling up', scrolling)
      else set('open', `Swipe for ${prev} or ${next}. Hold your hand low or high to scroll`)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(flashTimer)
      setHover(null)
      releaseHand()
    }
  }, [signal])

  return (
    <>
      <div ref={cursorRef} className="hand-cursor" aria-hidden="true">
        <span className="hand-cursor__dwell" />
        <span className="hand-cursor__ring" />
        <span className="hand-cursor__tip" />
      </div>
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
    </>
  )
}
