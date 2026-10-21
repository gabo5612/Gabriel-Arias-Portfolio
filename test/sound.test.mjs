import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NOTES, SEMIS } from '../src/engine/audio/scale.js'
import { stationChord, wordNote } from '../src/engine/audio/worldSound.js'

// Lo que se puede comprobar sin Web Audio: que todo lo que suena cae en la
// escala, que cada estación tiene su acorde, y que la lupa sube con la altura.

test('every station chord is three notes of the scale, and neighbours differ', () => {
  for (let i = 0; i < 6; i++) {
    const c = stationChord(i)
    assert.equal(c.length, 3)
    c.forEach(s => assert.ok(SEMIS.includes(s), `${s} not in scale`))
    assert.notDeepEqual(c, stationChord(i + 1))
  }
  assert.deepEqual(stationChord(-1), stationChord(5))
})

test('the text harp is higher at the top of the screen and stays in the scale', () => {
  assert.ok(wordNote(0) > wordNote(0.5) && wordNote(0.5) > wordNote(1))
  for (const y of [-1, 0, 0.3, 0.77, 1, 2]) assert.ok(NOTES.includes(wordNote(y)))
})
