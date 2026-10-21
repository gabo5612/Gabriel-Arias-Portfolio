// Un biplano de época hecho de puntos: fuselaje, capó del motor, dos alas con
// sus montantes, cola, tren de aterrizaje y hélice. La nariz apunta a +x, así
// que de frente a la cámara (que mira por -z) se ve de perfil, como en una
// foto de catálogo.
//
// Devuelve las tres cosas que necesita quien lo usa:
//   all   `count` puntos: la forma completa, para que otra formación de
//         `count` puntos se convierta en el avión punto a punto
//   body  los mismos puntos sin la hélice (los primeros count - propN)
//   prop  la hélice sola, centrada en su eje, para hacerla girar aparte
//   hub   dónde va el eje de la hélice (en las unidades de `all`)
//
// Determinista (PRNG con semilla) como las demás formas: el morph traza siempre
// el mismo recorrido.

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const NOSE = 0.86

export function biplane(count, R) {
  const rand = rng(1917)
  const pts = []
  const push = (x, y, z) => pts.push(x, y, z)
  const lerp = (a, b, t) => a + (b - a) * t

  // Fuselaje: sección elíptica que se afina hacia la cola.
  const fuselage = n => {
    for (let i = 0; i < n; i++) {
      const x = lerp(-1, NOSE - 0.12, rand())
      const k = x > 0.25 ? 1 : 0.3 + 0.7 * ((x + 1) / 1.25)
      const a = rand() * Math.PI * 2
      push(x, Math.sin(a) * 0.13 * k + (x < 0 ? x * 0.04 : 0), Math.cos(a) * 0.11 * k)
    }
  }
  // Capó: un anillo más ancho detrás de la hélice.
  const cowl = n => {
    for (let i = 0; i < n; i++) {
      const x = lerp(NOSE - 0.14, NOSE - 0.02, rand())
      const a = rand() * Math.PI * 2
      push(x, Math.sin(a) * 0.155, Math.cos(a) * 0.15)
    }
  }
  // Ala: una placa fina, con más puntos en los bordes para que se lea el
  // contorno (el ojo arma la forma por los bordes, no por el relleno).
  const wing = (n, x0, x1, y, span) => {
    for (let i = 0; i < n; i++) {
      let x = lerp(x0, x1, rand()), z = lerp(-span, span, rand())
      const edge = rand()
      if (edge < 0.3) x = rand() < 0.5 ? x0 : x1
      else if (edge < 0.4) z = rand() < 0.5 ? -span : span
      push(x, y + (rand() - 0.5) * 0.025, z)
    }
  }
  const line = (n, a, b) => {
    for (let i = 0; i < n; i++) {
      const t = rand()
      push(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t))
    }
  }
  const wheel = (n, cx, cy, cz, r) => {
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2, rr = r * (0.75 + rand() * 0.25)
      push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, cz)
    }
  }

  const propN = Math.round(count * 0.08)
  const n = count - propN
  const share = f => Math.round(n * f)

  fuselage(share(0.25))
  cowl(share(0.05))
  wing(share(0.19), 0.06, 0.46, 0.36, 1.0)          // ala de arriba
  wing(share(0.17), 0.0, 0.38, -0.13, 0.9)          // ala de abajo
  // Montantes entre alas, y los de cabina que sostienen el ala de arriba.
  for (const z of [-0.72, 0.72]) {
    line(share(0.012), [0.12, -0.13, z], [0.18, 0.36, z])
    line(share(0.012), [0.32, -0.13, z], [0.38, 0.36, z])
  }
  for (const z of [-0.1, 0.1]) line(share(0.01), [0.2, 0.1, z], [0.24, 0.36, z])
  // Cola: estabilizador horizontal y deriva redondeada.
  wing(share(0.07), -1.0, -0.8, 0.0, 0.32)
  for (let i = 0, m = share(0.06); i < m; i++) {
    const x = lerp(-1.0, -0.8, rand())
    const top = 0.32 * Math.sqrt(Math.max(0, 1 - ((x + 0.92) / 0.14) ** 2))
    push(x, rand() * top, (rand() - 0.5) * 0.015)
  }
  // Tren de aterrizaje: dos patas por rueda y las ruedas.
  for (const z of [-0.26, 0.26]) {
    line(share(0.012), [0.2, -0.1, z * 0.4], [0.42, -0.44, z])
    line(share(0.012), [0.55, -0.1, z * 0.4], [0.42, -0.44, z])
    wheel(share(0.03), 0.42, -0.44, z, 0.1)
  }
  // Lo que falte por redondeo va al fuselaje.
  while (pts.length < n * 3) fuselage(1)
  pts.length = n * 3

  // Hélice: dos palas en el plano y-z, alrededor del eje x, más el buje.
  const prop = []
  for (let i = 0; i < propN; i++) {
    if (i < propN * 0.15) {
      const a = rand() * Math.PI * 2, r = rand() * 0.05
      prop.push(0, Math.sin(a) * r, Math.cos(a) * r)
    } else {
      const s = rand() < 0.5 ? -1 : 1
      const r = lerp(0.04, 0.42, rand())
      const w = 0.045 * Math.sin(Math.PI * (r / 0.42)) + 0.012
      prop.push((rand() - 0.5) * 0.02, s * r, (rand() - 0.5) * w * 2)
    }
  }

  const scale = arr => Float32Array.from(arr, v => v * R)
  const body = scale(pts)
  const propLocal = scale(prop)
  const all = new Float32Array(count * 3)
  all.set(body)
  for (let i = 0; i < propN; i++) {
    all[(n + i) * 3] = propLocal[i * 3] + NOSE * R
    all[(n + i) * 3 + 1] = propLocal[i * 3 + 1]
    all[(n + i) * 3 + 2] = propLocal[i * 3 + 2]
  }
  return { all, body, prop: propLocal, hub: [NOSE * R, 0, 0] }
}
