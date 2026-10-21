import { SHAPES } from './procedural.js'

// De dónde puede salir una forma. Las tres fuentes devuelven lo mismo —un
// Float32Array xyz con exactamente `count` puntos y radio ~R— así que para la
// nube de puntos da igual de dónde vino:
//
//   { type: 'sphere' }                     procedural, ver procedural.js
//   { type: 'text',  text: 'HELLO' }       muestreo de texto en un canvas 2D
//   { type: 'model', url: '/models/x.glb' } un diseño 3D: Blender → glTF → puntos
//
// La de modelos es la puerta para traer diseños de afuera: se exporta la
// malla como .glb/.gltf, se deja en public/models/ y la página la nombra. Se
// muestrea la SUPERFICIE ponderada por área, así que una malla con muchos
// polígonos en un detalle no se lleva todos los puntos.

const BY_NAME = Object.fromEntries(SHAPES.map(s => [s.name.toLowerCase(), s.build]))

export const shapeNames = () => Object.keys(BY_NAME)

// PRNG con semilla, igual que procedural.js: la misma forma sale igual en cada
// carga y el morph traza siempre el mismo recorrido.
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

// Centra y escala una nube para que su punto más lejano quede a R. Sin esto
// un modelo exportado en metros sería un punto, y uno en milímetros taparía
// la pantalla.
export function normalize(p, R) {
  let cx = 0, cy = 0, cz = 0
  const n = p.length / 3
  for (let i = 0; i < p.length; i += 3) { cx += p[i]; cy += p[i + 1]; cz += p[i + 2] }
  cx /= n; cy /= n; cz /= n
  let max = 0
  for (let i = 0; i < p.length; i += 3) {
    p[i] -= cx; p[i + 1] -= cy; p[i + 2] -= cz
    max = Math.max(max, Math.hypot(p[i], p[i + 1], p[i + 2]))
  }
  const k = max > 1e-6 ? R / max : 1
  for (let i = 0; i < p.length; i++) p[i] *= k
  return p
}

const TEXT_FONT = '800 220px "Bricolage Grotesque", "Space Grotesk", sans-serif'

export function fromText(text, count, R, { font = TEXT_FONT, depth = 26, seed = 7 } = {}) {
  const cv = document.createElement('canvas')
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  ctx.font = font
  const w = Math.ceil(ctx.measureText(text).width) + 40
  const h = 300
  cv.width = w; cv.height = h
  ctx.font = font
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fff'
  ctx.fillText(text, w / 2, h / 2)

  const data = ctx.getImageData(0, 0, w, h).data
  const filled = []
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      if (data[(y * w + x) * 4 + 3] > 128) filled.push(x, y)
    }
  }
  const rand = rng(seed)
  const p = new Float32Array(count * 3)
  if (!filled.length) return p
  // El texto es ancho y bajo: se escala por ancho, no por radio, o una palabra
  // larga se saldría de cuadro.
  const scale = (R * 2.3) / w
  for (let i = 0; i < count; i++) {
    const k = Math.floor(rand() * (filled.length / 2)) * 2
    const x = (filled[k] - w / 2 + rand() * 2) * scale
    const y = -(filled[k + 1] - h / 2 + rand() * 2) * scale
    p.set([x, y, (rand() - 0.5) * depth], i * 3)
  }
  return p
}

export async function fromModel(url, count, R, { seed = 11 } = {}) {
  // three/addons entra sólo si alguna página usa un modelo.
  const [{ GLTFLoader }, { MeshSurfaceSampler }, { mergeGeometries }, { Mesh, Vector3 }] = await Promise.all([
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/math/MeshSurfaceSampler.js'),
    import('three/addons/utils/BufferGeometryUtils.js'),
    import('three'),
  ])
  const gltf = await new GLTFLoader().loadAsync(url)
  gltf.scene.updateMatrixWorld(true)

  // Todas las mallas de la escena en una sola geometría, ya en coordenadas de
  // mundo y sólo con posición: mergeGeometries exige atributos iguales, y un
  // modelo real mezcla mallas con y sin UV o normales.
  const parts = []
  gltf.scene.traverse(o => {
    if (!o.isMesh) return
    const g = o.geometry.clone()
    for (const name of Object.keys(g.attributes)) if (name !== 'position') g.deleteAttribute(name)
    g.applyMatrix4(o.matrixWorld)
    parts.push(g.index ? g.toNonIndexed() : g)
  })
  if (!parts.length) throw new Error(`${url}: no meshes`)
  const merged = parts.length === 1 ? parts[0] : mergeGeometries(parts)

  const sampler = new MeshSurfaceSampler(new Mesh(merged))
  sampler.setRandomGenerator(rng(seed))
  sampler.build()
  const p = new Float32Array(count * 3)
  const v = new Vector3()
  for (let i = 0; i < count; i++) {
    sampler.sample(v)
    p.set([v.x, v.y, v.z], i * 3)
  }
  merged.dispose(); parts.forEach(g => g.dispose())
  return normalize(p, R)
}

// Resuelve cualquier spec a puntos. Siempre async, aunque lo procedural no lo
// necesite: quien llama no tiene que saber qué tipo de fuente le tocó.
export async function resolveShape(spec, count, R) {
  if (spec.type === 'text') {
    // Si la fuente web aún no llegó, el canvas dibuja con la de sistema y la
    // forma queda con otra silueta para siempre: se espera, pero no más de 1 s.
    try {
      await Promise.race([document.fonts?.load(spec.font || TEXT_FONT), new Promise(r => setTimeout(r, 1000))])
    } catch { /* sin Font Loading API: se dibuja con lo que haya */ }
    return fromText(spec.text, count, R, spec)
  }
  if (spec.type === 'model') return fromModel(spec.url, count, R, spec)
  const build = BY_NAME[spec.type]
  if (!build) throw new Error(`Unknown shape "${spec.type}". Known: ${shapeNames().join(', ')}, text, model`)
  return build(count, R)
}
