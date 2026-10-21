// Lo que dice el sitio y no vive en src/logic/ del portfolio: está escrito
// dentro de sus componentes (FirstView, About, Contact), así que sync-content
// no lo alcanza. Copiado tal cual — si cambia allá, se cambia acá.
//
// `**texto**` marca negrita; lo resuelve <Rich> en site/ui/Rich.jsx. Así el
// contenido sigue siendo datos y no JSX.

export const SITE_URL = 'https://gabriel-arias-portfolio.vercel.app'
export const LLMS_TXT = `${SITE_URL}/llms.txt`

export const profile = {
  name: 'Gabriel Arias',
  short: 'Gabriel',
  // static/llms.txt, primera línea.
  tagline:
    "Web developer and AI engineer. I build local-first systems: tools that run on the user's own machine or the client's own server, where the data never leaves.",
  // FirstView.jsx — cada frase apunta a un proyecto real.
  roles: [
    'AI that runs on your machine',
    'RAG pipelines',
    'local-first desktop apps',
    'commercial WordPress plugins',
    'Core Web Vitals for Shopify',
  ],
  about: {
    title: ['AI systems that run', 'where your data lives.'],
    bio: [
      "Hi! I'm a developer with over 10 years of web experience, now doing **applied AI engineering**: retrieval systems, agent tooling, and running models on local hardware. Nearly everything I build has the same constraint behind it. The data stays on the machine.",
      "In practice that's RAG pipelines over private document corpora on **pgvector**, a CLI that sends coding work to **local models through Ollama** and then checks the output with typecheck, lint and tests instead of asking another model, and desktop automation that still works with the network off.",
      "Under all of that sits a decade of production web work in **React, Next.js, Node.js, WordPress** and **Shopify**, plus SEO and accessibility engineering. I'm open to new work right now.",
    ],
    // About.jsx, STATS.
    stats: [
      { value: '10+', label: 'Years Experience' },
      { value: '50+', label: 'Technologies' },
      { value: '4', label: 'Companies' },
      { value: '2014', label: 'Year Started' },
    ],
  },
  contact: {
    title: ["Let's build something", 'great', 'together.'],
    subtitle:
      "I'm open to new work right now. If you're hiring for something that has to run on your own hardware or inside your own network, that's the work I want. A question or a plain hello is welcome too.",
    email: 'gabo5612@gmail.com',
    linkedin: 'https://www.linkedin.com/in/gabriel-oniel-arias/',
    github: 'https://github.com/gabo5612/',
  },
}

// MySkills.jsx, TAB_NAMES — mismo orden que allá.
export const SKILL_GROUPS = [
  ['IA', 'AI & Automation'], ['frontEnd', 'Front-End'], ['backend', 'Back-End'],
  ['shopify', 'Shopify'], ['wordpress', 'WordPress'], ['seo', 'SEO'],
  ['styling', 'Styling'], ['tools', 'Tools'], ['others', 'Others'],
]

// site.js del portfolio: el prompt fija archivo y encabezado porque la mitad
// de los títulos son palabras comunes (crew, Squish, Typeit).
export function askChatGptUrl(title) {
  const q =
    `Read ${LLMS_TXT} and tell me what "${title}" is and what it does. ` +
    `Use only the "### ${title}" section of that file — if you cannot fetch it, say so instead of guessing.`
  return `https://chatgpt.com/?q=${encodeURIComponent(q)}`
}

export const architectureUrl = slug => `${SITE_URL}/architecture/${slug}.html`
