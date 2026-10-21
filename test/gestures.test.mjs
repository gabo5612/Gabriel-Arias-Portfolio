import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPinchClick, createSwipeDetector, handMode, scrollSpeed } from '../src/engine/gestures.js'

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
