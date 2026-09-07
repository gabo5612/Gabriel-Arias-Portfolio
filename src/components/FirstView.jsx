import React, { useCallback, useEffect, useRef, useState, Suspense } from "react";
import "../styles/firstView.css";
import { motion } from "framer-motion";
import { useDepthSignal } from "../hooks/useDepthSignal";
import { useParallaxLayers } from "../hooks/useParallaxLayers";

// three.js entra sólo por aquí. scripts/verify-budget.mjs falla el build si
// aparece en un chunk del primer render.
const DepthLattice = React.lazy(() => import("./hero/DepthLattice"));
const PrivacyHUD  = React.lazy(() => import("./hero/PrivacyHUD"));

/* ── Typewriter hook ── */
const ROLES = [
  "AI Engineer",
  "Front-end Developer",
  "Full-Stack Developer",
  "Web Producer",
  "React Specialist",
  "WordPress Expert",
];

function useTypewriter(words, speed = 75, deleteSpeed = 45, pause = 2000) {
  const [text,       setText]       = useState('');
  const [wordIdx,    setWordIdx]    = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaused,   setIsPaused]   = useState(false);

  useEffect(() => {
    const word = words[wordIdx % words.length];

    if (isPaused) {
      const t = setTimeout(() => { setIsPaused(false); setIsDeleting(true); }, pause);
      return () => clearTimeout(t);
    }

    const t = setTimeout(() => {
      if (!isDeleting) {
        const next = word.substring(0, text.length + 1);
        setText(next);
        if (next === word) setIsPaused(true);
      } else {
        const next = word.substring(0, text.length - 1);
        setText(next);
        if (next === '') { setIsDeleting(false); setWordIdx(i => i + 1); }
      }
    }, isDeleting ? deleteSpeed : speed);

    return () => clearTimeout(t);
  }, [text, wordIdx, isDeleting, isPaused, words, speed, deleteSpeed, pause]);

  return text;
}

/* ── Framer variants ── */
const container = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
};

const item = {
  hidden:  { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0,  transition: { duration: 0.65, ease: [0.4, 0, 0.2, 1] } },
};

/* El typewriter llama a setText por cada letra: ~13 renders por segundo. Vive
   aislado y memoizado para que ese ritmo no arrastre a FirstView, cuyos hijos
   incluyen una escena de WebGL que reconstruirse cuesta carísimo. */
const RoleLine = React.memo(function RoleLine() {
  const role = useTypewriter(ROLES);
  return (
    <motion.div className="hero__role-wrapper" variants={item} aria-live="polite">
      <span className="hero__role-prefix">I build</span>
      <span className="hero__role">{role}</span>
      <span className="hero__role-cursor" aria-hidden="true" />
    </motion.div>
  );
});

export default function FirstView() {
  const rootRef = useRef(null);

  const { signal, source, reduced, activateCamera, activateGyro, deactivate } = useDepthSignal();
  useParallaxLayers(rootRef, signal, !reduced);

  const [lattice, setLattice] = useState(false);
  const [stats, setStats]     = useState(null);
  const [video, setVideo]     = useState(null);
  const [busy,  setBusy]      = useState(false);
  const [error, setError]     = useState(null);
  const [canTrack, setCanTrack] = useState(false);
  // La mano manda por defecto: barre mucho más rango que la cabeza, así que el
  // efecto se nota sin que nadie tenga que adivinar qué hacer.
  const [mode, setMode] = useState('hand');
  // "La cámara está encendida" y "el modelo encontró algo" son cosas distintas.
  // El panel se ata a la primera: si se atara a la segunda, quedarte fuera de
  // cuadro dejaría la cámara prendida sin panel, sin aviso y sin cómo apagarla.
  const [camOn, setCamOn] = useState(false);
  const [muted, setMuted] = useState(false);
  const voicesRef = useRef(null);

  // Estable a propósito: si cambia de identidad, DepthLattice desmonta y vuelve
  // a montar toda la escena de three.
  const onLatticeFail = useCallback(() => setLattice(false), []);

  // El 3D se monta cuando el navegador está ocioso, no en el primer pintado:
  // así lo ve todo el mundo sin que three.js compita con el LCP.
  useEffect(() => {
    if (reduced) return;
    const idle = window.requestIdleCallback || (cb => setTimeout(cb, 1200));
    const id = idle(() => setLattice(true), { timeout: 2500 });
    return () => (window.cancelIdleCallback || clearTimeout)(id);
  }, [reduced]);

  useEffect(() => {
    setCanTrack(!!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia));
    // Se lee en efecto y no en el inicializador de useState: durante el SSR de
    // Gatsby no existe localStorage y el build reventaría.
    try { setMuted(localStorage.getItem('heroSound') === 'off'); } catch { /* modo privado */ }
  }, []);

  const onMute = useCallback(() => {
    setMuted(m => {
      const next = !m;
      voicesRef.current?.setMuted(next);
      try { localStorage.setItem('heroSound', next ? 'off' : 'on'); } catch { /* modo privado */ }
      return next;
    });
  }, []);

  const tracking = camOn;

  useEffect(() => () => voicesRef.current?.stop(), []);

  const onStopTracking = useCallback(() => {
    deactivate(); setCamOn(false); setVideo(null); setStats(null);
    voicesRef.current?.stop();
  }, [deactivate]);

  const start = useCallback(async next => {
    setBusy(true); setError(null);
    try {
      await activateCamera(next, { onStats: setStats, onVideo: setVideo });
      setCamOn(true);
      // El audio va con la cámara y por el mismo import diferido: quien no
      // active el tracking no descarga ni ejecuta nada de esto.
      if (!voicesRef.current) {
        const { createHeroVoices } = await import('../lib/heroVoices');
        voicesRef.current = createHeroVoices();
      }
      await voicesRef.current.start(signal);
      voicesRef.current.setMuted(muted);
    } catch (e) {
      setCamOn(false);
      // El caso normal es que hayan dicho que no al permiso. No es un fallo.
      setError(e?.name === 'NotAllowedError'
        ? 'Camera permission denied — the pointer still drives the scene.'
        : 'Could not start the camera on this device.');
    } finally {
      setBusy(false);
    }
  }, [activateCamera, signal, muted]);

  const onTrack = useCallback(() => {
    if (tracking) { onStopTracking(); return; }
    start(mode);
  }, [tracking, onStopTracking, start, mode]);

  // Cambiar de modo en caliente reinicia la fuente; si aún no hay ninguna viva,
  // sólo deja elegido el modo para el próximo arranque.
  const onMode = useCallback(next => {
    setMode(next);
    setStats(null);
    if (tracking) start(next);
  }, [tracking, start]);

  return (
    <section className="hero" id="home" aria-label="Hero" ref={rootRef}>

      {/* Animated background */}
      <div className="hero__bg" aria-hidden="true">
        <div className="hero__layer" data-depth="1">
          <div className="hero__grid" />
        </div>
        <div className="hero__layer" data-depth="0.7">
          <div className="hero__blob hero__blob--1" />
          <div className="hero__blob hero__blob--2" />
          <div className="hero__blob hero__blob--3" />
        </div>
        {/* La retícula no lleva data-depth: mueve su propio frustum. */}
        {lattice && (
          <Suspense fallback={null}>
            <DepthLattice signal={signal} onFail={onLatticeFail} />
          </Suspense>
        )}
      </div>

      {/* Content — el wrapper toma el parallax para no pisar los transforms
          que framer-motion escribe en los hijos. */}
      <div className="hero__parallax" data-depth="-0.16">
        <motion.div
          className="hero__content"
          variants={container}
          initial="hidden"
          animate="visible"
        >
          {/* Status */}
          <motion.div className="hero__status" variants={item}>
            <div className="hero__status-dot" aria-hidden="true" />
            Available for work
          </motion.div>

          {/* Greeting */}
          <motion.p className="hero__greeting" variants={item}>
            Hi, I'm
          </motion.p>

          {/* Name */}
          <motion.h1 className="hero__name" variants={item}>
            Gabriel Arias
          </motion.h1>

          {/* Typewriter */}
          <RoleLine />

          {/* Description */}
          <motion.p className="hero__description" variants={item}>
            Full-stack developer passionate about crafting clean, performant web experiences.
            Specializing in React, WordPress, Shopify, and modern web technologies since 2014.
          </motion.p>

          {/* CTAs */}
          <motion.div className="hero__actions" variants={item}>
            <a href="#projects" className="btn btn-primary">
              View My Work
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2.5 7h9M7 2.5l4.5 4.5L7 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
            <a href="#contact" className="btn btn-ghost">
              Contact Me
            </a>

            {canTrack && !reduced && (
              <button
                type="button"
                onClick={onTrack}
                className={`btn hero__track${tracking ? ' hero__track--on' : ''}`}
                aria-pressed={tracking}
              >
                <span className="hero__track-dot" aria-hidden="true" />
                {busy
                  ? 'Starting…'
                  : tracking
                    ? 'Stop tracking'
                    : mode === 'hand' ? 'Move with your hands' : 'Move with your head'}
              </button>
            )}
          </motion.div>

          {error && <motion.p className="hero__track-error" variants={item}>{error}</motion.p>}

          {/* Sin esto la función es adivinanza: la cámara enciende y nadie sabe
              qué gesto hace qué. Tres frases, sólo mientras está activa. */}
          {camOn && !error && (
            <p className="hero__hint">
              {mode === 'hand' ? (
                <>
                  <span><b>Open your hand</b> to widen the field</span>
                  <span><b>Make a fist</b> to close it</span>
                  <span><b>Move closer</b> to zoom in</span>
                </>
              ) : (
                <>
                  <span><b>Lean side to side</b> to look around</span>
                  <span><b>Move closer</b> to zoom in</span>
                </>
              )}
            </p>
          )}

          {/* Scroll indicator */}
          <motion.div className="hero__scroll" variants={item} aria-hidden="true">
            <div className="hero__scroll-indicator">
              <div className="hero__scroll-dot" />
            </div>
            <span>Scroll down</span>
          </motion.div>
        </motion.div>
      </div>

      {camOn && (
        <Suspense fallback={null}>
          <PrivacyHUD
            stats={stats}
            video={video}
            mode={mode}
            onMode={onMode}
            muted={muted}
            onMute={onMute}
            onStop={onStopTracking}
          />
        </Suspense>
      )}

    </section>
  );
}
