// Detector de swipe con la mano abierta, sin DOM ni three: recibe la señal y
// el reloj, devuelve qué pasó. Así lo usan igual el globo del lab, la
// navegación del sitio y los tests de node.
//
// La señal ya llega suavizada (one-euro + lerp), así que un swipe real se ve
// como un recorrido grande en poco tiempo y un temblor no. Se mide el
// recorrido dentro de una ventana corta, no la velocidad instantánea: la
// derivada de una señal filtrada es justo lo que el filtro aplana.
//
// Dos ejes. Gana el que más recorrió, y sólo si supera su umbral: una diagonal
// no dispara los dos. El eje vertical pide más recorrido porque la cámara ve
// menos alto que ancho y el brazo sube peor de lo que barre.

export const SWIPE_DEFAULTS = {
  dx: 0.5,            // recorrido en x, en unidades de señal ([-1, 1])
  dy: 0.6,            // recorrido en y
  ms: 260,            // ventana en la que tiene que ocurrir
  fingers: 3.5,       // mano abierta: con el puño cerrado nada dispara
  cooldown: 900,      // pausa antes del próximo, o un swipe cuenta doble al volver
  axes: 'x',          // 'x' | 'xy'
}

export function createSwipeDetector(opts = {}) {
  const o = { ...SWIPE_DEFAULTS, ...opts }
  const hist = []
  let until = 0

  // Devuelve, por cuadro:
  //   state    'idle' (sin mano) | 'closed' (mano, puño) | 'open' (lista)
  //   progress [-1, 1] cuánto del recorrido pedido en x ya se hizo
  //   swipe    null | { axis: 'x' | 'y', dir: 1 | -1, from: { x, y } }
  //            `from` es dónde estaba la mano al empezar el gesto: quien rota
  //            algo con la mano lo congela ahí, si no cada swipe le regala
  //            media vuelta.
  function push(s, now) {
    if (s.source !== 'hand' || !(s.hands > 0)) {
      hist.length = 0
      return { state: 'idle', progress: 0, swipe: null }
    }
    hist.push({ t: now, x: s.x, y: s.y })
    while (hist.length && now - hist[0].t > o.ms) hist.shift()

    const open = (s.fingers ?? 0) >= o.fingers
    const dx = s.x - hist[0].x
    const dy = s.y - hist[0].y
    const ready = open && now >= until
    const progress = ready ? Math.max(-1, Math.min(1, dx / o.dx)) : 0

    let swipe = null
    if (ready) {
      const rx = Math.abs(dx) / o.dx
      const ry = o.axes === 'xy' ? Math.abs(dy) / o.dy : 0
      if (rx > 1 || ry > 1) {
        swipe = rx >= ry
          ? { axis: 'x', dir: dx > 0 ? 1 : -1, from: { x: hist[0].x, y: hist[0].y } }
          // y positivo es abajo en la señal (eje de pantalla): bajar la mano
          // es "siguiente", como pasar a la fila de abajo.
          : { axis: 'y', dir: dy > 0 ? 1 : -1, from: { x: hist[0].x, y: hist[0].y } }
        until = now + o.cooldown
        hist.length = 0
      }
    }
    return { state: open ? 'open' : 'closed', progress, swipe }
  }

  return { push, reset: () => { hist.length = 0; until = 0 } }
}
