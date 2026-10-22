import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SHAPES } from '../src/engine/shapes/procedural.js'
import { normalize, resolveShape } from '../src/engine/shapes/sources.js'

// El morph es punto a punto: si una forma trae un punto de menos, el último
// viaja a (0,0,0) o lee basura del buffer. Este es el contrato que lo evita.
test('every procedural shape returns exactly count finite points near R', async () => {
  for (const count of [2600, 6000]) {
    for (const s of SHAPES) {
      const p = await resolveShape({ type: s.name.toLowerCase() }, count, 240)
      assert.equal(p.length, count * 3, `${s.name} @ ${count}`)
      let max = 0
      for (const v of p) {
        assert.ok(Number.isFinite(v), `${s.name} has a non-finite coordinate`)
        max = Math.max(max, Math.abs(v))
      }
      assert.ok(max > 100 && max < 520, `${s.name} extent ${max.toFixed(0)} is off-scale`)
    }
  }
})

test('procedural shapes are deterministic', async () => {
  const a = await resolveShape({ type: 'galaxy' }, 1000, 240)
  const b = await resolveShape({ type: 'galaxy' }, 1000, 240)
  assert.deepEqual(a, b)
})

test('unknown shape names say what exists', async () => {
  await assert.rejects(resolveShape({ type: 'blob' }, 10, 240), /Known: sphere/)
})

test('normalize centres the cloud and puts the farthest point at R', () => {
  const p = new Float32Array([10, 10, 10, 12, 10, 10, 10, 14, 10])
  normalize(p, 100)
  let cx = 0, max = 0
  for (let i = 0; i < p.length; i += 3) {
    cx += p[i]
    max = Math.max(max, Math.hypot(p[i], p[i + 1], p[i + 2]))
  }
  assert.ok(Math.abs(cx) < 1e-4)
  assert.ok(Math.abs(max - 100) < 1e-3)
})

test('the rocket has exactly count points, split into body, window and flame', async () => {
  const { rocket } = await import('../src/engine/shapes/rocket.js')
  for (const count of [1600, 4200]) {
    const r = rocket(count, 240)
    assert.equal(r.all.length, count * 3)
    assert.equal(r.body.length + r.window.length + r.flame.length, count * 3)
    assert.ok(r.all.every(Number.isFinite))
    // Inclinado hacia arriba a la derecha: la punta (x máx) está más alta que la tobera.
    let tip = 0
    for (let i = 0; i < r.body.length; i += 3) if (r.body[i] > r.body[tip]) tip = i
    assert.ok(r.body[tip + 1] > r.nozzle[1], 'nose should be above the nozzle')
  }
})
