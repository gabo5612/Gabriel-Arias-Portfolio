// Un cohete de dibujo animado hecho de puntos: cuerpo de bala, punta, una
// ventanilla redonda, tres aletas, tobera y llama. El eje va por x con la punta
// en +x; para mostrarlo como en una ilustración, todo se inclina TILT hacia
// arriba (quien lo hace volar lo endereza, ver particleRocket.js).
//
// Las partes que llevan color propio (la ventanilla azul, la llama) salen
// aparte: la nube colorea por dirección, y una ventanilla azul en el costado
// de un cuerpo crema no se puede pintar así.
//
// Devuelve:
//   all      `count` puntos: la forma completa, para que otra formación de
//            `count` puntos se convierta en el cohete punto a punto
//   body     el cuerpo (sin ventanilla ni llama)
//   window   la ventanilla
//   flame    la llama, relativa a la tobera y SIN inclinar (eje −x hacia atrás),
//            para poder hacerla titilar desde ahí
//   nozzle   dónde está la tobera (ya inclinada), en las unidades de `all`
//
// Determinista (PRNG con semilla), como las demás formas.

export const TILT = (35 * Math.PI) / 180

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

const NOZZLE_X = -0.86

// Radio del cuerpo en x: bala con la panza en el medio y punta ojival.
function radius(x) {
  if (x > 0.5) return 0.21 * (1 - Math.pow((x - 0.5) / 0.46, 1.7))
  if (x < -0.62) return 0.16
  const k = (x + 0.06) / 0.6
  return 0.21 * Math.sqrt(Math.max(0.55, 1 - k * k * 0.45))
}

export function rocket(count, R) {
  const rand = rng(1969)
  const body = [], win = [], flame = []
  const lerp = (a, b, t) => a + (b - a) * t

  const flameN = Math.round(count * 0.13)
  const winN = Math.round(count * 0.045)
  const bodyN = count - flameN - winN
  const share = f => Math.round(bodyN * f)

  // Casco: anillos alrededor del eje, con más puntos en las costuras (el ojo
  // lee la forma por los bordes).
  for (let i = 0, n = share(0.55); i < n; i++) {
    let x = lerp(-0.62, 0.95, rand())
    if (rand() < 0.14) x = [-0.25, 0.5][rand() < 0.5 ? 0 : 1]
    const r = radius(x), a = rand() * Math.PI * 2
    body.push(x, Math.sin(a) * r, Math.cos(a) * r)
  }
  // Tobera: un cilindro corto, abierto atrás.
  for (let i = 0, n = share(0.1); i < n; i++) {
    const x = lerp(NOZZLE_X, -0.62, rand()), a = rand() * Math.PI * 2
    const r = lerp(0.17, 0.15, (x - NOZZLE_X) / 0.24)
    body.push(x, Math.sin(a) * r, Math.cos(a) * r)
  }
  // Aletas: tres, barridas hacia atrás. Arriba, abajo y una hacia la cámara.
  const fins = [[0, 1, 0], [0, -1, 0], [0, 0, 1]]
  for (const [, dy, dz] of fins) {
    for (let i = 0, n = share(0.1); i < n; i++) {
      // Triángulo (x, alcance): raíz de -0.62 a -0.2 pegada al casco, punta
      // atrás y afuera. Más puntos en el borde.
      let u = rand(), v = rand()
      if (u + v > 1) { u = 1 - u; v = 1 - v }
      const edge = rand() < 0.35
      if (edge) v = 0
      const x = lerp(lerp(-0.2, -0.62, u), -0.84, v)
      const reach = radius(Math.max(x, -0.6)) + v * 0.42
      body.push(x, dy * reach, dz * reach + (rand() - 0.5) * 0.02)
    }
  }
  // Lo que falte por redondeo va al casco.
  while (body.length < bodyN * 3) {
    const x = lerp(-0.6, 0.9, rand()), r = radius(x), a = rand() * Math.PI * 2
    body.push(x, Math.sin(a) * r, Math.cos(a) * r)
  }
  body.length = bodyN * 3

  // Ventanilla: aro y vidrio, sobre la cara que mira a la cámara (+z).
  for (let i = 0; i < winN; i++) {
    const a = rand() * Math.PI * 2
    const r = i < winN * 0.55 ? 0.085 + rand() * 0.012 : Math.sqrt(rand()) * 0.07
    const x = 0.2 + Math.cos(a) * r, y = Math.sin(a) * r
    win.push(x, y, Math.sqrt(Math.max(0, radius(x) ** 2 - y * y)) + 0.012)
  }

  // Llama: un cono que sale de la tobera hacia −x, denso en el centro,
  // con lenguas que se abren al final.
  for (let i = 0; i < flameN; i++) {
    const t = Math.pow(rand(), 0.8)                 // 0 en la tobera, 1 en la punta
    const len = 0.75
    const rr = 0.15 * (1 - t) * (0.4 + 0.6 * Math.sqrt(rand())) + t * 0.03
    const a = rand() * Math.PI * 2
    flame.push(-t * len, Math.sin(a) * rr, Math.cos(a) * rr)
  }

  // Inclinar (todo menos la llama, que se inclina con su grupo) y escalar.
  const c = Math.cos(TILT), s = Math.sin(TILT)
  const tilt = arr => {
    const out = new Float32Array(arr.length)
    for (let i = 0; i < arr.length; i += 3) {
      const x = arr[i], y = arr[i + 1]
      out[i] = (x * c - y * s) * R
      out[i + 1] = (x * s + y * c) * R
      out[i + 2] = arr[i + 2] * R
    }
    return out
  }
  const bodyT = tilt(body), winT = tilt(win)
  const nozzle = [NOZZLE_X * c * R, NOZZLE_X * s * R, 0]
  const flameL = Float32Array.from(flame, v => v * R)
  // La llama dentro de `all`: inclinada y trasladada a la tobera.
  const flameW = tilt(flame.map((v, i) => (i % 3 === 0 ? v + NOZZLE_X : v)))

  const all = new Float32Array(count * 3)
  all.set(bodyT); all.set(winT, bodyT.length); all.set(flameW, bodyT.length + winT.length)
  return { all, body: bodyT, window: winT, flame: flameL, nozzle }
}
