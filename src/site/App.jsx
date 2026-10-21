import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useDepthSignal } from '../engine/signal/useDepthSignal'
import { useCameraControl } from '../engine/signal/useCameraControl'
import { useTilt } from '../engine/signal/useTilt'
import { profile } from '../content'
import { PAGES } from './pages'
import { useNavigation } from './useNavigation'
import { useTextLens } from './useTextLens'
import Nav from './ui/Nav'
import RouteMap from './ui/RouteMap'
import '../styles/engine.css'
import '../styles/site.css'

// three.js y MediaPipe entran sólo por import() diferido: el contenido se
// pinta y se puede leer y navegar antes de que exista el mundo.
const World = React.lazy(() => import('./World'))
const PrivacyHUD = React.lazy(() => import('../engine/ui/PrivacyHUD'))
const HandControls = React.lazy(() => import('./ui/HandControls'))

// El panel sale rápido y entra cuando la cámara ya está frenando: así el texto
// aparece al llegar, no durante el vuelo. Cambiar de ítem dentro de una página
// no vuela, así que entra sin espera.
const panel = {
  enter: ({ dir, fly }) => ({ opacity: 0, x: dir * 28, filter: 'blur(6px)' }),
  center: ({ fly }) => ({
    opacity: 1, x: 0, filter: 'blur(0px)',
    transition: { delay: fly ? 0.75 : 0.05, duration: 0.55, ease: [0.2, 0.7, 0.2, 1] },
  }),
  exit: ({ dir }) => ({
    opacity: 0, x: dir * -28, filter: 'blur(6px)',
    transition: { duration: 0.22, ease: 'easeIn' },
  }),
}
const still = { enter: { opacity: 0 }, center: { opacity: 1 }, exit: { opacity: 0 } }

const FAKE_HUD = import.meta.env.DEV && new URLSearchParams(window.location.search).has('fakehud')
  ? { found: true, calibrating: false, target: 'hand', hands: 1, fingers: 4.3, fps: 20, latency: 21, delegate: 'GPU', vw: 480, vh: 360 }
  : null

export default function App() {
  const depth = useDepthSignal()
  const cam = useCameraControl(depth)
  const tilt = useTilt(depth)
  const { state, dir, go } = useNavigation(PAGES)
  const page = PAGES[state.page]
  const [world, setWorld] = useState(false)
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

  const onWorldFail = useCallback(() => setWorld(false), [])
  const onTravel = useCallback((t, flying) => routeRef.current?.travel(t, flying), [])

  const itemTitle = state.item && page.items ? state.item : null
  useEffect(() => {
    document.title = page.id === 'home' ? `${profile.name}` : `${page.label} · ${profile.name}`
  }, [page])

  const Component = page.Component
  const key = `${page.id}/${state.item || ''}`
  // ¿Este panel llega volando? Se decide una vez por cambio de panel y se
  // congela: App se re-renderiza ~20 veces por segundo con la cámara encendida
  // (las estadísticas del HUD) y la animación de entrada no debe re-decidirse.
  const shown = useRef({ key, page: state.page, fly: false })
  if (shown.current.key !== key) shown.current = { key, page: state.page, fly: shown.current.page !== state.page }
  const fly = shown.current.fly

  return (
    <div className="site" data-page={page.id} data-world={world ? 'on' : 'off'}>
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
          <HandControls signal={depth.signal} pages={PAGES} state={state} go={go} />
        </Suspense>
      )}
      {/* Sólo en desarrollo: ?fakehud muestra el panel con datos de ejemplo,
          para diseñarlo sin encender la cámara. */}
      {import.meta.env.DEV && !cam.camOn && FAKE_HUD && (
        <Suspense fallback={null}>
          <PrivacyHUD stats={FAKE_HUD} video={null} mode="hand" muted={false}
            onMute={() => {}} onStop={() => {}} />
        </Suspense>
      )}
      {cam.camOn && (
        <Suspense fallback={null}>
          <PrivacyHUD stats={cam.stats} video={cam.video} mode={cam.mode}
            muted={cam.muted} onMute={cam.toggleMute} onStop={cam.stop} />
        </Suspense>
      )}

      <p className="sr-only" aria-live="polite">
        {page.label}{itemTitle ? `: ${itemTitle}` : ''}, section {state.page + 1} of {PAGES.length}
      </p>
    </div>
  )
}
