import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULTS, deriveProfile } from '../src/engine/handProfile.js'

// Una mano sintética: cada pose con algo de ruido, como las da la cámara.
const noisy = (base, n = 40, j = 0.08) =>
  Array.from({ length: n }, (_, i) => Object.fromEntries(
    Object.entries(base).map(([k, v]) => [k, v + Math.sin(i * 1.7) * j]),
  ))

const hand = {
  open: noisy({ fingers: 4.8, rIdx: 1, rOth: 2.9, rPinch: 1.1, y: 0 }),
  fist: noisy({ fingers: 0.6, rIdx: 0.05, rOth: 0.2, rPinch: 0.6, y: 0 }),
  point: noisy({ fingers: 1.6, rIdx: 0.95, rOth: 0.3, rPinch: 0.9, y: 0 }),
  pinch: noisy({ fingers: 1.4, rIdx: 0.6, rOth: 0.3, rPinch: 0.12, y: 0 }),
  low: noisy({ fingers: 4.8, rIdx: 1, rOth: 2.9, rPinch: 1.1, y: 0.5 }),
  swipes: [0.7, 0.8],
}

test('thresholds land between the poses they separate', () => {
  const p = deriveProfile(hand)
  assert.ok(p.open > 0.6 && p.open < 4.8, `open ${p.open}`)
  assert.ok(p.point.indexMin > 0.05 && p.point.indexMin < 0.95)
  assert.ok(p.point.othersMax > 0.3 && p.point.othersMax < 2.9)
  assert.ok(p.pinch.near > 0.12 && p.pinch.near < p.pinch.far)
  assert.ok(p.pinch.far < 0.9)
})

test('a big swipe and a low resting hand loosen swipe and scroll', () => {
  const p = deriveProfile(hand)
  assert.ok(Math.abs(p.swipe.dx - 0.45) < 0.03, `dx ${p.swipe.dx}`)
  assert.ok(Math.abs(p.scroll.dead - 0.3) < 0.03, `dead ${p.scroll.dead}`)
})

test('missing or garbage samples fall back to the defaults, never NaN', () => {
  const p = deriveProfile({ open: [], fist: [], point: [], pinch: [], low: [], swipes: [] })
  assert.equal(p.open, DEFAULTS.open)
  assert.deepEqual(p.point, { ...DEFAULTS.point })
  assert.equal(p.swipe.dx, DEFAULTS.swipe.dx)
  assert.equal(p.scroll.dead, DEFAULTS.scroll.dead)
  assert.ok(p.pinch.far > p.pinch.near)
})

test('a bad calibration is clamped so the hand stays usable', () => {
  const p = deriveProfile({ ...hand, swipes: [5], low: noisy({ y: 0.01 }) })
  assert.equal(p.swipe.dx, 0.6)
  assert.equal(p.scroll.dead, 0.12)
})
