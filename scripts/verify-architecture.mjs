// Gate para los mapas de arquitectura. Mismo razonamiento que verify-llms.mjs: cada
// tarjeta lleva un botón "Architecture" que abre static/architecture/<arch>.html. Si el
// archivo no está, el botón se renderiza igual y lleva a un 404 — que es peor que no
// tener el botón. Falla con exit 1 y dice qué falta.
//
// Comprueba cuatro cosas, y la última existe por un fallo concreto: un `cp` interrumpido
// deja un HTML de 2 KB que abre en blanco, y ninguna comprobación de existencia lo nota.
//
//   1. Toda tarjeta con `arch:` tiene su archivo.
//   2. El mapa del propio sitio (portfolio.html) existe — lo pide la sección Architecture,
//      que no sale de porfolioCards.js.
//   3. Ningún archivo huérfano: un mapa sin tarjeta es un mapa que nadie va a abrir.
//   4. Cada archivo pesa lo que pesa un artefacto real y trae su <svg>.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const ARCH_DIR = join(root, 'static/architecture')

// El mapa del sitio no viene de una tarjeta: la sección Architecture lo referencia a mano.
const SELF = 'portfolio'

// Un artefacto de archify ronda los 700 KB porque lleva el visor embebido. 200 KB es un
// suelo generoso que sólo atrapa un archivo truncado, no un mapa legítimamente pequeño.
const MIN_BYTES = 200_000

const errors = []

if (!existsSync(ARCH_DIR)) {
  console.error('verify-architecture: FALLA\n  - no existe static/architecture/')
  process.exit(1)
}

// Los slugs se leen por texto, no importando el módulo: porfolioCards.js importa .svg,
// .png y .webp, que Node no sabe cargar fuera de webpack. Igual que en verify-llms.mjs.
const cards = readFileSync(join(root, 'src/logic/porfolioCards.js'), 'utf8')
const titles = [...cards.matchAll(/^\s*title:\s*"([^"]+)",\s*$/gm)].map(m => m[1])
const slugs = [...cards.matchAll(/^\s*arch:\s*"([^"]+)",\s*$/gm)].map(m => m[1])

if (titles.length === 0) errors.push('no se leyó ningún title: de porfolioCards.js')
if (slugs.length === 0) errors.push('no se leyó ningún arch: de porfolioCards.js')

// Una tarjeta sin `arch` no es un error —puede ser deliberado— pero que sobren o falten
// respecto a los títulos sí avisa de una tarjeta agregada a medias.
if (slugs.length !== titles.length) {
  errors.push(
    `${titles.length} tarjetas y ${slugs.length} slugs arch: — alguna tarjeta quedó sin mapa`
  )
}

const dupes = arr => [...new Set(arr.filter((v, i) => arr.indexOf(v) !== i))]
for (const d of dupes(slugs)) errors.push(`porfolioCards.js repite arch: "${d}"`)

const onDisk = readdirSync(ARCH_DIR).filter(f => f.endsWith('.html'))
const expected = new Set([...slugs, SELF])

for (const slug of expected) {
  const file = join(ARCH_DIR, `${slug}.html`)
  if (!existsSync(file)) {
    errors.push(`falta static/architecture/${slug}.html`)
    continue
  }
  const bytes = statSync(file).size
  if (bytes < MIN_BYTES) {
    errors.push(`static/architecture/${slug}.html pesa ${bytes} B (< ${MIN_BYTES}): truncado`)
    continue
  }
  // Un artefacto sin <svg> abrió en blanco: el render falló y se escribió el cascarón.
  if (!readFileSync(file, 'utf8').includes('<svg')) {
    errors.push(`static/architecture/${slug}.html no contiene ningún <svg>`)
  }
}

for (const f of onDisk) {
  const slug = f.replace(/\.html$/, '')
  if (!expected.has(slug)) {
    errors.push(`static/architecture/${f} no tiene tarjeta con arch: "${slug}"`)
  }
}

if (errors.length) {
  console.error('verify-architecture: FALLA\n' + errors.map(e => `  - ${e}`).join('\n'))
  process.exit(1)
}
console.log(
  `verify-architecture: ok — ${expected.size} mapas (${slugs.length} proyectos + el del sitio)`
)
