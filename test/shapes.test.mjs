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

test('the biplane has exactly count points, and body + propeller add up', async () => {
  const { biplane } = await import('../src/engine/shapes/biplane.js')
  for (const count of [1600, 4200]) {
    const b = biplane(count, 240)
    assert.equal(b.all.length, count * 3)
    assert.equal(b.body.length + b.prop.length, count * 3)
    assert.ok(b.all.every(Number.isFinite))
    // De perfil y con la nariz en +x: más largo en x que alto en y.
    const xs = b.body.filter((_, i) => i % 3 === 0), ys = b.body.filter((_, i) => i % 3 === 1)
    assert.ok(Math.max(...xs) - Math.min(...xs) > Math.max(...ys) - Math.min(...ys))
  }
})
