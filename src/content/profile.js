// Portfolio content configuration.
// Content used across FirstView, About, Contact, and Skills.
//
// `**text**` marks bold text, rendered by <Rich> in site/ui/Rich.jsx.
// Content remains structured data rather than JSX.

export const SITE_URL = 'https://gabriel-arias-portfolio.vercel.app'
export const LLMS_TXT = `${SITE_URL}/llms.txt`

export const profile = {
  name: 'Gabriel Arias',
  short: 'Gabriel',

  // static/llms.txt — first line.
  tagline:
    'Senior Full-Stack Developer, AI Engineer & Technical Lead.',

  // FirstView.jsx — professional specializations.
  roles: [
    'Applied AI Engineering',
    'AI Agents & RAG Systems',
    'Local LLMs & AI Infrastructure',
    'Full-Stack Web Development',
    'Shopify & E-commerce Engineering',
    'WordPress & Plugin Development',
    'Software Architecture & Automation',
  ],

  about: {
    title: [
      'Building intelligent systems.',
      'Engineering real solutions.',
    ],

    // About.jsx — biography.
    bio: [
      "Hi! I'm a **Senior Full-Stack Developer and AI Engineer with 7+ years of professional experience**, building production-ready applications, e-commerce platforms, AI-powered systems, and automation tools. I specialize in turning complex technical challenges into reliable, scalable solutions.",

      "My current focus is **applied AI engineering**, including **RAG pipelines, AI agents, local LLMs, semantic search, and intelligent automation**. I work with **Python, FastAPI, PostgreSQL, pgvector, Ollama, OpenAI, Anthropic, and MCP**, designing AI systems with evaluation pipelines, automated testing, and privacy-first architectures. I'm also working on enterprise-scale, self-hosted AI infrastructure.",

      "My engineering background spans **React, Next.js, Node.js, TypeScript, Shopify, Shopify Plus, WordPress, and WooCommerce**. I have extensive experience developing custom applications, APIs, e-commerce platforms, plugins, and integrations, alongside **technical SEO, Core Web Vitals, performance optimization, and accessibility engineering**.",

      "Beyond writing code, I **lead technical projects, define software architectures, coordinate developers, and translate business requirements into scalable technical solutions**. I've also designed, developed, and launched my own commercial software products, including **WordPress plugins, AI-powered tools, and secure desktop automation applications**.",

      "I enjoy working at the intersection of **artificial intelligence, software engineering, and business growth**. My goal is to build technology that solves real problems, improves workflows, and delivers measurable value. **Currently open to new opportunities, collaborations, and challenging projects.**",
    ],

    // About.jsx — statistics.
    stats: [
      {
        value: '7+',
        label: 'Years Experience',
      },
      {
        value: '100+',
        label: 'Technologies',
      },
      {
        value: '4',
        label: 'Companies',
      },
      {
        value: '2019',
        label: 'Year Started',
      },
    ],
  },

contact: {
  title: [
    'Good things start',
    'with a',
    'conversation.',
  ],

  subtitle:
    "Great ideas deserve great engineering. I enjoy connecting with people who are building ambitious products, exploring AI, or solving complex technical challenges. Whether it's a project, a collaboration, or simply an interesting conversation, my inbox is always open.",

    email: 'gabrielariasdev@gmail.com',

    linkedin:
      'https://www.linkedin.com/in/gabriel-oniel-arias/',

    github:
      'https://github.com/gabo5612/',
  },
}

// MySkills.jsx — TAB_NAMES.
// Keep the same order as the portfolio.
export const SKILL_GROUPS = [
  ['IA', 'AI & Automation'],
  ['frontEnd', 'Front-End'],
  ['backend', 'Back-End'],
  ['shopify', 'Shopify'],
  ['wordpress', 'WordPress'],
  ['seo', 'SEO'],
  ['styling', 'Styling'],
  ['tools', 'Tools'],
  ['others', 'Others'],
]

// Portfolio project integration with ChatGPT.
// Each project is referenced by its exact heading in llms.txt.
export function askChatGptUrl(title) {
  const q =
    `Read ${LLMS_TXT} and tell me what "${title}" is and what it does. ` +
    `Use only the "### ${title}" section of that file — if you cannot fetch it, say so instead of guessing.`

  return `https://chatgpt.com/?q=${encodeURIComponent(q)}`
}

// Architecture documentation URLs.
export const architectureUrl = slug =>
  `${SITE_URL}/architecture/${slug}.html`