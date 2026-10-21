import { useEffect } from 'react'
import { fromMouse, pointer } from './pointer'

// La lupa: las palabras cerca del cursor (mouse o dedo) se apartan de él, se
// tuercen y se encienden. Cada palabra del panel es un <span class="w"> (lo genera <Rich>),
// y acá sólo se escriben variables CSS por palabra: --t (0 a 1, cuánto) y
// --dx/--dy (hacia dónde, lejos del cursor). El cómo se ve vive en site.css.
//
// Lecturas primero, escrituras después: medir todas las palabras y luego
// tocar estilos, nunca intercalado, o cada lectura forzaría un layout.
// Las posiciones se cachean relativas al scroll del panel y se re-miden sólo
// cuando cambian las palabras o el tamaño: transformar una palabra no mueve
// las demás, así que no hace falta medir por cuadro.

const RADIUS = { mouse: 190, hand: 220 }

export function useTextLens(rootRef, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const root = rootRef.current
    if (!root) return

    const onMove = e => fromMouse(e.clientX, e.clientY, performance.now())
    const onLeave = () => { if (pointer.source === 'mouse') pointer.x = pointer.y = -1e4 }
    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerleave', onLeave)

    let words = [], cache = [], scroller = null, measuredTop = 0, dirty = true
    const lit = new Set()
    const measure = () => {
      words = Array.from(root.querySelectorAll('.w'))
      scroller = root.querySelector('[data-scroll]')
      measuredTop = scroller ? scroller.scrollTop : 0
      cache = words.map(w => {
        const r = w.getBoundingClientRect()
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, h: r.height }
      })
      dirty = false
    }
    // Cambian las palabras (otra página, otro proyecto) o el layout.
    const mo = new MutationObserver(() => { dirty = true })
    mo.observe(root, { childList: true, subtree: true })
    const onResize = () => { dirty = true }
    window.addEventListener('resize', onResize)
    // Las animaciones de entrada mueven el panel: se re-mide un rato después.
    let settle = setInterval(() => { dirty = true }, 700)

    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (dirty) measure()
      const R = RADIUS[pointer.source] || 0
      const dy = scroller ? scroller.scrollTop - measuredTop : 0
      const px = pointer.x, py = pointer.y

      const next = new Map()
      if (R) {
        for (let i = 0; i < cache.length; i++) {
          const c = cache[i]
          const y = c.y - dy
          if (Math.abs(y - py) > R || Math.abs(c.x - px) > R) continue
          const ex = c.x - px, ey = (y - py) * 1.3
          const d = Math.hypot(ex, ey)
          if (d >= R) continue
          const k = 1 - d / R
          // Dirección desde el cursor: las palabras se apartan como limaduras
          // ante un imán. Justo encima del cursor la dirección no existe; se
          // empuja hacia arriba para que la palabra no tiemble entre lados.
          const inv = d > 1 ? 1 / d : 0
          next.set(words[i], [k * k * (3 - 2 * k), d > 1 ? ex * inv : 0, d > 1 ? ey * inv : -1])
        }
      }
      for (const w of lit) {
        if (next.has(w)) continue
        w.style.removeProperty('--t'); w.style.removeProperty('--dx'); w.style.removeProperty('--dy')
        lit.delete(w)
      }
      for (const [w, [t, ux, uy]] of next) {
        w.style.setProperty('--t', t.toFixed(3))
        w.style.setProperty('--dx', ux.toFixed(3))
        w.style.setProperty('--dy', uy.toFixed(3))
        lit.add(w)
      }
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      clearInterval(settle)
      mo.disconnect()
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('pointerleave', onLeave)
      for (const w of lit) ['--t', '--dx', '--dy'].forEach(p => w.style.removeProperty(p))
    }
  }, [rootRef, enabled])
}
