import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, Points, ShaderMaterial, Vector3,
} from 'three'

// La nube de puntos morfable del globo, separada de la escena que la usa.
//
// Cada punto i de una forma viaja al punto i de la siguiente, así que todas las
// formas tienen que traer exactamente `count` puntos (las fuentes de
// shapes/sources.js lo garantizan). La paleta también viaja: seis colores, uno
// por eje, y el color de un punto sale de hacia dónde mira. Durante el morph
// se mezclan paleta vieja y nueva al mismo ritmo que la posición.
//
// Los dedos mandan el campo: vive en la cara frontal y abrir la mano lo
// agranda, levanta los puntos y los enciende.

export const AXES = [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]]

const VERT = /* glsl */`
  uniform vec3  uAxis[6];
  uniform vec3  uCol[6];
  uniform vec3  uColTo[6];
  uniform vec3  uField;      // centro del campo, en mundo
  uniform float uRadius;     // alcance del campo, en mundo
  uniform float uLift;       // cuánto levanta los puntos
  uniform float uTime;
  uniform float uSize;       // radio de referencia de las formas
  uniform vec3  uCenter;     // centro de la nube, en mundo
  uniform float uMorph;      // 0 = forma de origen, 1 = forma destino
  uniform float uBurst;      // cuánto se infla a mitad de camino
  uniform float uFar;        // distancia a la que la niebla ya se la comió
  attribute float aSeed;
  attribute vec3  aTo;
  varying vec3  vCol;
  varying float vGlow;
  varying float vFront;
  varying float vFog;

  vec3 zone(vec3 n, vec3 cols[6]) {
    // Potencia alta: cada zona sólida en su centro, mezcla sólo en los bordes.
    vec3  acc = vec3(0.0);
    float wsum = 0.0;
    for (int i = 0; i < 6; i++) {
      float w = pow(max(dot(n, uAxis[i]), 0.0), 5.0);
      acc  += cols[i] * w;
      wsum += w;
    }
    return acc / max(wsum, 1e-4);
  }

  void main() {
    float m = uMorph * uMorph * (3.0 - 2.0 * uMorph);   // smoothstep
    vec3 p = mix(position, aTo, m);
    vec3 n = normalize(p + vec3(1e-4));
    // Estallido: máximo a mitad del morph, cero en los extremos. La semilla lo
    // reparte desparejo, si no todos los puntos se inflan como un solo globo.
    p += n * sin(m * 3.14159) * uBurst * (0.3 + aSeed * 0.7);

    vCol = mix(zone(n, uCol), zone(n, uColTo), m);

    vec4 world = modelMatrix * vec4(p, 1.0);
    vec3 wn = normalize(world.xyz - uCenter + vec3(1e-4));

    float f = 0.0;
    if (uRadius > 0.01) {
      f = 1.0 - smoothstep(0.0, uRadius, length(world.xyz - uField));
      world.xyz += wn * f * uLift;
    }
    // Respiración: en reposo no parece una foto.
    world.xyz += wn * sin(uTime * 0.0009 + aSeed * 6.2831) * 2.2;
    vGlow = f;

    // Por profundidad hacia la cámara y no por normal: en las formas planas
    // (texto, galaxia) la normal desde el centro no dice qué lado está más
    // cerca. cameraPosition lo inyecta three: en un mundo donde la cámara
    // vuela, "adelante" no es +z.
    vec3 toCam = normalize(cameraPosition - uCenter + vec3(1e-4));
    vFront = clamp(0.5 + dot(world.xyz - uCenter, toCam) / (2.0 * uSize), 0.0, 1.0);

    vec4 mv = viewMatrix * world;
    float d = -mv.z;
    // Niebla lejos (las otras formaciones se ven, pero como lugares a los que
    // ir) y desvanecido cerca: el vuelo pasa a través de las nubes, y un punto
    // pegado al ojo sería un disco que tapa la pantalla.
    vFog = smoothstep(20.0, 180.0, d) * (1.0 - smoothstep(uFar * 0.35, uFar, d));
    gl_PointSize = min(42.0, (2.2 + f * 4.5) * (1000.0 / max(d, 1.0)));
    gl_Position  = projectionMatrix * mv;
  }
`

const FRAG = /* glsl */`
  uniform vec3  uHot;
  uniform float uDim;
  varying vec3  vCol;
  varying float vGlow;
  varying float vFront;
  varying float vFog;

  void main() {
    vec2  c = gl_PointCoord - 0.5;
    float r = dot(c, c);
    if (r > 0.25) discard;
    float edge = 1.0 - smoothstep(0.15, 0.25, r);
    vec3  col  = mix(vCol, uHot, vGlow * 0.7);
    float a    = mix(0.18, 0.95, smoothstep(0.15, 0.75, vFront));
    gl_FragColor = vec4(col, (a + vGlow * 0.3) * edge * uDim * vFog);
  }
`

const toColors = palette => palette.map(c => new Color(c))

export function createPointCloud({ positions, palette, size = 240, morphMs = 1100, burst = 60, far = 1e5 }) {
  const count = positions.length / 3
  const from = new BufferAttribute(positions.slice(), 3)
  const to = new BufferAttribute(positions.slice(), 3)
  const geo = new BufferGeometry()
  geo.setAttribute('position', from)
  geo.setAttribute('aTo', to)
  geo.setAttribute('aSeed', new BufferAttribute(new Float32Array(count).map(() => Math.random()), 1))

  const uniforms = {
    uAxis:   { value: AXES.map(a => new Vector3(...a)) },
    uCol:    { value: toColors(palette) },
    uColTo:  { value: toColors(palette) },
    uField:  { value: new Vector3() },
    uRadius: { value: 0 },
    uLift:   { value: 0 },
    uTime:   { value: 0 },
    uSize:   { value: size },
    uCenter: { value: new Vector3() },
    uHot:    { value: new Color(0xfff4dc) },
    uMorph:  { value: 1 },
    uBurst:  { value: burst },
    uDim:    { value: 1 },
    uFar:    { value: far },
  }
  const mat = new ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, blending: AdditiveBlending,
  })
  const points = new Points(geo, mat)
  // La caja de colisión es la de `position`, que durante el morph no es donde
  // están los puntos. Sin esto three puede descartar la forma entera.
  points.frustumCulled = false

  let morphAt = -Infinity
  const progress = now => Math.min(1, (now - morphAt) / morphMs)

  return {
    points,
    uniforms,
    get morphing() { return uniforms.uMorph.value < 1 },
    // Si el morph anterior no terminó, el origen es donde están los puntos
    // AHORA: si no, cambiar rápido salta. Igual con la paleta.
    morphTo(next, nextPalette, now, { burst: b = burst } = {}) {
      const m0 = progress(now)
      const m = m0 * m0 * (3 - 2 * m0)
      const f = from.array, t = to.array
      for (let i = 0; i < f.length; i++) f[i] += (t[i] - f[i]) * m
      t.set(next)
      from.needsUpdate = true
      to.needsUpdate = true
      uniforms.uCol.value.forEach((c, i) => c.lerp(uniforms.uColTo.value[i], m))
      if (nextPalette) uniforms.uColTo.value.forEach((c, i) => c.set(nextPalette[i]))
      uniforms.uBurst.value = b
      morphAt = now
    },
    update(now) {
      uniforms.uMorph.value = progress(now)
      uniforms.uTime.value = now
    },
    dispose() { geo.dispose(); mat.dispose() },
  }
}
