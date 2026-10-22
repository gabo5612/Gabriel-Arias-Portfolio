import { PerspectiveCamera, Scene, WebGLRenderer } from 'three'

// El ciclo de vida que repetían las tres escenas del lab, en un solo sitio:
// crear el renderer (y rendirse con elegancia si no hay WebGL), seguir el
// tamaño del contenedor, pausar cuando no se ve y soltar todo al desmontar.
//
// Una escena nueva sólo escribe lo suyo: qué meter en `scene` y qué hacer por
// cuadro. Devuelve null si no hay WebGL — quien llama decide qué mostrar.
//
// Este archivo importa three: sólo debe alcanzarse por import() dinámico.

export function createStage(host, {
  fov = 45, z = 900, antialias = false, maxDpr = 1.75,
} = {}) {
  let renderer
  try {
    renderer = new WebGLRenderer({ antialias, alpha: true, powerPreference: 'high-performance' })
  } catch {
    return null
  }
  if (!renderer.getContext()) { renderer.dispose(); return null }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr))
  renderer.setClearColor(0x000000, 0)
  host.appendChild(renderer.domElement)

  const scene = new Scene()
  const camera = new PerspectiveCamera(fov, 1, 1, 4000)
  camera.position.set(0, 0, z)

  const size = { w: 1, h: 1 }
  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight
    if (!w || !h) return
    size.w = w; size.h = h
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  resize()
  const ro = new ResizeObserver(resize)
  ro.observe(host)

  let visible = true, awake = document.visibilityState === 'visible'
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting }, { rootMargin: '80px' })
  io.observe(host)
  const onVis = () => { awake = document.visibilityState === 'visible' }
  document.addEventListener('visibilitychange', onVis)

  // Media anchura visible en el plano z = 0, en unidades de mundo. Es lo que
  // necesita quien quiere poner algo "a un tercio de la pantalla" sin pensar
  // en la proyección.
  const halfWidth = () =>
    Math.tan((camera.fov * Math.PI) / 360) * camera.position.z * camera.aspect

  let raf = 0, last = 0
  const disposables = []

  return {
    renderer, scene, camera, size, halfWidth,
    // Lo que se registre acá se libera solo al final.
    own(...items) { disposables.push(...items); return items[0] },
    start(update) {
      const tick = now => {
        raf = requestAnimationFrame(tick)
        // Fuera de pantalla o con la pestaña oculta no se pinta nada: el
        // ventilador del portátil de quien mira lo agradece.
        if (!visible || !awake) { last = now; return }
        const dt = Math.min(64, now - (last || now))
        last = now
        update(now, dt)
        renderer.render(scene, camera)
      }
      raf = requestAnimationFrame(tick)
    },
    dispose() {
      cancelAnimationFrame(raf)
      io.disconnect(); ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      disposables.forEach(d => d.dispose?.())
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
