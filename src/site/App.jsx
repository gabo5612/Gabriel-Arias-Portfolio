import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useDepthSignal } from '../engine/signal/useDepthSignal'
import { useCameraControl } from '../engine/signal/useCameraControl'
import { useTilt } from '../engine/signal/useTilt'
import { experience, profile, projects, skills } from '../content'
import { pageMeta } from '../content/seo'
import { PAGES } from './pages'
import { useNavigation } from './useNavigation'
import { useTextLens } from './useTextLens'
import { useSiteSound, useSound } from './useSiteSound'
import { calibrated } from '../engine/handProfile'
import Nav from './ui/Nav'
import RouteMap from './ui/RouteMap'
import Welcome, { shouldWelcome } from './ui/Welcome'
import { flightMs, PLANE_FLIGHT_MS } from './flight'
import '../styles/engine.css'
import '../styles/site.css'

// three.js y MediaPipe entran sólo por import() diferido: el contenido se
// pinta y se puede leer y navegar antes de que exista el mundo.
const World = React.lazy(() => import('./World'))
const PrivacyHUD = React.lazy(() => import('../engine/ui/PrivacyHUD'))
const HandControls = React.lazy(() => import('./ui/HandControls'))
const Calibration = React.lazy(() => import('./ui/Calibration'))

// El panel sale rápido y entra cuando la cámara ya está frenando: así el texto
// aparece al llegar, no durante el vuelo. Cambiar de ítem dentro de una página
// no vuela, así que entra sin espera.
const panel = {
  enter: ({ dir, fly }) => ({ opacity: 0, x: dir * 28, filter: 'blur(6px)' }),
  center: ({ fly }) => ({
    opacity: 1, x: 0, filter: 'blur(0px)',
    transition: { delay: fly ? flyDelay(fly) : 0.05, duration: 0.55, ease: [0.2, 0.7, 0.2, 1] },
  }),
  exit: ({ dir }) => ({
    opacity: 0, x: dir * -28, filter: 'blur(6px)',
    transition: { duration: 0.22, ease: 'easeIn' },
  }),
}
// `fly` es cuánto dura el vuelo en ms (0 = no vuela; ver flight.js). El
// panel entra cuando la cámara ya está frenando, no a mitad de camino.
const flyDelay = ms => Math.max(0.05, ms / 1000 - 0.75)
const still = { enter: { opacity: 0 }, center: { opacity: 1 }, exit: { opacity: 0 } }

const FAKE_HUD = import.meta.env.DEV && new URLSearchParams(window.location.search).has('fakehud')
  ? { found: true, calibrating: false, target: 'hand', hands: 1, fingers: 4.3, fps: 20, latency: 21, delegate: 'GPU', vw: 480, vh: 360 }
  : null

export default function App() {
  const depth = useDepthSignal()
  // En el sitio la mano no tiene voces propias (el zumbido por dedos del
  // lab): el mundo ya suena con lo que la mano hace, y hay un solo botón.
  const cam = useCameraControl({ ...depth, voices: false })
  const snd = useSound()
  useSiteSound()
  const tilt = useTilt(depth)
  const { state, dir, go } = useNavigation(PAGES)
  const page = PAGES[state.page]
  const [world, setWorld] = useState(false)
  const [calibrating, setCalibrating] = useState(false)
  // Primera carga: el título espera escondido a que el mundo lo forme con
  // partículas. Si se pintara de entrada, se vería aparecer, desaparecer (el
  // mundo lo oculta para formarlo) y volver a aparecer. Sin movimiento
  // reducido y con un tope: si el mundo no llega, el título sale igual.
  const [intro, setIntro] = useState(() =>
    !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  // Primera visita: la bienvenida va delante, y la presentación del título
  // espera a que se cierre (si no, pasaría detrás, sin que nadie la vea).
  // ?nowelcome la salta (pruebas, enlaces para compartir).
  const [welcome, setWelcome] = useState(() =>
    shouldWelcome() && !new URLSearchParams(window.location.search).has('nowelcome'))
  if (welcome) document.documentElement.dataset.welcome = 'on'
  const closeWelcome = useCallback(() => {
    delete document.documentElement.dataset.welcome
    setWelcome(false)
    window.dispatchEvent(new Event('welcome-done'))
  }, [])
  useEffect(() => {
    if (!intro || welcome) return
    const done = () => setIntro(false)
    const id = setTimeout(done, 6000)
    window.addEventListener('world-title', done)
    return () => { clearTimeout(id); window.removeEventListener('world-title', done) }
  }, [intro, welcome])
  const routeRef = useRef(null)
  const mainRef = useRef(null)
  // La lupa de texto sigue al mouse siempre y al dedo cuando apuntás.
  useTextLens(mainRef, !depth.reduced)

  // El mundo se monta con el navegador ocioso, no en el primer pintado.
  useEffect(() => {
    if (depth.reduced) return
    const idle = window.requestIdleCallback || (cb => setTimeout(cb, 600))
    const id = idle(() => setWorld(true), { timeout: 1500 })
    return () => (window.cancelIdleCallback || clearTimeout)(id)
  }, [depth.reduced])

  const onWorldFail = useCallback(() => { setWorld(false); setIntro(false) }, [])
  const onTravel = useCallback((t, flying) => routeRef.current?.travel(t, flying), [])

  const itemTitle = state.item && page.items ? state.item : null
  // El mismo título que el HTML pre-generado de esta ruta (content/seo.js).
  useEffect(() => {
    document.title = pageMeta({ id: page.id, item: state.item }, { profile, projects, experience, skills }).title
  }, [page, state.item])

  const Component = page.Component
  const key = `${page.id}/${state.item || ''}`
  // ¿Este panel llega volando? Se decide una vez por cambio de panel y se
  // congela: App se re-renderiza ~20 veces por segundo con la cámara encendida
  // (las estadísticas del HUD) y la animación de entrada no debe re-decidirse.
  // Cuándo se pidió el biplano por última vez (el botón de Home avisa).
  const planeAt = useRef(-Infinity)
  useEffect(() => {
    const on = () => { planeAt.current = performance.now() }
    window.addEventListener('world-plane', on)
    return () => window.removeEventListener('world-plane', on)
  }, [])
  const shown = useRef({ key, page: state.page, fly: false })
  if (shown.current.key !== key) {
    // Las mismas cuentas que el mundo: en la avenida se cruzan |to − from|
    // estaciones, y si acaba de despegar el biplano, el viaje se estira.
    const n = Math.abs(state.page - shown.current.page)
    const plane = performance.now() - planeAt.current < 4000
    shown.current = { key, page: state.page, fly: plane && n ? PLANE_FLIGHT_MS : flightMs(n) }
  }
  const fly = shown.current.fly

  return (
    <div className={`site${intro ? ' site--intro' : ''}`} data-page={page.id} data-world={world ? 'on' : 'off'}>
      {world && (
        <div className="site__world">
          <Suspense fallback={null}>
            <World signal={depth.signal} pages={PAGES} state={state} dir={dir}
              onFail={onWorldFail} onTravel={onTravel} />
          </Suspense>
        </div>
      )}

      <Nav pages={PAGES} state={state} go={go} cam={cam} tilt={tilt} name={profile.name} />

      <main className="site__main" ref={mainRef}>
        <AnimatePresence mode="wait" custom={{ dir: dir || 1, fly }} initial={false}>
          <motion.section
            key={key}
            className={`panel panel--${page.id}`}
            aria-label={page.label}
            custom={{ dir: dir || 1, fly }}
            variants={depth.reduced ? still : panel}
            initial="enter"
            animate="center"
            exit="exit"
          >
            <div className="panel__scroll" data-scroll>
              <Component state={state} go={go} cam={cam} tilt={tilt} reduced={depth.reduced} />
            </div>
          </motion.section>
        </AnimatePresence>
      </main>

      <RouteMap ref={routeRef} pages={PAGES} state={state} go={go} />

      {(cam.camOn || depth.source === 'hand') && (
        <Suspense fallback={null}>
          <HandControls signal={depth.signal} pages={PAGES} state={state} go={go} paused={calibrating} />
        </Suspense>
      )}
      {/* Sólo en desarrollo: ?fakehud muestra el panel con datos de ejemplo,
          para diseñarlo sin encender la cámara. */}
      {import.meta.env.DEV && !cam.camOn && FAKE_HUD && (
        <Suspense fallback={null}>
          <PrivacyHUD stats={FAKE_HUD} video={null} mode="hand" muted={!snd.on}
            onMute={snd.toggle} onStop={() => {}}
            onCalibrate={() => setCalibrating(true)} calibrated={calibrated} />
        </Suspense>
      )}
      {cam.camOn && (
        <Suspense fallback={null}>
          <PrivacyHUD stats={cam.stats} video={cam.video} mode={cam.mode}
            muted={!snd.on} onMute={snd.toggle} onStop={cam.stop}
            onCalibrate={() => setCalibrating(true)} calibrated={calibrated} />
        </Suspense>
      )}

      {calibrating && (cam.camOn || depth.source === 'hand') && (
        <Suspense fallback={null}>
          <Calibration signal={depth.signal} onClose={() => setCalibrating(false)} />
        </Suspense>
      )}

      {welcome && <Welcome cam={cam} tilt={tilt} onDone={closeWelcome} />}

      <p className="sr-only" aria-live="polite">
        {page.label}{itemTitle ? `: ${itemTitle}` : ''}, section {state.page + 1} of {PAGES.length}
      </p>
    </div>
  )
}
