// Un solo puntero para el sitio, venga del mouse o de la punta del índice.
// Lo escriben el mouse (useTextLens) y la mano (HandCursor); lo leen la lupa
// de texto y quien quiera saber dónde está "el cursor". Objeto mutable y no
// estado de React por lo mismo que la señal: se escribe 60 veces por segundo.
//
// La mano tiene prioridad mientras apunta: el mouse quieto sobre la mesa no
// debe robarle la lupa a quien está apuntando con el dedo.
export const pointer = {
  x: -1e4, y: -1e4,
  source: 'none',          // 'mouse' | 'hand' | 'none'
  handAt: 0,               // última vez que la mano escribió (ms)
  mouseAt: -Infinity,      // última vez que el mouse se MOVIÓ de verdad (ms)
}

// Quién manda entre el mouse y el dedo: el que se movió último con
// intención. Un mouse que se mueve de verdad (más de unos píxeles) toma el
// control al instante y la mano cede (HandControls mira mouseAt); un temblor
// del trackpad mientras apuntás no le roba la lupa al dedo.
let mx = -1e4, my = -1e4
export function fromMouse(x, y, now) {
  const moved = Math.hypot(x - mx, y - my) > 6
  mx = x; my = y
  if (moved) pointer.mouseAt = now
  if (pointer.source === 'hand' && now - pointer.handAt < 400 && !moved) return
  pointer.x = x; pointer.y = y; pointer.source = 'mouse'
}

export function fromHand(x, y, now) {
  pointer.x = x; pointer.y = y; pointer.source = 'hand'; pointer.handAt = now
}

export function releaseHand() {
  if (pointer.source !== 'hand') return
  pointer.source = 'none'; pointer.x = pointer.y = -1e4
}
