// La escala que comparte todo lo que suena: la menor pentatónica, de La2 a
// La5, en semitonos desde 110 Hz. Pentatónica a propósito: no tiene
// semitonos, así que CUALQUIER par de notas de esta tabla es consonante. Con
// varias cosas sonando a la vez (las manos, el fondo, una campana, la lupa)
// eso no es un lujo — es lo que impide que una combinación cualquiera choque.
export const SEMIS = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24, 27, 29, 31, 34, 36]
export const hz = semi => 110 * Math.pow(2, semi / 12)
export const NOTES = SEMIS.map(hz)

// v ∈ [0, 1] → una nota de la tabla entre los índices lo y hi.
export const noteIn = (v, lo, hi) =>
  NOTES[lo + Math.round(Math.max(0, Math.min(1, v)) * (hi - lo))]
