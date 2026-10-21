import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NOTES, SEMIS } from '../src/engine/audio/scale.js'
import { STATIONS, stationChord, wordNote } from '../src/engine/audio/worldSound.js'

// Lo que se puede comprobar sin Web Audio: que todo lo que suena cae en la
// escala, que cada estación tiene su acorde, y que la lupa sube con la altura.

test('every station has its own chord in the scale, root and brightness', () => {
  const inScale = semi => SEMIS.includes(((semi % 12) + 12) % 12)
  for (let i = 0; i < STATIONS.length; i++) {
    stationChord(i).forEach(s => assert.ok(inScale(s), `station ${i}: ${s} not in scale`))
  }
  // Distinguibles: ni dos raíces ni dos brillos iguales.
  assert.equal(new Set(STATIONS.map(s => s.chord[0])).size, STATIONS.length)
  assert.equal(new Set(STATIONS.map(s => s.lp)).size, STATIONS.length)
  assert.deepEqual(stationChord(-1), stationChord(STATIONS.length - 1))
})

test('the text harp is higher at the top of the screen and stays in the scale', () => {
  assert.ok(wordNote(0) > wordNote(0.5) && wordNote(0.5) > wordNote(1))
  for (const y of [-1, 0, 0.3, 0.77, 1, 2]) assert.ok(NOTES.includes(wordNote(y)))
})
