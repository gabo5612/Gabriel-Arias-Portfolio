import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HOME, isKnownPath, parseHash, parsePath, step, toHash, toPath } from '../src/site/router.js'

const pages = [
  { id: 'home' },
  { id: 'about' },
  { id: 'projects', items: ['shopfloor', 'groundcheck', 'crew'] },
  { id: 'contact' },
]

test('hash round-trips for every page and item', () => {
  const states = [
    HOME,
    { page: 1, item: null },
    { page: 2, item: null },
    { page: 2, item: 'groundcheck' },
    { page: 3, item: null },
  ]
  for (const s of states) assert.deepEqual(parseHash(toHash(s, pages), pages), s)
})

test('home is the bare root', () => {
  assert.equal(toHash(HOME, pages), '#/')
  assert.deepEqual(parseHash('', pages), HOME)
  assert.deepEqual(parseHash('#/', pages), HOME)
  assert.deepEqual(parseHash('#/home', pages), HOME)
})

test('unknown page or item falls back instead of breaking', () => {
  assert.deepEqual(parseHash('#/nope', pages), HOME)
  assert.deepEqual(parseHash('#/projects/nope', pages), { page: 2, item: null })
  assert.deepEqual(parseHash('#/about/stray', pages), { page: 1, item: null })
})

test('page steps wrap at both ends and drop the open item', () => {
  assert.deepEqual(step(HOME, { type: 'page', dir: -1 }, pages), { page: 3, item: null })
  assert.deepEqual(step({ page: 3, item: null }, { type: 'page', dir: 1 }, pages), HOME)
  assert.deepEqual(step({ page: 2, item: 'crew' }, { type: 'page', dir: 1 }, pages), { page: 3, item: null })
})

test('item steps open, walk and fall back to the list', () => {
  const list = { page: 2, item: null }
  assert.deepEqual(step(list, { type: 'item', dir: 1 }, pages), { page: 2, item: 'shopfloor' })
  assert.deepEqual(step(list, { type: 'item', dir: -1 }, pages), { page: 2, item: 'crew' })
  assert.deepEqual(step({ page: 2, item: 'shopfloor' }, { type: 'item', dir: 1 }, pages), { page: 2, item: 'groundcheck' })
  assert.deepEqual(step({ page: 2, item: 'crew' }, { type: 'item', dir: 1 }, pages), list)
  assert.deepEqual(step({ page: 2, item: 'shopfloor' }, { type: 'item', dir: -1 }, pages), list)
})

test('item steps on a page without items do nothing', () => {
  const about = { page: 1, item: null }
  assert.equal(step(about, { type: 'item', dir: 1 }, pages), about)
})

test('goto and close', () => {
  assert.deepEqual(step(HOME, { type: 'goto', id: 'projects', item: 'crew' }, pages), { page: 2, item: 'crew' })
  assert.deepEqual(step(HOME, { type: 'goto', id: 'projects', item: 'bogus' }, pages), { page: 2, item: null })
  assert.equal(step(HOME, { type: 'goto', id: 'bogus' }, pages), HOME)
  assert.deepEqual(step({ page: 2, item: 'crew' }, { type: 'close' }, pages), { page: 2, item: null })
})

// ── Rutas de verdad ─────────────────────────────────────────────────────────

test('paths round-trip, with and without a base folder', () => {
  for (const base of ['/', '/Gabriel-Arias-Portfolio/']) {
    for (const s of [{ page: 0, item: null }, { page: 1, item: null }, { page: 2, item: 'shopfloor' }]) {
      assert.deepEqual(parsePath(toPath(s, pages, base), pages, base), s)
    }
  }
  assert.equal(toPath({ page: 0, item: null }, pages, '/'), '/')
  assert.equal(toPath({ page: 2, item: 'shopfloor' }, pages, '/x/'), '/x/projects/shopfloor')
  assert.deepEqual(parsePath('/about/', pages), { page: 1, item: null })
})

test('unknown paths are flagged, known ones are not', () => {
  assert.ok(isKnownPath('/', pages))
  assert.ok(isKnownPath('/projects/shopfloor', pages))
  assert.ok(!isKnownPath('/nope', pages))
  assert.ok(!isKnownPath('/projects/zzz', pages))
  assert.ok(!isKnownPath('/about/a/b', pages))
})
