// Los umbrales de la mano, medidos en vez de adivinados.
//
// Los valores por defecto salen de las proporciones típicas de una mano; con
// una mano real (dedos más cortos, una cámara más lejos, otra forma de
// apuntar) pueden quedar cortos o largos. La calibración (site/ui/Calibration)
// pide cada pose unos segundos, mide, y deriveProfile() convierte esas medidas
// en umbrales. Se guarda en localStorage: es de esta persona en este
// navegador y no sale de ahí, como todo lo demás de la cámara.
//
// `profile` es un objeto vivo: quien lo lee (cameraSource cada cuadro, los
// gestos) ve los cambios al instante. Quien guarda avisa con un evento.

export const DEFAULTS = Object.freeze({
  open: 3.5,                                  // dedos (0..5) a partir de los cuales la palma está abierta
  point: Object.freeze({ indexMin: 0.55, othersMax: 1.2 }),  // índice estirado / resto plegado
  pinch: Object.freeze({ near: 0.25, far: 0.75 }),           // razón pulgar–índice / palma
  swipe: Object.freeze({ dx: 0.36 }),        // recorrido de x en 320 ms
  scroll: Object.freeze({ dead: 0.28 }),     // zona muerta del joystick vertical
})

const KEY = 'handProfile'
export const EVENT = 'handprofile'

const clone = p => JSON.parse(JSON.stringify(p))
export const profile = clone(DEFAULTS)
export let calibrated = false

function apply(p) {
  const d = clone(DEFAULTS)
  Object.assign(profile, d, p, {
    point: { ...d.point, ...p?.point },
    pinch: { ...d.pinch, ...p?.pinch },
    swipe: { ...d.swipe, ...p?.swipe },
    scroll: { ...d.scroll, ...p?.scroll },
  })
}

try {
  const saved = typeof localStorage !== 'undefined' && localStorage.getItem(KEY)
  if (saved) { apply(JSON.parse(saved)); calibrated = true }
} catch { /* modo privado o JSON roto: se usan los valores por defecto */ }

export function saveProfile(p) {
  apply(p)
  calibrated = true
  try { localStorage.setItem(KEY, JSON.stringify(profile)) } catch { /* modo privado */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT))
}

export function resetProfile() {
  apply(null)
  calibrated = false
  try { localStorage.removeItem(KEY) } catch { /* modo privado */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT))
}

// ── De muestras a umbrales ──────────────────────────────────────────────────
// samples: { open, fist, point, pinch, low: [señal…], swipes: [amplitud…] }
// Cada señal trae fingers, rIdx (extensión del índice), rOth (suma medio +
// anular + meñique), rPinch (razón pulgar–índice) e y.
//
// Medianas y percentiles, no promedios: un cuadro con la mano a medio entrar
// no debe mover el umbral. Cada umbral va a una fracción del camino entre las
// dos poses que separa, y se acota para que una calibración mala no deje la
// mano inservible.

const pick = (arr, k) => arr.map(s => s[k]).filter(Number.isFinite).sort((a, b) => a - b)
const quant = (sorted, q) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : NaN
const med = (arr, k) => quant(pick(arr, k), 0.5)
const clamp = (v, lo, hi, fallback) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback)
const between = (a, b, f) => a + (b - a) * f

export function deriveProfile(s) {
  const d = DEFAULTS
  const openF = med(s.open, 'fingers'), fistF = med(s.fist, 'fingers')
  const fistIdx = med(s.fist, 'rIdx'), pointIdx = med(s.point, 'rIdx')
  const pointOth = med(s.point, 'rOth'), openOth = med(s.open, 'rOth')
  // `near` es la razón a partir de la cual el pellizco cuenta como cerrado del
  // todo: tiene que quedar POR ENCIMA de casi todo lo que se midió pellizcando
  // (percentil 80), o un pellizco real nunca llegaría a 1.
  const pinchNear = quant(pick(s.pinch, 'rPinch'), 0.8)
  const relaxed = med(s.point, 'rPinch')
  const swipes = [...(s.swipes || [])].sort((a, b) => a - b)
  const lowY = med(s.low, 'y')

  const near = clamp(pinchNear * 1.2, 0.08, 0.5, d.pinch.near)
  return {
    open: clamp(between(fistF, openF, 0.6), 2.5, 4.5, d.open),
    point: {
      indexMin: clamp(between(fistIdx, pointIdx, 0.5), 0.3, 0.85, d.point.indexMin),
      othersMax: clamp(between(pointOth, openOth, 0.35), 0.5, 2.2, d.point.othersMax),
    },
    pinch: { near, far: clamp(relaxed * 0.85, near + 0.15, 1.4, Math.max(d.pinch.far, near + 0.15)) },
    swipe: { dx: clamp(quant(swipes, 0.5) * 0.6, 0.2, 0.6, d.swipe.dx) },
    scroll: { dead: clamp(Math.abs(lowY) * 0.6, 0.12, 0.45, d.scroll.dead) },
  }
}
