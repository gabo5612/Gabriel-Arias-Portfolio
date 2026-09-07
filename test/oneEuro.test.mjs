// Tests del filtro one-euro. Los escribe el arquitecto, no el obrero: un gate
// que el propio implementador redactó no prueba nada.
//
// El valor ancla de "primer paso" está calculado a mano desde la definición de
// Casiez et al. (2012), no leído de una implementación, para que el test detecte
// una fórmula equivocada en vez de bendecirla.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createOneEuro } from '../src/lib/oneEuro.mjs'

const close = (a, b, tol = 1e-9) =>
  assert.ok(Math.abs(a - b) <= tol, `esperaba ${b} ± ${tol}, recibí ${a}`)

test('la primera muestra sale intacta: no hay historia contra la cual suavizar', () => {
  const f = createOneEuro()
  assert.equal(f(7.5, 0), 7.5)
})

test('una señal constante se queda exactamente en la constante', () => {
  const f = createOneEuro()
  f(3, 0)
  for (let i = 1; i <= 50; i++) close(f(3, i * 0.02), 3)
})

test('escalón: el valor cae entre el anterior y el nuevo, nunca fuera', () => {
  const f = createOneEuro()
  f(0, 0)
  const y = f(1, 0.1)
  assert.ok(y > 0 && y < 1, `el filtro sobrepasó el escalón: ${y}`)
})

test('escalón con minCutoff=1, beta=0, dt=0.1 → alpha = 1/(1+1/(0.2*pi))', () => {
  // tau      = 1/(2*pi*1)      = 0.15915494309189535
  // tau/dt   = 0.15915494309189535 / 0.1 = 1.5915494309189535
  // alpha    = 1/(1 + 1.5915494309189535)  ≈ 0.3858695
  // x̂        = alpha*1 + (1-alpha)*0       = alpha
  const f = createOneEuro({ minCutoff: 1, beta: 0, dCutoff: 1 })
  f(0, 0)
  close(f(1, 0.1), 0.3858695, 1e-6)
})

test('un minCutoff más alto sigue la señal más rápido (suaviza menos)', () => {
  const lento  = createOneEuro({ minCutoff: 0.5, beta: 0 })
  const rapido = createOneEuro({ minCutoff: 5,   beta: 0 })
  lento(0, 0); rapido(0, 0)
  assert.ok(rapido(1, 0.1) > lento(1, 0.1))
})

test('beta > 0 reduce el lag cuando la señal se mueve rápido', () => {
  const sinBeta = createOneEuro({ minCutoff: 1, beta: 0 })
  const conBeta = createOneEuro({ minCutoff: 1, beta: 5 })
  sinBeta(0, 0); conBeta(0, 0)
  // Mismo escalón grande y veloz en ambos: el de beta alto debe acercarse más.
  assert.ok(conBeta(10, 0.02) > sinBeta(10, 0.02))
})

test('dt no positivo devuelve el último valor filtrado y no toca el estado', () => {
  const f = createOneEuro()
  f(0, 1)
  const y = f(5, 1)      // mismo timestamp → dt = 0
  assert.equal(y, 0)
  const z = f(5, 0.5)    // timestamp hacia atrás → dt < 0
  assert.equal(z, 0)
  // El estado quedó intacto: este paso debe comportarse como el primero tras t=1.
  close(f(1, 1.1), 0.3858695, 1e-6)
})

test('un valor no finito devuelve el último filtrado sin corromper el estado', () => {
  const f = createOneEuro()
  f(2, 0)
  assert.equal(f(NaN, 0.1), 2)
  assert.equal(f(Infinity, 0.2), 2)
  close(f(2, 0.3), 2)
})

test('cada filtro es independiente: no comparten estado por el módulo', () => {
  const a = createOneEuro()
  const b = createOneEuro()
  a(100, 0)
  assert.equal(b(-100, 0), -100)
})
