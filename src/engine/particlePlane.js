import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, Group, Object3D, Points, Quaternion,
  ShaderMaterial, Vector3,
} from 'three'
import { createPointCloud } from './pointCloud'
import { biplane } from './shapes/biplane'

// El biplano que vuela: los mismos puntos en que se convirtió una formación,
// ahora sueltos del circuito. El mundo decide por dónde va; esto sabe
// arrancar exactamente donde quedó la formación (misma posición, giro y
// escala, para que el relevo no se note), orientarse hacia donde va, ladearse
// en las curvas, girar la hélice y dejar estela.
//
// Jerarquía: holder (mira hacia adelante, +z) → bank (ladeo sobre ese eje) →
// model (el biplano tiene la nariz en +x: se gira -90° para que mire a +z,
// y lleva la escala) → cuerpo + hélice.

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

// Rojo de biplano de colección, con un crema en una zona (las de la nube son
// seis, por dirección) para que no sea una mancha plana.
export const PLANE_PALETTE = [0xe8322a, 0xb3201b, 0xff5a45, 0xd42a22, 0xffd8c8, 0x8c1612]

export function createParticlePlane({ count, size, far, trail = 700, trailColor = 0xffb08a }) {
  const shape = biplane(count, size)
  const holder = new Group()
  const bank = new Group()
  const model = new Group()
  model.rotation.y = -Math.PI / 2
  holder.add(bank); bank.add(model)
  const body = createPointCloud({ positions: shape.body, palette: PLANE_PALETTE, size, far })
  const prop = createPointCloud({ positions: shape.prop, palette: PLANE_PALETTE, size, far })
  const propG = new Group()
  propG.position.fromArray(shape.hub)
  propG.add(prop.points)
  model.add(body.points, propG)
  holder.visible = false

  // Estela: un anillo de partículas; cada una guarda dónde y cuándo nació.
  const pos = new BufferAttribute(new Float32Array(trail * 3), 3)
  const born = new BufferAttribute(new Float32Array(trail).fill(-1e9), 1)
  const tgeo = new BufferGeometry()
  tgeo.setAttribute('position', pos)
  tgeo.setAttribute('aBorn', born)
  tgeo.setAttribute('aSeed', new BufferAttribute(new Float32Array(trail).map(() => Math.random()), 1))
  const tu = { uNow: { value: 0 }, uLife: { value: 1400 }, uCol: { value: new Color(trailColor) } }
  const tmat = new ShaderMaterial({
    uniforms: tu, vertexShader: TRAIL_VERT, fragmentShader: TRAIL_FRAG,
    transparent: true, depthWrite: false, blending: AdditiveBlending,
  })
  const points = new Points(tgeo, tmat)
  points.frustumCulled = false

  let head = 0, rollV = 0, scale0 = 1
  const q0 = new Quaternion(), qModelInv = new Quaternion(), qFly = new Quaternion()
  let flyInit = false
  const dummy = new Object3D()
  const prev = new Vector3(), vel = new Vector3(), lastVel = new Vector3(), side = new Vector3()
  const tip = new Vector3(), back = new Vector3(), m = new Vector3(), s = new Vector3()
  // Puntas del ala de arriba, en las unidades del modelo.
  const TIPS = [[0.26 * size, 0.36 * size, -size], [0.26 * size, 0.36 * size, size]]

  const emit = (p, t) => {
    pos.array.set([p.x, p.y, p.z], head * 3)
    born.array[head] = t
    head = (head + 1) % trail
  }

  return {
    group: holder,
    points,
    hub: shape.hub,
    all: shape.all,
    get visible() { return holder.visible },

    // Arranca donde está `source` (el grupo de la formación que se convirtió).
    show(source) {
      source.updateMatrixWorld()
      source.matrixWorld.decompose(m, q0, s)
      qModelInv.setFromEuler(model.rotation).invert()
      q0.multiply(qModelInv)
      holder.position.copy(m)
      holder.quaternion.copy(q0)
      scale0 = s.x
      model.scale.setScalar(scale0)
      bank.rotation.z = 0
      prev.copy(m); lastVel.set(0, 0, 0); rollV = 0; flyInit = false
      holder.visible = true
    },
    hide() { holder.visible = false },

    // k ∈ [0, 1]: cuánto ya despegó. 0 = todavía con el giro y la escala de
    // la formación; 1 = mirando hacia donde va, a escala de vuelo.
    // aim (opcional): un punto al que apuntar la nariz en vez de seguir la
    // velocidad — al llegar, la cámara frena, la velocidad se achica y
    // cualquier movimiento lateral la haría girar de golpe.
    place(p, now, up, k, flyScale, aim = null, roll = null) {
      vel.subVectors(p, prev)
      holder.position.copy(p)
      // El rumbo no salta: se acerca al deseado un poco por cuadro.
      if (aim || vel.lengthSq() > 0.25) {
        dummy.position.copy(p)
        dummy.lookAt(aim || back.copy(p).add(vel))
        if (!flyInit) { qFly.copy(dummy.quaternion); flyInit = true }
        else qFly.slerp(dummy.quaternion, 0.08)
      }
      if (flyInit) holder.quaternion.slerpQuaternions(q0, qFly, k)
      if (vel.lengthSq() > 1e-4) {
        // Ladeo: cuánto gira el rumbo hacia un lado; se inclina hacia adentro.
        side.crossVectors(lastVel, vel)
        const turn = lastVel.lengthSq() ? side.dot(up) / (lastVel.length() * vel.length() + 1e-6) : 0
        const want = roll ?? Math.max(-0.8, Math.min(0.8, -turn * 18))
        rollV += (want * k - rollV) * 0.12
        bank.rotation.z = rollV
        lastVel.copy(vel)
      }
      model.scale.setScalar(scale0 + (flyScale - scale0) * k)
      holder.updateMatrixWorld()

      // Estela desde las dos puntas de ala, rellenando el tramo recorrido
      // desde el cuadro anterior: a pocos cuadros por segundo sigue siendo
      // una línea y no puntos sueltos.
      if (k > 0.2) {
        const steps = Math.max(1, Math.min(8, Math.round(vel.length() / 10)))
        for (let i = 0; i < steps; i++) {
          back.copy(vel).multiplyScalar(-(i / steps))
          for (const t of TIPS) emit(tip.fromArray(t).applyMatrix4(model.matrixWorld).add(back), now - (i / steps) * 16)
        }
        pos.needsUpdate = born.needsUpdate = true
      }
      prev.copy(p)
    },

    update(now) {
      tu.uNow.value = now
      if (!holder.visible) return
      propG.rotation.x = now * 0.04            // la hélice: ~6 vueltas por segundo
      const sz = size * model.scale.x
      for (const c of [body, prop]) {
        c.uniforms.uCenter.value.copy(holder.position)
        c.uniforms.uSize.value = sz
        c.update(now)
      }
    },
    dispose() { body.dispose(); prop.dispose(); tgeo.dispose(); tmat.dispose() },
  }
}
