import { useEffect } from 'react'

// Escribe el transform de cada capa [data-depth] directo al DOM, dentro de un
// solo rAF. Nunca pasa por estado de React: a 60 fps eso repintaría el hero
// entero sesenta veces por segundo para mover unos pocos píxeles.
//
// El data-depth va SIEMPRE en un wrapper, nunca en el elemento que ya tiene una
// animación CSS propia: escribir style.transform sobre un blob con `animation:
// float` le pisa el keyframe y lo deja quieto. Profundidad negativa = la capa
// se mueve en contra de las demás, que es lo que vende el volumen.
export function useParallaxLayers(rootRef, signal, enabled = true) {
  useEffect(() => {
    const root = rootRef.current
    if (!root || !enabled) return

    const layers = Array.from(root.querySelectorAll('[data-depth]')).map(el => ({
      el, d: parseFloat(el.dataset.depth) || 0,
    }))
    if (!layers.length) return

    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const s = signal.current
      for (const { el, d } of layers) {
        const tx = (-s.x * 38 * d).toFixed(2)
        const ty = (-s.y * 26 * d).toFixed(2)
        const ry = (s.x * 2.6 * d).toFixed(3)
        const rx = (-s.y * 1.9 * d).toFixed(3)
        el.style.transform =
          `translate3d(${tx}px, ${ty}px, 0) rotateY(${ry}deg) rotateX(${rx}deg)`
      }
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      layers.forEach(({ el }) => { el.style.transform = '' })
    }
  }, [rootRef, signal, enabled])
}
