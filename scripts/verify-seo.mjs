// Gate de SEO sobre dist/, después del pre-render. Falla el build si una
// página que se publica no se puede indexar bien o se contradice con el resto:
//   - cada ruta del sitemap tiene su .html, con título y descripción propios
//     (únicos, descripción ≤ 160), canonical igual a su URL, un solo <h1>,
//     Open Graph completo y JSON-LD que parsea;
//   - el sitemap lista exactamente esas rutas; robots.txt apunta al sitemap;
//   - llms.txt tiene una sección "### <título>" por proyecto (el botón
//     "Ask ChatGPT" del sitio le pide al modelo justo esa sección).
// Mismo criterio que los gates del portfolio Gatsby: un enlace que se
// renderiza igual y lleva a ninguna parte es peor que no tenerlo.

import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SITE_URL } from '../src/content/profile.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')
const errors = []
const fail = m => errors.push(m)
const read = f => readFileSync(join(DIST, f), 'utf8')

const sitemap = read('sitemap.xml')
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1])
if (!locs.length) fail('sitemap.xml lists no URLs')
if (!read('robots.txt').includes(`Sitemap: ${SITE_URL}/sitemap.xml`)) fail('robots.txt does not point to the sitemap')

const titles = new Map(), descs = new Map()
for (const loc of locs) {
  const path = loc.slice(SITE_URL.length).replace(/^\//, '')
  const file = path ? `${path}.html` : 'index.html'
  if (!existsSync(join(DIST, file))) { fail(`${loc}: no ${file}`); continue }
  const html = read(file)
  const get = re => html.match(re)?.[1]
  const title = get(/<title>([^<]*)<\/title>/)
  // Se mide el texto, no el HTML: "&amp;" es un carácter.
  const unesc = t => t?.replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[e])
  const desc = unesc(get(/<meta name="description" content="([^"]*)"/))
  const canon = get(/<link rel="canonical" href="([^"]*)"/)
  if (!title) fail(`${file}: no <title>`)
  if (!desc) fail(`${file}: no meta description`)
  else if (desc.length > 160) fail(`${file}: description is ${desc.length} chars`)
  if (canon !== loc) fail(`${file}: canonical ${canon} != ${loc}`)
  const h1 = (html.match(/<h1[\s>]/g) || []).length
  if (h1 !== 1) fail(`${file}: ${h1} <h1>`)
  for (const p of ['og:title', 'og:description', 'og:url', 'og:image']) {
    if (!html.includes(`property="${p}"`)) fail(`${file}: no ${p}`)
  }
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  if (!blocks.length) fail(`${file}: no JSON-LD`)
  for (const b of blocks) { try { JSON.parse(b[1]) } catch (e) { fail(`${file}: JSON-LD does not parse (${e.message})`) } }
  if (titles.has(title)) fail(`${file}: same title as ${titles.get(title)}`)
  if (descs.has(desc)) fail(`${file}: same description as ${descs.get(desc)}`)
  titles.set(title, file); descs.set(desc, file)
}

const projects = JSON.parse(readFileSync(join(ROOT, 'src/content/data/projects.json'), 'utf8'))
const llms = read('llms.txt')
for (const p of projects) {
  const t = p.title.replace(/\*\*/g, '')
  if (!llms.includes(`\n### ${t}\n`)) fail(`llms.txt: no "### ${t}" section`)
  if (!locs.includes(`${SITE_URL}/projects/${p.id}`)) fail(`sitemap.xml: no page for project ${p.id}`)
}
if (!read('404.html').includes('content="noindex"')) fail('404.html is indexable')

if (errors.length) {
  console.error(`[verify-seo] ${errors.length} problem(s):\n  ${errors.join('\n  ')}`)
  process.exit(1)
}
console.log(`[verify-seo] ok: ${locs.length} pages, sitemap, robots.txt, llms.txt (${projects.length} projects), 404`)
