// Formas para el globo morfable. Todas devuelven `count` puntos en un
// Float32Array xyz, con el mismo tamaño aproximado (radio ~R), para que el
// morph sea punto a punto: el punto i de una forma viaja al punto i de la otra.
//
// Lo aleatorio usa un PRNG con semilla: así cada forma sale igual en cada carga
// y el morph entre dos formas siempre traza el mismo recorrido.

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

function sphere(count, R) {
  const p = new Float32Array(count * 3)
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2
    const r = Math.sqrt(1 - y * y)
    const t = golden * i
    p.set([Math.cos(t) * r * R, y * R, Math.sin(t) * r * R], i * 3)
  }
  return p
}

function cube(count, R) {
  const p = new Float32Array(count * 3)
  const rand = rng(2)
  const h = R * 0.72
  for (let i = 0; i < count; i++) {
    const face = i % 6
    const u = (rand() * 2 - 1) * h, v = (rand() * 2 - 1) * h
    const s = face % 2 ? -h : h
    const axis = face >> 1
    const xyz = axis === 0 ? [s, u, v] : axis === 1 ? [u, s, v] : [u, v, s]
    p.set(xyz, i * 3)
  }
  return p
}

function torus(count, R) {
  const p = new Float32Array(count * 3)
  const rand = rng(3)
  const big = R * 0.78, tube = R * 0.32
  for (let i = 0; i < count; i++) {
    const u = rand() * Math.PI * 2, v = rand() * Math.PI * 2
    const r = big + tube * Math.cos(v)
    // De frente a la cámara (plano xy): de canto un toro es una raya.
    p.set([r * Math.cos(u), r * Math.sin(u), tube * Math.sin(v)], i * 3)
  }
  return p
}

function helix(count, R) {
  const p = new Float32Array(count * 3)
  const rand = rng(4)
  const H = R * 1.35, rad = R * 0.42, turns = 2.6
  for (let i = 0; i < count; i++) {
    const t = rand()
    const y = (t * 2 - 1) * H
    const a = t * turns * Math.PI * 2
    if (i % 7 === 0) {
      // Peldaños: escalonados en t para que se lean como barras, no como niebla.
      const step = Math.round(t * 34) / 34
      const ys = (step * 2 - 1) * H, as = step * turns * Math.PI * 2
      const k = rand() * 2 - 1
      p.set([Math.cos(as) * rad * k, ys, Math.sin(as) * rad * k], i * 3)
    } else {
      const off = i % 2 ? Math.PI : 0
      const j = () => (rand() - 0.5) * 6
      p.set([Math.cos(a + off) * rad + j(), y + j(), Math.sin(a + off) * rad + j()], i * 3)
    }
  }
  return p
}

function galaxy(count, R) {
  const p = new Float32Array(count * 3)
  const rand = rng(5)
  const arms = 3
  for (let i = 0; i < count; i++) {
    const r = Math.pow(rand(), 0.7) * R * 1.35
    const arm = (i % arms) * (Math.PI * 2 / arms)
    const spread = (rand() - 0.5) * (0.5 + r / R * 0.4)
    const a = arm + r * 0.011 + spread
    // El núcleo se engorda en z; los brazos son planos.
    const z = (rand() - 0.5) * 60 * Math.exp(-r / (R * 0.35))
    p.set([Math.cos(a) * r, Math.sin(a) * r, z], i * 3)
  }
  return p
}

function heart(count, R) {
  const p = new Float32Array(count * 3)
  const rand = rng(6)
  const k = R / 17
  for (let i = 0; i < count; i++) {
    const t = rand() * Math.PI * 2
    // Sesgo hacia el contorno: un corazón relleno uniforme pierde la silueta.
    const s = Math.pow(rand(), 0.35)
    const x = 16 * Math.pow(Math.sin(t), 3)
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
    const z = (rand() * 2 - 1) * 7 * Math.sqrt(Math.max(0, 1 - s * s))
    p.set([x * s * k, (y * s + 2) * k, z * k], i * 3)
  }
  return p
}

function wave(count, R) {
  const p = new Float32Array(count * 3)
  const side = Math.ceil(Math.sqrt(count))
  const W = R * 2.4
  for (let i = 0; i < count; i++) {
    const c = i % side, r = Math.floor(i / side)
    const x = (c / (side - 1) - 0.5) * W
    const z = (r / (side - 1) - 0.5) * W
    const y = Math.sin(x * 0.018) * Math.cos(z * 0.018) * R * 0.32
    // Inclinada hacia quien mira: horizontal, de frente se vería de canto.
    const a = 0.95, ca = Math.cos(a), sa = Math.sin(a)
    p.set([x, y * ca - z * sa, y * sa + z * ca], i * 3)
  }
  return p
}

export const SHAPES = [
  { name: 'Sphere', build: sphere },
  { name: 'Cube',   build: cube },
  { name: 'Torus',  build: torus },
  { name: 'Helix',  build: helix },
  { name: 'Galaxy', build: galaxy },
  { name: 'Heart',  build: heart },
  { name: 'Wave',   build: wave },
]
