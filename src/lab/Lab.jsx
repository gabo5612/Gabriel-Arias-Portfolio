import React, { useCallback, useEffect, useState, Suspense } from "react";
import "../styles/engine.css";
import "../styles/lab.css";
import { useDepthSignal } from "../engine/signal/useDepthSignal";
import { useCameraControl } from "../engine/signal/useCameraControl";
import TrackButton from "../engine/ui/TrackButton";

// Los experimentos del hero, intactos: ?lab abre el globo; ?lab&scene=circle o
// ?lab&scene=lattice los otros dos. three.js entra sólo por import() diferido.
const DepthLattice = React.lazy(() => import("./scenes/DepthLattice"));
const CircleScene  = React.lazy(() => import("./scenes/CircleScene"));
const GlobeScene   = React.lazy(() => import("./scenes/GlobeScene"));
const PrivacyHUD   = React.lazy(() => import("../engine/ui/PrivacyHUD"));

const SCENES = { lattice: DepthLattice, circle: CircleScene, globe: GlobeScene };
const SCENE = SCENES[new URLSearchParams(window.location.search).get('scene')] || GlobeScene;

export default function Lab() {
  const depth = useDepthSignal();
  const cam = useCameraControl(depth);
  const [scene, setScene] = useState(false);

  // Estable a propósito: si cambia de identidad, la escena desmonta y vuelve a
  // montar todo three.
  const onFail = useCallback(() => setScene(false), []);

  // El 3D se monta cuando el navegador está ocioso, no en el primer pintado.
  useEffect(() => {
    if (depth.reduced) return;
    const idle = window.requestIdleCallback || (cb => setTimeout(cb, 1200));
    const id = idle(() => setScene(true), { timeout: 2500 });
    return () => (window.cancelIdleCallback || clearTimeout)(id);
  }, [depth.reduced]);

  return (
    <section className="hero" id="home" aria-label="Hero">
      {scene && (
        <div className="hero__bg" aria-hidden="true">
          <Suspense fallback={null}>
            <SCENE signal={depth.signal} onFail={onFail} />
          </Suspense>
        </div>
      )}

      <div className="sandbox__controls">
        <TrackButton cam={cam} />
        {cam.error && <p className="hero__track-error">{cam.error}</p>}
      </div>

      {cam.camOn && (
        <Suspense fallback={null}>
          <PrivacyHUD
            stats={cam.stats}
            video={cam.video}
            mode={cam.mode}
            onMode={cam.setMode}
            muted={cam.muted}
            onMute={cam.toggleMute}
            onStop={cam.stop}
          />
        </Suspense>
      )}
    </section>
  );
}
