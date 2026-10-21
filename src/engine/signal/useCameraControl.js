import { useCallback, useEffect, useRef, useState } from 'react'

// Todo lo que rodea a "encender la cámara": el botón, el modo (mano o cabeza),
// el audio, el error de permiso y lo que el panel de privacidad necesita
// mostrar. Antes vivía dentro del hero; acá lo comparten el sitio y el lab.
//
// Recibe lo que devuelve useDepthSignal(): la señal es una sola por página, y
// quien la crea decide quién más la lee.

export function useCameraControl({ signal, reduced, activateCamera, deactivate }) {
  const [canTrack, setCanTrack] = useState(false)
  // La mano manda por defecto: barre mucho más rango que la cabeza, así que el
  // efecto se nota sin que nadie tenga que adivinar qué hacer.
  const [mode, setModeState] = useState('hand')
  // "La cámara está encendida" y "el modelo encontró algo" son cosas distintas.
  // El panel se ata a la primera: si se atara a la segunda, quedarte fuera de
  // cuadro dejaría la cámara prendida sin panel, sin aviso y sin cómo apagarla.
  const [camOn, setCamOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState(null)
  const [video, setVideo] = useState(null)
  const [muted, setMuted] = useState(false)
  const voicesRef = useRef(null)

  useEffect(() => {
    setCanTrack(!reduced && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia))
    // En efecto y no en el inicializador: con SSR no existe localStorage.
    try { setMuted(localStorage.getItem('heroSound') === 'off') } catch { /* modo privado */ }
  }, [reduced])

  useEffect(() => () => voicesRef.current?.stop(), [])

  const toggleMute = useCallback(() => {
    setMuted(m => {
      const next = !m
      voicesRef.current?.setMuted(next)
      try { localStorage.setItem('heroSound', next ? 'off' : 'on') } catch { /* modo privado */ }
      return next
    })
  }, [])

  const stop = useCallback(() => {
    deactivate(); setCamOn(false); setVideo(null); setStats(null)
    voicesRef.current?.stop()
  }, [deactivate])

  const start = useCallback(async next => {
    setBusy(true); setError(null)
    try {
      await activateCamera(next, { onStats: setStats, onVideo: setVideo })
      setCamOn(true)
      // El audio va con la cámara y por el mismo import diferido: quien no
      // active el tracking no descarga ni ejecuta nada de esto.
      if (!voicesRef.current) {
        const { createHeroVoices } = await import('../audio/heroVoices')
        voicesRef.current = createHeroVoices()
      }
      await voicesRef.current.start(signal)
      voicesRef.current.setMuted(muted)
    } catch (e) {
      setCamOn(false)
      // El caso normal es que hayan dicho que no al permiso. No es un fallo.
      setError(e?.name === 'NotAllowedError'
        ? 'Camera permission denied — the pointer still drives the scene.'
        : 'Could not start the camera on this device.')
    } finally {
      setBusy(false)
    }
  }, [activateCamera, signal, muted])

  const toggle = useCallback(() => {
    if (camOn) { stop(); return }
    start(mode)
  }, [camOn, stop, start, mode])

  // Cambiar de modo en caliente reinicia la fuente; si aún no hay ninguna viva,
  // sólo deja elegido el modo para el próximo arranque.
  const setMode = useCallback(next => {
    setModeState(next)
    setStats(null)
    if (camOn) start(next)
  }, [camOn, start])

  return { canTrack, camOn, busy, error, mode, stats, video, muted, toggle, stop, setMode, toggleMute }
}
