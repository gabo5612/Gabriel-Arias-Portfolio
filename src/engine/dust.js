import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Points, ShaderMaterial } from 'three'

// Polvo: miles de puntos chicos repartidos alrededor del circuito. No dicen
// nada; existen para que el vuelo se sienta como movimiento. Sin referencias
// cercanas, una cámara que se traslada en el vacío parece quieta y lo que se
// mueve son las formaciones.
//
// `speed` (0..1) lo escribe quien mueve la cámara: con velocidad el polvo se
// enciende y crece un poco, que es lo que el ojo lee como "ir rápido".

const VERT = /* glsl */`
  uniform float uTime;
  uniform float uSpeed;
  uniform float uFar;
  attribute float aSeed;
  varying float vA;

  void main() {
    vec3 p = position;
    p.y += sin(uTime * 0.0002 + aSeed * 40.0) * 12.0;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float d = -mv.z;
    // Cerca se apaga: un punto a dos unidades del ojo sería un disco gigante.
    float nearFade = smoothstep(30.0, 260.0, d);
    float farFade  = 1.0 - smoothstep(uFar * 0.45, uFar, d);
    vA = nearFade * farFade * (0.3 + aSeed * 0.6) * (1.0 + uSpeed * 2.2);
    gl_PointSize = min(18.0, (1.0 + aSeed * 1.6 + uSpeed * 1.2) * (700.0 / max(d, 1.0)));
    gl_Position = projectionMatrix * mv;
  }
`

const FRAG = /* glsl */`
  uniform vec3 uCol;
  varying float vA;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = dot(c, c);
    if (r > 0.25) discard;
    gl_FragColor = vec4(uCol, vA * (1.0 - smoothstep(0.05, 0.25, r)));
  }
`

// Reparte los puntos en un toro grueso alrededor de `curve` (cerrada): así el
// polvo acompaña al recorrido en vez de llenar un cubo donde casi todo queda
// lejos de la cámara.
export function createDust(curve, { count = 5000, spread = 900, height = 650, far = 4200, color = 0xcfd6ff } = {}) {
  const p = new Float32Array(count * 3)
  const seed = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const c = curve.getPoint(Math.random())
    const a = Math.random() * Math.PI * 2
    // Raíz: densidad pareja en el disco; sin ella todo se apelotona en el eje.
    const r = Math.sqrt(Math.random()) * spread
    p.set([c.x + Math.cos(a) * r, c.y + (Math.random() - 0.5) * height, c.z + Math.sin(a) * r], i * 3)
    seed[i] = Math.random()
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(p, 3))
  geo.setAttribute('aSeed', new BufferAttribute(seed, 1))
  const uniforms = {
    uTime: { value: 0 }, uSpeed: { value: 0 }, uFar: { value: far }, uCol: { value: new Color(color) },
  }
  const mat = new ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, blending: AdditiveBlending,
  })
  const points = new Points(geo, mat)
  points.frustumCulled = false
  return { points, uniforms, dispose() { geo.dispose(); mat.dispose() } }
}
