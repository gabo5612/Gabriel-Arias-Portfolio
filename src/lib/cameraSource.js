import { createOneEuro } from './oneEuro.mjs'

// Fuente de pose por cámara, con dos modos: mano derecha (por defecto) y cabeza.
//
// Todo el procesamiento ocurre en esta máquina: el WASM y los modelos se sirven
// desde /mediapipe/ (static/), NO desde el CDN de jsdelivr que MediaPipe usa por
// defecto. Si vinieran de fuera, el panel que dice "0 peticiones de red" sería
// mentira, y ese panel es el argumento entero.
//
// Los dos modos comparten toda la maquinaria —vídeo, filtros, calibración,
// estadísticas, apagado— y sólo se diferencian en dos funciones: cómo se crea el
// detector y cómo se lee un cuadro. Duplicar el archivo entero por modo era la
// otra opción, y significaba arreglar cada bug dos veces.
//
// Este archivo sólo se alcanza por import() dinámico desde useDepthSignal.

const MP_BASE = '/mediapipe'
const FACE_MODEL = `${MP_BASE}/blaze_face_short_range.tflite`
const HAND_MODEL = `${MP_BASE}/hand_landmarker.task`

const CAL_MS = 1000

const clamp = (v, lo = -1, hi = 1) => Math.min(hi, Math.max(lo, v))
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

// ── Modo cabeza ─────────────────────────────────────────────────────────────
// Índices de los 6 keypoints de BlazeFace, en el orden que documenta MediaPipe.
const R_EYE = 0, L_EYE = 1, NOSE = 2, R_EAR = 4, L_EAR = 5

const FACE = {
  label: 'head',
  width: 320, height: 240, hz: 24,
  // Rango útil: la cabeza se mueve poco dentro del cuadro, así que satura antes.
  span: 0.5,
  async create(vision, fileset) {
    return vision.FaceDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: FACE_MODEL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      minDetectionConfidence: 0.5,
    })
  },
  read(det, video, now, vw, vh) {
    const d = det.detectForVideo(video, now)?.detections?.[0]
    if (!d) return null
    const b = d.boundingBox
    const kp = d.keypoints || []
    let yaw = 0, pitch = 0
    if (kp.length > L_EAR) {
      // Giro: al girar la cabeza, una oreja se aleja de la nariz en la imagen y
      // la otra se acerca. Esa asimetría es rotación real, algo que la cascada
      // Haar de 3dtrack no puede dar porque sólo devuelve un rectángulo.
      const dR = dist(kp[NOSE], kp[R_EAR])
      const dL = dist(kp[NOSE], kp[L_EAR])
      if (dR + dL > 1e-6) yaw = (dL - dR) / (dL + dR)
      pitch = (kp[NOSE].y - (kp[R_EYE].y + kp[L_EYE].y) / 2) / Math.max(b.height / vh, 1e-6)
    }
    return {
      cx: (b.originX + b.width / 2) / vw,
      cy: (b.originY + b.height / 2) / vh,
      size: b.width / vw,
      yaw, pitch,
      box: b,
    }
  },
}

// ── Modo mano ───────────────────────────────────────────────────────────────
// De los 21 landmarks sólo se usan los nudillos y la muñeca: los dedos se
// mueven solos y meterían ruido en una señal que sólo quiere saber dónde está
// la palma.
const WRIST = 0, IDX_MCP = 5, MID_MCP = 9, RNG_MCP = 13, PKY_MCP = 17
const PALM = [WRIST, IDX_MCP, MID_MCP, RNG_MCP, PKY_MCP]

// [punta, nudillo medio] de índice, medio, anular y meñique.
const FINGERS = [[8, 6], [12, 10], [16, 14], [20, 18]]

// Cuántos dedos hay estirados, de 0 a 5 — como número CONTINUO.
//
// Contar sí/no por dedo desperdicia casi todo el gesto: sólo pasa algo en el
// instante exacto en que la punta cruza el umbral, y curvar el dedo despacio no
// produce ningún cambio hasta el final. Midiendo la extensión de cada dedo como
// una razón, el efecto responde durante todo el recorrido y un dedo a medio
// doblar vale 0,5.
//
// La razón es por DISTANCIA a la muñeca, no por coordenada Y: un dedo estirado
// tiene la punta más lejos de la muñeca que su propio nudillo, y eso sigue
// siendo cierto con la mano de lado, boca abajo o girada. Comparar alturas sólo
// funciona con la mano perfectamente vertical, que es justo lo que nadie hace.
//
// Los cortes 0.92 y 1.18 salen del recorrido real de la articulación: por debajo
// de 0.92 el dedo está claramente plegado, por encima de 1.18 claramente
// estirado, y en medio se interpola.
const ext = (r, lo = 0.92, hi = 1.18) => Math.min(1, Math.max(0, (r - lo) / (hi - lo)))

function countFingers(lm) {
  const w = lm[WRIST]
  let n = 0
  for (const [tip, pip] of FINGERS) {
    const d = dist(w, lm[pip])
    if (d > 1e-6) n += ext(dist(w, lm[tip]) / d)
  }
  // El pulgar no se dobla como los demás: se pliega cruzando la palma en vez de
  // acercarse a la muñeca. Se mide contra el nudillo del meñique, del que se
  // aleja al abrirse y al que se acerca al cerrarse. Su recorrido es más corto,
  // así que lleva sus propios cortes.
  const dRef = dist(lm[2], lm[PKY_MCP])
  if (dRef > 1e-6) n += ext(dist(lm[4], lm[PKY_MCP]) / dRef, 0.97, 1.22)
  return n
}

const HAND = {
  label: 'hand',
  // La mano ocupa menos píxeles que una cara y sus landmarks son más finos, así
  // que necesita más resolución que los 320×240 que le bastan al detector facial.
  width: 480, height: 360, hz: 22,
  // La mano barre mucho más cuadro que la cabeza: satura más tarde o el efecto
  // se clava en los bordes en cuanto movés el brazo.
  span: 0.95,
  async create(vision, fileset) {
    return vision.HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: HAND_MODEL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.5,
    })
  },
  read(det, video, now) {
    const r = det.detectForVideo(video, now)
    const hands = r?.landmarks || []
    if (!hands.length) return null

    // MediaPipe etiqueta la lateralidad asumiendo imagen espejada (vista selfie),
    // y nosotros le pasamos el cuadro crudo — la etiqueta puede venir invertida
    // según el dispositivo. Se usa sólo para decidir cuál manda: la marcada como
    // derecha va primera, y si no hay ninguna se toma la que haya. Las dos se
    // usan igual, así que una etiqueta invertida no rompe nada.
    const marks = r.handedness || r.handednesses || []
    let first = marks.findIndex(h => h?.[0]?.categoryName === 'Right')
    if (first === -1) first = 0

    const order = [first, ...hands.map((_, i) => i).filter(i => i !== first)]
    const read1 = lm => {
      if (!lm || lm.length <= PKY_MCP) return null
      const s = Math.max(dist(lm[WRIST], lm[MID_MCP]), 1e-6)
      return {
        cx: PALM.reduce((a, i) => a + lm[i].x, 0) / PALM.length,
        cy: PALM.reduce((a, i) => a + lm[i].y, 0) / PALM.length,
        // Muñeca→nudillo medio: la medida más estable de la mano, porque no
        // cambia al abrir o cerrar los dedos. Proxy de distancia a la cámara.
        size: s,
        // Separación índice–meñique: se acorta al rotar la palma. Giro de muñeca.
        yaw: (lm[IDX_MCP].x - lm[PKY_MCP].x) / s,
        // Inclinación de la palma hacia adelante o atrás.
        pitch: (lm[MID_MCP].y - lm[WRIST].y) / s,
        fingers: countFingers(lm),
        lm,
      }
    }

    const a = read1(hands[order[0]])
    if (!a) return null
    // Sólo la primera mano mueve la cámara. Si las dos la movieran, cada una
    // tiraría del frustum hacia un lado y el resultado sería un temblor.
    const b = order.length > 1 ? read1(hands[order[1]]) : null

    return { ...a, second: b, hands: b ? 2 : 1, box: null }
  },
}

const MODES = { face: FACE, hand: HAND }

export async function startCameraSource(mode, onPose, opts = {}) {
  const M = MODES[mode] || HAND
  const { onStats, onVideo } = opts

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: M.width }, height: { ideal: M.height }, facingMode: 'user' },
    audio: false,
  })

  const video = document.createElement('video')
  video.srcObject = stream
  video.muted = true
  video.playsInline = true          // sin esto iOS abre el vídeo a pantalla completa
  video.setAttribute('playsinline', '')
  await video.play()
  onVideo?.(video)

  const vision = await import('@mediapipe/tasks-vision')
  const fileset = await vision.FilesetResolver.forVisionTasks(MP_BASE)
  const detector = await M.create(vision, fileset)

  // Un filtro por eje. beta alto en x/y porque ahí el lag se nota; z va más
  // suave porque el tamaño es la señal más ruidosa de las tres.
  const f = {
    x: createOneEuro({ minCutoff: 1.2, beta: 0.9 }),
    y: createOneEuro({ minCutoff: 1.2, beta: 0.9 }),
    z: createOneEuro({ minCutoff: 0.7, beta: 0.25 }),
    yaw: createOneEuro({ minCutoff: 1.0, beta: 0.6 }),
    pitch: createOneEuro({ minCutoff: 1.0, beta: 0.6 }),
    // minCutoff alto: el conteo tiene que seguir el dedo, no arrastrarse detrás.
    // Con 0.45 el gesto llegaba medio segundo tarde y no se sentía conectado.
    fingers: createOneEuro({ minCutoff: 2.4, beta: 0.6 }),
    x2: createOneEuro({ minCutoff: 1.2, beta: 0.9 }),
    y2: createOneEuro({ minCutoff: 1.2, beta: 0.9 }),
    f2: createOneEuro({ minCutoff: 2.4, beta: 0.6 }),
  }

  // Calibración: 3dtrack fija neutralFaceSize = 0.3 a ojo, y por eso si te
  // ponés descentrado la escena queda clavada contra un borde. Acá el neutral
  // es donde estabas el primer segundo.
  let cal = null, calStart = 0
  const samples = []

  let raf = 0, stopped = false, last = 0
  let frames = 0, fpsAt = 0, fps = 0

  const loop = () => {
    raf = requestAnimationFrame(loop)
    if (stopped) return
    const now = performance.now()
    if (now - last < 1000 / M.hz) return
    last = now
    if (video.readyState < 2) return

    const vw = video.videoWidth || M.width
    const vh = video.videoHeight || M.height

    const t0 = performance.now()
    let raw
    try {
      raw = M.read(detector, video, now, vw, vh)
    } catch {
      return                        // un cuadro suelto puede fallar; no es fatal
    }
    const latency = performance.now() - t0

    frames++
    if (now - fpsAt > 500) { fps = Math.round((frames * 1000) / (now - fpsAt)); frames = 0; fpsAt = now }

    const base = { fps, latency, mode, target: M.label, vw, vh }

    if (!raw) {
      // Sin esto, al salir de cuadro `fingers` queda congelado en su último
      // valor: el campo se queda abierto y el tono sonando para siempre, porque
      // onPose simplemente deja de llamarse. Se manda un cero explícito y el
      // filtro lo lleva a silencio con la misma suavidad que cualquier gesto.
      // No se tocan x/y/z: la escena se queda donde estaba en vez de saltar.
      if (cal) onPose({ fingers: f.fingers(0, now / 1000), fingers2: 0, hands: 0 })
      onStats?.({ ...base, found: false, calibrating: !cal })
      return
    }

    if (!cal) {
      if (!calStart) calStart = now
      samples.push(raw)
      if (now - calStart >= CAL_MS && samples.length >= 8) {
        const avg = k => samples.reduce((s, v) => s + v[k], 0) / samples.length
        cal = { cx: avg('cx'), cy: avg('cy'), size: avg('size'), yaw: avg('yaw'), pitch: avg('pitch') }
      }
      onStats?.({ ...base, found: true, calibrating: true, box: raw.box, lm: raw.lm, lm2: raw.second?.lm })
      return
    }

    // La webcam ve tu derecha en el lado izquierdo de la imagen, así que x se
    // invierte para que "a la derecha" sea x positivo. Es el mismo signo negativo
    // que 3dtrack aplica en updateCamera().
    const t = now / 1000
    onPose({
      x: f.x(clamp(-(raw.cx - cal.cx) * 2 / M.span), t),
      y: f.y(clamp((raw.cy - cal.cy) * 2 / M.span), t),
      z: f.z(clamp((raw.size / cal.size - 1) * 2.2), t),
      yaw: f.yaw(clamp((raw.yaw - cal.yaw) * 3), t),
      pitch: f.pitch(clamp((raw.pitch - cal.pitch) * 3), t),
      // El modo cabeza no tiene dedos: manda 5 para que el radio quede en su
      // tamaño normal en vez de colapsar a un punto.
      fingers: f.fingers(raw.fingers ?? 5, t),
      hands: raw.hands ?? 0,
      x2: raw.second ? f.x2(clamp(-(raw.second.cx - cal.cx) * 2 / M.span), t) : 0,
      y2: raw.second ? f.y2(clamp((raw.second.cy - cal.cy) * 2 / M.span), t) : 0,
      fingers2: raw.second ? f.f2(raw.second.fingers, t) : 0,
    })
    onStats?.({
      ...base, found: true, calibrating: false, box: raw.box,
      lm: raw.lm, lm2: raw.second?.lm,
      fingers: raw.fingers, fingers2: raw.second?.fingers, hands: raw.hands,
    })
  }
  raf = requestAnimationFrame(loop)

  return () => {
    stopped = true
    cancelAnimationFrame(raf)
    // Soltar las pistas de verdad: si no, el LED de la cámara queda encendido
    // y la promesa de "apagá cuando quieras" deja de ser cierta.
    stream.getTracks().forEach(t => t.stop())
    video.srcObject = null
    try { detector.close() } catch { /* ya cerrado */ }
  }
}
