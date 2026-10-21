import React, { useEffect, useRef } from 'react'
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, Group, PerspectiveCamera,
  Points, Quaternion, Scene, ShaderMaterial, Vector3, WebGLRenderer,
} from 'three'
import { SHAPES } from '../../engine/shapes/procedural'
import { createSwipeDetector, SWIPE_DEFAULTS } from '../../engine/gestures'

// Experimento: los puntos de la retícula, envueltos en un globo que se agarra
// con la mano.
//
// Agarre, no puntero: mover la mano a la derecha arrastra la cara frontal hacia
// la derecha, como empujar un globo terráqueo con la palma. x recorre una vuelta
// completa (±180°) e y llega a los polos (±90°), así que todo el globo es
// alcanzable sin soltar.
//
// Seis zonas de color, una por eje. Un globo de puntos del mismo color se ve
// igual desde cualquier lado y no hay forma de saber hacia dónde lo giraste; con
// zonas, el color que tenés al frente ES la respuesta. El etiquetado de abajo a
// la derecha dice lo mismo en palabras.
//
// Los dedos siguen mandando lo que mandaban en la retícula: el campo. Vive en el
// centro de la cara frontal —donde "estás"— y abrir la mano lo agranda, levanta
// los puntos hacia afuera y los enciende.
//
// Swipe con la mano abierta cambia de forma: a la derecha la siguiente, a la
// izquierda la anterior (flechas del teclado para probar sin cámara). Cada punto
// viaja de su sitio en la forma vieja al suyo en la nueva, con un estallido a
// mitad de camino para que el cambio se lea como transformación y no como corte.

const ZONES = [
  { name: 'Front', axis: [0, 0, 1],  color: 0xf5a524 },   // ámbar — --accent
  { name: 'Back',  axis: [0, 0, -1], color: 0xa78bfa },   // violeta
  { name: 'East',  axis: [1, 0, 0],  color: 0x2dd4bf },   // turquesa
  { name: 'West',  axis: [-1, 0, 0], color: 0xf97316 },   // coral
  { name: 'North', axis: [0, 1, 0],  color: 0x7dd3fc },   // celeste
  { name: 'South', axis: [0, -1, 0], color: 0x4ade80 },   // verde
]

const VERT = /* glsl */`
  uniform vec3  uAxis[6];
  uniform vec3  uCol[6];
  uniform vec3  uField;      // centro del campo, en mundo
  uniform float uRadius;     // alcance del campo, en mundo
  uniform float uLift;       // cuánto levanta los puntos
  uniform float uTime;
  uniform float uGlobeR;
  uniform vec3  uCenter;     // centro del globo, en mundo
  uniform float uMorph;      // 0 = forma de origen, 1 = forma destino
  attribute float aSeed;
  attribute vec3  aTo;
  varying vec3  vCol;
  varying float vGlow;
  varying float vFront;

  void main() {
    float m = uMorph * uMorph * (3.0 - 2.0 * uMorph);   // smoothstep
    vec3 p = mix(position, aTo, m);
    vec3 n = normalize(p + vec3(1e-4));
    // Estallido: máximo a mitad del morph, cero en los extremos. La semilla lo
    // reparte desparejo, si no todos los puntos se inflan como un solo globo.
    p += n * sin(m * 3.14159) * (30.0 + aSeed * 70.0);

    // Color de zona por peso angular. La potencia alta deja cada zona sólida en
    // su centro y mezcla sólo cerca de los bordes: suficiente para saber dónde
    // estás sin perder la transición entre zonas vecinas.
    vec3  acc = vec3(0.0);
    float wsum = 0.0;
    for (int i = 0; i < 6; i++) {
      float w = pow(max(dot(n, uAxis[i]), 0.0), 5.0);
      acc  += uCol[i] * w;
      wsum += w;
    }
    vCol = acc / max(wsum, 1e-4);

    vec4 world = modelMatrix * vec4(p, 1.0);
    vec3 wn = normalize(world.xyz - uCenter + vec3(1e-4));

    // El campo empuja a lo largo de la normal: en un globo "hacia afuera" es la
    // única dirección que no lo deforma en óvalo.
    float f = 0.0;
    if (uRadius > 0.01) {
      f = 1.0 - smoothstep(0.0, uRadius, length(world.xyz - uField));
      world.xyz += wn * f * uLift;
    }
    // Respiración, igual que la retícula: en reposo no parece una foto.
    world.xyz += wn * sin(uTime * 0.0009 + aSeed * 6.2831) * 2.2;
    vGlow = f;

    // Cara visible vs. cara de atrás: atrás se apaga para que el volumen se lea
    // y el color del frente no se ensucie con el de la otra mitad.
    // Por profundidad y no por normal: en las formas planas (galaxia, corazón)
    // la normal desde el centro no dice nada sobre qué lado está más cerca.
    vFront = clamp(0.5 + (world.z - uCenter.z) / (2.0 * uGlobeR), 0.0, 1.0);

    vec4 mv = viewMatrix * world;
    gl_PointSize = (2.2 + f * 4.5) * (1000.0 / max(-mv.z, 1.0));
    gl_Position  = projectionMatrix * mv;
  }
`

const FRAG = /* glsl */`
  uniform vec3 uHot;
  varying vec3  vCol;
  varying float vGlow;
  varying float vFront;

  void main() {
    vec2  c = gl_PointCoord - 0.5;
    float r = dot(c, c);
    if (r > 0.25) discard;
    float edge = 1.0 - smoothstep(0.15, 0.25, r);
    vec3  col  = mix(vCol, uHot, vGlow * 0.7);
    float a    = mix(0.18, 0.95, smoothstep(0.15, 0.75, vFront));
    gl_FragColor = vec4(col, (a + vGlow * 0.3) * edge);
  }
`

const GLOBE_R = 240

// Umbrales del swipe: los de engine/gestures.js, compartidos con el sitio.
const SWIPE_COOLDOWN = SWIPE_DEFAULTS.cooldown
const MORPH_MS = 1100

// Mano abierta, de frente. Se dibuja inline: un ícono descargado sería una
// petición más, y el panel de privacidad las cuenta.
const HandIcon = () => (
  <svg viewBox="0 0 40 48" width="34" height="40" aria-hidden="true">
    <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 26V10a2.5 2.5 0 0 1 5 0v12" />
      <path d="M17 21V6a2.5 2.5 0 0 1 5 0v15" />
      <path d="M22 21V8a2.5 2.5 0 0 1 5 0v14" />
      <path d="M27 22v-9a2.5 2.5 0 0 1 5 0v15c0 9-5.5 15-13 15-5 0-8-2.5-11-7l-5-8a2.6 2.6 0 0 1 4.3-2.9L12 29" />
    </g>
  </svg>
)

const hex = c => `#${c.toString(16).padStart(6, '0')}`

export default function GlobeScene({ signal, onFail }) {
  const hostRef = useRef(null)
  const labelRef = useRef(null)
  const shapeRef = useRef(null)
  const guideRef = useRef(null)
  const fillRRef = useRef(null)
  const fillLRef = useRef(null)
  const capRef = useRef(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let renderer
    try {
      renderer = new WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' })
    } catch {
      onFail?.()
      return
    }
    if (!renderer.getContext()) { onFail?.(); return }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
    renderer.setClearColor(0x000000, 0)
    host.appendChild(renderer.domElement)

    const scene = new Scene()
    const camera = new PerspectiveCamera(45, 1, 1, 4000)
    camera.position.set(0, 0, 900)

    const small = (host.clientWidth || 1024) < 700
    const count = small ? 2600 : 6000
    const shapes = SHAPES.map(sh => sh.build(count, GLOBE_R))
    const seed = new Float32Array(count).map(() => Math.random())
    const from = new BufferAttribute(shapes[0].slice(), 3)
    const to = new BufferAttribute(shapes[0].slice(), 3)
    const geo = new BufferGeometry()
    geo.setAttribute('position', from)
    geo.setAttribute('aTo', to)
    geo.setAttribute('aSeed', new BufferAttribute(seed, 1))

    const uniforms = {
      uAxis:   { value: ZONES.map(z => new Vector3(...z.axis)) },
      uCol:    { value: ZONES.map(z => new Color(z.color)) },
      uField:  { value: new Vector3() },
      uRadius: { value: 0 },
      uLift:   { value: 0 },
      uTime:   { value: 0 },
      uGlobeR: { value: GLOBE_R },
      uCenter: { value: new Vector3() },
      uHot:    { value: new Color(0xfff4dc) },
      uMorph:  { value: 1 },
    }
    const mat = new ShaderMaterial({
      uniforms, vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, blending: AdditiveBlending,
    })

    const globe = new Group()
    const points = new Points(geo, mat)
    // La caja de colisión es la de `position`, que durante el morph no es donde
    // están los puntos. Sin esto three puede descartar la forma entera.
    points.frustumCulled = false
    globe.add(points)

    // ── Ayuda visual del gesto ──────────────────────────────────────────────
    // Todo por refs y atributos: se actualiza en el mismo rAF que la escena, sin
    // pasar por React. `data-state` lo lee el CSS: idle (sin mano → demo
    // animada), closed (mano vista pero cerrada), open (lista para el swipe).
    let flashTimer = 0, guideState = ''
    const setGuide = (state, caption) => {
      const g = guideRef.current
      if (!g || state === guideState) return
      guideState = state
      g.dataset.state = state
      if (capRef.current) capRef.current.textContent = caption
    }
    const flash = dir => {
      const g = guideRef.current
      if (!g) return
      g.dataset.flash = dir > 0 ? 'next' : 'prev'
      clearTimeout(flashTimer)
      flashTimer = setTimeout(() => { delete g.dataset.flash }, 700)
    }
    const setMeter = p => {
      // p ∈ [-1, 1]: cuánto del recorrido que pide el swipe ya hiciste, y hacia
      // dónde. Se llena desde el centro hacia el lado del movimiento.
      if (fillRRef.current) fillRRef.current.style.transform = `scaleX(${Math.max(0, p)})`
      if (fillLRef.current) fillLRef.current.style.transform = `scaleX(${Math.max(0, -p)})`
    }

    // ── Morph ───────────────────────────────────────────────────────────────
    let current = 0, morphAt = -Infinity
    const showShape = () => {
      if (shapeRef.current) {
        shapeRef.current.textContent = `${SHAPES[current].name} · ${current + 1}/${SHAPES.length}`
      }
    }
    showShape()
    const goTo = (dir, now) => {
      // Si el morph anterior no terminó, el origen es donde están los puntos
      // AHORA, no la forma de origen: si no, cambiar rápido salta.
      const m0 = Math.min(1, (now - morphAt) / MORPH_MS)
      const m = m0 * m0 * (3 - 2 * m0)
      const f = from.array, t = to.array
      for (let i = 0; i < f.length; i++) f[i] += (t[i] - f[i]) * m
      current = (current + dir + SHAPES.length) % SHAPES.length
      t.set(shapes[current])
      from.needsUpdate = true
      to.needsUpdate = true
      morphAt = now
      showShape()
      flash(dir)
    }

    const onKey = e => {
      if (e.key === 'ArrowRight') goTo(1, performance.now())
      if (e.key === 'ArrowLeft') goTo(-1, performance.now())
    }
    window.addEventListener('keydown', onKey)
    scene.add(globe)

    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(host)

    let visible = true, awake = true, raf = 0
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting }, { rootMargin: '80px' })
    io.observe(host)
    const onVis = () => { awake = document.visibilityState === 'visible' }
    document.addEventListener('visibilitychange', onVis)

    const toCam = new Vector3(0, 0, 1)
    const front = new Vector3()
    const inv = new Quaternion()
    let shown = -1

    const swipes = createSwipeDetector()
    // Rotación con su propio seguimiento: durante un swipe la mano cruza medio
    // cuadro y, si el globo la siguiera, cada cambio de forma vendría con media
    // vuelta de regalo. Se congela en el ángulo de antes del swipe y vuelve
    // despacio a seguir la mano.
    let rotX = 0, rotY = 0, holdUntil = 0, heldX = 0, heldY = 0

    const tick = now => {
      raf = requestAnimationFrame(tick)
      if (!visible || !awake) return
      const s = signal.current
      const onCam = s.source === 'hand' || s.source === 'face'

      // ── Swipe ─────────────────────────────────────────────────────────────
      const sw = swipes.push(s, now)
      if (sw.swipe) {
        goTo(sw.swipe.dir, now)
        holdUntil = now + SWIPE_COOLDOWN
        heldX = sw.swipe.from.x; heldY = sw.swipe.from.y
      }
      if (sw.state === 'idle') {
        setGuide('idle', s.source === 'hand'
          ? 'Show your hand to the camera'
          : 'Open hand, swipe sideways  ·  or ← →')
      } else {
        setGuide(sw.state, sw.state === 'open'
          ? 'Swipe right for next · left for previous' : 'Open your hand to swipe')
      }
      setMeter(sw.progress)
      uniforms.uMorph.value = Math.min(1, (now - morphAt) / MORPH_MS)

      // Euler XYZ = Rx·Ry: el giro horizontal es sobre el eje propio del globo
      // y la inclinación siempre hacia quien mira, como un globo terráqueo.
      const holding = now < holdUntil
      const tx = holding ? heldX : s.x, ty = holding ? heldY : s.y
      // Rápido en régimen normal (la señal ya está filtrada); lento al soltar
      // el congelado, para que volver a la mano no sea un latigazo.
      const k = holding || now - holdUntil > 900 ? 0.35 : 0.05
      rotX += (ty - rotX) * k
      rotY += (tx - rotY) * k
      globe.rotation.set(rotX * Math.PI / 2, rotY * Math.PI, 0)
      // Acercar la mano acerca el globo.
      globe.position.z = s.z * 260
      globe.updateMatrixWorld()
      uniforms.uCenter.value.setFromMatrixPosition(globe.matrixWorld)

      // Campo en el punto del globo que mira a la cámara. Sin cámara se queda en
      // un tamaño medio para que el puntero también muestre el efecto.
      const n = Math.max(0, Math.min(5, onCam ? (s.fingers ?? 5) : 3)) / 5
      uniforms.uField.value.copy(uniforms.uCenter.value).z += GLOBE_R
      uniforms.uRadius.value = n * GLOBE_R * 0.95
      uniforms.uLift.value = n * 34
      uniforms.uTime.value = now

      // Qué zona está al frente: la dirección a la cámara, llevada al espacio
      // local del globo. El DOM se toca sólo cuando cambia, no por cuadro.
      inv.copy(globe.quaternion).invert()
      front.copy(toCam).applyQuaternion(inv)
      let best = 0, bestDot = -2
      ZONES.forEach((z, i) => {
        const d = front.x * z.axis[0] + front.y * z.axis[1] + front.z * z.axis[2]
        if (d > bestDot) { bestDot = d; best = i }
      })
      if (best !== shown && labelRef.current) {
        shown = best
        labelRef.current.textContent = ZONES[best].name
        labelRef.current.style.color = hex(ZONES[best].color)
      }

      renderer.render(scene, camera)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      io.disconnect(); ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('keydown', onKey)
      clearTimeout(flashTimer)
      geo.dispose(); mat.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode) renderer.domElement.remove()
    }
  }, [signal, onFail])

  return (
    <div ref={hostRef} className="hero__lattice" aria-hidden="true">
      <div className="globe__zone">
        <span className="globe__zone-label">Facing</span>
        <span ref={labelRef} className="globe__zone-name" />
        <span ref={shapeRef} className="globe__zone-label" />
      </div>

      <div ref={guideRef} className="gesture" data-state="idle">
        <div className="gesture__stage">
          <span className="gesture__arrow gesture__arrow--l">‹</span>
          <span className="gesture__hand"><HandIcon /></span>
          <span className="gesture__arrow gesture__arrow--r">›</span>
        </div>
        <div className="gesture__meter">
          <span ref={fillLRef} className="gesture__fill gesture__fill--l" />
          <span ref={fillRRef} className="gesture__fill gesture__fill--r" />
          <span className="gesture__notch" />
        </div>
        <span ref={capRef} className="gesture__caption" />
      </div>
    </div>
  )
}
