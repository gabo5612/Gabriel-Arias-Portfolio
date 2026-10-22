import React, { useEffect, useRef } from 'react'
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Group, LineBasicMaterial, LineLoop,
  LineSegments, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, TorusGeometry, WebGLRenderer,
} from 'three'

// Experimento: un círculo cuya perspectiva se controla con la mano.
//
// Mismo contrato que DepthLattice — lee `signal` en un rAF y nunca toca estado
// de React. La mano ROTA el círculo en vez de mover el ojo: mover la mano a la
// derecha lo gira sobre el eje Y, arriba/abajo sobre X, acercarla lo trae hacia
// la cámara y girar la muñeca lo hace rodar. Abrir y cerrar la mano cambia el
// tamaño, para que el gesto de los dedos siga diciendo algo.

const MAX_YAW   = 1.25   // ~72°: más allá el círculo se vuelve una línea
const MAX_PITCH = 1.05   // ~60°
const MAX_ROLL  = 0.6
const BASE_R    = 180

const unitCircle = seg => {
  const pos = new Float32Array(seg * 3)
  for (let k = 0; k < seg; k++) {
    const a = (k / seg) * Math.PI * 2
    pos[k * 3] = Math.cos(a)
    pos[k * 3 + 1] = Math.sin(a)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(pos, 3))
  return g
}

// Marcas radiales: un círculo plano girado se lee como una elipse cualquiera,
// sin pista de hacia dónde está inclinado. Las marcas sí la dan, porque se
// comprimen del lado que se aleja.
const ticks = (n, r0, r1) => {
  const pos = new Float32Array(n * 6)
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2
    const c = Math.cos(a), s = Math.sin(a)
    pos.set([c * r0, s * r0, 0, c * r1, s * r1, 0], k * 6)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(pos, 3))
  return g
}

export default function CircleScene({ signal, onFail }) {
  const hostRef = useRef(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let renderer
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true })
    } catch {
      onFail?.()
      return
    }
    if (!renderer.getContext()) { onFail?.(); return }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setClearColor(0x000000, 0)
    host.appendChild(renderer.domElement)

    const scene = new Scene()
    const camera = new PerspectiveCamera(45, 1, 1, 4000)
    camera.position.set(0, 0, 900)

    const disposables = []
    const add = (obj, ...res) => { disposables.push(...res); return obj }

    const circle = new Group()
    scene.add(circle)

    // Aro principal con grosor real: LineBasicMaterial siempre dibuja 1 px.
    const torusGeo = new TorusGeometry(1, 0.018, 12, 160)
    const torusMat = new MeshBasicMaterial({ color: 0xf5a524, transparent: true, opacity: 0.95 })
    const torus = add(new Mesh(torusGeo, torusMat), torusGeo, torusMat)
    circle.add(torus)

    const lineMat = hex => new LineBasicMaterial({
      color: hex, transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false,
    })

    const ringGeo = unitCircle(128)
    const innerMat = lineMat(0x5eead4)
    disposables.push(ringGeo, innerMat)
    for (const k of [0.33, 0.66]) {
      const l = new LineLoop(ringGeo, innerMat)
      l.scale.setScalar(k)
      circle.add(l)
    }

    const tickGeo = ticks(48, 0.86, 0.96)
    const tickMat = lineMat(0xf97316)
    circle.add(add(new LineSegments(tickGeo, tickMat), tickGeo, tickMat))

    // Una marca "norte" más larga: sin ella, el roll de la muñeca es invisible
    // porque un círculo rotado sobre su propio eje se ve igual.
    const northGeo = ticks(1, 0, 0.96)
    northGeo.rotateZ(Math.PI / 2)
    const northMat = lineMat(0xffe6b8)
    northMat.opacity = 0.9
    circle.add(add(new LineSegments(northGeo, northMat), northGeo, northMat))

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

    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const s = signal.current
      const onCam = s.source === 'hand' || s.source === 'face'

      // Signos: mano a la derecha (x+) muestra la cara derecha del círculo;
      // mano arriba (y−) inclina el borde superior hacia atrás.
      circle.rotation.y = s.x * MAX_YAW
      circle.rotation.x = s.y * MAX_PITCH
      circle.rotation.z = onCam ? -s.yaw * MAX_ROLL : 0
      circle.position.z = s.z * 320

      // Puño → 0.45, mano abierta → 1. Sin cámara `fingers` queda en 5.
      const open = Math.max(0, Math.min(5, s.fingers ?? 5)) / 5
      circle.scale.setScalar(BASE_R * (0.45 + 0.55 * open))

      renderer.render(scene, camera)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      disposables.forEach(d => d.dispose())
      renderer.dispose()
      if (renderer.domElement.parentNode) renderer.domElement.remove()
    }
  }, [signal, onFail])

  return <div ref={hostRef} className="hero__lattice" aria-hidden="true" />
}
