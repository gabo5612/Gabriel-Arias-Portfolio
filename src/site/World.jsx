import React, { useEffect, useRef } from 'react'
import { CatmullRomCurve3, Group, MathUtils, Plane, Raycaster, Vector2, Vector3 } from 'three'
import { createStage } from '../engine/stage'
import { createPointCloud } from '../engine/pointCloud'
import { createDust } from '../engine/dust'
import { resolveShape } from '../engine/shapes/sources'
import { SHAPES } from '../engine/shapes/procedural'
import { handMode, twoHands } from '../engine/gestures'
import { pointer } from './pointer'
import { profile } from '../engine/handProfile'
import { createTitleParticles, sampleElementText } from '../engine/titleParticles'
import { sound } from '../engine/audio/worldSound'
import { createParticlePlane, PLANE_PALETTE } from '../engine/particlePlane'
import { flightMs as flightFor, PLANE_STRETCH } from './flight'

// El mundo: una avenida recta en el espacio con una formación de partículas
// por página. Navegar no cambia de pantalla, mueve la cámara por la avenida
// hasta la formación siguiente. Lo que ves al fondo —las otras formaciones,
// apagadas por la niebla— son los otros lugares del sitio, donde realmente
// están: la de destino se ve chica a lo lejos y crece mientras llegás.
//
// Geometría: la cámara de la estación i está en C_i, sobre una línea que
// avanza hacia −z; su formación está en A_i = C_i + T·VIEW_D + derecha·SIDE,
// adelante y a un costado. En línea y no en círculo para que cada vuelo
// muestre lo que hay entre medio: las formaciones intermedias pasan al lado,
// enteras, en vez de quedar detrás de una curva. La cámara siempre mira hacia
// adelante (−z): yendo hacia atrás retrocede mirando al frente, y las
// formaciones aparecen por el costado y se alejan delante.
//
// Todo lo que cambia por cuadro se lee de refs (señal, navegación) y se
// escribe directo en three. React sólo monta y desmonta.

const STEP = 2000          // distancia entre estaciones
const SIDE = 480           // cuánto a la derecha del camino está cada formación
const VIEW_D = 900
const SIZE = 240
const FAR = 5200
const CLEAR = 620          // distancia mínima a una formación intermedia en vuelo

const smoothstep = (a, b, v) => { const k = Math.max(0, Math.min(1, (v - a) / (b - a))); return k * k * (3 - 2 * k) }
const easeInOut = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2)
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

    // ── Avenida ─────────────────────────────────────────────────────────────
    const C = [], T = [], A = []
    const fwdZ = new Vector3(0, 0, -1)
    const side = new Vector3(1, 0, 0)       // derecha, mirando hacia −z
    for (let i = 0; i < N; i++) {
      // Una ondulación vertical suave: en un plano perfecto el vuelo se siente
      // como un riel; con subidas y bajadas, como un recorrido.
      C.push(new Vector3(0, Math.sin(i * 1.3) * 110, -i * STEP))
      T.push(fwdZ)
      A.push(C[i].clone().addScaledVector(fwdZ, VIEW_D).addScaledVector(side, SIDE))
    }
    // La curva de la cámara pasa por las estaciones; la del polvo se estira
    // más allá de las puntas, para que el principio y el final no se vean
    // desnudos.
    const curve = new CatmullRomCurve3(C, false, 'catmullrom', 0.5)
    const camAt = (t, out) => curve.getPoint(Math.max(0, Math.min(1, t / (N - 1))), out)
    const dustCurve = new CatmullRomCurve3([
      C[0].clone().addScaledVector(fwdZ, -STEP * 1.5), ...C,
      C[N - 1].clone().addScaledVector(fwdZ, STEP * 2),
    ], false)

    // ── Títulos de partículas ───────────────────────────────────────────────
    // Dos nubes pegadas a la cámara: una forma el título que llega, otra
    // deshace el que se va. Separadas porque en un cambio rápido conviven.
    scene.add(camera)
    const tpCount = small ? 900 : 1700
    const formP = createTitleParticles({ count: tpCount, pixelRatio: stage.renderer.getPixelRatio() })
    const dissolveP = createTitleParticles({ count: tpCount, pixelRatio: stage.renderer.getPixelRatio() })
    camera.add(formP.points, dissolveP.points)
    stage.own(formP, dissolveP)

    const dust = createDust(dustCurve, { count: small ? 3000 : 9000, far: FAR * 0.8 })
    scene.add(dust.points)
    stage.own(dust)

    // ── El biplano ──────────────────────────────────────────────────────────
    // "Fly to my projects" lo dice literal. La formación donde estás (la
    // esfera de Home) se reordena en un biplano hecho de sus mismos puntos;
    // cuando terminó de armarse, despega: en el mismo cuadro se apaga la
    // formación y aparece un biplano idéntico (mismos puntos, misma posición,
    // giro y escala) que sí puede volar. Vuela delante de la cámara, que lo
    // persigue, y se estrella contra la formación de destino, que estalla al
    // recibirlo. La formación de origen vuelve a ser esfera fuera de cuadro.
    //
    // El botón avisa con el evento 'world-plane' y, si el mundo contesta con
    // detail.delay, espera eso antes de navegar: es el tiempo del armado.
    const TRANSFORM_MS = 1100
    const paper = createParticlePlane({ count, size: SIZE, far: FAR, trail: small ? 360 : 700 })
    scene.add(paper.group, paper.points)
    stage.own(paper)
    let planeReq = null, planeFlight = null
    const planeStart = new Vector3(), planePos = new Vector3(), fwd = new Vector3(), planeAim = new Vector3()
    // Armar: la formación donde estás se reordena en el biplano.
    const arm = now => {
      const st = stations[active]
      if (!st.pos) return
      // De frente y quieta, como en una foto: el biplano se lee de perfil.
      if (!st.flat) st.rotY = Math.atan2(Math.sin(st.rotY), Math.cos(st.rotY))
      st.flat = true
      st.want = 'plane'
      st.cloud.morphTo(paper.all, PLANE_PALETTE, now, { burst: 40 })
      planeReq = { at: now, from: active }
      sound.sparkle('form', TRANSFORM_MS)
    }
    // Si la cámara todavía está llegando (el panel aparece antes de que el
    // vuelo termine, así que el botón ya se puede tocar), el armado espera a
    // que llegue; el botón espera eso más el armado.
    let armAt = 0
    const onPlane = e => {
      const now = performance.now()
      if (planeFlight || planeReq || armAt) return
      const left = Math.max(0, flightAt + flightMs - now)
      armAt = now + left
      if (e.detail) e.detail.delay = left + TRANSFORM_MS
    }
    window.addEventListener('world-plane', onPlane)
    // La formación de origen vuelve a ser lo que era.
    const restore = (i, now) => {
      const st = stations[i]
      st.cloud.points.visible = true
      st.flat = false
      st.spin = st.rotY
      st.want = null
      if (st.pos) st.cloud.morphTo(st.pos, st.page.scene.palette, now, { burst: 0 })
    }

    // Sólo en desarrollo: para inspeccionar el vuelo del avión desde las pruebas.
    if (import.meta.env.DEV) {
      window.__plane = () => {
        const v = paper.group.position.clone().project(camera)
        const q = paper.group.quaternion; return { q: [q.x, q.y, q.z, q.w], on: paper.visible, flight: !!planeFlight, sx: (v.x + 1) / 2 * stage.size.w, sy: (1 - v.y) / 2 * stage.size.h, z: v.z }
      }
    }

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
    sound.station(active)

    const go = (page, dir) => {
      const now = performance.now()
      const cur = t
      // En línea no hay atajos ni vueltas: el destino es la estación misma.
      const end = page
      if (Math.abs(end - cur) < 1e-3) return
      fromT = cur; toT = end
      travelDir = Math.sign(end - cur)
      flightMs = flightFor(Math.round(Math.abs(end - cur)))
      flightAt = now
      // Navegar a otra parte con el avión en el aire: el viaje se cancela, el
      // avión desaparece y la formación de origen vuelve a ser la de siempre.
      if (planeFlight) {
        paper.hide()
        restore(planeFlight.from, now)
        planeFlight = null
      }
      if (planeReq && now - planeReq.at < 3000) {
        flightMs *= PLANE_STRETCH
        const src = stations[planeReq.from]
        paper.show(src.inner)
        planeStart.copy(paper.group.position)
        src.cloud.points.visible = false
        planeFlight = { to: page, from: planeReq.from }
        sound.plane(flightMs)
      }
      planeReq = null
      lookFrom.copy(look)
      active = page
      sound.fly(travelDir, flightMs, page)
    }

    // El título del panel visible (la página en curso o el detalle abierto).
    const findTitle = () =>
      document.querySelector('.site__main .panel .panel__title, .site__main .panel .home__name')
    const wv = new Vector3()
    let pendingTitle = null, lastItem = nav.current.state.item

    // El título que se va se deshace: el texto real se apaga en el acto y
    // en su lugar quedan sus partículas, que se dispersan y desaparecen.
    const dissolveTitle = (st, now) => {
      const el = findTitle()
      const pts = el && sampleElementText(el, tpCount)
      if (!pts) return null
      el.style.transition = 'none'
      el.style.opacity = '0'
      const { w, h } = stage.size
      dissolveP.start('dissolve', (from, to) => {
        for (let i = 0; i < tpCount; i++) {
          dissolveP.screenToCamera(pts[i * 2], pts[i * 2 + 1], w, h, camera, from, i)
          to[i * 3] = from[i * 3] + (Math.random() - 0.5) * 360
          to[i * 3 + 1] = from[i * 3 + 1] + (Math.random() - 0.5) * 220
          to[i * 3 + 2] = from[i * 3 + 2] - 80 - Math.random() * 260
        }
      }, st.page.scene.palette, now, 900)
      sound.sparkle('dissolve', 900)
      return el.closest('.panel')
    }

    // El que llega se forma con partículas que salen de la figura: cada una
    // parte de un punto real de la formación (en espacio de cámara) y llega a
    // un punto de tinta del título. Al 80 % aparece el texto de verdad.
    const formTitle = (el, st, now) => {
      const pts = sampleElementText(el, tpCount)
      if (!pts || !st.pos) return false
      el.style.transition = 'none'
      el.style.opacity = '0'
      const { w, h } = stage.size
      const n = st.pos.length / 3
      st.inner.updateMatrixWorld()
      formP.start('form', (from, to) => {
        for (let i = 0; i < tpCount; i++) {
          const k = ((Math.random() * n) | 0) * 3
          wv.set(st.pos[k], st.pos[k + 1], st.pos[k + 2])
            .applyMatrix4(st.inner.matrixWorld)
            .applyMatrix4(camera.matrixWorldInverse)
          from.set([wv.x, wv.y, wv.z], i * 3)
          formP.screenToCamera(pts[i * 2], pts[i * 2 + 1], w, h, camera, to, i)
        }
      }, st.page.scene.palette, now, 1300, () => {
        el.style.transition = 'opacity .5s ease'
        el.style.opacity = ''
        // Avisa a App: la primera vez, el título deja de estar en espera.
        window.dispatchEvent(new Event('world-title'))
      })
      sound.sparkle('form', 1300)
      return true
    }

    apiRef.current = {
      sync(state, dir) {
        const now = performance.now()
        const pageChanged = state.page !== active
        if (pageChanged || state.item !== lastItem) {
          // El panel nuevo se monta cuando el viejo terminó de salir; con
          // vuelo, además, entra casi al llegar. Se espera y se busca un panel
          // que no sea el que se fue.
          const old = dissolveTitle(stations[active], now)
          pendingTitle = { at: now + (pageChanged ? 700 : 280), until: now + 2200, page: state.page, old }
          lastItem = state.item
        }
        if (pageChanged) go(state.page, dir)
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
    // Primera entrada: el título que ya estaba en pantalla se rehace con
    // partículas de la figura, como presentación del mundo.
    // Con la bienvenida delante, la presentación espera a que se cierre.
    const present = () => {
      const now = performance.now()
      pendingTitle = { at: now + 500, until: now + 3000, page: active, old: null }
    }
    if (document.documentElement.dataset.welcome === 'on') window.addEventListener('welcome-done', present, { once: true })
    else present()

    // ── El cursor sobre la figura ───────────────────────────────────────────
    // El puntero (mouse, o la punta del dedo cuando apuntás) se proyecta sobre
    // un plano que pasa por el centro de la formación activa, de cara a la
    // cámara. Si cae dentro de la figura, el campo se muda ahí: las partículas
    // bajo el cursor se apartan y se encienden. Arrastrar la gira, con inercia;
    // un clic sin arrastre la hace estallar y rearmarse.
    const ray = new Raycaster(), ndc = new Vector2(), plane = new Plane()
    const hit = new Vector3(), toCamN = new Vector3(), fieldT = new Vector3()
    let drag = null

    const poke = st => {
      if (!st.pos) return
      st.cloud.morphTo(st.pos, null, performance.now(), { burst: 80 })
      sound.poke()
    }
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
    let wasFlying = false

    stage.start((now, dt) => {
      const s = signal.current
      const onCam = s.source === 'hand' || s.source === 'face'
      mode = handMode(s, mode, { fingers: profile.open })
      // Apuntando o con las dos manos, la mano no es cámara: el mundo se queda
      // donde estaba al empezar el gesto.
      if (mode !== 'point' && mode !== 'two') { hx = s.x; hy = s.y; hz = s.z }

      const raw = Math.min(1, (now - flightAt) / flightMs)
      const flying = raw < 1
      const e = easeInOut(raw)
      t = fromT + (toT - fromT) * e
      // Se llega cuando el vuelo termina, no cuando empieza el siguiente.
      if (wasFlying && !flying) sound.arrive(active)
      wasFlying = flying
      const speed = flying ? Math.sin(Math.PI * raw) : 0
      dust.uniforms.uSpeed.value += (speed - dust.uniforms.uSpeed.value) * 0.15
      dust.uniforms.uTime.value = now

      camAt(t, pos)
      stationLook(active, target)
      if (!flying) look.copy(target)
      else {
        // Hacia dónde mira la cámara en vuelo, por capas:
        //   1. al frente de la avenida (−z), sea cual sea el sentido: hacia
        //      atrás se retrocede mirando al frente;
        //   2. de reojo, a cada formación intermedia mientras está delante y
        //      al pasarle al lado;
        //   3. en el último tramo, a la de destino;
        //   4. al salir, todavía a la de origen.
        look.copy(pos).addScaledVector(fwdZ, 1600).addScaledVector(side, SIDE * 0.5)
        const lo = Math.min(fromT, toT), hi = Math.max(fromT, toT)
        for (let j = Math.floor(lo) + 1; j < hi - 1e-3; j++) {
          // p < 0: la formación j todavía está delante; 0: al lado.
          const p = t - (j + VIEW_D / STEP)
          const g = Math.exp(-(((p + 0.15) / 0.28) ** 2)) * 0.5
          if (g > 0.01) look.lerp(A[j], g)
        }
        const left = Math.abs(toT - t), gone = Math.abs(t - fromT)
        look.lerp(target, 1 - smoothstep(0, 0.9, left))
        look.lerp(lookFrom, 1 - smoothstep(0, 0.35, gone))
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
      // Las formaciones intermedias se rodean, no se atraviesan: cerca de una,
      // la cámara se aparta lo justo para pasarle al lado y verla entera.
      if (flying) {
        const lo = Math.min(fromT, toT), hi = Math.max(fromT, toT)
        for (let j = Math.floor(lo) + 1; j < hi - 1e-3; j++) {
          const aj = A[j]
          wv.subVectors(camera.position, aj)
          const d = wv.length()
          if (d < CLEAR) camera.position.addScaledVector(wv.normalize(), (CLEAR - d) * smoothstep(0, CLEAR, CLEAR - d) * 0.9 + 1e-3)
        }
      }
      // La mirada NO persigue al avión: él cuelga de la cámara, y que la cámara
      // lo mire cerraría un lazo (la mirada mueve al avión, el avión a la
      // mirada) que lo hace oscilar.
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
        // En reposo, las otras formaciones apenas se insinúan: en línea quedan
        // detrás del panel y le restarían lectura. En vuelo se encienden, que
        // es cuando se las pasa.
        const dimT = mine || flying ? 1 : 0.18
        u.uDim.value += (dimT - u.uDim.value) * 0.06
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

      // Título pendiente: en cuanto el panel nuevo existe y su figura ya tiene
      // forma, se lanza. Si no aparece a tiempo, se abandona sin dejar texto
      // oculto (nunca se ocultó).
      if (pendingTitle && now >= pendingTitle.at) {
        const el = findTitle()
        const st = stations[pendingTitle.page]
        if (el && el.closest('.panel') !== pendingTitle.old && formTitle(el, st, now)) pendingTitle = null
        else if (now > pendingTitle.until) { pendingTitle = null; window.dispatchEvent(new Event('world-title')) }
      }
      formP.update(now)
      dissolveP.update(now)

      // El avión vuela en el cuadro de la cámara: siempre delante y un poco
      // abajo, zigzagueando, como un avión que se persigue. (Sobre el circuito
      // quedaría fuera de cuadro: durante el vuelo la cámara mira hacia la
      // formación de destino, no a lo largo del camino.) La estela queda en el
      // mundo, así que se estira detrás: es lo que dice que va rápido.
      // Despega del botón y termina dentro de la figura de destino.
      if (armAt && now >= armAt) { armAt = 0; arm(now) }
      if (planeFlight) {
        camera.updateMatrixWorld()
        camera.getWorldDirection(fwd)
        right.crossVectors(fwd, up).normalize()
        // El zigzag se apaga al acercarse: con la cámara frenando, sería lo
        // único que mueve al avión y su rumbo se iría de lado.
        const weave = 1 - (raw < 0.55 ? 0 : easeInOut(Math.min(1, (raw - 0.55) / 0.2)))
        planePos.copy(camera.position)
          .addScaledVector(fwd, 620)
          .addScaledVector(right, Math.sin(now * 0.0017) * 90 * weave)
          .addScaledVector(up, -60 + Math.sin(now * 0.0026) * 28 * weave)
        const k = raw < 0.3 ? easeInOut(raw / 0.3) : 1
        planePos.lerpVectors(planeStart, planePos, k)
        if (raw > 0.72) planePos.lerp(A[planeFlight.to], easeInOut((raw - 0.72) / 0.28))
        // La formación lo absorbe: en el último tramo se encoge hacia su
        // centro hasta desaparecer dentro.
        const swallow = raw > 0.8 ? easeInOut((raw - 0.8) / 0.2) : 0
        // Rumbo: hacia donde mira la cámara (el avión va delante, en nuestra
        // dirección), y al final, de a poco, hacia la formación donde entra.
        // NO hacia su velocidad en el mundo: colgado de una cámara que gira,
        // esa velocidad se da vuelta en algunos tramos y la nariz giraría en
        // redondo de golpe. El ladeo sale del zigzag: se inclina hacia donde
        // está virando.
        const w = raw < 0.5 ? 0 : easeInOut(Math.min(1, (raw - 0.5) / 0.35))
        planeAim.subVectors(A[planeFlight.to], planePos).normalize()
        planeAim.lerpVectors(fwd, planeAim, w).normalize()
          .addScaledVector(right, Math.cos(now * 0.0017) * 0.25 * weave)
          .normalize().multiplyScalar(100).add(planePos)
        const roll = -Math.cos(now * 0.0017) * 0.45 * weave
        paper.place(planePos, now, up, k, 0.6 * scale * (1 - swallow * 0.97), planeAim, roll)
        if (!flying) {
          paper.hide()
          // Y lo que tragó se le nota: una onda roja sale del centro, recorre
          // la forma y se apaga, y la forma vuelve a sus colores.
          const dest = stations[planeFlight.to]
          center.setFromMatrixPosition(dest.outer.matrixWorld)
          dest.cloud.wave(now, center, PLANE_PALETTE[0])
          sound.absorb()
          restore(planeFlight.from, now)
          planeFlight = null
        }
      } else if (planeReq && now - planeReq.at > 3000) {
        // Se armó el avión pero nunca hubo viaje: vuelve a ser lo que era.
        restore(planeReq.from, now)
        planeReq = null
      }
      paper.update(now)

      // El sonido de la figura: cuánto está el cursor encima, dónde, y qué
      // tan rápido gira por el arrastre (o la inercia que dejó).
      sound.figure(a.over || drag ? 1 : 0, pointer.x / w, pointer.y / h, Math.hypot(a.vx, a.vy), a.zoom)

      travelRef.current?.(t / (N - 1), flying)
    })

    return () => {
      disposed = true
      apiRef.current = null
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('world-poke', onHandPoke)
      window.removeEventListener('world-plane', onPlane)
      window.removeEventListener('welcome-done', present)
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
