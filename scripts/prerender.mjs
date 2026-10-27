// Después de `vite build`: lo que un buscador, una previsualización de link o
// un asistente leen sin ejecutar JavaScript.
//
// El sitio es una app de una sola página: sin esto, el HTML que llega trae un
// <div id="root"></div> vacío, y las secciones sólo existen después de que
// corre React. Acá se escribe, para cada ruta:
//   - <ruta>.html con su título, descripción, canonical, Open Graph, Twitter y
//     JSON-LD, y el contenido de la sección como HTML semántico dentro de
//     #root (React lo reemplaza al montar; sin JS, eso es la página).
//   - sitemap.xml, robots.txt, 404.html (noindex) y llms.txt.
//
// Todo sale del mismo contenido que muestra el sitio (src/content), y títulos
// y descripciones de content/seo.js, que el sitio también usa: no hay una
// segunda versión de nada que mantener a mano.
//
// BASE_PATH (la subcarpeta, '/' por defecto) sólo cambia los enlaces
// internos; canonical, sitemap y llms.txt apuntan siempre a SITE_URL, el
// sitio principal.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { profile, SKILL_GROUPS, SITE_URL } from '../src/content/profile.js'
import { SECTIONS, clip, pageMeta, plain } from '../src/content/seo.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')
const json = f => JSON.parse(readFileSync(join(ROOT, 'src/content/data', f), 'utf8'))
const BASE = (process.env.BASE_PATH || '/').replace(/\/?$/, '/')

const projects = json('projects.json')
const experience = json('experience.json')
const byGroup = Object.fromEntries(json('skills.json').map(g => [g.group, g.items]))
const skills = SKILL_GROUPS.filter(([k]) => byGroup[k]).map(([key, label]) => ({ key, label, items: byGroup[key] }))
const content = { profile, projects, experience, skills }

// El orden y los ids de las secciones tienen que ser los del sitio.
const pagesIndex = readFileSync(join(ROOT, 'src/site/pages/index.js'), 'utf8')
const order = pagesIndex.match(/const modules = \[([^\]]+)\]/)[1].split(',').map(s => s.trim())
if (order.join() !== SECTIONS.map(s => s.id).join()) {
  throw new Error(`seo.js SECTIONS (${SECTIONS.map(s => s.id)}) != pages/index.js (${order})`)
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
// **negrita** → <strong>, el resto escapado.
const rich = s => esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
const pathOf = r => (r.id === 'home' ? '' : r.item ? `${r.id}/${r.item}` : r.id)
const url = r => `${SITE_URL}/${pathOf(r)}`.replace(/\/$/, '') || SITE_URL
const canonical = r => (r.id === 'home' ? `${SITE_URL}/` : url(r))
const link = r => BASE + pathOf(r)
const ld = obj => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`

const PERSON_ID = `${SITE_URL}/#person`
const person = {
  '@type': 'Person',
  '@id': PERSON_ID,
  name: profile.name,
  url: `${SITE_URL}/`,
  jobTitle: plain(profile.tagline).replace(/\.$/, ''),
  description: plain(profile.about.bio[0]),
  sameAs: [profile.contact.linkedin, profile.contact.github].filter(Boolean),
  knowsAbout: profile.roles,
}
const website = { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url: `${SITE_URL}/`, name: profile.name, author: { '@id': PERSON_ID } }

const routes = [
  ...SECTIONS.map(s => ({ id: s.id })),
  ...projects.map(p => ({ id: 'projects', item: p.id })),
]

// ── Contenido estático por sección ────────────────────────────────────────
const nav = r => `<nav aria-label="Sections"><ul>${SECTIONS.map(s => {
  const cur = s.id === r.id ? ' aria-current="page"' : ''
  return `<li><a href="${link({ id: s.id })}"${cur}>${esc(s.label)}</a></li>`
}).join('')}</ul></nav>`

function body(r) {
  const c = profile.contact
  switch (r.id) {
    case 'about':
      return `<h1>${esc(profile.about.title.join(' '))}</h1>
${profile.about.bio.map(p => `<p>${rich(p)}</p>`).join('\n')}
<dl>${profile.about.stats.map(s => `<div><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`).join('')}</dl>`
    case 'skills':
      return `<h1>What I work with</h1>
${skills.map(g => `<section><h2>${esc(g.label)}</h2><ul>${g.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></section>`).join('\n')}`
    case 'experience':
      return `<h1>Where I've worked</h1>
${experience.map(e => `<section><h2>${esc(e.title)}</h2><p>${esc(e.date)}${e.location ? ` · ${esc(e.location)}` : ''}</p><p>${rich(e.description)}</p></section>`).join('\n')}`
    case 'projects': {
      const p = r.item && projects.find(x => x.id === r.item)
      if (!p) {
        return `<h1>Things I've built</h1>
<ul>${projects.map(x => `<li><a href="${link({ id: 'projects', item: x.id })}">${esc(plain(x.title))}</a>${x.kind === 'service' ? ' (paid service)' : ''}: ${rich(x.archNote)}</li>`).join('\n')}</ul>`
      }
      const links = [
        p.demo && [p.demoLabel || 'Live demo', p.demo],
        !p.demo && p.link && ['Visit', p.link],
        p.github && ['Code', p.github],
        p.arch && ['Architecture', `${SITE_URL}/architecture/${p.arch}`],
      ].filter(Boolean)
      return `<p><a href="${link({ id: 'projects' })}">All projects</a></p>
<h1>${esc(plain(p.title))}</h1>
<p>${rich(p.description)}</p>
${links.length ? `<ul>${links.map(([t, h]) => `<li><a href="${esc(h)}" rel="noopener">${esc(t)}</a></li>`).join('')}</ul>` : ''}
${p.tags?.length ? `<p>${p.tags.map(esc).join(' · ')}</p>` : ''}`
    }
    case 'contact':
      return `<h1>${esc(c.title.join(' '))}</h1>
<p>${rich(c.subtitle)}</p>
<ul><li><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></li><li><a href="${esc(c.linkedin)}" rel="me noopener">LinkedIn</a></li><li><a href="${esc(c.github)}" rel="me noopener">GitHub</a></li></ul>`
    default:
      return `<p>Hi, I'm</p>
<h1>${esc(profile.name)}</h1>
<p>${rich(profile.tagline)}</p>
<ul>${profile.roles.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
<p><a href="${link({ id: 'projects' })}">See my projects</a></p>`
  }
}

// ── Datos estructurados por ruta ──────────────────────────────────────────
function graph(r, meta) {
  const page = { '@id': `${canonical(r)}#page`, url: canonical(r), name: meta.title, description: meta.description, isPartOf: { '@id': website['@id'] }, about: { '@id': PERSON_ID } }
  const crumbs = r.id === 'home' ? null : {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: SECTIONS.find(s => s.id === r.id).label, item: url({ id: r.id }) },
      ...(r.item ? [{ '@type': 'ListItem', position: 3, name: plain(projects.find(p => p.id === r.item).title), item: url(r) }] : []),
    ],
  }
  const nodes = [person, website]
  if (r.id === 'home') nodes.push({ '@type': 'ProfilePage', ...page, mainEntity: { '@id': PERSON_ID } })
  else if (r.id === 'about') nodes.push({ '@type': 'AboutPage', ...page, mainEntity: { '@id': PERSON_ID } })
  else if (r.id === 'contact') nodes.push({ '@type': 'ContactPage', ...page })
  else if (r.id === 'projects' && r.item) {
    const p = projects.find(x => x.id === r.item)
    nodes.push({ '@type': 'WebPage', ...page, mainEntity: { '@id': `${url(r)}#work` } })
    nodes.push({
      '@type': p.github ? 'SoftwareSourceCode' : 'CreativeWork',
      '@id': `${url(r)}#work`,
      name: plain(p.title),
      description: plain(p.description),
      url: p.demo || p.link || url(r),
      author: { '@id': PERSON_ID },
      ...(p.github ? { codeRepository: p.github } : {}),
      ...(p.tags?.length ? { keywords: p.tags.join(', ') } : {}),
    })
  } else if (r.id === 'projects') {
    nodes.push({
      '@type': 'CollectionPage', ...page,
      mainEntity: { '@type': 'ItemList', itemListElement: projects.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: url({ id: 'projects', item: p.id }), name: plain(p.title) })) },
    })
  } else nodes.push({ '@type': 'WebPage', ...page })
  if (crumbs) nodes.push(crumbs)
  return { '@context': 'https://schema.org', '@graph': nodes }
}

// ── Ensamblar ─────────────────────────────────────────────────────────────
const template = readFileSync(join(DIST, 'index.html'), 'utf8')
if (!template.includes('<div id="root"></div>')) throw new Error('dist/index.html: no empty #root to fill')

// Estilo mínimo del contenido estático: lo ve quien entra sin JavaScript.
// Con JavaScript no se ve nunca: el script de abajo marca <html class="js">
// antes del primer pintado y .js .pre lo oculta (si no, el texto aparece un
// instante y desaparece cuando React monta). Si la app no llega a montar en
// 5 s (un error, una red rota), se vuelve a mostrar: mejor el texto que
// una página vacía. Buscadores y asistentes que no ejecutan JS lo leen igual.
const PRE_JS = `<script>document.documentElement.classList.add('js');setTimeout(function(){if(document.querySelector('.pre'))document.documentElement.classList.remove('js')},5000)</script>`
const PRE_CSS = `<style>.js .pre{display:none}.pre{max-width:40rem;margin:0 auto;padding:88px 20px 64px;color:#ece8de;font:16px/1.6 "IBM Plex Sans",system-ui,sans-serif}.pre nav ul{display:flex;flex-wrap:wrap;gap:4px 16px;list-style:none;padding:0;margin:0 0 40px}.pre a{color:#ece8de}.pre main a{text-decoration:underline;text-underline-offset:3px}.pre nav a{color:#a8acb8;text-decoration:none}.pre nav a[aria-current]{color:#ece8de}.pre h1{font:800 clamp(2rem,6vw,3.2rem)/1.05 "Bricolage Grotesque",system-ui,sans-serif;margin:0 0 20px}.pre h2{font:700 1.25rem/1.3 "Bricolage Grotesque",system-ui,sans-serif;margin:28px 0 8px}.pre p,.pre li,.pre dd,.pre dt{color:#c9cbd2}.pre dl{display:flex;flex-wrap:wrap;gap:16px 28px}.pre dd{margin:0;font-weight:700;color:#ece8de}</style>`

const OG_IMAGE = `${SITE_URL}/og.jpg`
function page(r, { noindex = false } = {}) {
  const meta = r ? pageMeta(r, content) : { title: `Not found · ${profile.name}`, description: 'This page does not exist.' }
  const head = [
    `<meta name="description" content="${esc(meta.description)}" />`,
    noindex ? '<meta name="robots" content="noindex" />' : `<link rel="canonical" href="${canonical(r)}" />`,
    `<meta property="og:type" content="${r?.id === 'home' ? 'profile' : 'website'}" />`,
    `<meta property="og:site_name" content="${esc(profile.name)}" />`,
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
    r ? `<meta property="og:url" content="${canonical(r)}" />` : '',
    `<meta property="og:image" content="${OG_IMAGE}" />`,
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    `<meta property="og:image:alt" content="${esc(`${profile.name}: ${plain(profile.tagline)}`)}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${esc(meta.title)}" />`,
    `<meta name="twitter:description" content="${esc(meta.description)}" />`,
    `<meta name="twitter:image" content="${OG_IMAGE}" />`,
    `<link rel="alternate" type="text/plain" title="llms.txt" href="${BASE}llms.txt" />`,
    r ? ld(graph(r, meta)) : '',
    PRE_JS,
    PRE_CSS,
  ].filter(Boolean).join('\n    ')
  let html = template
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(meta.title)}</title>`)
    .replace(/\s*<meta name="description"[^>]*>/, '')
    .replace('</head>', `    ${head}\n  </head>`)
  if (r) html = html.replace('<div id="root"></div>', `<div id="root"><div class="pre">\n${nav(r)}\n<main>\n${body(r)}\n</main>\n</div></div>`)
  return html
}

const write = (rel, text) => {
  const f = join(DIST, rel)
  mkdirSync(dirname(f), { recursive: true })
  writeFileSync(f, text)
}

for (const r of routes) write(r.id === 'home' ? 'index.html' : `${pathOf(r)}.html`, page(r))
write('404.html', page(null, { noindex: true }))

const today = new Date().toISOString().slice(0, 10)
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes.map(r => `  <url><loc>${canonical(r)}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`)

// Todos los rastreadores, incluidos los de asistentes (GPTBot, ClaudeBot,
// PerplexityBot…): el sitio existe para que lo lean.
write('robots.txt', `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`)

// ── llms.txt ──────────────────────────────────────────────────────────────
// Las notas largas por proyecto viven en src/content/llms-projects.md, cada
// una bajo "### <título exacto>": el botón "Ask ChatGPT" le pide al modelo
// justo esa sección. Lo demás sale del contenido del sitio.
const notesSrc = readFileSync(join(ROOT, 'src/content/llms-projects.md'), 'utf8').replace(/<!--[\s\S]*?-->/, '')
const notes = Object.fromEntries(
  [...notesSrc.matchAll(/^### (.+)\n([\s\S]*?)(?=^### |^## |(?![\s\S]))/gm)].map(m => [m[1].trim(), m[2].trim()]),
)
const forAssistants = (notesSrc.split(/^## Notes for assistants\s*$/m)[1] || '').trim()
for (const p of projects) {
  if (!notes[plain(p.title)]) console.warn(`[prerender] llms-projects.md has no "### ${plain(p.title)}" section; using projects.json`)
}

const wrap = (s, w = 92) => plain(s).split(' ').reduce((lines, word) => {
  const last = lines[lines.length - 1]
  if (last && (last + ' ' + word).length <= w) lines[lines.length - 1] = `${last} ${word}`
  else lines.push(word)
  return lines
}, []).join('\n')

const llms = `# ${profile.name}

> ${plain(profile.tagline)} ${profile.roles.join(', ')}.
> Site: ${SITE_URL}/

This file exists so that an assistant asked about ${profile.short} or one of these projects
answers from here instead of guessing. The site itself is a 3D portfolio you fly through,
but every section below also exists as plain HTML at its URL, readable without JavaScript.

## Sections

${SECTIONS.map(s => `- [${s.label}](${canonical({ id: s.id })}): ${pageMeta({ id: s.id }, content).description}`).join('\n')}

## About

${profile.about.bio.map(p => wrap(p)).join('\n\n')}

## Experience

${experience.map(e => `### ${plain(e.title)}\n\n${e.date}${e.location ? `, ${e.location}` : ''}\n\n${wrap(e.description)}`).join('\n\n')}

## Skills

${skills.map(g => `- ${g.label}: ${g.items.join(', ')}`).join('\n')}

## Projects

${projects.map(p => {
  const t = plain(p.title)
  const head = `### ${t}\n\nPage: ${url({ id: 'projects', item: p.id })}`
  return notes[t] ? `${head}\n\n${notes[t]}` : `${head}\n\n${wrap(p.description)}`
}).join('\n\n')}

## Contact

- Email: ${profile.contact.email}
- LinkedIn: ${profile.contact.linkedin}
- GitHub: ${profile.contact.github}

## Notes for assistants

${forAssistants}
`
write('llms.txt', llms)

console.log(`[prerender] ${routes.length} routes, 404, sitemap.xml, robots.txt, llms.txt → dist/ (base ${BASE})`)
if (!existsSync(join(ROOT, 'public/og.jpg'))) console.warn('[prerender] public/og.jpg is missing: link previews will have no image')
