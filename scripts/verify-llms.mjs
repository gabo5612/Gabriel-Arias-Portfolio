// Gate para static/llms.txt. Cada tarjeta del portfolio tiene un enlace "Ask
// ChatGPT" que manda al modelo a leer ese archivo; si una tarjeta no tiene
// sección allí, el enlace existe y no lleva a ninguna parte — que es peor que
// no tener el enlace. Falla con exit 1 y dice qué falta.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = p => readFileSync(join(root, p), 'utf8')

// Se leen los títulos por texto, no importando el módulo: porfolioCards.js
// importa .svg y .png, que Node no sabe cargar fuera de webpack.
const cards = read('src/logic/porfolioCards.js')
const titles = [...cards.matchAll(/^\s*title:\s*"([^"]+)"/gm)].map(m => m[1])

const llms = read('static/llms.txt')
const headings = [...llms.matchAll(/^### (.+)$/gm)].map(m => m[1].trim())

// site.js se lee, no se importa: el package.json es CommonJS por Gatsby, y un
// import de ESM desde aquí hace que Node reparsee y avise en cada build.
const SITE_URL = (read('src/logic/site.js').match(/SITE_URL\s*=\s*"([^"]+)"/) || [])[1]
if (!SITE_URL) { console.error('verify-llms: no se pudo leer SITE_URL de src/logic/site.js'); process.exit(1) }

const errors = []
if (titles.length === 0) errors.push('no se leyó ningún title: de porfolioCards.js')

for (const t of titles) {
  if (!headings.includes(t)) errors.push(`llms.txt no tiene la sección "### ${t}"`)
}
for (const h of headings) {
  if (!titles.includes(h)) errors.push(`llms.txt tiene "### ${h}" y no hay tarjeta con ese título`)
}
if (!llms.includes(SITE_URL)) {
  errors.push(`llms.txt no menciona SITE_URL (${SITE_URL}); el enlace de las tarjetas apunta ahí`)
}

if (errors.length) {
  console.error('verify-llms: FALLA\n' + errors.map(e => `  - ${e}`).join('\n'))
  process.exit(1)
}
console.log(`verify-llms: ok — ${titles.length} tarjetas, ${headings.length} secciones, origen ${SITE_URL}`)
