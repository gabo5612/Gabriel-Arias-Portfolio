import React, { useEffect, useRef } from 'react'
import { CatmullRomCurve3, Group, MathUtils, Vector3 } from 'three'
import { createStage } from '../engine/stage'
import { createPointCloud } from '../engine/pointCloud'
import { createDust } from '../engine/dust'
import { resolveShape } from '../engine/shapes/sources'
import { SHAPES } from '../engine/shapes/procedural'
import { handMode } from '../engine/gestures'

// El mundo: un circuito cerrado en el espacio con una formación de partículas
// por página. Navegar no cambia de pantalla, mueve la cámara por el circuito
// hasta la formación siguiente. Lo que ves de fondo —las otras formaciones,
// apagadas por la niebla— son los otros lugares del sitio, donde realmente
// están.
//
// Geometría: la cámara de la estación i está en C_i, sobre un círculo; su
// formación está en A_i = C_i + T_i · VIEW_D, adelante en la tangente. Como el
// circuito se curva, el vuelo de C_i a C_i+1 pasa rozando A_i: se atraviesa la
// nube que acabás de dejar.
//
// Todo lo que cambia por cuadro se lee de refs (señal, navegación) y se
// escribe directo en three. React sólo monta y desmonta.

const LOOP_R = 2200
const VIEW_D = 900
const SIZE = 240
const FAR = 5200

const easeInOut = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2)
const wrap01 = t => ((t % 1) + 1) % 1
const shapeKey = spec => JSON.stringify(spec)

export default function World({ signal, pages, state, dir, onFail, onTravel }) {
  const hostRef = useRef(null)
  const apiRef = useRef(null)
  const nav = useRef(null)
  nav.current = { state, dir }
  // Los callbacks cambian de identidad con cada render del padre; el mundo no
  // debe reconstruirse por eso.
  const travelRef = useRef(onTravel)
  travelRef.current = onTravel

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const stage = createStage(host, { fov: 45, z: 0, maxDpr: 1.75 })
    if (!stage) { onFail?.(); return }
    const { scene, camera } = stage
    camera.far = FAR + 800
    camera.updateProjectionMatrix()

    let disposed = false
    const N = pages.length
    const small = (host.clientWidth || 1024) < 700
    const count = small ? 1600 : 4200
    const up = new Vector3(0, 1, 0)

    // ── Circuito ────────────────────────────────────────────────────────────
    const C = [], T = [], A = []
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2
      // Una ondulación vertical suave: en un plano perfecto el vuelo se siente
      // como un carrusel, con subidas y bajadas se siente como un recorrido.
      C.push(new Vector3(Math.sin(a) * LOOP_R, Math.sin(a * 2) * 200, -Math.cos(a) * LOOP_R))
    }
    const curve = new CatmullRomCurve3(C, true, 'catmullrom', 0.5)
    for (let i = 0; i < N; i++) {
      // El parámetro del nodo i en una curva cerrada de three es exactamente i/N.
      T.push(curve.getTangent(i / N).normalize())
      A.push(C[i].clone().addScaledVector(T[i], VIEW_D))
    }

    const dust = createDust(curve, { count: small ? 3000 : 9000, far: FAR * 0.8 })
    scene.add(dust.points)
    stage.own(dust)

    // ── Formaciones ─────────────────────────────────────────────────────────
    const cache = new Map()
    const shapeOf = spec => {
      const k = shapeKey(spec)
      if (!cache.has(k)) cache.set(k, resolveShape(spec, count, SIZE))
      return cache.get(k)
    }
    // Arrancan todas como esfera (síncrona) y se arman en su forma cuando
    // ésta llega: un modelo tarda en cargar, y una estación vacía no avisa.
    const seedShape = SHAPES[0].build(count, SIZE)
    const stations = pages.map((p, i) => {
      const outer = new Group()
      outer.position.copy(A[i])
      // Object3D.lookAt apunta +z al objetivo: las formas están diseñadas de
      // frente a +z, así que quedan de cara a quien llega.
      outer.lookAt(C[i])
      const inner = new Group()
      outer.add(inner)
      const cloud = createPointCloud({ positions: seedShape, palette: p.scene.palette, size: SIZE, far: FAR })
      inner.add(cloud.points)
      scene.add(outer)
      stage.own(cloud)
      // `item` es el ítem que esta estación está mostrando; undefined fuerza el
      // primer armado.
      return { page: p, outer, inner, cloud, rotX: 0, rotY: 0, spin: i * 1.3, want: null, flat: false, item: undefined }
    })

    // Pide a una estación que adopte una forma. Si llegan dos pedidos antes de
    // que el primero cargue, gana el último.
    const morph = (st, spec, opts) => {
      const k = shapeKey(spec)
      st.want = k
      // El texto se lee sólo de frente: deja de girar y se balancea. El giro
      // acumulado se lleva a (-π, π] para que volver al frente sea el camino
      // corto y no desenrollar diez vueltas.
      const flat = spec.type === 'text'
      if (flat && !st.flat) st.rotY = Math.atan2(Math.sin(st.rotY), Math.cos(st.rotY))
      if (!flat && st.flat) st.spin = st.rotY
      st.flat = flat
      shapeOf(spec).then(pos => {
        if (st.want === k && !disposed) st.cloud.morphTo(pos, null, performance.now(), opts)
      }).catch(err => console.warn(`[world] ${st.page.id}:`, err.message))
    }
    const specFor = (p, item) => (item && p.scene.itemShape?.(item)) || p.scene.shape

    // ── Vuelo ───────────────────────────────────────────────────────────────
    let active = nav.current.state.page
    let t = active, fromT = active, toT = active   // en unidades de estación
    let flightAt = -Infinity, flightMs = 1, travelDir = 1
    const look = new Vector3(), lookFrom = new Vector3(), target = new Vector3()
    const right = new Vector3(), pos = new Vector3(), ahead = new Vector3()

    // A dónde mira la cámara cuando ya llegó a la estación i. No al centro de
    // la formación: se desplaza para que la formación quede donde el panel no
    // está — a la derecha en pantalla ancha, arriba en una angosta.
    const stationLook = (i, out) => {
      const w = stage.size.w, h = stage.size.h
      const wide = w / h > 1.05 && w > 860
      const halfH = Math.tan(MathUtils.degToRad(camera.fov / 2)) * VIEW_D
      right.crossVectors(T[i], up).normalize()
      out.copy(A[i])
      if (wide) out.addScaledVector(right, -halfH * camera.aspect * 0.4)
      else out.addScaledVector(up, -halfH * 0.42)
      return out
    }
    stationLook(active, look)

    const go = (page, dir) => {
      const now = performance.now()
      const cur = t
      // El destino es `page + k·N` para el k que respeta la dirección pedida:
      // "siguiente" desde la última da la vuelta hacia adelante, no retrocede
      // por todo el circuito. Sin dirección (un clic en el mapa), el camino corto.
      let end
      if (dir > 0) { end = page; while (end <= cur + 1e-3) end += N }
      else if (dir < 0) { end = page; while (end >= cur - 1e-3) end -= N }
      else {
        end = page + Math.round((cur - page) / N) * N
      }
      if (Math.abs(end - cur) < 1e-3) return
      fromT = cur; toT = end
      travelDir = Math.sign(end - cur)
      flightMs = 1500 + 520 * Math.max(0, Math.abs(end - cur) - 1)
      flightAt = now
      lookFrom.copy(look)
      active = page
    }

    apiRef.current = {
      sync(state, dir) {
        if (state.page !== active) go(state.page, dir)
        // Cada estación muestra su ítem sólo mientras estás en ella. Salir de un
        // proyecto abierto cambiando de página devuelve esa formación a su
        // forma base, aunque ya no sea la estación activa.
        stations.forEach((st, i) => {
          const want = i === state.page ? state.item : null
          if (st.item === want) return
          const first = st.item === undefined
          st.item = want
          morph(st, specFor(st.page, want), { burst: first ? 120 : want ? 140 : 80 })
        })
      },
    }
    // Si la navegación ya cambió mientras se montaba, ponerse al día.
    apiRef.current.sync(nav.current.state, 0)

    // ── Cuadro ──────────────────────────────────────────────────────────────
    const camVec = new Vector3()
    const center = new Vector3()
    let scale = 1
    // Mientras apuntás con el índice, la mano es un cursor y no una cámara:
    // el mundo se queda donde estaba al empezar a apuntar. Si no, mover el
    // dedo para elegir un link haría girar la formación y temblar la vista.
    let mode = 'none', hx = 0, hy = 0, hz = 0

    stage.start((now, dt) => {
      const s = signal.current
      const onCam = s.source === 'hand' || s.source === 'face'
      mode = handMode(s, mode)
      if (mode !== 'point') { hx = s.x; hy = s.y; hz = s.z }

      const raw = Math.min(1, (now - flightAt) / flightMs)
      const flying = raw < 1
      const e = easeInOut(raw)
      t = fromT + (toT - fromT) * e
      const speed = flying ? Math.sin(Math.PI * raw) : 0
      dust.uniforms.uSpeed.value += (speed - dust.uniforms.uSpeed.value) * 0.15
      dust.uniforms.uTime.value = now

      curve.getPoint(wrap01(t / N), pos)
      stationLook(active, target)
      look.lerpVectors(lookFrom, target, flying ? e : 1)
      if (flying) {
        // A mitad de vuelo se mira hacia donde se va: es lo que convierte una
        // interpolación de cámara en la sensación de avanzar.
        curve.getPoint(wrap01((t + travelDir * 0.25) / N), ahead)
        look.lerp(ahead, Math.sin(Math.PI * e) * 0.7)
      }

      // Paralaje: la cámara se asoma con la mano o la cabeza (como mirar por
      // una ventana) y apenas con el puntero. Acercar la mano acerca la cámara.
      right.crossVectors(T[active], up).normalize()
      // Moderado con la mano: también es el joystick de scroll, y mantenerla
      // baja no debería sacar la formación de cuadro.
      const amp = onCam ? (s.source === 'face' ? 200 : 90) : 45
      camera.position.copy(pos)
        .addScaledVector(right, hx * amp)
        .addScaledVector(up, -hy * amp * 0.6)
      if (onCam) camera.position.addScaledVector(T[active], hz * 200)
      camera.lookAt(look)

      const w = stage.size.w, h = stage.size.h
      const targetScale = w / h > 1.05 && w > 860 ? 1 : 0.68
      scale += (targetScale - scale) * 0.08
      camVec.copy(camera.position)

      for (let i = 0; i < N; i++) {
        const st = stations[i]
        const mine = i === active
        // La formación de la estación actual se agarra con la mano: x da la
        // vuelta entera e y llega a los polos. Las demás giran solas, lento.
        let tx, ty
        if (st.flat) {
          tx = mine ? hx * (onCam ? 0.6 : 0.3) : 0
          ty = mine ? hy * (onCam ? 0.4 : 0.15) : 0
        } else if (mine && onCam && s.source === 'hand') {
          tx = hx * Math.PI; ty = hy * Math.PI / 2
        } else {
          st.spin += dt * 0.00007
          tx = st.spin + (mine ? hx * 0.45 : 0); ty = mine ? hy * 0.25 : 0
        }
        const k = mine && onCam ? 0.3 : 0.06
        st.rotY += (tx - st.rotY) * k
        st.rotX += (ty - st.rotX) * k
        st.inner.rotation.set(st.rotX, st.rotY, 0)
        st.outer.scale.setScalar(scale)
        st.outer.updateMatrixWorld()

        const u = st.cloud.uniforms
        center.setFromMatrixPosition(st.outer.matrixWorld)
        u.uCenter.value.copy(center)
        u.uSize.value = SIZE * scale
        // El campo vive en la cara que mira a la cámara y sólo en la formación
        // donde estás: los dedos abren la de acá, no la del fondo.
        const n = mine ? Math.max(0, Math.min(5, onCam ? (s.fingers ?? 5) : 3)) / 5 : 0
        u.uField.value.copy(camVec).sub(center).normalize().multiplyScalar(SIZE * scale).add(center)
        u.uRadius.value = n * SIZE * scale * 0.95
        u.uLift.value = n * 34
        st.cloud.update(now)
      }

      travelRef.current?.(wrap01(t / N), flying)
    })

    return () => {
      disposed = true
      apiRef.current = null
      stage.dispose()
    }
  }, [signal, pages, onFail])

  // La navegación se comunica con el mundo por ref, no por props: un cambio de
  // página no debe reconstruir la escena, sólo pedirle que vuele.
  useEffect(() => {
    apiRef.current?.sync(state, dir)
  }, [state, dir])

  return <div ref={hostRef} className="world" aria-hidden="true" />
}
