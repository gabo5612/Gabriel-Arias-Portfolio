// Trae el contenido del portfolio a src/content/data/ como JSON.
//
// El portfolio es la fuente de verdad: tarjetas, experiencia y skills se editan
// allá y acá se regeneran, en vez de mantener dos copias a mano que divergen a
// la primera corrección. Los .js del portfolio importan imágenes (cosa de
// Gatsby/webpack, node no sabe cargar un .svg), así que se reescribe ese import
// por un Proxy que devuelve el nombre de la clave: `images.shopfloor` pasa a
// valer "shopfloor" y con eso se resuelve la portada.
//
//   node scripts/sync-content.mjs [ruta-al-portfolio]

import { copyFileSync, mkdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const portfolio = resolve(process.argv[2] || join(root, '../Gabriel-Arias-Portfolio'))
const logic = join(portfolio, 'src/logic')
const outDir = join(root, 'src/content/data')
const coverDir = join(root, 'public/covers')

const PROXY = 'const __img = new Proxy({}, { get: (_, k) => String(k) });'

async function load(file, importRe, alias) {
  const src = readFileSync(join(logic, file), 'utf8')
  if (!importRe.test(src)) throw new Error(`${file}: the image import moved — update sync-content.mjs`)
  const tmp = mkdtempSync(join(tmpdir(), 'sync-'))
  const out = join(tmp, file.replace(/\.js$/, '.mjs'))
  writeFileSync(out, src.replace(importRe, `${PROXY}\nconst ${alias} = __img;`))
  try {
    return (await import(pathToFileURL(out).href)).default
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

// imgPortoflio.js: `import shopfloor from '../images/Porfolio/covers/shopfloor.svg'`
const covers = Object.fromEntries(
  [...readFileSync(join(logic, 'imgPortoflio.js'), 'utf8').matchAll(/import\s+(\w+)\s+from\s+'([^']+)'/g)]
    .map(([, key, rel]) => [key, resolve(logic, rel)]),
)

const cards = await load('porfolioCards.js', /import images from ["']\.\/imgPortoflio["'];?/, 'images')
const skills = await load('aboutCards.js', /import image from ['"]\.\.\/logic\/imgMySkills['"];?/, 'image')
const experience = JSON.parse(readFileSync(join(logic, 'experience.json'), 'utf8'))

mkdirSync(outDir, { recursive: true })
mkdirSync(coverDir, { recursive: true })

const ids = new Set()
const projects = cards.map(({ img, ...card }) => {
  // `arch` ya es un slug único y estable (el portfolio lo valida contra sus
  // mapas), así que sirve de id para la URL: #/projects/<arch>.
  const id = card.arch || card.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  if (ids.has(id)) throw new Error(`duplicate project id ${id}`)
  ids.add(id)
  let cover = null
  if (covers[img]) {
    const name = basename(covers[img])
    copyFileSync(covers[img], join(coverDir, name))
    cover = `/covers/${name}`
  }
  return { id, cover, ...card }
})

// Skills: sólo el título. Los íconos son assets del portfolio y acá se
// muestran como chips de texto.
const skillGroups = Object.entries(skills).map(([group, items]) => ({
  group, items: items.map(i => i.title),
}))

const write = (name, data) => writeFileSync(join(outDir, name), JSON.stringify(data, null, 2) + '\n')
write('projects.json', projects)
write('skills.json', skillGroups)
write('experience.json', experience)

console.log(`synced from ${portfolio}: ${projects.length} projects, ${skillGroups.length} skill groups, ${experience.length} roles`)
