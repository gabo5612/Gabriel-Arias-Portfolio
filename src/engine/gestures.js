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

// ── Modo de la mano ─────────────────────────────────────────────────────────
// Qué está haciendo la mano, con histéresis: sin ella, la frontera entre
// "apuntar" y "mano cerrada" parpadea, y al pellizcar el índice se dobla
// hacia el pulgar y te sacaría del modo puntero justo al hacer clic.
//
//   'none'   no hay mano
//   'point'  índice estirado, el resto plegado: cursor
//   'open'   palma abierta: swipe y scroll
//   'closed' cualquier otra cosa
export function handMode(s, prev = 'none', { fingers = SWIPE_DEFAULTS.fingers } = {}) {
  if (s.source !== 'hand' || !(s.hands > 0)) return 'none'
  const point = s.point ?? 0
  if (prev === 'point' && (point > 0.25 || (s.pinch ?? 0) > 0.3)) return 'point'
  if (point > 0.6) return 'point'
  return (s.fingers ?? 0) >= fingers ? 'open' : 'closed'
}

// Joystick vertical: con la palma abierta, la altura de la mano respecto de
// donde estaba al calibrar decide la velocidad de scroll. Zona muerta en el
// centro para que una mano en reposo no desplace nada, y curva cuadrática
// para que el control fino esté cerca del centro.
export function scrollSpeed(y, { dead = 0.28, max = 1100 } = {}) {
  const a = Math.abs(y)
  if (a <= dead) return 0
  const k = Math.min(1, (a - dead) / (1 - dead))
  return Math.sign(y) * k * k * max          // px/s; y positivo = mano baja = bajar
}

// Clic por pellizco. Aprieta al pasar de `press`, suelta al bajar de
// `release` (histéresis: un pellizco a medias no dispara ráfagas). Mientras
// el pellizco se cierra, el cursor se congela donde estaba al empezar a
// cerrarse: juntar el pulgar arrastra la punta del índice, y sin esto el clic
// cae al lado de donde apuntabas.
export function createPinchClick({ press = 0.7, release = 0.4, settle = 0.2 } = {}) {
  let down = false, held = null
  return {
    push(pinch, x, y) {
      if (pinch > settle && !held) held = { x, y }
      if (pinch <= settle && !down) held = null
      let click = false
      if (!down && pinch > press) { down = true; click = true }
      else if (down && pinch < release) { down = false; held = null }
      const at = held || { x, y }
      return { x: at.x, y: at.y, down, click }
    },
    reset() { down = false; held = null },
  }
}

// Mantener para abrir: si el cursor se queda quieto sobre el mismo objetivo
// `ms`, dispara una vez. Es el clic de quien no quiere (o no puede) pellizcar.
//
// "Quieto" con tolerancia (`slop` px): un dedo en el aire nunca está quieto
// del todo, y sin margen el contador no llegaría nunca. Moverse más que eso o
// cambiar de objetivo reinicia. Después de disparar, el mismo objetivo no
// vuelve a disparar hasta que el cursor lo deje: quedarse encima de un link
// recién abierto no debe abrirlo cada tres segundos.
export function createDwell({ ms = 3000, slop = 28 } = {}) {
  let target = null, since = 0, ax = 0, ay = 0, spent = null
  return {
    push(t, x, y, now) {
      if (t !== spent) spent = null
      if (!t || t === spent) { target = null; return { progress: 0, fire: false } }
      if (t !== target || Math.hypot(x - ax, y - ay) > slop) {
        target = t; since = now; ax = x; ay = y
      }
      const progress = Math.min(1, (now - since) / ms)
      if (progress < 1) return { progress, fire: false }
      spent = t; target = null
      return { progress: 1, fire: true }
    },
    // Quien ya hizo clic de otra forma (pellizco) sobre `t` lo da por usado.
    spend(t) { spent = t; target = null },
    reset() { target = null; spent = null },
  }
}
