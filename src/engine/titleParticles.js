import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, Points, ShaderMaterial,
} from 'three'

// El puente entre el texto de la página y el mundo: una nube de partículas
// que forma un texto del DOM letra por letra, en su sitio exacto de pantalla,
// o lo deshace.
//
// La nube vive en el espacio de la CÁMARA (es hija de la cámara), en un plano a
// distancia fija delante de ella. Así, pasar de un píxel de pantalla a un punto
// 3D es una regla de tres, sin depender de hacia dónde mire la cámara ni de que
// se esté moviendo.

const VERT = /* glsl */`
  uniform float uT;        // progreso global 0..1
  uniform float uMode;     // 0 = formar, 1 = deshacer
  uniform float uPx;       // pixelRatio
  attribute vec3  aFrom;
  attribute vec3  aTo;
  attribute float aSeed;
  attribute vec3  aCol;
  uniform vec3 uPaper;
  varying vec3  vCol;
  varying float vA;

  void main() {
    // Cada partícula sale con su retraso: llegan escalonadas, como si las
    // letras se fueran escribiendo, y no como un bloque que se teletransporta.
    float d = aSeed * 0.3;
    float k = clamp((uT - d) / (1.0 - 0.3), 0.0, 1.0);
    float e = k < 0.5 ? 4.0 * k * k * k : 1.0 - pow(-2.0 * k + 2.0, 3.0) / 2.0;
    vec3 p = mix(aFrom, aTo, e);
    // Arco: a mitad de camino se acercan a la cámara y se abren un poco.
    float arc = sin(e * 3.14159);
    p.z += arc * (40.0 + aSeed * 120.0);
    p.x += arc * (aSeed - 0.5) * 60.0;

    if (uMode < 0.5) {
      vA = smoothstep(0.0, 0.08, k) * (1.0 - smoothstep(0.82, 1.0, k));
      vCol = mix(aCol, uPaper, smoothstep(0.35, 0.9, k));
    } else {
      vA = 1.0 - smoothstep(0.1, 1.0, k);
      vCol = mix(uPaper, aCol, smoothstep(0.0, 0.5, k));
    }
    gl_PointSize = (1.9 + aSeed * 1.8) * uPx;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

const FRAG = /* glsl */`
  varying vec3  vCol;
  varying float vA;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = dot(c, c);
    if (r > 0.25 || vA < 0.01) discard;
    gl_FragColor = vec4(vCol, vA * (1.0 - smoothstep(0.1, 0.25, r)));
  }
`

// font-stretch en porcentaje (lo que devuelve getComputedStyle) → la palabra
// clave que entiende ctx.fontStretch.
const STRETCH = [[56, 'ultra-condensed'], [68, 'extra-condensed'], [81, 'condensed'], [93, 'semi-condensed'], [106, 'normal'], [118, 'semi-expanded'], [137, 'expanded']]
const stretchKeyword = v => {
  const n = parseFloat(v)
  if (!Number.isFinite(n)) return 'normal'
  return (STRETCH.find(([max]) => n < max) || [0, 'extra-expanded'])[1]
}

// Rasteriza el texto de `el` tal como está en pantalla —cada palabra con su
// fuente computada y en su rectángulo real— y devuelve `count` puntos de tinta
// en coordenadas de pantalla [x0, y0, x1, y1, …]. Si el elemento está entrando
// con un desplazamiento (la animación del panel), se descuenta: el destino es
// donde va a quedar, no donde está en este cuadro.
export function sampleElementText(el, count) {
  const box = el.getBoundingClientRect()
  if (!box.width || !box.height) return null
  const panel = el.closest('.panel')
  let shiftX = 0
  if (panel) {
    const t = getComputedStyle(panel).transform
    if (t && t !== 'none') shiftX = new DOMMatrixReadOnly(t).m41
  }

  const pad = 6
  const cv = document.createElement('canvas')
  cv.width = Math.ceil(box.width) + pad * 2
  cv.height = Math.ceil(box.height) + pad * 2
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = '#fff'
  ctx.textBaseline = 'alphabetic'

  const words = el.querySelectorAll('.w')
  for (const w of words.length ? words : [el]) {
    const cs = getComputedStyle(w)
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
    if ('fontStretch' in ctx) ctx.fontStretch = stretchKeyword(cs.fontStretch)
    if ('letterSpacing' in ctx) ctx.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing
    const r = w.getBoundingClientRect()
    const m = ctx.measureText(w.textContent)
    // Línea base: el texto ocupa (ascenso + descenso) centrado en la caja.
    const asc = m.fontBoundingBoxAscent ?? r.height * 0.8
    const desc = m.fontBoundingBoxDescent ?? r.height * 0.2
    const base = r.top - box.top + (r.height - (asc + desc)) / 2 + asc
    ctx.fillText(w.textContent, r.left - box.left + pad, base + pad)
  }

  const data = ctx.getImageData(0, 0, cv.width, cv.height).data
  const ink = []
  const step = box.height > 80 ? 2 : 1
  for (let y = 0; y < cv.height; y += step) {
    for (let x = 0; x < cv.width; x += step) {
      if (data[(y * cv.width + x) * 4 + 3] > 140) ink.push(x, y)
    }
  }
  if (!ink.length) return null
  const out = new Float32Array(count * 2)
  for (let i = 0; i < count; i++) {
    const k = Math.floor(Math.random() * (ink.length / 2)) * 2
    out[i * 2] = box.left - pad - shiftX + ink[k] + Math.random() * step
    out[i * 2 + 1] = box.top - pad + ink[k + 1] + Math.random() * step
  }
  return out
}

export function createTitleParticles({ count = 1600, depth = 400, pixelRatio = 1 } = {}) {
  const from = new BufferAttribute(new Float32Array(count * 3), 3)
  const to = new BufferAttribute(new Float32Array(count * 3), 3)
  const col = new BufferAttribute(new Float32Array(count * 3), 3)
  const geo = new BufferGeometry()
  // `position` sólo para que three tenga algo que contar; el shader usa aFrom/aTo.
  geo.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3))
  geo.setAttribute('aFrom', from)
  geo.setAttribute('aTo', to)
  geo.setAttribute('aCol', col)
  geo.setAttribute('aSeed', new BufferAttribute(new Float32Array(count).map(() => Math.random()), 1))
  const uniforms = {
    uT: { value: 1 }, uMode: { value: 0 }, uPx: { value: pixelRatio },
    uPaper: { value: new Color(0xece8de) },
  }
  const mat = new ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending,
  })
  const points = new Points(geo, mat)
  points.frustumCulled = false
  points.renderOrder = 10
  points.visible = false

  let at = 0, ms = 1, onDone = null, fired = false
  const tmp = new Color()

  return {
    points,
    count,
    depth,
    // Pantalla → espacio de cámara, sobre el plano z = -depth.
    screenToCamera(sx, sy, w, h, camera, out, i) {
      const halfH = Math.tan((camera.fov * Math.PI) / 360) * depth
      out[i * 3] = ((sx / w) * 2 - 1) * halfH * camera.aspect
      out[i * 3 + 1] = (1 - (sy / h) * 2) * halfH
      out[i * 3 + 2] = -depth
    },
    // mode 'form' | 'dissolve'. fill(fromArr, toArr) escribe las posiciones.
    start(mode, fill, palette, now, duration, done) {
      fill(from.array, to.array)
      for (let i = 0; i < count; i++) {
        tmp.set(palette[(Math.random() * palette.length) | 0])
        col.array.set([tmp.r, tmp.g, tmp.b], i * 3)
      }
      from.needsUpdate = to.needsUpdate = col.needsUpdate = true
      uniforms.uMode.value = mode === 'form' ? 0 : 1
      uniforms.uT.value = 0
      at = now; ms = duration; onDone = done; fired = false
      points.visible = true
    },
    // Devuelve el progreso; llama a done(p) una vez cuando pasa de 0.8 (es
    // cuando el texto real tiene que empezar a aparecer).
    update(now) {
      if (!points.visible) return 1
      const p = Math.min(1, (now - at) / ms)
      uniforms.uT.value = p
      if (!fired && p > 0.8) { fired = true; onDone?.() }
      if (p >= 1) points.visible = false
      return p
    },
    get busy() { return points.visible },
    dispose() { geo.dispose(); mat.dispose() },
  }
}
