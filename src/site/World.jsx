import React, { useEffect, useRef } from 'react'
import { CatmullRomCurve3, Group, MathUtils, Plane, Raycaster, Vector2, Vector3 } from 'three'
import { createStage } from '../engine/stage'
import { createPointCloud } from '../engine/pointCloud'
import { createDust } from '../engine/dust'
import { resolveShape } from '../engine/shapes/sources'
import { SHAPES } from '../engine/shapes/procedural'
import { handMode, twoHands } from '../engine/gestures'
import { pointer } from './pointer'

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
      // outer mira a la cámara (lookAt), roller es el volante de las dos
      // manos sobre ese eje, inner es el giro de la figura (auto, agarre,
      // arrastre). Separados para que ninguno pise la orientación del otro.
      const roller = new Group()
      outer.add(roller)
      const inner = new Group()
      roller.add(inner)
      const cloud = createPointCloud({ positions: seedShape, palette: p.scene.palette, size: SIZE, far: FAR })
      inner.add(cloud.points)
      scene.add(outer)
      stage.own(cloud)
      // `item` es el ítem que esta estación está mostrando; undefined fuerza el
      // primer armado.
      // ux/uy: giro que puso quien arrastró, con su velocidad vx/vy (inercia).
      // pos: la forma actual, para poder estallarla y rearmarla con un clic.
      return {
        page: p, outer, roller, inner, cloud, rotX: 0, rotY: 0, spin: i * 1.3, want: null, flat: false,
        item: undefined, ux: 0, uy: 0, vx: 0, vy: 0, pos: null, over: false,
        zoom: 1, roll: 0,
      }
    })

    // Pide a una estación que adopte una forma. Si llegan dos pedidos antes de
    // que el primero cargue, gana el último.
    const morph = (st, spec, opts) => {
      const k = shapeKey(spec)
      st.want = k
      // El texto se lee sólo de frente: deja de girar y se balancea. El giro
      // acumulado se lleva a (-π, π] para que volver al frente sea el camino
      // corto y no desenrollar diez vueltas.
      // Lo mismo para los modelos en relieve (`face: true`): son casi planos,
      // y girando sobre el eje vertical quedarían de canto.
      const flat = spec.type === 'text' || !!spec.face
      if (flat && !st.flat) st.rotY = Math.atan2(Math.sin(st.rotY), Math.cos(st.rotY))
      if (!flat && st.flat) st.spin = st.rotY
      st.flat = flat
      shapeOf(spec).then(pos => {
        if (st.want !== k || disposed) return
        st.pos = pos
        st.cloud.morphTo(pos, null, performance.now(), opts)
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

    // ── El cursor sobre la figura ───────────────────────────────────────────
    // El puntero (mouse, o la punta del dedo cuando apuntás) se proyecta sobre
    // un plano que pasa por el centro de la formación activa, de cara a la
    // cámara. Si cae dentro de la figura, el campo se muda ahí: las partículas
    // bajo el cursor se apartan y se encienden. Arrastrar la gira, con inercia;
    // un clic sin arrastre la hace estallar y rearmarse.
    const ray = new Raycaster(), ndc = new Vector2(), plane = new Plane()
    const hit = new Vector3(), toCamN = new Vector3(), fieldT = new Vector3()
    let drag = null

    const poke = st => { if (st.pos) st.cloud.morphTo(st.pos, null, performance.now(), { burst: 80 }) }
    const onDown = e => {
      const st = stations[active]
      if (e.button !== 0 || !st.over || !e.target.closest?.('.world')) return
      drag = { x: e.clientX, y: e.clientY, moved: 0 }
      st.vx = st.vy = 0
      host.setPointerCapture?.(e.pointerId)
      e.preventDefault()
    }
    const onMove = e => {
      if (!drag) return
      const st = stations[active]
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y
      drag.x = e.clientX; drag.y = e.clientY
      drag.moved += Math.abs(dx) + Math.abs(dy)
      st.vy = dx * 0.009; st.vx = dy * 0.007
      st.uy += st.vy; st.ux += st.vx
    }
    const onUp = () => {
      if (!drag) return
      if (drag.moved < 6) poke(stations[active])
      drag = null
    }
    // El pellizco de la mano sobre algo que no es un link llega acá.
    const onHandPoke = () => { if (stations[active].over) poke(stations[active]) }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('world-poke', onHandPoke)

    // ── Cuadro ──────────────────────────────────────────────────────────────
    const camVec = new Vector3()
    const center = new Vector3()
    let scale = 1
    // Mientras apuntás con el índice, la mano es un cursor y no una cámara:
    // el mundo se queda donde estaba al empezar a apuntar. Si no, mover el
    // dedo para elegir un link haría girar la formación y temblar la vista.
    let mode = 'none', hx = 0, hy = 0, hz = 0
    // Dos manos abiertas: el par de manos al empezar el gesto, y el zoom/giro
    // que tenía la figura en ese momento, para que el gesto sea relativo.
    let pair = null

    stage.start((now, dt) => {
      const s = signal.current
      const onCam = s.source === 'hand' || s.source === 'face'
      mode = handMode(s, mode)
      // Apuntando o con las dos manos, la mano no es cámara: el mundo se queda
      // donde estaba al empezar el gesto.
      if (mode !== 'point' && mode !== 'two') { hx = s.x; hy = s.y; hz = s.z }

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
      // El giroscopio está entre los dos: el teléfono se inclina menos de lo
      // que viaja una mano, pero mucho más que un mouse.
      const amp = onCam ? (s.source === 'face' ? 200 : 90) : s.source === 'gyro' ? 120 : 45
      camera.position.copy(pos)
        .addScaledVector(right, hx * amp)
        .addScaledVector(up, -hy * amp * 0.6)
      if (onCam) camera.position.addScaledVector(T[active], hz * 200)
      camera.lookAt(look)

      const w = stage.size.w, h = stage.size.h
      const targetScale = w / h > 1.05 && w > 860 ? 1 : 0.68
      scale += (targetScale - scale) * 0.08
      camVec.copy(camera.position)

      // ── Dos manos ───────────────────────────────────────────────────────────
      // Separarlas acerca la figura, juntarlas la aleja; girarlas como un
      // volante la rota. Al soltar, la figura vuelve sola a su tamaño y giro.
      const a = stations[active]
      if (mode === 'two') {
        // La segunda mano entra con su posición todavía convergiendo desde
        // donde estaba (la señal está suavizada): medir la distancia inicial
        // en ese cuadro daría un "inicio" casi cero y el zoom saltaría al
        // máximo. Se re-mide durante 300 ms y recién entonces se fija.
        if (!pair) pair = { at: now, zoom0: a.zoom, roll0: a.roll }
        if (now - pair.at < 300) Object.assign(pair, twoHands(s))
        else {
          const g = twoHands(s, pair)
          const zoomT = Math.max(0.6, Math.min(1.4, pair.zoom0 * g.zoom))
          a.zoom += (zoomT - a.zoom) * 0.25
          a.roll += (pair.roll0 + g.roll - a.roll) * 0.25
        }
      } else {
        pair = null
      }
      for (const st of stations) {
        if (st === a && mode === 'two') continue
        st.zoom += (1 - st.zoom) * 0.06
        st.roll += (0 - st.roll) * 0.06
      }

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
        } else if (st.page.scene.spin === 'z') {
          // Formas planas: el giro va al eje propio (z) y el vertical sólo
          // se inclina con el puntero, para que nunca quede de canto.
          st.spin += dt * 0.00007
          tx = mine ? hx * 0.45 : 0; ty = mine ? hy * 0.25 : 0
        } else {
          st.spin += dt * 0.00007
          tx = st.spin + (mine ? hx * 0.45 : 0); ty = mine ? hy * 0.25 : 0
        }
        const k = mine && onCam ? 0.3 : 0.06
        st.rotY += (tx - st.rotY) * k
        st.rotX += (ty - st.rotX) * k
        // Inercia del arrastre. El texto vuelve solo al frente: girado no se lee.
        if (!(drag && mine)) {
          st.uy += st.vy; st.ux += st.vx
          st.vy *= 0.94; st.vx *= 0.94
          if (st.flat) { st.uy *= 0.92; st.ux *= 0.92 }
          else st.ux *= 0.985
        }
        st.ux = Math.max(-1.3, Math.min(1.3, st.ux))
        const rz = !st.flat && st.page.scene.spin === 'z' ? st.spin : 0
        st.inner.rotation.set(st.rotX + st.ux, st.rotY + st.uy, rz)
        // El giro de las dos manos va en el grupo exterior, sobre el eje que
        // mira a la cámara: así es un volante en pantalla sea cual sea la
        // orientación de la figura.
        st.roller.rotation.z = st.roll
        st.outer.scale.setScalar(scale * st.zoom)
        st.outer.updateMatrixWorld()

        const u = st.cloud.uniforms
        center.setFromMatrixPosition(st.outer.matrixWorld)
        u.uCenter.value.copy(center)
        u.uSize.value = SIZE * scale * st.zoom
        // Sin cursor encima, el campo vive en la cara que mira a la cámara y
        // sólo en la formación donde estás: los dedos abren la de acá, no la
        // del fondo. Con el cursor encima, se muda bajo el cursor.
        toCamN.copy(camVec).sub(center).normalize()
        st.over = false
        if (mine && !flying && pointer.source !== 'none') {
          ndc.set((pointer.x / w) * 2 - 1, -(pointer.y / h) * 2 + 1)
          ray.setFromCamera(ndc, camera)
          plane.setFromNormalAndCoplanarPoint(toCamN, center)
          st.over = !!ray.ray.intersectPlane(plane, hit) && hit.distanceTo(center) < SIZE * scale * 1.1
        }
        let radiusT, liftT, repelT
        if (st.over || (drag && mine)) {
          // El cursor toca el plano medio de la figura, pero lo que se ve es
          // su cara frontal: el campo se adelanta hasta donde estaría esa cara
          // en una esfera del mismo radio (en el texto, plano, se queda en el
          // plano). Si no, el hueco se abriría por dentro, donde no hay nada.
          const R = SIZE * scale
          const d = hit.distanceTo(center)
          const depth = st.flat ? 0 : Math.sqrt(Math.max(0, R * R - d * d)) * 0.9
          fieldT.copy(hit).addScaledVector(toCamN, depth)
          radiusT = R * 0.6
          liftT = 90
          repelT = 1
        } else {
          const n = mine ? Math.max(0, Math.min(5, onCam ? (s.fingers ?? 5) : 3)) / 5 : 0
          fieldT.copy(toCamN).multiplyScalar(SIZE * scale).add(center)
          radiusT = n * SIZE * scale * 0.95
          liftT = n * 34
          repelT = 0
        }
        u.uField.value.lerp(fieldT, 0.3)
        u.uRadius.value += (radiusT - u.uRadius.value) * 0.15
        u.uLift.value += (liftT - u.uLift.value) * 0.15
        u.uRepel.value += (repelT - u.uRepel.value) * 0.15
        if (mine) host.style.cursor = drag ? 'grabbing' : st.over ? 'grab' : ''
        st.cloud.update(now)
      }

      travelRef.current?.(wrap01(t / N), flying)
    })

    return () => {
      disposed = true
      apiRef.current = null
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('world-poke', onHandPoke)
      host.style.cursor = ''
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
