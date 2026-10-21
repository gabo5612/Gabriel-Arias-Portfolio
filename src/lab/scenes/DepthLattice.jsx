import React, { useEffect, useRef } from 'react'
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, Group, LineBasicMaterial,
  LineLoop, PerspectiveCamera, Points, Scene, ShaderMaterial, Vector3, WebGLRenderer,
} from 'three'

// Retícula volumétrica con perspectiva acoplada a la cabeza.
//
// Este archivo SOLO debe alcanzarse por import() dinámico: importa `three`, y
// scripts/verify-budget.mjs falla el build si `three` aparece en un chunk del
// primer render.
//
// La idea que hace que valga la pena encender la cámara: no se mueve la escena,
// se reconstruye el FRUSTUM. Con una cámara normal, girar la vista deforma la
// imagen igual para todos. Con un frustum fuera de eje, el monitor se comporta
// como un hueco en la pared: asomás la cabeza a la izquierda y ves el lado
// izquierdo del volumen, con la geometría correcta. El puntero no puede
// falsificar eso, y es exactamente lo que 3dtrack hace contra la cámara de
// Spline en updateCamera() — acá contra el proyector de three.

const VERT = /* glsl */`
  uniform vec3  uAttract;
  uniform vec3  uAttract2;
  uniform float uRadius;
  uniform float uRadius2;
  uniform float uPush;
  uniform float uPush2;
  uniform float uTime;
  attribute float aSeed;
  varying float vGlow;    // campo de la mano 1
  varying float vGlow2;   // campo de la mano 2
  varying float vFade;

  void main() {
    vec3 p = position;

    // Respiración: sin esto la retícula en reposo se lee como una imagen fija.
    p.z += sin(uTime * 0.0007 + aSeed * 6.2831) * 4.0;
    p.x += cos(uTime * 0.0005 + aSeed * 4.7) * 1.6;

    // Una animación distinta por mano, no el mismo efecto en dos sitios.
    //
    //   Mano 1 — REPULSIÓN. Empuja los puntos hacia afuera y los enciende en
    //            cálido. Abre un hueco: es un soplido.
    //   Mano 2 — ATRACCIÓN CON REMOLINO. Tira hacia adentro y arrastra en
    //            tangente, así que junta los puntos en un nudo que gira, en frío.
    //
    // Que una abra y la otra cierre es lo que las hace legibles a la vez: con
    // las dos manos en cuadro se ve al instante cuál es cuál.
    float f = 0.0, f2 = 0.0;
    if (uRadius > 0.01) {
      vec3  d1 = p - uAttract;
      f = 1.0 - smoothstep(0.0, uRadius, length(d1));
      p += normalize(d1 + vec3(1e-4)) * f * uPush;
    }
    if (uRadius2 > 0.01) {
      vec3  d2 = p - uAttract2;
      f2 = 1.0 - smoothstep(0.0, uRadius2, length(d2));
      vec3  dir = normalize(d2 + vec3(1e-4));
      // La tangente sale del producto vectorial con el eje de profundidad: gira
      // en el plano de la pantalla, que es el único plano que el espectador ve.
      vec3  tan2 = normalize(cross(dir, vec3(0.0, 0.0, 1.0)) + vec3(1e-4));
      p -= dir  * f2 * uPush2 * 0.80;
      p += tan2 * f2 * uPush2 * (0.85 + 0.35 * sin(uTime * 0.0012 + aSeed * 5.0));
    }
    vGlow  = f;
    vGlow2 = f2;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    // Niebla por profundidad: da la pista de distancia que el paralaje solo no
    // alcanza a dar en una retícula regular.
    vFade = clamp(1.0 - (-mv.z - 620.0) / 900.0, 0.0, 1.0);
    gl_PointSize = (2.4 + f * 5.2) * (1150.0 / max(-mv.z, 1.0));
    gl_Position  = projectionMatrix * mv;
  }
`

const FRAG = /* glsl */`
  uniform vec3 uDeep;    // lejos
  uniform vec3 uMid;     // media distancia
  uniform vec3 uNear;    // cerca
  uniform vec3 uHot;     // excitado por la mano 1 — cálido
  uniform vec3 uHot2;    // excitado por la mano 2 — frío
  varying float vGlow;
  varying float vGlow2;
  varying float vFade;

  void main() {
    vec2  c = gl_PointCoord - 0.5;
    float r = dot(c, c);
    if (r > 0.25) discard;                       // recorte circular
    float edge = 1.0 - smoothstep(0.15, 0.25, r);

    // El color codifica profundidad: turquesa al fondo, coral a media
    // distancia, ámbar al frente. Es la misma pista que da el tamaño del punto,
    // repetida en otro canal — dos señales redundantes leen mucho mejor que una.
    vec3 warm = vFade < 0.65
      ? mix(uDeep, uMid,  vFade / 0.65)
      : mix(uMid,  uNear, (vFade - 0.65) / 0.35);
    // Los dos campos pintan encima del degradado de profundidad, cada uno con
    // su color. Se aplican en orden en vez de sumarse: sumar dos colores casi
    // saturados sobre blending aditivo lo quema todo a blanco y las dos manos
    // dejarían de distinguirse justo donde se cruzan.
    vec3 col = mix(warm, uHot,  vGlow  * 0.85);
    col      = mix(col,  uHot2, vGlow2 * 0.90);

    // Piso de brillo alto a propósito. Los códecs de grabación de pantalla
    // descartan primero el detalle de bajo contraste sobre negro: lo que en el
    // monitor se ve bien, en un vídeo comprimido desaparece. El coste es un
    // fondo algo más presente; la alternativa era un efecto que no se puede
    // enseñar, que no sirve de nada en un portfolio.
    float depthA = 0.74 + 0.26 * vFade;
    float glow   = max(vGlow, vGlow2);
    gl_FragColor = vec4(col, (0.52 + glow * 0.48) * depthA * edge);
  }
`

// Dimensiones del volumen, en unidades de mundo. SCREEN_W es el ancho del
// "hueco en la pared"; todo lo demás se deriva de él.
const SCREEN_W = 520
const EYE_Z    = 620
const DEPTH_NEAR = -20, DEPTH_FAR = -880

// La rejilla se deriva del aspecto real de la ventana, no de constantes.
//
// Antes el alto era SCREEN_W * 0.95 = 494 unidades fijas. En escritorio la
// ventana mide 325 de alto y sobraba; en un móvil vertical mide 1155 y la
// retícula cubría el 43% — de ahí la banda de puntos con negro arriba y abajo.
// Ahora se calculan filas y columnas a partir de las extensiones que hacen
// falta, manteniendo la separación entre puntos constante.
function latticeSpec(screenH, cssWidth) {
  // Separación mayor en pantallas chicas: en un móvil el mismo paso de mundo
  // ocupa muchos menos píxeles y la retícula se vuelve una nube de ruido.
  const step  = cssWidth < 700 ? 30 : 21
  const xExt  = SCREEN_W * 1.35
  const yExt  = screenH * 1.5            // 1.5 para que sobre en los bordes al asomarse
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
  return {
    step, xExt, yExt,
    cols:  clamp(Math.round(xExt / step), 12, 48),
    rows:  clamp(Math.round(yExt / step), 12, 64),
    // Menos láminas en vertical: con tantas filas el conteo se dispara y el
    // móvil es justo donde menos margen hay.
    slabs: screenH > SCREEN_W * 1.3 ? 6 : 8,
  }
}

// Radios en función del paso de la rejilla, no en absoluto: con paso 30 un radio
// de 44 ya no alcanza "unas dos celdas", alcanza una y media.
const minR = step => step * 2.2
const maxR = step => step * 9.5

export default function DepthLattice({ signal, onFail }) {
  const hostRef = useRef(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let renderer
    try {
      renderer = new WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' })
    } catch {
      onFail?.()               // sin WebGL el hero se queda con las capas CSS
      return
    }
    if (!renderer.getContext()) { onFail?.(); return }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
    renderer.setClearColor(0x000000, 0)
    host.appendChild(renderer.domElement)

    const scene = new Scene()
    const camera = new PerspectiveCamera(50, 1, 1, 2200)

    // ── Geometría: rejilla en X, Y y varias láminas en Z ────────────────────
    // Se reconstruye cuando cambia el aspecto (rotar el teléfono, redimensionar
    // la ventana). Rellenar unos miles de floats cuesta menos de un milisegundo
    // y ocurre una vez por cambio, no por cuadro.
    const geo = new BufferGeometry()
    let spec = null

    const buildLattice = (screenH, cssWidth) => {
      const nx = latticeSpec(screenH, cssWidth)
      if (spec && spec.cols === nx.cols && spec.rows === nx.rows && spec.slabs === nx.slabs) return
      spec = nx
      const { cols, rows, slabs, xExt, yExt } = nx
      const count = cols * rows * slabs
      const pos = new Float32Array(count * 3)
      const seed = new Float32Array(count)
      let i = 0
      for (let s = 0; s < slabs; s++) {
        const z = DEPTH_NEAR + (DEPTH_FAR - DEPTH_NEAR) * (s / (slabs - 1))
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            // Cada lámina se desfasa media celda: alineadas, desde el eje se ven
            // como una sola rejilla plana y se pierde la sensación de volumen.
            const jitter = (s % 2) * 0.5
            pos[i * 3]     = ((c + jitter) / (cols - 1) - 0.5) * xExt
            pos[i * 3 + 1] = (r / (rows - 1) - 0.5) * yExt
            pos[i * 3 + 2] = z
            seed[i] = Math.random()
            i++
          }
        }
      }
      geo.setAttribute('position', new BufferAttribute(pos, 3))
      geo.setAttribute('aSeed', new BufferAttribute(seed, 1))
      geo.computeBoundingSphere()
    }
    buildLattice(SCREEN_W, host.clientWidth || 1024)

    const uniforms = {
      uAttract:  { value: new Vector3(0, 0, -200) },
      uAttract2: { value: new Vector3(0, 0, -230) },
      uRadius:   { value: 265 },
      uRadius2:  { value: 0 },
      uPush:     { value: 46 },
      uPush2:    { value: 46 },
      uTime:    { value: 0 },
      uDeep:    { value: new Color(0x5eead4) },   // turquesa claro — el oscuro se perdía al grabar
      uMid:     { value: new Color(0xf97316) },   // coral
      uNear:    { value: new Color(0xf5a524) },   // --accent de global.css
      uHot:     { value: new Color(0xffe6b8) },   // blanco cálido — mano 1
      uHot2:    { value: new Color(0xc7fff4) },   // blanco frío  — mano 2
    }
    const mat = new ShaderMaterial({
      uniforms, vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, blending: AdditiveBlending,
    })
    scene.add(new Points(geo, mat))

    // Un anillo por mano, siempre visible mientras esa mano esté en cuadro.
    //
    // Sin esto la interfaz es adivinanza: si tenés un dedo levantado se enciende
    // un punto entre miles y no sabés si el sistema te ve o si estás apuntando a
    // un hueco. El anillo dice dos cosas de un vistazo — DÓNDE está tu mano en la
    // escena, y CUÁNTO alcance tiene ahora mismo, porque su tamaño es el radio.
    const SEG = 72
    const ringPos = new Float32Array(SEG * 3)
    for (let k = 0; k < SEG; k++) {
      const a = (k / SEG) * Math.PI * 2
      ringPos[k * 3] = Math.cos(a)
      ringPos[k * 3 + 1] = Math.sin(a)
      ringPos[k * 3 + 2] = 0
    }
    const ringGeo = new BufferGeometry()
    ringGeo.setAttribute('position', new BufferAttribute(ringPos, 3))

    // Tres circunferencias concéntricas, no una. LineBasicMaterial ignora
    // linewidth en WebGL —siempre dibuja 1 píxel de dispositivo— y una línea de
    // 1 px es exactamente lo que borra la compresión de vídeo. Apiladas dan una
    // banda con grosor real que sí sobrevive a una grabación.
    const makeRing = hex => {
      const m = new LineBasicMaterial({
        color: hex, transparent: true, opacity: 0.85,
        blending: AdditiveBlending, depthWrite: false,
      })
      const g = new Group()
      for (const k of [1, 1.02, 1.04]) {
        const l = new LineLoop(ringGeo, m)
        l.scale.setScalar(k)
        g.add(l)
      }
      g.visible = false
      g.userData.mat = m
      scene.add(g)
      return g
    }
    const ring1 = makeRing(0xf5a524)   // ámbar — la mano que manda la cámara
    const ring2 = makeRing(0x2dd4bf)   // turquesa — la segunda

    // ── Frustum fuera de eje ────────────────────────────────────────────────
    // El ojo está en (ex, ey, ez) mirando a -z; la "ventana" es el rectángulo
    // SCREEN_W × SCREEN_H en z = 0. El frustum sale asimétrico y es lo que
    // produce la parallax geométricamente correcta.
    let screenH = SCREEN_W
    const applyEye = (ex, ey, ez) => {
      const n = camera.near, f = camera.far
      const hw = SCREEN_W / 2, hh = screenH / 2
      const k = n / ez
      camera.projectionMatrix.makePerspective(
        (-hw - ex) * k, (hw - ex) * k,
        ( hh - ey) * k, (-hh - ey) * k,
        n, f, camera.coordinateSystem,
      )
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert()
      camera.position.set(ex, ey, ez)
      camera.updateMatrixWorld()
    }

    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h, false)
      screenH = SCREEN_W * (h / w)
      buildLattice(screenH, w)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(host)

    // ── Bucle ───────────────────────────────────────────────────────────────
    let visible = true, awake = true, raf = 0
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting }, { rootMargin: '80px' })
    io.observe(host)
    const onVis = () => { awake = document.visibilityState === 'visible' }
    document.addEventListener('visibilitychange', onVis)

    const eye = new Vector3(0, 0, EYE_Z)
    const attract = new Vector3(0, 0, -200)
    const attract2 = new Vector3(0, 0, -230)

    // El radio sale de la geometría de la retícula, no de un número a ojo: los
    // puntos están a ~20 unidades entre sí en X, así que ONE_DOT alcanza a uno
    // solo. De ahí cada dedo multiplica el alcance por ~2,2.
    // Con el anillo marcando la posición, el campo ya no tiene que ser diminuto
    // para leerse como "preciso": el anillo comunica la precisión y el campo
    // comunica la fuerza. Un dedo abre un racimo chico pero VISIBLE, no un punto
    // suelto que se pierde entre miles.
    const radiusFor = n => {
      const f = Math.max(0, Math.min(5, n))
      const lo = minR(spec.step), hi = maxR(spec.step)
      return f <= 0 ? 0 : lo * Math.pow(hi / lo, (f - 1) / 4)
    }

    const tick = now => {
      raf = requestAnimationFrame(tick)
      if (!visible || !awake) return
      const s = signal.current

      // La cabeza mueve el ojo. z positivo = más cerca, así que acerca el ojo
      // a la ventana y el campo de visión se abre solo — no hay que tocar el fov.
      eye.set(s.x * SCREEN_W * 0.46, -s.y * screenH * 0.42, EYE_Z - s.z * 210)
      applyEye(eye.x, eye.y, Math.max(eye.z, 140))

      // El atractor vive a media profundidad, alineado con hacia dónde mirás.
      attract.set(s.x * SCREEN_W * 0.72, -s.y * screenH * 0.62, -230)
      uniforms.uAttract.value.lerp(attract, 0.14)

      // Dedos → radio. Puño cerrado apaga; mano abierta cubre el campo.
      //   0 dedos →   0     nada        3 dedos →  58   un racimo
      //   1 dedo  →  12     un punto    5 dedos → 288   todo el campo
      const radius = radiusFor(s.fingers ?? 5)
      uniforms.uRadius.value = radius
      uniforms.uPush.value   = 8 + (radius / maxR(spec.step)) * 44

      // El anillo va donde el atractor y con su radio, así que sigue la misma
      // perspectiva que la retícula: al asomar la cabeza también se desplaza.
      const onCam = s.source === 'hand' || s.source === 'face'
      ring1.visible = onCam
      if (onCam) {
        ring1.position.copy(uniforms.uAttract.value)
        ring1.scale.setScalar(Math.max(radius, minR(spec.step) * 0.5))
      }

      // Segunda mano: mismo tratamiento, atractor propio. Sin ella el radio
      // queda en cero y el shader se saltea el bloque entero.
      if (s.hands > 1) {
        attract2.set(s.x2 * SCREEN_W * 0.72, -s.y2 * screenH * 0.62, -230)
        uniforms.uAttract2.value.lerp(attract2, 0.14)
        const r2 = radiusFor(s.fingers2 ?? 0)
        uniforms.uRadius2.value = r2
        uniforms.uPush2.value   = 8 + (r2 / maxR(spec.step)) * 44
        ring2.visible = true
        ring2.position.copy(uniforms.uAttract2.value)
        ring2.scale.setScalar(Math.max(r2, minR(spec.step) * 0.5))
      } else {
        uniforms.uRadius2.value = 0
        ring2.visible = false
      }
      uniforms.uTime.value = now

      renderer.render(scene, camera)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      io.disconnect(); ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      geo.dispose(); mat.dispose(); ringGeo.dispose()
      ring1.userData.mat.dispose(); ring2.userData.mat.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode) renderer.domElement.remove()
    }
  }, [signal, onFail])

  return <div ref={hostRef} className="hero__lattice" aria-hidden="true" />
}
