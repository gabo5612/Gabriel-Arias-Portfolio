import { asset } from '../asset.js'

// Encender la cámara la primera vez cuesta ~9 MB (el motor WASM de MediaPipe y
// el modelo de la mano). Si se baja recién con el clic, el botón queda en
// "Starting…" lo que tarde la red. Se adelanta, pero sólo con intención: el
// mouse o el foco sobre el botón de la cámara, o la bienvenida ofreciéndola.
// Quien nunca la usa no paga nada, y con "ahorro de datos" no se adelanta.
//
// Son las mismas URLs que pide MediaPipe después, así que la descarga queda
// en la caché HTTP del navegador (vercel.json les da caché larga) y el clic
// las encuentra ahí. También se adelanta el código (cameraSource y el
// paquete de MediaPipe), que va en un chunk aparte.

let started = false

export function prefetchVision() {
  if (started || typeof window === 'undefined') return
  if (navigator.connection?.saveData) return
  if (!navigator.mediaDevices?.getUserMedia) return
  started = true
  import('./cameraSource').catch(() => {})
  for (const f of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm', 'hand_landmarker.task']) {
    fetch(asset(`mediapipe/${f}`), { priority: 'low' }).then(r => r.arrayBuffer()).catch(() => { started = false })
  }
}
