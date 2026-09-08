// Presupuesto de JS para el primer render de "/". Este sitio es el portfolio de
// alguien que vende sprints de Core Web Vitals: si la home engorda, el argumento
// comercial se cae solo. El check corre en `postbuild` — necesita public/ ya
// construido, a diferencia de verify-llms.mjs, que corre en prebuild.
//
// Mide dos cosas distintas, y la segunda importa más que la primera:
//
//   1. El peso gzip de los chunks que <script> pide en public/index.html.
//   2. Que los módulos pesados y diferidos SIGAN estando diferidos. Un import
//      estático mal puesto los arrastra al bundle de la página sin que nada
//      falle ni se note, y ese es el fallo que este archivo existe para atrapar.
import { readFileSync, readdirSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// Medido el 2026-09-06 sobre el commit 3c682d3, antes del hero de profundidad:
// 205 504 bytes gzip, medidos por este mismo script. El margen cubre el código
// que sí carga de entrada (la señal de profundidad y las capas del hero), no el
// 3D ni el tracker.
// Si este número sube, es porque algo que debía diferirse no se difirió.
//
// RE-MEDIDO el 2026-09-08 al agregar la sección Architecture: 213 141 gzip,
// +7 637 sobre la línea anterior. Se subió la línea base a propósito, y el
// criterio para hacerlo fue este: la sección no trae ninguna dependencia nueva
// —React, framer-motion y porfolioCards ya los cargaba Projects— y el bloque
// DEFERRED de más abajo siguió pasando, así que three.js y el modelo de cara
// continúan fuera del primer render. El aumento es texto y JSX de la sección,
// no un import() que se volvió estático.
// Los 700 KB de cada mapa NO entran acá: viven en static/architecture/ y son
// documentos aparte que sólo se descargan si alguien hace clic.
// El presupuesto conserva el mismo margen relativo que tenía (~4%).
const BUDGET_GZIP = 222_000
const BASELINE_GZIP = 213_141

// Cada módulo pesado con una marca que sobrevive a la minificación. Si el chunk
// que la contiene resulta ser uno de los que carga index.html, el diferido se
// rompió. Las marcas son strings que el minificador no puede renombrar:
// especificadores de import y URLs, no nombres de variables.
const DEFERRED = [
  { name: 'three',     marker: 'THREE.WebGLRenderer' },
  { name: 'faceSource', marker: 'blaze_face_short_range' },
]

const readJs = p => readFileSync(join(root, p))

// ── 1. Chunks que pide el primer render ────────────────────────────────────
// Dos fuentes, porque Gatsby usa dos mecanismos y quedarse con uno solo
// subestima el peso a la mitad:
//   · <script src> en index.html → runtime de webpack, framework y app.
//   · chunk-map.json → el chunk del componente de página, que el loader pide
//     en runtime para hidratar. No aparece como <script src> en el HTML, pero
//     se descarga igual en el primer render. Es el chunk más pesado de todos.
// Se mide "/" — el 404 se excluye a propósito, no lo carga quien entra a la home.
const html = readFileSync(join(root, 'public/index.html'), 'utf8')
const fromHtml = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map(m => m[1])

const chunkMap = JSON.parse(readFileSync(join(root, 'public/chunk-map.json'), 'utf8'))
const pageChunks = chunkMap['component---src-pages-index-js']
if (!Array.isArray(pageChunks) || pageChunks.length === 0) {
  console.error('verify-budget: FALLA\n  - chunk-map.json no trae component---src-pages-index-js')
  process.exit(1)
}

const eager = [...new Set([...fromHtml, ...pageChunks])].sort()

if (fromHtml.length === 0) {
  console.error('verify-budget: FALLA\n  - no se leyó ningún <script src> de public/index.html')
  process.exit(1)
}

const errors = []
let total = 0
const rows = []

for (const src of eager) {
  const rel = join('public', src)
  try {
    const buf = readJs(rel)
    const gz = gzipSync(buf, { level: 6 }).length
    total += gz
    rows.push([src, buf.length, gz])
  } catch {
    errors.push(`index.html pide ${src} y no existe en public/`)
  }
}

// ── 2. Los diferidos siguen diferidos ──────────────────────────────────────
// Dos comprobaciones, y la segunda es la que le da valor a la primera:
//   a) la marca NO aparece en ningún chunk del primer render;
//   b) la marca SÍ aparece en algún chunk de public/ — si no, el marcador dejó
//      de existir (renombre de la librería, cambio de build) y el check estaría
//      pasando siempre sin poder fallar nunca. Una marca vacía es peor que no
//      tener check: da confianza sin respaldarla.
const eagerBodies = rows.map(([src]) => readJs(join('public', src)).toString('utf8'))
const allChunks = readdirSync(join(root, 'public')).filter(f => f.endsWith('.js'))

for (const { name, marker } of DEFERRED) {
  const hitEager = rows.findIndex((_, i) => eagerBodies[i].includes(marker))
  if (hitEager !== -1) {
    errors.push(
      `"${name}" quedó dentro de ${rows[hitEager][0]}, que carga en el primer render. ` +
      `Tiene que llegar por import() diferido, no por import estático.`
    )
    continue
  }
  const existe = allChunks.some(f => readJs(join('public', f)).toString('utf8').includes(marker))
  if (!existe) {
    errors.push(
      `el marcador de "${name}" ("${marker}") no aparece en ningún chunk de public/. ` +
      `El check no puede fallar nunca, así que no prueba nada: actualizá el marcador.`
    )
  }
}

// ── Reporte ────────────────────────────────────────────────────────────────
const pad = (s, n) => String(s).padEnd(n)
const num = n => n.toLocaleString('en-US')

console.log('verify-budget: JS del primer render de /')
for (const [src, raw, gz] of rows) {
  console.log(`  ${pad(src, 56)} ${pad(num(raw), 10)} ${num(gz)} gz`)
}

const delta = total - BASELINE_GZIP
const sign = delta >= 0 ? '+' : ''
console.log(`  ${pad('', 56)} ${pad('', 10)} ${num(total)} gz total ` +
            `(${sign}${num(delta)} vs baseline, presupuesto ${num(BUDGET_GZIP)})`)

if (total > BUDGET_GZIP) {
  errors.push(
    `el primer render pesa ${num(total)} bytes gzip y el presupuesto es ${num(BUDGET_GZIP)}. ` +
    `Diferí lo que agregaste con import(), o subí BUDGET_GZIP a conciencia y decí por qué.`
  )
}

if (errors.length) {
  console.error('verify-budget: FALLA\n' + errors.map(e => `  - ${e}`).join('\n'))
  process.exit(1)
}
console.log(`verify-budget: ok — ${rows.length} chunks, ${num(total)} bytes gzip`)
