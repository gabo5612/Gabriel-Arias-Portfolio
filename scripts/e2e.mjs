// Pruebas de punta a punta: el sitio de verdad, en un Chromium de verdad, con
// la mano simulada. Lo que los tests de node no alcanzan —el vuelo, el panel,
// la lupa, el cursor de la mano, la calibración, el móvil— se comprueba acá
// sin webcam ni giroscopio.
//
// La mano entra por window.__depth (sólo existe en desarrollo), así que esto
// levanta su propio servidor de Vite en modo dev, en otro puerto para no
// pisar el de `npm run dev`.
//
// Playwright NO es dependencia del proyecto, igual que en brandvoice:
//   npm i --no-save playwright@1.63.0      (usa el Chromium ya instalado)
//   npm run e2e                            → sale con 1 si algo falla

import { createServer } from 'vite'

let chromium
try {
  ({ chromium } = await import('playwright'))
} catch {
  console.error('Playwright is not a dependency. Install it for this run:\n  npm i --no-save playwright@1.63.0')
  process.exit(2)
}

const PORT = 5191
const BASE = `http://localhost:${PORT}/`
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' })
await server.listen()

// WebGL por software: en CI (o en headless sin GPU) el mundo tiene que montar
// igual, aunque sea lento.
// Primero el Chromium de Playwright; si su revisión no está descargada, el
// Google Chrome instalado en la máquina, en vez de bajar otro navegador.
const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
let browser
try {
  browser = await chromium.launch({ args: ARGS })
} catch (e) {
  if (!/Executable doesn't exist/.test(e.message)) throw e
  console.log('(Playwright Chromium not installed — using the installed Google Chrome)')
  browser = await chromium.launch({ channel: 'chrome', args: ARGS })
}

const results = []
const DESKTOP = { viewport: { width: 1440, height: 900 } }

async function check(name, fn, ctxOpts = DESKTOP) {
  const ctx = await browser.newContext(ctxOpts)
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  // El 404 de consola no dice de qué; la respuesta sí.
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`) })
  page.on('console', m => { if (m.type() === 'error' && !/status of \d{3}/.test(m.text())) errors.push(m.text()) })
  const t0 = Date.now()
  try {
    await fn(page)
    if (errors.length) throw new Error(`console error: ${errors[0]}`)
    results.push({ name, ok: true, ms: Date.now() - t0 })
  } catch (e) {
    results.push({ name, ok: false, ms: Date.now() - t0, err: e.message.split('\n')[0] })
  }
  await ctx.close()
}

// ── Ayudas ──────────────────────────────────────────────────────────────────
const wait = ms => new Promise(r => setTimeout(r, ms))
const assert = (cond, msg) => { if (!cond) throw new Error(msg) }

async function open(page, hash = '#/', { query = '', world = true } = {}) {
  await page.goto(`${BASE}${query}${hash}`)
  await page.waitForSelector('.panel')
  if (world) await page.waitForSelector('.world canvas', { timeout: 10000 })
  // Que las formas carguen y la primera presentación del título termine.
  await wait(world ? 2500 : 300)
}
const pose = (page, p) => page.evaluate(p => window.__depth.pose(p), p)
const hash = page => page.evaluate(() => location.hash)
async function waitHash(page, want, ms = 4000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if ((await hash(page)) === want) return
    await wait(100)
  }
  throw new Error(`expected ${want}, still at ${await hash(page)}`)
}
const rectOf = (page, sel, text) => page.evaluate(([sel, text]) => {
  const el = [...document.querySelectorAll(sel)].find(e => !text || e.textContent.includes(text))
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: innerWidth, h: innerHeight }
}, [sel, text])
const POINT = { hands: 1, fingers: 1.2, fingers2: 0, point: 1, pinch: 0, x: 0, y: 0 }
const OPEN = { hands: 1, fingers: 5, fingers2: 0, point: 0, pinch: 0, x: 0, y: 0 }

// ── El sitio ────────────────────────────────────────────────────────────────
await check('home renders, with the world mounted', async page => {
  await open(page)
  assert((await page.textContent('.home__name')).includes('Gabriel Arias'), 'no name on home')
  assert(await page.$('.world canvas'), 'no WebGL canvas')
})

await check('arrow key flies to the next page and its panel', async page => {
  await open(page)
  await page.keyboard.press('ArrowRight')
  await waitHash(page, '#/about')
  await page.waitForFunction(() => document.querySelector('.panel__title')?.textContent.includes('AI systems'))
})

await check('one wheel gesture moves exactly one page', async page => {
  await open(page, '#/about')
  await page.mouse.move(1100, 450)
  for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 60); await wait(30) }
  await waitHash(page, '#/skills')
  await wait(1200)
  assert((await hash(page)) === '#/skills', `overshot to ${await hash(page)}`)
})

await check('deep link, Escape and the back button', async page => {
  await open(page, '#/projects/shopfloor')
  assert((await page.textContent('.project .panel__title')).includes('shopfloor'), 'not the shopfloor detail')
  await page.keyboard.press('Escape')
  await waitHash(page, '#/projects')
  await page.goBack()
  await waitHash(page, '#/projects/shopfloor')
})

await check('opening a project loads its 3D model', async page => {
  const got = []
  page.on('response', r => { if (r.url().includes('/models/projects/')) got.push([r.url(), r.status()]) })
  await open(page, '#/projects/gaboauditmyweb')
  assert(got.some(([u, s]) => u.endsWith('gaboauditmyweb.glb') && s < 400), `model not fetched: ${JSON.stringify(got)}`)
})

await check('titles are formed by particles and end fully visible', async page => {
  await open(page, '#/about')
  await page.keyboard.press('ArrowRight')
  await waitHash(page, '#/skills')
  await wait(3500)
  const op = await page.evaluate(() => getComputedStyle(document.querySelector('.panel__title')).opacity)
  assert(op === '1', `title opacity ${op}`)
})

await check('the mouse bends nearby words', async page => {
  await open(page, '#/about')
  const r = await rectOf(page, '.panel__text .w')
  await page.mouse.move(r.x, r.y)
  await wait(250)
  const lit = await page.evaluate(() => [...document.querySelectorAll('.w')].filter(w => parseFloat(w.style.getPropertyValue('--t')) > 0).length)
  assert(lit > 2, `only ${lit} words reacted`)
})

await check('the mouse can grab the figure', async page => {
  await open(page, '#/')
  await page.mouse.move(1000, 450)
  await page.mouse.move(1010, 455)
  await wait(200)
  const cur = await page.evaluate(() => document.querySelector('.world').style.cursor)
  assert(cur === 'grab', `cursor over the figure is "${cur}"`)
})

// ── La mano (simulada) ──────────────────────────────────────────────────────
await check('open palm held low scrolls the text, high scrolls back', async page => {
  await open(page, '#/experience')
  const top = () => page.evaluate(() => document.querySelector('.site__main .panel:last-child [data-scroll]').scrollTop)
  await pose(page, { ...OPEN, y: 0.75 })
  await wait(1200)
  const down = await top()
  assert(down > 40, `scrollTop ${down} after hand low`)
  await pose(page, { ...OPEN, y: -0.75 })
  await wait(1200)
  assert((await top()) < down, 'hand high did not scroll back')
})

await check('open-palm swipe changes page', async page => {
  await open(page, '#/about')
  // La mano aparece a un lado y se queda quieta: si un cuadro se traba, el
  // salto de "sin mano" a x = -0.3 podría leerse como un swipe. Se espera a
  // que se asiente y se comprueba que no movió nada antes de barrer.
  await pose(page, { ...OPEN, x: -0.3 })
  await wait(1100)
  assert((await hash(page)) === '#/about', `the hand moved the page just by appearing (${await hash(page)})`)
  await pose(page, { ...OPEN, x: 0.3 })
  await waitHash(page, '#/skills')
})

await check('point and pinch opens a project', async page => {
  await open(page, '#/projects')
  const r = await rectOf(page, '.projects__row', 'crew')
  await pose(page, { ...POINT, px: (r.x - 120) / r.w, py: r.y / r.h })
  await wait(400)
  await pose(page, { pinch: 0.35 })
  await wait(120)
  await pose(page, { pinch: 0.95 })
  await waitHash(page, '#/projects/crew', 2500)
})

await check('holding the finger on the edge arrow turns the page', async page => {
  await open(page, '#/about')
  await pose(page, { ...POINT, px: 1, py: 0.5 })
  await waitHash(page, '#/skills', 3000)
})

await check('up/down arrows step through projects', async page => {
  await open(page, '#/projects/shopfloor')
  await pose(page, { ...POINT, px: 0.5, py: 0.5 })
  await wait(300)
  const r = await rectOf(page, '.edge-nav__btn--down')
  await pose(page, { px: r.x / r.w, py: r.y / r.h })
  await waitHash(page, '#/projects/groundcheck', 3000)
})

await check('two open palms zoom instead of swiping', async page => {
  await open(page, '#/skills')
  await pose(page, { hands: 2, fingers: 5, fingers2: 5, point: 0, x: -0.15, y: 0, x2: 0.15, y2: 0 })
  await wait(600)
  await pose(page, { x: -0.38, x2: 0.38 })
  await wait(900)
  assert((await hash(page)) === '#/skills', `two hands navigated to ${await hash(page)}`)
  assert((await page.textContent('.gesture__caption')).includes('zoom'), 'no two-hand guide')
})

await check('calibration measures six poses and saves a profile', async page => {
  await open(page, '#/about', { query: '?fakehud' })
  await pose(page, { hands: 1, fingers: 1, point: 0, x: 0, y: 0, rIdx: 0.2, rOth: 1, rPinch: 1 })
  await page.click('.hud__tune')
  const steps = [
    [{ fingers: 4.8, rIdx: 1, rOth: 2.9, rPinch: 1.1 }, 2100],
    [{ fingers: 0.6, rIdx: 0.05, rOth: 0.2, rPinch: 0.6 }, 2100],
    [{ fingers: 1.6, rIdx: 0.95, rOth: 0.3, rPinch: 0.9 }, 2100],
    [{ fingers: 1.4, rIdx: 0.6, rOth: 0.3, rPinch: 0.12 }, 1900],
    [{ fingers: 4.8, rIdx: 1, rOth: 2.9, rPinch: 1.1, x: -0.45 }, 700],
    [{ x: 0.45 }, 900], [{ x: -0.45 }, 900], [{ x: 0.45 }, 900],
    [{ x: 0, y: 0.5 }, 2300],
  ]
  for (const [p, ms] of steps) { await pose(page, p); await wait(ms) }
  assert((await page.textContent('.calib__title')).includes('Tuned'), 'wizard did not finish')
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('handProfile') || 'null'))
  assert(saved && saved.swipe && saved.pinch.far > saved.pinch.near, 'no usable profile saved')
})

await check('tilting the phone drives the camera', async page => {
  await open(page, '#/')
  await page.evaluate(() => window.__depth.tilt())
  for (let i = 0; i < 12; i++) {
    await page.evaluate(() => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { gamma: 25, beta: 45 })))
    await wait(50)
  }
  const s = await page.evaluate(() => window.__depth.read())
  assert(s.source === 'gyro' && s.x > 0.3, `source ${s.source}, x ${s.x?.toFixed(2)}`)
})

await check('"Fly to my projects" turns the sphere into a dot biplane that flies to Projects', async page => {
  await open(page)
  const seen = page.evaluate(() => new Promise(r => {
    const pts = []
    const t0 = performance.now()
    const f = () => {
      const p = window.__plane?.()
      if (p?.on && p.z < 1) pts.push(p)
      if (performance.now() - t0 < 5500) requestAnimationFrame(f); else r({ pts, end: window.__plane?.() })
    }
    requestAnimationFrame(f)
  }))
  await page.click('text=Fly to my projects')
  const { pts, end } = await seen
  await waitHash(page, '#/projects')
  const onScreen = pts.filter(p => p.sx > 0 && p.sx < 1440 && p.sy > 0 && p.sy < 900)
  assert(pts.length >= 3, `plane seen in only ${pts.length} frames`)
  assert(onScreen.length / pts.length > 0.8, `plane off-screen in ${pts.length - onScreen.length} of ${pts.length} frames`)
  assert(!end.on, 'plane still flying after the trip')
})

// ── Sonido ──────────────────────────────────────────────────────────────────
// No se puede escuchar, pero sí medir: el pico de la salida (un analizador que
// existe sólo en desarrollo) sube al volar y al tocar la figura, nunca satura,
// y el botón lo apaga del todo.
const peakDuring = (page, ms) => page.evaluate(ms => new Promise(r => {
  let p = 0
  const id = setInterval(() => { p = Math.max(p, window.__sound.level()) }, 20)
  setTimeout(() => { clearInterval(id); r(p) }, ms)
}), ms)

await check('sound: wakes on the first click, reacts to flight and poke, turns off', async page => {
  await open(page)
  await page.mouse.click(20, 880)                      // el primer gesto, en el vacío
  await wait(1500)
  const pad = await peakDuring(page, 800)
  await page.keyboard.press('ArrowRight')
  const flight = await peakDuring(page, 2200)
  await wait(800)
  await page.mouse.move(1040, 430); await wait(300)
  await page.mouse.click(1040, 430)
  const poke = await peakDuring(page, 600)
  assert(pad > 0.01, `silent background (${pad.toFixed(3)})`)
  assert(flight > pad * 1.5, `flight ${flight.toFixed(3)} vs background ${pad.toFixed(3)}`)
  assert(poke > pad * 1.5, `poke ${poke.toFixed(3)} vs background ${pad.toFixed(3)}`)
  assert(Math.max(flight, poke) < 0.9, 'output close to clipping')
  await page.click('.nav__sound')
  await wait(800)
  const off = await peakDuring(page, 400)
  assert(off === 0, `still sounding after turning it off (${off})`)
  assert((await page.getAttribute('.nav__sound', 'aria-pressed')) === 'false', 'button not pressed=false')
})

// ── Otros mundos ────────────────────────────────────────────────────────────
await check('reduced motion: no world, still fully navigable', async page => {
  await open(page, '#/', { world: false })
  await wait(2500)
  assert(!(await page.$('.world canvas')), 'world mounted despite reduced motion')
  await page.keyboard.press('ArrowRight')
  await waitHash(page, '#/about')
}, { ...DESKTOP, reducedMotion: 'reduce' })

await check('phone: world above, text below, tilt offered, no sideways scroll', async page => {
  await open(page, '#/about')
  const m = await page.evaluate(() => ({
    top: document.querySelector('.site__main').getBoundingClientRect().top,
    h: innerHeight,
    overflow: document.documentElement.scrollWidth > innerWidth,
    tilt: [...document.querySelectorAll('.nav button')].some(b => b.textContent.includes('Tilt')),
  }))
  assert(m.top > m.h * 0.3, `panel starts at ${Math.round(m.top)}px`)
  assert(!m.overflow, 'horizontal overflow')
  assert(m.tilt, 'no Tilt button on a touch screen')
}, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })

await check('a full tour makes no request outside this site (fonts aside)', async page => {
  const out = []
  page.on('request', r => {
    const u = new URL(r.url())
    const ok = u.hostname === 'localhost' || /^fonts\.(googleapis|gstatic)\.com$/.test(u.hostname) || u.protocol === 'data:' || u.protocol === 'blob:'
    if (!ok) out.push(r.url())
  })
  await open(page, '#/')
  for (let i = 0; i < 6; i++) { await page.keyboard.press('ArrowRight'); await wait(1700) }
  await page.keyboard.press('5')
  await page.keyboard.press('ArrowDown')
  await wait(1500)
  assert(!out.length, `left the site: ${out[0]}`)
})

// ── Resultado ───────────────────────────────────────────────────────────────
await browser.close()
await server.close()

const failed = results.filter(r => !r.ok)
for (const r of results) {
  console.log(`${r.ok ? '✓' : '✗'} ${r.name} (${(r.ms / 1000).toFixed(1)}s)${r.ok ? '' : `\n    ${r.err}`}`)
}
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
