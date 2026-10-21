import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, EdgesGeometry, Group,
  LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, Points, ShaderMaterial, Vector3,
} from 'three'

// Un avión de papel con estela. El mundo lo mueve (decide por dónde vuela);
// esto sólo sabe dibujarse, orientarse hacia donde va, ladearse en las curvas y
// dejar partículas detrás.
//
// La nariz apunta a +z, como espera Object3D.lookAt: mirar al punto siguiente
// del camino lo deja orientado sin cuentas propias.

const L = 34   // largo, en unidades del mundo (la figura de una estación mide 240)

function paperGeometry() {
  const nose = [0, 0, L * 0.62]
  const tipL = [-L * 0.5, L * 0.06, -L * 0.38]
  const tipR = [L * 0.5, L * 0.06, -L * 0.38]
  const tail = [0, 0, -L * 0.38]
  const keel = [0, -L * 0.17, -L * 0.3]
  const tris = [nose, tipL, tail, nose, tail, tipR, nose, tail, keel]
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(tris.flat()), 3))
  g.computeVertexNormals()
  return g
}

const TRAIL_VERT = /* glsl */`
  uniform float uNow;
  uniform float uLife;
  attribute float aBorn;
  attribute float aSeed;
  varying float vA;
  void main() {
    float age = (uNow - aBorn) / uLife;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float d = -mv.z;
    // Recién nacida brilla y es chica; después se abre y se apaga.
    vA = age < 0.0 || age > 1.0 ? 0.0 : (1.0 - age) * (1.0 - age) * smoothstep(20.0, 120.0, d);
    gl_PointSize = min(26.0, (1.4 + age * 3.5 + aSeed) * (520.0 / max(d, 1.0)));
    gl_Position = projectionMatrix * mv;
  }
`
const TRAIL_FRAG = /* glsl */`
  uniform vec3 uCol;
  varying float vA;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = dot(c, c);
    if (r > 0.25 || vA < 0.01) discard;
    gl_FragColor = vec4(uCol, vA * 0.8 * (1.0 - smoothstep(0.05, 0.25, r)));
  }
`

export function createPaperPlane({ trail = 700, color = 0xece8de, edge = 0xf5a524, trailColor = 0xf5a524 } = {}) {
  const group = new Group()
  const body = new Group()          // el ladeo va acá; group sólo mira hacia adelante
  group.add(body)
  const geo = paperGeometry()
  const mat = new MeshBasicMaterial({ color, side: DoubleSide, transparent: true, opacity: 0.92 })
  body.add(new Mesh(geo, mat))
  const egeo = new EdgesGeometry(geo)
  const emat = new LineBasicMaterial({ color: edge, transparent: true, opacity: 0.9 })
  body.add(new LineSegments(egeo, emat))
  group.visible = false

  // Estela: un anillo de partículas; cada una guarda dónde y cuándo nació.
  const pos = new BufferAttribute(new Float32Array(trail * 3), 3)
  const born = new BufferAttribute(new Float32Array(trail).fill(-1e9), 1)
  const tgeo = new BufferGeometry()
  tgeo.setAttribute('position', pos)
  tgeo.setAttribute('aBorn', born)
  tgeo.setAttribute('aSeed', new BufferAttribute(new Float32Array(trail).map(() => Math.random()), 1))
  const uniforms = { uNow: { value: 0 }, uLife: { value: 1400 }, uCol: { value: new Color(trailColor) } }
  const tmat = new ShaderMaterial({
    uniforms, vertexShader: TRAIL_VERT, fragmentShader: TRAIL_FRAG,
    transparent: true, depthWrite: false, blending: AdditiveBlending,
  })
  const points = new Points(tgeo, tmat)
  points.frustumCulled = false

  let head = 0, bank = 0
  const prev = new Vector3(), vel = new Vector3(), ahead = new Vector3(), tip = new Vector3()
  const side = new Vector3(), lastVel = new Vector3()

  const emit = (p, now) => {
    pos.array.set([p.x, p.y, p.z], head * 3)
    born.array[head] = now
    head = (head + 1) % trail
  }

  return {
    group,
    points,
    get visible() { return group.visible },
    show(at) {
      group.visible = true
      group.position.copy(at); prev.copy(at)
      lastVel.set(0, 0, 0); bank = 0
    },
    hide() { group.visible = false },
    // Mueve el avión a `p`; `up` es el arriba del mundo (para el ladeo).
    moveTo(p, now, up) {
      vel.subVectors(p, prev)
      if (vel.lengthSq() > 1e-4) {
        group.position.copy(p)
        ahead.copy(p).add(vel)
        group.lookAt(ahead)
        // Ladeo: cuánto gira el rumbo hacia un lado, como un avión de verdad
        // que se inclina hacia adentro de la curva.
        side.crossVectors(lastVel, vel)
        const turn = lastVel.lengthSq() ? side.dot(up) / (lastVel.length() * vel.length() + 1e-6) : 0
        bank += (Math.max(-0.9, Math.min(0.9, -turn * 18)) - bank) * 0.12
        body.rotation.z = bank
        lastVel.copy(vel)
        // Dos estelas, una por punta de ala, más un polvo en el centro. Se
        // rellena el tramo recorrido desde el cuadro anterior: a pocos cuadros
        // por segundo la estela sigue siendo una línea y no puntos sueltos.
        group.updateMatrixWorld()
        const steps = Math.max(1, Math.min(8, Math.round(vel.length() / 10)))
        for (let k = 0; k < steps; k++) {
          const back = vel.clone().multiplyScalar(-(k / steps))
          for (const x of [-0.48, 0.48]) {
            tip.set(x * L, L * 0.05, -L * 0.36).applyMatrix4(body.matrixWorld).add(back)
            emit(tip, now - (k / steps) * 16)
          }
          tip.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, -L * 0.45)
            .applyMatrix4(body.matrixWorld).add(back)
          emit(tip, now - (k / steps) * 16)
        }
        pos.needsUpdate = born.needsUpdate = true
      }
      prev.copy(p)
    },
    update(now) { uniforms.uNow.value = now },
    dispose() { geo.dispose(); mat.dispose(); egeo.dispose(); emat.dispose(); tgeo.dispose(); tmat.dispose() },
  }
}
