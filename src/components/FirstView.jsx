import React, { useCallback, useEffect, useRef, useState, Suspense } from "react";
import "../styles/firstView.css";
import { useDepthSignal } from "../hooks/useDepthSignal";

// three.js entra sólo por aquí. scripts/verify-budget.mjs falla el build si
// aparece en un chunk del primer render.
const DepthLattice = React.lazy(() => import("./hero/DepthLattice"));
const CircleScene  = React.lazy(() => import("./hero/CircleScene"));
const GlobeScene   = React.lazy(() => import("./hero/GlobeScene"));

// Sandbox: ?scene=circle | lattice cambia de experimento; por defecto el globo.
const SCENES = { lattice: DepthLattice, circle: CircleScene, globe: GlobeScene };
const SCENE = SCENES[typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('scene')] || GlobeScene;
const PrivacyHUD  = React.lazy(() => import("./hero/PrivacyHUD"));

export default function FirstView() {
  const rootRef = useRef(null);

  const { signal, source, reduced, activateCamera, activateGyro, deactivate } = useDepthSignal();

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

      {lattice && (
        <div className="hero__bg" aria-hidden="true">
          <Suspense fallback={null}>
            <SCENE signal={signal} onFail={onLatticeFail} />
          </Suspense>
        </div>
      )}

      {/* Sandbox: sin el copy del hero, el único control es encender la cámara. */}
      <div className="sandbox__controls">
        {canTrack && !reduced && (
          <button
            type="button"
            onClick={onTrack}
            className={`btn hero__track${tracking ? ' hero__track--on' : ''}`}
            aria-pressed={tracking}
          >
            {tracking ? (
              <span className="hero__track-dot" aria-hidden="true" />
            ) : (
              <svg className="hero__track-cam" width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                <rect x="1" y="4" width="9.5" height="7.5" rx="2" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M10.5 7.9l3-1.9v3.5l-3-1.6z" fill="currentColor"/>
              </svg>
            )}
            {busy
              ? 'Starting…'
              : tracking
                ? 'Stop tracking'
                : mode === 'hand' ? 'Move with your hands' : 'Move with your head'}
          </button>
        )}
        {error && <p className="hero__track-error">{error}</p>}
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
