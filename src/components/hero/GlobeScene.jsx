import React, { useEffect, useRef } from 'react'
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, Group, PerspectiveCamera,
  Points, Quaternion, Scene, ShaderMaterial, Vector3, WebGLRenderer,
} from 'three'

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
  attribute float aSeed;
  varying vec3  vCol;
  varying float vGlow;
  varying float vFront;

  void main() {
    vec3 n = normalize(position);

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

    vec4 world = modelMatrix * vec4(position, 1.0);
    vec3 wn = normalize(world.xyz - uCenter);

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
    vFront = wn.z * 0.5 + 0.5;

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
    float a    = mix(0.12, 0.95, smoothstep(0.25, 0.85, vFront));
    gl_FragColor = vec4(col, (a + vGlow * 0.3) * edge);
  }
`

const GLOBE_R = 240

// Puntos sobre una espiral de Fibonacci: reparto casi uniforme sin el
// amontonamiento en los polos que da una malla de latitud/longitud.
function fibonacciSphere(count) {
  const pos = new Float32Array(count * 3)
  const seed = new Float32Array(count)
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2
    const r = Math.sqrt(1 - y * y)
    const t = golden * i
    pos[i * 3]     = Math.cos(t) * r * GLOBE_R
    pos[i * 3 + 1] = y * GLOBE_R
    pos[i * 3 + 2] = Math.sin(t) * r * GLOBE_R
    seed[i] = Math.random()
  }
  return { pos, seed }
}

const hex = c => `#${c.toString(16).padStart(6, '0')}`

export default function GlobeScene({ signal, onFail }) {
  const hostRef = useRef(null)
  const labelRef = useRef(null)

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
    const { pos, seed } = fibonacciSphere(small ? 2600 : 6000)
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(pos, 3))
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
    }
    const mat = new ShaderMaterial({
      uniforms, vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, blending: AdditiveBlending,
    })

    const globe = new Group()
    globe.add(new Points(geo, mat))
    scene.add(globe)

    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      // En pantallas anchas el globo se corre a la derecha, fuera de la columna
      // del texto (que además la máscara de .hero__lattice oscurece).
      globe.position.x = camera.aspect > 1.2 ? Math.min(330, 190 * camera.aspect) : 0
      globe.position.y = camera.aspect > 1.2 ? 0 : -120
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

    const tick = now => {
      raf = requestAnimationFrame(tick)
      if (!visible || !awake) return
      const s = signal.current
      const onCam = s.source === 'hand' || s.source === 'face'

      // Euler XYZ = Rx·Ry: el giro horizontal es sobre el eje propio del globo
      // y la inclinación siempre hacia quien mira, como un globo terráqueo.
      globe.rotation.set(s.y * Math.PI / 2, s.x * Math.PI, 0)
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
      </div>
    </div>
  )
}
