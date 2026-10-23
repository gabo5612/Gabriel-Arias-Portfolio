import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createDwell, createPinchClick, createPresence, createSwipeDetector, handMode, scrollSpeed, twoHands } from '../src/engine/gestures.js'

const hand = (x, y = 0, fingers = 5) => ({ source: 'hand', hands: 1, x, y, fingers })

// Mueve la mano de x0 a x1 en `ms`, a 60 fps, y devuelve el último resultado
// junto con todos los swipes que hubo en el camino.
function sweep(det, from, to, ms, t0 = 0, fingers = 5) {
  const frames = Math.max(1, Math.round(ms / 16))
  const swipes = []
  let r
  for (let i = 0; i <= frames; i++) {
    const k = i / frames
    r = det.push(hand(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k, fingers), t0 + k * ms)
    if (r.swipe) swipes.push(r.swipe)
  }
  return { r, swipes }
}

test('no hand → idle, nothing fires', () => {
  const det = createSwipeDetector()
  const r = det.push({ source: 'pointer', hands: 0, x: 0.9, y: 0, fingers: 5 }, 0)
  assert.deepEqual(r, { state: 'idle', progress: 0, swipe: null })
})

test('a fast open-hand sweep to the right fires once, next', () => {
  const det = createSwipeDetector()
  const { swipes } = sweep(det, { x: -0.4, y: 0 }, { x: 0.4, y: 0 }, 200)
  assert.equal(swipes.length, 1)
  assert.equal(swipes[0].axis, 'x')
  assert.equal(swipes[0].dir, 1)
})

test('the same sweep with a closed fist does nothing', () => {
  const det = createSwipeDetector()
  const { r, swipes } = sweep(det, { x: -0.4, y: 0 }, { x: 0.4, y: 0 }, 200, 0, 1)
  assert.equal(swipes.length, 0)
  assert.equal(r.state, 'closed')
})

test('a slow drift across the frame is not a swipe', () => {
  const det = createSwipeDetector()
  const { swipes } = sweep(det, { x: -0.9, y: 0 }, { x: 0.9, y: 0 }, 2000)
  assert.equal(swipes.length, 0)
})

test('cooldown swallows the return stroke', () => {
  const det = createSwipeDetector()
  const a = sweep(det, { x: -0.4, y: 0 }, { x: 0.4, y: 0 }, 200, 0)
  const b = sweep(det, { x: 0.4, y: 0 }, { x: -0.4, y: 0 }, 200, 220)
  assert.equal(a.swipes.length + b.swipes.length, 1)
})

test('vertical swipes only exist when asked for', () => {
  const down = [{ x: 0, y: -0.45 }, { x: 0, y: 0.45 }]
  assert.equal(sweep(createSwipeDetector(), ...down, 200).swipes.length, 0)
  const { swipes } = sweep(createSwipeDetector({ axes: 'xy' }), ...down, 200)
  assert.equal(swipes.length, 1)
  assert.deepEqual([swipes[0].axis, swipes[0].dir], ['y', 1])
})

test('a diagonal fires the dominant axis only', () => {
  const det = createSwipeDetector({ axes: 'xy' })
  const { swipes } = sweep(det, { x: -0.45, y: -0.2 }, { x: 0.45, y: 0.2 }, 200)
  assert.equal(swipes.length, 1)
  assert.equal(swipes[0].axis, 'x')
})

test('swipe reports where the hand was before the gesture', () => {
  const det = createSwipeDetector()
  const { swipes } = sweep(det, { x: -0.4, y: 0.1 }, { x: 0.4, y: 0.1 }, 200)
  assert.ok(swipes[0].from.x < -0.1)
})

test('hand mode: point, open, closed, none', () => {
  const h = o => ({ source: 'hand', hands: 1, fingers: 5, point: 0, pinch: 0, ...o })
  assert.equal(handMode({ source: 'pointer', hands: 0 }), 'none')
  assert.equal(handMode(h({ point: 1, fingers: 1.4 })), 'point')
  assert.equal(handMode(h({ fingers: 5 })), 'open')
  assert.equal(handMode(h({ fingers: 1 })), 'closed')
})

test('pinching keeps you in point mode even as the index bends', () => {
  const bent = { source: 'hand', hands: 1, fingers: 1, point: 0.1, pinch: 0.8 }
  assert.equal(handMode(bent, 'point'), 'point')
  assert.equal(handMode(bent, 'closed'), 'closed')
})

test('scroll joystick: dead zone, direction, ramps to max', () => {
  assert.equal(scrollSpeed(0.1), 0)
  assert.equal(scrollSpeed(-0.28), 0)
  assert.ok(scrollSpeed(0.6) > 0)
  assert.ok(scrollSpeed(-0.6) < 0)
  assert.ok(scrollSpeed(0.9) > scrollSpeed(0.5))
  assert.equal(scrollSpeed(1), 1100)
})

test('pinch clicks once per squeeze, with hysteresis', () => {
  const p = createPinchClick()
  const seq = [0, 0.3, 0.6, 0.75, 0.9, 0.65, 0.5, 0.3, 0.1, 0.8, 0.2]
  const clicks = seq.map(v => p.push(v, 0, 0).click).filter(Boolean).length
  assert.equal(clicks, 2)
})

test('cursor freezes where the pinch started closing', () => {
  const p = createPinchClick()
  p.push(0, 100, 100)
  p.push(0.3, 110, 100)               // empieza a cerrar acá
  const r = p.push(0.9, 140, 120)     // el pulgar arrastró la punta
  assert.equal(r.click, true)
  assert.deepEqual([r.x, r.y], [110, 100])
  p.push(0.1, 150, 150)
  assert.deepEqual([p.push(0, 160, 160).x], [160])
})

test('dwell fires once after holding still on the same target', () => {
  const d = createDwell({ ms: 3000 })
  const link = {}
  let fired = 0
  for (let t = 0; t <= 3500; t += 100) if (d.push(link, 200 + (t % 300 ? 5 : 0), 100, t).fire) fired++
  assert.equal(fired, 1)
  // Sigue encima: no repite.
  for (let t = 3600; t <= 9000; t += 100) if (d.push(link, 200, 100, t).fire) fired++
  assert.equal(fired, 1)
  // Sale y vuelve: puede disparar otra vez.
  d.push(null, 0, 0, 9100)
  let again = false
  for (let t = 9200; t <= 12300; t += 100) again ||= d.push(link, 200, 100, t).fire
  assert.ok(again)
})

test('moving past the slop or switching target restarts the count', () => {
  const d = createDwell({ ms: 3000, slop: 28 })
  const a = {}, b = {}
  d.push(a, 0, 0, 0)
  assert.equal(d.push(a, 10, 10, 2000).progress.toFixed(2), '0.67')
  assert.equal(d.push(a, 60, 0, 2100).progress, 0)       // se movió de más
  assert.equal(d.push(b, 60, 0, 2500).progress, 0)       // otro objetivo
  assert.equal(d.push(b, 62, 2, 5400).fire, false)
  assert.equal(d.push(b, 62, 2, 5500).fire, true)
})

test('nothing under the cursor means no progress', () => {
  const d = createDwell()
  assert.deepEqual(d.push(null, 0, 0, 5000), { progress: 0, fire: false })
})

test('the site’s more sensitive swipe catches a moderate sweep the default misses', () => {
  const SITE = { dx: 0.36, ms: 320 }
  const moderate = [{ x: -0.2, y: 0 }, { x: 0.2, y: 0 }]
  assert.equal(sweep(createSwipeDetector(), ...moderate, 300).swipes.length, 0)
  assert.equal(sweep(createSwipeDetector(SITE), ...moderate, 300).swipes.length, 1)
  // Y sigue sin confundir una deriva lenta con un swipe.
  assert.equal(sweep(createSwipeDetector(SITE), { x: -0.9, y: 0 }, { x: 0.9, y: 0 }, 2000).swipes.length, 0)
})

test('two open palms are their own mode, so spreading them never swipes', () => {
  const both = { source: 'hand', hands: 2, fingers: 5, fingers2: 5, point: 0 }
  assert.equal(handMode(both), 'two')
  assert.equal(handMode({ ...both, fingers2: 1 }), 'open')
  assert.equal(handMode({ ...both, hands: 1 }), 'open')
})

test('two hands: spreading zooms in, turning rolls, the short way round', () => {
  const start = twoHands({ x: -0.2, y: 0, x2: 0.2, y2: 0 })
  const wider = twoHands({ x: -0.4, y: 0, x2: 0.4, y2: 0 }, start)
  assert.ok(Math.abs(wider.zoom - 2) < 1e-9)
  assert.equal(wider.roll, 0)
  // La mano derecha sube (y negativo = arriba): giro antihorario en pantalla.
  const turned = twoHands({ x: -0.2, y: 0.1, x2: 0.2, y2: -0.1 }, start)
  assert.ok(turned.roll > 0.3 && turned.roll < 0.6)
  // Cruzar ±π no da casi una vuelta entera.
  const s2 = twoHands({ x: 0.2, y: 0.001, x2: -0.2, y2: 0 })
  const r2 = twoHands({ x: 0.2, y: -0.001, x2: -0.2, y2: 0 }, s2)
  assert.ok(Math.abs(r2.roll) < 0.05)
})

// ── Perder la mano a mitad de gesto ─────────────────────────────────────────

test('presence: a short loss is a pause, a long one lets go', () => {
  const p = createPresence({ grace: 1000 })
  assert.equal(p.push(true, 0).state, 'present')
  const lost = p.push(false, 100)
  assert.ok(lost.lost && lost.state === 'lost')
  assert.equal(p.push(false, 600).t, 0.5)
  const back = p.push(true, 700)
  assert.ok(back.back && back.state === 'present')
  p.push(false, 800)
  const gone = p.push(false, 1900)
  assert.ok(gone.gone && gone.state === 'gone')
  assert.ok(!p.push(true, 2000).back, 'coming back after the grace is a fresh start')
})

test('dwell: time without the hand does not count, and it resumes near the same spot', () => {
  const d = createDwell({ ms: 1000, slop: 28 })
  const link = {}
  d.push(link, 100, 100, 0)
  assert.equal(d.push(link, 100, 100, 600).progress, 0.6)
  d.pause(600)
  d.resume(1400)                                   // 800 ms sin mano
  // Vuelve 20 px más allá: sigue, no reinicia.
  assert.ok(Math.abs(d.push(link, 120, 100, 1450).progress - 0.65) < 1e-9)
  assert.ok(d.push(link, 120, 100, 1800).fire)
})
