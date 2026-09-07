import { useCallback, useEffect, useRef, useState } from 'react'

// Una sola señal de profundidad, cuatro fuentes intercambiables. Los consumidores
// —las capas del hero, la cámara de la escena 3D— no saben cuál está activa.
//
// El valor vive en un ref y NO en estado. A 60 fps, estado de React serían 60
// re-renders por segundo del hero entero; con un ref, el bucle escribe y los
// consumidores leen sin que React se entere. Lo único que sí es estado es
// `source`, que cambia un puñado de veces por sesión y sí tiene que repintar la UI.
//
// Convención: x, y, z, yaw y pitch viven todos en [-1, 1]. x positivo = derecha,
// y positivo = abajo (como el eje de pantalla), z positivo = más cerca.

const clamp = (v, lo = -1, hi = 1) => Math.min(hi, Math.max(lo, v))

// fingers arranca en 5, no en 0: es el valor "neutro" de mano abierta. Las
// fuentes que no tienen dedos —puntero, giroscopio, deriva ociosa— lo dejan ahí
// y el atractor conserva su tamaño normal.
const ZERO = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, fingers: 5, x2: 0, y2: 0, fingers2: 0, hands: 0 }

export function useDepthSignal() {
  // Lo que leen los consumidores: ya suavizado.
  const signal = useRef({ ...ZERO, source: 'idle' })
  // Lo que escriben las fuentes: crudo, sin suavizar.
  const target = useRef({ ...ZERO })
  const sourceRef = useRef('idle')
  const stopCam = useRef(null)
  const [source, setSource] = useState('idle')
  const [reduced, setReduced] = useState(false)

  // ── prefers-reduced-motion ────────────────────────────────────────────────
  // Congela la señal en cero. No basta con no animar: si el usuario ya había
  // activado la cámara, hay que soltarla también.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduced(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  // ── Fuente: puntero ───────────────────────────────────────────────────────
  // Siempre escuchando y gratis. Cede el paso en cuanto hay una fuente mejor:
  // si la cara está activa, mover el mouse no debe pelearse con la cabeza.
  useEffect(() => {
    if (reduced) return
    const onMove = e => {
      if (sourceRef.current !== 'idle' && sourceRef.current !== 'pointer') return
      if (sourceRef.current !== 'pointer') {
        sourceRef.current = 'pointer'
        setSource('pointer')
      }
      target.current.x = clamp((e.clientX / window.innerWidth) * 2 - 1)
      target.current.y = clamp((e.clientY / window.innerHeight) * 2 - 1)
      target.current.z = 0
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [reduced])

  // ── Bucle: deriva ociosa + suavizado ──────────────────────────────────────
  useEffect(() => {
    if (reduced) {
      signal.current = { ...ZERO, source: 'reduced' }
      return
    }
    let raf = 0
    const tick = now => {
      raf = requestAnimationFrame(tick)
      const src = sourceRef.current

      // Sin nadie interactuando, el hero respira solo. Dos senos de periodo
      // primo entre sí para que el recorrido no se note cíclico.
      if (src === 'idle') {
        target.current.x = Math.sin(now / 7300) * 0.42
        target.current.y = Math.cos(now / 9700) * 0.3
        target.current.z = 0
      }

      // El suavizado del bucle es deliberadamente flojo: la fuente `face` ya
      // llega filtrada con one-euro, y encimarle un lerp fuerte le devolvería
      // el lag que ese filtro existe para quitar.
      const k = (src === 'face' || src === 'hand') ? 0.22 : 0.075
      const s = signal.current
      s.x += (target.current.x - s.x) * k
      s.y += (target.current.y - s.y) * k
      s.z += (target.current.z - s.z) * k
      s.yaw += (target.current.yaw - s.yaw) * k
      s.pitch += (target.current.pitch - s.pitch) * k
      s.fingers += (target.current.fingers - s.fingers) * k
      s.x2 += (target.current.x2 - s.x2) * k
      s.y2 += (target.current.y2 - s.y2) * k
      s.fingers2 += (target.current.fingers2 - s.fingers2) * k
      // hands es un conteo, no una magnitud: interpolarlo daría 1,5 manos.
      s.hands = target.current.hands
      s.source = src
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [reduced])

  // ── Volver a ocioso ───────────────────────────────────────────────────────
  const deactivate = useCallback(() => {
    if (stopCam.current) {
      stopCam.current()          // libera la cámara de verdad
      stopCam.current = null
    }
    Object.assign(target.current, ZERO)
    sourceRef.current = 'idle'
    setSource('idle')
  }, [])

  // ── Fuente: cámara (mano o cabeza) ────────────────────────────────────────
  // El import es dinámico a propósito: mantiene MediaPipe fuera del bundle de
  // la página. scripts/verify-budget.mjs falla el build si eso deja de ser así.
  const activateCamera = useCallback(async (mode = 'hand', opts = {}) => {
    if (reduced) return
    // Cambiar de modo con una fuente viva: se suelta la anterior primero, o
    // quedarían dos detectores escribiendo sobre el mismo target.
    if (stopCam.current) { stopCam.current(); stopCam.current = null }
    const { startCameraSource } = await import('../lib/cameraSource')
    stopCam.current = await startCameraSource(mode, pose => {
      Object.assign(target.current, pose)
      if (sourceRef.current !== mode) {
        sourceRef.current = mode
        setSource(mode)
      }
    }, opts)
  }, [reduced])

  // ── Fuente: giroscopio ────────────────────────────────────────────────────
  // iOS 13+ exige pedir permiso desde un gesto del usuario; en el resto el
  // permiso no existe y basta con suscribirse.
  const activateGyro = useCallback(async () => {
    if (reduced || typeof DeviceOrientationEvent === 'undefined') return false
    const ask = DeviceOrientationEvent.requestPermission
    if (typeof ask === 'function') {
      try {
        if ((await ask()) !== 'granted') return false
      } catch {
        return false
      }
    }
    const onTilt = e => {
      if (e.gamma == null || e.beta == null) return
      // gamma ∈ [-90, 90] izquierda/derecha · beta ∈ [-180, 180] adelante/atrás.
      // Se recorta a ±35°, que es todo el rango que alguien inclina un teléfono
      // mientras mira la pantalla — más allá ya no está viendo el hero.
      target.current.x = clamp(e.gamma / 35)
      target.current.y = clamp((e.beta - 45) / 35)
      target.current.z = 0
    }
    window.addEventListener('deviceorientation', onTilt)
    sourceRef.current = 'gyro'
    setSource('gyro')
    stopCam.current = () => window.removeEventListener('deviceorientation', onTilt)
    return true
  }, [reduced])

  // Soltar la cámara si el componente se va: un unmount no debe dejar el LED
  // del portátil encendido.
  useEffect(() => () => { if (stopCam.current) stopCam.current() }, [])

  return { signal, source, reduced, activateCamera, activateGyro, deactivate }
}
