import { useCallback, useEffect, useRef, useState } from 'react'
import { HOME, isKnownPath, parseHash, parsePath, same, step, toPath } from './router'

// Estado de navegación + todas las entradas que no son la mano. La mano entra
// por GestureGuide, que llama al mismo `go`: todas pasan por step() y nadie
// inventa reglas propias.
//
// `dir` es hacia dónde fue el último movimiento (+1 adelante, -1 atrás, 0 sin
// sentido, como un clic en el mapa): el mundo lo usa para elegir por qué lado
// del circuito volar y el panel para entrar por el lado correcto.

const SCROLLER = '[data-scroll]'
const WHEEL_GAP = 260      // ms sin eventos = empieza otro gesto de rueda
const WHEEL_DIST = 70      // recorrido acumulado que dispara
const WHEEL_LOCK = 1200    // tras cambiar de página, la rueda no vuelve a disparar antes

function isTyping(el) {
  return el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
}

// ¿Puede este scroller moverse más en esa dirección? Si puede, la rueda es
// suya; sólo en el borde pasa a ser navegación.
function canScroll(el, dy) {
  if (!el) return false
  if (dy > 0) return el.scrollTop + el.clientHeight < el.scrollHeight - 2
  return el.scrollTop > 2
}

// Dónde vive el sitio ('/' o la subcarpeta de GitHub Pages).
const BASE = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/'

// El estado que dice la URL. Un enlace viejo con hash (#/projects/crew) manda
// sobre la ruta y se reescribe a la ruta nueva, sin entrada de historial; una
// ruta desconocida vuelve a la primera página y también se corrige.
function fromLocation(pages) {
  if (typeof window === 'undefined') return HOME
  const { hash, pathname } = window.location
  if (/^#\//.test(hash)) {
    const state = parseHash(hash, pages)
    window.history.replaceState(null, '', toPath(state, pages, BASE))
    return state
  }
  if (!isKnownPath(pathname, pages, BASE)) {
    window.history.replaceState(null, '', toPath(HOME, pages, BASE))
    return HOME
  }
  return parsePath(pathname, pages, BASE)
}

export function useNavigation(pages, { onChange } = {}) {
  const [nav, setNav] = useState(() => ({ state: fromLocation(pages), dir: 0 }))
  const navRef = useRef(nav)
  navRef.current = nav

  const go = useCallback(action => {
    const cur = navRef.current.state
    const next = step(cur, action, pages)
    if (same(next, cur)) return
    let dir = 0
    if (action.type === 'page') dir = action.dir
    else if (next.page === cur.page) {
      const items = pages[cur.page].items || []
      dir = items.indexOf(next.item) >= items.indexOf(cur.item) ? 1 : -1
    }
    window.history.pushState(null, '', toPath(next, pages, BASE))
    setNav({ state: next, dir })
  }, [pages])

  // Atrás/adelante del navegador, o un hash viejo pegado a mano.
  useEffect(() => {
    const onPop = () => {
      const next = fromLocation(pages)
      if (!same(next, navRef.current.state)) setNav({ state: next, dir: 0 })
    }
    window.addEventListener('popstate', onPop)
    window.addEventListener('hashchange', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('hashchange', onPop)
    }
  }, [pages])

  useEffect(() => { onChange?.(nav) }, [nav, onChange])

  // ── Teclado ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = e => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return
      const page = pages[navRef.current.state.page]
      const hasItems = !!page.items?.length
      let action = null
      if (e.key === 'ArrowRight') action = { type: 'page', dir: 1 }
      else if (e.key === 'ArrowLeft') action = { type: 'page', dir: -1 }
      // Arriba/abajo sólo se roban donde hay ítems; en el resto siguen
      // desplazando el panel como siempre.
      else if (hasItems && e.key === 'ArrowDown') action = { type: 'item', dir: 1 }
      else if (hasItems && e.key === 'ArrowUp') action = { type: 'item', dir: -1 }
      else if (e.key === 'Escape') action = { type: 'close' }
      else if (/^[1-9]$/.test(e.key) && pages[+e.key - 1]) action = { type: 'goto', id: pages[+e.key - 1].id }
      if (!action) return
      e.preventDefault()
      go(action)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pages, go])

  // ── Rueda / trackpad ──────────────────────────────────────────────────────
  // Un gesto de rueda = como mucho una página. La inercia de un trackpad sigue
  // mandando eventos durante un segundo; sin esto, una pasada cruzaría tres
  // estaciones. Y si el gesto empezó con el panel pudiendo desplazarse, es del
  // panel entero, aunque llegue al borde a mitad de camino.
  useEffect(() => {
    let last = 0, acc = 0, fired = false, owned = false, firedAt = -Infinity
    const onWheel = e => {
      if (e.ctrlKey) return                     // pinch-zoom del trackpad
      const now = performance.now()
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      // El hueco entre eventos se mide en tiempo de reloj, y justo después de
      // cambiar de página el hilo principal puede trabarse (monta el panel, el
      // mundo arma la figura): los eventos del MISMO gesto llegan con un hueco
      // artificial y parecerían otro gesto. Hasta WHEEL_LOCK después de
      // disparar, todo es continuación.
      if (now - last > WHEEL_GAP && now - firedAt > WHEEL_LOCK) {
        acc = 0; fired = false
        owned = canScroll(e.target.closest?.(SCROLLER), e.deltaY)
      }
      last = now
      if (owned || fired) return
      acc += d
      if (Math.abs(acc) > WHEEL_DIST) {
        fired = true; firedAt = now
        go({ type: 'page', dir: acc > 0 ? 1 : -1 })
      }
    }
    window.addEventListener('wheel', onWheel, { passive: true })
    return () => window.removeEventListener('wheel', onWheel)
  }, [go])

  // ── Touch ─────────────────────────────────────────────────────────────────
  // Sólo el swipe horizontal navega: el vertical es del panel.
  useEffect(() => {
    let x0 = 0, y0 = 0, t0 = 0, onWorld = false
    const onStart = e => {
      const p = e.touches[0]
      x0 = p.clientX; y0 = p.clientY; t0 = performance.now()
      // Sobre la figura, arrastrar la gira: no es un swipe de navegación.
      onWorld = !!e.target.closest?.('.world')
    }
    const onEnd = e => {
      if (onWorld) return
      const p = e.changedTouches[0]
      const dx = p.clientX - x0, dy = p.clientY - y0
      if (performance.now() - t0 > 700) return
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.4) return
      go({ type: 'page', dir: dx < 0 ? 1 : -1 })
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchend', onEnd)
    }
  }, [go])

  return { ...nav, go }
}
